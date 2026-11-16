import { useState } from 'react';
import { useCreateIssue } from '../api/issues.js';
import { SEVERITY_LABELS } from '../constants.js';

const EMPTY_FORM = { title: '', description: '', site: '', severity: 'minor' };

export default function IssueForm() {
  const [form, setForm] = useState(EMPTY_FORM);
  const createIssue = useCreateIssue();

  // Validation messages from the server (a 400), keyed by field name.
  const fieldErrors = Object.fromEntries(
    (createIssue.error?.details ?? []).map((detail) => [detail.field, detail.message]),
  );
  // An error that is not about a specific field (server down, 500) is shown as a banner.
  const generalError = createIssue.error && Object.keys(fieldErrors).length === 0;

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    createIssue.mutate(form, {
      onSuccess: () => setForm(EMPTY_FORM),
    });
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

      <div className="form-actions">
        <button type="submit" disabled={createIssue.isPending}>
          {createIssue.isPending ? 'Creating...' : 'Create issue'}
        </button>
        {generalError && <span className="field-error">{createIssue.error.message}</span>}
      </div>
    </form>
  );
}
