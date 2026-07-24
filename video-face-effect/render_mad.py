"""Pattern A: MAD-style animated effects over face + skin (head + hands)."""
import cv2
import numpy as np
from common import (S, SRC, W, H, FPS, N, load_tracks, build_hand_tracks,
                    noise_field, roughen, Encoder)

tracks = load_tracks()
tv = tracks["vocal"]
tg = tracks["guitar"]
hand_tracks = build_hand_tracks(tracks["wrists"])

# keep only hand tracks that stay near a person (vocalist head, or guitarist zone
# in his visible frames) — drops spurious wrist blobs floating in the background
def near_person(tr):
    ds = []
    for f, (x, y) in tr.items():
        f = min(f, N - 1)
        d = np.hypot(x - tv["x"][f], y - tv["y"][f])
        gf = tg["frames"].get(str(f))
        if gf is not None:
            d = min(d, np.hypot(x - gf[0], y - gf[1]) * 0.7)
        # guitarist arm zone (bottom-right, frames 250-320)
        if 240 <= f <= 320 and x > 220 and y > 440:
            d = min(d, 100)
        ds.append(d)
    return np.median(ds) < 230
hand_tracks = [t for t in hand_tracks if near_person(t)]
print("hand tracks kept:", len(hand_tracks))

# ---------------------------------------------------------------- mask per frame
def skin_mask(f):
    m = np.zeros((H, W), np.uint8)
    # vocalist head (generous ellipse)
    x, y, s = tv["x"][f], tv["y"][f], tv["s"][f]
    a = int(max(s * 0.85, 34))
    b = int(a * 1.18)
    cv2.ellipse(m, (int(x), int(y)), (a, b), 0, 0, 360, 255, -1)
    # guitarist head, frames 0-26
    gf = tg["frames"].get(str(f))
    if gf is not None:
        gx, gy, gs = gf
        cv2.ellipse(m, (int(gx), int(gy)), (int(gs * 0.62), int(gs * 0.72)), 0, 0, 360, 255, -1)
    # mic fist near the mouth while singing (pose misses this raised hand);
    # sits left of the face at roughly mouth height
    if 82 <= f <= 135:
        cv2.ellipse(m, (int(x - 0.85 * s), int(y + 0.28 * s)),
                    (int(0.78 * s), int(0.6 * s)), 15, 0, 360, 255, -1)
        cv2.ellipse(m, (int(x - 0.3 * s), int(y + 0.6 * s)),
                    (int(0.6 * s), int(0.5 * s)), 20, 0, 360, 255, -1)
        # knuckles of the mic fist, lower-left of the face
        cv2.ellipse(m, (int(x - 1.45 * s), int(y + 1.0 * s)),
                    (int(0.9 * s), int(0.7 * s)), 10, 0, 360, 255, -1)
    # hands
    r_hand = int(max(s * 0.55, 24))
    for t in hand_tracks:
        p = t.get(f)
        if p is not None:
            cv2.circle(m, (int(p[0]), int(p[1])), r_hand, 255, -1)
    return m

# ---------------------------------------------------------------- effect styles
def draw_scribble(canvas_shape, bbox, color, n_strokes, seed, thickness=3):
    """Random smooth scribble strokes inside bbox; returns float32 BGR layer."""
    r = np.random.default_rng(seed)
    layer = np.zeros((*canvas_shape, 3), np.float32)
    x0, y0, x1, y1 = bbox
    w, h = max(x1 - x0, 8), max(y1 - y0, 8)
    for i in range(n_strokes):
        npts = r.integers(4, 7)
        px = r.uniform(x0 - 0.15 * w, x1 + 0.15 * w, npts)
        py = r.uniform(y0 - 0.15 * h, y1 + 0.15 * h, npts)
        pts = np.stack([px, py], 1)
        # catmull-rom-ish smoothing via polyline resample
        t = np.linspace(0, npts - 1, npts * 12)
        xi = np.interp(t, np.arange(npts), pts[:, 0])
        yi = np.interp(t, np.arange(npts), pts[:, 1])
        xi = cv2.GaussianBlur(xi.astype(np.float32).reshape(-1, 1), (1, 9), 3).ravel()
        yi = cv2.GaussianBlur(yi.astype(np.float32).reshape(-1, 1), (1, 9), 3).ravel()
        poly = np.stack([xi, yi], 1).astype(np.int32)
        c = np.array(color, np.float32) * float(r.uniform(0.75, 1.15))
        cv2.polylines(layer, [poly], False, c.tolist(), thickness, cv2.LINE_AA)
    return layer


def style_scribble(frame, mask, f, tick, color, glow_color=None, dark=0.22):
    ys, xs = np.where(mask > 0)
    if len(xs) == 0:
        return frame
    bbox = (xs.min(), ys.min(), xs.max(), ys.max())
    layer = draw_scribble((H, W), bbox, color, 14, seed=1000 + tick * 7, thickness=3)
    glow = cv2.GaussianBlur(layer, (0, 0), 6)
    if glow_color is not None:
        glow = glow * (np.array(glow_color, np.float32) / 255.0)
    eff = frame.astype(np.float32) * dark + layer * 1.0 + glow * 0.9
    return np.clip(eff, 0, 255).astype(np.uint8)


def style_stripes(frame, mask, f, tick):
    gx, gy = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    ang = 0.5 + 0.15 * np.sin(f * 0.05)
    u = gx * np.cos(ang) + gy * np.sin(ang)
    dx, _ = noise_field((H, W), 40, 14, seed=42)
    bands = np.sin((u + dx + f * 1.5) * 2 * np.pi / 26.0)
    stripes = (bands > 0.05).astype(np.float32)
    eff = np.dstack([stripes * 235] * 3)
    return np.clip(eff, 0, 255).astype(np.uint8)


def style_neon(frame, mask, f, tick):
    r = np.random.default_rng(5)
    n1 = cv2.resize(r.standard_normal((18, 11)).astype(np.float32), (W, H), interpolation=cv2.INTER_CUBIC)
    n2 = cv2.resize(r.standard_normal((36, 21)).astype(np.float32), (W, H), interpolation=cv2.INTER_CUBIC)
    ph = f * 0.13
    v = np.sin(n1 * 2.3 + ph) + 0.6 * np.sin(n2 * 3.1 - ph * 1.4)
    v = (v - v.min()) / (v.max() - v.min() + 1e-6)
    # purple/blue/pink gradient
    b = 90 + 165 * v
    g = 15 + 40 * v
    rr = 60 + 160 * np.abs(np.sin(v * 3.14 * 1.5))
    fil = np.clip(1.0 - np.abs(v - (0.5 + 0.22 * np.sin(ph))) * 14, 0, 1)  # bright filaments
    eff = np.dstack([b + fil * 160, g + fil * 200, rr + fil * 190])
    return np.clip(eff, 0, 255).astype(np.uint8)


def style_void(frame, mask, f, tick):
    eff = np.zeros((H, W, 3), np.float32)
    edge = cv2.morphologyEx(mask, cv2.MORPH_GRADIENT, np.ones((7, 7), np.uint8))
    edge = cv2.GaussianBlur(edge, (0, 0), 4).astype(np.float32) / 255.0
    eff[..., 0] += edge * 120  # faint purple rim
    eff[..., 2] += edge * 90
    return np.clip(eff, 0, 255).astype(np.uint8)


# style schedule: (start_frame, style_fn kwargs)
SEGMENTS = [
    (0,   "scribble_white"),
    (78,  "stripes"),
    (156, "neon"),
    (234, "void"),
    (300, "scribble_red"),
    (352, "scribble_pink"),
    (420, "stripes"),
]

def seg_style(f):
    cur = SEGMENTS[0][1]
    for st, name in SEGMENTS:
        if f >= st:
            cur = name
    return cur


cap = cv2.VideoCapture(SRC)
enc = Encoder(f"{S}/out_A_mad.mp4")
f = 0
while True:
    ok, frame = cap.read()
    if not ok:
        break
    tick = f // 2  # redraw scribbles at 15fps
    base = skin_mask(f)
    m = roughen(base, seed=300 + tick, amp=7, scale=26)
    m = cv2.GaussianBlur(m, (5, 5), 0)
    style = seg_style(f)
    if style == "scribble_white":
        eff = style_scribble(frame, m, f, tick, (235, 235, 235))
    elif style == "scribble_red":
        eff = style_scribble(frame, m, f, tick, (40, 40, 235), glow_color=(60, 60, 255), dark=0.15)
    elif style == "scribble_pink":
        eff = style_scribble(frame, m, f, tick, (200, 70, 245), glow_color=(255, 80, 255), dark=0.18)
    elif style == "stripes":
        eff = style_stripes(frame, m, f, tick)
    elif style == "neon":
        eff = style_neon(frame, m, f, tick)
    else:
        eff = style_void(frame, m, f, tick)
    a = (m.astype(np.float32) / 255.0)[..., None]
    out = (frame.astype(np.float32) * (1 - a) + eff.astype(np.float32) * a)
    out = np.clip(out, 0, 255).astype(np.uint8)
    enc.write(out)
    f += 1
cap.release()
enc.close()
print("rendered", f, "frames -> out_A_mad.mp4")
