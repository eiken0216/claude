"""Extract hamster artwork sprites (BGRA) from ref2 full-res frames."""
import cv2
import numpy as np

S = "/tmp/claude-0/-home-user-claude/12e8e7a5-18ea-5e25-a6ea-4c8ab5751032/scratchpad"
SRC = "/root/.claude/uploads/12e8e7a5-18ea-5e25-a6ea-4c8ab5751032/ef807225-export_1784886649240.mov"

# shot pose -> frames (variants for boil)
WANT = {
    "q34": [30, 42, 54],       # 3/4 view
    "prof": [112, 128, 144],   # profile-ish
    "front": [468, 484, 500],  # front, ears up
    "droop": [648, 664, 680],  # front, droopy eyes
}
frames_needed = sorted({f for v in WANT.values() for f in v})

cap = cv2.VideoCapture(SRC)
store = {}
idx = 0
while True:
    ok, frame = cap.read()
    if not ok:
        break
    if idx in frames_needed:
        store[idx] = frame.copy()
    idx += 1
    if idx > max(frames_needed):
        break
cap.release()
print("grabbed", sorted(store.keys()))

def extract(frame):
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    b, g, r = frame[..., 0].astype(int), frame[..., 1].astype(int), frame[..., 2].astype(int)
    orange = ((h >= 4) & (h <= 24) & (s > 70) & (v > 60)).astype(np.uint8)
    cream = ((v > 140) & (s < 95) & (r > b + 12)).astype(np.uint8)
    cand = ((orange | cream) * 255).astype(np.uint8)
    cand = cv2.morphologyEx(cand, cv2.MORPH_CLOSE, np.ones((13, 13), np.uint8))
    cand = cv2.morphologyEx(cand, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    # keep components containing enough orange
    nlab, lab, stats, _ = cv2.connectedComponentsWithStats(cand, 8)
    keep = np.zeros_like(cand)
    for i in range(1, nlab):
        area = stats[i, cv2.CC_STAT_AREA]
        if area < 400:
            continue
        o = orange[lab == i].sum()
        if o > 0.15 * area:
            keep[lab == i] = 255
    # fill holes (eyes, dark strokes inside)
    ff = keep.copy()
    hh, ww = ff.shape
    mask = np.zeros((hh + 2, ww + 2), np.uint8)
    cv2.floodFill(ff, mask, (0, 0), 255)
    holes = cv2.bitwise_not(ff)
    filled = cv2.bitwise_or(keep, holes)
    filled = cv2.morphologyEx(filled, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    return filled

sprites = []
for pose, fl in WANT.items():
    for f in fl:
        frame = store[f]
        m = extract(frame)
        ys, xs = np.where(m > 0)
        if len(xs) == 0:
            print(pose, f, "EMPTY")
            continue
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        pad = 14
        x0, y0 = max(x0 - pad, 0), max(y0 - pad, 0)
        x1, y1 = min(x1 + pad, m.shape[1]), min(y1 + pad, m.shape[0])
        crop = frame[y0:y1, x0:x1]
        mc = m[y0:y1, x0:x1]
        alpha = cv2.GaussianBlur(mc, (5, 5), 0)
        bgra = np.dstack([crop, alpha])
        name = f"{pose}_{f}"
        cv2.imwrite(f"{S}/sprite_{name}.png", bgra)
        sprites.append((name, crop.shape[1], crop.shape[0]))
        print("saved", name, crop.shape[1], "x", crop.shape[0], "area", (mc > 0).sum())

# review sheet on checker background
tiles = []
for name, w, h in sprites:
    sp = cv2.imread(f"{S}/sprite_{name}.png", cv2.IMREAD_UNCHANGED)
    th = 240
    tw = max(int(w * th / h), 60)
    sp = cv2.resize(sp, (tw, th))
    ch = np.indices((th, tw)).sum(0) // 20 % 2 * 60 + 90
    bg = np.dstack([ch, ch, ch]).astype(np.uint8)
    a = sp[..., 3:4] / 255.0
    comp = (sp[..., :3] * a + bg * (1 - a)).astype(np.uint8)
    comp = cv2.copyMakeBorder(comp, 22, 4, 4, max(4, 244 - tw), cv2.BORDER_CONSTANT, value=(30, 30, 30))
    cv2.putText(comp, name, (6, 16), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
    tiles.append(comp[:266, :248])
tiles = [cv2.resize(t, (248, 266)) for t in tiles]
while len(tiles) % 6:
    tiles.append(np.zeros_like(tiles[0]))
rows = [np.hstack(tiles[i:i + 6]) for i in range(0, len(tiles), 6)]
cv2.imwrite(f"{S}/sprites_sheet.jpg", np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 92])
print("sheet saved")
