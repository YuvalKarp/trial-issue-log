import { Router } from 'express';
import { NotFoundError, parse } from '../errors.js';
import { createIssuesRepository } from './repository.js';
import {
  createIssueSchema,
  issueParamsSchema,
  listIssuesQuerySchema,
  updateIssueSchema,
} from './schema.js';

// Routes under /api/issues. Each handler validates input, calls the repository and shapes the response.
// Express 5 forwards errors thrown in async handlers to the error handler in app.js.
export function createIssuesRouter({ pool }) {
  const router = Router();
  const issues = createIssuesRepository(pool);

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

  // Routes with a fixed path (e.g. /stats) must be registered above this point.
  // Express matches in order, and /:id would otherwise capture them.

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
