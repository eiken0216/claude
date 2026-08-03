---
title: "Artist Analytics Report"
aliases:
  - "Artist Analytics Report"
category: "スキル・ワークフロー"
project: "アーティスト分析 スキル(公開データ版)"
created: 2026-07-16
source_repo: eiken0216/claude
source_branch: claude/artist-analytics-kroi-zy64r4
source_path: ".claude/skills/artist-analytics/SKILL.md"
tags:
  - ai-reference
  - スキル-ワークフロー
  - スキル
  - アーティスト分析
skill_name: artist-analytics
skill_description: Research a music artist and produce an analytics report — streaming/SNS metrics, release activity, and (optionally) 興行 analysis (tours, venues, capacities, ticket prices, festivals, estimated gross) — written to the repo as Markdown + CSV. Use when the user asks to analyze, report on, or track an artist (e.g. "/artist-analytics kroi", "○○の分析レポートを出して", "興行も含めて").
---

# Artist Analytics Report

Collect public data about a music artist and write an analytics report into the
repository. Covers streaming/SNS metrics, recent releases, and — when the user
asks for it (e.g. 「興行も含めて」) — a live-business (興行) analysis: tour
dates, venues, approximate capacities, ticket prices, festival appearances, and
estimated gross.

## Inputs

- **artist** (required): artist name (e.g. `kroi`). If missing, ask.
- **興行 / live business** (optional flag): include tours/concerts analysis.
  Phrases like 「興行も含めて」「ライブも」 turn it on.
- Extra qualifiers the user gives (period, region, a specific tour) narrow the scope.

## Data collection

Use several sources and cross-check; never fabricate numbers.

1. **Spotify** — `mcp__Spotify__search` to resolve the artist URI, then
   `WebFetch` on `https://open.spotify.com/artist/<id>` to extract monthly
   listeners, followers, and top-track stream counts.
2. **YouTube** — WebFetch usually truncates; instead:
   ```bash
   curl -sL "https://www.youtube.com/channel/<CHANNEL_ID>/about" -H "Accept-Language: ja" \
     -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" \
     | grep -oE '"(subscriberCountText|videoCountText|viewCountText)"[^}]{0,200}'
   ```
   Find the channel ID via Wikidata or web search.
3. **Official site / label news** — WebSearch then WebFetch the artist's
   official site (discography page, news pages, tour special sites) for
   releases, tour dates, ticket prices, and tie-ups.
4. **興行 (if requested)** — for each tour/one-man/festival:
   - dates, venues, cities (official tour pages are the ground truth)
   - approximate venue capacity (公称値; mark as 概数)
   - ticket prices, sale status, sold-out reports
   - festival appearances (FUJI ROCK / RIJF / SUMMER SONIC / METROCK …)
   - media live reports (音楽ナタリー, Billboard JAPAN, USEN encore, Skream! …)
   - estimate gross as capacity × face price, clearly labeled 満員想定の概算
5. **SNS** — Instagram/X/TikTok follower counts where obtainable without
   login; otherwise note them as unavailable.

## Outputs

Write under `reports/artist/<slug>/` (slug = lowercase artist name):

- `<YYYY-MM-DD>.md` — the report: TL;DR → profile → streaming/SNS snapshot →
  releases → 興行分析 (timeline of venue scale, per-tour tables, gross
  estimates, strategic 考察) → data caveats → sources (all URLs used).
- `live_events.csv` — one row per show:
  `date,series,type,event_or_partner,venue,city,capacity_approx,ticket_price_jpy,status,note`
- `metrics_history.csv` — **append** rows per run (time series):
  `date,platform,metric,value,note`

On re-runs, compare against the previous `metrics_history.csv` rows and report
deltas (listener/subscriber growth since last run).

## Wrap-up

1. Summarize in chat (user's language): headline numbers, live-business
   trajectory, notable findings, and where the files were written.
2. Commit the new files under `reports/artist/<slug>/` to the working branch
   so history accumulates.

## Notes

- Capacities are public rough figures; actual attendance is rarely published —
  always label revenue as a capacity-based gross estimate.
- WebSearch results can mis-date releases; prefer the official discography
  page over aggregator summaries.
- Requires outbound web access (official sites, Spotify, YouTube).
