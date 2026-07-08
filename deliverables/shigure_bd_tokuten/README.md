# 凛として時雨「失神蠍 TOUR 2025 Tornado in Budokan」BD購入特典 解禁素材

解禁予定：2026年7月9日（木）18:00

## 内容

| パス | 内容 |
|---|---|
| `HP文言_失神蠍BD購入特典.md` | オフィシャルHP掲載用の文言（本番テキスト＋編集メモ） |
| `output/特典レイアウト_SAMPLE.png` | 4特典まとめのレイアウト画像（1920x1080、SAMPLE透かし入り） |
| `output/特典単体_*.png` | 各特典の単体画像（1600x1200、SAMPLE透かし入り） |
| `layout/tokuten_layout.html` | まとめレイアウトのHTMLテンプレート |
| `layout/render.mjs` | PNG書き出しスクリプト（Playwright使用） |
| `layout/assets/` | 実サンプル画像の置き場（下記参照） |

## 実サンプル画像の差し替え手順

現状の画像スロットはプレースホルダー。Dropboxのサンプル画像が手に入り次第、
`layout/assets/` に以下のファイル名で配置して再実行すると、実画像入りの
レイアウト＋単体画像（いずれもSAMPLE透かし付き）が `output/` に生成される。

- `amazon.png`（または .jpg）… ビジュアルシート5枚セット
- `sevennet.png` … サコッシュ
- `rakuten.png` … スマホショルダー
- `ouenten.png` … B2ポスター

```sh
cd layout
NODE_PATH=/opt/node22/lib/node_modules node render.mjs
```

※ この作業環境からは dropbox.com への通信がネットワークポリシーで
ブロックされているため、Dropboxリンクから直接取得できない。
チャットに画像を添付するか、Google Drive（「特典」フォルダ等）に
アップロードしてもらえれば取り込み可能。
