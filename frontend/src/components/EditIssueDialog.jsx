import { useEffect, useRef } from 'react';
import { useUpdateIssue } from '../api/issues.js';
import IssueForm from './IssueForm.jsx';

// A modal for editing one issue. Uses the browser's <dialog>, which handles the backdrop,
// keeping focus inside, and closing on Escape.
export default function EditIssueDialog({ issue, onClose }) {
  const dialogRef = useRef(null);
  const updateIssue = useUpdateIssue();

  useEffect(() => {
    dialogRef.current.showModal();
  }, []);

  const { title, description, site, severity, status } = issue;

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose}>
      <h2>Edit issue</h2>
      <IssueForm
        initialValues={{ title, description, site, severity, status }}
        showStatus
        submitLabel="Save changes"
        isPending={updateIssue.isPending}
        error={updateIssue.error}
        onSubmit={(values) => updateIssue.mutate({ id: issue.id, ...values }, { onSuccess: onClose })}
        onCancel={onClose}
      />
    </dialog>
  );
}
