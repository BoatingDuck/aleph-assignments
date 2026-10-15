import { randomUUID } from 'node:crypto';
import { generateRegistrationOptions, verifyRegistrationResponse,
         generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { db } from '../lib/db.mjs';
import { getConfig, randomToken, hashToken, isUuid, validLabel, parseCookies,
         requireOwnAccount } from '../lib/security.mjs';

const MAX_BODY = 40_000;
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };
const json = (res, status, data) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.end(JSON.stringify(data));
};
async function bodyOf(req) {
  const ct = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (ct !== 'application/json') fail(415, 'JSON 요청만 허용합니다.');
  if (req.body && typeof req.body === 'object') {
    if (JSON.stringify(req.body).length > MAX_BODY) fail(413,'요청이 너무 큽니다.');
    return req.body;
  }
  let text = '';
  for await (const chunk of req) {
    text += chunk.toString();
    if (text.length > MAX_BODY) fail(413, '요청이 너무 큽니다.');
  }
  try { const parsed = JSON.parse(text); if (typeof parsed !== 'object' || !parsed || Array.isArray(parsed)) throw 0; return parsed; }
  catch { fail(400,'잘못된 JSON입니다.'); }
}
function cookieName(config) { return config.secure ? '__Host-t08_session' : 't08_session'; }
function cookieLine(config, token, maxAge) {
  return `${cookieName(config)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${config.secure ? '; Secure' : ''}`;
}
async function getSession(req, sql, config) {
  const raw = parseCookies(req.headers.cookie || '')[cookieName(config)];
  if (!raw || !/^[A-Za-z0-9_-]{43}$/.test(raw)) return null;
  const [session] = await sql`
    SELECT s.account_id, a.handle, a.display_name FROM t08_sessions s
    JOIN t08_accounts a ON a.id=s.account_id
    WHERE s.token_hash=${hashToken(raw)} AND s.revoked_at IS NULL AND s.expires_at>now()`;
  return session || null;
}
function requireSession(session) { if (!session) fail(401,'패스키 로그인 후 확인할 수 있습니다.'); return session; }
async function createSession(sql, res, config, accountId) {
  const token = randomToken();
  await sql`INSERT INTO t08_sessions(token_hash,account_id,expires_at)
    VALUES (${hashToken(token)},${accountId},now() + interval '12 hours')`;
  res.setHeader('Set-Cookie',cookieLine(config, token, 12*60*60));
}
async function inviteAccount(sql, inviteToken) {
  if (!inviteToken || typeof inviteToken !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(inviteToken)) fail(403,'유효한 최초 등록 초대 링크가 필요합니다.');
  const [invite] = await sql`
    SELECT i.id AS invite_id,i.account_id,a.handle,a.display_name,a.webauthn_user_id
    FROM t08_invites i JOIN t08_accounts a ON a.id=i.account_id
    WHERE i.token_hash=${hashToken(inviteToken)} AND i.used_at IS NULL AND i.expires_at>now()`;
  if (!invite) fail(403,'초대 링크가 만료되었거나 이미 사용되었습니다.');
  return invite;
}
async function registeredKeys(sql, accountId) {
  return sql`SELECT id,account_id,public_key_b64url,counter,transports,label,created_at
    FROM t08_passkeys WHERE account_id=${accountId} ORDER BY created_at`;
}
async function ownNotes(sql, id) {
  return sql`SELECT id,title,body,created_at FROM t08_notes WHERE account_id=${id} ORDER BY created_at,id`;
}
async function registrationBegin(sql, req, session, data, config) {
  const hasInvite = typeof data.inviteToken === 'string' && data.inviteToken.length > 0;
  const invite = hasInvite ? await inviteAccount(sql, data.inviteToken) : null;
  if (!invite && !session) fail(401,'최초 초대 링크 또는 기존 패스키 로그인이 필요합니다.');
  if (invite && session && session.account_id !== invite.account_id) fail(403,'다른 계정으로 로그인 중입니다. 로그아웃 후 초대 링크를 사용하세요.');
  const accountId = invite?.account_id ?? session.account_id;
  const [account] = await sql`SELECT id,handle,display_name,webauthn_user_id FROM t08_accounts WHERE id=${accountId}`;
  const keys = await registeredKeys(sql, accountId);
  if (invite && keys.length > 0) fail(409,'기존 패스키가 있으면 로그인하여 추가 등록하세요.');
  const options = await generateRegistrationOptions({
    rpName:'EUNJI · T08 Private Room', rpID:config.id,
    userID:new Uint8Array(Buffer.from(account.webauthn_user_id,'base64url')),
    userName:account.handle, userDisplayName:account.display_name,
    attestationType:'none', timeout:60_000,
    excludeCredentials:keys.map(k=>({id:k.id,transports:k.transports})),
    authenticatorSelection:{residentKey:'required',userVerification:'required'},
    supportedAlgorithmIDs:[-7,-257]
  });
  const challengeId = randomUUID();
  await sql`INSERT INTO t08_challenges(id,account_id,kind,challenge,invite_id,expires_at)
    VALUES (${challengeId},${accountId},'register',${options.challenge},${invite?.invite_id || null},now() + interval '5 minutes')`;
  return {challengeId, options};
}
async function registrationFinish(sql, req, res, session, data, config) {
  if (!isUuid(data.challengeId)) fail(400,'등록 질문 식별자가 올바르지 않습니다.');
  const label = validLabel(data.label);
  if (!label) fail(400,'패스키 이름을 1~40자로 입력하세요.');
  if (!data.response || typeof data.response !== 'object') fail(400,'기기의 등록 응답이 없습니다.');
  const [challenge] = await sql`SELECT id,account_id,challenge,invite_id
    FROM t08_challenges WHERE id=${data.challengeId} AND kind='register'
    AND used_at IS NULL AND expires_at>now()`;
  if (!challenge) fail(409,'등록 질문이 만료되었거나 이미 사용되었습니다.');
  if (challenge.invite_id) {
    const invite = await inviteAccount(sql, data.inviteToken);
    if (invite.invite_id !== challenge.invite_id || invite.account_id !== challenge.account_id) fail(403,'초대 링크와 등록 질문의 계정이 다릅니다.');
    if (session && session.account_id !== challenge.account_id) fail(403,'다른 계정 세션입니다.');
  } else if (!requireOwnAccount(session?.account_id,challenge.account_id)) {
    fail(403,'자기 계정에만 패스키를 추가할 수 있습니다.');
  }
  let verified;
  try {
    verified = await verifyRegistrationResponse({
      response:data.response,expectedChallenge:challenge.challenge,
      expectedOrigin:config.origin,expectedRPID:config.id,requireUserVerification:true
    });
  } catch { fail(403,'패스키 등록 응답 검증에 실패했습니다.'); }
  if (!verified.verified || !verified.registrationInfo?.credential) fail(403,'등록 서명을 확인할 수 없습니다.');
  const credential = verified.registrationInfo.credential;
  const publicKey = Buffer.from(credential.publicKey).toString('base64url');
  const transports = JSON.stringify(credential.transports || []);
  let result;
  if (challenge.invite_id) {
    // Atomic claim: only the first valid invitation can register a credential.
    result = await sql`
      WITH consumed AS (
        UPDATE t08_challenges SET used_at=now() WHERE id=${challenge.id}
          AND account_id=${challenge.account_id} AND kind='register'
          AND used_at IS NULL AND expires_at>now() RETURNING account_id,invite_id
      ), invited AS (
        UPDATE t08_invites SET used_at=now()
          WHERE id=(SELECT invite_id FROM consumed) AND token_hash=${hashToken(data.inviteToken)}
          AND used_at IS NULL AND expires_at>now() RETURNING account_id
      )
      INSERT INTO t08_passkeys(id,account_id,public_key_b64url,counter,transports,label)
        SELECT ${credential.id},account_id,${publicKey},${credential.counter},${transports}::jsonb,${label} FROM invited
      ON CONFLICT(id) DO NOTHING RETURNING id,account_id`;
  } else {
    result = await sql`
      WITH consumed AS (
        UPDATE t08_challenges SET used_at=now() WHERE id=${challenge.id}
          AND account_id=${challenge.account_id} AND kind='register'
          AND used_at IS NULL AND expires_at>now() RETURNING account_id
      )
      INSERT INTO t08_passkeys(id,account_id,public_key_b64url,counter,transports,label)
        SELECT ${credential.id},account_id,${publicKey},${credential.counter},${transports}::jsonb,${label} FROM consumed
      ON CONFLICT(id) DO NOTHING RETURNING id,account_id`;
  }
  if (!result.length) fail(409,'이미 사용된 질문·초대 링크 또는 중복 패스키입니다.');
  if (challenge.invite_id) await createSession(sql,res,config,result[0].account_id);
  return {registered:true,credentialId:result[0].id,publicKeyStored:true};
}
async function loginBegin(sql, data, config) {
  if (!['owner','reviewer'].includes(data.handle)) fail(400,'실습 계정을 선택하세요.');
  const [account] = await sql`SELECT id FROM t08_accounts WHERE handle=${data.handle}`;
  if (!account) fail(404,'계정을 찾을 수 없습니다.');
  const keys = await registeredKeys(sql,account.id);
  if (!keys.length) fail(409,'이 계정에 등록된 패스키가 없습니다. 초대 링크로 최초 등록해야 합니다.');
  const options = await generateAuthenticationOptions({
    rpID:config.id,timeout:60_000,userVerification:'required',
    allowCredentials:keys.map(k=>({id:k.id,transports:k.transports}))
  });
  const challengeId = randomUUID();
  await sql`INSERT INTO t08_challenges(id,account_id,kind,challenge,expires_at)
    VALUES (${challengeId},${account.id},'authenticate',${options.challenge},now() + interval '5 minutes')`;
  return {challengeId, options};
}
async function loginFinish(sql, res, data, config) {
  if (!isUuid(data.challengeId) || !data.response?.id || typeof data.response.id !== 'string') fail(400,'로그인 응답 형식 오류');
  const [challenge] = await sql`SELECT id,account_id,challenge FROM t08_challenges
    WHERE id=${data.challengeId} AND kind='authenticate' AND used_at IS NULL AND expires_at>now()`;
  if (!challenge) fail(409,'이미 사용했거나 만료된 로그인 질문입니다.');
  const [passkey] = await sql`SELECT id,account_id,public_key_b64url,counter,transports
    FROM t08_passkeys WHERE id=${data.response.id} AND account_id=${challenge.account_id}`;
  if (!passkey) fail(403,'이 계정에 등록되지 않은 패스키입니다.');
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response:data.response,expectedChallenge:challenge.challenge,
      expectedOrigin:config.origin,expectedRPID:config.id,requireUserVerification:true,
      credential:{id:passkey.id,publicKey:new Uint8Array(Buffer.from(passkey.public_key_b64url,'base64url')),
        counter:Number(passkey.counter),transports:passkey.transports}
    });
  } catch { fail(403,'서명 또는 일회용 질문 검증에 실패했습니다.'); }
  if (!verification.verified) fail(403,'서명 검증 실패');
  const newCounter=verification.authenticationInfo.newCounter;
  const token = randomToken();
  // Only one request can consume the challenge; replay never creates a new session.
  const inserted = await sql`
    WITH consumed AS (
      UPDATE t08_challenges SET used_at=now() WHERE id=${challenge.id}
        AND account_id=${challenge.account_id} AND kind='authenticate'
        AND used_at IS NULL AND expires_at>now() RETURNING account_id
    ), updated AS (
      UPDATE t08_passkeys SET counter=${newCounter},last_used_at=now()
      WHERE id=${passkey.id} AND account_id=(SELECT account_id FROM consumed)
        AND counter<=${newCounter} RETURNING account_id
    )
    INSERT INTO t08_sessions(token_hash,account_id,expires_at)
      SELECT ${hashToken(token)},account_id,now() + interval '12 hours' FROM updated
    RETURNING account_id`;
  if (!inserted.length) fail(409,'질문 재사용 또는 서명 카운터 충돌로 거절되었습니다.');
  res.setHeader('Set-Cookie',cookieLine(config,token,12*60*60));
  return {authenticated:true};
}
async function keysForDisplay(sql, accountId) {
  const keys=await registeredKeys(sql,accountId);
  return keys.map(k=>({id:k.id,label:k.label,createdAt:k.created_at}));
}
async function deleteKey(sql, session, data) {
  requireSession(session);
  if (typeof data.id !== 'string' || data.id.length > 1024) fail(400,'패스키 식별자 오류');
  // Prevent removing the only remaining key. Another key is needed for recovery.
  const result=await sql`
    DELETE FROM t08_passkeys WHERE id=${data.id} AND account_id=${session.account_id}
      AND (SELECT count(*) FROM t08_passkeys WHERE account_id=${session.account_id}) > 1
    RETURNING id`;
  if (!result.length) fail(409,'패스키를 찾지 못했거나 마지막 남은 패스키입니다. 마지막 패스키는 삭제할 수 없습니다.');
  return {deleted:true};
}
async function logout(sql, req, res, config) {
  const token = parseCookies(req.headers.cookie || '')[cookieName(config)];
  if (token) await sql`UPDATE t08_sessions SET revoked_at=now() WHERE token_hash=${hashToken(token)} AND revoked_at IS NULL`;
  res.setHeader('Set-Cookie',cookieLine(config,'',0));
  return {loggedOut:true};
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  try {
    const config=getConfig();
    const sql=db();
    const url=new URL(req.url,config.origin);
    const action=url.searchParams.get('action');
    const method=req.method?.toUpperCase();
    if (!['GET','POST'].includes(method)) { res.setHeader('Allow','GET, POST'); fail(405,'지원하지 않는 요청입니다.'); }
    // Strict Origin + JSON protects all cookie-authenticated state mutations from CSRF.
    if (method==='POST') {
      if (req.headers.origin !== config.origin) fail(403,'외부 출처 요청은 허용하지 않습니다.');
    }
    const session=await getSession(req,sql,config);
    if (method==='GET' && action==='status') {
      const accounts=await sql`SELECT handle,display_name FROM t08_accounts ORDER BY handle`;
      return json(res,200,{signedIn:!!session,me:session?{handle:session.handle,displayName:session.display_name}:null,accounts});
    }
    if (method==='GET' && action==='passkeys') {
      requireSession(session);
      return json(res,200,{passkeys:await keysForDisplay(sql,session.account_id)});
    }
    if (method==='GET' && action==='notes') {
      requireSession(session);
      // Ignore arbitrary ?account=...: only session identity is trusted.
      return json(res,200,{owner:session.handle,items:await ownNotes(sql,session.account_id)});
    }
    if (method==='GET' && action==='account-notes') {
      requireSession(session);
      const handle=url.searchParams.get('account');
      const [target]=await sql`SELECT id FROM t08_accounts WHERE handle=${handle || ''}`;
      if (!target) fail(404,'요청한 계정이 없습니다.');
      if (!requireOwnAccount(session.account_id,target.id)) fail(403,'다른 계정의 자료는 조회할 수 없습니다.');
      return json(res,200,{owner:session.handle,items:await ownNotes(sql,session.account_id)});
    }
    if (method!=='POST') fail(404,'알 수 없는 API입니다.');
    const data=await bodyOf(req);
    if (action==='registration-options') return json(res,200,await registrationBegin(sql,req,session,data,config));
    if (action==='registration-verify') return json(res,200,await registrationFinish(sql,req,res,session,data,config));
    if (action==='authentication-options') return json(res,200,await loginBegin(sql,data,config));
    if (action==='authentication-verify') return json(res,200,await loginFinish(sql,res,data,config));
    if (action==='logout') return json(res,200,await logout(sql,req,res,config));
    if (action==='passkey-delete') return json(res,200,await deleteKey(sql,session,data));
    if (action==='notes') {
      requireSession(session);
      // Ignore attacker-supplied account in request body. Do not write notes or accept ownership from clients.
      return json(res,200,{owner:session.handle,items:await ownNotes(sql,session.account_id)});
    }
    fail(404,'알 수 없는 API입니다.');
  } catch (error) {
    if (error instanceof HttpError) return json(res,error.status,{error:error.message});
    console.error('T08 API server error:',error?.code || error?.name || 'Unknown');
    return json(res,500,{error:'서버 설정이나 데이터베이스를 확인할 수 없습니다.'});
  }
}
