import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createTestPool, resetDatabase } from '../helpers/db.js';

// Tests for GET /api/issues/stats, the counts behind the dashboard.

const pool = createTestPool();
const app = createApp({ pool });

const insert = (severity, status) =>
  pool.query(
    `INSERT INTO issues (title, description, site, severity, status)
     VALUES ('title', 'description', 'Site-101', $1, $2)`,
    [severity, status],
  );

beforeEach(() => resetDatabase(pool));
afterAll(() => pool.end());

describe('GET /api/issues/stats', () => {
  it('returns every status and severity with 0 when there are no issues', async () => {
    const res = await request(app).get('/api/issues/stats');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 0,
      byStatus: { open: 0, in_progress: 0, resolved: 0 },
      bySeverity: { minor: 0, major: 0, critical: 0 },
    });
  });

  it('counts issues by status and by severity', async () => {
    await insert('critical', 'open');
    await insert('critical', 'open');
    await insert('major', 'open');
    await insert('major', 'in_progress');
    await insert('minor', 'resolved');

    const res = await request(app).get('/api/issues/stats');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 5,
      byStatus: { open: 3, in_progress: 1, resolved: 1 },
      bySeverity: { minor: 1, major: 2, critical: 2 },
    });
  });

  it('returns counts as numbers, not strings', async () => {
    await insert('minor', 'open');

    const res = await request(app).get('/api/issues/stats');

    expect(typeof res.body.total).toBe('number');
    expect(typeof res.body.byStatus.open).toBe('number');
  });

  it('reflects changes made through the API', async () => {
    const created = await request(app).post('/api/issues').send({
      title: 'Late visit',
      description: 'Visit 3 happened outside the window',
      site: 'Site-101',
      severity: 'minor',
    });
    await request(app).patch(`/api/issues/${created.body.id}`).send({ status: 'resolved' });

    const res = await request(app).get('/api/issues/stats');

    expect(res.body.byStatus).toEqual({ open: 0, in_progress: 0, resolved: 1 });
  });

  // /stats is registered before /:id. If the order were wrong, "stats" would be read as an
  // issue id and the response would be a 400 "Issue id must be a positive integer".
  it('is not captured by the /:id route', async () => {
    const res = await request(app).get('/api/issues/stats');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('byStatus');
  });

  it('rejects query parameters with 400', async () => {
    const res = await request(app).get('/api/issues/stats').query({ status: 'open' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
