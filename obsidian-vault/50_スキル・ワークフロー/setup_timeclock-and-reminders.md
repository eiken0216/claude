---
title: "打刻自動化・業務リマインド セットアップ"
aliases:
  - "打刻自動化・業務リマインド セットアップ"
category: "スキル・ワークフロー"
project: "打刻自動化・業務リマインド"
created: 2026-08-02
source_repo: eiken0216/claude
source_branch: claude/daily-reminders-auto-timeclock-j5ux86
source_path: "docs/timeclock-and-reminders.md"
tags:
  - ai-reference
  - スキル-ワークフロー
  - 業務自動化
  - リマインド
---

# 打刻自動化・業務リマインド セットアップ

朝のブリーフ、打合せの直前リマインド、出勤打刻の自動化、退勤打刻のリマインドを
まとめた仕組みです。

## なぜ二箇所に分かれているのか

処理は **クラウド側** と **業務PC側** に分かれています。分ける必然性があります。

| | 動く場所 | 担当 |
|---|---|---|
| 朝のブリーフ / 打合せ通知 | クラウド（Routine） | Google カレンダー・Gmail を使う |
| 出勤打刻 / 退勤リマインド | 業務PC（タスクスケジューラ） | 打刻システムの SSO・位置情報・作業開始の検知 |

打刻を業務PC側に置いている理由は3つあります。

1. **認証。** 打刻システムの認証は URL に付く JWT のみで、**有効期間は発行から6時間**です。
   クッキーによるセッションは存在しません。トークンをどこかに保存して使い回すことは
   できないので、打刻のたびにブラウザの SSO セッションから取り直す必要があります。
2. **位置情報。** 打刻リクエストには緯度・経度が含まれます。業務PC で動かせば実際の
   勤務地から送信できます。
3. **作業開始の検知。** 「業務PCで実務を始めたら打刻」を実現できるのは業務PC上だけです。

---

## 業務PC 側のセットアップ（Windows）

### 前提

- Microsoft Edge がインストールされていること（標準で入っています）
- Outlook がセットアップ済みであること（メール送信に使用。パスワード保存は不要）
- PowerShell 5.1 以上（Windows 10 / 11 標準）

### 手順

**1. このリポジトリを業務PC に置く**

```powershell
git clone https://github.com/eiken0216/claude.git
cd claude\scripts\windows
```

**2. 設定ファイルを作る**

```powershell
Copy-Item dakoku.config.example.json dakoku.config.json
notepad dakoku.config.json
```

`latitude` と `longitude` に **実際に勤務している場所の座標**を入れてください。
Google マップで勤務先を右クリックすると座標が表示されます。
打刻記録として送信される値なので、実際の勤務地以外を入れないでください。

**3. 初回ログイン**

```powershell
powershell -ExecutionPolicy Bypass -File .\Dakoku.ps1 -Action Login -Interactive
```

ブラウザが開くので SSO ログインを完了させてください。以降、SSO セッションは
`%LOCALAPPDATA%\DakokuAuto\edge-profile` に保持され、打刻のたびに自動でトークンが
取得されます。**トークン自体はディスクに保存されません。**

**4. 動作確認**

```powershell
powershell -ExecutionPolicy Bypass -File .\Dakoku.ps1 -Action Status
```

現在の打刻状態が表示されれば成功です。

**5. タスクスケジューラに登録**

```powershell
powershell -ExecutionPolicy Bypass -File .\Install-DakokuTasks.ps1
```

登録されるタスク:

| タスク名 | タイミング | 動作 |
|---|---|---|
| `DakokuAuto-PunchIn` | ログオン / ロック解除の1分後 | 平日 06:00〜12:00 かつ本日未打刻なら出勤打刻 |
| `DakokuAuto-RemindEvening` | 平日 20:00 | 退勤未打刻ならトースト通知 |
| `DakokuAuto-RemindMissing` | 平日 22:00 | 退勤未打刻ならメール送信 |

解除する場合は `.\Install-DakokuTasks.ps1 -Uninstall` です。

### 手動での打刻

```powershell
.\Dakoku.ps1 -Action PunchIn     # 出勤
.\Dakoku.ps1 -Action PunchOut    # 退勤
.\Dakoku.ps1 -Action Status      # 状態確認
```

### SSO が切れたとき

自動打刻がログインできなくなると、`eiken.tezuka@sonymusic.co.jp` に
**「[打刻] 自動打刻がログインできませんでした（要対応）」** というメールが届きます
（同じ日に何通も送らないようになっています）。届いたら再ログインしてください。

```powershell
.\Dakoku.ps1 -Action Login -Interactive
```

### ログ

`%LOCALAPPDATA%\DakokuAuto\logs\dakoku-YYYY-MM.log` に月ごとに記録されます。
打刻が動かないときは、まずここを見てください。

---

## クラウド側

`.claude/skills/daily-brief/` のスキルが、Routine（定期トリガー）から
**平日 7:57 JST** に呼ばれます。

1. その日の Google カレンダーの予定を取得
2. 各予定に **15分前・5分前**（移動を伴う予定は **30分前・10分前**）のリマインドを設定
3. 予定と「今日やるべきこと」をまとめて `eiken.tezuka@sonymusic.co.jp` にメール送信

手動で実行したい場合は、Claude に「朝のブリーフを出して」または `/daily-brief` と
頼んでください。

---

## 打刻システムの技術メモ

調査で判明した API 仕様です。仕様変更で動かなくなったときの手がかりとして残します。

| 項目 | 内容 |
|---|---|
| エンドポイント | `https://dakoku.sonymusic.co.jp/api` |
| 状態取得 | `GET /record/latest` |
| 打刻 | `POST /record` |
| 履歴 | `GET /records/{year}/{month}` |
| ログイン | `GET /login`（SSO へリダイレクト → `?token=<JWT>` 付きで戻る） |
| 認証ヘッダ | `Authorization: bearer <JWT>` と `x-api-key` |
| トークン有効期間 | 発行から 6 時間（JWT の `exp` - `iat`） |

`POST /record` のリクエストボディ:

```json
{
  "kind": "startWork | endWork | startBreak | endBreak",
  "workDate": "YYYY-MM-DD",
  "datetime": "YYYY-MM-DD HH:mm",
  "latitude": 35.xxxx,
  "longitude": 139.xxxx,
  "modFlg": 0
}
```

`workDate` は、出勤打刻では当日、それ以外では直前レコードの `recordDate` を使います
（日跨ぎ勤務に対応するため）。

`x-api-key` はフロントエンドの JS バンドルに埋め込まれている固定値です。**リポジトリには
コミットせず**、`Dakoku.ps1` が実行時に打刻サイトから読み取ります（`Get-DakokuApiKey`）。
値がローテーションされても自動で追随します。抽出に失敗する場合のみ、
`dakoku.config.json` の `apiKey` に手動で設定してください。

### 未確定の点

`GET /record/latest` のレスポンス構造は**実機で未確認**です。`Dakoku.ps1` の
`Test-PunchedIn` / `Test-PunchedOut` は、想定されるフィールド名
（`startTime` / `endTime` など）を複数試す実装になっています。

初回に `-Action Status` を実行すると生の JSON が表示されるので、
フィールド名が想定と違っていたらその内容を Claude に伝えてください。判定処理を修正します。

---

## 今後

- Obsidian またはタスク管理アプリと連携し、朝のブリーフの「今日やるべきこと」に
  実際のタスク一覧を統合する（連携先が決まり次第）
