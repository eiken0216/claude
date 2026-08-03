---
title: "TikTok アナリティクス レポート"
aliases:
  - "TikTok アナリティクス レポート"
category: "アーカイブ"
project: "リポジトリREADME (tiktok-report初期)"
created: 2026-07-05
source_repo: eiken0216/claude
source_branch: claude/16personality-mbti-diagnosis-xaaahw
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
