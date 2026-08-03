---
title: "TikTok アナリティクス レポート"
aliases:
  - "TikTok アナリティクス レポート"
category: "アーカイブ"
project: "リポジトリREADME (Instagramレポート)"
created: 2026-07-08
source_repo: eiken0216/claude
source_branch: claude/instagram-follower-scraper-ar7xxk
source_path: "README.md"
tags:
  - ai-reference
  - アーカイブ
  - README
---

# TikTok アナリティクス レポート

特定の TikTok アカウントを定期的にチェックし、動画ごとの指標（再生数・いいね・
コメント・シェア・**保存数**）と、集まっているコメントを収集して、
**リポジトリ内のデータ**と**見やすい Google スプレッドシート**にレポートする
ためのツールです。

Claude Code の **スキル**（`/tiktok-report`）として実装されています。手動で
実行でき、実行するたびに履歴が蓄積され、前回との差分（フォロワー増減など）も
レポートされます。

## 使い方

Claude Code 上で次のように依頼するだけです:

```
@tiktok のレポートを出して
```

または明示的にスキルを呼ぶ場合:

```
/tiktok-report tiktok
```

Claude が次を自動で行います:

1. Playwright で対象アカウントをクロール（再生数・いいね・コメント・シェア・保存数 + 上位コメント）
2. `reports/<handle>/` にデータを書き出し
   - `metrics.csv` — 動画ごとの指標
   - `comments.csv` — 上位コメント
   - `account_history.csv` — 実行ごとに 1 行追記される時系列データ
   - `<日付>.md` — 前回比のトレンド付き 読みやすいレポート
   - `raw/<日付>.json` — 生データ
3. `metrics.csv` / `comments.csv` を **Google スプレッドシート**としてアップロード（リンクを共有）
4. チャットに要約（アカウントの傾向・トップ動画・注目コメント・シート リンク）

## 前提・注意

- **ネットワーク:** `tiktok.com` への通信が必要です。ネットワークポリシーで
  TikTok がブロックされている環境では取得できません（その場合はブロックされて
  いない環境で実行してください）。
- **bot 対策:** TikTok は自動アクセスを制限します。取得に失敗する・件数が少ない
  場合は再実行してください。ログイン済みブラウザの Cookie 文字列を環境変数
  `TIKTOK_COOKIE` に設定すると成功率が上がります。
- **手動実行:** 現状は手動実行のスキルです。毎日の自動実行にしたい場合は、
  同じコマンドを定期実行トリガー（scheduled trigger）に組み込めます。ご希望が
  あれば設定します。

## 構成

```
.claude/skills/tiktok-report/
├── SKILL.md              # Claude 向けの実行手順
├── package.json          # playwright 依存
└── scripts/
    ├── scrape.mjs        # TikTok クローラ（Playwright）
    └── build_report.mjs  # 生データ → CSV / Markdown / 時系列
reports/                  # 生成物（実行ごとに蓄積）
```

詳細な指標定義や引数は `.claude/skills/tiktok-report/SKILL.md` を参照してください。

---

# Instagram アナリティクス レポート（公式 Graph API）

**自分が運用する** Instagram のプロアカウント（ビジネス / クリエイター）の
投稿を、公式の **Instagram Graph API** で分析するツールです。投稿ごとの
リーチ・再生数・いいね・コメント・シェア・保存、リールの平均視聴時間、
アカウント全体のオーディエンス国別内訳、そして**自分の投稿に付いた全コメントの
書き出し**を、リポジトリ内のデータと Google スプレッドシートにレポートします。

Claude Code の **スキル**（`/instagram-report`）として実装されています。

## できること / できないこと（重要）

- ✅ **自分のアカウントの投稿分析のみ。** 自分が管理するプロアカウントの
  インサイトとコメントを、自分で発行したトークンで読みます（規約準拠の正規の方法）。
- ❌ **フォロワーの書き出しはできません。** Graph API はフォロワー一覧や個々の
  フォロワーのユーザー名・プロフィール・カテゴリを返しません。このツールも取得
  しません（プライバシー・規約上できない領域です）。
- ❌ **投稿単位の国別データはありません。** 国・都市の内訳は**アカウント全体**の
  集計としてのみ取得でき、投稿ごとのジオデータは API では提供されていません。
- ⚠️ **視聴維持率**の正確な曲線は API では取れません。近い指標としてリールの
  平均視聴時間（`ig_reels_avg_watch_time`）と総視聴時間を出します。

## 前提（利用者側での準備が必要）

1. アカウントが**ビジネスまたはクリエイター**で、Facebook ページに連携済み。
2. Meta アプリのアクセストークン（スコープ: `instagram_basic`,
   `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`）。
3. トークンは環境変数 `IG_ACCESS_TOKEN` に設定（チャットに貼らないこと）。
   必要なら `IG_USER_ID`（数値の IG ビジネスアカウント ID）も設定。未設定なら
   トークンから自動判別を試みます。

## 使い方

```
/instagram-report
```

Claude が次を行います:

1. Graph API で対象アカウントの投稿・インサイト・全コメント・国別集計を取得
2. `reports/<username>/` にデータを書き出し
   - `metrics.csv` — 投稿ごとの指標（リーチ/再生/いいね/コメント/保存/エンゲージ/平均視聴）
   - `comments.csv` — 全コメント + 返信
   - `audience.csv` — アカウント全体の国別オーディエンス
   - `account_history.csv` — 実行ごとに 1 行追記（時系列）
   - `<日付>.md` — 前回比トレンド付き 読みやすいレポート
   - `raw/<日付>.json` — 生データ
3. 各 CSV を **Google スプレッドシート**としてアップロード（任意）
4. チャットに要約

詳細は `.claude/skills/instagram-report/SKILL.md` を参照してください。
