import express from 'express';

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

    console.error(err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
  });

  return app;
}
