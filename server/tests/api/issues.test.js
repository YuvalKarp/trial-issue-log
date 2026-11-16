import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createTestPool, resetDatabase } from '../helpers/db.js';

const pool = createTestPool();
const app = createApp({ pool });

const validIssue = {
  title: 'Missing consent form',
  description: 'Consent form not in file for patient 003',
  site: 'Site-101',
  severity: 'major',
};

// The field names reported in a 400 response, e.g. ['title', 'severity'].
const invalidFields = (res) => res.body.error.details.map((detail) => detail.field);

beforeEach(() => resetDatabase(pool));
afterAll(() => pool.end());

describe('POST /api/issues', () => {
  it('creates an issue and returns it with generated fields', async () => {
    const res = await request(app).post('/api/issues').send(validIssue);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...validIssue, id: 1, status: 'open' });
    // Timestamps are ISO 8601 strings in UTC.
    expect(res.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(res.body.updatedAt).toBe(res.body.createdAt);
  });

  it('stores the issue so it appears in the list', async () => {
    const created = await request(app).post('/api/issues').send(validIssue);

    const list = await request(app).get('/api/issues');

    expect(list.body.items).toEqual([created.body]);
  });

  it('accepts an explicit status', async () => {
    const res = await request(app)
      .post('/api/issues')
      .send({ ...validIssue, status: 'in_progress' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('in_progress');
  });

  it('trims surrounding whitespace from text fields', async () => {
    const res = await request(app)
      .post('/api/issues')
      .send({ ...validIssue, title: '  Late visit  ', site: ' Site-202 ' });

    expect(res.body.title).toBe('Late visit');
    expect(res.body.site).toBe('Site-202');
  });

  it('returns 400 naming every missing required field', async () => {
    const res = await request(app).post('/api/issues').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalidFields(res)).toEqual(['title', 'description', 'site', 'severity']);
  });

  it('returns 400 for a title that is only whitespace', async () => {
    const res = await request(app)
      .post('/api/issues')
      .send({ ...validIssue, title: '   ' });

    expect(res.status).toBe(400);
    expect(invalidFields(res)).toEqual(['title']);
  });

  it('returns 400 for a title longer than 200 characters', async () => {
    const res = await request(app)
      .post('/api/issues')
      .send({ ...validIssue, title: 'x'.repeat(201) });

    expect(res.status).toBe(400);
    expect(invalidFields(res)).toEqual(['title']);
  });

  it.each([
    ['severity', 'catastrophic'],
    ['status', 'closed'],
  ])('returns 400 for a %s outside the allowed values', async (field, value) => {
    const res = await request(app)
      .post('/api/issues')
      .send({ ...validIssue, [field]: value });

    expect(res.status).toBe(400);
    expect(invalidFields(res)).toEqual([field]);
  });

  it('returns 400 for a field of the wrong type', async () => {
    const res = await request(app)
      .post('/api/issues')
      .send({ ...validIssue, title: 42 });

    expect(res.status).toBe(400);
    expect(invalidFields(res)).toEqual(['title']);
  });

  it('returns 400 for an unknown field instead of ignoring it', async () => {
    const res = await request(app)
      .post('/api/issues')
      .send({ ...validIssue, sevrity: 'major' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for a body that is not valid JSON', async () => {
    const res = await request(app)
      .post('/api/issues')
      .set('Content-Type', 'application/json')
      .send('{"title": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('does not store anything when validation fails', async () => {
    await request(app).post('/api/issues').send({ ...validIssue, severity: 'catastrophic' });

    const list = await request(app).get('/api/issues');

    expect(list.body.items).toEqual([]);
  });
});

describe('GET /api/issues', () => {
  it('returns an empty list when there are no issues', async () => {
    const res = await request(app).get('/api/issues');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
  });

  it('returns issues newest first by createdAt, not by insertion order', async () => {
    // Inserted directly so createdAt can be set: the oldest issue is inserted last.
    await pool.query(
      `INSERT INTO issues (title, description, site, severity, created_at) VALUES
         ('Middle', 'd', 'Site-1', 'minor', '2025-05-03T12:30:00Z'),
         ('Newest', 'd', 'Site-1', 'minor', '2025-05-10T08:15:00Z'),
         ('Oldest', 'd', 'Site-1', 'minor', '2025-05-01T09:00:00Z')`,
    );

    const res = await request(app).get('/api/issues');

    expect(res.body.items.map((issue) => issue.title)).toEqual(['Newest', 'Middle', 'Oldest']);
  });
});
