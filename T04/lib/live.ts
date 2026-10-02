import { neon } from '@neondatabase/serverless';
import { resetEvaluationState, applySuccessfulReading, applyError, kstDate } from './reading';
import { KMA_SOURCE, parseKmaObservation } from './kma';

type NeonSql = ReturnType<typeof neon>;
let client: NeonSql | undefined;
let schemaReady: Promise<void> | undefined;

export function database(): NeonSql {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('storage_unavailable');
  client ??= neon(connectionString);
  return client;
}

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = database();
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
    })().catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  }
  await schemaReady;
}

function decodeJson(value: unknown): any {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

export async function load() {
  await ensureSchema();
  const sql = database();
  const rows = (await sql`SELECT row, raw, locked FROM daily_observations ORDER BY date`) as any[];
  const savedRows = rows.map((item: any) => ({
    row: decodeJson(item.row),
    raw: decodeJson(item.raw),
    locked: item.locked,
  }));
  const savedStates = (await sql`SELECT state FROM board_observations WHERE id = 'live' LIMIT 1`) as any[];

  let state: any = resetEvaluationState();
  for (const item of savedRows) state = applySuccessfulReading(state, item.row.reading);
  if (savedStates[0]) {
    const previous = decodeJson(savedStates[0].state);
    state.status = previous.status;
    state.last_run = previous.last_run;
    state.sequence = previous.sequence;
  }
  state.daily_readings = savedRows.map((item) => ({
    ...item.row,
    raw: item.raw,
    locked: Boolean(item.locked),
  }));
  return state;
}

export async function lockRecord(date: string) {
  await ensureSchema();
  await database()`UPDATE daily_observations SET locked = true WHERE date = ${date}`;
  return load();
}

export async function refresh() {
  await ensureSchema();
  const before = await load();
  const today = kstDate(new Date().toISOString());
  if (before.daily_readings.length >= 2 && !before.daily_readings.some((r: any) => r.record_date === today)) {
    return { ...before, notice: '실제 두 날짜의 관측 기록을 확보했습니다. 제출용 두 기록을 보존합니다.' };
  }
  if (before.daily_readings.some((r: any) => r.record_date === today && r.locked)) {
    return { ...before, notice: '오늘 관측 기록이 확정되어 있습니다. 다음 KST 날짜에 다시 조회해 주세요.' };
  }

  let code = 'offline';
  let next: any;
  let observed: any;
  try {
    const response = await fetch(KMA_SOURCE, {
      signal: AbortSignal.timeout(12000),
      cache: 'no-store',
      headers: { Accept: 'text/html', 'User-Agent': 'AutumnSignal/1.0 (public weather observation board)' },
    });
    if (!response.ok) {
      code = response.status === 401 || response.status === 403 ? 'auth' : response.status === 429 ? 'rate_limit' : 'schema_error';
      throw new Error(code);
    }
    code = 'schema_error';
    observed = parseKmaObservation(await response.text());
    const fetched = new Date().toISOString();
    const age = Date.parse(fetched) - Date.parse(observed.observed);
    if (age < -5 * 60000 || age > 120 * 60000) throw new Error('schema_error');
    const reading = {
      signal_id: 'kma-daejeon-133-temperature',
      normalized_value: observed.value,
      unit: '°C',
      source_name: '기상청 날씨누리 · 대전 관측소(133)',
      source_url: observed.sourceUrl,
      source_time: observed.observed,
      fetched_at: fetched,
      record_timezone: 'Asia/Seoul',
      record_date: kstDate(fetched),
    };
    next = applySuccessfulReading(before, reading);
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) code = 'timeout';
    next = applyError(before, code);
  }

  const sql = database();
  if (next.status.freshness === 'fresh') {
    const row = next.daily_readings.find((item: any) => item.record_date === next.current_reading.record_date);
    const statements = [
      sql`INSERT INTO daily_observations (id, date, row, raw, locked)
        SELECT ${row.record_id}, ${row.record_date}, ${JSON.stringify(row)}::jsonb, ${JSON.stringify(observed.raw)}::jsonb, false
        WHERE (SELECT COUNT(*) FROM daily_observations) < 2
          OR EXISTS (SELECT 1 FROM daily_observations WHERE date = ${row.record_date})
        ON CONFLICT (date) DO UPDATE SET row = EXCLUDED.row, raw = EXCLUDED.raw
        WHERE daily_observations.locked = false`,
      sql`INSERT INTO board_observations (id, state) VALUES ('live', ${JSON.stringify(next)}::jsonb)
        ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state`,
    ];
    await sql.transaction(statements);
  } else {
    await sql`INSERT INTO board_observations (id, state) VALUES ('live', ${JSON.stringify(next)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state`;
  }
  return load();
}
