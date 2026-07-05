#!/usr/bin/env node
// TikTok account scraper (Playwright).
//
// Collects account-level stats and per-video metrics
// (views / likes / comments / shares / saves) plus the top comments
// for each recent video of a *public* TikTok account, and writes a raw
// JSON snapshot that build_report.mjs turns into CSVs and a Markdown report.
//
// Usage:
//   node scrape.mjs --handle tiktok [--videos 12] [--comments 20] [--out path.json]
//
// Environment:
//   PLAYWRIGHT_BROWSERS_PATH  If set, Playwright uses the pre-installed browser
//                             (no download needed). Already set in the web env.
//   TIKTOK_COOKIE             Optional raw cookie string ("name=value; name2=..")
//                             copied from a logged-in browser session. Passing it
//                             makes TikTok far less likely to show a bot wall.
//   HEADFUL=1                 Launch a visible browser (useful for debugging).
//
// Notes:
//   - Requires outbound network access to tiktok.com. Some sandboxes block it.
//   - TikTok fights automated access; treat failures as expected and re-run,
//     ideally with TIKTOK_COOKIE set. All extraction is best-effort and
//     degrades gracefully: whatever could be collected is written out.

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { videos: 12, comments: 20 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--handle") args.handle = argv[++i];
    else if (a === "--videos") args.videos = Number(argv[++i]);
    else if (a === "--comments") args.comments = Number(argv[++i]);
    else if (a === "--out") args.out = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.handle) {
  console.error("error: --handle <username> is required (without the leading @)");
  process.exit(2);
}
const handle = args.handle.replace(/^@/, "");
const outPath = args.out || `./reports/${handle}/raw/latest.json`;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const NAV_TIMEOUT = 45_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Pull TikTok's server-rendered JSON island out of the page. It contains user
// details and (on video pages) full video stats, independent of the DOM.
async function readRehydration(page) {
  try {
    return await page.evaluate(() => {
      const el = document.getElementById("__UNIVERSAL_DATA_FOR_REHYDRATION__");
      if (!el) return null;
      try {
        return JSON.parse(el.textContent);
      } catch {
        return null;
      }
    });
  } catch {
    return null;
  }
}

// Normalise a raw TikTok "item" object into our flat metric shape.
function normaliseItem(item) {
  const s = item.stats || item.statsV2 || {};
  const num = (v) => (v == null ? null : Number(v));
  return {
    id: item.id,
    desc: item.desc ?? "",
    createTime: item.createTime ? Number(item.createTime) : null,
    duration: item.video?.duration ?? null,
    url: `https://www.tiktok.com/@${handle}/video/${item.id}`,
    views: num(s.playCount),
    likes: num(s.diggCount),
    comments: num(s.commentCount),
    shares: num(s.shareCount),
    saves: num(s.collectCount), // 保存数
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error(
      "error: the 'playwright' package is not installed.\n" +
        "       Run:  npm install  (inside the skill dir) then retry."
    );
    process.exit(3);
  }

  // Prefer a pre-installed Chromium so the npm playwright version doesn't have
  // to match a downloaded browser build. Falls back to Playwright's managed
  // browser (e.g. on a laptop that ran `npx playwright install`).
  const preinstalled =
    process.env.PLAYWRIGHT_CHROMIUM_PATH ||
    (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
  const browser = await chromium.launch({
    headless: !process.env.HEADFUL,
    executablePath: preinstalled,
    args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    userAgent: UA,
    locale: "en-US",
    viewport: { width: 1280, height: 900 },
  });

  // Optional authenticated cookies to dodge the bot wall.
  if (process.env.TIKTOK_COOKIE) {
    const cookies = process.env.TIKTOK_COOKIE.split(";")
      .map((kv) => kv.trim())
      .filter(Boolean)
      .map((kv) => {
        const idx = kv.indexOf("=");
        return {
          name: kv.slice(0, idx),
          value: kv.slice(idx + 1),
          domain: ".tiktok.com",
          path: "/",
        };
      });
    await context.addCookies(cookies);
  }

  const result = {
    handle,
    scrapedAt: new Date().toISOString(),
    account: null,
    videos: [],
    warnings: [],
  };

  try {
    // ---- 1. Profile page: account stats + video list --------------------
    const page = await context.newPage();
    const itemsById = new Map();

    page.on("response", async (res) => {
      const url = res.url();
      if (!url.includes("/api/post/item_list/")) return;
      try {
        const json = await res.json();
        for (const it of json.itemList || []) itemsById.set(it.id, it);
      } catch {
        /* ignore non-JSON / aborted responses */
      }
    });

    const profileUrl = `https://www.tiktok.com/@${handle}`;
    try {
      await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
      await sleep(2500);
    } catch (e) {
      result.warnings.push(
        `Could not load profile page (${e.message}). TikTok may be unreachable ` +
          `from this network, or the account is unavailable.`
      );
    }

    const rehydration = await readRehydration(page);
    const scope = rehydration?.__DEFAULT_SCOPE__ || {};
    const userInfo = scope["webapp.user-detail"]?.userInfo;
    if (userInfo) {
      result.account = {
        nickname: userInfo.user?.nickname ?? null,
        uniqueId: userInfo.user?.uniqueId ?? handle,
        signature: userInfo.user?.signature ?? null,
        verified: userInfo.user?.verified ?? null,
        followers: userInfo.stats?.followerCount ?? null,
        following: userInfo.stats?.followingCount ?? null,
        likes: userInfo.stats?.heartCount ?? userInfo.stats?.heart ?? null,
        videoCount: userInfo.stats?.videoCount ?? null,
      };
    } else {
      result.warnings.push(
        "Could not read account stats (bot wall or private/renamed account). " +
          "Try setting TIKTOK_COOKIE."
      );
    }

    // Scroll to trigger lazy-loaded item_list pages until we have enough.
    let stable = 0;
    for (let i = 0; i < 30 && itemsById.size < args.videos && stable < 4; i++) {
      const before = itemsById.size;
      await page.mouse.wheel(0, 4000);
      await sleep(1500);
      stable = itemsById.size === before ? stable + 1 : 0;
    }

    // Some accounts embed the first page of items directly in rehydration.
    const embedded = scope["webapp.user-detail"]?.itemList || [];
    for (const it of embedded) if (!itemsById.has(it.id)) itemsById.set(it.id, it);

    let videos = [...itemsById.values()]
      .map(normaliseItem)
      .sort((a, b) => (b.createTime ?? 0) - (a.createTime ?? 0))
      .slice(0, args.videos);

    if (videos.length === 0) {
      result.warnings.push(
        "No videos captured from the profile feed. TikTok likely served a " +
          "verification/bot wall. Re-run with a valid TIKTOK_COOKIE."
      );
    }

    // ---- 2. Per-video comments -----------------------------------------
    for (const v of videos) {
      v.topComments = [];
      const vp = await context.newPage();
      const comments = [];
      vp.on("response", async (res) => {
        if (!res.url().includes("/api/comment/list/")) return;
        try {
          const json = await res.json();
          for (const c of json.comments || []) {
            comments.push({
              text: c.text ?? "",
              likes: c.digg_count ?? c.diggCount ?? 0,
              author: c.user?.nickname ?? c.user?.unique_id ?? "",
              createTime: c.create_time ?? null,
            });
          }
        } catch {
          /* ignore */
        }
      });
      try {
        await vp.goto(v.url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
        await sleep(2500);
        // Refine stats from the video-detail rehydration if present.
        const rh = await readRehydration(vp);
        const detail =
          rh?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;
        if (detail) {
          const refined = normaliseItem(detail);
          for (const k of ["views", "likes", "comments", "shares", "saves"])
            if (refined[k] != null) v[k] = refined[k];
        }
        // Scroll the comment column to load a few pages of comments.
        for (let i = 0; i < 6 && comments.length < args.comments; i++) {
          await vp.mouse.wheel(0, 3000);
          await sleep(1200);
        }
      } catch (e) {
        result.warnings.push(`video ${v.id}: ${e.message}`);
      } finally {
        await vp.close();
      }
      v.topComments = comments
        .sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
        .slice(0, args.comments);
    }

    result.videos = videos;
  } finally {
    await browser.close();
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(
    `wrote ${outPath}  (account=${result.account ? "ok" : "MISSING"}, ` +
      `videos=${result.videos.length}, warnings=${result.warnings.length})`
  );
  for (const w of result.warnings) console.log("  ! " + w);
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
