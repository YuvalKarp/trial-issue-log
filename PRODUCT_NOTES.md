# Product Notes

Working notes, added to as the build progresses. Sections follow the assignment brief.

## The space

_To be filled in._

## Clinical trial teams

- **Change history for every issue.** Keep a record of every change: who made it, when, and the value before and after. Make it visible from the issue itself, so that when something needs investigating, the team can see exactly what happened and in what order. Today only the latest state is stored and `updatedAt` says that something changed, not what.

## Growth

- **Title search scans the whole table.** Search uses `ILIKE '%text%'`, which a regular index cannot help with, so every search reads every row. With hundreds or a few thousand issues this is instant; with hundreds of thousands (many sites, many studies) it will slow down.
  - Before that scale: add a trigram index (`pg_trgm` extension, GIN index on `title`), which makes the same query fast without changing the API.
- **Import preview before saving.** Today one bad row blocks the whole file (see Assumptions). With real files of hundreds of rows, a single wrong date would hold back every other finding until someone can check it with the site.
  - Next step: upload checks the file without saving and shows a summary ("495 valid, 3 already in the log, 2 with errors", with the errors by line). The user then chooses to import the valid rows or fix the file first.
  - If they import part of the file, the rejected rows stay visible as pending ("2 rows from the 17 Nov import waiting to be fixed") instead of disappearing. Nothing goes in partially without the user knowing, and one bad row no longer blocks the rest.
  - Most of the work exists already: the import collects every error before saving. What is missing is a "check only" mode on the server and a summary screen.

## Gaps

- **Concurrent edits can overwrite each other.** The API supports partial updates, but the edit form sends all five fields on save, including ones the user did not touch. If someone else changes the issue while the form is open (for example, resolves it), saving the form silently restores the old values. A related side effect: saving with no changes still advances `updatedAt`.
  - Kept as is for the MVP on purpose: one user, less code, easy to reason about.
  - Before real use: send only the fields that changed, and add a version check (the client sends the `updatedAt` it saw, and the server rejects the save if the issue has changed since).
- **Delete removes the record for good.** Deleting an issue erases the row from the database, with no way to see that it existed or to bring it back. In a clinical setting a record of a finding should not disappear.
  - Before real use: mark the issue as deleted instead (soft delete), hide it from the list by default, and keep it in the change history.

## Assumptions

- **A CSV import is all-or-nothing.** If any row is invalid, nothing is saved and every problem is listed by line number. A partial import would leave the team unsure which findings made it in.
- **The same title, site and createdAt means the same issue.** Rows matching an existing issue on those three fields are skipped, so importing the same file twice does not double the counts. A genuinely different finding with the same title, at the same site, at the exact same second would also be skipped; that seemed far less likely than an accidental re-import.
  - Two imports of the same file running at the very same moment could still both insert. Before real use: a unique index on these three fields would make the database enforce it.
- **createdAt in a CSV is when the issue was found,** so it must include a time zone and cannot be in the future. updatedAt is set to the time of the import.
