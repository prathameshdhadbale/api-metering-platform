import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { installDatabaseHooks } from './helpers/test-hooks.js';
import { registerAndLogin, createApiKey } from './helpers/fixtures.js';
import { queryTestDatabase } from './helpers/database.js';

installDatabaseHooks();

test('keys are created once, listed without secrets, and revoked by their owner', async () => {
  const { app, token } = await registerAndLogin();
  const created = await createApiKey(token);
  assert.equal(created.status, 201);
  assert.equal(typeof created.body.key, 'string');
  const id = created.body.apiKeyDetails.id;
  const list = await request(app).get('/api/keys').set('Authorization', `Bearer ${token}`);
  assert.equal(list.status, 200);
  assert.equal(list.body[0].id, id);
  assert.equal(JSON.stringify(list.body).includes(created.body.key), false);
  const stored = await queryTestDatabase('SELECT key_hash FROM api_keys WHERE id=$1', [id]);
  assert.notEqual(stored.rows[0].key_hash, created.body.key);
  assert.equal(stored.rows[0].key_hash.length, 64);
  assert.equal((await request(app).get('/api/test').set('x-api-key', created.body.key)).status, 200);
  const revoked = await request(app).patch(`/api/keys/${id}/revoke`).set('Authorization', `Bearer ${token}`);
  assert.equal(revoked.status, 200);
  assert.equal(revoked.body.status, 'revoked');
  const alreadyRevoked = await request(app).patch(`/api/keys/${id}/revoke`).set('Authorization', `Bearer ${token}`);
  assert.equal(alreadyRevoked.status, 404);
  assert.equal((await request(app).get('/api/test').set('x-api-key', created.body.key)).status, 401);
});

test('database has an index for user-scoped API-key lookups', async () => {
  const indexes = await queryTestDatabase(
    "SELECT indexname FROM pg_indexes WHERE schemaname=current_schema() AND tablename='api_keys'"
  );
  assert.ok(indexes.rows.some((row) => row.indexname === 'api_keys_user_id_idx'));
});

test('key listing includes plan limits and non-consuming current usage values', async () => {
  await queryTestDatabase("UPDATE plans SET daily_quota=4, rate_limit_requests=3 WHERE name='Free'");
  const { app, token } = await registerAndLogin();
  const created = await createApiKey(token);
  await request(app).get('/api/test').set('x-api-key', created.body.key);
  const list = await request(app).get('/api/keys').set('Authorization', `Bearer ${token}`);
  assert.equal(list.status, 200);
  assert.equal(list.body[0].plan_name, 'Free');
  assert.equal(list.body[0].daily_quota, 4);
  assert.equal(list.body[0].daily_used, 1);
  assert.equal(list.body[0].daily_remaining, 3);
  assert.equal(list.body[0].rate_limit_requests, 3);
  assert.equal(list.body[0].rate_limit_used, 1);
  assert.equal(list.body[0].rate_limit_remaining, 2);
  assert.ok(list.body[0].daily_reset_at);
  assert.ok(list.body[0].rate_limit_reset_at);
});

test('plan catalog is authenticated and reports database plan values', async () => {
  const { app, token } = await registerAndLogin();
  assert.equal((await request(app).get('/api/plans')).status, 401);
  const response = await request(app).get('/api/plans').set('Authorization', `Bearer ${token}`);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.plans.map(({ name }) => name), ['Free', 'Premium']);
  assert.deepEqual(response.body.plans[0], {
    id: 1,
    name: 'Free',
    dailyQuota: 1000,
    rateLimit: { requests: 200, windowSeconds: 21600 }
  });
});

test('key management requires JWT authentication and validates creation fields', async () => {
  const { app, token } = await registerAndLogin();
  assert.equal((await request(app).get('/api/keys')).status, 401);
  const invalid = await request(app).post('/api/keys').set('Authorization', `Bearer ${token}`).send({ name: 'x', planId: 1 });
  assert.equal(invalid.status, 400);
  const invalidPlan = await request(app).post('/api/keys').set('Authorization', `Bearer ${token}`).send({ name: 'Valid name', planId: 99999 });
  assert.equal(invalidPlan.status, 400);
  const oversizedPlan = await request(app).post('/api/keys').set('Authorization', `Bearer ${token}`).send({ name: 'Valid name', planId: 2147483648 });
  assert.equal(oversizedPlan.status, 400);
});

test('API key listing is isolated by user and expired keys are rejected', async () => {
  const { app, token } = await registerAndLogin();
  const created = await createApiKey(token);
  const other = await registerAndLogin();
  const list = await request(app).get('/api/keys').set('Authorization', `Bearer ${other.token}`);
  assert.deepEqual(list.body, []);
  await queryTestDatabase('UPDATE api_keys SET expires_at=CURRENT_TIMESTAMP-INTERVAL \'1 second\' WHERE id=$1', [created.body.apiKeyDetails.id]);
  assert.equal((await request(app).get('/api/test').set('x-api-key', created.body.key)).status, 401);
});

test('keys cannot be revoked by another user', async () => {
  const { app, token } = await registerAndLogin();
  const created = await createApiKey(token);
  const other = await registerAndLogin();
  const response = await request(app).patch(`/api/keys/${created.body.apiKeyDetails.id}/revoke`).set('Authorization', `Bearer ${other.token}`);
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { error: 'API key not found' });
});

test('revocation validates the identifier before querying PostgreSQL', async () => {
  const { app, token } = await registerAndLogin();
  const response = await request(app).patch('/api/keys/not-a-number/revoke').set('Authorization', `Bearer ${token}`);
  assert.equal(response.status, 400);
  const oversized = await request(app).patch('/api/keys/2147483648/revoke').set('Authorization', `Bearer ${token}`);
  assert.equal(oversized.status, 400);
});
