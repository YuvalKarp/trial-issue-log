# Trial Issue Log

Track issues found during clinical trial site visits: create, edit, resolve and delete issues, search and filter them, see counts on a dashboard, and import a batch from CSV.

**Stack:** Node.js 26 (LTS) with Express 5 · PostgreSQL 16 · React 19 with Vite · Docker

## Run it (one command)

Needs only [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
docker compose up -d --build
```

Open http://localhost:3000. This starts Postgres, applies the database migrations and serves the app. To try the import, click **Import CSV** and choose `issues.csv` from the repo root.

To stop (data is kept in a Docker volume):

```bash
docker compose down
```

## Develop locally

Needs Docker and [Node.js 26 LTS](https://nodejs.org/).

```bash
cp .env.example .env
npm run install:all
```

Then, in two terminals:

```bash
npm run dev:server     # starts Postgres in Docker, then the API on http://localhost:3000
npm run dev:frontend   # the UI on http://localhost:5173, with hot reload
```

Open http://localhost:5173. Vite forwards `/api` requests to the API server, so the browser sees a single origin. Stop the one-command container first if it is running, since both use port 3000.

## Tests

```bash
npm test
```

Starts Postgres in Docker if it is not running, then runs all server tests (97, about 2 seconds). Tests use their own database, `issues_test`, created automatically next to the development one, so they never touch your data. Each test starts from an empty table.

### Which tests, and why these first

Almost all tests are **API tests against a real Postgres** (Vitest + Supertest). In a CRUD app, the bugs that matter live where the request meets the database: validation, SQL filters, constraints, transactions. Mocking the database would hide exactly those. Each one sends a real HTTP request to the app and checks the response and, where it matters, the database.

| Area | Tests | What they protect |
|---|---|---|
| Create and list (`issues.test.js`) | 15 | Missing fields, wrong types, unknown fields and malformed JSON return 400 and store nothing; trimming; newest-first order |
| Read, update, delete (`issue-by-id.test.js`) | 22 | 404 for missing ids, 400 for non-numeric or too-large ids, partial update, invalid values and read-only fields rejected, `updatedAt` moves and `createdAt` does not |
| Search and filters (`issues-filters.test.js`) | 18 | Each filter and their combinations; `%`, `_` and `\` in a search are literal; SQL in the search text is harmless |
| Dashboard counts (`issues-stats.test.js`) | 6 | Correct counts with zeros; `/stats` is not swallowed by the `/:id` route |
| CSV import (`issues-import.test.js`) | 19 | The shipped `issues.csv` imports; all-or-nothing with errors by line; duplicates skipped; quoted cells; bad headers; 413 and 415 |
| Database schema (`schema.test.js`) | 5 | CHECK constraints and the `updated_at` trigger hold even when the API is bypassed |
| Serving the frontend, health (`static.test.js`, `health.test.js`) | 8 | Reloading `/dashboard` works in the Docker image; `/health` reports the database |
| Unit (`escape-like.test.js`) | 4 | The LIKE-escaping helper on its own |

For the riskiest checks, I confirmed the tests would catch a real bug by breaking the code on purpose: removing the search escaping, moving `/stats` below `/:id`, and disabling each duplicate check in the import each made the matching tests fail.

### Which tests next, in this order

1. **Component tests for the delete confirmation:** one click on Delete does not delete, Cancel does not delete, and "Yes, delete" sends `DELETE` for the right id. First because delete is the only action that cannot be undone, and a real bug was found here by hand during development.
2. **One Playwright test of the full flow in a real browser:** create, filter, resolve, import a file through the real file picker, check the dashboard. Catches what API tests cannot, such as the UI and the API disagreeing.
3. **Component tests for the issue form and the filters:** validation messages, the search delay, filters kept in the URL.
4. **A load test for a large import:** a file near the 1MB limit, to measure time and memory.

## API

All endpoints take and return JSON, except the CSV import. Errors have one shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed",
             "details": [{ "field": "severity", "message": "Severity must be one of: minor, major, critical" }] } }
```

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/issues` | List, newest first. Optional `search` (title), `status`, `severity` |
| `POST` | `/api/issues` | Create. `status` defaults to `open` |
| `GET` | `/api/issues/:id` | One issue |
| `PATCH` | `/api/issues/:id` | Update any subset of the fields |
| `DELETE` | `/api/issues/:id` | Delete (204) |
| `GET` | `/api/issues/stats` | Counts by status and by severity |
| `POST` | `/api/issues/import` | Import a CSV file sent as a `text/csv` body |
| `GET` | `/health` | 200 if the database is reachable, 503 if not |

Bad input returns 400, an unknown id 404, a file over 1MB 413.

### Examples

```bash
# Create
curl -X POST http://localhost:3000/api/issues \
  -H 'Content-Type: application/json' \
  -d '{"title":"Missing consent form","description":"Consent form not in file for patient 003","site":"Site-101","severity":"major"}'

# List open critical issues whose title contains "temp"
curl 'http://localhost:3000/api/issues?status=open&severity=critical&search=temp'

# Resolve issue 1
curl -X PATCH http://localhost:3000/api/issues/1 \
  -H 'Content-Type: application/json' -d '{"status":"resolved"}'

# Dashboard counts
curl http://localhost:3000/api/issues/stats
# {"total":4,"byStatus":{"open":2,"in_progress":1,"resolved":1},"bySeverity":{"minor":1,"major":2,"critical":1}}

# Import the sample file
curl -X POST http://localhost:3000/api/issues/import \
  -H 'Content-Type: text/csv' --data-binary @issues.csv
# {"imported":4,"skipped":0}

# Delete issue 1
curl -X DELETE http://localhost:3000/api/issues/1
```

### CSV import

The header row must have exactly these columns, in any order: `title,description,site,severity,status,createdAt`. `createdAt` is an ISO 8601 date-time with a time zone, such as `2025-05-01T09:00:00Z`.

- **All or nothing:** if any row is invalid, nothing is saved, and the response lists every problem with its line number.
- **Duplicates are skipped:** a row with the same title, site and createdAt as an existing issue (or an earlier row in the file) is not imported again, so importing the same file twice adds nothing.

Example files in the repo root:

| File | Shows |
|---|---|
| `issues.csv` | The sample from the assignment; imports cleanly |
| `issues-invalid-rows.csv` | Five different invalid values, each reported with its line |
| `issues-invalid-structure.csv` | A row split by an unquoted comma, and a row missing a cell |

## Project structure

```
server/            Express API (also serves the built frontend in Docker)
  src/issues/      routes → service (CSV import) → repository (SQL), schema.js (Zod validation)
  tests/           api/, db/, unit/
frontend/          React + Vite
  src/pages/       IssuesPage, DashboardPage
  src/components/  form, table, filters, import button, edit dialog
  src/api/         fetch client and TanStack Query hooks
db/                SQL migrations and the schema description (db/README.md)
Dockerfile         one image: builds the frontend, runs the server
docker-compose.yml Postgres + the app
.github/workflows/ CI: server tests, frontend build, Docker build
```

The database schema and its design choices are described in [db/README.md](db/README.md).

## Deploy to AWS (free tier)

**Approach:** one EC2 instance (t3.micro, within the free tier) running the same `docker compose` setup as above. The server serves the frontend, so there is one container for the app and one for Postgres, one origin and no CORS.

Why this approach for the assignment: it is the same setup that runs locally, so what is tested is what is deployed; it fits the free tier; and it is a handful of commands that are easy to explain and repeat.

### Steps

1. **Launch an instance:** Amazon Linux 2023, t3.micro, with a key pair.
2. **Security group:** port 80 open to everyone, port 22 open only to my IP. Port 5432 is not opened: Postgres is reachable only from inside the instance.
3. **Install Docker** with the compose plugin, and clone the repo.
4. **Create `.env` on the instance** (never committed) with a strong `POSTGRES_PASSWORD` and `APP_PORT=80`.
5. **Start:** `docker compose up -d --build`, then open `http://<public-ip>`.
6. **Update:** `git pull && docker compose up -d --build`. Migrations run when the server starts.

### Practices followed

- **No secrets in the repo:** `.env` is gitignored, and `.env.example` holds only placeholders. The real password exists only on the instance.
- **Database not exposed:** Postgres listens on localhost only, and its port is closed in the security group.
- **Minimal container:** two-stage image without build tools, running as the unprivileged `node` user, with a health check against `/health`.
- **Restarts on its own:** both containers have `restart: unless-stopped`, so they come back after a crash or a reboot.
- **CI on every push:** server tests, frontend build and Docker build, so a broken commit is visible before it is pulled onto the instance.

### What I would change for production

The app image is unchanged; what runs around it changes:

- **Image:** built in CI and pushed to ECR, instead of building on the instance.
- **App:** runs on ECS Fargate or App Runner.
- **Database:** RDS for Postgres, with automated backups and Multi-AZ.
- **Secrets:** the password lives in Secrets Manager.
- **Traffic:** HTTPS through a load balancer or CloudFront. The setup above serves plain HTTP.
- **Infrastructure:** the whole setup written as code (Terraform or CDK).

## Trade-offs and decisions

- **JavaScript, not TypeScript.** With one table, Zod validation at runtime and API tests, most of what TypeScript would catch here is caught anyway, and every line stays easy to explain. With a growing team and codebase I would move to TypeScript.
- **PostgreSQL, not SQLite.** It is the same database as in production, so the tests exercise the real `ILIKE`, trigger and `timestamptz` behaviour. The cost, needing Docker, is offset by the one-command start above.
- **Plain SQL with `pg`, no ORM.** One table does not justify an ORM, and parameterized SQL is easy to read and review.
- **One Docker image serving the API and the UI.** One origin, one deploy unit, no CORS. At scale the static files would move to a CDN.
- **CSV import is all-or-nothing.** A partial import would leave the team unsure which findings went in. [PRODUCT_NOTES.md](PRODUCT_NOTES.md) describes a preview step as the next improvement.
- **The edit form sends all fields.** The API supports partial updates, but the form sends all five fields, so two people editing the same issue can overwrite each other. Acceptable for a single-user MVP; the fix is described in PRODUCT_NOTES.
- **No search index.** Title search scans the table, which is instant at this size; a trigram index is the fix at scale.
- **Not done in the time box:** pagination, authentication and frontend tests (see "Which tests next").

## More

- [PRODUCT_NOTES.md](PRODUCT_NOTES.md): product thinking, gaps and assumptions
- [AI_NOTES.md](AI_NOTES.md): how AI tools were used and checked
- [ARCHITECTURE_PLAN.md](ARCHITECTURE_PLAN.md): the architecture plan and work plan written before coding (in Hebrew)
