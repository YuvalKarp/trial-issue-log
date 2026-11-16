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

// The fields a client may set, shared by create and update.
const fields = {
  title: requiredText('Title', 200),
  description: requiredText('Description', 5000),
  site: requiredText('Site', 100),
  severity: z.enum(SEVERITIES, { error: `Severity must be one of: ${SEVERITIES.join(', ')}` }),
  status: z.enum(STATUSES, { error: `Status must be one of: ${STATUSES.join(', ')}` }),
};

// Body of POST /api/issues. strictObject rejects unknown keys, so a typo in a field name
// is reported as an error instead of being silently ignored.
export const createIssueSchema = z.strictObject({
  ...fields,
  status: fields.status.default('open'),
});

// Body of PATCH /api/issues/:id. Every field is optional, but at least one must be present.
// strictObject also means id, createdAt and updatedAt cannot be changed by a client.
export const updateIssueSchema = z
  .strictObject({
    title: fields.title.optional(),
    description: fields.description.optional(),
    site: fields.site.optional(),
    severity: fields.severity.optional(),
    status: fields.status.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field is required' });

// The :id in the URL. It arrives as a string; only a positive integer that fits the
// database column is accepted, so "abc" or "stats" is a 400 and never reaches SQL.
const MAX_ID = 2147483647;
export const issueParamsSchema = z.object({
  id: z
    .string()
    .regex(/^[1-9]\d{0,9}$/, 'Issue id must be a positive integer')
    .transform(Number)
    .refine((id) => id <= MAX_ID, { message: 'Issue id must be a positive integer' }),
});
