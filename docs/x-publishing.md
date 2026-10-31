# X publishing setup

The publishing workflow is disabled by default and starts in `approval` mode.

## Modes

- `approval`: a pending candidate is published only after an administrator approves it.
- `automatic`: newly generated candidates are approved and published without manual review.
- `paused`: candidate generation continues, but publication is skipped.

Switching to `automatic` is rejected unless a user-context X access token is configured.

## X user access token

Set `X_USER_ACCESS_TOKEN` as a Cloudflare Worker secret. It must be an OAuth 2.0 user-context access token for the account that will publish, with the `tweet.write` scope (and the appropriate X app permissions). The existing `X_BEARER_TOKEN` is app-only/read access for trend lookup and cannot publish posts.

Never put either token in the dashboard, Pages environment variables, source code, or Git.

Example:

```bash
cd worker
npx wrangler secret put X_USER_ACCESS_TOKEN
```

The command prompts for the token; do not paste it into chat or a source file.

## Duplicate protection and uncertain outcomes

Each candidate can have only one publication job. A successful response stores the X post ID and marks the candidate as published. A definitive API rejection is marked failed. A timeout or server-side ambiguous response is marked unknown and is not automatically retried, because X may have accepted the post even when the response was lost. Check the X account before taking any manual recovery action.

## Rollout

Apply D1 migrations before deploying the Worker. Deploy the dashboard separately after building it. Keep the mode at `approval` until the user-context token and a controlled test are verified. Automatic mode should be enabled explicitly in the dashboard.
