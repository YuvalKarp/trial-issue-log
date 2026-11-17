# AI Notes

Tool: Claude Code.

## What I asked the AI to build, and what I wrote or changed myself

I gave it the assignment and asked for an architecture and a plan in small steps, with one rule: no code without my approval, and every step waits for me. The AI wrote the code; I directed and checked it (see the next section). What I changed:

- **The plan, before any code:** I sent back nine comments. Among them: `/stats` must be registered before `/:id`, with a test; `updated_at` by a trigger rather than by hand; escaping `%` and `_` in search; an existing CSV library with a size limit and header checks; no secrets in the repo and the database port closed; and cutting the plan to fit the time box.
- **Product decisions during the build:** re-importing the same CSV skips duplicates (the plan said it would create them); the edit form stays simple, with the risk written down as a gap; change history and an import preview go into the product notes; dashboard cards open the filtered list at the table.

## How I checked the AI's work

- **Reviewed the code between steps,** and asked about anything unclear: why ids above the database limit are rejected, why the update schema uses `refine`, how the two `useEffect` hooks behind the search box interact, why the form hands `reset` to its parent.
- **Tried the features by hand** in the browser instead of relying on the AI's report. This is how the delete bug below was found.
- **Asked for tests that catch specific bugs,** such as `/stats` being swallowed by `/:id` and unescaped `%` in search. Those tests were then checked by breaking the code on purpose and watching them fail.
- **Asked for invalid CSV files** to see for myself what a failed import shows. Two of them are kept in the repo.

## Where the AI was wrong, and how I noticed

**In the plan:** the API table listed a `page` parameter, while the work plan left pagination out. I noticed by reading the API table against the work plan line by line, before any code was written.

**In the build:** the AI reported that Delete worked and had been checked in the browser. When I tried it, clicking Delete did nothing. The code used `window.confirm`, which the embedded browser blocks, so every delete was cancelled silently. The AI had missed it because its own check replaced `window.confirm` with a stub that always said yes, skipping exactly the broken part. I noticed only because I tried it by hand instead of trusting the report. The fix was a confirmation inside the table row, re-checked with real clicks and no stubs. Since then the AI states which checks it did by hand and which it could not.

## One AI suggestion I rejected, and why

TypeScript on the server and the frontend. The first evaluation criterion is explaining what I built, and I can explain JavaScript with confidence. With one table, Zod validation at runtime and API tests, most of what TypeScript would catch here is caught anyway. With a growing team and codebase I would switch.

## Roughly how long I spent

About **5 hours** in total.
