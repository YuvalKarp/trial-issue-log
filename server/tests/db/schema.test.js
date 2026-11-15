import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestPool, resetDatabase } from '../helpers/db.js';

// These tests talk to the database directly. They check the guarantees the schema gives
// regardless of what the API does: defaults, constraints and the updated_at trigger.

const pool = createTestPool();

const insertIssue = (overrides = {}) => {
  const issue = {
    title: 'Missing consent form',
    description: 'Consent form not in file for patient 003',
    site: 'Site-101',
    severity: 'major',
    ...overrides,
  };
  return pool.query(
    `INSERT INTO issues (title, description, site, severity)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [issue.title, issue.description, issue.site, issue.severity],
  );
};

beforeEach(() => resetDatabase(pool));
afterAll(() => pool.end());

describe('issues table', () => {
  it('fills in id, status and timestamps on insert', async () => {
    const { rows } = await insertIssue();
    const issue = rows[0];

    expect(issue.id).toBe(1);
    expect(issue.status).toBe('open');
    expect(issue.created_at).toBeInstanceOf(Date);
    expect(issue.updated_at).toEqual(issue.created_at);
  });

  it('rejects a severity outside the allowed values', async () => {
    await expect(insertIssue({ severity: 'catastrophic' })).rejects.toThrow(/check constraint/);
  });

  it('rejects a status outside the allowed values', async () => {
    await insertIssue();

    await expect(pool.query(`UPDATE issues SET status = 'closed' WHERE id = 1`)).rejects.toThrow(
      /check constraint/,
    );
  });

  it('rejects a blank title', async () => {
    await expect(insertIssue({ title: '   ' })).rejects.toThrow(/check constraint/);
  });

  it('advances updated_at on update and leaves created_at alone', async () => {
    const { rows: before } = await insertIssue();

    const { rows: after } = await pool.query(
      `UPDATE issues SET status = 'resolved' WHERE id = $1 RETURNING *`,
      [before[0].id],
    );

    expect(after[0].created_at).toEqual(before[0].created_at);
    expect(after[0].updated_at.getTime()).toBeGreaterThan(before[0].updated_at.getTime());
  });
});
