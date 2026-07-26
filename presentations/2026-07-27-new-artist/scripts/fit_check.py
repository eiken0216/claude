#!/usr/bin/env python3
"""Geometric text-fit check for a .pptx (used because LibreOffice rendering is
unavailable in this sandbox). Estimates wrapped line count per text frame and
flags frames whose text is likely to overflow its box, plus boxes that run past
the slide edge."""
import sys
import unicodedata
from pptx import Presentation
from pptx.util import Emu

EMU_IN = 914400


def char_em(ch):
    """Advance width as a fraction of the font size."""
    if unicodedata.east_asian_width(ch) in ("W", "F"):
        return 1.0
    if ch == " ":
        return 0.28
    if ch.isupper() or ch.isdigit():
        return 0.60
    return 0.52


def wrapped_lines(text, box_pt, size_pt):
    """Greedy wrap; returns line count."""
    if not text:
        return 0
    lines = 0
    for para in text.split("\n"):
        if not para:
            lines += 1
            continue
        used, n = 0.0, 1
        for ch in para:
            w = char_em(ch) * size_pt
            if used + w > box_pt and used > 0:
                n += 1
                used = w
            else:
                used += w
        lines += n
    return lines


def main(path):
    prs = Presentation(path)
    SW = prs.slide_width / EMU_IN
    SH = prs.slide_height / EMU_IN
    problems = []
    for si, slide in enumerate(prs.slides, 1):
        for sh in slide.shapes:
            if sh.width is None or sh.height is None:
                continue
            x, y = sh.left / EMU_IN, sh.top / EMU_IN
            w, h = sh.width / EMU_IN, sh.height / EMU_IN
            # off-slide check (decorative ellipses are intentionally bled)
            if sh.shape_type is not None and sh.has_text_frame and sh.text_frame.text.strip():
                if x < -0.02 or y < -0.02 or x + w > SW + 0.02 or y + h > SH + 0.02:
                    problems.append((si, "OFF-SLIDE", sh.text_frame.text[:44],
                                     f"box {x:.2f},{y:.2f} {w:.2f}x{h:.2f}"))
            if not sh.has_text_frame:
                continue
            tf = sh.text_frame
            txt = tf.text
            if not txt.strip():
                continue
            ml = (tf.margin_left or 0) / EMU_IN
            mr = (tf.margin_right or 0) / EMU_IN
            mt = (tf.margin_top or 0) / EMU_IN
            mb = (tf.margin_bottom or 0) / EMU_IN
            box_w_pt = max((w - ml - mr) * 72.0, 6.0)
            box_h_pt = max((h - mt - mb) * 72.0, 6.0)
            sizes = [r.font.size.pt for p in tf.paragraphs for r in p.runs
                     if r.font.size is not None]
            size = max(sizes) if sizes else 18.0
            # spacing multiple, if pptxgenjs wrote one
            mult = 1.2
            need_lines = wrapped_lines(txt, box_w_pt, size)
            need_pt = need_lines * size * mult
            if need_pt > box_h_pt * 1.06:
                problems.append((si, "OVERFLOW",
                                 txt[:52].replace("\n", " / "),
                                 f"{need_lines} lines @{size:g}pt need {need_pt:.0f}pt, box {box_h_pt:.0f}pt "
                                 f"(w {box_w_pt:.0f}pt)"))
    if not problems:
        print(f"fit check: OK — {len(prs.slides)} slides, no overflow / off-slide text")
        return 0
    print(f"fit check: {len(problems)} issue(s) across {len(prs.slides)} slides")
    for si, kind, txt, detail in problems:
        print(f"  slide {si:>2} [{kind}] {txt!r}\n        {detail}")
    return 1


sys.exit(main(sys.argv[1]))
