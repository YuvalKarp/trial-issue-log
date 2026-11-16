# Product Notes

Working notes, added to as the build progresses. Sections follow the assignment brief.

## The space

_To be filled in._

## Clinical trial teams

- **Change history for every issue.** Keep a record of every change: who made it, when, and the value before and after. Make it visible from the issue itself, so that when something needs investigating, the team can see exactly what happened and in what order. Today only the latest state is stored and `updatedAt` says that something changed, not what.

## Growth

_To be filled in._

## Gaps

- **Concurrent edits can overwrite each other.** The API supports partial updates, but the edit form sends all five fields on save, including ones the user did not touch. If someone else changes the issue while the form is open (for example, resolves it), saving the form silently restores the old values. A related side effect: saving with no changes still advances `updatedAt`.
  - Kept as is for the MVP on purpose: one user, less code, easy to reason about.
  - Before real use: send only the fields that changed, and add a version check (the client sends the `updatedAt` it saw, and the server rejects the save if the issue has changed since).
- **Delete removes the record for good.** Deleting an issue erases the row from the database, with no way to see that it existed or to bring it back. In a clinical setting a record of a finding should not disappear.
  - Before real use: mark the issue as deleted instead (soft delete), hide it from the list by default, and keep it in the change history.

## Assumptions

_To be filled in._
