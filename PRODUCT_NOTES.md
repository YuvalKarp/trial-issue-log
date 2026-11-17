# Product Notes

## The space

- An issue found on a site visit is what the domain calls a monitoring finding, often a protocol deviation. It belongs to a study, a site, a visit and sometimes a subject. Here it has only a free-text site, so I would add those as real records rather than build something different.
- The value is less in logging the finding than in closing it: who has to act, by when, and the evidence that it was fixed. Today that follow-up usually lives in spreadsheets and emails between the monitor (CRA) and the site.

## Clinical trial teams

- **Change history for every issue:** who changed what, when, and the value before and after, visible from the issue itself. When something needs investigating, the team can see exactly what happened and in what order. Today `updatedAt` says only that something changed.
- **Owner and due date,** with an "overdue" view, so open findings are followed up rather than forgotten.
- **Study, site and visit picked from a list,** not typed: "Site-101" and "site 101" would otherwise count as two sites on the dashboard.
- **Export** of a site's findings for the visit report and the trial master file.

## Growth

What I would build next, in this order:

1. **Users and sign-in.** Change history and owners both depend on knowing who is acting.
2. **Import preview.** Today one bad row blocks a whole file. Instead: check the file without saving, show "495 valid, 3 already in the log, 2 with errors", and let the user import the valid rows or fix the file. Rejected rows stay visible as pending, so nothing goes in partially without the user knowing.
3. **A search index** (trigram on `title`) once there are hundreds of thousands of issues. Search scans the table, which is instant at today's size.

## Gaps

What must be fixed before teams rely on it every day:

- **Concurrent edits can overwrite each other.** The edit form sends all five fields, so saving restores values someone else changed meanwhile. Fix: send only changed fields, and reject the save if `updatedAt` changed since the form opened.
- **Delete is permanent.** A clinical finding should not disappear. Fix: mark issues as deleted and keep them in the history.
- **No sign-in, no backups, plain HTTP.** For trials under FDA rules (21 CFR Part 11), electronic records also need an audit trail and access control.

## Assumptions

- **A CSV import is all-or-nothing:** a partial import would leave the team unsure which findings went in.
- **Same title, site and createdAt means the same issue,** so re-importing a file skips those rows. A different finding with the same title, at the same site, in the same second is far less likely than an accidental re-import. Two imports at the very same moment could still both insert; a unique index would close that.
- **createdAt in a CSV is when the issue was found,** so it needs a time zone and cannot be in the future.
