export interface OAuthEnv {
  DB: D1Database;
  X_CLIENT_ID?: string;
  X_CLIENT_SECRET?: string;
  X_OAUTH_REDIRECT_URI?: string;
  X_TOKEN_ENCRYPTION_KEY?: string;
  APP_ORIGIN?: string;
}
export type XTokens = { access_token: string; refresh_token?: string; expires_at: number; scope: string; username?: string };
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const random = (length: number) => { const bytes = new Uint8Array(length); crypto.getRandomValues(bytes); return bytes; };
const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
async function key(env: OAuthEnv): Promise<CryptoKey> {
  if (!env.X_TOKEN_ENCRYPTION_KEY) throw new Error('X_TOKEN_ENCRYPTION_KEY is not configured.');
  let raw: Uint8Array;
  try { raw = unb64(env.X_TOKEN_ENCRYPTION_KEY); } catch { throw new Error('X_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.'); }
  if (raw.byteLength !== 32) throw new Error('X_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  const rawBuffer = new ArrayBuffer(raw.byteLength);
  new Uint8Array(rawBuffer).set(raw);
  return crypto.subtle.importKey('raw', rawBuffer, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function encryptTokens(env: OAuthEnv, tokens: XTokens): Promise<string> {
  const iv = random(12);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(env), new TextEncoder().encode(JSON.stringify(tokens)));
  return JSON.stringify({ iv: b64(iv), data: b64(new Uint8Array(encrypted)) });
}
export async function decryptTokens(env: OAuthEnv, value: string): Promise<XTokens> {
  const envelope = JSON.parse(value) as { iv: string; data: string };
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(envelope.iv) }, await key(env), unb64(envelope.data));
  return JSON.parse(new TextDecoder().decode(decrypted)) as XTokens;
}
export function makeVerifier(): string { return b64(random(32)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
export async function makeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64(new Uint8Array(digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
export function makeState(): string { return hex(random(32)); }
function requireConfig(env: OAuthEnv): asserts env is OAuthEnv & { X_CLIENT_ID: string; X_CLIENT_SECRET: string; X_OAUTH_REDIRECT_URI: string; APP_ORIGIN: string } {
  if (!env.X_CLIENT_ID || !env.X_CLIENT_SECRET || !env.X_OAUTH_REDIRECT_URI || !env.APP_ORIGIN) {
    throw new Error('X OAuth configuration is incomplete.');
  }
}
async function tokenRequest(env: OAuthEnv, body: URLSearchParams): Promise<{ access_token: string; refresh_token?: string; expires_in: number; scope?: string }> {
  requireConfig(env);
  const credentials = btoa(env.X_CLIENT_ID + ':' + env.X_CLIENT_SECRET);
  const response = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: { authorization: 'Basic ' + credentials, 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000)
  });
  const payload = await response.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error_description?: string };
  if (!response.ok || !payload.access_token || !payload.expires_in) {
    throw new Error('X OAuth token request failed (' + response.status + '): ' + (payload.error_description || 'Invalid token response.'));
  }
  return { access_token: payload.access_token, refresh_token: payload.refresh_token, expires_in: payload.expires_in, scope: payload.scope };
}
export async function beginOAuth(env: OAuthEnv): Promise<string> {
  requireConfig(env);
  const state = makeState();
  const verifier = makeVerifier();
  const challenge = await makeChallenge(verifier);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await env.DB.prepare('DELETE FROM x_oauth_states WHERE expires_at < ?').bind(new Date().toISOString()).run();
  await env.DB.prepare('INSERT INTO x_oauth_states (state, code_verifier, expires_at) VALUES (?, ?, ?)').bind(state, verifier, expiresAt).run();
  const url = new URL('https://x.com/i/oauth2/authorize');
  url.search = new URLSearchParams({
    response_type: 'code', client_id: env.X_CLIENT_ID, redirect_uri: env.X_OAUTH_REDIRECT_URI,
    scope: 'tweet.write users.read offline.access', state, code_challenge: challenge, code_challenge_method: 'S256'
  }).toString();
  return url.toString();
}
export async function completeOAuth(env: OAuthEnv, state: string, code: string): Promise<void> {
  requireConfig(env);
  const saved = await env.DB.prepare('SELECT code_verifier, expires_at FROM x_oauth_states WHERE state = ?').bind(state)
    .first<{ code_verifier: string; expires_at: string }>();
  await env.DB.prepare('DELETE FROM x_oauth_states WHERE state = ?').bind(state).run();
  if (!saved || Date.parse(saved.expires_at) <= Date.now()) throw new Error('OAuth state is invalid or expired.');
  const result = await tokenRequest(env, new URLSearchParams({
    grant_type: 'authorization_code', code, redirect_uri: env.X_OAUTH_REDIRECT_URI,
    code_verifier: saved.code_verifier, client_id: env.X_CLIENT_ID
  }));
  if (!result.refresh_token) throw new Error('X did not return a refresh token. Reauthorize with offline.access enabled.');
  let username: string | undefined;
  try {
    const me = await fetch('https://api.x.com/2/users/me?user.fields=username', {
      headers: { authorization: 'Bearer ' + result.access_token }, signal: AbortSignal.timeout(10000)
    });
    if (me.ok) username = ((await me.json()) as { data?: { username?: string } }).data?.username;
  } catch { /* Profile display is optional; token storage remains successful. */ }
  const tokens: XTokens = {
    access_token: result.access_token, refresh_token: result.refresh_token,
    expires_at: Date.now() + result.expires_in * 1000, scope: result.scope || 'tweet.write users.read offline.access', username
  };
  const encrypted = await encryptTokens(env, tokens);
  await env.DB.prepare('INSERT INTO x_oauth_tokens (id, encrypted_tokens, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET encrypted_tokens = excluded.encrypted_tokens, updated_at = excluded.updated_at')
    .bind(encrypted, new Date().toISOString()).run();
}
export async function getValidAccessToken(env: OAuthEnv): Promise<string | null> {
  const row = await env.DB.prepare('SELECT encrypted_tokens FROM x_oauth_tokens WHERE id = 1').first<{ encrypted_tokens: string }>();
  if (!row) return null;
  const tokens = await decryptTokens(env, row.encrypted_tokens);
  if (tokens.expires_at > Date.now() + 60_000) return tokens.access_token;
  if (!tokens.refresh_token) throw new Error('X refresh token is unavailable. Reconnect the account.');
  requireConfig(env);
  const refreshed = await tokenRequest(env, new URLSearchParams({
    grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: env.X_CLIENT_ID
  }));
  const next: XTokens = {
    access_token: refreshed.access_token, refresh_token: refreshed.refresh_token || tokens.refresh_token,
    expires_at: Date.now() + refreshed.expires_in * 1000, scope: refreshed.scope || tokens.scope,
    username: tokens.username
  };
  const encrypted = await encryptTokens(env, next);
  await env.DB.prepare('UPDATE x_oauth_tokens SET encrypted_tokens = ?, updated_at = ? WHERE id = 1')
    .bind(encrypted, new Date().toISOString()).run();
  return next.access_token;
}
export async function getOAuthStatus(env: OAuthEnv): Promise<{ connected: boolean; username?: string; expiresAt?: string }> {
  const row = await env.DB.prepare('SELECT encrypted_tokens FROM x_oauth_tokens WHERE id = 1').first<{ encrypted_tokens: string }>();
  if (!row) return { connected: false };
  const tokens = await decryptTokens(env, row.encrypted_tokens);
  return { connected: true, username: tokens.username, expiresAt: new Date(tokens.expires_at).toISOString() };
}
export async function disconnectOAuth(env: OAuthEnv): Promise<void> {
  const row = await env.DB.prepare('SELECT encrypted_tokens FROM x_oauth_tokens WHERE id = 1').first<{ encrypted_tokens: string }>();
  if (row) {
    try {
      const tokens = await decryptTokens(env, row.encrypted_tokens);
      if (env.X_CLIENT_ID) {
        await fetch('https://api.x.com/2/oauth2/revoke', {
          method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: tokens.refresh_token || tokens.access_token, token_type_hint: tokens.refresh_token ? 'refresh_token' : 'access_token', client_id: env.X_CLIENT_ID }),
          signal: AbortSignal.timeout(10000)
        });
      }
    } catch { /* Local credentials are removed even if remote revocation is unavailable. */ }
  }
  await env.DB.prepare('DELETE FROM x_oauth_tokens WHERE id = 1').run();
  await env.DB.prepare("UPDATE app_settings SET value = 'approval', updated_at = ? WHERE key = 'publishing_mode'").bind(new Date().toISOString()).run();
}
