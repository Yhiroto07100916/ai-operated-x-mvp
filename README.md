# AI-operated X — MVP

AI運営Xアカウントの管理・承認ワークフローを検証するためのMVPです。

## 現在できること
- 投稿候補の一覧表示
- 投稿候補の承認・却下
- 承認済み候補のキュー管理
- D1への候補・判断履歴保存
- RSSによるニュース・研究情報の収集（NHK、BBC、NASA、Hacker News、arXiv）
- Cloudflare Workers AIによる日本語投稿案の生成
- 情報源URL・タイトルとAIの判断理由を候補に保存
- 人間の承認・却下を学習メモに蓄積し、次の候補生成時に参照
- 投稿案の重複・文字数・URL混入チェック
- Cronによる定期収集・候補生成（1日3回、直近24時間で最大8件）
- 投稿・リポストの実行は意図的に未実装

## 安全な初期設定
- `APP_ENV=production` を設定
- `ADMIN_TOKEN` をWorker Secretとして登録
- 管理画面とAPIの両方をCloudflare Access等で保護
- `APP_ORIGIN` に管理画面の本番オリジンを設定
- Worker preview URLは無効化（`preview_urls: false`）
- 管理トークンをソースコード、GitHub、公開ビルド設定へ書き込まない
- X OAuth/APIトークンを受け付ける機能は未実装
- 自動いいね、返信、フォローは実装しない
- 承認は管理画面から人間が行う

### 本番管理画面を公開する前に
1. 管理画面のホスト名にCloudflare Accessアプリケーションを作成し、許可するユーザーを限定する
2. Worker APIのホスト名にもCloudflare Accessを設定するか、ネットワーク制限を含む別の保護策を用意する
3. Workerの `APP_ORIGIN` Secret/Variableに管理画面の正確なOrigin（例：`https://admin.example.com`）を設定する
4. 管理画面でのみ管理者が `ADMIN_TOKEN` を入力する。トークンをNuxtの `runtimeConfig.public`、ビルド時環境変数、HTML、Gitへ含めない
5. Access未認証時に管理画面/APIへ到達できないことを確認する

Cloudflare Accessの認証とWorkerの `ADMIN_TOKEN` は別の防御層です。どちらか一方だけに依存しないでください。

## 構成
- `app/`: Nuxt 4 管理画面
- `worker/`: Cloudflare Worker API
- `worker/migrations/`: D1 schema

## 開発

### Worker
```bash
cd worker
npm install
npx wrangler d1 create ai-operated-x-db
```
`wrangler.jsonc` の database_id を作成結果に置き換えます。Workers AI binding は同ファイルで設定済みです。

```bash
npx wrangler d1 migrations apply ai-operated-x-db --local
npm test
npm run dev
```

### Dashboard
```bash
cd app
npm install
npm run dev
```
既定では `http://localhost:8787` の Worker APIを参照します。別URLの場合は `NUXT_PUBLIC_API_BASE` を設定してください。

### AI・情報収集

- `worker/wrangler.jsonc` の `ai.binding` でWorkers AIを利用します。
- 既定モデルは `@cf/meta/llama-3.3-70b-instruct-fp8-fast` です。必要に応じて `AI_MODEL` で変更できます。
- RSS本文は未信頼データとして扱い、記事内の命令をAIに実行させないプロンプトにしています。
- 収集記事は `research_items` に保存されます。新規DBではマイグレーションを必ず適用してください。
- AI生成にはWorkers AIの従量課金が発生する場合があります。利用量と料金を確認してください。

## 本番Workerの更新

本番D1のマイグレーションが未適用の場合は、デプロイ前に適用します。

```bash
cd worker
npm install
npx wrangler d1 migrations apply ai-operated-x-db --remote
npx wrangler deploy
```

`APP_ORIGIN` は管理画面のホスト名を決めてから、Worker SecretまたはVariableとして正確なOriginを設定してください。Secretで設定する場合:

```bash
npx wrangler secret put APP_ORIGIN
```

管理画面のホスティング先とデプロイ設定は、このリポジトリにはまだ含まれていません。ホスティング先を決定し、Accessで保護したうえで、実際のOriginを `APP_ORIGIN` に設定してください。管理画面の公開ビルドに `ADMIN_TOKEN` を含めてはいけません。

## 本番化前に必要な作業
1. Cloudflare Access等による管理画面/APIの認証設定
2. AIモデル・情報ソースの選定と利用条件確認
3. X Developer契約・API利用資格・最新の自動化ルール確認
4. X API連携の設計レビューと明示的な有効化
5. 送信頻度・重複・誤情報・停止スイッチのテスト

このMVPは実際のX投稿・リポストを行いません。
