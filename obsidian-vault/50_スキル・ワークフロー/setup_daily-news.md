---
title: "毎朝のニュースブリーフ — セットアップ手順"
aliases:
  - "毎朝のニュースブリーフ — セットアップ手順"
category: "スキル・ワークフロー"
project: "毎朝のニュースブリーフ"
created: 2026-08-02
source_repo: eiken0216/claude
source_branch: claude/daily-news-delivery-nvysbs
source_path: "docs/daily-news.md"
tags:
  - ai-reference
  - スキル-ワークフロー
  - 業務自動化
  - ニュース
---

# 毎朝のニュースブリーフ — セットアップ手順

平日 **朝8:00（日本時間）** に、担当アーティストの異常値と業界ニュースをまとめたメールを
`eiken.tezuka@sonymusic.co.jp` へ自動送信します。GitHub Actions で動くので、
一度シークレットを登録すればセッションを開いていなくても毎日届きます。

---

## 何が届くか

| セクション | 内容 |
| --- | --- |
| 今日のまとめ | 3〜4文。アーティストに動きがあればそこから始まります |
| 担当アーティストの動き | 指標ごとに前日比と「平常時とどれだけ違うか（z値）」。異常値があればカードが黄色くなり、件名にも `[要確認]` が付きます |
| 音楽業界・エンタメ | 国内外の業界ニュース |
| SNS・動画トレンド | TikTok / YouTube / Instagram まわり |
| AI・テクノロジー | 生成AIとエンタメ領域での活用 |

### 追跡する指標

| 指標 | ソース | 判定方法 | 何が分かるか |
| --- | --- | --- | --- |
| Spotify フォロワー | Spotify API | 1日あたり増分 | ファン基盤の伸び。露出があった翌日に跳ねる |
| Spotify 人気度 | Spotify API | 値そのもの | 直近再生量で変動する 0-100 のスコア。**STのスパイクの代理指標** |
| トップ曲の平均人気度 | Spotify API | 値そのもの | 楽曲単位での勢い。特定曲がバズると跳ねる |
| YouTube 登録者 | YouTube API | 1日あたり増分 | 公式チャンネルの成長 |
| YouTube 再生数 | YouTube API | 1日あたり増分 | 実質「その日の再生数」 |
| UGC 24h投稿数 | YouTube API | 値そのもの | **アーティスト名を含む動画が24hに何本上がったか**。切り抜き・カバー・ファン動画の盛り上がり |
| UGC 24h再生数 | YouTube API | 値そのもの | 上記UGCの合計再生数 |
| ニュース言及数 | Google ニュース | 値そのもの | 24hの報道件数。APIキー不要 |

**異常値の判定:** 各指標について直近21日ぶんの観測から平均 μ と標準偏差 σ を求め、
当日の観測が **μ ± 2σ** を外れたらスパイクとして報告します（z ≥ 3 なら「高」）。
スナップショットが6日ぶん貯まるまでは判定せず「ベースライン構築中」と表示されます。
**つまり異常値検知が本格的に効き始めるのは稼働から約1〜2週間後です。**

> ⚠️ **X（Twitter）は含まれていません。** X API は無料枠が事実上廃止され、
> 検索・タイムライン取得ができません。「特異的なツイート」の検知だけは
> 有料プラン（Basic $200/月〜）を契約しないと実現できないため、今回は見送っています。
> 契約する場合は `tools/news/src/sources/` に `x.mjs` を追加すれば同じ枠組みに乗ります。

---

## セットアップ（初回のみ）

> ### ⚠️ APIキーの取り扱い
>
> APIキーやアプリパスワードは、**GitHub の設定画面にご自身で直接入力してください。**
>
> - **チャット（Claude との会話）に貼らないでください。** 会話は記録として残るため、
>   キーがログに含まれてしまいます。
> - **リポジトリのファイルに書かないでください。** コミットすると履歴に永久に残り、
>   あとから消しても復元できてしまいます。設定ファイルにキーを書く場所はありません。
> - 誰かに渡す必要は一切ありません。登録画面はあなたしか触りません。
>
> 登録後は GitHub の画面上でも二度と表示されず（差し替えのみ可能）、
> Actions のログに出力されても自動でマスクされます。
>
> 万一どこかに貼ってしまった場合は、**そのキーを発行元で失効させて作り直してください。**
> Gmail アプリパスワードは <https://myaccount.google.com/apppasswords> から削除、
> Spotify / Google Cloud / Anthropic も各コンソールから失効できます。

### 1. Gmail のアプリパスワードを作る（必須・5分）

送信元として Gmail を使います。通常のパスワードではなく **アプリパスワード** が必要です。

1. <https://myaccount.google.com/security> を開く
2. **2段階認証プロセス** を有効にする（未設定の場合）
3. <https://myaccount.google.com/apppasswords> を開く
4. アプリ名に `Daily News Brief` などと入力して作成
5. 表示された **16桁の文字列**（スペースは詰めてよい）を控える

### 2. Spotify の認証情報を取る（推奨・3分・無料）

1. <https://developer.spotify.com/dashboard> にログイン
2. **Create app** → 名前は任意、Redirect URI は `http://localhost:3000`（使いませんが必須）
3. **Which API/SDKs are you planning to use?** で **Web API** にチェック
4. 作成後 **Settings** から **Client ID** と **Client secret** を控える

### 3. YouTube Data API キーを取る（推奨・5分・無料）

1. <https://console.cloud.google.com/> でプロジェクトを作成
2. **APIとサービス → ライブラリ** で `YouTube Data API v3` を有効化
3. **APIとサービス → 認証情報 → 認証情報を作成 → APIキー**
4. 作成されたキーを控える（**キーを制限** から YouTube Data API v3 のみに絞ると安全）

> クォータは1日10,000ユニット。アーティスト1組あたり約102ユニット消費するので、
> **90組程度まで**なら無料枠で回ります。

### 4. Anthropic API キーを取る（推奨・2分）

日本語の要約とキュレーションに使います。無くても配信はされますが、
その場合は「新着見出しの一覧」だけになります。

1. <https://console.anthropic.com/settings/keys> で API キーを作成
2. 控える

> **費用の目安:** 1回あたり入力25k / 出力4k トークン程度。
> Claude Opus 5（$5 / $25 per MTok）で **1日 約$0.22、月20営業日で約$4.5** です。

### 5. GitHub にシークレットを登録する

<https://github.com/eiken0216/claude/settings/secrets/actions> を開きます
（リポジトリの **Settings → Secrets and variables → Actions**）。

**Secrets タブ** で `New repository secret` を押し、Name と Secret を入力して
`Add secret`。これを1つずつ、6回繰り返します。**Name は下表のとおり正確に**入れてください
（大文字・アンダースコアまで一致している必要があります）:

| Name | Value |
| --- | --- |
| `SMTP_USER` | 送信元の Gmail アドレス |
| `SMTP_PASS` | 手順1のアプリパスワード（16桁） |
| `SPOTIFY_CLIENT_ID` | 手順2の Client ID |
| `SPOTIFY_CLIENT_SECRET` | 手順2の Client secret |
| `YOUTUBE_API_KEY` | 手順3のAPIキー |
| `ANTHROPIC_API_KEY` | 手順4のAPIキー |

**Variables タブ**（任意。未設定なら既定値が使われます）:

| Name | 既定値 | 用途 |
| --- | --- | --- |
| `MAIL_TO` | `eiken.tezuka@sonymusic.co.jp` | 宛先。カンマ区切りで複数指定可 |
| `MAIL_FROM` | `Daily Brief <SMTP_USER>` | 差出人の表示名 |
| `SMTP_HOST` | `smtp.gmail.com` | Gmail 以外を使う場合 |
| `SMTP_PORT` | `587` | 〃 |
| `ANTHROPIC_MODEL` | `claude-opus-5` | 使用モデル |
| `ANTHROPIC_EFFORT` | `high` | 推論の深さ（`low`〜`max`）。下げるとコスト減 |

### 6. 担当アーティストを登録する

`tools/news/config/artists.json` を編集します。IDは検索スクリプトで調べられます:

```bash
cd tools/news
npm install
export SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... YOUTUBE_API_KEY=...
npm run find-artist -- "アーティスト名"
```

出力された JSON を `artists` 配列に追加します:

```json
{
  "artists": [
    {
      "name": "アーティストA",
      "slug": "artist-a",
      "enabled": true,
      "spotifyId": "1a2b3c...",
      "youtubeChannelId": "UCxxxx...",
      "ugc": true,
      "ugcQuery": null,
      "news": true,
      "newsQuery": null
    }
  ]
}
```

> **短い名前や一般名詞と紛れる名前**（例: `Ado`）は、そのままだと無関係な記事を拾います。
> `newsQuery` に `"Ado" 音楽` のように絞り込み語を、`ugcQuery` にも同様の語を指定してください。

### 7. 動作確認

**Actions タブ → Daily News Brief → Run workflow** で手動実行できます。
`dry_run` を **true** にすると、メールを送らずにログ上で本文だけ確認できます。
問題なければ `dry_run` を false にして1通送ってみてください。

---

## 運用

### 配信時刻を変える

`.github/workflows/daily-news.yml` の cron を編集します（**UTC 表記**）:

```yaml
- cron: '0 23 * * 0-4'   # 平日 08:00 JST（= 前日 23:00 UTC、日〜木）
```

| したいこと | cron |
| --- | --- |
| 平日 07:00 JST | `0 22 * * 0-4` |
| 平日 09:00 JST | `0 0 * * 1-5` |
| 毎日 08:00 JST | `0 23 * * *` |

> GitHub Actions の cron は混雑時に数分〜十数分遅れることがあります（GitHub 側の仕様）。

### ニュースソースを足す / 減らす

`tools/news/config/feeds.json` を編集します。

- 通常の RSS/Atom: `{ "name": "媒体名", "url": "https://...", "enabled": true }`
- Google ニュース検索: `{ "name": "表示名", "google": "検索クエリ", "enabled": true }`

`enabled: false` にすると取得しません。取得に失敗したソースはスキップされ、
メール末尾に理由が出ます（配信そのものは止まりません）。

### 異常値の感度を変える

`tools/news/src/index.mjs` の `METRICS` で指標ごとに設定できます。
判定の既定値は `tools/news/src/anomaly.mjs` の `DEFAULTS`:

```js
minSamples: 6,   // これ未満の日数では判定しない
window: 21,      // ベースラインに使う直近の観測数
z: 2.0,          // これを超えたらスパイク。厳しくするなら 2.5〜3.0
```

### 蓄積されるデータ

```
data/
├── artists/<slug>/history.jsonl   日次スナップショット（1日1行）
└── digests/YYYY-MM-DD.md          配信した内容
```

毎回の実行後、GitHub Actions が自動でコミットします。
`history.jsonl` を消すとベースラインがリセットされ、再び6日ぶん貯まるまで判定が止まります。

---

## トラブルシューティング

| 症状 | 原因と対処 |
| --- | --- |
| メールが届かない | Actions のログで `送信しました` が出ているか確認。出ていなければ `SMTP_USER` / `SMTP_PASS` 未設定。出ているのに届かないなら Outlook の迷惑メールフォルダを確認し、差出人を許可リストに追加 |
| `Invalid login: 535` | アプリパスワードが違う。通常のGoogleパスワードでは通りません。スペースを詰めて再登録 |
| 指標が全部「ベースライン構築中」 | 正常です。6営業日ぶん貯まると判定が始まります |
| 要約が英語見出しの羅列になる | `ANTHROPIC_API_KEY` が未設定か、API 呼び出しが失敗しています。メール末尾に理由が出ます |
| 特定の媒体が毎回「取得できなかった」に出る | その媒体がRSS配信を止めたか、botを弾いています。`feeds.json` で `enabled: false` にするか、`google` 検索に置き換えてください |
| YouTube が `quotaExceeded` | 1日10,000ユニットを超過。アーティスト数を減らすか、一部の `ugc` を `false` に |
| ワークフローが `Permission denied` で失敗 | Settings → Actions → General → Workflow permissions を **Read and write permissions** に |

---

## ローカルでの確認

```bash
cd tools/news
npm install
npm test                                     # 異常値検知のテスト
npm run dry-run                              # メールを送らず本文を表示
SMTP_USER=... SMTP_PASS=... npm run send     # 実際に送信
```
