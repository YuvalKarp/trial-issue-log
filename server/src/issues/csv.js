import { parse as parseCsv } from 'csv-parse/sync';
import { ValidationError } from '../errors.js';
import { IMPORT_COLUMNS } from './schema.js';

// Turns the text of a CSV file into one object per data row, each with the line it came from:
//   [{ line: 2, values: { title: '...', ..., createdAt: '...' } }, ...]
// Problems with the file as a whole (headers, broken quoting, a row with the wrong number of
// cells) throw a ValidationError. Checking the values in each row is not done here.
export function parseIssuesCsv(text) {
  let records;
  try {
    records = parseCsv(text, {
      bom: true, // Excel adds an invisible byte-order mark at the start of the file
      trim: true, // spaces around a cell are ignored
      skip_empty_lines: true,
      info: true, // adds the line number of each row, used in error messages
      // Cell counts are checked below, after the headers, so that a file with a wrong
      // header row is reported as that and not as "wrong number of cells on line 2".
      relax_column_count: true,
    });
  } catch (err) {
    // csv-parse errors carry the line, e.g. "Invalid Record Length: ... on line 3".
    throw new ValidationError([{ field: 'file', message: err.message }]);
  }

  if (records.length === 0) {
    throw new ValidationError([{ field: 'file', message: 'The file is empty' }]);
  }

  const [headerRecord, ...rows] = records;
  const headers = headerRecord.record;
  checkHeaders(headers);

  if (rows.length === 0) {
    throw new ValidationError([{ field: 'file', message: 'The file has a header row but no issues' }]);
  }

  const badLength = rows.filter(({ record }) => record.length !== headers.length);
  if (badLength.length) {
    throw new ValidationError(
      badLength.map(({ record, info }) => ({
        line: info.lines,
        field: 'file',
        message: `Expected ${headers.length} cells, found ${record.length}`,
      })),
    );
  }

  return rows.map(({ record, info }) => ({
    line: info.lines,
    values: Object.fromEntries(headers.map((header, index) => [header, record[index]])),
  }));
}

// The header row must hold exactly the expected columns, in any order. A missing, unknown or
// repeated column is reported before any row is looked at.
function checkHeaders(headers) {
  const problems = [];
  const missing = IMPORT_COLUMNS.filter((column) => !headers.includes(column));
  const unknown = headers.filter((header) => !IMPORT_COLUMNS.includes(header));
  const repeated = headers.filter((header, index) => headers.indexOf(header) !== index);

  if (missing.length) problems.push(`missing: ${missing.join(', ')}`);
  if (unknown.length) problems.push(`unknown: ${unknown.join(', ')}`);
  if (repeated.length) problems.push(`repeated: ${[...new Set(repeated)].join(', ')}`);

  if (problems.length) {
    throw new ValidationError([
      {
        field: 'headers',
        message: `Header row must be ${IMPORT_COLUMNS.join(',')} (${problems.join('; ')})`,
      },
    ]);
  }
}
