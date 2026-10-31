# Architecture notes

## MVP boundaries

The first milestone validates the human approval workflow and durable state. It intentionally does not publish, repost, like, follow, reply, or scrape X.

## Candidate lifecycle

`pending -> approved | rejected`

Approved candidates are only marked approved in this milestone. A later integration must add a separate, explicitly enabled publisher with idempotency, rate-limit handling, an emergency stop, and audit logging.

## Daily target

The scheduler runs three times daily. It creates up to three mock candidates per run and caps the number of pending/approved candidates created in a rolling 24-hour window at the configured target (default 8). This is a candidate-generation target, not a promise to publish that many posts.

## Security

- Configure Cloudflare Access for the dashboard and Worker.
- Set `APP_ENV=production` and `ADMIN_TOKEN` as a Worker secret.
- Never commit API tokens or `.dev.vars`.
- Keep publishing disabled until all platform eligibility, terms, and operational controls are reviewed.
