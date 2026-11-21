import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';

let server;
let shutdown;
before(async () => {
  const dev = dotenv.parse(readFileSync('.env', 'utf8'));
  const testConfig = dotenv.parse(readFileSync('.env.test', 'utf8'));
  assert.match(testConfig.DB_NAME, /_test$/i);
  assert.notEqual(testConfig.DB_NAME, dev.DB_NAME);
  dotenv.config({ path: '.env.test', override: true, quiet: true });
  process.env.PORT = '0';
  ({ server, shutdown } = await import('../src/server.js'));
  if (!server.listening) await once(server, 'listening');
});
after(async () => { if (shutdown) await shutdown('test cleanup'); });

test('server handles requests and shuts down gracefully and idempotently', async () => {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  await shutdown('test');
  assert.equal(server.listening, false);
  await shutdown('repeated test call');
});
