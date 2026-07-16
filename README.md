# アナリティクス レポート集

Claude Code のスキルとして実装したアナリティクスツール集です。

| スキル | 用途 |
|---|---|
| `/tiktok-report <handle>` | TikTok アカウントの動画指標・コメントのレポート |
| `/artist-analytics <artist> [, 興行も含めて]` | アーティスト分析(ストリーミング/SNS/リリース + 興行分析) |

## /artist-analytics

アーティストの公開データ(Spotify・YouTube・公式サイト・音楽メディア)を収集し、
`reports/artist/<アーティスト名>/` にレポート(Markdown)とデータ(CSV)を書き出します。
「興行も含めて」と指定すると、ツアー日程・会場キャパ・チケット価格・フェス出演・
概算グロスなどのライブビジネス分析が加わります。実行のたびに
`metrics_history.csv` に数値が追記され、前回比の推移も追えます。

詳細は `.claude/skills/artist-analytics/SKILL.md` を参照。

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
