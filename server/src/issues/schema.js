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

// Query string of GET /api/issues. All filters are optional and combine with AND.
// An empty search (?search=) means "no search". Unknown parameters are rejected, so a
// misspelled filter name is an error rather than a filter that silently does nothing.
export const listIssuesQuerySchema = z.strictObject({
  search: z
    .string({ error: 'Search must be a single text value' })
    .trim()
    .max(200, 'Search must be at most 200 characters')
    .transform((text) => text || undefined)
    .optional(),
  status: fields.status.optional(),
  severity: fields.severity.optional(),
});

// One row of an imported CSV file. The same fields as a regular create, except that status
// is required and createdAt comes from the file. createdAt must be an ISO 8601 date-time with
// a time zone (2025-05-01T09:00:00Z): without one, the same text means different moments
// in different places. A date in the future cannot be when an issue was found.
export const IMPORT_COLUMNS = ['title', 'description', 'site', 'severity', 'status', 'createdAt'];
export const importRowSchema = z.strictObject({
  ...fields,
  createdAt: z.iso
    .datetime({
      offset: true,
      error: 'createdAt must be an ISO 8601 date-time with a time zone, e.g. 2025-05-01T09:00:00Z',
    })
    .refine((value) => new Date(value) <= new Date(), { message: 'createdAt cannot be in the future' }),
});

// Query string of GET /api/issues/stats: no parameters are accepted.
export const statsQuerySchema = z.strictObject({});

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
