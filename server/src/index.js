import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { migrate } from './db/migrate.js';
import { createPool } from './db/pool.js';

const config = loadConfig();
const pool = createPool(config.databaseUrl);

const applied = await migrate(pool);
if (applied.length > 0) {
  console.log(`Applied migrations: ${applied.join(', ')}`);
}

const app = createApp({ pool, staticDir: config.staticDir });
const server = app.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
});

// Stop accepting requests, then close database connections, so a deploy does not cut requests mid-flight.
function shutdown() {
  server.close(() => {
    pool.end().then(() => process.exit(0));
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
