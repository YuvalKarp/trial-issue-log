import express, { Router } from 'express';
import { NotFoundError, parse } from '../errors.js';
import { createIssuesRepository } from './repository.js';
import { createIssuesService } from './service.js';
import {
  createIssueSchema,
  issueParamsSchema,
  listIssuesQuerySchema,
  statsQuerySchema,
  updateIssueSchema,
} from './schema.js';

export const IMPORT_MAX_BYTES = 1024 * 1024;

// Routes under /api/issues. Each handler validates input, calls the repository and shapes the response.
// Express 5 forwards errors thrown in async handlers to the error handler in app.js.
export function createIssuesRouter({ pool }) {
  const router = Router();
  const issues = createIssuesRepository(pool);
  const service = createIssuesService(issues);

  router.get('/', async (req, res) => {
    const filters = parse(listIssuesQuerySchema, req.query);
    const items = await issues.list(filters);
    // Wrapped in an object so fields like `total` can be added later without breaking clients.
    res.json({ items });
  });

  router.post('/', async (req, res) => {
    const data = parse(createIssueSchema, req.body);
    const issue = await issues.create(data);
    res.status(201).json(issue);
  });

  // Routes with a fixed path (like /stats) must be registered above the /:id routes.
  // Express matches in order, and /:id would otherwise capture them.

  // Import a CSV file sent as the raw request body (Content-Type: text/csv), so no multipart
  // library is needed. Bodies over 1MB are refused with 413 before they are read in full.
  router.post(
    '/import',
    express.text({ type: 'text/csv', limit: IMPORT_MAX_BYTES }),
    async (req, res) => {
      // express.text only reads text/csv bodies. req.is() is false for a body of another type,
      // and null when there is no body at all, which is reported below as an empty file.
      if (req.is('text/csv') === false) {
        return res.status(415).json({
          error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Send the file with Content-Type: text/csv' },
        });
      }
      res.json(await service.importCsv(req.body ?? ''));
    },
  );

  // Counts for the dashboard: { total, byStatus: {...}, bySeverity: {...} }.
  router.get('/stats', async (req, res) => {
    parse(statsQuerySchema, req.query);
    res.json(await issues.stats());
  });

  router.get('/:id', async (req, res) => {
    const { id } = parse(issueParamsSchema, req.params);
    const issue = await issues.findById(id);
    if (!issue) throw new NotFoundError(`Issue ${id} not found`);
    res.json(issue);
  });

  // Partial update. "Resolve" in the UI is a PATCH with { status: 'resolved' }.
  router.patch('/:id', async (req, res) => {
    const { id } = parse(issueParamsSchema, req.params);
    const changes = parse(updateIssueSchema, req.body);
    const issue = await issues.update(id, changes);
    if (!issue) throw new NotFoundError(`Issue ${id} not found`);
    res.json(issue);
  });

  router.delete('/:id', async (req, res) => {
    const { id } = parse(issueParamsSchema, req.params);
    const deleted = await issues.remove(id);
    if (!deleted) throw new NotFoundError(`Issue ${id} not found`);
    res.status(204).end();
  });

  return router;
}
