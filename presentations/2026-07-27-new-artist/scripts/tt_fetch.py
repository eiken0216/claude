#!/usr/bin/env python3
"""Fetch a public TikTok profile page and extract account stats + recent videos
from the server-rendered __UNIVERSAL_DATA_FOR_REHYDRATION__ JSON island."""
import json
import re
import subprocess
import sys

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")


def fetch(url):
    out = subprocess.run(
        ["curl", "-sS", "-L", "-A", UA,
         "-H", "accept-language: ja-JP,ja;q=0.9,en;q=0.8", url],
        capture_output=True, text=True, timeout=120)
    return out.stdout


def island(html):
    m = re.search(
        r'id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>',
        html, re.S)
    if not m:
        return None
    return json.loads(m.group(1))


def norm(item, handle):
    s = item.get("stats") or item.get("statsV2") or {}
    n = lambda k: int(s[k]) if s.get(k) not in (None, "") else None
    return {
        "id": item.get("id"),
        "desc": item.get("desc", ""),
        "createTime": item.get("createTime"),
        "duration": (item.get("video") or {}).get("duration"),
        "url": f"https://www.tiktok.com/@{handle}/video/{item.get('id')}",
        "music": ((item.get("music") or {}).get("title"),
                  (item.get("music") or {}).get("authorName")),
        "views": n("playCount"), "likes": n("diggCount"),
        "comments": n("commentCount"), "shares": n("shareCount"),
        "saves": n("collectCount"),
    }


def profile(handle):
    handle = handle.lstrip("@")
    data = island(fetch(f"https://www.tiktok.com/@{handle}"))
    res = {"handle": handle, "account": None, "videos": []}
    if not data:
        res["error"] = "no rehydration island"
        return res
    scope = data.get("__DEFAULT_SCOPE__", {})
    ud = scope.get("webapp.user-detail", {})
    ui = ud.get("userInfo") or {}
    u, st = ui.get("user") or {}, ui.get("stats") or {}
    if u:
        res["account"] = {
            "nickname": u.get("nickname"), "uniqueId": u.get("uniqueId"),
            "signature": u.get("signature"), "verified": u.get("verified"),
            "region": u.get("region"), "language": u.get("language"),
            "createTime": u.get("createTime"),
            "bioLink": (u.get("bioLink") or {}).get("link"),
            "followers": st.get("followerCount"),
            "following": st.get("followingCount"),
            "likes": st.get("heartCount") or st.get("heart"),
            "videoCount": st.get("videoCount"),
            "friends": st.get("friendCount"),
        }
    items = ud.get("itemList") or []
    res["videos"] = sorted((norm(i, handle) for i in items),
                           key=lambda v: -(int(v["createTime"] or 0)))
    return res


if __name__ == "__main__":
    out = {h: profile(h) for h in sys.argv[1:]}
    print(json.dumps(out, ensure_ascii=False, indent=1))
