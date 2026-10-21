import test from 'node:test';
import assert from 'node:assert/strict';
import {phoneAuthenticationOptions, passkeyErrorMessage} from '../src/passkey-login.js';

test('phone discovery preserves security inputs and allowed IDs without mutating server options', () => {
  const original={challenge:'server-challenge',rpId:'duckalepht08.vercel.app',userVerification:'required',timeout:60000,
    allowCredentials:[{id:'owner-key',type:'public-key',transports:['internal']},{id:'backup-key',type:'public-key',transports:['usb']}],extensions:{appid:'test'}};
  const before=structuredClone(original);
  const phone=phoneAuthenticationOptions(original);
  assert.deepEqual(original,before);
  assert.equal(phone.challenge,original.challenge);
  assert.equal(phone.rpId,original.rpId);
  assert.equal(phone.userVerification,'required');
  assert.deepEqual(phone.extensions,original.extensions);
  assert.deepEqual(phone.allowCredentials,[{id:'owner-key',type:'public-key'},{id:'backup-key',type:'public-key'}]);
  assert.deepEqual(phone.hints,['hybrid']);
  assert.equal(phone.timeout,120000);
});

test('phone discovery does not invent credentials when allowCredentials is absent or empty', () => {
  assert.equal(phoneAuthenticationOptions({challenge:'c'}).allowCredentials,undefined);
  assert.deepEqual(phoneAuthenticationOptions({challenge:'c',allowCredentials:[]}).allowCredentials,[]);
});

test('wrapped and native NotAllowedError do not falsely assert user cancellation', () => {
  for(const error of [{name:'NotAllowedError'}, {name:'WebAuthnError',cause:{name:'NotAllowedError'}}, {name:'AbortError'}]) {
    const message=passkeyErrorMessage(error);
    assert.ok(message.includes('시간 초과'));
    assert.ok(message.includes('Bluetooth'));
    assert.ok(!message.includes('취소했습니다'));
  }
  assert.equal(passkeyErrorMessage(new Error('403: 서명 검증 실패')),'403: 서명 검증 실패');
});
