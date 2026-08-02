# 業務自動化ツール

日々の業務まわりを自動化するための、Claude Code のスキルとスクリプト群です。

## 収録しているもの

### 1. 打刻自動化・業務リマインド

朝のブリーフ、打合せの直前リマインド、出勤打刻の自動化、退勤打刻のリマインド。

- **朝のブリーフ** — 平日 7:57 に、その日のカレンダーの予定と「今日やるべきこと」を
  業務用アドレスへメール送信（`/daily-brief`）
- **打合せリマインド** — カレンダーの各予定に 15分前・5分前の通知を自動設定
  （移動を伴う予定は 30分前・10分前）
- **出勤打刻** — 業務PC のログオン / ロック解除を検知して自動で打刻
- **退勤リマインド** — 平日 20:00 に通知、22:00 時点で未打刻ならメール
- **SSO 切れの通知** — 自動打刻がログインできなくなったらメールで通知

セットアップ手順と技術仕様は **[docs/timeclock-and-reminders.md](docs/timeclock-and-reminders.md)** を参照してください。

```
.claude/skills/daily-brief/SKILL.md   # 朝のブリーフ（クラウド側）
scripts/windows/
├── Dakoku.ps1                        # 打刻・リマインドの本体
├── Install-DakokuTasks.ps1           # タスクスケジューラへの登録
└── dakoku.config.example.json        # 設定テンプレート
docs/timeclock-and-reminders.md       # セットアップ手順・API 仕様
```

### 2. TikTok アナリティクス レポート

特定の TikTok アカウントを定期的にチェックし、動画ごとの指標（再生数・いいね・
コメント・シェア・**保存数**）と、集まっているコメントを収集して、
**リポジトリ内のデータ**と**見やすい Google スプレッドシート**にレポートします。

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

**前提・注意**

- **ネットワーク:** `tiktok.com` への通信が必要です。ネットワークポリシーで
  TikTok がブロックされている環境では取得できません。
- **bot 対策:** TikTok は自動アクセスを制限します。取得に失敗する・件数が少ない
  場合は再実行してください。ログイン済みブラウザの Cookie 文字列を環境変数
  `TIKTOK_COOKIE` に設定すると成功率が上がります。

```
.claude/skills/tiktok-report/
├── SKILL.md              # Claude 向けの実行手順
├── package.json          # playwright 依存
└── scripts/
    ├── scrape.mjs        # TikTok クローラ（Playwright）
    └── build_report.mjs  # 生データ → CSV / Markdown / 時系列
reports/                  # 生成物（実行ごとに蓄積）
```

## 認証情報の扱い

このリポジトリには、パスワード・トークン・API キーなどの秘密情報を**一切コミットしません**。

- 打刻システムの認証は、業務PC のブラウザに保持された SSO セッションから
  実行のたびに取得します（トークンはディスクに保存されません）
- 勤務地の座標を含む `scripts/windows/dakoku.config.json` は `.gitignore` 済みです
- メール送信は業務PC の Outlook 経由のため、資格情報の保存が不要です
