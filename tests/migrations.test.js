import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installDatabaseHooks } from './helpers/test-hooks.js';
import { validateMigrationsInFreshSchema } from './helpers/database.js';

installDatabaseHooks();

test('all migrations and plan seeds initialize a fresh isolated schema', async () => {
  const result = await validateMigrationsInFreshSchema();
  assert.equal(result.migrations, 8);
  assert.equal(result.tableCount, 7);
  assert.deepEqual(result.plans, [
    { name: 'Free', daily_quota: 1000, rate_limit_requests: 200, rate_limit_window_seconds: 21600 },
    { name: 'Premium', daily_quota: 50000, rate_limit_requests: 1000, rate_limit_window_seconds: 21600 }
  ]);
});
