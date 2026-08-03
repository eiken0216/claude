---
title: "海外先行アーティスト発掘スクリプト"
aliases:
  - "海外先行アーティスト発掘スクリプト"
category: "スキル・ワークフロー"
project: "海外先行アーティスト発掘ツール"
created: 2026-07-26
source_repo: eiken0216/claude
source_branch: claude/emerging-artist-accounts-search-mrh2wv
source_path: "tools/artist-discovery/README.md"
tags:
  - ai-reference
  - スキル-ワークフロー
  - ツール
  - 新人発掘
---

# 海外先行アーティスト発掘スクリプト

「国内より海外のエンゲージが上回っている、未所属っぽい音楽アカウント」を
機械的に洗い出すための一式。外部APIキー不要（YouTube InnerTube と TikTok の
公開エンドポイントを直接叩く）。

## YouTube

```
node discover.mjs        # 日本語+英語クエリで候補チャンネルを収集
node discover2.mjs       # クエリを拡張して candidates.json に追記
node discover3.mjs       # ID/TH/TL/ES/PT/KO/VI/ZH/RU で検索（海外導線からの発掘）
node screen.mjs          # 各chの上位動画のコメントを取得し海外比率を算出（差分実行）
node ytmeta.mjs batch ids.json chmeta.json   # チャンネル概要・リンク・登録者
node merge.mjs           # コメント比率とメタを結合
node filter.mjs          # 日本人本人 / 非プレイリスト に絞り final_yt.json を出力
```

海外比率は「コメント本文の文字種」で判定する（かな→ja、ハングル→ko、
タイ文字→th、キリル→ru、漢字のみ→zh、ラテン→latin …）。日本語コメントは
ほぼ必ずかなを含むので、漢字のみの中国語と混ざらない。

## TikTok

```
node tt.mjs screen                 # tt_handles.json のハンドルを一括スクリーニング
node tt.mjs screen handle1 handle2 # 個別指定
```

- プロフィール統計: `tiktok.com/@handle` の `__UNIVERSAL_DATA_FOR_REHYDRATION__`
- 動画一覧: `tiktok.com/embed/@handle`（署名不要でIDが取れる）
- 動画統計: `tiktok.com/@handle/video/<id>`
- コメント: `api/comment/list/`（`comment_language` が返るので言語判定が正確）

TikTok の検索はログイン必須のため、候補ハンドルは YouTube 概要欄からの逆引きや
外部リストで作る。`TIKTOK_COOKIE` があれば検索からの直接発掘も可能。

## 出力の読み方

`海外% = 日本語以外のコメント / 言語判定できたコメント`。
基準として、楽音(@sasasasasasa078) が 83.1%、国内バズ型の弾き語りアカウントは 0〜2%。
