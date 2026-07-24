"""Pattern B: girigiri.hamster-style hamster face tracked onto heads."""
import cv2
import numpy as np
from common import S, SRC, W, H, N, load_tracks, Encoder

tracks = load_tracks()
tv = tracks["vocal"]
tg = tracks["guitar"]

POSES = {
    "q34": ["sprite_q34_30.png", "sprite_q34_42.png", "sprite_q34_54.png"],
    "prof": ["sprite_prof_128.png", "sprite_prof_144.png"],
    "front": ["sprite_front_468.png"],
}
sprites = {k: [cv2.imread(f"{S}/{p}", cv2.IMREAD_UNCHANGED).astype(np.float32) for p in v]
           for k, v in POSES.items()}

# whisker anchors (normalized x,y in sprite) per pose: list of (side, ax, ay)
WHISKERS = {
    "q34": [(-1, 0.16, 0.74), (1, 0.86, 0.72)],
    "prof": [(-1, 0.12, 0.72)],
    "front": [(-1, 0.13, 0.66), (1, 0.90, 0.64)],
}

SHOTS = [(0, "q34"), (120, "prof"), (240, "front"), (342, "q34")]

def pose_at(f):
    cur = SHOTS[0][1]
    for st, p in SHOTS:
        if f >= st:
            cur = p
    return cur


def add_whiskers(sp, pose, rngv):
    """Draw rough hand-drawn whisker strokes extending beyond the sprite."""
    h, w = sp.shape[:2]
    ext = int(w * 0.42)
    big = np.zeros((h + 40, w + 2 * ext, 4), np.float32)
    big[20:20 + h, ext:ext + w] = sp
    for side, ax, ay in WHISKERS[pose]:
        ox, oy = ext + ax * w, 20 + ay * h
        for i in range(3):
            ang = (-0.24 + 0.22 * i) + rngv.uniform(-0.05, 0.05)
            ln = w * rngv.uniform(0.34, 0.5)
            mx = ox + side * ln * 0.55 * np.cos(ang)
            my = oy + ln * 0.5 * np.sin(ang) - w * 0.03
            exx = ox + side * ln * np.cos(ang + rngv.uniform(-0.08, 0.08))
            exy = oy + ln * np.sin(ang) + ln * 0.12
            pts = []
            for t in np.linspace(0, 1, 14):
                bx = (1 - t) ** 2 * ox + 2 * (1 - t) * t * mx + t ** 2 * exx
                by = (1 - t) ** 2 * oy + 2 * (1 - t) * t * my + t ** 2 * exy
                pts.append((bx + rngv.uniform(-1, 1), by + rngv.uniform(-1, 1)))
            pts = np.array(pts, np.int32)
            th = max(int(w * 0.014), 2)
            col = (26, 22, 28, 235)
            cv2.polylines(big, [pts], False, col, th, cv2.LINE_AA)
    return big, w  # whiskered canvas + original head width


def place(frame_f, sp, cx, cy, target_w, rot, alpha_mul=1.0):
    """Alpha-composite sprite (float32 BGRA) centered at (cx,cy) scaled to target_w."""
    h, w = sp.shape[:2]
    scale = target_w / w
    M = cv2.getRotationMatrix2D((w / 2, h / 2), rot, scale)
    M[0, 2] += cx - w / 2
    M[1, 2] += cy - h / 2
    warped = cv2.warpAffine(sp, M, (W, H), flags=cv2.INTER_AREA,
                            borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
    a = (warped[..., 3:4] / 255.0) * alpha_mul
    frame_f[:] = frame_f * (1 - a) + warped[..., :3] * 0.97 * a


cap = cv2.VideoCapture(SRC)
enc = Encoder(f"{S}/out_B_hamster.mp4")
f = 0
prepared = {}  # (pose, tick) -> whiskered sprite cache
while True:
    ok, frame = cap.read()
    if not ok:
        break
    tick = f // 3  # boil at ~8fps
    rngt = np.random.default_rng(900 + tick)
    pose = pose_at(f)
    variants = sprites[pose]
    sp_idx = tick % len(variants)
    key = (pose, tick % 6)
    if key not in prepared:
        prepared[key] = add_whiskers(variants[sp_idx], pose, np.random.default_rng(hash(key) % 99999))
    sp, w_head = prepared[key]

    out = frame.astype(np.float32)
    # vocalist
    x, y, s = tv["x"][f], tv["y"][f], tv["s"][f]
    tw = max(s * 2.05, 62) * (1 + 0.02 * rngt.standard_normal())
    tw_full = tw * sp.shape[1] / w_head  # scale so the head part matches tw
    rot = float(np.clip(2.2 * rngt.standard_normal(), -4, 4))
    jx, jy = rngt.uniform(-2, 2), rngt.uniform(-2, 2)
    place(out, sp, x + jx, y - s * 0.06 + jy, tw_full, rot)
    # guitarist (small distant hamster, frames 0-26, fading at the end)
    gf = tg["frames"].get(str(f))
    if gf is not None:
        gx, gy, gs = gf
        fade = 1.0 if f < 20 else max(0.0, (26 - f) / 6.0)
        if fade > 0:
            gsp, gw = prepared.setdefault(("front", "g", tick % 4),
                                          add_whiskers(sprites["front"][0], "front",
                                                       np.random.default_rng(400 + tick % 4)))
            place(out, gsp, gx, gy - 6, gs * 1.35 * gsp.shape[1] / gw, rot * 0.5, fade)

    enc.write(np.clip(out, 0, 255).astype(np.uint8))
    f += 1
cap.release()
enc.close()
print("rendered", f, "frames -> out_B_hamster.mp4")
