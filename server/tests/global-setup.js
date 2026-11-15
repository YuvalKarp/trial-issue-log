import pg from 'pg';
import { migrate } from '../src/db/migrate.js';
import { testDatabaseUrl } from './helpers/db.js';

// Runs once before all test files: creates the test database if needed and applies migrations.
export default async function setup() {
  const testUrl = new URL(testDatabaseUrl());
  const dbName = testUrl.pathname.slice(1);

  // The name is placed directly into SQL below (identifiers cannot be parameters), so restrict it.
  if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
    throw new Error(`Unexpected test database name: "${dbName}"`);
  }

  // Connect to the default `postgres` database to create the test one.
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rowCount === 0) {
      await admin.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await admin.end();
  }

  const pool = new pg.Pool({ connectionString: testUrl.toString() });
  try {
    await migrate(pool);
  } finally {
    await pool.end();
  }
}
