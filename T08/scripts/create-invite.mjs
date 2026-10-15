import { randomUUID } from 'node:crypto';
import { db } from '../lib/db.mjs';
import { getConfig, randomToken, hashToken } from '../lib/security.mjs';
const handle = process.argv[2];
if (!['owner','reviewer'].includes(handle)) throw new Error('사용법: node scripts/create-invite.mjs owner|reviewer');
const config = getConfig();
const sql = db();
const [account] = await sql`SELECT id FROM t08_accounts WHERE handle=${handle}`;
if (!account) throw new Error('먼저 npm run db:init 실행');
const [count] = await sql`SELECT count(*)::int AS total FROM t08_passkeys WHERE account_id=${account.id}`;
if (count.total > 0) throw new Error('이미 패스키가 있습니다. 추가 패스키는 로그인 후 등록하세요.');
const token = randomToken();
// Invalidate any older invitations; the single current link lasts 10 minutes.
await sql`UPDATE t08_invites SET used_at=now() WHERE account_id=${account.id} AND used_at IS NULL`;
await sql`INSERT INTO t08_invites(id, account_id, token_hash, expires_at)
  VALUES (${randomUUID()},${account.id},${hashToken(token)},now() + interval '10 minutes')`;
console.log(`계정: ${handle}\n10분 만료 · 최초 1회 등록 전용 링크:\n${config.origin}/#invite=${token}`);
console.log('이 링크를 GitHub, 제출물, 채팅 로그에 올리지 마세요. 비밀번호가 아닌 일회용 등록 초대권입니다.');
