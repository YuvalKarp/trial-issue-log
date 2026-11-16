import { useCreateIssue, useIssues } from '../api/issues.js';
import IssueForm from '../components/IssueForm.jsx';
import IssuesTable from '../components/IssuesTable.jsx';

export default function IssuesPage() {
  const { data, isPending, error } = useIssues();
  const createIssue = useCreateIssue();

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

      <section className="card">
        <h2>Issues</h2>
        {isPending && <p className="muted">Loading issues...</p>}
        {error && <p className="error-banner">Could not load issues: {error.message}</p>}
        {data && <IssuesTable issues={data.items} />}
      </section>
    </>
  );
}
