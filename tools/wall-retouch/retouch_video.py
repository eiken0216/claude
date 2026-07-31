"""Clean the studio wall behind the talent in a video.

    python3 retouch_video.py IN.mov OUT.mp4

Decodes with ffmpeg, runs every frame through ``retouch.retouch`` (the wall
colour field is carried over frame to frame so the correction cannot flicker),
then re-encodes and copies the original audio across.
"""
import json
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from retouch import retouch


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


def main(src, dst, crf="16"):
    w, h, fps = probe(src)
    fsz = w * h * 3
    print(f"{src}: {w}x{h} @ {fps}")

    dec = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", src,
         "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
        stdout=subprocess.PIPE, bufsize=fsz * 4)

    cmd = ["ffmpeg", "-v", "error", "-y",
           "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", fps, "-i", "-"]
    if has_audio(src):
        cmd += ["-i", src, "-map", "0:v:0", "-map", "1:a:0",
                "-c:a", "aac", "-b:a", "192k"]
    cmd += ["-c:v", "libx264", "-preset", "slow", "-crf", crf, "-pix_fmt", "yuv420p",
            "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
            "-movflags", "+faststart", dst]
    enc = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    prev, n = None, 0
    while True:
        buf = dec.stdout.read(fsz)
        if len(buf) < fsz:
            break
        frame = np.frombuffer(buf, np.uint8).reshape(h, w, 3).astype(np.float32) / 255.0
        out, prev = retouch(frame, prev_field=prev)
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
