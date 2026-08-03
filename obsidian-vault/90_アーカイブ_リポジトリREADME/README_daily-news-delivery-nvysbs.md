---
title: "eiken0216/claude"
aliases:
  - "eiken0216/claude"
category: "アーカイブ"
project: "リポジトリREADME (ニュース配信)"
created: 2026-08-01
source_repo: eiken0216/claude
source_branch: claude/daily-news-delivery-nvysbs
source_path: "README.md"
tags:
  - ai-reference
  - アーカイブ
  - README
---

# eiken0216/claude

音楽まわりの情報収集を自動化するツール置き場です。

| ツール | 何をするか | 起動方法 |
| --- | --- | --- |
| [毎朝のニュースブリーフ](docs/daily-news.md) | 担当アーティストの異常値と業界ニュースを平日朝8時にメール配信 | GitHub Actions（自動） |
| [TikTok アナリティクス レポート](#tiktok-アナリティクス-レポート) | TikTok アカウントの指標とコメントを収集してスプレッドシート化 | Claude Code の `/tiktok-report` |

---

## 毎朝のニュースブリーフ

平日 **朝8:00（日本時間）** に、次の内容をまとめたメールが Outlook 宛に自動で届きます。

- **担当アーティストの異常値** — Spotify のフォロワー/人気度、YouTube の登録者/再生数、
  アーティスト名を含む24hのUGC投稿数、ニュース言及数。それぞれ「平常時と比べてどれだけ
  外れているか」を z 値で判定し、外れていれば件名に `[要確認]` が付きます
- **音楽業界・エンタメ / SNS・動画トレンド / AI・テクノロジー** のニュースを
  Claude Opus 5 が選別して日本語で要約

配信内容と指標の履歴は `data/` に蓄積され、あとから見返せます。

**セットアップ手順は [docs/daily-news.md](docs/daily-news.md) を参照してください。**
（Gmail のアプリパスワードなど、いくつかのシークレット登録が必要です）

```
.github/workflows/daily-news.yml   平日8:00 JST の cron
tools/news/
├── config/artists.json            担当アーティストの定義
├── config/feeds.json              ニュースソースの定義
├── src/anomaly.mjs                異常値検知（z-score）
├── src/curate.mjs                 Claude による選別・要約
└── src/sources/                   Spotify / YouTube / RSS
data/
├── artists/<slug>/history.jsonl   日次スナップショット
└── digests/YYYY-MM-DD.md          配信した内容
```

---

## TikTok アナリティクス レポート

特定の TikTok アカウントを定期的にチェックし、動画ごとの指標（再生数・いいね・
コメント・シェア・**保存数**）と、集まっているコメントを収集して、
**リポジトリ内のデータ**と**見やすい Google スプレッドシート**にレポートする
ためのツールです。

Claude Code の **スキル**（`/tiktok-report`）として実装されています。手動で
実行でき、実行するたびに履歴が蓄積され、前回との差分（フォロワー増減など）も
レポートされます。

### 使い方

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

### 前提・注意

- **ネットワーク:** `tiktok.com` への通信が必要です。ネットワークポリシーで
  TikTok がブロックされている環境では取得できません（その場合はブロックされて
  いない環境で実行してください）。
- **bot 対策:** TikTok は自動アクセスを制限します。取得に失敗する・件数が少ない
  場合は再実行してください。ログイン済みブラウザの Cookie 文字列を環境変数
  `TIKTOK_COOKIE` に設定すると成功率が上がります。
- **手動実行:** 現状は手動実行のスキルです。毎日の自動実行にしたい場合は、
  同じコマンドを定期実行トリガー（scheduled trigger）に組み込めます。ご希望が
  あれば設定します。

### 構成

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
