#!/usr/bin/env node
// TikTok screener over plain HTTP: profile stats, video list (embed page),
// per-video stats (video page), and comment-language mix (comment API).
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const H = { "user-agent": UA, "accept-language": "en-US,en;q=0.9", referer: "https://www.tiktok.com/" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, tries = 2) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: H });
      if (r.ok) return await r.text();
    } catch {}
    await sleep(700);
  }
  return null;
}

function island(html) {
  const m = html?.match(/__UNIVERSAL_DATA_FOR_REHYDRATION__[^>]*>(.*?)<\/script>/s);
  if (!m) return null;
  try {
    return JSON.parse(m[1])["__DEFAULT_SCOPE__"];
  } catch {
    return null;
  }
}

export async function profile(handle) {
  const html = await get(`https://www.tiktok.com/@${handle}`);
  const s = island(html);
  const ui = s?.["webapp.user-detail"]?.userInfo;
  if (!ui) return { handle, error: "no profile" };
  return {
    handle,
    nickname: ui.user?.nickname,
    signature: ui.user?.signature,
    verified: ui.user?.verified,
    bioLink: ui.user?.bioLink?.link,
    created: ui.user?.createTime,
    followers: ui.stats?.followerCount,
    hearts: ui.stats?.heartCount,
    videoCount: ui.stats?.videoCount,
  };
}

export async function videoList(handle) {
  const html = await get(`https://www.tiktok.com/embed/@${handle}`);
  if (!html) return [];
  const m = html.match(/__FRONTITY_CONNECT_STATE__[^>]*>(.*?)<\/script>/s);
  if (!m) return [];
  let d;
  try {
    d = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const out = [];
  (function find(o) {
    if (Array.isArray(o)) {
      if (o.length && o[0] && typeof o[0] === "object" && o[0].id && "desc" in o[0]) {
        for (const v of o) out.push({ id: v.id, desc: v.desc || "" });
      } else o.forEach(find);
    } else if (o && typeof o === "object") Object.values(o).forEach(find);
  })(d);
  const seen = new Set();
  return out.filter((v) => !seen.has(v.id) && seen.add(v.id));
}

export async function videoStats(handle, id) {
  const html = await get(`https://www.tiktok.com/@${handle}/video/${id}`, 1);
  const s = island(html);
  const it = s?.["webapp.video-detail"]?.itemInfo?.itemStruct;
  if (!it) return null;
  return {
    id,
    play: Number(it.statsV2?.playCount ?? it.stats?.playCount ?? 0),
    digg: Number(it.statsV2?.diggCount ?? it.stats?.diggCount ?? 0),
    comment: Number(it.statsV2?.commentCount ?? it.stats?.commentCount ?? 0),
    share: Number(it.statsV2?.shareCount ?? it.stats?.shareCount ?? 0),
    collect: Number(it.statsV2?.collectCount ?? 0),
    created: it.createTime,
    desc: (it.desc || "").slice(0, 140),
  };
}

export async function comments(id, count = 50) {
  const out = [];
  for (let cursor = 0; cursor < count; cursor += 50) {
    const t = await get(
      `https://www.tiktok.com/api/comment/list/?aweme_id=${id}&count=50&cursor=${cursor}&aid=1988`,
      2
    );
    if (!t) break;
    let j;
    try {
      j = JSON.parse(t);
    } catch {
      break;
    }
    for (const c of j.comments || [])
      out.push({ lang: c.comment_language, text: (c.text || "").slice(0, 200), likes: c.digg_count });
    if (!j.has_more) break;
    await sleep(300);
  }
  return out;
}

export function langMix(cs) {
  const counts = {};
  for (const c of cs) {
    let l = (c.lang || "").toLowerCase();
    if (!l || l === "un") {
      const s = c.text || "";
      l = /[぀-ゟ゠-ヿ]/.test(s) ? "ja" : /[가-힯]/.test(s) ? "ko" : /[฀-๿]/.test(s) ? "th" : "un";
    }
    counts[l] = (counts[l] || 0) + 1;
  }
  const n = Object.values(counts).reduce((a, b) => a + b, 0);
  const ja = counts.ja || 0;
  const un = counts.un || 0;
  const known = n - un;
  return { n, ja, overseas: known ? +(((known - ja) / known) * 100).toFixed(1) : null, counts };
}

// ---- CLI -------------------------------------------------------------------
const cmd = process.argv[2];
if (cmd === "screen") {
  const handles = process.argv.slice(3);
  const list = handles.length
    ? handles
    : JSON.parse(readFileSync("tt_handles.json", "utf8"));
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (i < list.length) {
        const idx = i++;
        const h = String(list[idx]).replace(/^@/, "");
        process.stderr.write(`${idx + 1}/${list.length} ${h}\n`);
        try {
          const p = await profile(h);
          if (p.error) {
            out.push(p);
            continue;
          }
          const vids = (await videoList(h)).slice(0, 8);
          const stats = [];
          for (const v of vids.slice(0, 6)) {
            const s = await videoStats(h, v.id);
            if (s) stats.push(s);
            await sleep(250);
          }
          stats.sort((a, b) => b.play - a.play);
          let cs = [];
          for (const s of stats.slice(0, 2)) cs = cs.concat(await comments(s.id, 50));
          const mix = langMix(cs);
          out.push({
            ...p,
            topPlay: stats[0]?.play ?? null,
            medPlay: stats.length ? stats[Math.floor(stats.length / 2)].play : null,
            playPerFollower: p.followers && stats[0] ? +(stats[0].play / p.followers).toFixed(1) : null,
            sampled: mix.n,
            overseasPct: mix.overseas,
            langs: mix.counts,
            recent: stats.slice(0, 3).map((s) => ({ id: s.id, play: s.play, c: s.comment, d: s.desc })),
            topComments: cs
              .filter((c) => c.lang && c.lang !== "ja")
              .sort((a, b) => (b.likes || 0) - (a.likes || 0))
              .slice(0, 5)
              .map((c) => `[${c.lang}] ${c.text.slice(0, 110)}`),
          });
        } catch (e) {
          out.push({ handle: h, error: e.message });
        }
      }
    })
  );
  writeFileSync("tt_screened.json", JSON.stringify(out, null, 1));
  const ok = out.filter((o) => !o.error && o.overseasPct != null).sort((a, b) => b.overseasPct - a.overseasPct);
  for (const o of ok)
    console.log(
      `${String(o.overseasPct).padStart(5)}%  fol=${String(o.followers).padStart(8)}  topPlay=${String(o.topPlay).padStart(9)}  x${String(o.playPerFollower).padStart(6)}  @${o.handle}  ${o.nickname}  ${JSON.stringify(o.langs)}`
    );
  console.log(`\nfailed: ${out.filter((o) => o.error).map((o) => o.handle).join(", ")}`);
}
