import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptTokens, encryptTokens, makeChallenge, makeVerifier } from '../src/x-oauth.ts';

const key = Buffer.alloc(32, 7).toString('base64');

test('PKCE verifier and challenge use URL-safe values', async () => {
  const verifier = makeVerifier();
  const challenge = await makeChallenge(verifier);
  assert.match(verifier, /^[A-Za-z0-9_-]+$/);
  assert.match(challenge, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(verifier, challenge);
});

test('OAuth tokens are encrypted at rest and can be decrypted', async () => {
  const env = { X_TOKEN_ENCRYPTION_KEY: key };
  const tokens = { access_token: 'access-secret', refresh_token: 'refresh-secret', expires_at: 123456, scope: 'tweet.write offline.access' };
  const encrypted = await encryptTokens(env, tokens);
  assert.equal(encrypted.includes('access-secret'), false);
  assert.equal(encrypted.includes('refresh-secret'), false);
  assert.deepEqual(await decryptTokens(env, encrypted), tokens);
});

test('token encryption rejects malformed encryption keys', async () => {
  await assert.rejects(() => encryptTokens({ X_TOKEN_ENCRYPTION_KEY: 'short' }, {
    access_token: 'x', expires_at: 1, scope: 'tweet.write'
  }), /32-byte key/);
});
