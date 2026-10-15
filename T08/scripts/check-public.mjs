// Only tests requests possible without a real user's passkey. Never fabricates a WebAuthn success.
import { writeFileSync,mkdirSync } from 'node:fs';
const base = (process.env.SITE_URL || process.env.RP_ORIGIN || '').replace(/\/$/,'');
if (!base) throw new Error('SITE_URL=https://... 환경변수가 필요합니다.');
const checks=[];
const check = async (name,path,init,expected) => {
  const response=await fetch(`${base}${path}`,init);
  const text=await response.text();
  const passed=response.status===expected;
  checks.push({name,method:init?.method || 'GET',path,status:response.status,expected,passed,
    responseExcerpt:text.slice(0,220)});
  console.log(`${passed?'PASS':'FAIL'} ${name}: ${response.status} (expected ${expected})`);
};
const post=(body)=>({method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)});
await check('공개 첫 화면','/',undefined,200);
await check('무인증 내 기록 거절','/api?action=notes',undefined,401);
await check('무인증 특정 계정 거절','/api?action=account-notes&account=owner',undefined,401);
await check('무인증 POST 기록 거절','/api?action=notes',post({account:'owner'}),401);
await check('초대 없는 등록 거절','/api?action=registration-options',post({}),401);
await check('위조 초대 등록 거절','/api?action=registration-options',post({inviteToken:'a'.repeat(43)}),403);
const html=await (await fetch(`${base}/`,{cache:'no-store'})).text();
const publicLeaks=['가상 프로젝트 A: 인증 흐름','가상 프로젝트 X: 두 계정','가상 기관 Y를 살펴본다는'];
checks.push({name:'HTML 원문에 비공개 데이터 없음',passed:publicLeaks.every(x=>!html.includes(x)),status:null});
const summary={site:base,testedAt:new Date().toISOString(),result:checks.every(x=>x.passed)?'PASS':'FAIL',
  note:'실제 기기 패스키·로그인·삭제 테스트를 대체하지 않습니다.',checks};
mkdirSync('docs/evidence',{recursive:true});
writeFileSync('docs/evidence/public-check.json',JSON.stringify(summary,null,2));
console.log('결과 저장: docs/evidence/public-check.json');
if (summary.result!=='PASS') process.exitCode=1;
