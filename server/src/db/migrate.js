import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// <repo>/db/migrations, relative to this file (<repo>/server/src/db/migrate.js).
const DEFAULT_DIR = fileURLToPath(new URL('../../../db/migrations', import.meta.url));

// Applies every .sql file in `dir` that has not been applied yet, in filename order.
// Each file runs in its own transaction: it is applied completely or not at all.
// Returns the names of the files applied in this run.
export async function migrate(pool, dir = DEFAULT_DIR) {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((row) => row.name));

    const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();
    const ran = [];

    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = await readFile(path.join(dir, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed: ${err.message}`, { cause: err });
      }
      ran.push(file);
    }

    return ran;
  } finally {
    client.release();
  }
}
