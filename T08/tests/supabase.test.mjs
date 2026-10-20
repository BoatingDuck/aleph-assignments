import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Supabase pg adapter uses parameter binding and 1 server-side connection', () => {
  const source = read('lib/db.mjs');
  assert.match(source, /from 'pg'/);
  assert.match(source, /max:\s*1/);
  assert.match(source, /rejectUnauthorized:\s*true/);
  assert.match(source, /pool\.query\(text, values\)/);
  assert.doesNotMatch(source, /@neondatabase\/serverless/);
});

test('Supabase tables have RLS and no public client access grants', () => {
  const schema = read('scripts/schema.sql');
  for (const name of ['accounts','notes','passkeys','invites','challenges','sessions']) {
    assert.ok(schema.includes(`ALTER TABLE public.t08_${name} ENABLE ROW LEVEL SECURITY;`), name);
    assert.ok(schema.includes(`public.t08_${name}`), name);
  }
  assert.match(schema,/REVOKE ALL ON TABLE[\s\S]*FROM anon, authenticated;/);
});

test('Supabase migration retains server authentication and no browser secrets', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(pkg.dependencies.pg);
  assert.equal(pkg.dependencies['@neondatabase/serverless'], undefined);
  const api = read('api/index.js');
  assert.ok(api.includes('verifyAuthenticationResponse'));
  assert.ok(api.includes('verifyRegistrationResponse'));
  const browser = read('public/design-motion.js');
  assert.ok(!browser.includes('DATABASE_URL'));
});
