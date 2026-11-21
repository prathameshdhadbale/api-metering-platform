import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import dotenv from 'dotenv';
import pg from 'pg';
import request from 'supertest';

const testFile = process.env.TEST_ENV_FILE || '.env.test';
const devConfig = dotenv.parse(readFileSync('.env', 'utf8'));
const testConfig = dotenv.parse(readFileSync(testFile, 'utf8'));
if (!/_test$/i.test(testConfig.DB_NAME ?? '') || testConfig.DB_NAME === devConfig.DB_NAME) {
  throw new Error('Benchmark requires a dedicated _test database distinct from .env.');
}
dotenv.config({ path: testFile, override: true, quiet: true });

const requestCount = Number(process.env.BENCHMARK_REQUESTS ?? 200);
const concurrency = Number(process.env.BENCHMARK_CONCURRENCY ?? 10);
if (!Number.isInteger(requestCount) || requestCount < 1 || requestCount > 950) {
  throw new Error('BENCHMARK_REQUESTS must be an integer between 1 and 950.');
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 50) {
  throw new Error('BENCHMARK_CONCURRENCY must be an integer between 1 and 50.');
}

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});
let appPool;
let userId;
const percentile = (samples, fraction) => samples[Math.max(0, Math.ceil(samples.length * fraction) - 1)];

async function databaseMetrics() {
  const result = await pool.query(
    `SELECT blks_hit, blks_read, xact_commit, xact_rollback
     FROM pg_stat_database WHERE datname=current_database()`
  );
  return result.rows[0];
}

async function waitForUsage(apiKeyId) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const result = await pool.query('SELECT COUNT(*)::int AS count FROM usage_events WHERE api_key_id=$1', [apiKeyId]);
    if (result.rows[0].count >= requestCount) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Timed out waiting for usage-event writes to complete.');
}

try {
  const identity = await pool.query('SELECT current_database() AS name');
  if (identity.rows[0].name !== process.env.DB_NAME || !/_test$/i.test(identity.rows[0].name)) {
    throw new Error('Connected database identity does not match the dedicated test database.');
  }

  const app = (await import('../src/app.js')).default;
  appPool = (await import('../src/database/pool.js')).default;
  const plan = await pool.query("SELECT id FROM plans WHERE name='Premium'");
  if (plan.rowCount !== 1) throw new Error('Premium plan is missing; run the test migrations and seeds first.');

  const email = `benchmark-${crypto.randomUUID()}@example.test`;
  const password = `${crypto.randomBytes(24).toString('base64url')}Aa1!`;
  const registration = await request(app).post('/api/auth/register').send({ name: 'Benchmark', email, password });
  if (registration.status !== 201) throw new Error(`Benchmark setup registration failed with HTTP ${registration.status}.`);
  userId = registration.body.id;
  const login = await request(app).post('/api/auth/login').send({ email, password });
  if (login.status !== 200) throw new Error(`Benchmark setup login failed with HTTP ${login.status}.`);
  const keyResponse = await request(app).post('/api/keys')
    .set('Authorization', `Bearer ${login.body.token}`)
    .send({ name: 'Benchmark key', planId: plan.rows[0].id });
  if (keyResponse.status !== 201) throw new Error(`Benchmark key setup failed with HTTP ${keyResponse.status}.`);
  const apiKey = keyResponse.body.key;
  const apiKeyId = keyResponse.body.apiKeyDetails.id;

  const before = await databaseMetrics();
  const samples = [];
  const statuses = [];
  let nextRequest = 0;
  const startedAt = performance.now();
  await Promise.all(Array.from({ length: Math.min(concurrency, requestCount) }, async () => {
    while (nextRequest < requestCount) {
      nextRequest += 1;
      const requestStarted = performance.now();
      try {
        const response = await request(app).get('/api/test').set('x-api-key', apiKey);
        samples.push(performance.now() - requestStarted);
        statuses.push(response.status);
      } catch {
        samples.push(performance.now() - requestStarted);
        statuses.push(0);
      }
    }
  }));
  const elapsedSeconds = (performance.now() - startedAt) / 1000;
  await waitForUsage(apiKeyId);
  const after = await databaseMetrics();
  const sorted = samples.sort((a, b) => a - b);
  const successful = statuses.filter((status) => status === 200).length;
  const report = {
    database: identity.rows[0].name,
    requests: requestCount,
    concurrency,
    successful,
    errors: requestCount - successful,
    errorRatePercent: Number(((requestCount - successful) * 100 / requestCount).toFixed(2)),
    requestsPerSecond: Number((requestCount / elapsedSeconds).toFixed(2)),
    latencyMs: {
      average: Number((samples.reduce((sum, value) => sum + value, 0) / samples.length).toFixed(2)),
      p95: Number(percentile(sorted, 0.95).toFixed(2)),
      p99: Number(percentile(sorted, 0.99).toFixed(2))
    },
    databaseStatsDelta: Object.fromEntries(Object.keys(before).map((key) => [key, Number(after[key]) - Number(before[key])]))
  };
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error('Benchmark failed:', error.message);
  process.exitCode = 1;
} finally {
  if (userId !== undefined) {
    try {
      await pool.query('DELETE FROM usage_events WHERE api_key_id IN (SELECT id FROM api_keys WHERE user_id=$1)', [userId]);
      await pool.query('DELETE FROM api_key_daily_usage WHERE api_key_id IN (SELECT id FROM api_keys WHERE user_id=$1)', [userId]);
      await pool.query('DELETE FROM api_key_rate_limit_windows WHERE api_key_id IN (SELECT id FROM api_keys WHERE user_id=$1)', [userId]);
      await pool.query('DELETE FROM api_keys WHERE user_id=$1', [userId]);
      await pool.query('DELETE FROM users WHERE id=$1', [userId]);
    } catch (error) {
      console.error('Benchmark cleanup failed:', error.message);
      process.exitCode = 1;
    }
  }
  if (appPool) await appPool.end();
  await pool.end();
}
