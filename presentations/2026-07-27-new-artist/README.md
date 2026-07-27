# 新人アーティスト プレゼン資料（2026-07-27 / SMAR1 手塚）

アソシエイテッドレコーズ A&R 新人発表会の提出資料。1組5分 × 3組。

## 紹介する3組（すべてレーベル未所属）

| No | アーティスト | 区分 | 主要フォロワー |
|---|---|---|---|
| 1 | Vivanz Eden（Vo. 菊地諒真） | 3ピースバンド | TikTok 11.98万 / Spotify 月間14万 |
| 2 | Ryudai（青木龍大） | ダンサー・振付 | TikTok 200万 / Instagram 13.1万 |
| 3 | yuuna | ダンサー（大阪拠点） | TikTok 180万 / Instagram 46.2万 |

数値は 2026-07-26 時点で TikTok / YouTube / Spotify から実地取得。

## 成果物

- `新人プレゼン資料_2026-07-27.pptx` — 17枚のスライド。アーティスト写真と参考動画のサムネイル入り。Google Drive にアップロードすると Google スライドに変換される。
- `新人プレゼン資料_2026-07-27.docx` — 全文資料（5分の時間配分つき台本、提出シート記入用の表を含む）。
- Google ドキュメント版は Drive 上に作成済み。

## 再生成

```bash
cd scripts
npm install pptxgenjs docx
python3 fetch_images.py            # アーティスト写真・サムネイルを取得（images/ と image_manifest.json）
node make_deck.js                  # → .pptx
node make_doc.js                   # → .docx
python3 fit_check.py <deck>.pptx   # スライドのはみ出し検査
python3 render_preview.py <deck>.pptx 1,2,3 prev   # レイアウトのプレビュー画像
```

この環境では LibreOffice の変換が動かないため、目視確認は `render_preview.py`
（python-pptx + PIL による近似レンダラ）で行っている。

`data.js` が唯一の情報源。ここを直せば .pptx と .docx の両方に反映される。
追加候補（Ryudai / yuuna と同系統のアーティスト）は `ARTISTS` に追記する。

## 調査スクリプト

- `tt_deep.py --handle <handle>` — TikTok のアカウント指標と動画別の再生/いいね/コメント/シェア/保存を取得
- `yt_fetch.py <handle>` — YouTube の登録者数・総再生数と本編/Shorts の一覧を取得
- `fetch_images.py` — アーティスト写真と参考動画サムネイルを取得して JPEG に正規化

写真は各アーティストの公開アカウント（TikTok プロフィール画像・動画サムネイル）と
Spotify のアーティスト写真から取得。社内検討用。

`research/` に取得した生データを置いている。
