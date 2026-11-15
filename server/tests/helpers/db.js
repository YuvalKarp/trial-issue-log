import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ENV_FILE = fileURLToPath(new URL('../../../.env', import.meta.url));

// Tests never touch the development database. They use a separate database on the same
// Postgres server, named after the development one with a `_test` suffix.
export function testDatabaseUrl() {
  if (!process.env.DATABASE_URL && existsSync(ENV_FILE)) {
    process.loadEnvFile(ENV_FILE);
  }
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run tests (copy .env.example to .env)');
  }

  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `${url.pathname}_test`;
  return url.toString();
}

export function createTestPool() {
  return new pg.Pool({ connectionString: testDatabaseUrl() });
}

// Each test starts from an empty table with ids starting at 1.
export async function resetDatabase(pool) {
  await pool.query('TRUNCATE issues RESTART IDENTITY');
}
