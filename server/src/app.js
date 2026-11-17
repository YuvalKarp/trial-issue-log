import express from 'express';
import { NotFoundError, ValidationError } from './errors.js';
import { createIssuesRouter } from './issues/routes.js';

// Builds the Express app without starting it, so tests can call it directly.
// Everything the app depends on (for now, the database pool) is passed in.
export function createApp({ pool }) {
  const app = express();

  app.use(express.json());

  // Liveness check used by deployment: reports whether the server can reach the database.
  app.get('/health', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'error', message: 'Database is not reachable' });
    }
  });

  app.use('/api/issues', createIssuesRouter({ pool }));

  // No route matched.
  app.use((req, res) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
    });
  });

  // Last resort: anything a route threw that was not handled. Details go to the log, not the client.
  // Express recognises an error handler by its four arguments, so `next` must stay in the signature.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // Malformed JSON in the request body is the client's mistake, not ours.
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({
        error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' },
      });
    }

    // A body over the size limit (the CSV import allows 1MB).
    if (err.type === 'entity.too.large') {
      return res.status(413).json({
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'The file is too large (limit is 1MB)' },
      });
    }

    if (err instanceof ValidationError) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: err.message, details: err.details },
      });
    }

    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: err.message } });
    }

    console.error(err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
  });

  return app;
}
