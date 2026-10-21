import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';

// Synthetic credentials. No real account, real key or production DB is used.
const origin = 'https://duckalepht08.vercel.app';
const rpID = 'duckalepht08.vercel.app';
const b64 = input => Buffer.from(input).toString('base64url');
const sha256 = input => createHash('sha256').update(input).digest();
const head = (major, n) => n < 24
  ? Buffer.from([(major << 5) | n])
  : n < 256 ? Buffer.from([(major << 5) | 24, n])
  : n < 65536 ? Buffer.from([(major << 5) | 25, n >> 8, n & 255])
  : (() => { throw Error('CBOR length too large'); })();
const cInt = n => head(n < 0 ? 1 : 0, n < 0 ? -1-n : n);
const cBytes = b => Buffer.concat([head(2,b.length),Buffer.from(b)]);
const cText = t => {const b=Buffer.from(t);return Buffer.concat([head(3,b.length),b]);};
const cMap = values => Buffer.concat([head(5,values.length),...values.flat()]);
function fakeDevice() {
  const { publicKey, privateKey } = generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const jwk = publicKey.export({format:'jwk'});
  const cose = cMap([
    [cInt(1),cInt(2)],[cInt(3),cInt(-7)],[cInt(-1),cInt(1)],
    [cInt(-2),cBytes(Buffer.from(jwk.x,'base64url'))],
    [cInt(-3),cBytes(Buffer.from(jwk.y,'base64url'))]
  ]);
  return { privateKey, cose, id:b64(randomBytes(32)) };
}
function clientData(type, challenge) {
  return Buffer.from(JSON.stringify({type,challenge,origin,crossOrigin:false}));
}
function counterBytes(counter) {
  const b=Buffer.alloc(4);b.writeUInt32BE(counter);return b;
}
function authData(counter, additional=Buffer.alloc(0),flags=0x05) {
  return Buffer.concat([sha256(rpID),Buffer.from([flags]),counterBytes(counter),additional]);
}
function authentication(device, challenge, counter=1) {
  const auth=authData(counter), client=clientData('webauthn.get',challenge);
  const signature=sign('sha256',Buffer.concat([auth,sha256(client)]),device.privateKey);
  return {
    id:device.id,rawId:device.id,type:'public-key',
    response:{
      clientDataJSON:b64(client),authenticatorData:b64(auth),
      signature:b64(signature),userHandle:null
    },
    clientExtensionResults:{}
  };
}
function verifyAuth(device,response,challenge,counter=0) {
  return verifyAuthenticationResponse({
    response,expectedChallenge:challenge,expectedOrigin:origin,expectedRPID:rpID,
    requireUserVerification:true,
    credential:{id:device.id,publicKey:new Uint8Array(device.cose),counter,transports:[]}
  });
}
test('C23 synthetic WebAuthn registration stores a public key only', async () => {
  const device=fakeDevice(), challenge=b64(randomBytes(32));
  const credId=Buffer.from(device.id,'base64url');
  const credLength=Buffer.alloc(2);credLength.writeUInt16BE(credId.length);
  const credentialData=Buffer.concat([Buffer.alloc(16),credLength,credId,device.cose]);
  const attObj=cMap([
    [cText('fmt'),cText('none')],
    [cText('attStmt'),cMap([])],
    [cText('authData'),cBytes(authData(0,credentialData,0x45))]
  ]);
  const response={
    id:device.id,rawId:device.id,type:'public-key',
    response:{
      clientDataJSON:b64(clientData('webauthn.create',challenge)),
      attestationObject:b64(attObj),transports:[]
    },
    clientExtensionResults:{}
  };
  const verified=await verifyRegistrationResponse({
    response,expectedChallenge:challenge,expectedOrigin:origin,expectedRPID:rpID,
    requireUserVerification:true
  });
  assert.equal(verified.verified,true);
  assert.deepEqual(Buffer.from(verified.registrationInfo.credential.publicKey),device.cose);
  assert.equal(JSON.stringify(response).includes(device.privateKey.export({format:'pem',type:'pkcs8'})),false);
  assert.equal(Object.hasOwn(response,'privateKey'),false);
});
test('C30 simulated valid P-256 assertion succeeds; modified signature is rejected', async () => {
  const device=fakeDevice(), challenge=b64(randomBytes(32));
  const valid=authentication(device,challenge,1);
  const verified=await verifyAuth(device,valid,challenge);
  assert.equal(verified.verified,true);
  assert.equal(verified.authenticationInfo.newCounter,1);
  const altered=structuredClone(valid);
  const bytes=Buffer.from(altered.response.signature,'base64url');
  bytes[bytes.length-1]^=1;
  altered.response.signature=b64(bytes);
  await assert.rejects(()=>verifyAuth(device,altered,challenge));
});
test('C31 simulated replay with unchanged assertion counter is rejected', async () => {
  const device=fakeDevice(), challenge=b64(randomBytes(32));
  const valid=authentication(device,challenge,1);
  const first=await verifyAuth(device,valid,challenge,0);
  assert.equal(first.verified,true);
  await assert.rejects(()=>verifyAuth(device,valid,challenge,first.authenticationInfo.newCounter));
});
test('C45 synthetic deleted ID cannot authenticate through credential allowlist', async () => {
  const kept=fakeDevice(), deleted=fakeDevice();
  const registered=new Map([[kept.id,kept],[deleted.id,deleted]]);
  assert.equal(registered.size,2);
  registered.delete(deleted.id);
  const challenge=b64(randomBytes(32));
  const oldAssertion=authentication(deleted,challenge);
  assert.equal(registered.has(oldAssertion.id),false);
  // The API rejects the missing credential before verifying a signature.
  const api=await import('node:fs').then(fs=>fs.readFileSync(new URL('../api/index.js',import.meta.url),'utf8'));
  assert.match(api,/FROM t08_passkeys WHERE id=\$\{data\.response\.id\} AND account_id=\$\{challenge\.account_id\}/);
  assert.match(api,/if \(!passkey\) fail\(403/);
  const newAssertion=authentication(kept,challenge);
  const ok=await verifyAuth(registered.get(newAssertion.id),newAssertion,challenge);
  assert.equal(ok.verified,true);
});
