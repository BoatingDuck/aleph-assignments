import fs from "node:fs/promises";
import process, { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env.local");
} catch {}

import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    "DATABASE_URL이 없습니다. .env.local 또는 실행 환경의 DATABASE_URL을 확인하세요."
  );
  process.exit(1);
}

const schema = await fs.readFile(
  new URL("./schema.sql", import.meta.url),
  "utf8"
);

const sql = neon(databaseUrl);

const statements = schema
  .split(/;\s*(?:\r?\n|$)/)
  .map((value) => value.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
}

console.log(`T07 데이터베이스 스키마 적용 완료 (${statements.length} statements)`);
