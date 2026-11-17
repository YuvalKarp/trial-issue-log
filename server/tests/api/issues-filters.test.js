import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createTestPool, resetDatabase } from '../helpers/db.js';

// Tests for the filters of GET /api/issues: text search on title, status and severity.

const pool = createTestPool();
const app = createApp({ pool });

// Inserts issues directly, each one hour newer than the previous, so the expected order is known.
const seed = async (issues) => {
  for (const [index, issue] of issues.entries()) {
    await pool.query(
      `INSERT INTO issues (title, description, site, severity, status, created_at)
       VALUES ($1, 'description', 'Site-101', $2, $3, $4)`,
      [
        issue.title,
        issue.severity ?? 'minor',
        issue.status ?? 'open',
        new Date(Date.UTC(2025, 4, 1, index)).toISOString(),
      ],
    );
  }
};

// The titles returned for a query string, in response order.
const titlesFor = async (query) => {
  const res = await request(app).get('/api/issues').query(query);
  expect(res.status).toBe(200);
  return res.body.items.map((issue) => issue.title);
};

beforeEach(() => resetDatabase(pool));
afterAll(() => pool.end());

describe('GET /api/issues filters', () => {
  beforeEach(() =>
    seed([
      { title: 'Missing consent form', severity: 'major', status: 'open' },
      { title: 'Late visit', severity: 'minor', status: 'in_progress' },
      { title: 'Drug temp excursion', severity: 'critical', status: 'open' },
      { title: 'Unblinded email', severity: 'major', status: 'resolved' },
    ]),
  );

  it('filters by status', async () => {
    expect(await titlesFor({ status: 'open' })).toEqual(['Drug temp excursion', 'Missing consent form']);
  });

  it('filters by severity', async () => {
    expect(await titlesFor({ severity: 'major' })).toEqual(['Unblinded email', 'Missing consent form']);
  });

  it('combines status and severity with AND', async () => {
    expect(await titlesFor({ status: 'open', severity: 'major' })).toEqual(['Missing consent form']);
  });

  it('searches the title, ignoring case and matching anywhere in it', async () => {
    expect(await titlesFor({ search: 'CONSENT' })).toEqual(['Missing consent form']);
  });

  it('searches the title only, not the description', async () => {
    // Every seeded issue has the description "description".
    expect(await titlesFor({ search: 'description' })).toEqual([]);
  });

  it('combines search with the other filters', async () => {
    expect(await titlesFor({ search: 'i', status: 'open' })).toEqual([
      'Drug temp excursion',
      'Missing consent form',
    ]);
    expect(await titlesFor({ search: 'i', status: 'open', severity: 'critical' })).toEqual([
      'Drug temp excursion',
    ]);
  });

  it('returns an empty list when nothing matches', async () => {
    expect(await titlesFor({ search: 'no such issue' })).toEqual([]);
  });

  it('treats an empty or whitespace-only search as no search', async () => {
    expect(await titlesFor({ search: '' })).toHaveLength(4);
    expect(await titlesFor({ search: '   ' })).toHaveLength(4);
  });

  it('keeps filtered results newest first', async () => {
    expect(await titlesFor({ search: 'e' })).toEqual([
      'Unblinded email',
      'Drug temp excursion',
      'Late visit',
      'Missing consent form',
    ]);
  });

  it.each([
    ['status', 'closed'],
    ['severity', 'catastrophic'],
    ['status', ''],
  ])('returns 400 for %s=%j', async (field, value) => {
    const res = await request(app).get('/api/issues').query({ [field]: value });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe(field);
  });

  it('returns 400 for an unknown filter instead of ignoring it', async () => {
    const res = await request(app).get('/api/issues').query({ sevrity: 'major' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when a filter is given more than once', async () => {
    const res = await request(app).get('/api/issues?status=open&status=resolved');

    expect(res.status).toBe(400);
  });
});

describe('GET /api/issues search with special characters', () => {
  // Without escaping, % and _ are LIKE wildcards and each of these searches would match every row.
  beforeEach(() =>
    seed([
      { title: 'Dose at 100% of plan' },
      { title: 'visit_week mismatch' },
      { title: 'Path C:\\data missing' },
      { title: 'Ordinary issue' },
    ]),
  );

  it('matches % literally', async () => {
    expect(await titlesFor({ search: '%' })).toEqual(['Dose at 100% of plan']);
  });

  it('matches _ literally', async () => {
    expect(await titlesFor({ search: '_' })).toEqual(['visit_week mismatch']);
  });

  it('matches a backslash literally', async () => {
    expect(await titlesFor({ search: '\\' })).toEqual(['Path C:\\data missing']);
  });

  it('treats SQL in the search text as plain text', async () => {
    expect(await titlesFor({ search: "'; DROP TABLE issues; --" })).toEqual([]);

    // The table is still there, with all its rows.
    expect(await titlesFor({})).toHaveLength(4);
  });
});
