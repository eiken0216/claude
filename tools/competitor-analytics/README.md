# 競合アーティスト分析 — データソース調査結果とアクセスツール

競合アーティストのサブスク再生数などを分析するための各データソースについて、
Claude Code のリモート実行環境からアクセスできるかを検証した結果と、
検証に使った（今後の自動化の土台になる）スクリプト。

検証日: 2026-07-11（ネットワークポリシー緩和後）

## 判定サマリ

| ソース | 判定 | 備考 |
|---|---|---|
| GfK Planet Music | ✅ 使える | ID/PW でログイン成功、Rankings 画面表示まで確認（`gfk.mjs`） |
| YouTube Charts | ✅ 使える | JP 週間 Top100 の全行が取得できることを確認 |
| Melon Chart | ✅ 使える | サーバーレンダリングで曲名まで取得可 |
| Wikipedia PV 数 | ✅ 使える | pageviews ツールの裏にある Wikimedia REST API を直接叩くのが確実。言語別（langviews 相当）も同 API で可 |
| JOYSOUND | ✅ 使える | 楽曲ページ表示 OK（詳細デモグラの深さは楽曲・会員状態による） |
| kworb.net（代替） | ✅ 使える | Spotify チャートの公開ミラー。国別 日次/週次 が無ログインで取れる |
| Spotify Charts 公式 | △ 要ログイン | ページは開くがチャート本体は Spotify アカウントログインが必要。kworb で代替可 |
| NAVER DataLab | △ 自動化必要 | ページ・検索フォームは表示 OK。検索実行の自動操作は未実装 |
| TikTok Top50/Viral50 | △ 要調査 | `/playlist-music/` URL は 404。`/music/` 形式でページは開くが「楽曲が見つかりません」表示。bot 対策・地域制限の可能性 |
| Spotify アーティストページ | △ 未確認 | Web プレイヤーの描画が重く月間リスナー未取得。上位 5 都市はログイン後表示の可能性 |
| Google トレンド | ❌ ほぼ不可 | データセンター IP のため 429（レート制限）。手元 PC での閲覧か有償 API（SerpAPI 等）が現実的 |
| QlonoLink (= GrooveForce Analytics) | ✅ 使える | 手元ブラウザの localStorage（Cognito トークン）を注入してダッシュボード表示まで確認（`qlono.mjs`）。「比較分析／ランキング／お気に入り」が閲覧可 |
| GFA (GrooveForce) | 🔒 未確認 | QlonoLink と同一製品。同じ手順（GFA を開いた状態の localStorage）で入れる見込み |
| Chrome 拡張（KOLSprite 等） | ❌ 対象外 | 手元ブラウザ用のツール。この環境では使えない |

## 使い方

```bash
cd tools/competitor-analytics
npm install

# 全ソースの疎通チェック
node check-sites.mjs

# GfK にログインして Rankings 画面を開く（スクリーンショット保存）
GFK_EMAIL=SMM.GFKxx@sonymusic.co.jp GFK_PASSWORD=... node gfk.mjs

# QlonoLink / GrooveForce Analytics を開く（要 localStorage 書き出しファイル）
QLONO_LS_FILE=/path/to/qlono_localstorage.txt node qlono.mjs
```

認証情報・トークンはコミットしないこと（環境変数／ファイルで渡す。`.gitignore` 済み）。

### QlonoLink / GFA の localStorage 取得手順

Cookie ではなく localStorage に Cognito トークンを持つため、手元 Chrome で:

1. 対象サイト（QlonoLink または GFA）にログイン済みで開く
2. `F12` → Console で `copy(JSON.stringify(localStorage))`
3. メモ帳に貼り付け → `.txt` 保存 → `QLONO_LS_FILE` に指定

id/access トークンは約1時間で失効するが、refreshToken 同梱なら自動更新される。
更新トークンが失効したら取り直し。

## この環境固有の技術メモ

- 通信は egress プロキシ経由。プロキシのアドレスは `HTTPS_PROXY` 環境変数に入っている
  （ポートはセッションごとに変わるのでハードコードしない）。
- **Chromium の TLS はプロキシと相性が悪く、ClientHello 直後に接続リセットされる**
  （curl や Node の HTTP スタックは通る）。回避策として、Playwright の
  `context.route()` で全リクエストを `route.fetch()`（Node 側）に迂回させる。
  実装は `lib/browser.mjs` に共通化してある。
- Wikipedia PV は UI ツールではなく REST API を直接叩く:
  `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/<project>/all-access/user/<記事名>/daily/<開始YYYYMMDDHH>/<終了YYYYMMDDHH>`

## 次のステップ候補

- GfK: Rankings/Analyzer の内部 API を特定して、アーティスト/楽曲の再生数を
  CSV に落とす自動レポート化（tiktok-report と同じ形式）
- GFA / QlonoLink: 認証情報をもらってログイン自動化
- kworb + YouTube Charts + Wikipedia PV を束ねた週次競合レポート
