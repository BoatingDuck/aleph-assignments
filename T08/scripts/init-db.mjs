import { readFileSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import { db } from '../lib/db.mjs';
const sql = db();
const ddl = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
// DDL contains no user input. SQL is only initialized here (not per HTTP request).
for (const statement of ddl.split(';').map(x => x.trim()).filter(Boolean)) await sql.query(statement);
const accounts = [
  ['owner', '나의 실습 계정', [
    ['준비 중인 프로젝트', '가상 프로젝트 A: 인증 흐름을 정리하는 개인 메모입니다.'],
    ['지원 예정 목록', '가상 기관 B와 가상 회사 C를 검토하는 예시입니다.'],
    ['오늘의 회고', '실패 응답을 먼저 검증하고 기능을 마무리했습니다.']
  ]],
  ['reviewer', '검증용 두 번째 계정', [
    ['검증 프로젝트', '가상 프로젝트 X: 두 계정의 격리를 확인하는 메모입니다.'],
    ['가상 지원 목록', '가상 기관 Y를 살펴본다는 시험 문장입니다.'],
    ['검증 회고', '상대 계정 자료는 접근할 수 없어야 합니다.']
  ]]
];
for (const [handle, displayName, notes] of accounts) {
  const id = randomUUID();
  const uid = randomBytes(32).toString('base64url');
  await sql`INSERT INTO t08_accounts(id, handle, display_name, webauthn_user_id)
    VALUES (${id}, ${handle}, ${displayName}, ${uid}) ON CONFLICT(handle) DO NOTHING`;
  const [account] = await sql`SELECT id FROM t08_accounts WHERE handle=${handle}`;
  const [count] = await sql`SELECT count(*)::int AS total FROM t08_notes WHERE account_id=${account.id}`;
  if (count.total === 0) {
    for (const [title, body] of notes) {
      await sql`INSERT INTO t08_notes(id,account_id,title,body) VALUES (${randomUUID()},${account.id},${title},${body})`;
    }
  }
}
console.log('스키마 및 가상 계정 2개 초기화 완료. 실제 개인 메모는 넣지 않았습니다.');
