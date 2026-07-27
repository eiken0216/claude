#!/usr/bin/env python3
"""Download an artist portrait and the reference-video thumbnails for every
artist in data.js, normalise them to JPEG, and write an images/ manifest the
deck generator can read."""
import json
import os
import re
import subprocess

from PIL import Image

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
OUT = "images"
os.makedirs(OUT, exist_ok=True)


def curl_text(url):
    return subprocess.run(["curl", "-sS", "-L", "--max-time", "60", "-A", UA, url],
                          capture_output=True, text=True).stdout or ""


def curl_bin(url, path):
    r = subprocess.run(["curl", "-sS", "-L", "--max-time", "90", "-A", UA,
                        "-o", path, "-w", "%{http_code}", url],
                       capture_output=True, text=True)
    return r.stdout.strip() == "200" and os.path.getsize(path) > 2000


def normalise(path, out, max_side=1000):
    """Re-encode to a reasonably sized JPEG; returns (w, h) or None."""
    try:
        im = Image.open(path)
        im = im.convert("RGB")
    except Exception:
        return None
    if max(im.size) > max_side:
        im.thumbnail((max_side, max_side), Image.LANCZOS)
    im.save(out, "JPEG", quality=82, optimize=True)
    return im.size


def tiktok_cover(video_url):
    html = curl_text(video_url)
    m = re.search(r'id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>',
                  html, re.S)
    if not m:
        return None
    try:
        it = (json.loads(m.group(1))["__DEFAULT_SCOPE__"]["webapp.video-detail"]
              ["itemInfo"]["itemStruct"])
    except Exception:
        return None
    v = it.get("video") or {}
    return v.get("originCover") or v.get("cover") or v.get("dynamicCover")


def grab(url, stem):
    tmp = os.path.join(OUT, stem + ".tmp")
    final = os.path.join(OUT, stem + ".jpg")
    if not curl_bin(url, tmp):
        return None
    size = normalise(tmp, final)
    os.remove(tmp)
    return {"path": final, "w": size[0], "h": size[1]} if size else None


def main():
    data = json.loads(subprocess.run(
        ["node", "-e", "console.log(JSON.stringify(require('./data.js')))"],
        capture_output=True, text=True).stdout)
    avatars = json.load(open("images.json"))
    handle_of = {"Vivanz Eden": "vivanzeden_jp", "Ryudai": "ryudai_a",
                 "yuuna": "likekyuuna_s"}

    manifest = {}
    for a in data["ARTISTS"]:
        entry = {"portrait": None, "refs": {}}
        h = handle_of.get(a["name"])
        if h and avatars.get(h, {}).get("avatarLarger"):
            entry["portrait"] = grab(avatars[h]["avatarLarger"], f"{h}_portrait")
            print(f"  portrait {a['name']}: {'ok' if entry['portrait'] else 'FAILED'}")

        for i, r in enumerate(a["refs"]):
            url, stem = r["url"], f"{h}_ref{i}"
            got = None
            ym = re.search(r"(?:watch\?v=|youtu\.be/|/shorts/)([\w-]{11})", url)
            if ym:
                vid = ym.group(1)
                for q in ("maxresdefault", "hqdefault"):
                    got = grab(f"https://i.ytimg.com/vi/{vid}/{q}.jpg", stem)
                    if got and got["w"] >= 320:
                        break
            elif "tiktok.com" in url:
                cov = tiktok_cover(url)
                if cov:
                    got = grab(cov, stem)
            if got:
                entry["refs"][str(i)] = got
            print(f"  ref{i} {a['name']}: {'ok' if got else 'FAILED'}  {url}")
        manifest[a["name"]] = entry

    json.dump(manifest, open("image_manifest.json", "w"), ensure_ascii=False, indent=1)
    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
    print(f"\nmanifest written. {len(os.listdir(OUT))} images, {total:,} bytes total")


main()
