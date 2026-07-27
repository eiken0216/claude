#!/usr/bin/env python3
"""Approximate slide renderer for visual QA (LibreOffice is unavailable here).

Draws every shape, picture and text frame of a .pptx at its real coordinates
using PIL, so layout problems — overlaps, images in the wrong box, text running
past its container — are visible. Not pixel-accurate typography; it is a layout
proof, not a final render.
"""
import io
import sys
import unicodedata

from PIL import Image, ImageDraw, ImageFont
from pptx import Presentation
from pptx.util import Emu

EMU_IN = 914400
SCALE = 110  # px per inch
FONT = "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf"


def font(pt):
    return ImageFont.truetype(FONT, max(6, int(pt * SCALE / 72)))


def rgb(c, default=(230, 230, 230)):
    try:
        return tuple(bytes.fromhex(str(c)))
    except Exception:
        return default


def shape_fill(sh):
    try:
        f = sh.fill
        if f.type is not None and f.type == 1:  # solid
            return "%02X%02X%02X" % f.fore_color.rgb[0:3] if False else str(f.fore_color.rgb)
    except Exception:
        pass
    return None


def run_color(p):
    for r in p.runs:
        try:
            if r.font.color and r.font.color.rgb:
                return str(r.font.color.rgb)
        except Exception:
            pass
    return None


def run_size(p, default=14):
    for r in p.runs:
        if r.font.size:
            return r.font.size.pt
    return default


def wrap(text, box_px, f):
    lines, cur = [], ""
    for ch in text:
        w = f.getlength(cur + ch)
        if w > box_px and cur:
            lines.append(cur)
            cur = ch
        else:
            cur += ch
    if cur:
        lines.append(cur)
    return lines


def render(path, indices, out_prefix):
    prs = Presentation(path)
    W = int(prs.slide_width / EMU_IN * SCALE)
    H = int(prs.slide_height / EMU_IN * SCALE)
    made = []
    for idx in indices:
        slide = prs.slides[idx - 1]
        # slide background
        bg = (255, 255, 255)
        try:
            if slide.background.fill.type == 1:
                bg = rgb(slide.background.fill.fore_color.rgb, (255, 255, 255))
        except Exception:
            pass
        img = Image.new("RGB", (W, H), bg)
        d = ImageDraw.Draw(img)
        for sh in slide.shapes:
            if sh.left is None:
                continue
            x = int(sh.left / EMU_IN * SCALE)
            y = int(sh.top / EMU_IN * SCALE)
            w = int(sh.width / EMU_IN * SCALE)
            h = int(sh.height / EMU_IN * SCALE)
            if sh.shape_type == 13:  # picture
                try:
                    pim = Image.open(io.BytesIO(sh.image.blob)).convert("RGB")
                    pim = pim.resize((max(w, 1), max(h, 1)))
                    img.paste(pim, (x, y))
                    d.rectangle([x, y, x + w, y + h], outline=(0, 170, 0), width=2)
                except Exception:
                    d.rectangle([x, y, x + w, y + h], fill=(200, 60, 60))
                continue
            fill = shape_fill(sh)
            if fill:
                col = rgb(fill)
                if sh.shape_type == 9:  # ellipse
                    d.ellipse([x, y, x + w, y + h], fill=col)
                else:
                    d.rectangle([x, y, x + w, y + h], fill=col)
            if not sh.has_text_frame or not sh.text_frame.text.strip():
                continue
            tf = sh.text_frame
            ml = int((tf.margin_left or 0) / EMU_IN * SCALE)
            mt = int((tf.margin_top or 0) / EMU_IN * SCALE)
            cy = y + mt
            for p in tf.paragraphs:
                txt = "".join(r.text for r in p.runs)
                if not txt:
                    continue
                pt = run_size(p)
                f = font(pt)
                col = rgb(run_color(p) or "333333", (51, 51, 51))
                for line in wrap(txt, max(w - ml * 2, 20), f):
                    d.text((x + ml, cy), line, font=f, fill=col)
                    cy += int(pt * SCALE / 72 * 1.22)
        out = f"{out_prefix}-{idx}.png"
        img.save(out)
        made.append(out)
    print("\n".join(made))


render(sys.argv[1], [int(i) for i in sys.argv[2].split(",")], sys.argv[3])
