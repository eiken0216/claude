#!/usr/bin/env python3
"""Deep TikTok collector for A&R research.

Profile page  -> account stats (followers / likes / video count / bio)
Creator embed -> paginated video list (id, caption, playCount)
Video page    -> full stats (likes / comments / shares / saves), createTime, music

Usage: tt_deep.py --handle saewool [--pages 4] [--detail 12] --out out.json
"""
import argparse
import json
import re
import subprocess
import time

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")


def curl(url):
    r = subprocess.run(["curl", "-sS", "-L", "--max-time", "60", "-A", UA,
                        "-H", "accept-language: ja-JP,ja;q=0.9,en;q=0.8", url],
                       capture_output=True, text=True)
    return r.stdout or ""


def frontity(html):
    m = re.search(r'id="__FRONTITY_CONNECT_STATE__"[^>]*>(.*?)</script>', html, re.S)
    return json.loads(m.group(1)) if m else None


def universal(html):
    m = re.search(r'id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>',
                  html, re.S)
    return json.loads(m.group(1)) if m else None


def account(handle):
    d = universal(curl(f"https://www.tiktok.com/@{handle}"))
    if not d:
        return None
    ui = (d.get("__DEFAULT_SCOPE__", {}).get("webapp.user-detail", {})
          .get("userInfo") or {})
    u, st = ui.get("user") or {}, ui.get("stats") or {}
    if not u:
        return None
    return {"nickname": u.get("nickname"), "uniqueId": u.get("uniqueId"),
            "signature": u.get("signature"), "verified": u.get("verified"),
            "createTime": u.get("createTime"),
            "bioLink": (u.get("bioLink") or {}).get("link"),
            "followers": st.get("followerCount"), "following": st.get("followingCount"),
            "likes": st.get("heartCount") or st.get("heart"),
            "videoCount": st.get("videoCount")}


def video_list(handle, pages):
    out, seen = [], set()
    for p in range(1, pages + 1):
        url = f"https://www.tiktok.com/embed/@{handle}"
        if p > 1:
            url += f"?page={p}"
        d = frontity(curl(url))
        if not d:
            break
        node = (d.get("source", {}).get("data", {})
                .get(f"/embed/@{handle}") or {})
        vl = node.get("videoList") or []
        new = 0
        for v in vl:
            if v["id"] in seen:
                continue
            seen.add(v["id"])
            new += 1
            out.append({"id": v["id"], "desc": v.get("desc", ""),
                        "views": v.get("playCount"),
                        "url": f"https://www.tiktok.com/@{handle}/video/{v['id']}"})
        if new == 0:
            break
        time.sleep(0.8)
    return out


def video_detail(url):
    d = universal(curl(url))
    if not d:
        return {}
    it = (d.get("__DEFAULT_SCOPE__", {}).get("webapp.video-detail", {})
          .get("itemInfo", {}).get("itemStruct") or {})
    if not it:
        return {}
    s = it.get("stats") or it.get("statsV2") or {}
    n = lambda k: int(s[k]) if str(s.get(k, "")).isdigit() else None
    mus = it.get("music") or {}
    return {"createTime": it.get("createTime"),
            "duration": (it.get("video") or {}).get("duration"),
            "views": n("playCount"), "likes": n("diggCount"),
            "comments": n("commentCount"), "shares": n("shareCount"),
            "saves": n("collectCount"),
            "music": mus.get("title"), "musicAuthor": mus.get("authorName"),
            "musicOriginal": mus.get("original"),
            "desc": it.get("desc")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--handle", required=True)
    ap.add_argument("--pages", type=int, default=4)
    ap.add_argument("--detail", type=int, default=12)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    h = a.handle.lstrip("@")
    res = {"handle": h, "account": account(h), "videos": []}
    vids = video_list(h, a.pages)
    vids.sort(key=lambda v: -(v.get("views") or 0))
    for v in vids[: a.detail]:
        v.update({k: x for k, x in video_detail(v["url"]).items() if x is not None})
        time.sleep(0.6)
    res["videos"] = vids
    res["detailed"] = a.detail
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=1)
    acc = res["account"] or {}
    print(f"{h}: followers={acc.get('followers')} likes={acc.get('likes')} "
          f"videos_listed={len(vids)} detailed={min(a.detail, len(vids))}")


main()
