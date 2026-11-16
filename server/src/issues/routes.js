import { Router } from 'express';
import { parse } from '../errors.js';
import { createIssuesRepository } from './repository.js';
import { createIssueSchema } from './schema.js';

// Routes under /api/issues. Each handler validates input, calls the repository and shapes the response.
// Express 5 forwards errors thrown in async handlers to the error handler in app.js.
export function createIssuesRouter({ pool }) {
  const router = Router();
  const issues = createIssuesRepository(pool);

  router.get('/', async (req, res) => {
    const items = await issues.list();
    // Wrapped in an object so fields like `total` can be added later without breaking clients.
    res.json({ items });
  });

  router.post('/', async (req, res) => {
    const data = parse(createIssueSchema, req.body);
    const issue = await issues.create(data);
    res.status(201).json(issue);
  });

  return router;
}
