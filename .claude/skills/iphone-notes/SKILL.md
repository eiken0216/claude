---
name: iphone-notes
description: Import ALL notes from the user's iPhone メモ app (Apple Notes) — via Gmail sync, exported files in notes_inbox/, or Google Drive — normalize them into the repo, then generate a 直感カルテ (intuition-chart / AI self-dissection) report that verbalizes recurring themes, tastes, unconscious desires, current mood, avoided problems, and next moves. Use when the user asks to read/import their iPhone memos or notes, or wants the AI自己解剖/直感カルテ analysis (e.g. "メモを全部読み込んで", "メモから自己分析して", "直感カルテを作って").
---

# iPhone メモ → 直感カルテ (self-analysis from Apple Notes)

Adapted from the viral "AI 自己解剖 / 直感カルテ" method (yutori CEO's AI
workflow, shared by @terada_masanobu). The original feeds one's Pinterest
saves to the AI and has it verbalize what the person is drawn to. This
version replaces Pinterest with the user's **entire iPhone メモ (Apple
Notes) collection** — a pile of intuitively written notes is the same kind
of unconscious-interest data.

Two phases: **import** (get every note into `data/notes/`) and **analyze**
(write the 直感カルテ report). Import is idempotent — re-running dedupes.

## Inputs

- **source** (optional): `gmail` | `inbox` | `drive`. If not given, use
  whichever has data: files already in `notes_inbox/` → use them; else try
  Gmail (`label:notes`); else ask the user to pick a route (see below).
- **since** (optional): only feed notes modified after this date into the
  analysis (import still keeps everything).

## Phase 1 — Import

### Route A — Gmail sync (recommended; iPhone only, no computer)

Apple Notes can sync into a Gmail account. One-time setup the USER does on
the iPhone (walk them through it if they haven't):

1. 設定 → アプリ → メール → メールアカウント → Gmail アカウントを追加
   (追加済みなら選択) → **「メモ」を ON**
2. メモ App に「GMAIL」セクションが現れる。
3. iCloud 側の各フォルダで 右上 ⋯ → 「メモを選択」→「すべて選択」→
   「移動」→ GMAIL の Notes フォルダへ。
4. 同期されたメモは Gmail 側に **`Notes` ラベル** の付いたメッセージとして
   現れる。

Caveats to tell the user: locked notes and notes with incompatible
attachments (photos, drawings, scans) may refuse to move — those need
Route B, or individual share-sheet export for a handful.

Then import via the Gmail MCP tools:

1. `mcp__Gmail__search_threads` with query `label:notes` — paginate until
   exhausted. (If zero results, also try `in:anywhere subject:* label:notes`
   variants before concluding the sync isn't set up.)
2. For each thread, `mcp__Gmail__get_thread` / `mcp__Gmail__get_message`.
   Each message is one note: subject = title, date header = timestamp,
   body = note text (may be HTML).
3. Write each note as a file `notes_inbox/gmail/<NNNN>.md` shaped like:

   ```markdown
   ---
   title: <subject>
   folder: Gmail/Notes
   created: <date header, ISO>
   modified: <date header, ISO>
   ---

   <body as plain text>
   ```

4. Continue to **Normalize** below.

### Route B — Mac bulk export

If the user has a Mac with the same iCloud account, they run:

```bash
osascript .claude/skills/iphone-notes/scripts/export_notes_mac.applescript ~/Desktop/notes_export
```

That writes one HTML file per note (with a `notes-meta` comment carrying
title/folder/dates; locked notes are skipped and counted). They then get
the folder's contents into `notes_inbox/` (commit-less drop, or via Google
Drive → Route C).

### Route C — files the user already has

Any of `.txt .md .markdown .html .htm .enex .eml` placed in `notes_inbox/`
(subfolders fine — subfolder names become the note's folder). If the user
uploaded an export to Google Drive instead, find it with
`mcp__Google_Drive__search_files`, read each file's content, and write it
into `notes_inbox/drive/` preserving names, then normalize.

### Normalize

From the repo root:

```bash
node .claude/skills/iphone-notes/scripts/normalize_notes.mjs --in notes_inbox --out data/notes
```

Writes (all gitignored — raw notes never get committed):

- `data/notes/notes.jsonl` — one JSON object per note (full body)
- `data/notes/index.csv` — id, title, folder, created, modified, chars, source
- `data/notes/md/<id>-<slug>.md` — per-note markdown

The script dedupes exact duplicates (same title+body), so combining
routes A+B is safe. Report the printed summary (note count, date range,
skipped duplicates) to the user. **If 0 notes were found, stop and help
the user with one of the routes — do not fabricate an analysis.**

## Phase 2 — 直感カルテ (the analysis)

Read `data/notes/index.csv` first for the overall shape, then read the
note bodies (`notes.jsonl` or the `md/` files — batch-read, don't skip;
if the corpus is huge, prioritize by recency but sample every folder).

### Optional enrichment (mirrors the original method)

The original combines saved images with music, videos, and current
worries. Offer these, but proceed without them if declined/unavailable:

- **Music**: `mcp__Spotify__get_currently_playing` / recent listening.
- **Schedule**: `mcp__Google_Calendar__list_events` for the last ~2 weeks.
- **The user's own words**: ask one question — 「いま一番気になっている
  悩みや仕事のテーマがあれば一言で」.

### Write the report

Produce `reports/self/<YYYY-MM-DD>-kartei.md` in the user's language
(Japanese unless they use another). Ground EVERY claim in the notes —
quote short excerpts and counts as evidence; never invent content. Use
this structure:

```markdown
# 直感カルテ — <YYYY-MM-DD>

> 素材: iPhone メモ <N>件 (<最古>〜<最新>) + <追加素材があれば>

## 1. データの全体像
件数・期間・フォルダ/ジャンル分布・メモの長さの傾向

## 2. 繰り返し現れるテーマ
頻出する話題・言葉・関心の上位 5〜10。各テーマに件数と代表的な引用。

## 3. 好み・美意識の言語化
何に惹かれ、何を「良い」と感じているか。保存・記録しているものの
共通項と、惹かれている理由の仮説。

## 4. 無意識の欲求
何度も書いているのに実行されていないこと。時間を置いて戻ってくる話題。

## 5. 今の気分と悩み
直近 1〜3 ヶ月のメモのトーンから読み取れる状態。

## 6. 避けている課題
途中で止まっているメモ、立ち消えたテーマ、書き方が急に浅くなる話題。

## 7. 進むべき方向
1〜6 の統合。方向性の提案と、今週できる最初の一歩を 3 つ。
```

Tone: 断定しすぎない (hypotheses, not verdicts); kind but direct; the
value is in specificity, not flattery.

### Deliver

1. Post a tight summary in chat: the 2–3 strongest findings + the
   suggested first steps, and where the full report lives.
2. **Ask before committing** — the report is personal. If the user says
   yes, commit only `reports/self/` (raw notes stay ignored).
3. Offer the optional final step from the original method: turn the
   kartei's keywords into a single visual board via Canva
   (`mcp__Canva__generate-design`). Only do it if the user wants it.

## Privacy rules

- `notes_inbox/` and `data/notes/` are gitignored; never `git add -f` them.
- Don't dump raw note contents wholesale into chat — quote only short
  excerpts needed as evidence.
- Never upload note contents to external services (Drive/Canva/etc.)
  except at the user's explicit request.
