---
name: artist-analytics
description: Pull an artist's subscription/streaming, web, and SNS signals from every available source in one shot, then synthesize a combined analysis dashboard. Use when the user asks to analyze/研究 an artist across data sources at once (e.g. "原因は自分にある。を分析して", "このアーティストのサブスク・SNS・Web全部まとめて分析", "アーティスト分析"). Covers GfK streaming, GrooveForce/QlonoLink (SME internal), Wikipedia PV, iTunes/Apple charts; documents the manual-only sources.
---

# アーティスト分析（1セット）

アーティスト名を投げるだけで、**サブスク（国内再生数）＋Web（お茶の間/関心）＋チャート＋海外再生＋SNS/デモグラ**を
可能な限り自動収集し、1つの分析ダッシュボードにまとめる。最初の環境調査で「使えるか」を確認した
各ソースを、実データの取得ロジックとして統合したもの。

**基本方針**: どの楽曲も **GfKとクロノ(QlonoLink)の両方を検索**し、**クロノに対象があればクロノを優先**、
**GfKにしか無ければGfK**を使う（クロノはSME配給曲のみ）。**海外再生はクロノでしか見れない**（world_sales 国別）。

## 入力

- **artist**（必須）: アーティスト名（例 `原因は自分にある。`）。無ければ聞く。
- **competitor**（任意）: 比較対象アーティスト（1つ以上）。あれば同じ収集を回して差分分析する。
- **focus**（任意）: 特定楽曲や観点（例「HOT LIMITのUGC戦略」）。

## 認証情報（環境変数／ファイル）

- **GfK**: `GFK_EMAIL` / `GFK_PASSWORD`（第3LGアカウント）。国内 Streamed Unit。
- **QlonoLink/GrooveForce**: `QLONO_LS_FILE`＝ログイン済み手元ブラウザの localStorage 書き出し（`.txt`）。
  取得手順は `tools/competitor-analytics/README.md` 参照。**SME配給アーティストなら検索でヒットする**
  （お気に入り登録の有無に関係なく、`/smeapi/artists?keyword=` で検索→検索結果の `/brand/{id}` を解決）。
  SME配給でないアーティスト（例: 原因は自分にある。）は検索0件＝未取得となり、自動でGfKにフォールバックする。
- 無い認証情報のソースは自動スキップし、レポートに「未取得（理由）」と明記する。**数値は絶対に捏造しない。**

## 手順

作業ディレクトリ: `.claude/skills/artist-analytics`。

1. **初回のみ依存インストール**（`node_modules` が無ければ）:
   ```bash
   cd .claude/skills/artist-analytics && npm install
   ```
   Chromium はプリインストール済み（`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`）。

2. **GfKの最新取り込み週を確認**。GfKは毎週木曜に前週（月〜日）を取り込む。`collect.mjs` の
   `--latest` に最新の「月曜日」を渡す（例: 今日が 2026-07-13 なら最新週は `2026-06-29`）。

3. **収集（1コマンド）**。認証情報を環境に入れて実行:
   ```bash
   GFK_EMAIL=.. GFK_PASSWORD=.. QLONO_LS_FILE=/path/to/qlono_localstorage.txt \
   node scripts/collect.mjs \
     --artist "原因は自分にある。" \
     --gfk "原因は自分にある" \        # GfK検索語。表記ゆれは句点なし等で名寄せ（迷ったら本体名）
     --wiki "原因は自分にある。" \      # ja.wikipedia の記事名
     --itunes "原因は自分にある" \      # iTunesチャート照合語
     --qlono auto \                     # auto=名前でブランド自動解決／<brand_id>指定／off
     --weeks 26 --latest 2026-06-29 \
     --out ../../../../reports/<slug>/data.json
   ```
   - 標準エラーに進捗、標準出力に各ソースの `availability`（ok / skipped / manual / error）が出る。
   - `data.json` に全ソースのデータが入る。**competitor があれば artist を変えて再実行**し、複数JSONを作る。

4. **手動/環境制約ソースを補完（任意・該当時）**。`availability` が `manual` のものは自動化不可:
   - **Google トレンド**: DC-IPは429。手元PC閲覧か有償API（SerpAPI等）。ユーザーに依頼 or スキップ。
   - **NAVER DataLab**（韓国検索量）: K-popのみ関連。未自動化。
   - **JOYSOUND**（歌唱者性年代）: 会員・一定歌唱数の曲のみ。必要なら個別に確認。
   - **TikTok UGC**: `/tiktok-report` スキルで別途取得し、結果を統合。
   - **Spotify 月間リスナー/上位5都市**: ログイン後表示。SMEなら QlonoLink のデモグラ（地域割）で代替可。
   - **Instagram/X フォロワー**: 拡張機能。SMEなら QlonoLink の SNS デモグラで代替。X の正確なデモグラは存在しない。

5. **ダッシュボードを生成**。`data.json`（複数なら全て）を読み、**1枚の統合ダッシュボードHTML**を
   `reports/<slug>/report.html` に作る。**ソース優先順位**（`data.json` の `primaryStreamingSource` 参照）:
   - **国内再生**: クロノ(qlono)にあればクロノを一次ソース、無ければGfK（`primaryStreamingSource`）。
   - **海外再生**: **クロノの `overseasByCountry`（world_sales 国別）のみ**。クロノに無い曲は海外再生は出せない。
   - Wikipedia言語別PV(`langviews`)は**「海外の検索関心」であって再生数ではない**。海外再生とは別枠で（関心の参考として）扱う。
   含める要素（データがある分だけ／無い項目は「未取得」と明記）:
   - サマリKPI（最新週/日の国内再生数＝一次ソース、iTunes/Apple順位、トップ曲）
   - **サブスク推移＝直近3年（GfK月次36ヶ月）**を共通軸に。最新週KPI/WoWはGfK週次(直近8週)。
   - **人気曲5曲の推移（リリース〜現在の全期間）**: SME配給曲は**クロノのデイリー**（`topSongsDaily`）、
     非SMEは**GfK月次**（`topSongsMonthly`、デイリーは非SME不可）。曲別スパークラインで表示。
   - チャート（iTunes/Apple/DSPリアルタイム順位）
   - **海外再生**（クロノ `overseasByCountry` の国別内訳）
   - お茶の間（Wikipedia ja 日次PV＋スパイク）／海外の関心（langviews・best-effort・参考）
   - デモグラ（QlonoLink: 年代・性別）／SNS
   - カタログ上位曲
   - competitor があれば差分分析
   デザインは dataviz / artifact-design スキルに従い、`Artifact` で公開＋PDFエクスポートも添える
   （既存の competitor-analytics レポートと同じ様式）。

6. **要約**をチャットに（ユーザーの言語で）: 主要数値、傾向、差分、未取得ソースとその理由、成果物リンク。

7. **成果物の扱い**: GfK/GrooveForce は第三者ライセンスデータ。レポートHTML・data.json・CSVは
   **リポジトリにコミットしない**（`.gitignore` の `reports/*.html`, `reports/**/*.json` 済み）。
   アーティファクト＋ファイル送付で直接渡す。ツール（scripts）の改善のみコミット。

## キャリア変遷モード（アーティスト軸の年表・視覚化）

「どの頻度でリリースし、どれくらいサブスクが回り、どのキャパのワンマンまでどんな流れで何年か」を
1枚のタイムラインにする。5レーン（**リリース × ライブ会場キャパ × メディア/チャート × サブスク × SNS**）を
時間軸に並べ、マイルストーン間の所要日数と、キャパ到達スピード等を算出する（参考: reports/artist-career-timeline-imase.html）。

手順:
1. **リリース＋タイアップ**: `collect.mjs`（GfK/クロノのカタログ配信日＋クロノ `tieups`。非SMEはWikipediaディスコグラフィ）。
2. **サブスク/SNS/チャート**: `collect.mjs`（一次ソース優先）。
3. **ライブ履歴**: `node scripts/live_history.mjs "<アーティスト名>" ["<slug>/<id>"]`。
   - 同名別人がいると確信一致のみ採用し、曖昧なら**候補を提示**する。正しい actor を `slug/id` で指定し直す。
   - **フェス出演は網羅されるが単独公演(ワンマン)は漏れることがある**。ワンマン/キャパ到達はWikipedia・公式で補完（捏造しない）。
   - 会場キャパは `venues.json` で付与（単独/ツアーのみ。未登録会場は「キャパ未照合」）。
4. **視覚化**: 5レーンのスイムレーン・タイムラインHTMLを生成（キャパはバー幅、マイルストーン間は破線で所要日数）。
5. 算出指標: リリース頻度／デビュー→初ワンマン→Cap500→1500→2500→5000 の各所要日数／各到達点のサブスク水準／複数アーティスト重ね比較。

## ソース対応表（この環境で確認済み）

| ソース | 自動化 | モジュール | 備考 |
|---|---|---|---|
| GfK 国内Streamed Unit | ✅ | `tools/competitor-analytics/gfk_api.mjs` | 週次/**月次(3年trend)**/日次。曲別月次も。要 GFK_EMAIL/PASSWORD |
| 人気曲5曲の推移 | ✅ | qlono `topSongsDaily`／gfk `topSongsMonthly` | SMEはデイリー全期間、非SMEはGfK月次。リリース〜現在 |
| QlonoLink/GFA（SME内部） | ✅ | `tools/competitor-analytics/qlono_api.mjs` | 日次/DSP順位/デモグラ/SNS。要 QLONO_LS_FILE。SME配給アーティストを検索で解決（お気に入り外も可） |
| 海外再生（国別） | ✅ | qlono `overseasByCountry` | **クロノのみ**。world_sales を主要国コードで集計。SME配給曲のみ |
| Wikipedia ja PV（お茶の間） | ✅ | `scripts/wiki.mjs` | 無認証REST |
| Wikipedia 言語別PV（海外の**関心**） | △ best-effort | `scripts/wiki.mjs` | 再生数ではなく検索関心。wikimedia RESTが不安定。参考値 |
| iTunes/Apple チャート | ✅ | `scripts/charts.mjs` | iTunes JP RSS＋QlonoLink DSPリアルタイム |
| ライブ・イベント履歴 | △ best-effort | `scripts/live_history.mjs` | eventernote公演DB。日付/会場/種別。**フェス網羅は強く単独公演は漏れることがある**。同名別人は候補提示 |
| 会場キャパ | 辞書照合 | `scripts/venues.json` | 会場名→キャパの部分一致辞書（別途照合用・要追記）。単独/ツアーのみ対象 |
| 楽曲タイアップ | ✅(SME)/△ | qlono `catalog[].tieups` / Wikipedia | クロノの tieups（genre＋タイトル）。非SMEはWikipedia song記事 |
| Spotify Charts | △ | `scripts/charts.mjs`(kworb) | 公式はログイン。kworbミラーは best-effort |
| YouTube/Melon チャート | △ | （要ブラウザ） | 未統合。必要時に追加 |
| Google Trends | ❌ manual | — | DC-IPは429 |
| NAVER DataLab | ❌ manual | — | 韓国検索量 |
| JOYSOUND 性年代 | ❌ manual | — | 会員/一定歌唱数のみ |
| TikTok UGC | ↔ | `/tiktok-report` | 別スキルで取得し統合 |
| Instagram/X フォロワー | ❌ manual | — | 拡張機能。SMEは QlonoLink デモグラで代替 |

## 注意

- **表記ゆれ**: GfKは同一アーティストが複数表記に分かれる（句点の全角/半角/なし等）。`--gfk` は取りこぼさない
  語を使う（句点なしで名寄せ等）。QlonoLinkはISRC単位で名寄せ済み。
- **QlonoLink**: 検索窓にアーティスト名を入れれば、お気に入り登録外でもSME配給アーティストは解決できる。
  検索0件（`availability.qlono = not-found`）＝SME配給でない可能性が高く、GfK＋Web のみで分析（自動でそうなる）。
  SMEなのに解決できない場合は `--qlono <brand_id>` を手動指定。
- すべて best-effort。取れなかったソースは正直に「未取得」と書き、推測値で埋めない。
