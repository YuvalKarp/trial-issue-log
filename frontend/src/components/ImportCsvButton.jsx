import { useRef, useState } from 'react';
import { useImportIssues } from '../api/issues.js';

// The server refuses larger files; checking here as well saves uploading them.
const MAX_BYTES = 1024 * 1024;
// A file with problems in every row could produce hundreds of errors; show the first few.
const MAX_ERRORS_SHOWN = 10;

// "Import CSV" button with the result of the last import underneath it.
// The file input itself is hidden; the button opens it.
export default function ImportCsvButton() {
  const inputRef = useRef(null);
  const importIssues = useImportIssues();
  // A problem found before sending (the file is too large); server errors come from the mutation.
  const [localError, setLocalError] = useState(null);

  const handleFile = async (event) => {
    const file = event.target.files[0];
    // Clear the input, so choosing the same file again (after fixing it) fires a change.
    event.target.value = '';
    if (!file) return;

    importIssues.reset();
    setLocalError(null);
    if (file.size > MAX_BYTES) {
      setLocalError(`${file.name} is larger than 1MB, the import limit.`);
      return;
    }
    importIssues.mutate(await file.text());
  };

  return (
    <div className="import">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFile}
        hidden
      />
      <button
        type="button"
        className="button-secondary"
        onClick={() => inputRef.current.click()}
        disabled={importIssues.isPending}
      >
        {importIssues.isPending ? 'Importing...' : 'Import CSV'}
      </button>
      {localError && <p className="error-banner import-message">{localError}</p>}
      <ImportResult mutation={importIssues} />
    </div>
  );
}

function ImportResult({ mutation }) {
  if (mutation.isSuccess) {
    const { imported, skipped } = mutation.data;
    return (
      <p className="import-message">
        Imported {imported} {imported === 1 ? 'issue' : 'issues'}
        {skipped > 0 && `, skipped ${skipped} already in the log`}.
      </p>
    );
  }

  if (mutation.isError) {
    const { message, details } = mutation.error;
    return (
      <div className="error-banner import-message">
        {/* With a list of problems, the server's general message adds nothing. */}
        <p>
          Import failed, nothing was saved.{' '}
          {details.length > 0 ? 'Fix these problems and import the file again:' : message}
        </p>
        {details.length > 0 && (
          <ul>
            {details.slice(0, MAX_ERRORS_SHOWN).map((detail, index) => (
              <li key={index}>
                {detail.line ? `Line ${detail.line}, ` : ''}
                {detail.field}: {detail.message}
              </li>
            ))}
            {details.length > MAX_ERRORS_SHOWN && (
              <li>...and {details.length - MAX_ERRORS_SHOWN} more</li>
            )}
          </ul>
        )}
      </div>
    );
  }

  return null;
}
