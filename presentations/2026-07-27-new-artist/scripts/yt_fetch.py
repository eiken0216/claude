#!/usr/bin/env python3
"""Fetch a YouTube channel's public stats and its top videos/shorts by parsing
ytInitialData out of the channel pages (no API key needed)."""
import json
import re
import subprocess
import sys

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")


def curl(url):
    r = subprocess.run(["curl", "-sS", "-L", "--max-time", "60", "-A", UA,
                        "-H", "accept-language: ja,en;q=0.8",
                        "-b", "PREF=hl=ja&gl=JP", url],
                       capture_output=True, text=True)
    return r.stdout or ""


def initdata(html):
    m = re.search(r"ytInitialData\s*=\s*(\{.*?\});</script>", html, re.S)
    if not m:
        m = re.search(r'ytInitialData"\]\s*=\s*(\{.*?\});', html, re.S)
    return json.loads(m.group(1)) if m else None


def walk(o):
    if isinstance(o, dict):
        yield o
        for v in o.values():
            yield from walk(v)
    elif isinstance(o, list):
        for v in o:
            yield from walk(v)


def text(node):
    if not isinstance(node, dict):
        return None
    if "simpleText" in node:
        return node["simpleText"]
    if "runs" in node:
        return "".join(r.get("text", "") for r in node["runs"])
    if "content" in node:
        return node["content"]
    return None


def channel(handle):
    handle = handle.lstrip("@")
    out = {"handle": handle, "videos": [], "shorts": []}
    html = curl(f"https://www.youtube.com/@{handle}/about")
    d = initdata(html)
    if d:
        for n in walk(d):
            if "subscriberCountText" in n and "title" in n:
                out.setdefault("title", text(n.get("title")))
                out.setdefault("subscriberText", text(n["subscriberCountText"]))
            if n.get("subscriberCountText") and isinstance(n["subscriberCountText"], str):
                out.setdefault("subscriberText", n["subscriberCountText"])
            if "videoCountText" in n:
                out.setdefault("videoCountText", text(n["videoCountText"])
                               or n["videoCountText"] if isinstance(n["videoCountText"], str) else None)
            if n.get("viewCountText") and isinstance(n["viewCountText"], str) and "回" in n["viewCountText"]:
                out.setdefault("channelViewText", n["viewCountText"])
            if "description" in n and "country" in n:
                out["about"] = {k: n.get(k) for k in
                                ("description", "country", "viewCountText",
                                 "subscriberCountText", "videoCountText",
                                 "joinedDateText", "canonicalChannelUrl")}
                out["about"] = {k: (text(v) if isinstance(v, dict) else v)
                                for k, v in out["about"].items()}
    # metadata fallbacks from raw HTML meta tags / JSON
    for key, pat in (("metaTitle", r'<meta property="og:title" content="([^"]*)"'),
                     ("metaDesc", r'<meta property="og:description" content="([^"]*)"'),
                     ("subsRaw", r'"subscriberCountText":\{"simpleText":"([^"]*)"'),
                     ("subsAccessible", r'"([0-9.,]+[万千KMB]?人?[^"]{0,12})人のチャンネル登録者'),
                     ):
        m = re.search(pat, html)
        if m:
            out[key] = m.group(1)

    for tab, key in (("videos", "videos"), ("shorts", "shorts")):
        h = curl(f"https://www.youtube.com/@{handle}/{tab}")
        d = initdata(h)
        if not d:
            continue
        items = []
        for n in walk(d):
            # Classic video/reel renderers
            if n.get("videoId") and ("title" in n or "headline" in n):
                title = text(n.get("title")) or text(n.get("headline"))
                views = None
                for k in ("viewCountText", "shortViewCountText"):
                    if k in n:
                        views = (text(n[k]) if isinstance(n[k], dict)
                                 else n[k] if isinstance(n[k], str) else None)
                        if views:
                            break
                if title:
                    items.append({"id": n["videoId"], "title": title,
                                  "views": views,
                                  "published": text(n.get("publishedTimeText")),
                                  "url": f"https://www.youtube.com/watch?v={n['videoId']}"})
            # New long-form lockup view model
            if "lockupViewModel" in n:
                s = n["lockupViewModel"]
                vid = s.get("contentId")
                meta = ((s.get("metadata") or {}).get("lockupMetadataViewModel") or {})
                title = text(meta.get("title"))
                rows, bits = [], []
                for r in walk(meta):
                    if isinstance(r.get("content"), str) and (
                            "回視聴" in r["content"] or "views" in r["content"]
                            or "前" in r["content"] or "ago" in r["content"]):
                        bits.append(r["content"])
                views = next((b for b in bits if "視聴" in b or "views" in b), None)
                pub = next((b for b in bits if "前" in b or "ago" in b), None)
                if vid and title:
                    items.append({"id": vid, "title": title, "views": views,
                                  "published": pub,
                                  "url": f"https://www.youtube.com/watch?v={vid}"})
            # New Shorts lockup view model
            if "shortsLockupViewModel" in n:
                s = n["shortsLockupViewModel"]
                vid = (((s.get("onTap") or {}).get("innertubeCommand") or {})
                       .get("reelWatchEndpoint") or {}).get("videoId") \
                    or (s.get("entityId") or "").replace("shorts-shelf-item-", "")
                om = s.get("overlayMetadata") or {}
                title = (text(om.get("primaryText"))
                         or ((s.get("accessibilityText") or "").split(" - ")[0] or None))
                views = text(om.get("secondaryText"))
                if vid:
                    items.append({"id": vid, "title": title or "", "views": views,
                                  "published": None,
                                  "url": f"https://www.youtube.com/shorts/{vid}"})
        dedup, seen = [], set()
        for it in items:
            if it["id"] in seen:
                continue
            seen.add(it["id"])
            dedup.append(it)
        out[key] = dedup[:30]
    return out


if __name__ == "__main__":
    print(json.dumps({h: channel(h) for h in sys.argv[1:]},
                     ensure_ascii=False, indent=1))
