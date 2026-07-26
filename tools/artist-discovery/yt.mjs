#!/usr/bin/env node
// Minimal YouTube InnerTube client: search + comments + basic channel stats.
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const ctx = (hl = "ja", gl = "JP") => ({
  client: { clientName: "WEB", clientVersion: "2.20240701.00.00", hl, gl },
});

async function api(endpoint, body, hl = "ja", gl = "JP") {
  const res = await fetch(`https://www.youtube.com/youtubei/v1/${endpoint}?key=${KEY}&prettyPrint=false`, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": UA, origin: "https://www.youtube.com" },
    body: JSON.stringify({ context: ctx(hl, gl), ...body }),
  });
  if (!res.ok) throw new Error(`${endpoint} ${res.status}`);
  return res.json();
}

// ---- generic deep walker ---------------------------------------------------
function* walk(node) {
  if (node && typeof node === "object") {
    yield node;
    for (const v of Object.values(node)) yield* walk(v);
  }
}
const txt = (o) =>
  !o ? "" : o.simpleText ?? (o.runs ? o.runs.map((r) => r.text).join("") : "");

function parseCount(s) {
  if (!s) return null;
  s = String(s).replace(/,/g, "");
  const m = s.match(/([\d.]+)\s*(万|億|K|M|B|千)?/i);
  if (!m) return null;
  let n = parseFloat(m[1]);
  const u = m[2];
  if (u === "万") n *= 1e4;
  else if (u === "億") n *= 1e8;
  else if (u === "千") n *= 1e3;
  else if (u && u.toUpperCase() === "K") n *= 1e3;
  else if (u && u.toUpperCase() === "M") n *= 1e6;
  else if (u && u.toUpperCase() === "B") n *= 1e9;
  return Math.round(n);
}

// ---- search ----------------------------------------------------------------
// params: EgIQAg== channels only, EgIQAQ== videos only, CAI%3D sort by date
export async function search(query, params) {
  const data = await api("search", params ? { query, params } : { query });
  const videos = [];
  const channels = [];
  for (const n of walk(data)) {
    if (n.videoRenderer) {
      const v = n.videoRenderer;
      videos.push({
        videoId: v.videoId,
        title: txt(v.title),
        channel: txt(v.ownerText || v.longBylineText),
        channelId:
          v.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ??
          v.longBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId,
        views: parseCount(txt(v.viewCountText)),
        published: txt(v.publishedTimeText),
        length: txt(v.lengthText),
      });
    }
    if (n.channelRenderer) {
      const c = n.channelRenderer;
      channels.push({
        channelId: c.channelId,
        title: txt(c.title),
        handle: txt(c.subscriberCountText).startsWith("@") ? txt(c.subscriberCountText) : txt(c.subscriberCountText),
        subs: parseCount(txt(c.videoCountText) || txt(c.subscriberCountText)),
        desc: txt(c.descriptionSnippet),
      });
    }
  }
  return { videos, channels };
}

// ---- comments --------------------------------------------------------------
export async function comments(videoId, want = 100, hl = "en", gl = "US") {
  const next = await api("next", { videoId }, hl, gl);
  let token = null;
  for (const n of walk(next)) {
    if (n.itemSectionRenderer?.contents?.[0]?.continuationItemRenderer) {
      token =
        n.itemSectionRenderer.contents[0].continuationItemRenderer.continuationEndpoint
          ?.continuationCommand?.token;
    }
  }
  // video meta while we're here
  let meta = {};
  for (const n of walk(next)) {
    if (n.videoPrimaryInfoRenderer) {
      meta.title = txt(n.videoPrimaryInfoRenderer.title);
      meta.views = parseCount(txt(n.videoPrimaryInfoRenderer.viewCount?.videoViewCountRenderer?.viewCount));
      meta.date = txt(n.videoPrimaryInfoRenderer.dateText);
    }
    if (n.videoSecondaryInfoRenderer) {
      meta.channel = txt(n.videoSecondaryInfoRenderer.owner?.videoOwnerRenderer?.title);
      meta.channelId =
        n.videoSecondaryInfoRenderer.owner?.videoOwnerRenderer?.navigationEndpoint?.browseEndpoint?.browseId;
      meta.subs = parseCount(txt(n.videoSecondaryInfoRenderer.owner?.videoOwnerRenderer?.subscriberCountText));
    }
  }
  const out = [];
  let guard = 0;
  while (token && out.length < want && guard++ < 12) {
    let data;
    try {
      data = await api("next", { continuation: token }, hl, gl);
    } catch {
      break;
    }
    token = null;
    for (const n of walk(data)) {
      if (n.commentEntityPayload) {
        out.push({
          author: n.commentEntityPayload.author?.displayName,
          text: n.commentEntityPayload.properties?.content?.content ?? "",
          likes: n.commentEntityPayload.toolbar?.likeCountLiked ?? n.commentEntityPayload.toolbar?.likeCountNotliked,
        });
      }
      if (n.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token) {
        token = n.continuationItemRenderer.continuationEndpoint.continuationCommand.token;
      }
    }
  }
  return { meta, comments: out.slice(0, want) };
}

// ---- channel ---------------------------------------------------------------
export async function channel(browseId) {
  const data = await api("browse", { browseId, params: "EgVhYm91dPIGBAoCEgA=" });
  let out = { channelId: browseId };
  for (const n of walk(data)) {
    if (n.aboutChannelViewModel) {
      const a = n.aboutChannelViewModel;
      out.desc = a.description;
      out.subs = parseCount(a.subscriberCountText);
      out.views = parseCount(a.viewCountText);
      out.videos = parseCount(a.videoCountText);
      out.country = a.country;
      out.joined = txt(a.joinedDateText);
      out.handle = a.canonicalChannelUrl;
      out.links = (a.links || []).map((l) => l.channelExternalLinkViewModel?.link?.content).filter(Boolean);
    }
    if (n.c4TabbedHeaderRenderer && !out.title) out.title = txt(n.c4TabbedHeaderRenderer.title);
    if (n.pageHeaderViewModel?.title && !out.title)
      out.title = n.pageHeaderViewModel.title.dynamicTextViewModel?.text?.content;
  }
  return out;
}

// ---- channel videos --------------------------------------------------------
export async function channelVideos(browseId, sort = "popular") {
  // params: EgZ2aWRlb3PyBgQKAjIA = videos tab, sorted popular: EgZ2aWRlb3MYAyAAMAE%3D
  const params = sort === "popular" ? "EgZ2aWRlb3MYAyAAMAE%3D" : "EgZ2aWRlb3PyBgQKAjoA";
  const data = await api("browse", { browseId, params });
  const vids = [];
  for (const n of walk(data)) {
    if (n.richItemRenderer?.content?.videoRenderer) {
      const v = n.richItemRenderer.content.videoRenderer;
      vids.push({
        videoId: v.videoId,
        title: txt(v.title),
        views: parseCount(txt(v.viewCountText)),
        published: txt(v.publishedTimeText),
      });
    }
  }
  return vids;
}

// ---- language classification ----------------------------------------------
export function classify(text) {
  if (!text) return "unknown";
  const t = text.replace(/https?:\/\/\S+/g, "");
  const kana = /[぀-ゟ゠-ヿ]/.test(t);
  const hangul = /[가-힯ᄀ-ᇿ]/.test(t);
  const thai = /[฀-๿]/.test(t);
  const cyr = /[Ѐ-ӿ]/.test(t);
  const arab = /[؀-ۿ]/.test(t);
  const deva = /[ऀ-ॿ]/.test(t);
  const han = /[一-鿿]/.test(t);
  const latinWord = /[A-Za-z]{3,}/.test(t);
  if (hangul) return "ko";
  if (thai) return "th";
  if (cyr) return "ru";
  if (arab) return "ar";
  if (deva) return "hi";
  if (kana) return "ja";
  if (han) return "zh";
  if (latinWord) return "latin";
  return "other";
}

export function overseasRatio(list) {
  const counts = {};
  let n = 0;
  for (const c of list) {
    const l = classify(c.text);
    if (l === "unknown" || l === "other") continue;
    counts[l] = (counts[l] || 0) + 1;
    n++;
  }
  const ja = counts.ja || 0;
  return { n, ja, overseas: n ? +(((n - ja) / n) * 100).toFixed(1) : null, counts };
}

// ---- CLI -------------------------------------------------------------------
const cmd = process.argv[2];
const arg = process.argv[3];
if (cmd === "search") {
  console.log(JSON.stringify(await search(arg, process.argv[4]), null, 1));
} else if (cmd === "comments") {
  const r = await comments(arg, Number(process.argv[4] || 100));
  console.log(JSON.stringify({ meta: r.meta, ratio: overseasRatio(r.comments), sample: r.comments.slice(0, 15) }, null, 1));
} else if (cmd === "channel") {
  console.log(JSON.stringify(await channel(arg), null, 1));
} else if (cmd === "chvideos") {
  console.log(JSON.stringify(await channelVideos(arg, process.argv[4]), null, 1));
}
