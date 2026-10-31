# AI-operated X — MVP

AI運営Xアカウントの管理・承認ワークフローを検証するためのMVPです。

## 現在できること
- 投稿候補の一覧表示
- 投稿候補の承認・却下
- 承認済み候補のキュー管理
- D1への候補・判断履歴保存
- Cronによる候補生成（現在は安全なモック生成）
- 投稿・リポストの実行は意図的に未実装

## 安全な初期設定
- `DRY_RUN=true` 相当のモック運用のみ
- X OAuth/APIトークンを受け付ける機能は未実装
- 自動いいね、返信、フォローは実装しない
- 承認は管理画面から人間が行う
- Cloudflare Access等で管理画面/APIを保護すること

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
`wrangler.jsonc` の database_id を作成結果に置き換えます。

```bash
npx wrangler d1 migrations apply ai-operated-x-db --local
npm run dev
```

### Dashboard
```bash
cd app
npm install
npm run dev
```
既定では `http://localhost:8787` の Worker APIを参照します。別URLの場合は `NUXT_PUBLIC_API_BASE` を設定してください。

## 本番化前に必要な作業
1. Cloudflare Access等による管理画面/APIの認証設定
2. AIモデル・情報ソースの選定と利用条件確認
3. X Developer契約・API利用資格・最新の自動化ルール確認
4. X API連携の設計レビューと明示的な有効化
5. 送信頻度・重複・誤情報・停止スイッチのテスト

このMVPは実際のX投稿・リポストを行いません。
