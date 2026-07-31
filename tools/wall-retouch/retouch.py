"""Background wall clean-up for the TFT SNS clip / stills.

The wall keeps its own colour — the point is to even it out, not to blow it to
white, which reads as a cut-out.  Three stages, all driven by a soft "this
pixel is wall" mask:

  1. flat-field  : estimate the smooth wall colour field (illumination + colour
                   cast, including the diagonal light streaks) and divide it
                   out, so the wall settles on one even tone.  The target tone
                   is the wall's *own* median colour, optionally lifted a few
                   percent.  Division keeps the film grain, so the background
                   still matches the subject's texture.
  2. stain       : whatever deviation survives at blob scale (marks, patches,
                   blotches) is low-passed over the wall only and subtracted.
                   Fine grain is below that scale and is left alone.
  3. edge guard  : both corrections fade out towards the silhouette, so the
                   talent's natural contact shadow on the wall stays put.

Skin, costume and stray hair are never touched: the gain tapers to 1.0 across
the subjects.
"""
import cv2
import numpy as np

LIFT = 1.06          # how much brighter than the wall's own tone to aim for


# ---------------------------------------------------------------- mask -----
def _odd(v):
    v = max(3, int(round(v)))
    return v + 1 - v % 2


def wall_mask(bgr, s=1.0, field=None):
    """bgr float32 0..1 -> binary mask of the wall (1 = wall).

    With ``field`` (a first-pass estimate of the wall colour) the brightness
    test becomes relative, so a wall that falls off into a dark corner is still
    recognised as wall.
    """
    mx = bgr.max(2)
    mn = bgr.min(2)
    sat = (mx - mn) / np.maximum(mx, 1e-6)
    if field is None:
        raw = ((mx > 0.60) & (sat < 0.14)).astype(np.uint8)
    else:
        rel = mx / np.maximum(field.max(2), 1e-6)
        raw = ((rel > 0.86) & (rel < 1.25) & (sat < 0.14)).astype(np.uint8)

    # break thin bridges (white shirt <-> white wall) before growing regions
    k5 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (_odd(5 * s),) * 2)
    core = cv2.erode(raw, k5, iterations=2)

    n, lbl = cv2.connectedComponents(core, connectivity=4)
    border = np.concatenate([lbl[0], lbl[-1], lbl[:, 0], lbl[:, -1]])
    keep = np.zeros(n, np.uint8)
    keep[np.unique(border[border > 0])] = 1
    bg = keep[lbl]                                   # only wall touching frame edge

    bg = cv2.dilate(bg, k5, iterations=2) & raw      # grow back to the true edge
    bg = cv2.morphologyEx(bg, cv2.MORPH_CLOSE,
                          cv2.getStructuringElement(
                              cv2.MORPH_ELLIPSE, (_odd(9 * s),) * 2))
    return bg


# --------------------------------------------------------------- field -----
def push_pull(img, mask, levels=7):
    """Fill masked-out areas by pyramid interpolation (normalised convolution)."""
    pi = [img * mask[..., None]]
    pm = [mask]
    for _ in range(levels):
        pi.append(cv2.pyrDown(pi[-1]))
        pm.append(cv2.pyrDown(pm[-1]))
    eps = 1e-4
    up = pi[-1] / np.maximum(pm[-1], eps)[..., None]
    for i in range(len(pi) - 2, -1, -1):
        h, w = pm[i].shape
        up = cv2.resize(up, (w, h), interpolation=cv2.INTER_LINEAR)
        m = pm[i][..., None]
        cur = pi[i] / np.maximum(m, eps)
        a = np.clip(m / 0.5, 0.0, 1.0)               # trust dense samples only
        up = cur * a + up * (1.0 - a)
    return up


def wall_field(bgr, bg, small_w=160, blur=9):
    """Smooth per-pixel estimate of the wall colour behind everything."""
    h, w = bg.shape
    sh = max(4, int(round(h * small_w / w)))
    s_img = cv2.resize(bgr, (small_w, sh), interpolation=cv2.INTER_AREA)
    s_msk = cv2.resize(bg.astype(np.float32), (small_w, sh),
                       interpolation=cv2.INTER_AREA)
    s_msk = (s_msk > 0.6).astype(np.float32)
    if s_msk.sum() < 20:
        s_msk = np.ones_like(s_msk)
    f = push_pull(s_img, s_msk)
    f = cv2.GaussianBlur(f, (0, 0), blur)
    return f                                          # small; upscaled later


def wall_tone(bgr, s=None):
    """The wall's own median colour (BGR float) — the tone to even out to."""
    h, w = bgr.shape[:2]
    if s is None:
        s = w / 946.0
    rough = cv2.resize(wall_field(bgr, wall_mask(bgr, s)), (w, h),
                       interpolation=cv2.INTER_CUBIC)
    bg = wall_mask(bgr, s, field=rough).astype(bool)
    if bg.sum() < 100:
        return None
    return np.median(bgr[bg], axis=0)


# ------------------------------------------------------------- retouch -----
def retouch(bgr, prev_field=None, ema=0.35, target=None, lift=LIFT,
            gain_lo=0.80, gain_hi=1.80, feather=9,
            stain=1.0, stain_sigma=9.0, s0=10.0, s1=34.0, s=None):
    """bgr float32 0..1 -> (result, field).

    ``target`` is the BGR tone the wall should settle on.  Pass the value
    measured once over a whole clip so the background cannot drift; leave it
    None to derive it per image.  ``s`` scales every pixel-sized parameter and
    defaults to the image width relative to the 946 px clip it was tuned on.
    """
    h, w = bgr.shape[:2]
    if s is None:
        s = w / 946.0
    feather, stain_sigma, s0, s1 = feather * s, stain_sigma * s, s0 * s, s1 * s

    # pass 1: conservative mask -> rough wall colour; pass 2: relative mask
    rough = cv2.resize(wall_field(bgr, wall_mask(bgr, s)), (w, h),
                       interpolation=cv2.INTER_CUBIC)
    bg = wall_mask(bgr, s, field=rough)

    field = wall_field(bgr, bg)
    if prev_field is not None and prev_field.shape == field.shape:
        field = ema * field + (1.0 - ema) * prev_field
    new_field = field

    big = cv2.resize(field, (w, h), interpolation=cv2.INTER_CUBIC)
    if target is None:
        m = bg.astype(bool)
        target = np.median(bgr[m], axis=0) if m.sum() > 100 else big.mean((0, 1))
    target = np.clip(np.float32(target) * lift, 0.0, 1.0)

    gain = np.clip(target / np.maximum(big, 1e-3), gain_lo, gain_hi)

    # taper the gain to 1.0 across the subjects
    soft = cv2.GaussianBlur(bg.astype(np.float32), (0, 0), feather)
    soft = np.clip(soft * 1.15, 0.0, 1.0)[..., None]
    out = bgr * (1.0 + (gain - 1.0) * soft)

    # blob-scale stains: low-pass the residual over the wall only, subtract it
    if stain > 0:
        m = bg.astype(np.float32)
        res = (out - target) * m[..., None]
        num = cv2.GaussianBlur(res, (0, 0), stain_sigma)
        den = cv2.GaussianBlur(m, (0, 0), stain_sigma)[..., None]
        blob = num / np.maximum(den, 1e-3)
        dist = cv2.distanceTransform(bg, cv2.DIST_L2, 3)
        wgt = np.clip((dist - s0) / (s1 - s0), 0.0, 1.0)[..., None] * stain
        out = out - blob * wgt

    return np.clip(out, 0.0, 1.0), new_field
