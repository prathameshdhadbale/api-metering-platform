import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { installDatabaseHooks } from './helpers/test-hooks.js';
import { registerAndLogin, createApiKey } from './helpers/fixtures.js';
import { queryTestDatabase, holdApiKeyRowLock, waitForBlockedApiKeyRequest, waitForUsageEvents } from './helpers/database.js';

installDatabaseHooks();

test('daily quota rejects excess requests without incrementing counters', async () => {
  await queryTestDatabase("UPDATE plans SET daily_quota=2, rate_limit_requests=20 WHERE name='Free'");
  const { app, token } = await registerAndLogin();
  const key = await createApiKey(token);
  const first = await request(app).get('/api/test').set('x-api-key', key.body.key);
  const second = await request(app).get('/api/test').set('x-api-key', key.body.key);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(first.headers['x-quota-remaining'], '1');
  assert.equal(second.headers['x-quota-remaining'], '0');
  const reset = await queryTestDatabase(`SELECT EXTRACT(EPOCH FROM
    ((((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date + 1)::timestamp) AT TIME ZONE 'UTC'))::bigint AS value`);
  assert.equal(Number(second.headers['x-quota-reset']), Number(reset.rows[0].value));
  const rejected = await request(app).get('/api/test').set('x-api-key', key.body.key);
  assert.equal(rejected.status, 429);
  assert.equal(rejected.body.error, 'Daily request quota exceeded');
  assert.equal(rejected.headers['x-quota-limit'], '2');
  assert.equal(rejected.headers['x-quota-remaining'], '0');
  assert.equal(Number(rejected.headers['x-quota-reset']), Number(reset.rows[0].value));
  await waitForUsageEvents(3);
  const counts = await queryTestDatabase('SELECT (SELECT request_count FROM api_key_daily_usage) AS daily, (SELECT request_count FROM api_key_rate_limit_windows) AS rate');
  assert.equal(counts.rows[0].daily, 2);
  assert.equal(counts.rows[0].rate, 2);
});

test('rate limit and daily quota are enforced together', async () => {
  await queryTestDatabase("UPDATE plans SET daily_quota=20, rate_limit_requests=2 WHERE name='Free'");
  const { app, token } = await registerAndLogin();
  const key = await createApiKey(token);
  const first = await request(app).get('/api/test').set('x-api-key', key.body.key);
  const second = await request(app).get('/api/test').set('x-api-key', key.body.key);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(first.headers['x-ratelimit-remaining'], '1');
  assert.equal(second.headers['x-ratelimit-remaining'], '0');
  const rejected = await request(app).get('/api/test').set('x-api-key', key.body.key);
  assert.equal(rejected.status, 429);
  assert.equal(rejected.body.error, 'Rate limit exceeded');
  assert.equal(rejected.headers['x-ratelimit-limit'], '2');
  assert.equal(rejected.headers['x-ratelimit-remaining'], '0');
  assert.ok(Number(rejected.headers['x-ratelimit-reset']) > Math.floor(Date.now() / 1000));
  await waitForUsageEvents(3);
  const counts = await queryTestDatabase('SELECT (SELECT request_count FROM api_key_daily_usage) AS daily, (SELECT request_count FROM api_key_rate_limit_windows) AS rate');
  assert.deepEqual(counts.rows[0], { daily: 2, rate: 2 });
});

test('concurrent calls cannot admit more requests than the limit', async () => {
  await queryTestDatabase("UPDATE plans SET daily_quota=20, rate_limit_requests=3 WHERE name='Free'");
  const { app, token } = await registerAndLogin();
  const key = await createApiKey(token);
  const responses = await Promise.all(Array.from({ length: 8 }, () => request(app).get('/api/test').set('x-api-key', key.body.key)));
  assert.equal(responses.filter((response) => response.status === 200).length, 3);
  assert.equal(responses.filter((response) => response.status === 429).length, 5);
  const counts = await queryTestDatabase('SELECT (SELECT request_count FROM api_key_daily_usage) AS daily, (SELECT request_count FROM api_key_rate_limit_windows) AS rate');
  assert.deepEqual(counts.rows[0], { daily: 3, rate: 3 });
  await waitForUsageEvents(8);
});

test('expired rolling windows restart from the first admitted request', async () => {
  await queryTestDatabase("UPDATE plans SET daily_quota=20, rate_limit_requests=1 WHERE name='Free'");
  const { app, token } = await registerAndLogin();
  const key = await createApiKey(token);
  assert.equal((await request(app).get('/api/test').set('x-api-key', key.body.key)).status, 200);
  await queryTestDatabase("UPDATE api_key_rate_limit_windows SET window_started_at=clock_timestamp()-INTERVAL '7 hours'");
  const next = await request(app).get('/api/test').set('x-api-key', key.body.key);
  assert.equal(next.status, 200);
  const windows = await queryTestDatabase('SELECT request_count FROM api_key_rate_limit_windows ORDER BY window_started_at');
  assert.deepEqual(windows.rows.map((row) => row.request_count), [1, 1]);
});

test('each API key has an independent rolling window', async () => {
  await queryTestDatabase("UPDATE plans SET daily_quota=20, rate_limit_requests=1 WHERE name='Free'");
  const { app, token } = await registerAndLogin();
  const first = await createApiKey(token, { name: 'First key' });
  const second = await createApiKey(token, { name: 'Second key' });
  assert.equal((await request(app).get('/api/test').set('x-api-key', first.body.key)).status, 200);
  assert.equal((await request(app).get('/api/test').set('x-api-key', first.body.key)).status, 429);
  assert.equal((await request(app).get('/api/test').set('x-api-key', second.body.key)).status, 200);
  const counters = await queryTestDatabase('SELECT api_key_id, request_count FROM api_key_daily_usage ORDER BY api_key_id');
  assert.deepEqual(counters.rows.map((row) => row.request_count), [1, 1]);
});

test('a prior UTC date quota row does not consume the current UTC day quota', async () => {
  await queryTestDatabase("UPDATE plans SET daily_quota=1, rate_limit_requests=10 WHERE name='Free'");
  const { app, token } = await registerAndLogin();
  const key = await createApiKey(token);
  await queryTestDatabase(`INSERT INTO api_key_daily_usage (api_key_id, usage_date, request_count)
    VALUES ($1, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 1, 1)`, [key.body.apiKeyDetails.id]);
  const response = await request(app).get('/api/test').set('x-api-key', key.body.key);
  assert.equal(response.status, 200);
  const rows = await queryTestDatabase('SELECT usage_date, request_count FROM api_key_daily_usage ORDER BY usage_date');
  assert.equal(rows.rows.length, 2);
  assert.deepEqual(rows.rows.map((row) => row.request_count), [1, 1]);
});

test('daily quotas are independent for different API keys', async () => {
  await queryTestDatabase("UPDATE plans SET daily_quota=1, rate_limit_requests=10 WHERE name='Free'");
  const { app, token } = await registerAndLogin();
  const first = await createApiKey(token, { name: 'First daily key' });
  const second = await createApiKey(token, { name: 'Second daily key' });
  assert.equal((await request(app).get('/api/test').set('x-api-key', first.body.key)).status, 200);
  assert.equal((await request(app).get('/api/test').set('x-api-key', first.body.key)).status, 429);
  assert.equal((await request(app).get('/api/test').set('x-api-key', second.body.key)).status, 200);
  const counts = await queryTestDatabase('SELECT request_count FROM api_key_daily_usage ORDER BY api_key_id');
  assert.deepEqual(counts.rows.map((row) => row.request_count), [1, 1]);
});

test('when both limits are exhausted neither counter advances on rejection', async () => {
  await queryTestDatabase("UPDATE plans SET daily_quota=1, rate_limit_requests=1 WHERE name='Free'");
  const { app, token } = await registerAndLogin();
  const key = await createApiKey(token);
  assert.equal((await request(app).get('/api/test').set('x-api-key', key.body.key)).status, 200);
  const rejected = await request(app).get('/api/test').set('x-api-key', key.body.key);
  assert.equal(rejected.status, 429);
  assert.equal(rejected.body.error, 'Daily request quota exceeded');
  const counts = await queryTestDatabase('SELECT (SELECT request_count FROM api_key_daily_usage) AS daily, (SELECT request_count FROM api_key_rate_limit_windows) AS rate');
  assert.deepEqual(counts.rows[0], { daily: 1, rate: 1 });
});

test('a blocked request for one key does not block a different key', async () => {
  await queryTestDatabase("UPDATE plans SET daily_quota=10, rate_limit_requests=10 WHERE name='Free'");
  const { app, token } = await registerAndLogin();
  const first = await createApiKey(token, { name: 'Locked key' });
  const second = await createApiKey(token, { name: 'Independent key' });
  const releaseLock = await holdApiKeyRowLock(first.body.apiKeyDetails.id);
  try {
    const waitingRequest = request(app).get('/api/test').set('x-api-key', first.body.key).then((value) => value);
    await waitForBlockedApiKeyRequest();
    const independent = await request(app).get('/api/test').set('x-api-key', second.body.key).timeout({ response: 1000 });
    assert.equal(independent.status, 200);
    await releaseLock();
    assert.equal((await waitingRequest).status, 200);
  } finally {
    await releaseLock();
  }
});
