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
    // Git on Windows may check out the original T01 file with CRLF.
    // Compare normalized LF content with the original Git blob, without changing the public files.
    const content=Buffer.from(read(file).replace(/\r\n/g,'\n'));
    return createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${content.length}\0`),content])).digest('hex');
  }
  assert.equal(gitBlob('public/script.js'),'de80225d7575191469995443d28ec8ec204c1f79');
  assert.equal(gitBlob('public/style.css'),'c5142b572e26482e84e3706b8df5b537fe79f8b3');
});

test('interactive visual refresh is additive and does not change original T01 assets',()=>{
  const html=read('public/index.html');
  assert.ok(html.includes('href="design.css"'));
  assert.ok(html.includes('src="design-motion.js"'));
  assert.ok(html.includes('src="passkey-client.js"'));
  const sync=read('scripts/sync-t01.mjs');
  assert.ok(sync.includes('design.css') && sync.includes('design-motion.js'));
  const motion=read('public/design-motion.js');
  assert.ok(motion.includes('prefers-reduced-motion: reduce'));
  assert.ok(motion.includes('t08-context-note'));
  assert.ok(motion.includes('summary-text'));
  const css=read('public/design.css');
  assert.ok(css.includes('.strength-list'));
  assert.ok(css.includes('@media(max-width:760px)'));
});

test('v6 centered hero uses additive motion, without weakening reduced-motion or private API boundaries',()=>{
  const css=read('public/design.css');
  const motion=read('public/design-motion.js');
  const sync=read('scripts/sync-t01.mjs');
  for(const token of ['.t08-title-line','.t08-reading-progress','.t08-ambient','.overview-list','prefers-reduced-motion:reduce'])
    assert.ok(css.includes(token),token);
  for(const token of ['t08-title-line','requestAnimationFrame','pointermove','prefers-reduced-motion: reduce','t08-context-note'])
    assert.ok(motion.includes(token),token);
  assert.ok(sync.includes('design-motion.js') && sync.includes('design.css'));
  assert.ok(!motion.includes('DATABASE_URL'));
  assert.ok(!motion.includes('fetch('));
});


test('v7 experience headings wrap naturally and keep original wording',()=>{
  const html=read('public/index.html');
  const headings=[...html.matchAll(/<article class="strength"[\s\S]*?<h3>([\s\S]*?)<\/h3>/g)].map(m=>m[1]);
  assert.equal(headings.length,3);
  assert.ok(headings.every(text=>!/<br\s*\/?>/i.test(text)));
  assert.ok(headings[0].includes('각자의 속도를 이해하고, 같은 목표로 나아갑니다.'));
  assert.ok(headings[1].includes('실험을 설계하고, 결과를 기록으로 남깁니다.'));
  assert.ok(headings[2].includes('모르는 지점을 인정하고, ‘왜’를 끝까지 묻습니다.'));
});

test('v7 steady hover, equal overview padding, sans-serif numbered labels',()=>{
  const css=read('public/design.css');
  assert.ok(css.includes('T08 v7 — deliberate, smooth motion'));
  assert.match(css,/\.project:hover[^}]*padding-left:clamp\(23px,3\.1vw,38px\)/s);
  assert.match(css,/\.overview-list a\{[^}]*min-height:0;[^}]*padding:12px 15px;/s);
  assert.match(css,/\.number,\.strength \.number\{[^}]*font-size:17px;/s);
  assert.match(css,/\.strength h3\{[^}]*margin:5px 0 0;/s);
  const motion=read('public/design-motion.js');
  assert.ok(motion.includes("querySelectorAll('br')"));
  assert.ok(motion.includes('spot.targetX-spot.x'));
});


test('expanded experience detail spans center and right without editing the original T01 source',()=>{
  const motion=read('public/design-motion.js');
  const css=read('public/design.css');
  assert.ok(motion.includes('story.parentElement !== strength'));
  assert.ok(motion.includes('strength.append(story)'));
  assert.match(css,/\.strength > \.story\{grid-column:2 \/ -1;grid-row:2/);
  assert.match(css,/\.strength > \.story dl\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/s);
  assert.match(css,/max-width:760px[\s\S]*?\.strength > \.story dl\{display:block;/);
});
