import { z } from 'zod';

// The allowed values. The database enforces the same lists with CHECK constraints.
export const SEVERITIES = ['minor', 'major', 'critical'];
export const STATUSES = ['open', 'in_progress', 'resolved'];

// A required text field: surrounding whitespace is trimmed, and blank counts as missing.
const requiredText = (label, max) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`);

// Body of POST /api/issues. strictObject rejects unknown keys, so a typo in a field name
// is reported as an error instead of being silently ignored.
export const createIssueSchema = z.strictObject({
  title: requiredText('Title', 200),
  description: requiredText('Description', 5000),
  site: requiredText('Site', 100),
  severity: z.enum(SEVERITIES, { error: `Severity must be one of: ${SEVERITIES.join(', ')}` }),
  status: z
    .enum(STATUSES, { error: `Status must be one of: ${STATUSES.join(', ')}` })
    .default('open'),
});
