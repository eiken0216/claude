---
name: iphone-notes
description: Import ALL notes from the user's iPhone メモ app (Apple Notes) — via Gmail sync, exported files in notes_inbox/, or Google Drive — normalize them into the repo, then generate a 直感カルテ (intuition-chart / AI self-dissection) report that verbalizes recurring themes, tastes, unconscious desires, current mood, avoided problems, and next moves. Use when the user asks to read/import their iPhone memos or notes, or wants the AI自己解剖/直感カルテ analysis (e.g. "メモを全部読み込んで", "メモから自己分析して", "直感カルテを作って").
---

# iPhone メモ → 直感カルテ (self-analysis from Apple Notes)

Adapted from the "AI 自己解剖 / 直感カルテ" method (yutori CEO ゆとりくん's
AI workflow, published with the original prompts in
[@terada_masanobu's X article](https://x.com/terada_masanobu/status/2075337311726752218)).
The original is a 4-step flow — STEP1 生まれ持った性質(OS), STEP2 Pinterest
画像分析, STEP3 音楽分析, STEP4 総合診断. This version changes exactly one
thing: STEP2's material is the user's **entire iPhone メモ (Apple Notes)
collection** instead of Pinterest saves — a pile of intuitively written
notes is the same kind of unconscious-interest data. The original prompts
(and the adapted STEP2) live in `PROMPTS.md` next to this file.

Two phases: **import** (get every note into `data/notes/`) and **analyze**
(run the 4 steps, write the 直感カルテ report). Import is idempotent —
re-running dedupes.

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

Then import via the Gmail MCP tools (exact tool prefix varies by
environment — locate `search_threads` / `get_thread` / `get_message` via
ToolSearch if needed):

1. `search_threads` with query `label:notes` — paginate until exhausted.
   (If zero results, also try `in:anywhere label:notes` variants before
   concluding the sync isn't set up.)
2. For each thread, `get_thread` / `get_message`. Each message is one
   note: subject = title, date header = timestamp, body = note text
   (may be HTML).
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
uploaded an export to Google Drive instead, find it with the Drive MCP
`search_files` tool, read each file's content, and write it into
`notes_inbox/drive/` preserving names, then normalize.

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

Follow the original 4-step flow using the prompts in `PROMPTS.md` (same
directory). Only STEP 2's material differs from the original (Pinterest
images → the notes corpus); changes are marked ★調整 there.

The original's core rule: **答えを聞くのではなく、答えになる素材を渡して
分析してもらう** — never open with 「私の悩みは何ですか?」; hand over
materials and read the pattern.

### STEP 0 — agent setup

Adopt the STEP 0 エージェント設定 prompt in PROMPTS.md as your role for
the whole analysis. Materials that don't exist (e.g. YouTube history) are
simply skipped.

### STEP 1 — OS (生まれ持った性質)

Ask the user for: 生年月日 / MBTI (知っていれば) / 算命学・四柱推命などの
診断結果 (あれば) / 簡単な経歴. The original's rule: **肩書きを盛らない** —
facts like 「会社経営」, not titles, so the AI isn't biased by status. If
the user skips this step, proceed anyway and note in the report that the
OS layer is thin.

### STEP 2 — メモ全件分析 (this replaces Pinterest)

Read `data/notes/index.csv` first for the overall shape, then the note
bodies (`notes.jsonl` or `md/` — batch-read, don't skip; if the corpus is
huge, prioritize recency but sample every folder). Apply the STEP 2
prompt from PROMPTS.md across the WHOLE corpus at once — per the
original, the point is the pattern of the pile, not per-item review.
Ground every claim in the notes: quote short excerpts and counts as
evidence; never invent content.

### STEP 3 — 音楽分析 (optional but part of the original)

Material: the Spotify MCP tools if connected (`get_currently_playing`,
search — exact tool prefix varies by environment, use ToolSearch), or
just ask the user to paste/describe their recent playlist. Apply the
STEP 3 prompt (原文まま): analyze as 今の精神状態, not music taste. If no
material, skip and say so in the report.

### STEP 4 — 総合診断レポート

Apply the STEP 4 prompt to integrate OS + notes + music, and write
`reports/self/<YYYY-MM-DD>-kartei.md` in the user's language (Japanese
unless they use another), structured as the original's deliverables:

```markdown
# 直感カルテ — <YYYY-MM-DD>

> 素材: iPhone メモ <N>件 (<最古>〜<最新>) / OS入力 <あり・なし> / 音楽 <あり・なし>

## 1. 総合診断タイトル (今の私を一言で)
## 2. 現在の気分と深層心理
## 3. OS分析 (生まれ持った性質)
## 4. メモから読む無意識の世界観
   STEP 2 の結果。頻出テーマ・件数・短い引用を根拠として添える。
## 5. 音楽傾向から読む感情のテンポ (素材があれば)
## 6. 統合診断 — 避けている課題 / 次に向かうべき方向
## 7. アクション処方 (今聴くべき音楽・見るべき映像・行くべき場所・やるべき行動)
## 8. 自分診断カルテ (1枚に凝縮したサマリーカード)
## 9. 1週間の行動プラン (月〜日)
## 10. 今の内面を表すAI画像生成プロンプト
## 11. 短いエッセイとしての総括
```

Tone (per the original prompt): 断定しすぎない — 「この情報群から見ると、
今のあなたにはこういう傾向がある」の形で; kind but direct; the value is
in specificity, not flattery.

### Deliver

1. Post a tight summary in chat: 総合診断タイトル, the 2–3 strongest
   findings, the first steps from the 1週間プラン, and where the full
   report lives.
2. **Ask before committing** — the report is personal. If the user says
   yes, commit only `reports/self/` (raw notes stay ignored).
3. Offer the visual finale from the original method: feed item 10's
   image-generation prompt to Canva's `generate-design` (if the Canva
   MCP is connected) to render the 「今の内面」 visual. Only if wanted.

## Privacy rules

- `notes_inbox/` and `data/notes/` are gitignored; never `git add -f` them.
- Don't dump raw note contents wholesale into chat — quote only short
  excerpts needed as evidence.
- Never upload note contents to external services (Drive/Canva/etc.)
  except at the user's explicit request.
