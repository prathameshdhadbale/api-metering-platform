import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { installDatabaseHooks } from './helpers/test-hooks.js';
import { registerAndLogin, createApiKey } from './helpers/fixtures.js';
import { queryTestDatabase, waitForUsageEvents } from './helpers/database.js';

installDatabaseHooks();

test('user can register, meter and inspect usage, then revoke their API key', async () => {
  await queryTestDatabase("UPDATE plans SET daily_quota=2, rate_limit_requests=1 WHERE name='Free'");
  const { app, user, registration, login, token } = await registerAndLogin();
  assert.equal(registration.status, 201);
  assert.equal(login.status, 200);

  const catalog = await request(app).get('/api/plans').set('Authorization', `Bearer ${token}`);
  assert.equal(catalog.status, 200);
  const created = await createApiKey(token, { name: 'Phase 5 workflow' });
  assert.equal(created.status, 201);
  const apiKeyId = created.body.apiKeyDetails.id;
  const secret = created.body.key;

  const first = await request(app).get('/api/test').set('x-api-key', secret);
  assert.equal(first.status, 200);
  assert.equal(first.headers['x-ratelimit-remaining'], '0');
  assert.equal(first.headers['x-quota-remaining'], '1');
  const rateRejected = await request(app).get('/api/test').set('x-api-key', secret);
  assert.equal(rateRejected.status, 429);
  assert.equal(rateRejected.body.error, 'Rate limit exceeded');

  await queryTestDatabase("UPDATE api_key_rate_limit_windows SET window_started_at=clock_timestamp()-INTERVAL '7 hours'");
  await queryTestDatabase("UPDATE plans SET rate_limit_requests=10 WHERE name='Free'");
  const second = await request(app).get('/api/test').set('x-api-key', secret);
  assert.equal(second.status, 200);
  assert.equal(second.headers['x-quota-remaining'], '0');
  const quotaRejected = await request(app).get('/api/test').set('x-api-key', secret);
  assert.equal(quotaRejected.status, 429);
  assert.equal(quotaRejected.body.error, 'Daily request quota exceeded');

  await waitForUsageEvents(4);
  const overview = await request(app).get('/api/analytics/summary').set('Authorization', `Bearer ${token}`);
  assert.equal(overview.status, 200);
  assert.deepEqual(overview.body.summary, {
    total_requests: 4,
    admitted_requests: 2,
    rejected_requests: 2,
    admission_rate_percent: '50.00'
  });
  const daily = await request(app).get('/api/analytics/daily?days=1').set('Authorization', `Bearer ${token}`);
  assert.equal(daily.body.dailyUsage[0].total_requests, 4);
  const byKey = await request(app).get('/api/analytics/keys').set('Authorization', `Bearer ${token}`);
  assert.equal(byKey.body.apiKeys[0].api_key_id, apiKeyId);
  const endpoints = await request(app).get('/api/analytics/endpoints').set('Authorization', `Bearer ${token}`);
  assert.equal(endpoints.body.endpoints[0].endpoint, '/api/test');
  assert.equal(endpoints.body.endpoints[0].total_requests, 4);

  const listed = await request(app).get('/api/keys').set('Authorization', `Bearer ${token}`);
  assert.equal(listed.body[0].name, 'Phase 5 workflow');
  assert.equal(JSON.stringify(listed.body).includes(secret), false);
  const revoked = await request(app).patch(`/api/keys/${apiKeyId}/revoke`).set('Authorization', `Bearer ${token}`);
  assert.equal(revoked.status, 200);
  const rejectedAfterRevoke = await request(app).get('/api/test').set('x-api-key', secret);
  assert.equal(rejectedAfterRevoke.status, 401);
  const owner = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  assert.equal(owner.status, 200);
  assert.equal(owner.body, registration.body.id);
  assert.ok(user.email.endsWith('@example.test'));
});
