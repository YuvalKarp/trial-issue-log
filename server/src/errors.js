// Thrown when request input fails validation. The error handler in app.js turns it into a 400.
export class ValidationError extends Error {
  constructor(details) {
    super('Request validation failed');
    this.details = details;
  }
}

// Thrown when the requested record does not exist. The error handler turns it into a 404.
export class NotFoundError extends Error {}

// Validates `data` against a Zod schema. Returns the cleaned data (trimmed, with defaults applied)
// or throws a ValidationError listing every problem as { field, message }.
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const details = result.error.issues.map((issue) => ({
    // A problem with the body as a whole (not an object, unknown key) has an empty path.
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }));
  throw new ValidationError(details);
}
