/** ShieldLog - deterministic, browser-only security log analysis engine.
 * All times are UTC internally. Rules detect patterns, not confirmed intrusions.
 */
export const RULES = [
  {id:'BRUTE_FORCE',label:'반복 로그인 실패',severity:'high',windowMin:10,threshold:5,detail:'동일 IP·계정에서 10분 동안 인증 실패 5회 이상'},
  {id:'CREDENTIAL_SPRAY',label:'다중 계정 인증 시도',severity:'high',windowMin:15,threshold:3,detail:'동일 IP에서 15분 동안 서로 다른 계정 3개 이상에 인증 실패 6회 이상'},
  {id:'PATH_PROBE',label:'민감 경로 탐색',severity:'medium',windowMin:15,threshold:4,detail:'동일 IP가 15분 동안 서로 다른 민감 경로 4개 이상 요청'},
  {id:'ERROR_BURST',label:'HTTP 오류 급증',severity:'medium',windowMin:5,threshold:12,detail:'동일 IP에서 5분 동안 HTTP 4xx 응답 12회 이상'}
];
const sensitive = /(?:\/admin(?:\/|$)|\/\.env(?:\.|$|\/)|\/wp-admin|\/config(?:\/|\.|$)|\/actuator|\/phpmyadmin|\/\.git(?:\/|$)|\/server-status|\/api\/private)/i;
const isFail = e => e.status===401 || (e.status===403 && /login|auth|signin|session|token/i.test(e.path+' '+e.message)) || /login failed|invalid password|auth failure|authentication failed|로그인 실패/i.test(e.message);
const safeText = (v, max=240) => String(v??'').trim().slice(0,max);
const ipPattern = /^(?:(?:\d{1,3}\.){3}\d{1,3}|[a-fA-F0-9:]+|[a-zA-Z0-9.-]+)$/;
export function normalizeEvent(raw,index=0){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)) return null;
  const timestamp=safeText(raw.timestamp??raw.time??raw.datetime??raw.date,60);
  const ms=Date.parse(timestamp);
  if(!timestamp||!Number.isFinite(ms)) return null;
  let ip=safeText(raw.ip??raw.sourceIp??raw.source_ip??raw.client_ip??raw.src_ip??'unknown',90);
  if(!ipPattern.test(ip)) ip='unknown';
  const user=safeText(raw.username??raw.user??raw.account??'-',80)||'-';
  const path=safeText(raw.path??raw.url??raw.request??'/',240)||'/';
  const num=Number(raw.status??raw.statusCode??raw.status_code??200);
  const status=Number.isInteger(num)&&num>=100&&num<=599?num:0;
  return {id:`evt-${index}`,timestamp:new Date(ms).toISOString(),time:ms,ip,user,path,method:safeText(raw.method??'GET',12).toUpperCase(),status,message:safeText(raw.message??raw.reason??'',240)};
}
export function parseCSV(text){
  // RFC4180-style escaped fields, including quoted commas and quoted newlines.
  const records=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"') {if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(quoted||field===''){quoted=!quoted;}else{field+=c;}}
    else if(c===','&&!quoted){row.push(field);field='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))records.push(row);row=[];field='';}
    else field+=c;
  }
  if(quoted)throw Error('CSV 따옴표가 닫히지 않았습니다.');
  row.push(field);if(row.some(x=>x.trim()))records.push(row);
  if(records.length<2)throw Error('CSV에 헤더와 데이터 행이 필요합니다.');
  const heads=records[0].map((x,i)=>i===0?x.replace(/^\uFEFF/,'').trim():x.trim());
  if(!heads.includes('timestamp')&&!heads.includes('time'))throw Error('CSV에 timestamp 또는 time 열이 필요합니다.');
  return records.slice(1).map(r=>Object.fromEntries(heads.map((h,i)=>[h,r[i]??''])));
}
export function parseLogFile(content,filename){
  if(content.length>2_000_000)throw Error('파일 크기가 2MB를 초과했습니다.');
  let raw;
  if(filename.toLowerCase().endsWith('.csv'))raw=parseCSV(content);
  else if(filename.toLowerCase().endsWith('.json')){
    try {const obj=JSON.parse(content);raw=Array.isArray(obj)?obj:obj?.events;}catch{throw Error('유효하지 않은 JSON 형식입니다.');}
    if(!Array.isArray(raw))throw Error('JSON은 배열 또는 {"events": [...]} 형식이어야 합니다.');
  } else throw Error('CSV 또는 JSON 파일만 사용할 수 있습니다.');
  if(raw.length>4000)throw Error('최대 4,000개의 로그 행까지 분석할 수 있습니다.');
  const normalized=raw.map(normalizeEvent).filter(Boolean).sort((a,b)=>a.time-b.time);
  normalized.forEach((e,i)=>{e.id=`evt-${i}`;});
  if(!normalized.length)throw Error('유효한 timestamp가 있는 로그를 찾지 못했습니다.');
  return {events:normalized,skipped:raw.length-normalized.length};
}
function findWindow(events,minutes,qualifies){
  const w=minutes*60_000;let left=0;const hits=[];
  for(let right=0;right<events.length;right++){
    while(events[right].time-events[left].time>w)left++;
    const slice=events.slice(left,right+1);
    if(qualifies(slice)) hits.push(slice);
  }
  // Pick the broadest/latest qualifying window; one incident per group and rule.
  return hits.length?hits.reduce((a,b)=>b.length>a.length?b:a):null;
}
function groups(events,getKey){
  const map=new Map();for(const e of events){const k=getKey(e);if(!map.has(k))map.set(k,[]);map.get(k).push(e);}return map;
}
function stableKey(s){let v=2166136261;for(const c of s){v^=c.charCodeAt(0);v=Math.imul(v,16777619);}return (v>>>0).toString(36);}
function incident(rule,ip,user,proof,description){
  const start=proof[0].timestamp,end=proof[proof.length-1].timestamp;
  const id=`SL-${rule}-${stableKey(ip+'|'+user+'|'+start)}`;
  return {id,rule,ip,user,severity:RULES.find(r=>r.id===rule).severity,title:RULES.find(r=>r.id===rule).label,description,count:proof.length,startedAt:start,endedAt:end,evidence:proof.map(x=>x.id)};
}
export function detect(events){
  const valid=[...events].sort((a,b)=>a.time-b.time);const results=[];
  const failures=valid.filter(isFail);
  for(const [key,arr] of groups(failures,e=>e.ip+'|'+e.user)){
    const hit=findWindow(arr,10,items=>items.length>=5);
    if(hit){const [ip,user]=key.split('|');results.push(incident('BRUTE_FORCE',ip,user,hit,`계정 ${user}에서 10분 이내 인증 실패가 ${hit.length}회 관찰되었습니다.`));}
  }
  for(const [ip,arr] of groups(failures,e=>e.ip)){
    const hit=findWindow(arr,15,items=>items.length>=6&&new Set(items.map(e=>e.user).filter(x=>x!=='-')).size>=3);
    if(hit)results.push(incident('CREDENTIAL_SPRAY',ip,'다중 계정',hit,`서로 다른 계정 ${new Set(hit.map(e=>e.user)).size}개에 대해 ${hit.length}회 인증 실패가 관찰되었습니다.`));
  }
  for(const [ip,arr] of groups(valid.filter(e=>sensitive.test(e.path)),e=>e.ip)){
    const hit=findWindow(arr,15,items=>new Set(items.map(e=>e.path.split('?')[0])).size>=4);
    if(hit)results.push(incident('PATH_PROBE',ip,'-',hit,`15분 이내 민감 경로 ${new Set(hit.map(e=>e.path.split('?')[0])).size}개가 요청되었습니다.`));
  }
  for(const [ip,arr] of groups(valid.filter(e=>e.status>=400&&e.status<500),e=>e.ip)){
    const hit=findWindow(arr,5,items=>items.length>=12);
    if(hit)results.push(incident('ERROR_BURST',ip,'-',hit,`5분 이내 HTTP 4xx 응답이 ${hit.length}회 발생했습니다.`));
  }
  const order={high:0,medium:1,low:2};
  return results.sort((a,b)=>order[a.severity]-order[b.severity]||b.count-a.count||b.endedAt.localeCompare(a.endedAt));
}
const shift=(base,minutes)=>new Date(base+minutes*60_000).toISOString();
export function generateDemo(now=Date.now()){
  // Fully synthetic RFC 5737 documentation IP addresses (not real victims/attackers).
  const t=Math.floor(now/60_000)*60_000-3*60*60_000;
  const events=[];const add=(m,ip,user,path,status,message='',method='GET')=>events.push({timestamp:shift(t,m),ip,username:user,path,status,message,method});
  const ips=['192.0.2.10','192.0.2.19','198.51.100.12','198.51.100.20','203.0.113.7'];
  for(let i=0;i<115;i++)add(i*1.25,ips[i%ips.length],['visitor','member','operator'][i%3],['/','/dashboard','/api/items','/login'][i%4],i%19===0?404:200,'정상 요청');
  for(let i=0;i<7;i++)add(35+i*.7,'203.0.113.24','admin','/login',401,'invalid password','POST');
  const paths=['/.env','/.git/config','/wp-admin','/admin','/server-status','/actuator/health'];
  paths.forEach((path,i)=>add(66+i*.9,'198.51.100.77','-',path,i%2?404:403,'자동화된 경로 요청'));
  for(let i=0;i<13;i++)add(91+i*.25,'203.0.113.88','guest',`/missing/${i}`,404,'not found');
  for(let i=0;i<9;i++)add(119+i*.65,'192.0.2.99',['alice','bob','charlie','dana'][i%4],'/login',401,'login failed','POST');
  return parseLogFile(JSON.stringify(events),'sample.json').events;
}
