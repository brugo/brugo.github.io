"""Builds the web-ready media for the portfolio from the original project folders.

Images become WebP in two widths (full and half), videos become short, silent,
looping H.264 MP4s with a WebP poster. Run from the repository root:

    python tools/build_media.py

Source folders live on the author's machine; the outputs in media/ are what
the site serves.
"""
import os
import subprocess
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "media")

DOCS = r"C:\Users\brugo\Documents"
TCG = os.path.join(DOCS, r"NETO test TCG\tcg\assets")
BISTRO = os.path.join(DOCS, r"Codex\Food Kids\output")
MIMO = os.path.join(DOCS, r"Codex\2026-09-28\eu-e\outputs")
PREVIEW = os.path.join(MIMO, "MimoGardenPreview")
CAPTURES = os.environ.get("PORTFOLIO_CAPTURES", "")
CURATED = r"C:\Users\brugo\Desktop\Portfolio de Games"
KOMBI = os.path.join(CURATED, "Cozy Kombi - modelo Blender")
COZY = os.path.join(CURATED, r"CozyValley - Kombi e floresta\Capturas do jogo")
COZY_SHOTS = r"C:\Users\brugo\Documents\Projetos Games Claude\CozyValley\Screenshots"

# (output name, source path, full width, also make a half-size copy)
IMAGES = [
    # CozyValley + Cozy Kombi (Blender renders of the real model, Unity checks, game captures)
    ("kombi-exterior", os.path.join(KOMBI, r"Renders do modelo\kombi-001--01_Exterior.png"), 1600, True),
    ("kombi-cutaway", os.path.join(KOMBI, r"Renders do modelo\kombi-002--02_Cutaway.png"), 1600, True),
    ("kombi-rear", os.path.join(KOMBI, r"Renders do modelo\kombi-003--03_RearPassenger.png"), 1600, True),
    ("kombi-front", os.path.join(KOMBI, r"Renders do modelo\kombi-004--04_FrontPassenger.png"), 1600, True),
    ("kombi-kitchen", os.path.join(KOMBI, r"Renders do modelo\kombi-005--05_KitchenCloseup.png"), 1600, True),
    ("kombi-unity-driver", os.path.join(KOMBI, r"Validacao em Unity\kombi-006--Unity_Seat_0.png"), 1440, True),
    ("kombi-unity-front", os.path.join(KOMBI, r"Validacao em Unity\kombi-007--Unity_Seat_1.png"), 1440, True),
    ("kombi-unity-rear", os.path.join(KOMBI, r"Validacao em Unity\kombi-009--Unity_Seat_3.png"), 1440, True),
    ("cozy-road", os.path.join(COZY, "cozy-all-168--p2_road_start.png"), 1600, True),
    ("cozy-pines", os.path.join(COZY, "cozy-all-025--biome2_pinhal.png"), 1600, True),
    ("cozy-autumn", os.path.join(COZY, "cozy-all-024--biome2_outono.png"), 1600, True),
    ("cozy-lake", os.path.join(COZY, "cozy-all-163--p1_lake2.png"), 1600, True),
    ("cozy-sunset", os.path.join(COZY, "cozy-all-058--day_sunset_west.png"), 1600, True),
    ("cozy-night", os.path.join(COZY, "cozy-all-156--night_kombi2.png"), 1600, True),
    ("cozy-drive", os.path.join(COZY, "cozy-all-064--drv_front.png"), 1600, True),
    ("cozy-driver", os.path.join(COZY, "cozy-all-073--final_driver.png"), 1600, True),
    # Right half only: the map panel on the left has an overlapping label and a dev FPS chip.
    ("cozy-radar", os.path.join(COZY_SHOTS, "radar", "radar_final.png"), 640, True, (640, 50, 1280, 660)),
    ("cozy-fire", os.path.join(COZY_SHOTS, "ui8_boiled.png"), 1280, True),
    ("cozy-cabin", os.path.join(COZY, "cozy-all-055--cabin_new.png"), 1600, True),
    ("cozy-grass", os.path.join(COZY, "cozy-all-091--grass_v2_close.png"), 1600, True),
    # A Era dos Heróis
    ("aeh-table", os.path.join(CAPTURES, "tcg-table-hd.png"), 1600, True),
    ("aeh-battle", os.path.join(TCG, "background-entrada.jpg"), 1600, True),
    ("aeh-throne", os.path.join(TCG, r"desfechos\trono-ao-longe.jpg"), 1600, True),
    ("aeh-card-guardiao", os.path.join(TCG, "guardiao-card.jpeg"), 520, False),
    ("aeh-card-oraculo", os.path.join(TCG, "oraculo-card.jpeg"), 520, False),
    ("aeh-card-batedor", os.path.join(TCG, "batedor-card.jpeg"), 520, False),
    ("aeh-card-mago", os.path.join(TCG, "mago-card.jpeg"), 520, False),
    ("aeh-card-warlock", os.path.join(TCG, "warlock-card.jpeg"), 520, False),
    ("aeh-card-cowboy", os.path.join(TCG, "cowboy-card.png"), 520, False),
    ("aeh-card-pallaxs", os.path.join(TCG, "pallaxs-card.jpeg"), 520, False),
    ("aeh-card-samurai", os.path.join(TCG, "samurai-card.jpeg"), 520, False),
    ("aeh-card-druida", os.path.join(TCG, "druida-card.png"), 520, False),
    ("aeh-card-assassino", os.path.join(TCG, "assassino-card.png"), 520, False),
    ("aeh-card-bardo", os.path.join(TCG, "bardo-card.jpeg"), 520, False),
    ("aeh-card-monge", os.path.join(TCG, "monge-card.jpeg"), 520, False),
    ("aeh-card-barbaro", os.path.join(TCG, "barbaro-card.jpg"), 520, False),
    # Bistrô dos Pequenos
    ("bis-garden", os.path.join(BISTRO, "v05-garden.png"), 1152, True),
    ("bis-cows", os.path.join(BISTRO, "stock-menu-084-buckets.png"), 1280, True),
    ("bis-bakery", os.path.join(BISTRO, "android-080-bakery.png"), 1280, True),
    ("bis-workshop", os.path.join(BISTRO, "economy-090-workshop-0.png"), 1280, True),
    ("bis-supplier", os.path.join(BISTRO, "economy-090-supplier-0.png"), 1280, True),
    ("bis-restaurant", os.path.join(BISTRO, "preview-v2.png"), 1152, True),
    ("bis-rewards", os.path.join(BISTRO, "rewards-082-three-rewards.png"), 1152, True),
    ("bis-kitchen", os.path.join(BISTRO, "kitchen-070-blending.png"), 1152, True),
    # Mimo Garden
    ("mimo-r1-steamer", os.path.join(PREVIEW, r"0.8.0\final-ritual\01-empty-steamer.png"), 1280, True),
    ("mimo-r2-pour", os.path.join(PREVIEW, r"0.8.0\final-ritual\02-bottle-pouring.png"), 1280, True),
    ("mimo-r3-mixed", os.path.join(PREVIEW, r"0.8.0\final-ritual\02-mixed-color.png"), 1280, True),
    ("mimo-r4-steam", os.path.join(PREVIEW, r"0.8.0\final-ritual\04-steaming.png"), 1280, True),
    ("mimo-r5-reveal", os.path.join(PREVIEW, r"0.8.0\final-ritual\05-surprise-reveal.png"), 1280, True),
    ("mimo-r6-soap", os.path.join(PREVIEW, r"0.8.0\final-ritual\06-covered-in-soap.png"), 1280, True),
    ("mimo-r7-rinsed", os.path.join(PREVIEW, r"0.8.0\final-ritual\07-rinsed-clean.png"), 1280, True),
    ("mimo-r8-play", os.path.join(PREVIEW, r"0.8.0\final-ritual\08-ready-to-play.png"), 1280, True),
    ("mimo-born", os.path.join(PREVIEW, r"0.8.0\final-surprise\04-surprise-born.png"), 1280, True),
    ("mimo-close-pearl", os.path.join(PREVIEW, r"0.7.0\final-material-mobile\finish-2-close.png"), 1280, True),
    ("mimo-close-squish", os.path.join(PREVIEW, r"0.7.0\final-material-mobile\finish-3-squished.png"), 1280, True),
    ("mimo-close-soft", os.path.join(PREVIEW, r"0.7.0\final-material-mobile\finish-4-close.png"), 1280, True),
    ("mimo-friends", os.path.join(PREVIEW, r"0.8.0\final-friend-management\04-chosen-replacement-complete.png"), 904, True),
    ("mimo-park", os.path.join(MIMO, r"MimoGardenAndroid\Validacao-0.5.5\playground\13-five-playing-with-shadows.png"), 1280, True),
    ("mimo-collections", os.path.join(PREVIEW, r"0.6.0\1280x800\01-catalog.png"), 1280, True),
    # Dumpling Squish
    ("dmp-portrait", os.path.join(MIMO, r"dumpling-lab\dumpling-portrait.png"), 1200, True),
    ("dmp-rabbit", os.path.join(MIMO, r"mimo-source\MimoRabbit.png"), 900, False),
]

# (output name, source, width, start seconds, duration seconds or None)
VIDEOS = [
    ("bis-farm", os.path.join(BISTRO, "fazenda-0.4.mp4"), 1152, 0, None),
    ("bis-interface", os.path.join(BISTRO, "interface-0.5.mp4"), 1152, 0, 14),
    ("mimo-play", os.path.join(MIMO, r"MimoGardenAndroid\Validacao-0.5.0\Brincadeiras.mp4"), 1280, 0, None),
    ("mimo-glitter", os.path.join(PREVIEW, r"0.4.1\Glitter-em-movimento.gif"), 640, 0, None),
    ("dmp-loop", os.path.join(MIMO, r"dumpling-lab\dumpling-loop.mp4"), 640, 0, None),
]


def save_webp(im, path, quality):
    im.save(path, "WEBP", quality=quality, method=6)
    return os.path.getsize(path)


def build_images(prefix=""):
    for entry in IMAGES:
        name, src, width, half = entry[:4]
        crop = entry[4] if len(entry) > 4 else None
        if prefix and not name.startswith(prefix):
            continue
        if not os.path.exists(src):
            print("MISSING", name, src)
            continue
        im = Image.open(src)
        if crop:
            im = im.crop(crop)
        im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
        if im.mode == "RGBA" and im.getextrema()[3][0] == 255:
            im = im.convert("RGB")
        w = min(width, im.width)
        full = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        size = save_webp(full, os.path.join(OUT, f"{name}.webp"), 80)
        line = f"{name}.webp {full.size} {size // 1024}KB"
        if half:
            hw = w // 2
            small = im.resize((hw, round(im.height * hw / im.width)), Image.LANCZOS)
            size = save_webp(small, os.path.join(OUT, f"{name}-s.webp"), 78)
            line += f" | -s {small.size} {size // 1024}KB"
        print(line)


def build_videos():
    for name, src, width, start, duration in VIDEOS:
        if not os.path.exists(src):
            print("MISSING", name, src)
            continue
        mp4 = os.path.join(OUT, f"{name}.mp4")
        cmd = ["ffmpeg", "-v", "error", "-y", "-ss", str(start), "-i", src]
        if duration:
            cmd += ["-t", str(duration)]
        cmd += ["-an", "-vf", f"scale={width}:-2:flags=lanczos,fps=30,format=yuv420p",
                "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-profile:v", "high",
                "-map_metadata", "-1", "-movflags", "+faststart", mp4]
        subprocess.run(cmd, check=True)
        poster = os.path.join(OUT, f"{name}-poster.webp")
        png = poster + ".png"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-frames:v", "1", png], check=True)
        save_webp(Image.open(png).convert("RGB"), poster, 72)
        os.remove(png)
        print(f"{name}.mp4 {os.path.getsize(mp4) // 1024}KB | poster {os.path.getsize(poster) // 1024}KB")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    if which in ("all", "images"):
        build_images(sys.argv[2] if len(sys.argv) > 2 else "")
    if which in ("all", "videos"):
        build_videos()
