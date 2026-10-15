import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('public T01 areas and locked T08 area are separate',()=>{
 const html=read('public/index.html');
 for(const s of ['id="home"','id="about"','id="work"','id="scope"','id="private-room"']) assert.ok(html.includes(s),s);
 assert.ok(html.includes('passkey-client.js'));
});
test('real private note text is absent from public document and JavaScript',()=>{
 const publicFiles=['public/index.html','public/script.js','src/passkey-client.js','public/style.css','public/passkey.css'];
 const secrets=['가상 프로젝트 A: 인증 흐름을 정리','가상 프로젝트 X: 두 계정의 격리를','가상 기관 Y를 살펴본다는 시험'];
 for(const filename of publicFiles) {
  const text=read(filename); for(const value of secrets) assert.ok(!text.includes(value),`${filename} contains mock private content`);
 }
});
test('no password field and server-side WebAuthn verification is wired',()=>{
 const html=read('public/index.html');
 assert.ok(!/type=["']password["']/i.test(html));
 const server=read('api/index.js');
 for(const symbol of ['verifyRegistrationResponse','verifyAuthenticationResponse','expectedChallenge','expectedOrigin','expectedRPID','action===\'notes\'','action===\'account-notes\'','revoked_at']) assert.ok(server.includes(symbol),symbol);
});
test('two mock accounts have three different notes in database initialization',()=>{
 const script=read('scripts/init-db.mjs');
 assert.ok(script.includes("'owner'"));assert.ok(script.includes("'reviewer'"));
 assert.ok(script.includes('준비 중인 프로젝트'));assert.ok(script.includes('검증 프로젝트'));
});

test('registration explicitly requires a passkey-style discoverable credential',()=>{
  const server=read('api/index.js');
  assert.ok(server.includes("residentKey:'required',userVerification:'required'"));
  assert.ok(server.includes('excludeCredentials:keys.map'));
});
test('challenge consumption is atomic in the authentication flow',()=>{
  const server=read('api/index.js');
  assert.match(server,/UPDATE t08_challenges SET used_at=now\(\).*?used_at IS NULL AND expires_at>now\(\) RETURNING account_id/s);
  assert.ok(server.includes('INSERT INTO t08_sessions'));
  assert.ok(server.includes('verifyAuthenticationResponse'));
});
test('old T01 script and stylesheet are included without alterations',()=>{
  function gitBlob(file) {
    const content=Buffer.from(read(file).replace(/\r\n/g, '\n'));
    return createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${content.length}\0`),content])).digest('hex');
  }
  assert.equal(gitBlob('public/script.js'),'de80225d7575191469995443d28ec8ec204c1f79');
  assert.equal(gitBlob('public/style.css'),'c5142b572e26482e84e3706b8df5b537fe79f8b3');
});
