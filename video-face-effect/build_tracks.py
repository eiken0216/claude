"""Build smooth head tracks (vocalist + guitarist) from raw pose data."""
import json
import numpy as np

S = "/tmp/claude-0/-home-user-claude/12e8e7a5-18ea-5e25-a6ea-4c8ab5751032/scratchpad"
records = json.load(open(f"{S}/pose_raw.json"))
N = len(records)
W, H = 404, 720

def head_of(person):
    """Return (cx, cy, size, conf) head estimate for one detected person."""
    kp = np.array(person["kp"])  # (17,3)
    box = person["box"]
    pts = kp[0:5]
    good = pts[pts[:, 2] > 0.3]
    shoulders = kp[5:7]
    sh_good = shoulders[shoulders[:, 2] > 0.3]
    if len(good) >= 1:
        cx, cy = good[:, 0].mean(), good[:, 1].mean()
        size = None
        if kp[3][2] > 0.3 and kp[4][2] > 0.3:
            size = np.hypot(kp[3][0] - kp[4][0], kp[3][1] - kp[4][1]) * 1.9
        if size is None and len(sh_good) == 2:
            size = np.hypot(sh_good[0][0] - sh_good[1][0], sh_good[0][1] - sh_good[1][1]) * 0.75
        if size is None:
            size = (box[2] - box[0]) * 0.35
        return cx, cy, max(size, 18), float(good[:, 2].mean())
    # fallback: top-center of the box
    bw = box[2] - box[0]
    return (box[0] + box[2]) / 2, box[1] + bw * 0.22, bw * 0.4, 0.15

# stats: people per frame
counts = [len(r) for r in records]
print("people-per-frame histogram:", {c: counts.count(c) for c in sorted(set(counts))})

# Collect all head observations
obs = []  # (frame, cx, cy, size, conf, area)
for f, people in enumerate(records):
    for p in people:
        cx, cy, size, conf = head_of(p)
        area = (p["box"][2] - p["box"][0]) * (p["box"][3] - p["box"][1])
        obs.append((f, cx, cy, size, conf, area))

obs_by_frame = {}
for o in obs:
    obs_by_frame.setdefault(o[0], []).append(o)

# Track 1: vocalist = biggest person. Greedy nearest-neighbour association seeded
# from the frame with the largest detection.
def build_track(seed_frame, seed_xy, claimed):
    track = {}
    pos = np.array(seed_xy)
    # forward
    p = pos.copy()
    for f in range(seed_frame, N):
        cands = [o for o in obs_by_frame.get(f, []) if (f, o[1], o[2]) not in claimed]
        if cands:
            d = [np.hypot(o[1] - p[0], o[2] - p[1]) for o in cands]
            i = int(np.argmin(d))
            if d[i] < 150:
                o = cands[i]
                track[f] = o
                claimed.add((f, o[1], o[2]))
                p = np.array([o[1], o[2]])
    # backward
    p = pos.copy()
    for f in range(seed_frame - 1, -1, -1):
        cands = [o for o in obs_by_frame.get(f, []) if (f, o[1], o[2]) not in claimed]
        if cands:
            d = [np.hypot(o[1] - p[0], o[2] - p[1]) for o in cands]
            i = int(np.argmin(d))
            if d[i] < 150:
                o = cands[i]
                track[f] = o
                claimed.add((f, o[1], o[2]))
                p = np.array([o[1], o[2]])
    return track

biggest = max(obs, key=lambda o: o[5])
print("seed vocalist: frame", biggest[0], "head", biggest[1:4])
claimed = set()
t1 = build_track(biggest[0], (biggest[1], biggest[2]), claimed)

# Track 2: guitarist = largest remaining observation
rest = [o for o in obs if (o[0], o[1], o[2]) not in claimed]
t2 = {}
if rest:
    big2 = max(rest, key=lambda o: o[5])
    print("seed guitarist: frame", big2[0], "head", big2[1:4])
    t2 = build_track(big2[0], (big2[1], big2[2]), claimed)

def smooth_track(track, min_frames=0, max_frames=N):
    """Interpolate over gaps + moving-average smooth. Returns arrays over [0,N)."""
    fs = sorted(track.keys())
    if not fs:
        return None
    xs = np.array([track[f][1] for f in fs])
    ys = np.array([track[f][2] for f in fs])
    ss = np.array([track[f][3] for f in fs])
    allf = np.arange(N)
    xi = np.interp(allf, fs, xs)
    yi = np.interp(allf, fs, ys)
    si = np.interp(allf, fs, ss)
    k = 9
    ker = np.ones(k) / k
    pad = k // 2
    def sm(a):
        ap = np.pad(a, pad, mode="edge")
        return np.convolve(ap, ker, mode="valid")
    return {"x": sm(xi).tolist(), "y": sm(yi).tolist(), "s": sm(si).tolist(),
            "first": int(fs[0]), "last": int(fs[-1]), "nobs": len(fs)}

tr1 = smooth_track(t1)
tr2 = smooth_track(t2)
print("vocalist: obs frames", tr1["nobs"], "range", tr1["first"], "-", tr1["last"])
if tr2:
    print("guitarist: obs frames", tr2["nobs"], "range", tr2["first"], "-", tr2["last"])

# wrists for the MAD skin pass: store per-frame wrist points of all people
wrists = {}
for f, people in enumerate(records):
    pts = []
    for p in people:
        kp = np.array(p["kp"])
        for wi in (9, 10):
            if kp[wi][2] > 0.35:
                pts.append([round(float(kp[wi][0]), 1), round(float(kp[wi][1]), 1)])
    if pts:
        wrists[f] = pts

json.dump({"vocal": tr1, "guitar": tr2, "wrists": wrists}, open(f"{S}/tracks.json", "w"))
print("saved tracks.json")
