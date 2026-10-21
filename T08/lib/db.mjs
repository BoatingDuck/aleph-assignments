// Supabase PostgreSQL is accessed only from the server, never from the browser.
// node-postgres uses parameterized, unnamed queries and does not depend on
// prepared statements that Supabase's transaction pooler cannot support.
import pg from 'pg';

const { Pool } = pg;
let sqlClient;

function connectionConfig() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL이 설정되지 않았습니다.');

  // pg-connection-string replaces the explicit ssl object if sslmode (or
  // related SSL URL options) is present. Keep TLS configuration in ONE place.
  // TLS and hostname verification are enforced by the ssl options below.
  const uri = new URL(process.env.DATABASE_URL);
  for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert']) {
    uri.searchParams.delete(key);
  }

  const ssl = { rejectUnauthorized: true };
  const encodedCa = process.env.SUPABASE_DB_CA_B64?.trim();
  if (encodedCa) {
    const ca = Buffer.from(encodedCa, 'base64').toString('utf8').trim();
    if (!ca.includes('-----BEGIN CERTIFICATE-----') ||
      !ca.includes('-----END CERTIFICATE-----')) {
      throw new Error('SUPABASE_DB_CA_B64 인증서 형식이 올바르지 않습니다.');
    }
    // The CA is a public trust certificate, NOT a DB password or private key.
    ssl.ca = ca;
  }

  return { connectionString: uri.toString(), ssl };
}

export function db() {
  if (!sqlClient) {
    const pool = new Pool({
      ...connectionConfig(),
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
