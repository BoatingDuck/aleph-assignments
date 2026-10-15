import { db } from '../lib/db.mjs';
const sql = db();
const rows = await sql`SELECT a.handle,p.label,p.public_key_b64url,p.created_at
 FROM t08_passkeys p JOIN t08_accounts a ON a.id=p.account_id ORDER BY a.handle,p.created_at`;
if (!rows.length) console.log('등록된 패스키가 없습니다.');
for (const row of rows) {
  console.log(JSON.stringify({account:row.handle,label:row.label,createdAt:row.created_at,
    publicKeyBase64url:row.public_key_b64url,explanation:'COSE 형식 공개키 인코딩; 개인키 및 비밀번호 저장 없음'},null,2));
}
