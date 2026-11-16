// All SQL for issues lives here. Every value goes in as a parameter ($1, $2, ...), never by
// building SQL strings from input.

// Columns as the API returns them: snake_case in the database, camelCase in JSON.
const COLUMNS = `
  id, title, description, site, severity, status,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

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

    // Newest first. id breaks ties between issues created at the same moment.
    async list() {
      const { rows } = await pool.query(
        `SELECT ${COLUMNS}
         FROM issues
         ORDER BY created_at DESC, id DESC`,
      );
      return rows;
    },
  };
}
