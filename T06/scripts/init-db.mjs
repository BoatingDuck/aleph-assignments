import fs from "node:fs/promises";
import process, { loadEnvFile } from "node:process";

try { loadEnvFile(".env.local"); } catch {}
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL이 없습니다. PowerShell 예: $env:DATABASE_URL='postgresql://...'");
  process.exit(1);
}

const schema = await fs.readFile(new URL("./schema.sql", import.meta.url), "utf8");
const sql = neon(databaseUrl);

for (const statement of schema
  .split(/;\s*(?:\r?\n|$)/)
  .map((value) => value.trim())
  .filter(Boolean)) {
  await sql.query(statement);
}

console.log("PDS 데이터베이스 초기화 완료");
