# 新人アーティスト プレゼン資料（2026-07-27 / SMAR1 手塚）

アソシエイテッドレコーズ A&R 新人発表会の提出資料。1組5分 × 4組。

## 紹介する4組（すべてレーベル未所属）

| No | アーティスト | 区分 | 主要フォロワー |
|---|---|---|---|
| 1 | saewool | 弾き語りシンガー（韓国拠点） | TikTok 8.45万 / YouTube 5.79万 |
| 2 | Ryudai（青木龍大） | ダンサー・振付 | TikTok 200万 / Instagram 13.1万 |
| 3 | yuuna | ダンサー（大阪拠点） | TikTok 180万 / Instagram 46.2万 |
| 4 | Vivanz Eden（Vo. 菊地諒真） | 3ピースバンド | TikTok 11.98万 / Spotify 月間14万 |

数値は 2026-07-26 時点で TikTok / YouTube / Spotify から実地取得。

## 成果物

- `新人プレゼン資料_2026-07-27.pptx` — 21枚のスライド。Google Drive にアップロードすると Google スライドに変換される。
- `新人プレゼン資料_2026-07-27.docx` — 全文資料（5分の時間配分つき台本、提出シート記入用の表を含む）。
- Google ドキュメント版は Drive 上に作成済み。

## 再生成

```bash
cd scripts
npm install pptxgenjs docx
node make_deck.js   # → .pptx
node make_doc.js    # → .docx
python3 fit_check.py <deck>.pptx   # スライドのはみ出し検査
```

`data.js` が唯一の情報源。ここを直せば .pptx と .docx の両方に反映される。
追加候補（Ryudai / yuuna と同系統のアーティスト）は `ARTISTS` に追記する。

## 調査スクリプト

- `tt_deep.py --handle <handle>` — TikTok のアカウント指標と動画別の再生/いいね/コメント/シェア/保存を取得
- `yt_fetch.py <handle>` — YouTube の登録者数・総再生数と本編/Shorts の一覧を取得

`research/` に取得した生データを置いている。
