import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';

const [file] = process.argv.slice(2);
if (!file) throw new Error('Usage: node scripts/import-real-records.mjs <t04-real-records.json>');
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in your local environment before importing.');

const exported = JSON.parse(await readFile(file, 'utf8'));
if (exported.mode !== 'live' || exported.timezone !== 'Asia/Seoul' || !Array.isArray(exported.daily_readings)) {
  throw new Error('Choose the live actual-record JSON export from the information board.');
}
if (exported.daily_readings.length > 2) throw new Error('This project preserves at most two actual daily records.');
for (const row of exported.daily_readings) {
  if (row.reading?.record_timezone !== 'Asia/Seoul' || !/^\d{4}-\d{2}-\d{2}$/.test(row.record_date)) {
    throw new Error('The export contains an invalid or non-KST daily record.');
  }
}

const sql = neon(process.env.DATABASE_URL);
await sql`CREATE TABLE IF NOT EXISTS daily_observations (
  id text PRIMARY KEY,
  date text NOT NULL UNIQUE,
  row jsonb NOT NULL,
  raw jsonb NOT NULL,
  locked boolean NOT NULL DEFAULT false
)`;
await sql`CREATE TABLE IF NOT EXISTS board_observations (
  id text PRIMARY KEY,
  state jsonb NOT NULL
)`;

const statements = exported.daily_readings.map(({ raw, locked, ...row }) => sql`
  INSERT INTO daily_observations (id, date, row, raw, locked)
  VALUES (${row.record_id}, ${row.record_date}, ${JSON.stringify(row)}::jsonb, ${JSON.stringify(raw ?? null)}::jsonb, ${Boolean(locked)})
  ON CONFLICT (date) DO UPDATE SET row = EXCLUDED.row, raw = EXCLUDED.raw, locked = EXCLUDED.locked
`);
if (statements.length) await sql.transaction(statements);
if (exported.daily_readings.length) {
  await sql`INSERT INTO board_observations (id, state) VALUES ('live', ${JSON.stringify(exported)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state`;
}
console.log(`Imported ${exported.daily_readings.length} actual daily record(s).`);
