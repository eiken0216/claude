---
title: "iPhone Notes Import"
aliases:
  - "iPhone Notes Import"
category: "スキル・ワークフロー"
project: "iPhoneメモ取り込み スキル"
created: 2026-07-11
source_repo: eiken0216/claude
source_branch: claude/iphone-notes-import-wv927z
source_path: ".claude/skills/notes-import/SKILL.md"
tags:
  - ai-reference
  - スキル-ワークフロー
  - スキル
  - メモ管理
skill_name: notes-import
skill_description: Import ALL notes from the user's iPhone Notes app (Apple Notes) into the repository as organized Markdown with an index. Reads a bulk export the user drops into Google Drive (created once via an iOS Shortcut), normalizes every note into notes/md/<folder>/<title>.md, and rebuilds notes/INDEX.md. Use when the user asks to import, read, sync, or organize their iPhone/Apple notes (e.g. "メモを取り込んで", "iPhoneのメモを読み込んで", "メモを同期して").
---

# iPhone Notes Import

Import every note from the user's iPhone メモ (Apple Notes) app into the repo.

Apple Notes has no public cloud API, so the pipeline is:

1. **iPhone side (user, one-time setup + one tap per sync):** an iOS Shortcut
   exports all notes into a single `notes-export.txt` file inside a Google
   Drive folder named `iPhoneメモ`. The exact recipe is in the repo `README.md`
   (「iPhone 側の準備」). A folder of individual `.txt`/`.md`/`.html` files
   (e.g. from the Mac app "Exporter") in the same Drive folder also works.
2. **This side (Claude):** find the export in Google Drive, download it,
   normalize into per-note Markdown files, rebuild the index, commit.

## Steps

1. **Find the export in Google Drive.** Using the Google Drive MCP tools
   (load via ToolSearch if needed):
   - Search for the folder: query
     `title = 'iPhoneメモ' and mimeType = 'application/vnd.google-apps.folder'`
     (fall back to `title contains 'iPhoneメモ'`, or a folder/file name the
     user gives you).
   - List its contents with query `parentId = '<folder-id>'`.
   - **If nothing is found**, do NOT invent data. Tell the user the export
     doesn't exist yet and walk them through the Shortcut setup in
     `README.md` (「iPhone 側の準備」), then stop.

2. **Download everything** into a scratchpad directory (NOT into the repo —
   raw exports stay out of git):
   - Plain files (`text/plain`, `text/markdown`, `text/html`):
     `mcp__Google_Drive__download_file_content`, write to
     `<scratchpad>/notes-raw/<title>`.
   - Google Docs in the folder: `mcp__Google_Drive__read_file_content` and
     save the text as `<title>.txt`.
   - Skip images/audio/binaries; note them for the summary.

3. **Normalize + index.** From the repo root:
   ```bash
   node .claude/skills/notes-import/scripts/organize.mjs \
     --in <scratchpad>/notes-raw --outdir notes
   ```
   This wipes and rebuilds `notes/md/` (full re-import — the export always
   contains every note) and rewrites `notes/INDEX.md`. It prints a JSON
   summary (note count, folders, skipped files, parse warnings) to stdout.
   - It understands the `===NOTE===` combined format produced by the
     Shortcut, plus loose `.txt`/`.md`/`.html` files (one note per file,
     subdirectories become note folders).
   - Pass `--no-clean` only if the user explicitly wants to merge into an
     existing import instead of replacing it.

4. **Sanity-check** the JSON summary against what was in Drive. If the note
   count is suspiciously low (e.g. the combined file existed but produced 1
   note), inspect the raw file — the Shortcut may have exported without the
   `===NOTE===` separators; tell the user which step of the recipe to fix.

5. **Commit** `notes/` to the working branch with a message like
   `Import iPhone notes (<N> notes, <YYYY-MM-DD>)`.

6. **Summarize in chat** (in the user's language): how many notes / folders
   were imported, anything skipped, and 3–5 notable themes you noticed while
   organizing. Link `notes/INDEX.md`.

## Notes

- **Privacy:** note contents are personal. Keep them in this repo only —
  don't upload note bodies to Drive/Sheets or quote more than short excerpts
  in chat unless asked.
- **Locked notes** (パスワード/Face IDロック付き) cannot be read by the
  Shortcut and will simply be missing — mention this if the user says notes
  are missing.
- Attachments (photos, drawings, scans) are not part of the text export;
  only note text comes through.
- Re-running the skill after the user re-runs the Shortcut refreshes
  everything (deleted notes disappear because the rebuild is clean).
