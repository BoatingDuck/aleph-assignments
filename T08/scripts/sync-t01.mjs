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
  html=html.replace('</main>',`${fragment}\n</main>`);
  html=html.replace('</head>', '<link rel="stylesheet" href="passkey.css"><script src="passkey-client.js" defer></script></head>');
  mkdirSync(target,{recursive:true});
  mkdirSync(resolve(target,'assets'),{recursive:true});
  for (const name of ['style.css','script.js']) copyFileSync(resolve(original,name),resolve(target,name));
  copyFileSync(resolve(original,'assets/favicon.svg'),resolve(target,'assets/favicon.svg'));
  // Copy the public T01 document word for word, adding only one new navigation link and one protected section.
  await import('node:fs/promises').then(fs=>fs.writeFile(resolve(target,'index.html'),html,'utf8'));
  console.log('T01 원본 공개 페이지 복제 + T08 비공개 영역 합성 완료');
}
