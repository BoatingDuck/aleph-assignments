import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import QRCode from 'qrcode';
import { phoneAuthenticationOptions, passkeyErrorMessage } from './passkey-login.js';

const $ = (id) => document.getElementById(id);
const message = $('t08-message');
if (!message) throw new Error('T08 비공개 영역이 없습니다.');
const fragment = new URLSearchParams(location.hash.startsWith('#') ? location.hash.slice(1) : '');
let invitation = fragment.get('invite');
const phoneCode = fragment.get('phone');
if (invitation || phoneCode) history.replaceState(null,'',location.pathname + location.search);
let busy = false;
let loggedIn = false;
let pairing = null;
let pairingTimer = null;
const setMessage = (text, error=false) => { message.textContent = text; message.dataset.error = String(error); };
const setVisible = (id, show) => { $(id).hidden = !show; };
const markBusy = (isBusy) => {
  busy = isBusy;
  for (const id of ['t08-login','t08-phone-login','t08-first-register','t08-more-register','t08-logout']) $(id).disabled = busy;
  for (const button of document.querySelectorAll('#t08-keys button')) button.disabled = busy;
};
async function request(action, body=null, query={}) {
  const url = new URL('/api',location.origin);
  url.searchParams.set('action',action);
  for (const [key,value] of Object.entries(query)) url.searchParams.set(key,value);
  const response = await fetch(url,{method:body===null?'GET':'POST',credentials:'same-origin',
    cache:'no-store',headers:body===null?{}:{'Content-Type':'application/json'},
    body:body===null?undefined:JSON.stringify(body)});
  let data;
  try { data = await response.json(); } catch { throw new Error('서버가 JSON을 반환하지 않았습니다.'); }
  if (!response.ok) throw new Error(`${response.status}: ${data.error || '요청이 거절되었습니다.'}`);
  return data;
}
function dateOnly(value) {
  return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
}
function drawNotes(items) {
  const root = $('t08-notes');root.replaceChildren();
  for (const item of items) {
    const card = document.createElement('article');
    const title = document.createElement('h5');title.textContent=item.title;
    const para = document.createElement('p');para.textContent=item.body;
    card.append(title,para);root.append(card);
  }
}
async function drawKeys() {
  const data = await request('passkeys');
  const root = $('t08-keys');root.replaceChildren();
  for (const key of data.passkeys) {
    const li = document.createElement('li');
    const meta = document.createElement('div');
    const title = document.createElement('strong'); title.textContent=key.label;
    const date = document.createElement('span'); date.textContent=`등록일: ${dateOnly(key.createdAt)}`;
    meta.append(title,date);
    const del = document.createElement('button');
    del.type='button';del.textContent='이 패스키 삭제';del.className='private-delete';
    del.addEventListener('click',()=>run(async()=>{
      if (!confirm(`'${key.label}' 패스키를 삭제할까요? 이 패스키로는 다시 로그인할 수 없습니다.`)) return;
      await request('passkey-delete',{id:key.id});
      await drawKeys();setMessage('패스키가 삭제되었습니다. 남은 패스키로 로그인할 수 있습니다.');
    }));
    li.append(meta,del);root.append(li);
  }
  if (data.passkeys.length === 0) {
    const li=document.createElement('li');li.textContent='등록된 패스키가 없습니다. 로그인을 할 수 없습니다.';root.append(li);
  }
}
async function refresh() {
  const status=await request('status');
  loggedIn=status.signedIn;
  setVisible('t08-guest',!loggedIn);
  setVisible('t08-invite',!loggedIn && Boolean(invitation));
  setVisible('t08-member',loggedIn);
  if (loggedIn) {
    $('t08-welcome').textContent=`${status.me.displayName}의 비공개 자리`;
    // A protected request is made only AFTER the server verifies an HttpOnly session cookie.
    const notes=await request('notes');
    drawNotes(notes.items);
    await drawKeys();
    setMessage('패스키 인증을 통과한 계정의 가상 기록만 열렸습니다.');
  } else {
    $('t08-notes').replaceChildren();$('t08-keys').replaceChildren();
    setMessage(invitation ? '첫 등록 초대 링크가 확인되었습니다. 등록을 시작할 수 있습니다.' : '비공개 영역은 잠겨 있습니다. 패스키로 로그인하세요.');
  }
}
async function run(callback, registration=false) {
  if (busy) return;
  markBusy(true);
  try {await callback();}
  catch(error) {
    setMessage(passkeyErrorMessage(error, registration),true);
  } finally {markBusy(false);}
}
async function register(labelId, first) {
  if (!browserSupportsWebAuthn()) throw new Error('이 브라우저는 WebAuthn 패스키를 지원하지 않습니다.');
  const label=$(labelId).value.trim();
  if (!label || label.length>40) throw new Error('패스키 이름을 1~40자로 입력하세요.');
  if (first && !invitation) throw new Error('일회용 등록 링크가 필요합니다.');
  const token=first?invitation:undefined;
  const {challengeId, options}=await request('registration-options',{inviteToken:token});
  // Only public-key credential response is sent. No private key ever enters request JSON.
  const response=await startRegistration({optionsJSON:options});
  await request('registration-verify',{challengeId,response,label,inviteToken:token});
  invitation=null;
  $('t08-invite-qr').hidden = true;
  $('t08-invite-qr-image').removeAttribute('src');
  $('t08-show-invite-qr').setAttribute('aria-expanded', 'false');
  $('t08-show-invite-qr').textContent = '휴대폰으로 등록 · QR 보기';
  await refresh();setMessage('패스키 등록 성공: 공개키만 서버에 저장되었습니다.');
}

function phoneView() {
  let panel=$('t08-phone-panel');
  if(panel) return panel;
  panel=document.createElement('div');
  panel.id='t08-phone-panel';
  panel.className='t08-phone-panel';
  panel.hidden=true;
  panel.innerHTML='<h4 id="t08-phone-title">휴대폰 패스키로 PC 로그인</h4><p id="t08-phone-status" role="status"></p><img id="t08-phone-image" width="230" height="230" alt="휴대폰 패스키 로그인 전용 일회성 QR 코드" hidden><button type="button" class="button outline" id="t08-phone-close">QR 인증 취소</button>';
  $('t08-guest').append(panel);
  $('t08-phone-close').addEventListener('click',()=>{stopPhonePair(true);});
  return panel;
}
function stopPhonePair(cancel=false) {
  if(pairingTimer) {clearInterval(pairingTimer);pairingTimer=null;}
  const old=pairing;pairing=null;
  const panel=$('t08-phone-panel');
  if(panel) {panel.hidden=true;$('t08-phone-image').removeAttribute('src');}
  if(cancel && old) request('phone-cancel',{pairId:old}).catch(()=>{});
}
async function beginPhoneQR() {
  if(!browserSupportsWebAuthn()) throw new Error('PC 브라우저가 패스키 인증을 지원하지 않습니다.');
  stopPhonePair(true);
  const {pairId,phoneToken,expiresInSeconds}=await request('phone-start',{handle:$('t08-account').value});
  pairing=pairId;
  const panel=phoneView();panel.hidden=false;
  $('t08-phone-title').textContent='휴대폰 카메라로 QR을 스캔하세요';
  $('t08-phone-status').textContent='휴대폰에서 열리는 이 사이트에서 패스키 인증을 완료하면 PC 로그인이 열립니다. USB 보안키는 필요하지 않습니다.';
  const link=location.origin+location.pathname+location.search+'#phone='+encodeURIComponent(pairId+'.'+phoneToken);
  const image=$('t08-phone-image');
  image.src=await QRCode.toDataURL(link,{width:230,margin:2,errorCorrectionLevel:'M'});
  image.hidden=false;
  const deadline=Date.now()+expiresInSeconds*1000;
  let polling=false;
  pairingTimer=setInterval(async()=>{
    if(!pairing || polling)return;
    if(Date.now()>=deadline) {stopPhonePair();setMessage('QR이 만료되었습니다. 새 QR로 다시 시도하세요.',true);return;}
    polling=true;
    try {
      const status=await request('phone-poll',{pairId});
      if(status.state==='authenticated'){
        stopPhonePair();
        await refresh();setMessage('휴대폰 패스키 인증 성공! PC에서 비공개 기록을 열었습니다.');
      } else if(status.state==='expired') {
        stopPhonePair();setMessage('QR 인증이 만료되었습니다. 새로 시작하세요.',true);
      }
    } catch(error) {stopPhonePair();setMessage(error.message,true);}
    finally {polling=false;}
  },2400);
}
async function approveFromPhone() {
  if(!phoneCode) return;
  const dot=phoneCode.indexOf('.');
  const pairId=phoneCode.slice(0,dot),phoneToken=phoneCode.slice(dot+1);
  const panel=phoneView();panel.hidden=false;
  $('t08-phone-title').textContent='PC 로그인 승인';
  $('t08-phone-image').hidden=true;
  $('t08-phone-close').textContent='닫기';
  $('t08-phone-status').textContent='PC에서 시작한 로그인 요청입니다. 이 사이트에서 본인이 시작한 로그인일 때만 승인하세요.';
  const approve=document.createElement('button');
  approve.type='button';approve.className='button solid';approve.textContent='내 휴대폰 패스키로 PC 로그인 승인';
  panel.append(approve);
  approve.addEventListener('click',()=>run(async()=>{
    if(!browserSupportsWebAuthn())throw new Error('이 휴대폰은 패스키 인증을 지원하지 않습니다.');
    const {challengeId,options,handle}=await request('phone-prepare',{pairId,phoneToken});
    $('t08-phone-status').textContent='선택된 실습 계정: '+(handle==='owner'?'내 실습 계정':'검증용 두 번째 계정');
    const response=await startAuthentication({optionsJSON:options});
    await request('phone-approve',{pairId,phoneToken,challengeId,response});
    approve.disabled=true;
    $('t08-phone-status').textContent='승인 완료. PC로 돌아가면 자동으로 로그인됩니다.';
    setMessage('휴대폰 패스키 서명을 확인했습니다. 이제 PC에서 로그인할 수 있습니다.');
  }));
}
function login(usePhone=false) {
  return run(async()=>{
    if (!browserSupportsWebAuthn()) throw new Error('이 브라우저는 패스키를 지원하지 않습니다.');
    setMessage(usePhone
      ? '휴대폰 인증을 준비합니다. 인증창에서 iPhone·Android 또는 다른 기기를 선택하고 QR을 스캔하세요.'
      : '패스키 인증을 준비합니다.');
    const {challengeId,options}=await request('authentication-options',{handle:$('t08-account').value});
    const response=await startAuthentication({optionsJSON:usePhone?phoneAuthenticationOptions(options):options});
    await request('authentication-verify',{challengeId,response});
    await refresh();setMessage('서명 확인 성공! 비공개 기록을 열었습니다.');
  });
}
$('t08-login').addEventListener('click',()=>login());
$('t08-phone-login').addEventListener('click',()=>beginPhoneQR().catch(error=>setMessage(error.message,true)));
$('t08-first-register').addEventListener('click',()=>run(()=>register('t08-first-label',true),true));
$('t08-more-register').addEventListener('click',()=>run(()=>register('t08-more-label',false),true));
$('t08-logout').addEventListener('click',()=>run(async()=>{
  await request('logout',{});await refresh();setMessage('로그아웃했습니다. 기존 세션으로 비공개 자료를 요청하면 거절됩니다.');
}));
// 등록 초대 URL을 외부 서비스로 전송하지 않고 사용자의 브라우저에서 QR 이미지로 생성합니다.
$('t08-show-invite-qr').addEventListener('click', async () => {
  if (!invitation) {
    setMessage('유효한 최초 등록 초대 링크를 먼저 열어 주세요.', true);
    return;
  }
  const panel = $('t08-invite-qr');
  const button = $('t08-show-invite-qr');
  const image = $('t08-invite-qr-image');
  if (!panel.hidden) {
    image.removeAttribute('src');
    panel.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    button.textContent = '휴대폰으로 등록 · QR 보기';
    return;
  }
  try {
    const link = location.origin + location.pathname + location.search + '#invite=' + encodeURIComponent(invitation);
    image.src = await QRCode.toDataURL(link, {
      errorCorrectionLevel: 'M', width: 230, margin: 2,
      color: { dark: '#302b27', light: '#fffdf8' },
    });
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    button.textContent = 'QR 코드 숨기기';
  } catch {
    setMessage('QR 코드 표시 중 문제가 발생했습니다. 초대 링크를 휴대폰에서 직접 열어 주세요.', true);
  }
});

refresh().then(()=>approveFromPhone()).catch(error=>{
  setVisible('t08-guest',true);
  setVisible('t08-invite',Boolean(invitation));
  setVisible('t08-member',false);
  setMessage(`${error.message} — 공개 소개는 계속 볼 수 있습니다.`,true);
});
