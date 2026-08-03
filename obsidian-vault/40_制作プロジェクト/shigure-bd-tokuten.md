---
title: "凛として時雨「失神蠍 TOUR 2025 Tornado in Budokan」BD購入特典 解禁素材"
aliases:
  - "凛として時雨「失神蠍 TOUR 2025 Tornado in Budokan」BD購入特典 解禁素材"
category: "制作プロジェクト"
project: "凛として時雨 BD購入特典"
created: 2026-07-08
source_repo: eiken0216/claude
source_branch: claude/shigure-bd-bonus-copy-fc1grl
source_path: "deliverables/shigure_bd_tokuten/README.md"
tags:
  - ai-reference
  - 制作プロジェクト
  - 凛として時雨
  - 特典制作
---

# 凛として時雨「失神蠍 TOUR 2025 Tornado in Budokan」BD購入特典 解禁素材

解禁予定：2026年7月9日（木）18:00

## 内容

| パス | 内容 |
|---|---|
| `HP文言_失神蠍BD購入特典.md` | オフィシャルHP掲載用の文言（本番テキスト＋編集メモ） |
| `output/特典レイアウト_SAMPLE.png` | 4特典まとめのレイアウト画像（1920x1440・4:3、SAMPLE透かし入り） |
| `output/特典レイアウト_SAMPLE_editable.svg` | レイアウトのベクターデータ（テキスト・オブジェクト編集可。Illustratorで開いて .ai 保存可） |
| `output/特典レイアウト_SAMPLE.pdf` | レイアウトのPDF（見た目再現重視・フォント埋め込み。Illustratorでそのまま開ける） |
| `output/特典単体_*.png` | 各特典の単体画像（元画像の白余白トリム＋SAMPLE透かし、長辺最大2400px） |
| `layout/tokuten_layout.html` | まとめレイアウトのHTMLテンプレート |
| `layout/render.mjs` | PNG書き出しスクリプト（Playwright使用） |
| `layout/assets/` | 実サンプル画像（ベンダー支給のDropbox素材） |

## 画像の状態（2026/7/8時点）

- `amazon.png` … ビジュアルシート5枚セット（支給ファイル名は「Amazon_メガジャケ.png」
  だったが、中身はビジュアルシート5枚の絵柄。名称はベンダー側の誤記と思われる）
- `sevennet.jpg` … サコッシュ
- `rakuten_1.jpg`〜`rakuten_3.jpg` … スマホショルダー（3カット。まとめレイアウトでは
  絵柄の見やすさ優先で _1(装着イメージ) と _3(デザインアップ) の2カットを使用。
  単体画像は3カットすべて書き出し）
- `ouenten.webp` … 応援店 B2ポスター（2026/7/8 チャットで受領）

絵柄の差し替えが発生した場合は、該当ファイルを `layout/assets/` に上書きして
下記を再実行すると、レイアウト・単体とも自動反映される。

```sh
cd layout
NODE_PATH=/opt/node22/lib/node_modules node render.mjs
```

※ この作業環境からは dropbox.com への通信がネットワークポリシーで
ブロックされているため、Dropboxリンクから直接取得できない。
チャット添付または Google Drive 経由で受け渡しする。
