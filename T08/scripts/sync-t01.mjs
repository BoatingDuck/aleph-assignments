import { readFileSync,copyFileSync,mkdirSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
const original=resolve('..','T01');
const target=resolve('public');
if (!existsSync(resolve(original,'index.html'))) {
  console.error('T08은 aleph-assignments/T01 옆에 넣어야 합니다. ../T01/index.html 파일을 찾지 못했습니다.');
  process.exitCode=1;
} else {
  const fragment=readFileSync('snippets/private-room.html','utf8');
  let html=readFileSync(resolve(original,'index.html'),'utf8');
  if (!html.includes('</main>') || !html.includes('</nav>')) throw new Error('T01 원본 HTML 구조 변경: 자동 합성을 중단했습니다.');
  html=html.replace('</nav>','<a href="#private-room">비공개 자리</a></nav>');
  // T08 layout: retain all three T01 experience headings, but remove their
  // forced <br> line breaks so each wraps naturally at the viewport width.
  html=html.replace(/(<article class="strength"[\s\S]*?<h3>)([\s\S]*?)(<\/h3>)/g,
    (_,open,title,close)=>open+title.replace(/<br\s*\/?>/gi,' ')+close);

  html=html.replace('</main>',`${fragment}\n</main>`);
  html=html.replace('</head>', '<link rel="stylesheet" href="passkey.css"><link rel="stylesheet" href="design.css"><script src="passkey-client.js" defer></script><script src="design-motion.js" defer></script></head>');
  mkdirSync(target,{recursive:true});
  mkdirSync(resolve(target,'assets'),{recursive:true});
  for (const name of ['style.css','script.js']) copyFileSync(resolve(original,name),resolve(target,name));
  copyFileSync(resolve(original,'assets/favicon.svg'),resolve(target,'assets/favicon.svg'));
  // Preserve T01 public copy, while linking separate T08 UI enhancement assets.
  // The original T01 script and stylesheet are copied without editing.
  await import('node:fs/promises').then(fs=>fs.writeFile(resolve(target,'index.html'),html,'utf8'));
  console.log('T01 원본 공개 페이지 복제 + T08 비공개 영역 합성 완료');
}
