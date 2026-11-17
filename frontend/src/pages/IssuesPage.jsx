import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { useCreateIssue, useIssues } from '../api/issues.js';
import IssueFilters from '../components/IssueFilters.jsx';
import IssueForm from '../components/IssueForm.jsx';
import IssuesTable from '../components/IssuesTable.jsx';
import { SEVERITY_LABELS, STATUS_LABELS } from '../constants.js';

// Reads the filters from the URL (?search=...&status=...&severity=...). The URL is the single
// source of truth, so a filtered view survives a reload and can be shared as a link.
// A status or severity that is not a known value (a hand-edited URL) is treated as "all".
function readFilters(searchParams) {
  const status = searchParams.get('status') ?? '';
  const severity = searchParams.get('severity') ?? '';
  return {
    search: searchParams.get('search') ?? '',
    status: status in STATUS_LABELS ? status : '',
    severity: severity in SEVERITY_LABELS ? severity : '',
  };
}

export default function IssuesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = readFilters(searchParams);
  const hasFilters = Boolean(filters.search || filters.status || filters.severity);

  const { data, isPending, error } = useIssues(filters);
  const createIssue = useCreateIssue();

  // Links from the dashboard end with #issues. The browser only jumps to an #anchor on a full
  // page load, not on navigation inside the app, so the scroll is done here. It runs again
  // once the issues arrive, because before that the page may be too short to scroll.
  // The hash disappears from the URL on the next filter change, so changing filters does not scroll.
  const { hash } = useLocation();
  const issuesRef = useRef(null);
  const hasData = Boolean(data);
  useEffect(() => {
    if (hash === '#issues') issuesRef.current?.scrollIntoView();
  }, [hash, hasData]);

  // Merges the changed filters into the URL. Empty values are removed rather than written as "?status=".
  // useCallback keeps the function identity stable, which the search box's delay timer relies on.
  const handleFiltersChange = useCallback(
    (changes) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [name, value] of Object.entries(changes)) {
            if (value) next.set(name, value);
            else next.delete(name);
          }
          return next;
        },
        // Replace the history entry, so the back button is not filled with every filter change.
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return (
    <>
      <section className="card">
        <h2>New issue</h2>
        <IssueForm
          submitLabel="Create issue"
          isPending={createIssue.isPending}
          error={createIssue.error}
          // On success, clear the form for the next issue.
          onSubmit={(values, reset) => createIssue.mutate(values, { onSuccess: reset })}
        />
      </section>

      <section className="card" id="issues" ref={issuesRef}>
        <h2>Issues</h2>
        <IssueFilters filters={filters} onChange={handleFiltersChange} />
        {isPending && <p className="muted">Loading issues...</p>}
        {error && <p className="error-banner">Could not load issues: {error.message}</p>}
        {data && (
          <IssuesTable
            issues={data.items}
            emptyMessage={
              hasFilters ? 'No issues match these filters.' : 'No issues yet. Create the first one above.'
            }
          />
        )}
      </section>
    </>
  );
}
