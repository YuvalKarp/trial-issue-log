import { useState } from 'react';
import { SEVERITY_LABELS, STATUS_LABELS } from '../constants.js';

const EMPTY_FORM = { title: '', description: '', site: '', severity: 'minor' };

// The form used both to create an issue and to edit one. It owns the field values;
// the parent decides what submitting does and passes back the request state.
//
//   initialValues  starting values (edit passes the issue's current values)
//   showStatus     also show the status dropdown (edit only; new issues start as open)
//   onSubmit       called with (values, reset) where reset() restores the starting values
//   error          the ApiError from the last attempt, if any
//   onCancel       when given, a Cancel button is shown
export default function IssueForm({
  initialValues = EMPTY_FORM,
  showStatus = false,
  submitLabel,
  isPending,
  error,
  onSubmit,
  onCancel,
}) {
  const [form, setForm] = useState(initialValues);

  // Validation messages from the server (a 400), keyed by field name.
  const fieldErrors = Object.fromEntries(
    (error?.details ?? []).map((detail) => [detail.field, detail.message]),
  );
  // An error that is not about a specific field (server down, 500) is shown next to the button.
  const generalError = error && Object.keys(fieldErrors).length === 0;

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(form, () => setForm(initialValues));
  };

  return (
    <form className="issue-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Title</span>
        <input name="title" value={form.title} onChange={handleChange} maxLength={200} required />
        {fieldErrors.title && <span className="field-error">{fieldErrors.title}</span>}
      </label>

      <label className="field">
        <span>Site</span>
        <input
          name="site"
          value={form.site}
          onChange={handleChange}
          placeholder="Site-101"
          maxLength={100}
          required
        />
        {fieldErrors.site && <span className="field-error">{fieldErrors.site}</span>}
      </label>

      <label className="field">
        <span>Severity</span>
        <select name="severity" value={form.severity} onChange={handleChange}>
          {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {fieldErrors.severity && <span className="field-error">{fieldErrors.severity}</span>}
      </label>

      <label className="field field-wide">
        <span>Description</span>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          rows={3}
          required
        />
        {fieldErrors.description && <span className="field-error">{fieldErrors.description}</span>}
      </label>

      {showStatus && (
        <label className="field">
          <span>Status</span>
          <select name="status" value={form.status} onChange={handleChange}>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {fieldErrors.status && <span className="field-error">{fieldErrors.status}</span>}
        </label>
      )}

      <div className="form-actions">
        <button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="button-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        {generalError && <span className="field-error">{error.message}</span>}
      </div>
    </form>
  );
}
