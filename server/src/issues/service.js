import { ValidationError } from '../errors.js';
import { parseIssuesCsv } from './csv.js';
import { importRowSchema } from './schema.js';

// Business logic that is more than one repository call. For now, only the CSV import.
export function createIssuesService(repository) {
  return {
    // Imports a CSV file all-or-nothing: if any row is invalid, nothing is saved and every
    // problem is reported with its line number. A row that matches an issue already in the
    // database (same title, site and createdAt), or an earlier row in the same file, is skipped,
    // so importing the same file twice does not create duplicates.
    // Returns { imported, skipped }.
    async importCsv(text) {
      const rows = parseIssuesCsv(text);

      const errors = [];
      const issues = [];
      for (const { line, values } of rows) {
        const result = importRowSchema.safeParse(values);
        if (result.success) {
          issues.push(result.data);
        } else {
          for (const issue of result.error.issues) {
            errors.push({ line, field: issue.path.join('.'), message: issue.message });
          }
        }
      }
      if (errors.length) throw new ValidationError(errors);

      // Duplicates inside the file itself. The time is compared as a moment, so
      // 09:00:00Z and 12:00:00+03:00 count as the same.
      const seen = new Set();
      const unique = issues.filter((issue) => {
        const key = JSON.stringify([issue.title, issue.site, new Date(issue.createdAt).getTime()]);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Duplicates of issues already in the database are skipped by the insert itself.
      const imported = await repository.insertManySkippingExisting(unique);
      return { imported, skipped: issues.length - imported };
    },
  };
}
