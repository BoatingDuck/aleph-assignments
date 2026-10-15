import { neon } from '@neondatabase/serverless';
let client;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL이 설정되지 않았습니다.');
  if (!client) client = neon(process.env.DATABASE_URL);
  return client;
}
