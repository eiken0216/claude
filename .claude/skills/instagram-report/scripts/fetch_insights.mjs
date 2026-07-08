#!/usr/bin/env node
// Fetch analytics for YOUR OWN Instagram professional (Business/Creator)
// account via the official Instagram Graph API and write a raw JSON snapshot.
//
// This is the sanctioned, ToS-compliant path: it reads insights and comments
// for media on an account you control, using an access token you generated.
// It does NOT scrape follower lists or any third party's private data.
//
// Usage:
//   IG_ACCESS_TOKEN=... node fetch_insights.mjs \
//     --user-id <IG_USER_ID> --media 25 --out raw/<YYYY-MM-DD>.json
//
// Auth (in order of preference):
//   - IG_ACCESS_TOKEN env var (recommended — keeps the secret off the CLI)
//   - --token <TOKEN> (fallback)
//   - IG_USER_ID env var, or --user-id. If omitted, the script tries to
//     discover the IG Business account id from the token via /me/accounts.
//
// Everything is best-effort: the Graph API changes which metrics are valid per
// media type over time, so unsupported metrics are skipped and recorded in
// `warnings` rather than aborting the run. Nothing is fabricated.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

function parseArgs(argv) {
  const a = { media: 25, apiVersion: "v21.0", commentsMax: 0 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--user-id") a.userId = argv[++i];
    else if (k === "--token") a.token = argv[++i];
    else if (k === "--media") a.media = Number(argv[++i]);
    else if (k === "--comments-max") a.commentsMax = Number(argv[++i]);
    else if (k === "--api-version") a.apiVersion = argv[++i];
    else if (k === "--out") a.out = argv[++i];
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
const token = args.token || process.env.IG_ACCESS_TOKEN;
let userId = args.userId || process.env.IG_USER_ID;

if (!token) {
  console.error(
    "error: no access token. Set IG_ACCESS_TOKEN env var (preferred) or pass --token."
  );
  process.exit(2);
}
if (!args.out) {
  console.error("error: --out <path> is required");
  process.exit(2);
}

const BASE = `https://graph.facebook.com/${args.apiVersion}`;
const warnings = [];

// --------------------------------------------------------------------------
// Low-level Graph API GET with basic error surfacing.
// Returns { ok, data, error }.
// --------------------------------------------------------------------------
async function gget(path, params = {}) {
  const url = new URL(path.startsWith("http") ? path : `${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, v);
  }
  if (!url.searchParams.has("access_token"))
    url.searchParams.set("access_token", token);
  let res;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (e) {
    return { ok: false, error: { message: `network error: ${e.message}` } };
  }
  let json;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: { message: `non-JSON response (HTTP ${res.status})` } };
  }
  if (!res.ok || json.error) {
    return { ok: false, error: json.error || { message: `HTTP ${res.status}` } };
  }
  return { ok: true, data: json };
}

// Follow paging.next until exhausted (or a hard cap) and concatenate .data.
async function gpaged(path, params = {}, cap = 100000) {
  const out = [];
  let first = await gget(path, params);
  if (!first.ok) return { ok: false, error: first.error, data: out };
  let page = first.data;
  while (page) {
    if (Array.isArray(page.data)) out.push(...page.data);
    if (out.length >= cap) break;
    const next = page.paging?.next;
    if (!next) break;
    const r = await gget(next);
    if (!r.ok) {
      warnings.push(`pagination stopped early: ${r.error?.message}`);
      break;
    }
    page = r.data;
  }
  return { ok: true, data: out };
}

// --------------------------------------------------------------------------
// 0. Resolve the IG Business/Creator user id if not supplied.
// --------------------------------------------------------------------------
async function resolveUserId() {
  if (userId) return userId;
  const pages = await gget("me/accounts", {
    fields: "instagram_business_account{id,username},name",
  });
  if (!pages.ok) {
    warnings.push(
      `could not auto-discover IG user id via /me/accounts: ${pages.error?.message}. Pass --user-id.`
    );
    return null;
  }
  for (const p of pages.data.data || []) {
    if (p.instagram_business_account?.id) {
      warnings.push(
        `auto-discovered IG user id ${p.instagram_business_account.id} (@${p.instagram_business_account.username}) from Page "${p.name}".`
      );
      return p.instagram_business_account.id;
    }
  }
  warnings.push(
    "no instagram_business_account found on any Page for this token. Ensure the account is Business/Creator and linked to a Facebook Page."
  );
  return null;
}

// --------------------------------------------------------------------------
// 1. Account profile.
// --------------------------------------------------------------------------
async function fetchAccount() {
  const r = await gget(userId, {
    fields:
      "id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url",
  });
  if (!r.ok) {
    warnings.push(`account fetch failed: ${r.error?.message}`);
    return null;
  }
  return r.data;
}

// --------------------------------------------------------------------------
// 2. Media list.
// --------------------------------------------------------------------------
async function fetchMedia(limit) {
  const r = await gpaged(
    `${userId}/media`,
    {
      fields:
        "id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count,thumbnail_url,media_url",
      limit: Math.min(limit, 50),
    },
    limit
  );
  if (!r.ok) {
    warnings.push(`media list failed: ${r.error?.message}`);
    return [];
  }
  return r.data.slice(0, limit);
}

// Candidate insight metrics by product type. The API rejects unsupported ones
// per media, so we try the whole set, then fall back to per-metric on error.
function candidateMetrics(m) {
  const product = (m.media_product_type || "").toUpperCase();
  if (product === "REELS") {
    return [
      "reach", "likes", "comments", "shares", "saved", "total_interactions",
      "views", "ig_reels_avg_watch_time", "ig_reels_video_view_total_time",
      "clips_replays_count", "ig_reels_aggregated_all_plays_count",
    ];
  }
  if (product === "STORY") {
    return ["reach", "replies", "shares", "total_interactions", "views", "navigation"];
  }
  // FEED (image / video / carousel)
  return [
    "reach", "likes", "comments", "shares", "saved", "total_interactions",
    "views", "profile_visits", "profile_activity", "follows",
  ];
}

async function fetchMediaInsights(m) {
  const metrics = candidateMetrics(m);
  const collect = (rows) => {
    const vals = {};
    for (const row of rows || []) {
      // total_value (newer) or values[0].value (older)
      const v =
        row.total_value?.value ??
        (Array.isArray(row.values) ? row.values[0]?.value : undefined);
      if (v != null) vals[row.name] = v;
    }
    return vals;
  };

  // Try the combined request first.
  const combined = await gget(`${m.id}/insights`, { metric: metrics.join(",") });
  if (combined.ok) return collect(combined.data.data);

  // Fall back: request metrics one at a time, skipping the unsupported ones.
  const vals = {};
  for (const metric of metrics) {
    const one = await gget(`${m.id}/insights`, { metric });
    if (one.ok) Object.assign(vals, collect(one.data.data));
    // else: metric unsupported for this media — silently skip.
  }
  if (Object.keys(vals).length === 0) {
    warnings.push(
      `no insights available for media ${m.id} (${m.media_product_type}): ${combined.error?.message}`
    );
  }
  return vals;
}

// --------------------------------------------------------------------------
// 3. Comments (all, with one level of replies).
// --------------------------------------------------------------------------
async function fetchComments(m, max) {
  const cap = max && max > 0 ? max : 100000;
  const r = await gpaged(
    `${m.id}/comments`,
    {
      fields:
        "id,text,username,timestamp,like_count,replies{id,text,username,timestamp,like_count}",
      limit: 50,
    },
    cap
  );
  if (!r.ok) {
    warnings.push(`comments for media ${m.id} failed: ${r.error?.message}`);
    return [];
  }
  const flat = [];
  for (const c of r.data) {
    flat.push({
      id: c.id,
      parentId: "",
      author: c.username || "",
      text: c.text || "",
      likes: c.like_count ?? 0,
      timestamp: c.timestamp || "",
    });
    for (const rep of c.replies?.data || []) {
      flat.push({
        id: rep.id,
        parentId: c.id,
        author: rep.username || "",
        text: rep.text || "",
        likes: rep.like_count ?? 0,
        timestamp: rep.timestamp || "",
      });
    }
  }
  return flat;
}

// --------------------------------------------------------------------------
// 4. Account-level reached-audience country breakdown (best effort).
//    Per-POST geography is NOT exposed by the API — only account-level.
// --------------------------------------------------------------------------
async function fetchAudienceCountry() {
  // Newer API: follower_demographics with breakdown; requires >=100 followers.
  const attempts = [
    {
      metric: "follower_demographics",
      period: "lifetime",
      metric_type: "total_value",
      breakdown: "country",
    },
    {
      metric: "engaged_audience_demographics",
      period: "lifetime",
      metric_type: "total_value",
      breakdown: "country",
    },
  ];
  for (const params of attempts) {
    const r = await gget(`${userId}/insights`, params);
    if (r.ok) {
      const row = r.data.data?.[0];
      const results = row?.total_value?.breakdowns?.[0]?.results || [];
      const out = results
        .map((x) => ({
          country: x.dimension_values?.[0] || "",
          value: x.value ?? 0,
        }))
        .filter((x) => x.country)
        .sort((a, b) => b.value - a.value);
      if (out.length) return { metric: params.metric, countries: out };
    }
  }
  warnings.push(
    "audience country breakdown unavailable (needs >=100 followers and demographics access). Per-post geography is never exposed by the API."
  );
  return { metric: null, countries: [] };
}

// --------------------------------------------------------------------------
// Main.
// --------------------------------------------------------------------------
async function main() {
  userId = await resolveUserId();
  const snapshot = {
    fetchedAt: new Date().toISOString(),
    apiVersion: args.apiVersion,
    userId,
    account: null,
    media: [],
    audience: { metric: null, countries: [] },
    warnings,
  };

  if (!userId) {
    writeOut(snapshot);
    console.error("aborted: no IG user id. See warnings in the output JSON.");
    process.exit(1);
  }

  snapshot.account = await fetchAccount();

  const media = await fetchMedia(args.media);
  for (const m of media) {
    const insights = await fetchMediaInsights(m);
    const comments = await fetchComments(m, args.commentsMax);
    snapshot.media.push({
      id: m.id,
      type: m.media_type,
      productType: m.media_product_type,
      timestamp: m.timestamp,
      permalink: m.permalink,
      caption: m.caption || "",
      likeCount: m.like_count ?? null,
      commentsCount: m.comments_count ?? null,
      insights,
      comments,
    });
  }

  snapshot.audience = await fetchAudienceCountry();

  writeOut(snapshot);
  const totalComments = snapshot.media.reduce((s, m) => s + m.comments.length, 0);
  console.log(
    `wrote ${args.out}: account=${snapshot.account ? "ok" : "MISSING"}, ` +
      `media=${snapshot.media.length}, comments=${totalComments}, ` +
      `countries=${snapshot.audience.countries.length}, warnings=${warnings.length}`
  );
}

function writeOut(snapshot) {
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, JSON.stringify(snapshot, null, 2));
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
