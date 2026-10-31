# X OAuth and publishing setup

The Worker supports X OAuth 2.0 Authorization Code Flow with PKCE. The dashboard starts the authorization flow; the Worker validates one-time state, exchanges the authorization code, encrypts the access and refresh tokens with AES-GCM, and stores only the encrypted token envelope in D1.

## Developer app settings

Configure the X app as a web app / automated app / bot with read and write permissions. Direct Message permissions and email collection are not needed.

Register this exact callback URL:

`https://ai-operated-x-worker.seiryofes-2027.workers.dev/api/auth/x/callback`

The OAuth flow requests only `tweet.write`, `users.read`, and `offline.access`. The Worker uses `users.read` only to display the connected account name. The `offline.access` scope is required for refresh-token issuance.

## Worker configuration

Set the X OAuth Client ID as a Worker variable named `X_CLIENT_ID`. Store the Client Secret and a random 32-byte encryption key (base64 encoded) as Worker secrets:

```bash
cd worker
npx wrangler secret put X_CLIENT_SECRET
openssl rand -base64 32
npx wrangler secret put X_TOKEN_ENCRYPTION_KEY
```

Use the output of the random-key command as the secret value when prompted. Never paste credentials into chat, Git, Pages variables, or source code. Keep a secure backup of the encryption key: losing it makes the stored token ciphertext unrecoverable and requires reconnecting the account.

The callback URL is configured as `X_OAUTH_REDIRECT_URI` in `wrangler.jsonc`.

## Database and deployment

Apply migrations before deploying:

```bash
cd worker
npx wrangler d1 migrations apply ai-operated-x-db --remote
npx wrangler deploy
```

Build and deploy the dashboard separately after the Worker is ready.

## Connection and publishing safety

The dashboard's X account connection uses an authenticated admin action to begin OAuth. State values are one-time and expire after ten minutes. PKCE uses S256. Tokens are encrypted with AES-GCM before they are written to D1. Disconnecting attempts to revoke the refresh token, deletes local token material, and resets publishing mode to `approval`.

Publishing starts in `approval` mode. Automatic mode remains a separate explicit setting and must not be enabled during initial connection testing. Each candidate still has one publication job; ambiguous network outcomes are not retried automatically.

The older `X_USER_ACCESS_TOKEN` secret remains as a temporary compatibility fallback. Prefer the OAuth connection and remove that legacy secret after confirming the new flow works.

## Data use

The application retrieves Japan trend metadata as a research relevance signal and combines it with RSS articles. Trend names are not treated as evidence. Posts are grounded in source articles. The application does not use DMs, automated likes, follows, reposts, or unsolicited replies.
