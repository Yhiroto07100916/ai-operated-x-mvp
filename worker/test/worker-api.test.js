import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.ts';

const origin = 'https://ai-operated-x-admin.pages.dev';
const env = {
  DB: {},
  APP_ENV: 'production',
  APP_ORIGIN: origin,
  AI: {}
};

test('health endpoint is public and reports publishing disabled', async () => {
  const response = await worker.fetch(
    new Request('https://worker.example/api/health', { headers: { Origin: origin } }),
    env,
    {}
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.publishingEnabled, false);
});

test('production CORS does not allow an unconfigured origin', async () => {
  const response = await worker.fetch(
    new Request('https://worker.example/api/health', {
      headers: { Origin: 'https://attacker.example' }
    }),
    env,
    {}
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('protected API rejects requests without an admin token', async () => {
  const response = await worker.fetch(
    new Request('https://worker.example/api/candidates?status=pending', {
      headers: { Origin: origin }
    }),
    env,
    {}
  );
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.deepEqual(await response.json(), { error: 'Unauthorized' });
});

test('production preflight only grants the configured origin', async () => {
  const allowed = await worker.fetch(
    new Request('https://worker.example/api/candidates', {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' }
    }),
    env,
    {}
  );
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), origin);

  const denied = await worker.fetch(
    new Request('https://worker.example/api/candidates', {
      method: 'OPTIONS',
      headers: { Origin: 'https://attacker.example', 'Access-Control-Request-Method': 'GET' }
    }),
    env,
    {}
  );
  assert.equal(denied.status, 204);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});
