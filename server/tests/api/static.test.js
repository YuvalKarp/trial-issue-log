import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createTestPool } from '../helpers/db.js';

// Tests for serving the built frontend (the Docker image sets STATIC_DIR). A small fake build
// is written to a temporary folder, so these tests do not depend on running the real build.

const staticDir = mkdtempSync(path.join(tmpdir(), 'issue-log-static-'));
writeFileSync(path.join(staticDir, 'index.html'), '<!doctype html><title>Trial Issue Log</title>');
mkdirSync(path.join(staticDir, 'assets'));
writeFileSync(path.join(staticDir, 'assets', 'app.js'), 'console.log("app")');

const pool = createTestPool();
const app = createApp({ pool, staticDir });

afterAll(async () => {
  await pool.end();
  rmSync(staticDir, { recursive: true, force: true });
});

describe('serving the frontend', () => {
  it('serves index.html at /', async () => {
    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('<title>Trial Issue Log</title>');
  });

  it('serves built files', async () => {
    const res = await request(app).get('/assets/app.js');

    expect(res.status).toBe(200);
    expect(res.text).toBe('console.log("app")');
  });

  // Reloading the browser on /dashboard asks the server for /dashboard.
  it('serves index.html for frontend pages, so a reload works', async () => {
    const res = await request(app).get('/dashboard');

    expect(res.status).toBe(200);
    expect(res.text).toContain('<title>Trial Issue Log</title>');
  });

  it('still answers unknown API paths with a JSON 404, not the page', async () => {
    const res = await request(app).get('/api/nothing-here');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('still serves the API', async () => {
    const res = await request(app).get('/api/issues/stats');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
  });
});
