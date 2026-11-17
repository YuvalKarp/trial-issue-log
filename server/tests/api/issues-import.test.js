import { readFileSync } from 'node:fs';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createTestPool, resetDatabase } from '../helpers/db.js';

// Tests for POST /api/issues/import (CSV sent as the raw body, Content-Type: text/csv).

const pool = createTestPool();
const app = createApp({ pool });

// The sample file shipped in the repo root.
const sampleCsv = readFileSync(new URL('../../../issues.csv', import.meta.url), 'utf8');

const HEADER = 'title,description,site,severity,status,createdAt';
const csv = (...lines) => [HEADER, ...lines].join('\n');

const postCsv = (text) =>
  request(app).post('/api/issues/import').set('Content-Type', 'text/csv').send(text);

const countIssues = async () => (await pool.query('SELECT count(*)::int AS n FROM issues')).rows[0].n;

beforeEach(() => resetDatabase(pool));
afterAll(() => pool.end());

describe('POST /api/issues/import', () => {
  describe('importing', () => {
    it('imports the sample issues.csv with its status and createdAt', async () => {
      const res = await postCsv(sampleCsv);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ imported: 4, skipped: 0 });

      const list = await request(app).get('/api/issues');
      // Newest first, ordered by the createdAt values from the file.
      expect(list.body.items.map((issue) => issue.title)).toEqual([
        'Unblinded email',
        'Drug temp excursion',
        'Late visit',
        'Missing consent form',
      ]);
      expect(list.body.items[2]).toMatchObject({
        title: 'Late visit',
        description: 'Visit week 4 occurred on week 6',
        site: 'Site-202',
        severity: 'minor',
        status: 'in_progress',
        createdAt: '2025-05-03T12:30:00.000Z',
      });
    });

    it('reads quoted cells that contain commas, quotes and line breaks', async () => {
      const res = await postCsv(
        csv('"Label, wrong","Said ""v2""\non two lines",Site-101,minor,open,2025-05-01T09:00:00Z'),
      );

      expect(res.status).toBe(200);
      const { rows } = await pool.query('SELECT title, description FROM issues');
      expect(rows).toEqual([{ title: 'Label, wrong', description: 'Said "v2"\non two lines' }]);
    });

    it('accepts columns in any order and a byte-order mark from Excel', async () => {
      const res = await postCsv(
        '﻿site,title,createdAt,status,severity,description\n' +
          'Site-101,Late visit,2025-05-01T09:00:00Z,open,minor,Visit was late',
      );

      expect(res.status).toBe(200);
      expect(res.body.imported).toBe(1);
    });
  });

  describe('duplicates', () => {
    it('skips every row when the same file is imported twice', async () => {
      await postCsv(sampleCsv);
      const res = await postCsv(sampleCsv);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ imported: 0, skipped: 4 });
      expect(await countIssues()).toBe(4);
    });

    it('imports the new rows and skips the ones already in the database', async () => {
      await postCsv(csv('Late visit,Visit was late,Site-101,minor,open,2025-05-01T09:00:00Z'));
      const res = await postCsv(
        csv(
          'Late visit,Visit was late,Site-101,minor,open,2025-05-01T09:00:00Z',
          'Missing form,Consent form missing,Site-101,major,open,2025-05-02T09:00:00Z',
        ),
      );

      expect(res.body).toEqual({ imported: 1, skipped: 1 });
      expect(await countIssues()).toBe(2);
    });

    it('skips a repeated row inside the same file, comparing times as moments', async () => {
      // 09:00 UTC and 12:00 at +03:00 are the same moment.
      const res = await postCsv(
        csv(
          'Late visit,Visit was late,Site-101,minor,open,2025-05-01T09:00:00Z',
          'Late visit,Visit was late,Site-101,minor,open,2025-05-01T12:00:00+03:00',
        ),
      );

      expect(res.body).toEqual({ imported: 1, skipped: 1 });
    });

    it('does not treat rows as duplicates when the site or the time differs', async () => {
      const res = await postCsv(
        csv(
          'Late visit,Visit was late,Site-101,minor,open,2025-05-01T09:00:00Z',
          'Late visit,Visit was late,Site-202,minor,open,2025-05-01T09:00:00Z',
          'Late visit,Visit was late,Site-101,minor,open,2025-05-01T09:00:01Z',
        ),
      );

      expect(res.body).toEqual({ imported: 3, skipped: 0 });
    });
  });

  describe('invalid rows', () => {
    it('saves nothing when one row is invalid, and reports each problem with its line', async () => {
      const res = await postCsv(
        csv(
          'Late visit,Visit was late,Site-101,minor,open,2025-05-01T09:00:00Z',
          'Bad severity,Description,Site-101,urgent,open,2025-05-01T09:00:00Z',
          ',No title,Site-101,minor,open,2025-05-01T09:00:00Z',
        ),
      );

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual([
        { line: 3, field: 'severity', message: expect.stringContaining('minor, major, critical') },
        { line: 4, field: 'title', message: 'Title is required' },
      ]);
      // All or nothing: the valid first row was not saved either.
      expect(await countIssues()).toBe(0);
    });

    it.each([
      ['no time zone', '2025-05-01T09:00:00', 'time zone'],
      ['not a date', '01/05/2025', 'time zone'],
      ['in the future', '2999-01-01T00:00:00Z', 'future'],
    ])('rejects a createdAt with %s', async (_, createdAt, expected) => {
      const res = await postCsv(csv(`Late visit,Visit was late,Site-101,minor,open,${createdAt}`));

      expect(res.status).toBe(400);
      expect(res.body.error.details[0]).toMatchObject({ line: 2, field: 'createdAt' });
      expect(res.body.error.details[0].message).toContain(expected);
    });

    it('rejects a row with the wrong number of cells, naming the line', async () => {
      const res = await postCsv(csv('Late visit,Visit was late,Site-101,minor,open'));

      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual([
        { line: 2, field: 'file', message: 'Expected 6 cells, found 5' },
      ]);
    });
  });

  describe('invalid files', () => {
    it.each([
      ['a missing column', 'title,description,site,severity,createdAt', 'missing: status'],
      ['an unknown column', `${HEADER},priority`, 'unknown: priority'],
      ['a repeated column', `${HEADER},site`, 'repeated: site'],
    ])('rejects a header row with %s', async (_, header, expected) => {
      const res = await postCsv(`${header}\nsome,row`);

      expect(res.status).toBe(400);
      expect(res.body.error.details[0].field).toBe('headers');
      expect(res.body.error.details[0].message).toContain(expected);
    });

    it('rejects a file with a header row only', async () => {
      const res = await postCsv(`${HEADER}\n`);

      expect(res.status).toBe(400);
      expect(res.body.error.details[0].message).toContain('no issues');
    });

    it('rejects an empty body', async () => {
      const res = await postCsv('');

      expect(res.status).toBe(400);
      expect(res.body.error.details[0].message).toBe('The file is empty');
    });

    it('rejects a body that is not text/csv with 415', async () => {
      const res = await request(app).post('/api/issues/import').send({ title: 'JSON instead' });

      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('rejects a file over 1MB with 413', async () => {
      const row = 'Late visit,Visit was late,Site-101,minor,open,2025-05-01T09:00:00Z';
      const big = csv(...Array(20000).fill(row)); // about 1.4MB

      const res = await postCsv(big);

      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
      expect(await countIssues()).toBe(0);
    });
  });
});
