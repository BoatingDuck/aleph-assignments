import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('phone pairing uses two different server-only hashed secrets',()=>{
 const api=read('api/index.js');
 const schema=read('scripts/schema.sql');
 assert.match(schema,/CREATE TABLE IF NOT EXISTS t08_phone_logins/);
 assert.match(schema,/pc_token_hash TEXT NOT NULL UNIQUE/);
 assert.match(schema,/phone_token_hash TEXT NOT NULL UNIQUE/);
 assert.match(schema,/approved_at TIMESTAMPTZ/);
 assert.match(schema,/consumed_at TIMESTAMPTZ/);
 assert.match(schema,/ALTER TABLE public.t08_phone_logins ENABLE ROW LEVEL SECURITY/);
 assert.match(schema,/public.t08_phone_logins FROM anon, authenticated/);
 assert.match(api,/hashToken\(pcToken\)/);
 assert.match(api,/hashToken\(phoneToken\)/);
 assert.match(api,/HttpOnly; SameSite=Strict/);
 assert.match(api,/now\(\)\+interval '3 minutes'/);
});

test('phone signing does not bypass WebAuthn verification or provide session cookie',()=>{
 const api=read('api/index.js');
 assert.match(api,/async function approvePhoneLogin/);
 assert.match(api,/return loginFinish\(sql,res,data,config,pair\)/);
 assert.match(api,/verifyAuthenticationResponse/);
 assert.match(api,/expectedOrigin:config.origin,expectedRPID:config.id,requireUserVerification:true/);
 const branch=api.split('if (approvedPair) {')[1].split('const token = randomToken();')[0];
 assert.match(branch,/UPDATE t08_challenges SET used_at=now\(\)/);
 assert.match(branch,/UPDATE t08_passkeys SET counter=/);
 assert.match(branch,/UPDATE t08_phone_logins SET approved_at=now\(\)/);
 assert.doesNotMatch(branch,/Set-Cookie/);
});

test('PC alone can atomically consume phone approval and receive login cookie',()=>{
 const api=read('api/index.js');
 const claim=api.split('async function pollPhoneLogin')[1].split('async function cancelPhoneLogin')[0];
 assert.match(claim,/pc_token_hash=\$\{hashToken\(pcToken\)\}/);
 assert.match(claim,/consumed_at IS NULL/);
 assert.match(claim,/UPDATE t08_phone_logins SET consumed_at=now\(\)/);
 assert.match(claim,/INSERT INTO t08_sessions/);
 assert.match(claim,/cookieLine\(config,token,12\*60\*60\)/);
 assert.match(claim,/phoneCookieLine\(config,'',0\)/);
});

test('QR stays inside browser and account-specific challenge is signed on phone',()=>{
 const browser=read('src/passkey-client.js');
 assert.match(browser,/QRCode.toDataURL\(link/);
 assert.match(browser,/#phone=/);
 assert.match(browser,/history.replaceState/);
 assert.match(browser,/request\('phone-prepare'/);
 assert.match(browser,/startAuthentication\(\{optionsJSON:options\}\)/);
 assert.match(browser,/request\('phone-approve'/);
 assert.match(browser,/request\('phone-poll'/);
 assert.doesNotMatch(browser,/privateKey/);
 assert.match(read('snippets/private-room.html'),/USB 보안키 선택창을 사용하지 않습니다/);
});

