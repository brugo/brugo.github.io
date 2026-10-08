"""Converts the Kombi renders made from the real .blend into web media.

The renders come from tools/render_kombi.py (turntable, exploded view,
wireframe and single parts). Sequences get a desktop and a phone size.

    python tools/build_kombi_renders.py <render_dir>
"""
import glob
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA = os.path.join(ROOT, "media")


def webp(src, dst, width, quality, keep_alpha=False):
    im = Image.open(src)
    im = im.convert("RGBA" if keep_alpha else "RGB")
    if keep_alpha:
        # Single parts: trim the empty transparent margin, keep a little air.
        x0, y0, x1, y1 = im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()
        pad = round(max(x1 - x0, y1 - y0) * 0.04)
        im = im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))
        width = min(width, im.width)
    h = round(im.height * width / im.width)
    im.resize((width, h), Image.LANCZOS).save(dst, "WEBP", quality=quality, method=6)
    return os.path.getsize(dst)


def sequence(render_dir, name, prefix):
    frames = sorted(glob.glob(os.path.join(render_dir, name, f"{prefix}-*.png")))
    for folder, width, quality in ((prefix, 1100, 74), (f"{prefix}-s", 640, 70)):
        out = os.path.join(MEDIA, "seq", folder)
        os.makedirs(out, exist_ok=True)
        total = sum(webp(f, os.path.join(out, os.path.basename(f)[:-4] + ".webp"), width, quality) for f in frames)
        print(f"{folder}: {len(frames)} frames, {total // 1024} KB")


def main(render_dir):
    sequence(render_dir, "turntable", "turn")
    sequence(render_dir, "explode", "explode")
    wire = os.path.join(render_dir, "wire", "wire-01_Exterior.png")
    print("wire", webp(wire, os.path.join(MEDIA, "kombi-wire.webp"), 1600, 80) // 1024, "KB")
    webp(wire, os.path.join(MEDIA, "kombi-wire-s.webp"), 800, 78)
    for part in glob.glob(os.path.join(render_dir, "parts", "part-*.png")):
        name = os.path.basename(part)[5:-4]
        size = webp(part, os.path.join(MEDIA, f"kombi-part-{name}.webp"), 900, 82, keep_alpha=True)
        print("part", name, size // 1024, "KB")


if __name__ == "__main__":
    main(sys.argv[1])
