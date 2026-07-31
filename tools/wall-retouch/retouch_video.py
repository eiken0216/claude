"""Clean the studio wall behind the talent in a video.

    python3 retouch_video.py IN.mov OUT.mp4 [lift] [crf]

A first pass measures the wall's own colour over the whole clip, so every
frame evens out to the same tone and the background cannot drift.  ``lift``
(default 1.06) is how much brighter than that tone to aim for — 1.0 keeps the
original brightness exactly and only removes the unevenness.

The second pass runs every frame through ``retouch.retouch`` (the wall colour
field is carried over frame to frame so the correction cannot flicker), then
re-encodes and copies the original audio across.
"""
import json
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from retouch import LIFT, retouch, wall_tone


def probe(path):
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height,r_frame_rate",
         "-of", "json", path])
    s = json.loads(out)["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return int(s["width"]), int(s["height"]), f"{num}/{den}"


def has_audio(path):
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-select_streams", "a",
         "-show_entries", "stream=index", "-of", "csv=p=0", path])
    return bool(out.strip())


def raw_frames(src, w, h, step=1):
    """Yield decoded BGR frames (every ``step``-th one)."""
    fsz = w * h * 3
    dec = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", src,
         "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
        stdout=subprocess.PIPE, bufsize=fsz * 4)
    i = 0
    while True:
        buf = dec.stdout.read(fsz)
        if len(buf) < fsz:
            break
        if i % step == 0:
            yield np.frombuffer(buf, np.uint8).reshape(h, w, 3).astype(np.float32) / 255.0
        i += 1
    dec.stdout.close()
    dec.wait()


def measure_tone(src, w, h, step=20):
    """The clip's own wall colour, averaged over sampled frames."""
    tones = [t for t in (wall_tone(f) for f in raw_frames(src, w, h, step))
             if t is not None]
    if not tones:
        return None
    tone = np.mean(tones, axis=0)
    print("wall tone RGB", (tone[::-1] * 255).round(1), f"({len(tones)} frames)")
    return tone


def main(src, dst, lift=LIFT, crf="16", maxrate=None):
    lift = float(lift)
    w, h, fps = probe(src)
    fsz = w * h * 3
    print(f"{src}: {w}x{h} @ {fps}")
    tone = measure_tone(src, w, h)

    dec = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", src,
         "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
        stdout=subprocess.PIPE, bufsize=fsz * 4)

    cmd = ["ffmpeg", "-v", "error", "-y",
           "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", fps, "-i", "-"]
    if has_audio(src):
        cmd += ["-i", src, "-map", "0:v:0", "-map", "1:a:0",
                "-c:a", "aac", "-b:a", "192k"]
    cmd += ["-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-pix_fmt", "yuv420p",
            "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709"]
    if maxrate:                                   # cap the file size in one pass
        cmd += ["-maxrate", str(maxrate), "-bufsize", str(maxrate)]
    cmd += ["-movflags", "+faststart", dst]
    enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    prev, n = None, 0
    while True:
        buf = dec.stdout.read(fsz)
        if len(buf) < fsz:
            break
        frame = np.frombuffer(buf, np.uint8).reshape(h, w, 3).astype(np.float32) / 255.0
        out, prev = retouch(frame, prev_field=prev, target=tone, lift=lift)
        enc.stdin.write((out * 255.0 + 0.5).astype(np.uint8).tobytes())
        n += 1
        if n % 100 == 0:
            print("frame", n, flush=True)

    enc.stdin.close()
    enc.wait()
    dec.wait()
    print(f"done {n} frames -> {dst}")


if __name__ == "__main__":
    main(*sys.argv[1:])
