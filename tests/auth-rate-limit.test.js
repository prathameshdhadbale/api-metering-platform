import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createInMemoryRateLimiter } from '../src/modules/auth/auth-rate-limit.middleware.js';
import { closeTestEnvironment, getTestApp } from './helpers/database.js';

after(closeTestEnvironment);

function invoke(middleware, ip) {
  const result = { headers: {}, statusCode: 200, body: undefined, nextCalled: false };
  const res = {
    set(name, value) { result.headers[name] = value; return this; },
    status(value) { result.statusCode = value; return this; },
    json(value) { result.body = value; return this; }
  };
  middleware({ ip }, res, () => { result.nextCalled = true; });
  return result;
}

test('authentication limiter caps each IP and resets at the configured deadline', () => {
  let now = 1000;
  const limiter = createInMemoryRateLimiter({ max: 2, windowMs: 60000, clock: () => now });
  assert.equal(invoke(limiter, '192.0.2.1').nextCalled, true);
  assert.equal(invoke(limiter, '192.0.2.1').headers['RateLimit-Remaining'], '0');
  const blocked = invoke(limiter, '192.0.2.1');
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.body.error, 'Too many authentication attempts');
  assert.equal(blocked.headers['Retry-After'], '60');
  assert.equal(invoke(limiter, '192.0.2.2').nextCalled, true);
  now = 61000;
  assert.equal(invoke(limiter, '192.0.2.1').nextCalled, true);
});

test('login endpoint throttles repeated requests from one client IP', async () => {
  const app = await getTestApp();
  const first = await request(app).post('/api/auth/login').send({
    email: 'missing@example.test',
    password: 'valid-password-value'
  });
  assert.equal(first.status, 401);
  const limit = Number(first.headers['ratelimit-limit']);
  for (let attempt = 1; attempt < limit; attempt += 1) {
    assert.equal((await request(app).post('/api/auth/login').send({
      email: 'missing@example.test',
      password: 'valid-password-value'
    })).status, 401);
  }
  const blocked = await request(app).post('/api/auth/login').send({
    email: 'missing@example.test',
    password: 'valid-password-value'
  });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error, 'Too many authentication attempts');
  assert.ok(Number(blocked.headers['retry-after']) > 0);
});

test('registration endpoint throttles repeated requests from one client IP', async () => {
  const app = await getTestApp();
  const first = await request(app).post('/api/auth/register').send({});
  assert.equal(first.status, 400);
  const limit = Number(first.headers['ratelimit-limit']);
  for (let attempt = 1; attempt < limit; attempt += 1) {
    assert.equal((await request(app).post('/api/auth/register').send({})).status, 400);
  }
  const blocked = await request(app).post('/api/auth/register').send({});
  assert.equal(blocked.status, 429);
  assert.equal(blocked.body.error, 'Too many authentication attempts');
});
