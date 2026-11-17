// All SQL for issues lives here. Every value goes in as a parameter ($1, $2, ...), never by
// building SQL strings from input.

// Columns as the API returns them: snake_case in the database, camelCase in JSON.
const COLUMNS = `
  id, title, description, site, severity, status,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

// The only columns an update may touch. Column names in the UPDATE come from this list,
// never from the request.
const UPDATABLE_COLUMNS = ['title', 'description', 'site', 'severity', 'status'];

// In a LIKE pattern, % matches any text and _ matches any single character. A user who
// searches for "100%" means those characters literally, so each special character
// (and the escape character itself) gets a backslash in front of it.
export function escapeLike(text) {
  return text.replace(/[\\%_]/g, '\\$&');
}

export function createIssuesRepository(pool) {
  return {
    async create({ title, description, site, severity, status }) {
      const { rows } = await pool.query(
        `INSERT INTO issues (title, description, site, severity, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${COLUMNS}`,
        [title, description, site, severity, status],
      );
      return rows[0];
    },

    // Issues matching all the given filters, newest first. id breaks ties between issues
    // created at the same moment. Each filter that is present adds one condition and one parameter.
    async list({ search, status, severity } = {}) {
      const conditions = [];
      const values = [];

      if (search) {
        values.push(`%${escapeLike(search)}%`);
        // ILIKE is case-insensitive. ESCAPE names the character escapeLike() puts before % and _.
        conditions.push(`title ILIKE $${values.length} ESCAPE '\\'`);
      }
      if (status) {
        values.push(status);
        conditions.push(`status = $${values.length}`);
      }
      if (severity) {
        values.push(severity);
        conditions.push(`severity = $${values.length}`);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const { rows } = await pool.query(
        `SELECT ${COLUMNS}
         FROM issues
         ${where}
         ORDER BY created_at DESC, id DESC`,
        values,
      );
      return rows;
    },

    // Returns the issue, or undefined if there is none with this id.
    async findById(id) {
      const { rows } = await pool.query(`SELECT ${COLUMNS} FROM issues WHERE id = $1`, [id]);
      return rows[0];
    },

    // Updates only the fields present in `changes`. Returns the updated issue, or undefined
    // if there is none with this id. updated_at is set by the database trigger.
    async update(id, changes) {
      const columns = UPDATABLE_COLUMNS.filter((column) => changes[column] !== undefined);
      // "title = $1, status = $2", with the id as the last parameter.
      const assignments = columns.map((column, index) => `${column} = $${index + 1}`);
      const values = columns.map((column) => changes[column]);

      const { rows } = await pool.query(
        `UPDATE issues
         SET ${assignments.join(', ')}
         WHERE id = $${columns.length + 1}
         RETURNING ${COLUMNS}`,
        [...values, id],
      );
      return rows[0];
    },

    // Returns true if an issue was deleted, false if there was none with this id.
    async remove(id) {
      const { rowCount } = await pool.query('DELETE FROM issues WHERE id = $1', [id]);
      return rowCount > 0;
    },
  };
}
