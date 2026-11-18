# Trial Issue Log: Architecture Proposal and Work Plan

Planning document for the home assignment (Founding Engineer). Written before the first line of code; no step starts without approval. The [README](README.md) describes what was actually built.

Version 2: updated after a round of review comments (pagination, route order, `updated_at`, search escaping, CSV import, hygiene, time). The two open decisions were settled: JavaScript and PostgreSQL (see "Decisions made" at the end).

## The recommendation in short

One monorepo: an Express server on Node.js LTS, PostgreSQL, a React frontend with Vite, all packaged into a single Docker image that runs on EC2.

The guiding principle: the same stack serves both the assignment and production, so the answer to "what would you do in production" is "the same thing, managed", not "I would rewrite it".

## Choices and reasoning

| Layer | Choice | Why for the assignment | What changes in production |
|---|---|---|---|
| Language | Modern JavaScript (ESM) | Every line can be explained in the interview; no build step on the server | Move to TypeScript as the code and the team grow |
| Server | Express 5 + Zod | Any reviewer reads Express immediately; one Zod schema defines validation (400) in one place | The layers (route → service → repository) allow moving to Fastify/NestJS as the team grows |
| DB | PostgreSQL 16 | Relational, `CHECK` on enums, `timestamptz`, `ILIKE` search, a transaction for the import | RDS with backups and Multi-AZ; sites/trials/users tables and an audit trail (a regulatory requirement in this domain) |
| DB access | `pg` with parameterized SQL only, no ORM | One table; an ORM would be over-engineering, and the SQL itself is the deliverable of `db/` | Kysely for typed queries, and a migrations tool |
| Frontend | React + Vite + TanStack Query + React Router | The company works with React; TanStack Query refreshes the list and dashboard after every change without manual state | Same stack, plus a component library and auth |
| Styling | Plain CSS, no UI library | Two pages; fewer dependencies | A design system |
| Deploy | One image (the server also serves the frontend) + Postgres in docker compose on EC2 t3.micro | One origin with no CORS, one command, within the free tier | ECS/App Runner + RDS + CloudFront, IaC, secrets in Secrets Manager |
| CI | A minimal GitHub Actions workflow: install and `npm test` | About 15 lines of YAML, shows deployment hygiene | Add lint and automatic deploy |

### Alternatives rejected

- **Next.js:** no need for SSR, and it blurs the separation between server and frontend that the assignment asks for.
- **ORM (Prisma/Drizzle):** for one table it is an unnecessary layer; visible SQL is easier to explain in the interview.

## Data model

A single `issues` table:

| Column | Type | Notes |
|---|---|---|
| `id` | identity | Auto-generated primary key |
| `title` | text | NOT NULL |
| `description` | text | NOT NULL |
| `site` | text | NOT NULL, e.g. `Site-101` |
| `severity` | text | `CHECK` on `minor` / `major` / `critical` |
| `status` | text | `CHECK` on `open` / `in_progress` / `resolved`, default `open` |
| `created_at` | timestamptz | Default `now()` |
| `updated_at` | timestamptz | Updated by a trigger in the DB |

- Index on `created_at DESC` (the list's sort order).
- `CHECK` on text rather than a Postgres enum, because adding values later is easier.
- **`updated_at` is updated by a trigger (`BEFORE UPDATE`), not in the query.** A manual update is easy to forget in a new query; a trigger catches every update path, including a manual fix in SQL. A test checks that `PATCH` advances `updatedAt` and does not touch `createdAt`.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/issues?search=&status=&severity=` | List with filters, sorted by `createdAt` descending |
| `GET /api/issues/stats` | Counts for the dashboard, computed in the DB with `GROUP BY` |
| `GET /api/issues/:id` | Issue details |
| `POST /api/issues` | Create |
| `PATCH /api/issues/:id` | Partial update; Resolve is `status: resolved` |
| `DELETE /api/issues/:id` | Delete |
| `POST /api/issues/import` | CSV import |
| `GET /health` | Liveness check for deployment |

- Errors in one format: `{ error: { code, message, details[] } }`.
- Invalid input returns 400; an id that does not exist returns 404.
- **No pagination in the core.** The `page` parameter was removed so the API matches the plan. Server-side pagination (`LIMIT`/`OFFSET` + `total`) is an optional last step, as the assignment defines it ("only if time remains").
- **Route order:** `/stats` and `/import` are defined before `/:id`, otherwise Express reads "stats" as an id. In addition, `:id` is validated as a positive integer, so a non-numeric id returns 400 rather than a DB error. Dedicated test: `GET /api/issues/stats` returns 200 with the shape of the counts.
- **Search:** all queries are parameterized (`$1`, `$2`), with no string concatenation. In the search input, the characters `\`, `%` and `_` are escaped before `ILIKE ... ESCAPE '\'`. Test: searching for `%` or `_` does not return every record.

### CSV import: all or nothing

- **Parsing with an existing library** (`csv-parse`), not hand-written code. It handles quotes, commas inside a field and line breaks.
- **Size limit:** 1MB on the request body; beyond that, 413.
- **Header check:** the header row must contain exactly the six headers (`title,description,site,severity,status,createdAt`), in any order. A missing, unknown or repeated header returns 400 before any row is processed.
- **Every row goes through the same Zod schema** as a regular create, plus `status` and `createdAt`. `createdAt` must be ISO 8601 with a time zone, and not in the future.
- **All or nothing:** if one row is invalid, nothing goes in, and a 400 returns the list of errors by line number. In a clinical context a partial import leaves uncertainty about what went in. In practice this is a single `INSERT` for all rows (with `unnest`), and a single statement in Postgres is atomic on its own, so no explicit transaction is needed.
- **Duplicates (decided in step 6):** a row identical to an existing issue on `title`, `site` and `createdAt`, or to an earlier row in the same file, is skipped. The response is `{ imported, skipped }`, so re-importing the same file does not inflate the counts.
- **Upload:** the frontend sends the file's content as a `text/csv` body, so no multipart library is needed. Any other content type returns 415.

## Hygiene and basic security

- `.gitignore` from the first commit: `node_modules`, `.env`, build output.
- `.env.example` with the variable names and sample values; the real `.env` never enters the repo.
- No secrets in the code, in compose or in CI. The production DB password is created on the server only.
- In deployment, Postgres does not publish a port to the outside; it is reachable only inside the instance.
- The security group opens only 80 to everyone and 22 to my IP address only. 5432 is closed.

## Folder structure

```
trial-issue-log/
├── server/
│   ├── src/
│   │   ├── app               # builds the app (separate from listen, for tests)
│   │   ├── index
│   │   ├── db/               # pool + migrations runner
│   │   └── issues/           # routes, service, repository, schema (Zod), csv
│   └── tests/                # api/ + unit/
├── frontend/
│   └── src/
│       ├── api/              # client + TanStack Query hooks
│       ├── pages/            # IssuesPage, DashboardPage
│       └── components/       # IssueForm, IssuesTable, Filters, ImportCsv, StatChips
├── db/                       # SQL migrations (table + trigger) + schema README
├── .github/workflows/ci.yml
├── .gitignore
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── issues.csv
├── README.md
├── PRODUCT_NOTES.md
└── AI_NOTES.md
```

Code files use the `.js` extension (and `.jsx` in the frontend).

## Test strategy

Most of the effort goes into API tests against a real DB (Vitest + Supertest), because that is where the real bugs in a CRUD app are: validation, filter queries and transactions.

1. **API tests (about 18):**
   - Validation that returns 400 (missing field, invalid enum, non-numeric id).
   - 404 for an id that does not exist.
   - `GET /api/issues/stats` returns counts and is not caught as `:id`.
   - The stats counts match the data.
   - Combinations of filters and search, and the sort order.
   - Searching with `%` and `_` treats them as plain characters.
   - `PATCH` advances `updatedAt` and leaves `createdAt`.
   - Import: an invalid row inserts nothing; a missing header returns 400; a file that is too large returns 413.
2. **Unit tests (about 6):** CSV parsing and validation, including a field with a comma inside quotes and an invalid date; the search escaping function.
3. **Not in the assignment; to be written in the README as "next", in this order:**
   1. Component tests for the delete confirmation (Delete does not delete on one click, Cancel does not delete, "Yes, delete" sends `DELETE` for the right id). First on the list because delete is the only action that cannot be undone, and because a bug was already found here in manual testing.
   2. One Playwright test for the full flow in a real browser.
   3. Component tests for the form and the filters.
   4. A load test for a large import.

One command, `npm test`, starts a DB for the tests and runs everything.

## Work plan

Each step ends with something that works end to end, and stops for approval before moving to the next one.

| # | Step | Output | Time |
|---|---|---|---|
| 0 | Preparation | Node LTS and Docker installed, `git init`, `.gitignore`, `.env.example`, folder skeleton | 15 min |
| 1 | Skeleton | DB in compose, migration (table + trigger), server with `/health`, first test passes | 30 min |
| 2 | Create and list | `POST` + `GET` with validation and tests, and a frontend page that lists and creates | 50 min |
| 3 | Edit, Resolve, delete | `PATCH`/`DELETE`/`GET :id` with tests and buttons in the table | 35 min |
| 4 | Filters and search | Server parameters with escaping and tests, frontend filters (kept in the URL) | 25 min |
| 5 | Dashboard | `stats` with tests (including route order), dashboard page and navigation | 25 min |
| 6 | CSV import | Endpoint with tests, upload button, `issues.csv` | 35 min |
| 7 | Packaging | Dockerfile, full README, minimal CI | 25 min |
| 8 | Documents | PRODUCT_NOTES, AI_NOTES | 30 min |
| 9 | AWS (optional) | EC2 + compose, a working URL; if there is no time, document the process in the README only | 40 min |
| 10 | Pagination (optional) | `page`/`pageSize` + `total` on the server, previous/next in the frontend | 20 min |

- Core (steps 0 to 8): about four and a half hours, within the 3 to 5 hour budget.
- With AWS: about five hours and ten minutes. The assignment allows skipping it and documenting it instead.
- The documents step was moved ahead of AWS, because it is required and AWS is not.

## Decisions made

### 1. TypeScript or JavaScript

Decided: **JavaScript**.

- **What TypeScript actually gives here:** an error at write time when the frontend expects a field the server does not return, and autocomplete in the editor. In an app with one table, Zod validation at runtime and about 18 API tests, most of those bugs are caught anyway.
- **The cost:** two `tsconfig` files, a build step for the server, and type definitions (Express and TanStack Query generics) that I would need to explain line by line in the interview.
- **The deciding factor:** the first evaluation criterion is "the ability to explain what you have". JavaScript explained with confidence is better than TypeScript explained with hesitation.
- **What goes in the README:** that in production, with a growing team and codebase, we move to TypeScript, and why not now.

### 2. Postgres + Docker or SQLite

Decided: **Postgres**, provided Docker runs on the computer in step 0 within about fifteen minutes. If not, switch to SQLite.

- **For Postgres:** the same DB in the assignment and in production; the tests exercise the real `ILIKE`, trigger and `timestamptz`; the deploy to EC2 is identical to running locally.
- **For SQLite:** the reviewer runs `npm install` and `npm start` without Docker; saves about 20 to 30 minutes; the assignment asks separately about the assignment and about production, so "SQLite now, Postgres in production" is a legitimate answer.
- **How to lower the cost of Postgres for the reviewer:** the README opens with one command, `docker compose up`, which starts the DB, migrations and app without installing Node. After it, a separate development path (DB in Docker, server and frontend with `npm run dev`), and explicit prerequisites at the top of the document. The AWS URL, if there is one, lets them try it without running anything.

## Other open questions (resolved)

- **Node and Docker:** checked in step 0; neither was installed (nor Homebrew). Both were installed before step 1.
- **AWS account:** in accounts opened after July 2025 the free tier is credits rather than 12 months; t3.micro is covered in both cases. In the end AWS was not deployed; the README documents the process.
- **AI_NOTES:** must reflect what actually happened (where the AI was wrong, what was rejected). Written as `AI_NOTES.md`.
