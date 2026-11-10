"""
Assemble les animations Ludo d'UNE tenue (un corps) en feuilles compactes pour le jeu, avec les mêmes réglages que build-hero-anims.py.

Entrée  : un dossier avec <action>.webp (walk, mine, chop, herb : feuilles Ludo en « True Size », cellules de 760x700 alignées sur le cadre
          source où les pieds du héros sont à (330, 670)) et jobs.json : { "walk": {"cols":6,"rows":6,"frames":36,"duration":2.1}, ... }
Sortie  : public/assets/hero/<corps>/<tenue>/<action>.webp + métadonnées de src/data/heroAnims.json (clé "<corps>/<tenue>")
          Le champ pngH (hauteur du héros dans le cadre source, 384) est celui des autres tenues.

Usage   : python3 -I scripts/build-hero-outfit.py <dossier_entrée> <tenue> <corps>      ex. /tmp/foss fossoyeur m
"""
import json, os, sys
from PIL import Image

SRC, OUTFIT, BODY = sys.argv[1], sys.argv[2], sys.argv[3]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "public", "assets", "hero", BODY, OUTFIT)
META = os.path.join(ROOT, "src", "data", "heroAnims.json")
FEET, SCALE, PAD, PNG_H = (330, 670), 0.6, 6, 384
ACTIONS = ["walk", "mine", "chop", "herb"]
jobs = json.load(open(os.path.join(SRC, "jobs.json")))

def frames_of(path, m):
    im = Image.open(path).convert("RGBA"); cw, ch = im.width // m["cols"], im.height // m["rows"]
    return [im.crop(((i % m["cols"]) * cw, (i // m["cols"]) * ch, (i % m["cols"] + 1) * cw, (i // m["cols"] + 1) * ch)) for i in range(m["frames"])]

per = {a: frames_of(os.path.join(SRC, a + ".webp"), jobs[a]) for a in ACTIONS}
# boîte commune à toutes les actions (même point d'appui partout)
x0 = y0 = 10**9; x1 = y1 = 0
for fr in per.values():
    for f in fr:
        bb = f.getchannel("A").point(lambda a: 255 if a > 24 else 0).getbbox()
        if bb: x0, y0, x1, y1 = min(x0, bb[0]), min(y0, bb[1]), max(x1, bb[2]), max(y1, bb[3])
x0, y0, x1, y1 = max(0, x0 - PAD), max(0, y0 - PAD), min(760, x1 + PAD), min(700, y1 + PAD)
fw, fh = round((x1 - x0) * SCALE), round((y1 - y0) * SCALE)
meta = {"w": fw, "h": fh, "box": [x0, y0, x1, y1], "anchor": [round((FEET[0] - x0) * SCALE, 1), round((FEET[1] - y0) * SCALE, 1)],
        "scale": SCALE, "actions": {}, "pngH": PNG_H}
os.makedirs(OUT, exist_ok=True)
for act, fr in per.items():
    n = len(fr); cols = min(n, 6); rows = (n + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * fw, rows * fh), (0, 0, 0, 0))
    for i, f in enumerate(fr):
        g = f.crop((x0, y0, x1, y1)).convert("RGBa").resize((fw, fh), Image.LANCZOS).convert("RGBA")
        sheet.paste(g, ((i % cols) * fw, (i // cols) * fh))
    sheet.save(os.path.join(OUT, act + ".webp"), quality=88, method=6)
    meta["actions"][act] = {"frames": n, "cols": cols, "rows": rows, "duration": round(jobs[act]["duration"], 3)}
allm = json.load(open(META)); allm[f"{BODY}/{OUTFIT}"] = meta
json.dump(allm, open(META, "w"), indent=1, ensure_ascii=False)
print("ok", BODY, OUTFIT, (fw, fh), {a: len(f) for a, f in per.items()})
