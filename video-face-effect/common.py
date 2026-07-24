"""Shared helpers: tracks, hand tracks, rough masks, encoding."""
import cv2
import numpy as np
import json
import subprocess

S = "/tmp/claude-0/-home-user-claude/12e8e7a5-18ea-5e25-a6ea-4c8ab5751032/scratchpad"
SRC = "/root/.claude/uploads/12e8e7a5-18ea-5e25-a6ea-4c8ab5751032/6057c3ec-oIYs1INpH8ApyNYcCVFD5C_TgdtTLaSa9jPkwBSa43Q.mp4"
W, H, N = 404, 720, 453
FPS = "1510/63"  # source avg_frame_rate (VFR ~23.97fps)

rng = np.random.default_rng(7)


def load_tracks():
    return json.load(open(f"{S}/tracks.json"))


def build_hand_tracks(wrists, n=N):
    """Greedy temporal clustering of wrist obs into smooth hand tracks.

    Returns list of dicts {frame: (x, y)} interpolated over gaps <= 10.
    """
    obs = []
    for f_str, pts in wrists.items():
        for p in pts:
            obs.append((int(f_str), p[0], p[1]))
    obs.sort()
    tracks = []
    for f, x, y in obs:
        best = None
        bestd = 1e9
        for t in tracks:
            lf, lx, ly = t[-1]
            if f - lf == 0:
                continue
            if f - lf > 10:
                continue
            d = np.hypot(x - lx, y - ly)
            if d < 45 + 8 * (f - lf) and d < bestd:
                best, bestd = t, d
        if best is not None:
            best.append((f, x, y))
        else:
            tracks.append([(f, x, y)])
    out = []
    for t in tracks:
        if len(t) < 4:
            continue
        fs = [o[0] for o in t]
        xs = np.array([o[1] for o in t])
        ys = np.array([o[2] for o in t])
        allf = np.arange(fs[0], fs[-1] + 1)
        xi = np.interp(allf, fs, xs)
        yi = np.interp(allf, fs, ys)
        k = 5
        if len(allf) >= k:
            ker = np.ones(k) / k
            pad = k // 2
            xi = np.convolve(np.pad(xi, pad, mode="edge"), ker, mode="valid")
            yi = np.convolve(np.pad(yi, pad, mode="edge"), ker, mode="valid")
        out.append({int(f): (float(x), float(y)) for f, x, y in zip(allf, xi, yi)})
    return out


def noise_field(shape, scale, amp, seed):
    """Smooth random displacement fields (dx, dy)."""
    r = np.random.default_rng(seed)
    small = (max(shape[0] // scale, 2), max(shape[1] // scale, 2))
    dx = cv2.resize(r.standard_normal(small).astype(np.float32), (shape[1], shape[0]), interpolation=cv2.INTER_CUBIC)
    dy = cv2.resize(r.standard_normal(small).astype(np.float32), (shape[1], shape[0]), interpolation=cv2.INTER_CUBIC)
    return dx * amp, dy * amp


def roughen(mask, seed, amp=6, scale=28):
    """Displace mask edges with smooth noise for a hand-drawn rough boundary."""
    dx, dy = noise_field(mask.shape, scale, amp, seed)
    gx, gy = np.meshgrid(np.arange(mask.shape[1], dtype=np.float32),
                         np.arange(mask.shape[0], dtype=np.float32))
    return cv2.remap(mask, gx + dx, gy + dy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)


class Encoder:
    def __init__(self, out_path):
        self.proc = subprocess.Popen([
            "ffmpeg", "-y", "-v", "error",
            "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", FPS, "-i", "pipe:",
            "-i", SRC,
            "-map", "0:v", "-map", "1:a",
            "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p",
            "-c:a", "copy", "-shortest", out_path,
        ], stdin=subprocess.PIPE)

    def write(self, frame):
        self.proc.stdin.write(frame.tobytes())

    def close(self):
        self.proc.stdin.close()
        self.proc.wait()


def smoothstep(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)
