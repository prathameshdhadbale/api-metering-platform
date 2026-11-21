import request from 'supertest';
import { getTestApp } from './database.js';

export async function registerAndLogin(overrides = {}) {
  const app = await getTestApp();
  const user = {
    name: 'Test User',
    email: `user-${crypto.randomUUID()}@example.test`,
    password: 'correct-horse-battery-staple',
    ...overrides
  };
  const registration = await request(app).post('/api/auth/register').send(user);
  const login = await request(app).post('/api/auth/login').send({ email: user.email, password: user.password });
  return { app, user, registration, login, token: login.body.token };
}

export async function createApiKey(token, { planId = 1, name = 'Test key' } = {}) {
  const app = await getTestApp();
  return request(app).post('/api/keys').set('Authorization', `Bearer ${token}`).send({ name, planId });
}
