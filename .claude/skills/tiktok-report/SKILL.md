---
name: tiktok-report
description: Scrape a public TikTok account and produce a daily analytics report — per-video views/likes/comments/shares/saves plus top comments — written to the repo as CSV/JSON/Markdown and published as readable Google Spreadsheets. Use when the user asks to report on, track, analyze, or monitor a TikTok account, its videos, engagement, or comments (e.g. "@handle のレポート", "TikTokの傾向を出して", "コメントを集計して").
---

# TikTok Analytics Report

Collect metrics and comments for a public TikTok account, write the data into
the repository, and publish a readable Google Spreadsheet.

## Inputs

- **handle** (required): the TikTok username without `@` (e.g. `tiktok`).
  If the user didn't give one, ask for it.
- **videos** (optional, default 12): how many recent videos to track.
- **comments** (optional, default 20): top comments to keep per video.

## Steps

Run these from the skill directory: `.claude/skills/tiktok-report`.

1. **Install deps (first run only).** If `node_modules/playwright` is missing:
   ```bash
   cd .claude/skills/tiktok-report && npm install
   ```
   The Chromium binary is pre-installed in the web environment
   (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`), so no browser download is
   needed. If Playwright still can't find a browser locally, run
   `npx playwright install chromium`.

2. **Scrape.** Write the raw snapshot into the repo:
   ```bash
   node scripts/scrape.mjs --handle <HANDLE> --videos 12 --comments 20 \
     --out ../../../reports/<HANDLE>/raw/<YYYY-MM-DD>.json
   ```
   - If the account is bot-walled, the JSON will contain `warnings` and empty
     `account`/`videos`. Tell the user and suggest re-running with a
     `TIKTOK_COOKIE` env var (a cookie string copied from a logged-in browser).
     **Do not fabricate metrics** — only report what was actually scraped.

3. **Build the report** from that snapshot:
   ```bash
   node scripts/build_report.mjs \
     --in ../../../reports/<HANDLE>/raw/<YYYY-MM-DD>.json \
     --outdir ../../../reports/<HANDLE> --date <YYYY-MM-DD>
   ```
   This writes, under `reports/<HANDLE>/`:
   - `metrics.csv` — per-video table (views/likes/comments/shares/saves/engagement)
   - `comments.csv` — top comments across the tracked videos
   - `account_history.csv` — appended one row per run (day-over-day time series)
   - `<YYYY-MM-DD>.md` — human-readable report with trend deltas

4. **Publish to Google Sheets.** Upload the two CSVs; Drive converts CSV → a
   Google Spreadsheet automatically (leave `disableConversionToGoogleType`
   unset). Use the `mcp__Google_Drive__create_file` tool:
   - Title: `TikTok Metrics — @<HANDLE> — <YYYY-MM-DD>`, `contentMimeType: text/csv`,
     `textContent`: contents of `metrics.csv`.
   - Title: `TikTok Comments — @<HANDLE> — <YYYY-MM-DD>`, `contentMimeType: text/csv`,
     `textContent`: contents of `comments.csv`.
   Capture each returned file's link to share with the user.

5. **Summarize** for the user in the chat (in their language): account trend
   (followers/likes vs last run), the top videos, notable comment themes, and
   links to the two Google Sheets. Keep it tight.

6. **Commit** the new files under `reports/<HANDLE>/` to the working branch so
   history accumulates for future trend comparisons.

## Notes

- Requires outbound access to `tiktok.com`. Some sandboxed/CI network policies
  block it — in that case run the skill from an environment that can reach
  TikTok (or set the environment's network policy accordingly).
- All extraction is best-effort. TikTok changes its internal payloads and
  fights automation; a scrape returning fewer videos/comments than requested is
  normal. Re-run, ideally with `TIKTOK_COOKIE` set.
- To make this run daily automatically later, wire the same two commands into a
  scheduled trigger (a `create_trigger` fresh-session routine) that runs the
  skill and then commits — ask the user before setting that up.
