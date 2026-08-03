---
title: "otukare — YouTube字幕データ（多言語VTT）"
aliases:
  - "otukare — YouTube字幕データ（多言語VTT）"
category: "制作プロジェクト"
project: "otukare 多言語字幕"
created: 2026-07-08
source_repo: eiken0216/claude
source_branch: claude/youtube-subtitle-timecode-4oxulc
source_path: "subtitles/otukare/README.md"
tags:
  - ai-reference
  - 制作プロジェクト
  - otukare
  - 字幕
  - YouTube
---

# otukare — YouTube字幕データ（多言語VTT）

`otukare`（作詞作曲編曲：向田民子）のYouTube用字幕ファイル一式。
音源からの強制アラインメント（歌詞テキスト × 音声のタイミング自動計測）で
各行のタイムコードを生成し、全言語で同一タイミングを共有しています。

## ファイル

| ファイル | 言語 |
|---|---|
| otukare_captions_ja.vtt | 日本語（原詞） |
| otukare_captions_ja-Latn.vtt | ローマ字 |
| otukare_captions_en.vtt | English |
| otukare_captions_zh-TW.vtt | 繁体字中国語 |
| otukare_captions_zh-CN.vtt | 简体字中国語 |
| otukare_captions_ko.vtt | 한국어 |
| otukare_captions_id.vtt | Bahasa Indonesia |
| otukare_captions_pt.vtt | Português |
| otukare_captions_th.vtt | ไทย |

`timecodes.json` は56行分の [開始, 終了] 秒データ（全言語共通のマスター）。

## 使い方

YouTube Studio → 字幕 → 言語を追加 → 「ファイルをアップロード」で
各言語の .vtt をアップロードしてください。

## 精度メモ

- タイムコードはユーザー調整済みの日本語VTT（captions_jp_re.vtt）を全言語共通のマスターとして使用。

- 歌詞データ出典: Google Sheets「otukare_歌詞翻訳」
