import { readFile, readdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migrationsDirectory = path.join(projectRoot, 'src/database/migrations');
const seedsDirectory = path.join(projectRoot, 'src/database/seeds');

let testPool;
let app;
let appPool;

function loadTestConfiguration() {
  const envPath = process.env.TEST_ENV_FILE || path.join(projectRoot, '.env.test');
  const devEnvPath = path.join(projectRoot, '.env');
  const devConfig = dotenv.parse(requireEnvFile(devEnvPath));
  const devDatabaseName = devConfig.DB_NAME;
  const loaded = dotenv.config({ path: envPath, override: true });
  if (loaded.error) {
    throw new Error(`Test environment file is required: ${envPath}`);
  }

  const name = process.env.DB_NAME;
  if (!name || !/_test$/i.test(name)) {
    throw new Error('DB_NAME in .env.test must end in _test. Refusing database setup.');
  }

  if (!devDatabaseName || name === devDatabaseName) {
    throw new Error('Test database must be distinct from DB_NAME configured in .env.');
  }

  for (const key of ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET']) {
    if (!process.env[key]) throw new Error(`${key} must be set in .env.test`);
  }
}

function requireEnvFile(envPath) {
  try {
    return readFileSync(envPath, 'utf8');
  } catch {
    throw new Error(`Development environment file is required to verify database isolation: ${envPath}`);
  }
}

export async function initializeTestEnvironment() {
  if (testPool) return app;

  loadTestConfiguration();
  const { Pool } = pg;
  testPool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  const identity = await testPool.query('SELECT current_database() AS name');
  if (identity.rows[0].name !== process.env.DB_NAME || !/_test$/i.test(identity.rows[0].name)) {
    throw new Error('Connected database identity did not match the configured test database.');
  }

  await applyMigrations();
  await seedPlans();
  app = (await import('../../src/app.js')).default;
  appPool = (await import('../../src/database/pool.js')).default;
  return app;
}

async function applyMigrations() {
  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const filename of files) {
    const client = await testPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )`);
      const applied = await client.query(
        'SELECT 1 FROM schema_migrations WHERE filename = $1',
        [filename]
      );
      if (applied.rowCount === 0) {
        await client.query(await readFile(path.join(migrationsDirectory, filename), 'utf8'));
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

async function seedPlans() {
  const files = (await readdir(seedsDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort();
  for (const filename of files) {
    const sql = await readFile(path.join(seedsDirectory, filename), 'utf8');
    await testPool.query(sql);
  }
}

export async function getTestApp() {
  return app || initializeTestEnvironment();
}

export async function resetTestDatabase() {
  if (!testPool) await initializeTestEnvironment();
  await testPool.query(
    `TRUNCATE TABLE usage_events, api_key_rate_limit_windows,
     api_key_daily_usage, api_keys, users RESTART IDENTITY CASCADE`
  );
  await seedPlans();
}

export async function queryTestDatabase(sql, values = []) {
  if (!testPool) await initializeTestEnvironment();
  return testPool.query(sql, values);
}

export async function validateMigrationsInFreshSchema() {
  if (!testPool) await initializeTestEnvironment();
  const schema = `phase5_migration_${crypto.randomUUID().replaceAll('-', '')}`;
  const client = await testPool.connect();
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    const files = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const filename of files) {
      await client.query('BEGIN');
      try {
        await client.query(await readFile(path.join(migrationsDirectory, filename), 'utf8'));
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    const seedFiles = (await readdir(seedsDirectory))
      .filter((file) => file.endsWith('.sql'))
      .sort();
    for (const filename of seedFiles) {
      await client.query(await readFile(path.join(seedsDirectory, filename), 'utf8'));
    }

    const migrationCount = await client.query('SELECT COUNT(*)::int AS count FROM schema_migrations');
    const plans = await client.query(
      'SELECT name, daily_quota, rate_limit_requests, rate_limit_window_seconds FROM plans ORDER BY id'
    );
    const tables = await client.query(`SELECT COUNT(*)::int AS count FROM information_schema.tables
      WHERE table_schema = $1 AND table_type = 'BASE TABLE'`, [schema]);
    return {
      migrations: migrationCount.rows[0].count,
      tableCount: tables.rows[0].count,
      plans: plans.rows
    };
  } finally {
    try {
      await client.query('RESET search_path');
      await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    } finally {
      client.release();
    }
  }
}

export async function waitForUsageEvents(expectedCount, { timeoutMs = 3000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await queryTestDatabase('SELECT COUNT(*)::int AS count FROM usage_events');
    if (result.rows[0].count >= expectedCount) return result.rows[0].count;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for ${expectedCount} usage events`);
}

export async function holdApiKeyRowLock(apiKeyId) {
  if (!testPool) await initializeTestEnvironment();
  const client = await testPool.connect();
  await client.query('BEGIN');
  await client.query('SELECT id FROM api_keys WHERE id=$1 FOR UPDATE', [apiKeyId]);
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    try {
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  };
}

export async function waitForBlockedApiKeyRequest({ timeoutMs = 3000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await queryTestDatabase(
      `SELECT COUNT(*)::int AS count
       FROM pg_stat_activity
       WHERE datname=current_database()
         AND wait_event_type='Lock'
         AND query ILIKE '%FOR UPDATE%'`
    );
    if (result.rows[0].count > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for API-key request to block on its row lock');
}

export async function closeTestEnvironment() {
  if (appPool) await appPool.end();
  if (testPool) await testPool.end();
  appPool = undefined;
  testPool = undefined;
  app = undefined;
}
