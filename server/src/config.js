// Reads configuration from environment variables and fails fast if something required is missing.
export function loadConfig(env = process.env) {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required (copy .env.example to .env)');
  }

  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT must be a positive integer, got "${env.PORT}"`);
  }

  // Optional: the folder with the built frontend. Set in the Docker image, where the server
  // serves the UI too. In development Vite serves the UI, so it is left unset.
  const staticDir = env.STATIC_DIR || undefined;

  return { databaseUrl: env.DATABASE_URL, port, staticDir };
}
