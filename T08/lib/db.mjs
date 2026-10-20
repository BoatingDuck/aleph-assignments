// Supabase PostgreSQL is accessed only from the server, never from the browser.
// node-postgres uses parameterized, unnamed queries and does not depend on
// prepared statements that Supabase's transaction pooler cannot support.
import pg from 'pg';

const { Pool } = pg;
let sqlClient;

export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL이 설정되지 않았습니다.');
  if (!sqlClient) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: true },
      max: 1,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 20_000,
    });
    // Preserve the tagged-template interface used throughout the existing T08
    // WebAuthn API, while parameterizing every interpolated value.
    const sql = (parts, ...values) => {
      if (!Array.isArray(parts) || parts.length !== values.length + 1) {
        throw new TypeError('SQL 태그 형식이 올바르지 않습니다.');
      }
      let text = parts[0];
      for (let i = 0; i < values.length; i++) text += `$${i + 1}${parts[i + 1]}`;
      return pool.query(text, values).then(result => result.rows);
    };
    // Used only by scripts/init-db.mjs for trusted, static schema.sql text.
    sql.query = (statement) => pool.query(statement).then(result => result.rows);
    sqlClient = sql;
  }
  return sqlClient;
}
