# AI Notes

Tool: Claude Code. This file is updated as the work progresses.

## How I worked with the AI

- I gave the AI the assignment PDF and asked for an architecture proposal (server, DB, frontend, folder structure, test strategy) with reasoning for both the MVP and production, plus a work plan in small steps.
- Rule I set from the start: no code without my explicit approval, and each step waits for my approval before the next one begins.
- The plan lives in `ARCHITECTURE_PLAN.md`. I reviewed the first version and sent back the nine comments below before approving anything.

## My review comments on the AI's first plan

1. **API did not match the plan.** `GET /api/issues` had a `page` parameter, but pagination was excluded from the work plan. I asked to either add basic server-side pagination or remove the parameter. Outcome: parameter removed; pagination became an optional last step.
2. **Express route order.** `GET /api/issues/stats` must be defined before `GET /api/issues/:id`, otherwise Express treats "stats" as an id. A classic bug, so I asked for a test that catches it. Outcome: route order fixed in the plan, dedicated test added, and `:id` is validated as a positive integer.
3. **`updated_at`.** The plan said it "updates on every change" but not how. A DB trigger, or a manual update in each query? Manual is easy to forget. Outcome: DB trigger (`BEFORE UPDATE`), with a test.
4. **`ILIKE` search.** I asked to make sure `%` and `_` in user input are escaped and that all queries are parameterized. Outcome: both added, with a test.
5. **CSV import.** I asked for an existing parsing library instead of hand-written code, a file size limit, and header validation. Outcome: `csv-parse`, 1MB limit, headers checked before rows are processed.
6. **Basic hygiene.** `.gitignore` and `.env.example`, no secrets in the repo, and the DB not exposed in deployment (port 5432 closed in the security group). Outcome: added as its own section in the plan.
7. **Time.** The plan came to about 5.5 hours, over the 3-5 hour budget. I pointed at what could be cut: the CI (a very short workflow is enough) and the AWS step, which the assignment allows skipping and documenting instead. Outcome: core plan is about 4.5 hours; AWS is optional and last.
8. **TypeScript or plain JavaScript.** The plan chose TypeScript. I am less confident in it, and it is one more thing I would need to understand and explain, so I asked for the practical benefit here and the cost for me before deciding. Outcome: JavaScript (see below).
9. **Postgres + Docker or SQLite.** The plan chose Postgres at the cost of the reviewer needing Docker. Reasonable for production, but running locally without Docker is an advantage for the reviewer. I asked for the AI's opinion and required that, if Postgres stays, the README explains clearly how to run it. Outcome: Postgres, with a one-command `docker compose up` at the top of the README.

## One place where the AI was wrong, and how I noticed

The first plan was internally inconsistent: the API table listed a `page` query parameter while the work plan explicitly left pagination out. I noticed by reading the API table against the work plan line by line instead of reviewing each section on its own.

## One AI suggestion I rejected, and why

TypeScript on both server and frontend. The first criterion in the evaluation is being able to explain what I built, and I can explain JavaScript with confidence. With one table, Zod validation at runtime and API tests, the bugs TypeScript would catch here are mostly caught anyway. In production, with a growing team and codebase, I would move to TypeScript.

## What I wrote or changed myself

_To be filled in as the work progresses._

## Time spent

_To be filled in at the end._
