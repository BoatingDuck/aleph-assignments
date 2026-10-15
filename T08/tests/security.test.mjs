import test from 'node:test';
import assert from 'node:assert/strict';
import { randomToken, hashToken, isUuid, requireOwnAccount, parseCookies,validLabel } from '../lib/security.mjs';
test('challenge and session tokens are unique and hashes do not expose tokens',()=>{
 const x=randomToken(),y=randomToken(); assert.notEqual(x,y);assert.notEqual(x,hashToken(x));assert.equal(hashToken(x).length,64);
});
test('two-way account isolation',()=>{
 assert.equal(requireOwnAccount('owner','reviewer'),false);
 assert.equal(requireOwnAccount('reviewer','owner'),false);
 assert.equal(requireOwnAccount('owner','owner'),true);
 assert.equal(requireOwnAccount(undefined,'owner'),false);
});
test('validation',()=>{
 assert.equal(isUuid('a'),false);assert.equal(validLabel('  보안키  '),'보안키');
 assert.equal(validLabel(''),null);
});
test('cookie parsing',()=>{
 assert.equal(parseCookies('a=1; __Host-t08_session=abc')['__Host-t08_session'],'abc');
});
