---
title: "ミンヒジン(민희진)プロデュース力 研究 / 擬似ミンヒジンチャットボット プロジェクト"
aliases:
  - "ミンヒジン(민희진)プロデュース力 研究 / 擬似ミンヒジンチャットボット プロジェクト"
category: "リサーチ・分析"
project: "ミン・ヒジン研究"
created: 2026-08-03
source_repo: eiken0216/claude
source_branch: claude/min-heejin-chatbot-research
source_path: "research/min-heejin/README.md"
tags:
  - ai-reference
  - リサーチ-分析
  - ミンヒジン
  - KPOP
  - プロデュース研究
---

# ミンヒジン(민희진)プロデュース力 研究 / 擬似ミンヒジンチャットボット プロジェクト

元SMアートディレクター・元ADOR代表・NewJeansプロデューサーであるミンヒジンの哲学・嗜好・戦略を一次資料から調査し、彼女の人格を模したチャットボットを構築するための研究リポジトリ。

## ディレクトリ構成

```
research/min-heejin/
├── README.md                 ← このファイル
├── sources/                  ← 一次資料(動画トランスクリプト・メタデータ)
│   ├── motv-curator-part1-jzsvIQ4SsvE.md   MoTV 5월 큐레이터 민희진 1부 (59分)
│   ├── motv-curator-part2-ESruaSog1KA.md   同 2부 (61分)
│   └── motv-curator-part3-WnwBXbcoh9w.md   同 3부 (57分)
├── analysis/                 ← 検証済み分析ノート(引用・検証ノート付き)
│   ├── 01-motv-part1-findings.md           1部: 5視点 112項目
│   └── 02-motv-part2-3-findings.md         2・3部: 5視点 130項目
└── persona/
    └── minheejin-persona-v1.md             ← チャットボット用ペルソナ仕様書 v1
```

## 分析の方法

各動画の韓国語自動字幕トランスクリプトを取得し、5視点(哲学・価値観/美的嗜好/戦略・プロデュース手法/人物像・話し方/重要語録)の並列分析エージェントで抽出、その全項目を別の検証エージェントが原文と照合(引用の実在・話者帰属・捏造チェック)する二段構成で作成。1部はさらに網羅性チェック(completeness critic)を実施。

- 総findings: 242項目(grounded 241 / 要修正 1 — 修正内容は検証ノートに記載)
- 引用はすべて韓国語原文の逐語コピー(自動字幕由来の誤字を含む)

## 次のステップ候補

1. 追加ソースの収集(ユ・クイズ、過去の雑誌ロングインタビュー、記者会見)
2. ペルソナ仕様書 → チャットボットのシステムプロンプト化
3. 語録DB(質問タイプ→引用マッピング)の構造化
4. 応答例の作成と本人らしさの評価(눈높이テスト)
