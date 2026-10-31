# Architecture

## Runtime
- Nuxt 4 dashboard in `app/`
- Cloudflare Worker API in `worker/`
- D1 stores candidates, research items, memory, and activity logs
- Workers AI creates draft posts; no external X publishing integration exists

## Research and generation flow
1. Cron or an administrator calls `POST /api/generate`.
2. Worker fetches a fixed allowlist of RSS/Atom feeds.
3. Feed entries are normalized and deduplicated by canonical URL in `research_items`.
4. Up to 15 recent entries are provided to Workers AI as untrusted reference material.
5. AI returns structured draft candidates with an article index, rationale, and confidence.
6. Worker validates source index, body length, URL absence, and recent exact duplicates.
7. Candidate is stored as `pending`; a human reviews it in the dashboard.

## Safety boundaries
- RSS content is untrusted input. It cannot trigger tools or external actions.
- The model is instructed not to invent human experiences or unsupported facts.
- Candidates are drafts only. Approval does not publish to X.
- X OAuth, publishing, reposting, likes, replies, and follows are not implemented.
- Production must configure an admin token and protect the dashboard/API with Cloudflare Access.

## API
- `GET /api/health`
- `GET /api/candidates?status=pending`
- `GET /api/research`
- `GET /api/activity`
- `GET /api/memory`
- `POST /api/generate`
- `POST /api/candidates/:id/approve`
- `POST /api/candidates/:id/reject`
