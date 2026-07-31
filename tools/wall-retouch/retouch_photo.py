"""Clean the studio wall behind the talent in a still.

    python3 retouch_photo.py IN.jpg OUT.jpg [--cmp]

``--cmp`` also writes a before/after preview next to the output.
"""
import os
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from retouch import retouch


def main(src, dst, cmp_preview=False):
    img = cv2.imread(src, cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f"cannot read {src}")
    print(f"{src}: {img.shape[1]}x{img.shape[0]}")

    out, _ = retouch(img.astype(np.float32) / 255.0)
    out = (out * 255.0 + 0.5).astype(np.uint8)
    cv2.imwrite(dst, out, [cv2.IMWRITE_JPEG_QUALITY, 97])

    if cmp_preview:
        h = 760
        w = int(img.shape[1] * h / img.shape[0])
        side = np.concatenate([cv2.resize(img, (w, h)), cv2.resize(out, (w, h))], axis=1)
        cv2.imwrite(os.path.splitext(dst)[0] + "_cmp.jpg", side,
                    [cv2.IMWRITE_JPEG_QUALITY, 92])
    print("->", dst)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    main(*args, cmp_preview="--cmp" in sys.argv)
