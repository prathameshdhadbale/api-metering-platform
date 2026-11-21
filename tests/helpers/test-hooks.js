import { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { closeTestEnvironment, queryTestDatabase, resetTestDatabase } from './database.js';

export function installDatabaseHooks() {
  beforeEach(resetTestDatabase);
  after(async () => {
    try {
      await resetTestDatabase();
      const result = await queryTestDatabase(`SELECT
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM api_keys) AS api_keys,
        (SELECT COUNT(*)::int FROM usage_events) AS usage_events,
        (SELECT COUNT(*)::int FROM api_key_daily_usage) AS daily_usage,
        (SELECT COUNT(*)::int FROM api_key_rate_limit_windows) AS rate_windows,
        (SELECT COUNT(*)::int FROM plans) AS plans`);
      assert.deepEqual(result.rows[0], {
        users: 0,
        api_keys: 0,
        usage_events: 0,
        daily_usage: 0,
        rate_windows: 0,
        plans: 2
      });
    } finally {
      await closeTestEnvironment();
    }
  });
}
