import { useState } from 'react';
import { useDeleteIssue, useUpdateIssue } from '../api/issues.js';
import { SEVERITY_LABELS, STATUS_LABELS } from '../constants.js';
import EditIssueDialog from './EditIssueDialog.jsx';

const formatDate = (iso) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export default function IssuesTable({ issues }) {
  // The issue currently open in the edit dialog, or null when the dialog is closed.
  const [editing, setEditing] = useState(null);
  // The id of the issue whose row is asking "Delete this issue?", or null.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const updateIssue = useUpdateIssue();
  const deleteIssue = useDeleteIssue();

  // Resolve and Delete act straight from the row, so a failure is shown above the table.
  const actionError = updateIssue.error ?? deleteIssue.error;
  const busy = updateIssue.isPending || deleteIssue.isPending;

  const handleResolve = (issue) => {
    deleteIssue.reset();
    updateIssue.mutate({ id: issue.id, status: 'resolved' });
  };

  // Delete is a two-step action: the first click asks for confirmation inside the row,
  // the second one deletes. Whatever the outcome, the row goes back to its normal buttons.
  const handleDelete = (issue) => {
    updateIssue.reset();
    deleteIssue.mutate(issue.id, { onSettled: () => setConfirmingDeleteId(null) });
  };

  if (issues.length === 0) {
    return <p className="muted">No issues yet. Create the first one above.</p>;
  }

  return (
    <>
      {actionError && <p className="error-banner">Action failed: {actionError.message}</p>}

      <div className="table-wrapper">
        <table className="issues-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Site</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
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
                  <span className={`badge status-${issue.status}`}>
                    {STATUS_LABELS[issue.status]}
                  </span>
                </td>
                <td className="nowrap">{formatDate(issue.createdAt)}</td>
                <td>
                  {confirmingDeleteId === issue.id ? (
                    <div className="row-actions">
                      <span className="confirm-text">Delete this issue?</span>
                      <button
                        className="button-small button-danger"
                        onClick={() => handleDelete(issue)}
                        disabled={busy}
                      >
                        Yes, delete
                      </button>
                      <button
                        className="button-small"
                        onClick={() => setConfirmingDeleteId(null)}
                        disabled={busy}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="row-actions">
                      <button className="button-small" onClick={() => setEditing(issue)}>
                        Edit
                      </button>
                      <button
                        className="button-small"
                        onClick={() => handleResolve(issue)}
                        disabled={busy || issue.status === 'resolved'}
                      >
                        Resolve
                      </button>
                      <button
                        className="button-small button-danger"
                        onClick={() => setConfirmingDeleteId(issue.id)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* key makes React build a fresh dialog (and form state) for each issue. */}
      {editing && (
        <EditIssueDialog key={editing.id} issue={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
