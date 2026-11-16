import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createTestPool, resetDatabase } from '../helpers/db.js';

// Tests for the routes that act on a single issue: GET, PATCH and DELETE /api/issues/:id.

const pool = createTestPool();
const app = createApp({ pool });

const validIssue = {
  title: 'Missing consent form',
  description: 'Consent form not in file for patient 003',
  site: 'Site-101',
  severity: 'major',
};

const createIssue = async (overrides = {}) => {
  const res = await request(app)
    .post('/api/issues')
    .send({ ...validIssue, ...overrides });
  return res.body;
};

const invalidFields = (res) => res.body.error.details.map((detail) => detail.field);

beforeEach(() => resetDatabase(pool));
afterAll(() => pool.end());

describe('GET /api/issues/:id', () => {
  it('returns the issue', async () => {
    const issue = await createIssue();

    const res = await request(app).get(`/api/issues/${issue.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(issue);
  });

  it('returns 404 when there is no issue with this id', async () => {
    const res = await request(app).get('/api/issues/999');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  // An id the database could not even look up must be a 400, not a 500 from a failed query.
  it.each(['abc', '0', '-1', '1.5', '99999999999'])('returns 400 for the id "%s"', async (id) => {
    const res = await request(app).get(`/api/issues/${id}`);

    expect(res.status).toBe(400);
    expect(invalidFields(res)).toEqual(['id']);
  });
});

describe('PATCH /api/issues/:id', () => {
  it('changes only the fields that were sent', async () => {
    const issue = await createIssue();

    const res = await request(app).patch(`/api/issues/${issue.id}`).send({ title: 'Late visit' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ...validIssue, title: 'Late visit', status: 'open' });
  });

  it('resolves an issue, and the change is stored', async () => {
    const issue = await createIssue();

    await request(app).patch(`/api/issues/${issue.id}`).send({ status: 'resolved' });

    const res = await request(app).get(`/api/issues/${issue.id}`);
    expect(res.body.status).toBe('resolved');
  });

  it('advances updatedAt and leaves createdAt alone', async () => {
    // Inserted directly with old timestamps, so the comparison does not depend on timing.
    await pool.query(
      `INSERT INTO issues (title, description, site, severity, created_at, updated_at)
       VALUES ('Old issue', 'd', 'Site-1', 'minor', '2025-05-01T09:00:00Z', '2025-05-01T09:00:00Z')`,
    );

    const res = await request(app).patch('/api/issues/1').send({ status: 'in_progress' });

    expect(res.body.createdAt).toBe('2025-05-01T09:00:00.000Z');
    expect(new Date(res.body.updatedAt).getFullYear()).toBeGreaterThan(2025);
  });

  it('does not touch other issues', async () => {
    const first = await createIssue({ title: 'First' });
    const second = await createIssue({ title: 'Second' });

    await request(app).patch(`/api/issues/${first.id}`).send({ status: 'resolved' });

    const res = await request(app).get(`/api/issues/${second.id}`);
    expect(res.body).toEqual(second);
  });

  it('returns 400 for an invalid value and leaves the issue unchanged', async () => {
    const issue = await createIssue();

    const res = await request(app).patch(`/api/issues/${issue.id}`).send({ status: 'closed' });

    expect(res.status).toBe(400);
    expect(invalidFields(res)).toEqual(['status']);
    const after = await request(app).get(`/api/issues/${issue.id}`);
    expect(after.body).toEqual(issue);
  });

  it('returns 400 when a required field is set to blank', async () => {
    const issue = await createIssue();

    const res = await request(app).patch(`/api/issues/${issue.id}`).send({ title: '  ' });

    expect(res.status).toBe(400);
    expect(invalidFields(res)).toEqual(['title']);
  });

  it('returns 400 for an empty body', async () => {
    const issue = await createIssue();

    const res = await request(app).patch(`/api/issues/${issue.id}`).send({});

    expect(res.status).toBe(400);
  });

  it.each(['id', 'createdAt', 'updatedAt'])('returns 400 when trying to change %s', async (field) => {
    const issue = await createIssue();

    const res = await request(app)
      .patch(`/api/issues/${issue.id}`)
      .send({ [field]: '2020-01-01T00:00:00Z' });

    expect(res.status).toBe(400);
  });

  it('returns 404 when there is no issue with this id', async () => {
    const res = await request(app).patch('/api/issues/999').send({ status: 'resolved' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/issues/:id', () => {
  it('deletes the issue', async () => {
    const issue = await createIssue();

    const res = await request(app).delete(`/api/issues/${issue.id}`);

    expect(res.status).toBe(204);
    const after = await request(app).get(`/api/issues/${issue.id}`);
    expect(after.status).toBe(404);
  });

  it('deletes only that issue', async () => {
    const first = await createIssue({ title: 'First' });
    const second = await createIssue({ title: 'Second' });

    await request(app).delete(`/api/issues/${first.id}`);

    const list = await request(app).get('/api/issues');
    expect(list.body.items).toEqual([second]);
  });

  it('returns 404 when there is no issue with this id', async () => {
    const res = await request(app).delete('/api/issues/999');

    expect(res.status).toBe(404);
  });

  it('returns 400 for an id that is not a positive integer', async () => {
    const res = await request(app).delete('/api/issues/abc');

    expect(res.status).toBe(400);
  });
});
