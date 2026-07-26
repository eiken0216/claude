#!/usr/bin/env node
// Pull channel metadata (country, description, keywords, links, subs) by parsing
// the channel page's ytInitialData — the InnerTube about endpoint is unreliable.
import { readFileSync, writeFileSync } from "node:fs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

export async function channelMeta(id) {
  const res = await fetch(`https://www.youtube.com/channel/${id}`, {
    headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" },
  });
  const html = await res.text();
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!m) return { id, error: "no ytInitialData" };
  let d;
  try {
    d = JSON.parse(m[1]);
  } catch {
    return { id, error: "parse" };
  }
  const md = d.metadata?.channelMetadataRenderer || {};
  const hdr = d.header?.pageHeaderRenderer?.content?.pageHeaderViewModel || {};
  const meta = hdr.metadata?.contentMetadataViewModel?.metadataRows || [];
  const rows = meta
    .flatMap((r) => (r.metadataParts || []).map((p) => p.text?.content))
    .filter(Boolean);
  const links = [];
  for (const s of JSON.stringify(d).matchAll(/"(https?:\/\/[^"\\]{5,120})"/g)) {
    const u = s[1];
    if (/instagram|twitter|x\.com|spotify|linktr|lit\.link|tiktok|apple\.com\/.*artist|bio\.to|note\.com|official/i.test(u))
      links.push(u);
  }
  return {
    id,
    title: md.title,
    handle: md.vanityChannelUrl?.replace("http://www.youtube.com/", ""),
    desc: (md.description || "").slice(0, 900),
    keywords: (md.keywords || "").slice(0, 300),
    country: md.country,
    rows,
    links: [...new Set(links)].slice(0, 12),
  };
}

if (process.argv[2] === "one") {
  console.log(JSON.stringify(await channelMeta(process.argv[3]), null, 1));
} else if (process.argv[2] === "batch") {
  const ids = JSON.parse(readFileSync(process.argv[3], "utf8"));
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (i < ids.length) {
        const idx = i++;
        if (idx % 25 === 0) process.stderr.write(`${idx}/${ids.length}\n`);
        try {
          out[idx] = await channelMeta(ids[idx]);
        } catch (e) {
          out[idx] = { id: ids[idx], error: e.message };
        }
      }
    })
  );
  writeFileSync(process.argv[4], JSON.stringify(out, null, 1));
  console.log("done", out.filter((x) => x && !x.error).length);
}
