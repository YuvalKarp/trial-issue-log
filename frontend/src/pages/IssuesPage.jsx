import { useIssues } from '../api/issues.js';
import IssueForm from '../components/IssueForm.jsx';
import IssuesTable from '../components/IssuesTable.jsx';

export default function IssuesPage() {
  const { data, isPending, error } = useIssues();

  return (
    <>
      <section className="card">
        <h2>New issue</h2>
        <IssueForm />
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
