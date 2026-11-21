import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { installDatabaseHooks } from './helpers/test-hooks.js';
import { registerAndLogin, createApiKey } from './helpers/fixtures.js';
import { queryTestDatabase, waitForUsageEvents } from './helpers/database.js';

installDatabaseHooks();

test('metering records admitted and quota-rejected authenticated requests', async () => {
  await queryTestDatabase("UPDATE plans SET daily_quota=1, rate_limit_requests=10 WHERE name='Free'");
  const { app, token } = await registerAndLogin();
  const key = await createApiKey(token);
  assert.equal((await request(app).get('/api/test').set('x-api-key', key.body.key)).status, 200);
  assert.equal((await request(app).get('/api/test').set('x-api-key', key.body.key)).status, 429);
  await waitForUsageEvents(2);
  const events = await queryTestDatabase('SELECT api_key_id, status_code, admitted, latency_ms, endpoint FROM usage_events ORDER BY id');
  assert.deepEqual(events.rows.map((event) => [event.status_code, event.admitted]), [[200, true], [429, false]]);
  assert.ok(events.rows.every((event) => event.latency_ms >= 0 && event.endpoint === '/api/test' && event.api_key_id === key.body.apiKeyDetails.id));
});

test('rate-limited requests are logged as rejected usage events', async () => {
  await queryTestDatabase("UPDATE plans SET daily_quota=10, rate_limit_requests=1 WHERE name='Free'");
  const { app, token } = await registerAndLogin();
  const key = await createApiKey(token);
  await request(app).get('/api/test').set('x-api-key', key.body.key);
  await request(app).get('/api/test').set('x-api-key', key.body.key);
  await waitForUsageEvents(2);
  const result = await queryTestDatabase('SELECT api_key_id, status_code, admitted FROM usage_events ORDER BY id');
  assert.deepEqual(result.rows.map((row) => [row.api_key_id, row.status_code, row.admitted]), [
    [key.body.apiKeyDetails.id, 200, true],
    [key.body.apiKeyDetails.id, 429, false]
  ]);
});

test('requests with invalid API keys are not recorded as authenticated usage', async () => {
  const app = await (await import('./helpers/database.js')).getTestApp();
  assert.equal((await request(app).get('/api/test').set('x-api-key', 'invalid')).status, 401);
  const events = await queryTestDatabase('SELECT COUNT(*)::int AS count FROM usage_events');
  assert.equal(events.rows[0].count, 0);
});
