interface Env {
  DB: D1Database;
  APP_ENV?: string;
  CANDIDATE_TARGET_PER_DAY?: string;
  ADMIN_TOKEN?: string;
}

type CandidateKind = 'post' | 'repost';
type CandidateStatus = 'pending' | 'approved' | 'rejected' | 'published' | 'failed';

interface Candidate {
  id: string;
  kind: CandidateKind;
  status: CandidateStatus;
  body: string;
  source_url: string | null;
  source_title: string | null;
  rationale: string;
  confidence: number;
  created_at: string;
  reviewed_at: string | null;
  reviewer_note: string | null;
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});

function cors(request: Request, response: Response): Response {
  const origin = request.headers.get('Origin');
  const headers = new Headers(response.headers);
  if (origin && /^https?:\/\/(localhost:\d+|127\.0\.0\.1:\d+)$/.test(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('vary', 'Origin');
  }
  headers.set('access-control-allow-methods', 'GET,POST,OPTIONS');
  headers.set('access-control-allow-headers', 'Content-Type, Authorization');
  return new Response(response.body, { status: response.status, headers });
}

function authorized(request: Request, env: Env): boolean {
  // Local development can run without a token. Production must configure ADMIN_TOKEN
  // and Cloudflare Access; never expose this API publicly without an auth layer.
  if (env.APP_ENV !== 'production' && !env.ADMIN_TOKEN) return true;
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  return Boolean(env.ADMIN_TOKEN && token && token === env.ADMIN_TOKEN);
}

function id(): string {
  return crypto.randomUUID();
}

async function log(db: D1Database, eventType: string, entityId: string | null, detail: string) {
  await db.prepare('INSERT INTO activity_log (event_type, entity_id, detail, created_at) VALUES (?, ?, ?, ?)')
    .bind(eventType, entityId, detail, new Date().toISOString()).run();
}

function mockDrafts(count: number): Array<Pick<Candidate, 'kind' | 'body' | 'rationale' | 'confidence'>> {
  const ideas = [
    ['post', '新しい技術に触れるとき、機能そのものだけでなく「誰のどんな手間を減らすのか」を考えるようにしている。', '技術を生活者の視点から捉える短い所感。', 0.72],
    ['post', 'ニュースを読むとき、見出しだけで判断せず、発表元・日付・一次情報まで確認する習慣を大切にしたい。', '情報の読み方についての一般的な考え。', 0.91],
    ['post', '知らない分野の話を理解する近道は、まず基本用語を3つだけ押さえることかもしれない。', '学習や好奇心に関する独自の短文。', 0.68],
    ['post', '便利さが増えるほど、「あえて人が考える部分」をどこに残すかが大事になっていく気がする。', 'AIと人間の役割についての所感。', 0.75],
    ['post', '今日の小さな発見：複雑な問題も、前提を一つずつ書き出すと少し見通しがよくなる。', '日常的な学びを共有する投稿案。', 0.70],
    ['post', '意見が変わることは、必ずしも一貫性がないということではない。新しい根拠を受け取った結果かもしれない。', '考え方の更新を肯定する投稿案。', 0.79],
    ['post', '面白いアイデアほど、最初は小さく試して、結果を見てから広げるのがよさそう。', '実験・ものづくりの姿勢について。', 0.73],
    ['post', '分野の違う知識をつなげると、同じ問題がまったく違って見えることがある。', '幅広い興味を表す投稿案。', 0.74]
  ] as const;
  return Array.from({ length: Math.min(count, ideas.length) }, (_, i) => {
    const [kind, body, rationale, confidence] = ideas[i];
    return { kind: kind as CandidateKind, body, rationale, confidence };
  });
}

async function generateCandidates(env: Env, requested = 3) {
  const existing = await env.DB.prepare("SELECT COUNT(*) AS count FROM candidates WHERE status IN ('pending','approved') AND created_at >= ?")
    .bind(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).first<{ count: number }>();
  const target = Math.max(1, Math.min(10, Number(env.CANDIDATE_TARGET_PER_DAY || 8)));
  const remaining = Math.max(0, target - Number(existing?.count || 0));
  const count = Math.min(requested, remaining);
  if (!count) return { created: 0, message: 'Daily candidate target reached.' };
  const drafts = mockDrafts(count);
  for (const draft of drafts) {
    const candidateId = id();
    await env.DB.prepare(`INSERT INTO candidates
      (id, kind, status, body, rationale, confidence, created_at)
      VALUES (?, ?, 'pending', ?, ?, ?, ?)`)
      .bind(candidateId, draft.kind, draft.body, draft.rationale, draft.confidence, new Date().toISOString()).run();
    await log(env.DB, 'candidate.generated', candidateId, 'Mock generator created a draft; no external publication occurred.');
  }
  return { created: drafts.length, mode: 'mock' };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return cors(request, new Response(null, { status: 204 }));
    const url = new URL(request.url);
    let response: Response;

    if (url.pathname === '/api/health' && request.method === 'GET') {
      response = json({ ok: true, mode: 'mock', publishingEnabled: false, time: new Date().toISOString() });
      return cors(request, response);
    }

    if (!authorized(request, env)) return cors(request, json({ error: 'Unauthorized' }, 401));

    try {
      if (url.pathname === '/api/candidates' && request.method === 'GET') {
        const status = url.searchParams.get('status');
        const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 50)));
        const query = status
          ? env.DB.prepare('SELECT * FROM candidates WHERE status = ? ORDER BY created_at DESC LIMIT ?').bind(status, limit)
          : env.DB.prepare('SELECT * FROM candidates ORDER BY created_at DESC LIMIT ?').bind(limit);
        const rows = await query.all<Candidate>();
        response = json({ items: rows.results || [] });
      } else if (url.pathname === '/api/activity' && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 100').all();
        response = json({ items: rows.results || [] });
      } else if (url.pathname === '/api/memory' && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT * FROM agent_memory ORDER BY created_at DESC LIMIT 100').all();
        response = json({ items: rows.results || [] });
      } else if (url.pathname === '/api/generate' && request.method === 'POST') {
        const result = await generateCandidates(env, 3);
        response = json(result, 201);
      } else {
        const match = url.pathname.match(/^\/api\/candidates\/([\w-]+)\/(approve|reject)$/);
        if (match && request.method === 'POST') {
          const [, candidateId, action] = match;
          const body = await request.json().catch(() => ({})) as { note?: string };
          const status = action === 'approve' ? 'approved' : 'rejected';
          const result = await env.DB.prepare(`UPDATE candidates SET status = ?, reviewed_at = ?, reviewer_note = ? WHERE id = ? AND status = 'pending'`)
            .bind(status, new Date().toISOString(), body.note || null, candidateId).run();
          if (!result.meta.changes) response = json({ error: 'Candidate not found or already reviewed.' }, 409);
          else {
            await log(env.DB, action === 'approve' ? 'candidate.approved' : 'candidate.rejected', candidateId, body.note || 'No reviewer note.');
            response = json({ ok: true, status });
          }
        } else {
          response = json({ error: 'Not found' }, 404);
        }
      }
    } catch (error) {
      response = json({ error: 'Internal error', detail: error instanceof Error ? error.message : 'Unknown error' }, 500);
    }
    return cors(request, response);
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(generateCandidates(env, 3));
  }
};
