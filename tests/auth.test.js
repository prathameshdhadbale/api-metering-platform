import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { installDatabaseHooks } from './helpers/test-hooks.js';
import { registerAndLogin } from './helpers/fixtures.js';
import { getTestApp, queryTestDatabase } from './helpers/database.js';

installDatabaseHooks();

test('registration and login issue a JWT accepted by the protected profile route', async () => {
  const { app, user, registration, login, token } = await registerAndLogin();
  assert.equal(registration.status, 201);
  assert.equal(login.status, 200);
  assert.ok(token);
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  assert.equal(me.status, 200);
  assert.equal(Number(me.body), registration.body.id);
  const stored = await queryTestDatabase('SELECT password_hash FROM users WHERE id=$1', [registration.body.id]);
  assert.notEqual(stored.rows[0].password_hash, user.password);
  assert.equal(await argon2.verify(stored.rows[0].password_hash, user.password), true);
  assert.equal(JSON.stringify(registration.body).includes(user.password), false);
  assert.equal(JSON.stringify(login.body).includes(user.password), false);
});

test('registration rejects malformed input and duplicate email', async () => {
  const app = await getTestApp();
  assert.equal((await request(app).post('/api/auth/register').send({})).status, 400);
  assert.equal((await request(app).post('/api/auth/register').send({ name: 'Valid Name', email: 'bad-email', password: 'valid-password-here' })).status, 400);
  assert.equal((await request(app).post('/api/auth/register').send({ name: 'Valid Name', email: 'valid@example.test', password: 'short' })).status, 400);
  const { user, registration } = await registerAndLogin();
  assert.equal(registration.status, 201);
  assert.equal((await request(app).post('/api/auth/register').send(user)).status, 409);
});

test('login and protected profile reject invalid credentials and tokens', async () => {
  const app = await getTestApp();
  const login = await request(app).post('/api/auth/login').send({ email: 'nobody@example.test', password: 'correct-horse-battery-staple' });
  const { user } = await registerAndLogin();
  const wrongPassword = await request(app).post('/api/auth/login').send({ email: user.email, password: 'incorrect-password-value' });
  const me = await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid');
  const missingToken = await request(app).get('/api/auth/me');
  assert.equal(login.status, 401);
  assert.equal(wrongPassword.status, 401);
  assert.equal(me.status, 401);
  assert.equal(missingToken.status, 401);
});

test('expired JWTs cannot access protected routes', async () => {
  const { app, registration } = await registerAndLogin();
  const expiredToken = jwt.sign({ sub: registration.body.id }, process.env.JWT_SECRET, { expiresIn: -1 });
  assert.equal((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expiredToken}`)).status, 401);
});
