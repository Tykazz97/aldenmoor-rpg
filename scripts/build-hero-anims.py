"""
Assemble les feuilles d'animation Ludo du héros en feuilles compactes pour le jeu.

Entrée  : un dossier avec <tenue>_<action>.webp (feuille Ludo, cellules alignées sur le
          cadre source 760x700, pied du héros à (330, 670)) et jobs.json (nb de frames).
Sortie  : public/assets/hero/<corps>/<tenue>/<action>.webp + métadonnées fusionnées dans src/data/heroAnims.json
          (clé "<corps>/<tenue>" ; pngH d'un autre corps est repris du corps masculin)

Usage   : python3 -I scripts/build-hero-anims.py <dossier_entrée> [corps = m]
"""
import json, os, sys
from PIL import Image

SRC = sys.argv[1]
BODY = sys.argv[2] if len(sys.argv) > 2 else "m"
ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "public", "assets", "hero", BODY)
META = os.path.join(ROOT, "src", "data", "heroAnims.json")
FEET = (330, 670)          # point d'appui (pieds) dans le cadre source
SCALE = 0.6                # réduction des frames
OUTFITS = ["base", "veteran", "apprenti", "traqueur"]
ACTIONS = ["walk", "mine", "chop", "herb"]

jobs = json.load(open(os.path.join(SRC, "jobs.json")))   # { "base_walk": {"cols":4,"rows":4,"frames":16,"duration":2.2}, ... }

def frames_of(path, meta):
    im = Image.open(path).convert("RGBA")
    cw, ch = im.width // meta["cols"], im.height // meta["rows"]
    out = []
    for i in range(meta["frames"]):
        c, r = i % meta["cols"], i // meta["cols"]
        out.append(im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)))
    return out

meta_all = json.load(open(META)) if os.path.exists(META) else {}
meta_out = {}
for outfit in OUTFITS:
    allf, per = [], {}
    for act in ACTIONS:
        k = f"{outfit}_{act}"
        p = os.path.join(SRC, k + ".webp")
        if not os.path.exists(p):
            continue
        fr = frames_of(p, jobs[k]); per[act] = fr; allf += fr
    if not per:
        continue
    # boîte commune à toutes les actions de la tenue (même point d'appui partout)
    x0 = y0 = 10**9; x1 = y1 = 0
    for f in allf:
        bb = f.getchannel("A").getbbox()
        if bb: x0, y0, x1, y1 = min(x0, bb[0]), min(y0, bb[1]), max(x1, bb[2]), max(y1, bb[3])
    pad = 6
    x0, y0, x1, y1 = max(0, x0 - pad), max(0, y0 - pad), x1 + pad, y1 + pad
    fw, fh = round((x1 - x0) * SCALE), round((y1 - y0) * SCALE)
    meta_out[outfit] = {"w": fw, "h": fh, "box": [x0, y0, x1, y1],
                        "anchor": [round((FEET[0] - x0) * SCALE, 1), round((FEET[1] - y0) * SCALE, 1)], "scale": SCALE, "actions": {}}
    os.makedirs(os.path.join(OUT, outfit), exist_ok=True)
    for act, fr in per.items():
        n = len(fr); cols = min(n, 6); rows = (n + cols - 1) // cols
        sheet = Image.new("RGBA", (cols * fw, rows * fh), (0, 0, 0, 0))
        for i, f in enumerate(fr):
            g = f.crop((x0, y0, x1, y1)).convert("RGBa").resize((fw, fh), Image.LANCZOS).convert("RGBA")
            sheet.paste(g, ((i % cols) * fw, (i // cols) * fh))
        sheet.save(os.path.join(OUT, outfit, act + ".webp"), quality=88, method=6)
        meta_out[outfit]["actions"][act] = {"frames": n, "cols": cols, "rows": rows, "duration": round(jobs[f"{outfit}_{act}"]["duration"], 3)}
    print(outfit, (fw, fh), {a: len(f) for a, f in per.items()})

for outfit, m in meta_out.items():
    ref = meta_all.get(f"m/{outfit}", {})
    m["pngH"] = meta_all.get(f"{BODY}/{outfit}", {}).get("pngH") or ref.get("pngH")
    meta_all[f"{BODY}/{outfit}"] = m
json.dump(meta_all, open(META, "w"), indent=1)
print("ok")
