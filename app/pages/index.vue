<script setup lang="ts">
type Candidate = {
  id: string; kind: 'post' | 'repost'; status: string; body: string;
  rationale: string; confidence: number; created_at: string;
  source_title?: string | null; source_url?: string | null;
};
const config = useRuntimeConfig();
const apiBase = config.public.apiBase as string;
const token = ref('');
const status = ref('pending');
const items = ref<Candidate[]>([]);
const loading = ref(false);
const error = ref('');
const notice = ref('');
const headers = computed(() => token.value ? { Authorization: `Bearer ${token.value}` } : {});

async function load() {
  loading.value = true; error.value = '';
  try {
    const result = await $fetch<{ items: Candidate[] }>(`${apiBase}/api/candidates?status=${status.value}`, { headers: headers.value });
    items.value = result.items;
  } catch (e) { error.value = e instanceof Error ? e.message : '読み込みに失敗しました'; }
  finally { loading.value = false; }
}
async function review(item: Candidate, action: 'approve' | 'reject') {
  notice.value = '';
  try {
    await $fetch(`${apiBase}/api/candidates/${item.id}/${action}`, { method: 'POST', headers: headers.value });
    notice.value = action === 'approve' ? '承認しました（外部には投稿されません）' : '却下しました';
    await load();
  } catch (e) { error.value = e instanceof Error ? e.message : '更新に失敗しました'; }
}
async function generate() {
  notice.value = ''; error.value = '';
  try {
    const result = await $fetch<{ created: number }>(`${apiBase}/api/generate`, { method: 'POST', headers: headers.value });
    notice.value = `${result.created}件の候補を生成しました（モック）`;
    status.value = 'pending'; await load();
  } catch (e) { error.value = e instanceof Error ? e.message : '生成に失敗しました'; }
}
function formatDate(value: string) { return new Date(value).toLocaleString('ja-JP'); }
onMounted(load);
</script>

<template>
  <main class="shell">
    <header class="topbar">
      <div><p class="eyebrow">AUTONOMOUS AGENT / MVP</p><h1>AI-operated X</h1><p class="sub">AIが考えた投稿候補を確認・承認する管理画面</p></div>
      <span class="mode">MOCK MODE · PUBLISHING OFF</span>
    </header>

    <section class="notice warning"><strong>安全モード</strong><span>現在は候補生成と承認フローのみ。Xへの投稿・リポストは実行されません。</span></section>

    <section class="toolbar">
      <label class="token">管理トークン（本番環境では必須）<input v-model="token" type="password" placeholder="ローカル開発では空欄で可"></label>
      <div class="actions"><button class="secondary" @click="load">再読み込み</button><button @click="generate">候補を生成</button></div>
    </section>

    <section class="stats">
      <div><span>表示中</span><strong>{{ items.length }}</strong></div>
      <div><span>目標頻度</span><strong>6–10<span class="unit">件/日</span></strong></div>
      <div><span>公開連携</span><strong class="off">停止中</strong></div>
    </section>

    <div v-if="notice" class="notice success">{{ notice }}</div>
    <div v-if="error" class="notice danger">{{ error }}</div>

    <section class="list-head"><div><h2>投稿候補</h2><p>AIが作成した下書きと判断理由</p></div>
      <select v-model="status" @change="load"><option value="pending">承認待ち</option><option value="approved">承認済み</option><option value="rejected">却下</option><option value="published">公開済み</option><option value="failed">失敗</option></select>
    </section>

    <div v-if="loading" class="empty">読み込み中…</div>
    <div v-else-if="!items.length" class="empty">候補はありません。「候補を生成」からモック候補を作成できます。</div>
    <article v-for="item in items" :key="item.id" class="candidate">
      <div class="candidate-meta"><span class="kind">{{ item.kind === 'post' ? 'POST' : 'REPOST' }}</span><span>{{ formatDate(item.created_at) }}</span><span class="confidence">確信度 {{ Math.round(item.confidence * 100) }}%</span></div>
      <p class="body">{{ item.body }}</p>
      <div class="reason"><strong>AIの判断理由</strong><p>{{ item.rationale }}</p></div>
      <div v-if="item.source_url" class="source-link">
        <span>情報源</span>
        <a :href="item.source_url" target="_blank" rel="noopener noreferrer">{{ item.source_title || item.source_url }}</a>
      </div>
      <div v-if="status === 'pending'" class="candidate-actions"><button class="reject" @click="review(item, 'reject')">却下</button><button @click="review(item, 'approve')">承認</button></div>
      <div v-else class="status-label">{{ item.status }}</div>
    </article>

    <footer>AI-operated X · MVP · 外部公開機能は未接続</footer>
  </main>
</template>

<style>
:root{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#e7edf5;background:#0b1422}*{box-sizing:border-box}body{margin:0}.shell{max-width:920px;margin:0 auto;padding:42px 22px 70px}.topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;margin-bottom:28px}.eyebrow{font-size:11px;letter-spacing:.16em;color:#8ba7c5;font-weight:700}.topbar h1{font-size:32px;margin:6px 0}.sub,.list-head p{color:#93a4b8;margin:0;font-size:14px}.mode,.kind{font-size:10px;letter-spacing:.08em;border:1px solid #31516e;color:#a9c7e6;border-radius:20px;padding:7px 10px;white-space:nowrap}.notice{padding:13px 15px;border-radius:12px;margin:16px 0;font-size:13px;display:flex;gap:10px;flex-wrap:wrap}.warning{background:#302718;border:1px solid #70552a;color:#f1d5a1}.success{background:#123328;border:1px solid #24694d;color:#b7f0d2}.danger{background:#3b2026;border:1px solid #743b48;color:#ffc4ce}.toolbar{display:flex;justify-content:space-between;align-items:end;gap:18px;margin:24px 0}.token{font-size:12px;color:#9aadc2;display:grid;gap:7px;flex:1;max-width:430px}input,select{background:#111f31;border:1px solid #2a4058;color:#e7edf5;border-radius:8px;padding:10px 12px;font:inherit}.actions,.candidate-actions{display:flex;gap:9px}button{background:#d5a64e;color:#17130c;border:0;border-radius:8px;padding:10px 15px;font-weight:700;cursor:pointer}.secondary,.reject{background:#20344a;color:#d7e4f1}.reject{color:#ffc4ce}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.stats>div{background:#111f31;border:1px solid #223850;border-radius:12px;padding:16px}.stats span{display:block;color:#8fa4ba;font-size:12px}.stats strong{display:block;font-size:24px;margin-top:7px}.stats .unit{display:inline;font-size:12px;margin-left:4px}.stats .off{font-size:17px;color:#f1c47e}.list-head{display:flex;justify-content:space-between;align-items:center;margin:34px 0 14px}.list-head h2{margin:0 0 5px;font-size:20px}.list-head select{min-width:140px}.candidate{background:#111f31;border:1px solid #263c54;border-radius:14px;padding:19px;margin:12px 0}.candidate-meta{display:flex;align-items:center;gap:12px;color:#8fa4ba;font-size:11px;flex-wrap:wrap}.body{font-size:16px;line-height:1.8;white-space:pre-wrap;margin:17px 0}.reason{border-left:2px solid #486581;padding:4px 0 4px 12px;color:#a7b8ca;font-size:12px}.reason p{margin:5px 0}.source-link{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-top:12px;font-size:12px;color:#8fa4ba}.source-link a{color:#a9c7e6;overflow-wrap:anywhere}.candidate-actions{justify-content:flex-end;margin-top:17px}.confidence{margin-left:auto}.empty{border:1px dashed #344b63;border-radius:12px;padding:30px;text-align:center;color:#8fa4ba;font-size:13px}footer{text-align:center;color:#63788f;font-size:11px;margin-top:45px}@media(max-width:640px){.shell{padding:28px 15px 50px}.topbar{display:block}.mode{display:inline-block;margin-top:14px}.toolbar{display:block}.token{max-width:none}.actions{margin-top:12px}.actions button{flex:1}.stats{gap:7px}.stats>div{padding:11px}.stats strong{font-size:20px}.list-head{align-items:flex-end}.candidate{padding:15px}.body{font-size:15px}}
</style>
