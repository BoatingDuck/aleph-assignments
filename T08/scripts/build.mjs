import { build } from 'esbuild';
// Production deployment creates ONLY the new QR handoff table.
// Preview and local builds never mutate any database.
if (process.env.VERCEL_ENV === 'production') await import('./migrate-phone-login.mjs');
await build({entryPoints:['src/passkey-client.js'],outfile:'public/passkey-client.js',bundle:true,minify:true,format:'iife',target:['es2022']});
console.log('T08 브라우저 패스키 번들 생성 완료');
