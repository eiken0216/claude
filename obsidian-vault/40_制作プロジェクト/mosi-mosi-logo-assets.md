---
title: "文字素材（透過PNG）"
aliases:
  - "文字素材（透過PNG）"
category: "制作プロジェクト"
project: "楽音「mosi mosi?」ダンスパフォーマンス映像"
created: 2026-07-31
source_repo: eiken0216/claude
source_branch: claude/mosi-mosi-dance-performance-nrcri1
source_path: "deliverables/mosi-mosi_Dance-Performance-Video/06_logo_assets/README.md"
tags:
  - ai-reference
  - 制作プロジェクト
  - 楽音
  - ロゴ素材
---

# 文字素材（透過PNG）

サムネイルに使用した文字素材です。すべて背景透過。

## mosi mosi?

街頭広告データ（`IMG_9617 (1).png`）から切り出したものです。**元データそのまま**で、
かぶっていた青い雫と微細なゴミだけ除去しています。

| ファイル | |
|---|---|
| `mosi-mosi_lockup.png` | 1602 x 891 |
| `mosi-mosi_lockup_white-outline.png` | 白フチ付き（サムネイルで使用している状態） |

## Dance Performance

「mosi mosi?」と同じ質感で**新規に描き起こした**ものです。ストローク骨格をラウンドペンで
描き、手ブレ・ベースラインの跳ね・1文字ごとの回転を加えたうえで、ピンクと同じ
ざらついた黄色フチ（`#F3E67A`）を付けています。

4586 x 546 px（サムネイルで使用しているサイズの約5倍）。字形はサムネイルと同一です。

| ファイル | 塗り | |
|---|---|---|
| `Dance-Performance_cyan.png` | `#20BDE2` | A案で使用 |
| `Dance-Performance_violet.png` | `#5E1ED8` | B案で使用 |
| `Dance-Performance_pink.png` | `#D61E77` | 「mosi mosi?」と同系。揃えたい場合に |

それぞれ `_white-outline.png` が白フチ付き版です。白背景に置くならフチ無し、
写真や色の上に置くならフチ付きが読みやすくなります。

## 彩度について

**全素材の彩度を上げたうえで、同じ水準にそろえてあります**（HSVのS、上位60%点で 0.86）。

調整前は素材ごとに **0.398〜0.833（2.09倍の開き）** があり、ラクガキが文字に対して
明らかに沈んでいました。調整後は **0.853〜0.864（1.01倍）** です。

- 動かしたのは彩度のみで、**色相と明度は変えていません**
- カーブは `S' = 1 - (1-S)^p`。S=0 と S=1 を固定するので、白いハイライトが色に転ばず、
  濃い部分も飽和して潰れません
- 素材ごとにゲインを変えています。一律に何%増しでは、元の2.09倍の開きがそのまま残るためです
- ただし**黄色フチだけは共通の設計要素**なので、「Dance Performance」3色は
  後段で補正するのではなく、最初から目標彩度の色（フチ `#F3DD22`）で描き直しています。
  3色とも黄色は `#F1DC21` 前後・S=0.861 で一致しています

> 字数や文言を変えたい場合（`Dance Practice` `Performance Video` など）は
> 同じ質感で描き直せます。言っていただければ出します。

## 落書き

同じ広告データからの切り出しです。サムネイルではUFOのみ使用しています。

`doodle_ufo` / `doodle_alien` / `doodle_swirl_cyan` / `doodle_swirl_pink` /
`doodle_lightning_yellow` / `doodle_droplet`
