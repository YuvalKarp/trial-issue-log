import { useEffect, useState } from 'react';
import { SEVERITY_LABELS, STATUS_LABELS } from '../constants.js';

const SEARCH_DELAY_MS = 300;

// The search box and the two dropdowns above the table.
//
//   filters   the current { search, status, severity }; '' means "all"
//   onChange  called with the filters that changed, e.g. { status: 'open' }
export default function IssueFilters({ filters, onChange }) {
  // What is typed in the search box. It is applied only after the user pauses typing,
  // so a request is not sent for every keystroke.
  const [searchText, setSearchText] = useState(filters.search);

  // If the applied search changes from outside (Clear, browser back), show it in the box.
  useEffect(() => {
    setSearchText(filters.search);
  }, [filters.search]);

  useEffect(() => {
    if (searchText === filters.search) return;
    const timer = setTimeout(() => onChange({ search: searchText }), SEARCH_DELAY_MS);
    // Typing again before the delay passes cancels the pending update.
    return () => clearTimeout(timer);
  }, [searchText, filters.search, onChange]);

  const hasFilters = filters.search || filters.status || filters.severity;

  return (
    <div className="filters">
      <label className="field">
        <span>Search title</span>
        <input
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="e.g. consent"
          maxLength={200}
        />
      </label>

      <label className="field">
        <span>Status</span>
        <select value={filters.status} onChange={(event) => onChange({ status: event.target.value })}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Severity</span>
        <select
          value={filters.severity}
          onChange={(event) => onChange({ severity: event.target.value })}
        >
          <option value="">All severities</option>
          {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="button-secondary"
        onClick={() => onChange({ search: '', status: '', severity: '' })}
        disabled={!hasFilters}
      >
        Clear filters
      </button>
    </div>
  );
}
