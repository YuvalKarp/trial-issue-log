import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createTestPool } from '../helpers/db.js';

const pool = createTestPool();
const app = createApp({ pool });

afterAll(() => pool.end());

describe('GET /health', () => {
  it('returns 200 when the database is reachable', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('returns 503 when the database is not reachable', async () => {
    const brokenPool = { query: () => Promise.reject(new Error('connection refused')) };
    const res = await request(createApp({ pool: brokenPool })).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('error');
  });
});

describe('unknown routes', () => {
  it('returns a JSON 404 in the standard error format', async () => {
    const res = await request(app).get('/no-such-route');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
