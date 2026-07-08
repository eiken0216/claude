---
name: instagram-report
description: Analyze YOUR OWN Instagram professional (Business/Creator) account's posts via the official Instagram Graph API — per-post reach/views/likes/comments/shares/saves, reel average watch time, account-level audience country breakdown, and a full export of every comment on your posts — written to the repo as CSV/JSON/Markdown and publishable as Google Spreadsheets. Use when the user asks to report on, track, or analyze their own Instagram account's posts, engagement, reel retention, or comments (e.g. "インスタの投稿分析", "リールの視聴データ出して", "コメント全部書き出して"). This is the ToS-compliant path and works only for an account the user controls with a Graph API token. It does NOT and cannot scrape follower lists or any third party's private profile data.
---

# Instagram Analytics Report (official Graph API)

Collect per-post metrics, reel watch-time, account audience country breakdown,
and the full comment thread for **an Instagram professional account the user
owns**, write the data into the repository, and optionally publish readable
Google Spreadsheets.

## Scope and limits — read first

- **Own account only.** This reads insights and comments for media on a
  Business/Creator account the user controls, via a token they generated. It is
  the sanctioned, ToS-compliant path.
- **No follower scraping.** The Graph API does not expose follower lists or any
  individual follower's username/bio/category, and this skill does not attempt
  to obtain them. If the user asks for "all followers' usernames/profiles/
  category", explain that this is not available via the API and is a privacy /
  ToS problem — do not try to scrape it.
- **No per-post geography.** Country/city data is only available **at the
  account level** (reached/follower audience), never per individual post. Say so
  rather than implying a post-level country breakdown exists.
- **View retention.** The API does not return a true per-post retention curve.
  The closest signals are reel `ig_reels_avg_watch_time` (average watch time)
  and `ig_reels_video_view_total_time`, which the report surfaces. Present them
  as watch-time, not as an exact retention %.

## Prerequisites (the user must set these up — you cannot)

1. The account must be **Business or Creator** (not personal) and linked to a
   Facebook Page.
2. A Meta app with a **User or Page access token** carrying scopes:
   `instagram_basic`, `instagram_manage_insights`, `pages_show_list`,
   `pages_read_engagement` (and `business_management` if applicable).
3. Provide the token via the `IG_ACCESS_TOKEN` environment variable
   (preferred — keeps it off the command line and out of shell history).
   Optionally provide `IG_USER_ID` (the numeric IG Business account id); if
   omitted the script tries to discover it from the token via `/me/accounts`.

If the user hasn't done this yet, walk them through it briefly and stop — the
scripts can't run without a token. Never ask the user to paste the token into
chat; have them set the env var in the environment settings.

## Inputs

- **username** (for output foldering / labeling; the account is determined by
  the token + user id, not this string).
- **media** (optional, default 25): how many recent posts to pull.
- **comments-max** (optional, default 0 = all): cap comments per post; 0 fetches
  every comment (paginated).

## Steps

Run from the skill directory: `.claude/skills/instagram-report`.

1. **Fetch** the raw snapshot (token comes from the env var):
   ```bash
   IG_ACCESS_TOKEN="$IG_ACCESS_TOKEN" node scripts/fetch_insights.mjs \
     --user-id "$IG_USER_ID" --media 25 \
     --out ../../../reports/<USERNAME>/raw/<YYYY-MM-DD>.json
   ```
   - `--user-id` is optional if `IG_USER_ID` is set or auto-discovery works.
   - The snapshot always includes a `warnings` array. If `account` is null or
     media is empty, read the warnings: usually a token/scope/account-type
     problem. Report it honestly — **do not fabricate metrics**.

2. **Build the report** from that snapshot:
   ```bash
   node scripts/build_report.mjs \
     --in ../../../reports/<USERNAME>/raw/<YYYY-MM-DD>.json \
     --outdir ../../../reports/<USERNAME> --date <YYYY-MM-DD>
   ```
   Writes, under `reports/<USERNAME>/`:
   - `metrics.csv` — per-post reach/views/likes/comments/shares/saved/
     engagement%/avg watch time
   - `comments.csv` — every comment + reply (author, likes, date, text)
   - `audience.csv` — account-level audience by country (if available)
   - `account_history.csv` — appended one row per run (run-over-run time series)
   - `<YYYY-MM-DD>.md` — human-readable report with trend deltas

3. **Publish to Google Sheets** (optional). Upload the CSVs; Drive converts
   CSV → a Google Spreadsheet automatically (leave `disableConversionToGoogleType`
   unset). Use `mcp__Google_Drive__create_file`:
   - `Instagram Metrics — @<USERNAME> — <DATE>`, `contentMimeType: text/csv`,
     `textContent`: contents of `metrics.csv`.
   - `Instagram Comments — @<USERNAME> — <DATE>`, same pattern with `comments.csv`.
   - `Instagram Audience — @<USERNAME> — <DATE>`, same pattern with `audience.csv`.
   Capture each returned link to share.

4. **Summarize** in chat (in the user's language): follower/media trend vs last
   run, top posts by reach and by engagement, reel watch-time highlights,
   audience country mix, notable comment themes, and any warnings. Keep it tight.

5. **Commit** the new files under `reports/<USERNAME>/` to the working branch so
   history accumulates for future trend comparisons.

## Notes

- Requires outbound access to `graph.facebook.com`.
- Metric availability shifts as Meta evolves the API; the fetch script tolerates
  unsupported metrics per media (skips them, records a warning) instead of
  aborting. A run returning fewer metrics than expected is normal — check
  `warnings`.
- Audience country breakdown needs ≥100 followers and the demographics
  permission; otherwise it comes back empty with a warning.
- To run this daily, wire the two commands into a scheduled trigger that runs
  the skill and commits — ask the user before setting that up.
