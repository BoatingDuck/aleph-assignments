import { build } from 'esbuild';
await build({entryPoints:['src/passkey-client.js'],outfile:'public/passkey-client.js',bundle:true,minify:true,format:'iife',target:['es2022']});
console.log('T08 브라우저 패스키 번들 생성 완료');
