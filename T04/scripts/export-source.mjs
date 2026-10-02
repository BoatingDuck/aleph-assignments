import {execFileSync} from 'node:child_process';import {mkdirSync,writeFileSync} from 'node:fs';
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();mkdirSync('public/source',{recursive:true});execFileSync('git',['archive','--format=zip',`--output=public/source/${sha}.zip`,sha]);writeFileSync('public/source-info.json',JSON.stringify({commit:sha,url:`/source/${sha}.zip`}));
