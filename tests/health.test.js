import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

import { closeTestEnvironment, getTestApp } from './helpers/database.js';

let app;
before(async () => { app = await getTestApp(); });
after(closeTestEnvironment);

test('GET /health returns 200 and status ok', async () => {
  const response = await request(app).get('/health');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    status: 'ok'
  });
  assert.equal(response.headers['x-powered-by'], undefined);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['x-frame-options'], 'DENY');
});

test('readiness confirms PostgreSQL is reachable', async () => {
  const response = await request(app).get('/health/ready');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ready' });
});

test('request parser returns consistent errors and enforces its size limit', async () => {
  const malformed = await request(app).post('/api/auth/login')
    .set('Content-Type', 'application/json').send('{"email":');
  const oversized = await request(app).post('/api/auth/login')
    .send({ payload: 'x'.repeat(17 * 1024) });
  assert.equal(malformed.status, 400);
  assert.deepEqual(malformed.body, { error: 'Invalid JSON body' });
  assert.equal(oversized.status, 413);
  assert.deepEqual(oversized.body, { error: 'Request body too large' });
});

test('unknown routes use the common error response shape', async () => {
  const response = await request(app).get('/missing-route');
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { error: 'Not found' });
});
