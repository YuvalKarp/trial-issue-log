import { Link } from 'react-router';
import { useIssueStats } from '../api/issues.js';
import { SEVERITY_LABELS, STATUS_LABELS } from '../constants.js';

// One group of counts, e.g. "By status". Each count links to the issues list filtered by it,
// so the dashboard is also a way into the matching issues. #issues makes the issues page
// open scrolled to the table rather than to the form at the top.
//
//   counts   e.g. { open: 3, in_progress: 1, resolved: 1 }
//   labels   display label for each value
//   filter   the URL parameter the links set: 'status' or 'severity'
function StatGroup({ title, counts, labels, filter }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <div className="stat-grid">
        {Object.entries(labels).map(([value, label]) => (
          <Link
            key={value}
            to={`/?${filter}=${value}#issues`}
            className={`stat ${filter}-${value}`}
          >
            <span className="stat-count">{counts[value]}</span>
            <span className="stat-label">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const { data, isPending, error } = useIssueStats();

  if (isPending) return <p className="muted">Loading dashboard...</p>;
  if (error) return <p className="error-banner">Could not load the dashboard: {error.message}</p>;

  return (
    <>
      <section className="card">
        <h2>Total issues</h2>
        <Link to="/#issues" className="stat stat-total">
          <span className="stat-count">{data.total}</span>
          <span className="stat-label">View all</span>
        </Link>
      </section>
      <StatGroup title="By status" counts={data.byStatus} labels={STATUS_LABELS} filter="status" />
      <StatGroup
        title="By severity"
        counts={data.bySeverity}
        labels={SEVERITY_LABELS}
        filter="severity"
      />
    </>
  );
}
