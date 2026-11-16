import { SEVERITY_LABELS, STATUS_LABELS } from '../constants.js';

const formatDate = (iso) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function IssuesTable({ issues }) {
  if (issues.length === 0) {
    return <p className="muted">No issues yet. Create the first one above.</p>;
  }

  return (
    <div className="table-wrapper">
      <table className="issues-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Site</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.id}>
              <td>
                <div className="issue-title">{issue.title}</div>
                <div className="issue-description">{issue.description}</div>
              </td>
              <td>{issue.site}</td>
              <td>
                <span className={`badge severity-${issue.severity}`}>
                  {SEVERITY_LABELS[issue.severity]}
                </span>
              </td>
              <td>
                <span className={`badge status-${issue.status}`}>{STATUS_LABELS[issue.status]}</span>
              </td>
              <td className="nowrap">{formatDate(issue.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
