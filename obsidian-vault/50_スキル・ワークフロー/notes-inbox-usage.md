---
title: "notes_inbox — メモの持ち込み場所"
aliases:
  - "notes_inbox — メモの持ち込み場所"
category: "スキル・ワークフロー"
project: "メモ持ち込み場所の使い方"
created: 2026-07-11
source_repo: eiken0216/claude
source_branch: claude/iphone-notes-import-svfvue
source_path: "notes_inbox/README.md"
tags:
  - ai-reference
  - スキル-ワークフロー
  - メモ管理
---

# notes_inbox — メモの持ち込み場所

iPhone のメモ App から書き出したファイルをこのフォルダに置いてください。
`.txt` / `.md` / `.html` / `.enex` / `.eml` に対応しています。
サブフォルダで分けてもOK (サブフォルダ名がメモの「フォルダ」として記録されます)。

置いたら Claude に「メモを全部読み込んで」と言うか `/iphone-notes` を実行
すると、`data/notes/` に正規化されて分析に使われます。

**このフォルダの中身と `data/notes/` は gitignore 済みです** —
生のメモがリポジトリにコミットされることはありません (この README を除く)。

取り出し方の 3 ルート (Gmail 同期 / Mac 一括書き出し / 手動) は
リポジトリ直下の README.md を参照してください。
