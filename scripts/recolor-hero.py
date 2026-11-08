"""
Recolore GRATUITEMENT les feuilles d'animation du héros pour fabriquer la tenue d'un set sans payer de génération Ludo.

  python3 -I scripts/recolor-hero.py <tenue>          ex. fossoyeur
Source  : public/assets/hero/<corps>/<tenue de base>/<action>.webp   (veteran pour les guerriers, traqueur pour les assassins, apprenti pour les mages)
Sortie  : public/assets/hero/<corps>/<tenue>/<action>.webp  + métadonnées copiées dans src/data/heroAnims.json
Chaque tenue décrit des règles de teinte : (zone de teinte, saturation) -> nouvelle teinte, saturation et luminosité.
"""
import json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
HERO = os.path.join(ROOT, "public", "assets", "hero")
META = os.path.join(ROOT, "src", "data", "heroAnims.json")
ACTIONS = ["walk", "mine", "chop", "herb"]

def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

# Règles : chaque règle a un masque doux (poids 0..1) et une transformation.
#   steel  = métal gris (peu saturé, ni noir ni blanc) ;  cloth = tissu coloré (teinte dans [h0,h1], saturation minimale)
OUTFITS = {
    "fossoyeur": {
        "base": "veteran",
        "rules": [
            {"kind": "steel", "val_mul": 0.74},                                                    # armure : métal plus sombre
            {"kind": "cloth", "hue": (130, 210), "sat_min": 0.10, "to_hue": 44, "to_sat": 0.20, "val_add": 0.10, "val_mul": 1.10},   # tunique verdâtre -> os
        ],
    },
}

def rgb_to_hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1); d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rc = np.where(m, (mx - r) / np.where(m, d, 1), 0); gc = np.where(m, (mx - g) / np.where(m, d, 1), 0); bc = np.where(m, (mx - b) / np.where(m, d, 1), 0)
    h = np.where(mx == r, bc - gc, np.where(mx == g, 2.0 + rc - bc, 4.0 + gc - rc))
    h = (h / 6.0) % 1.0
    h = np.where(m, h, 0)
    s = np.where(mx > 1e-6, d / np.where(mx > 1e-6, mx, 1), 0)
    return h * 360.0, s, mx

def hsv_to_rgb(h, s, v):
    h = (h % 360.0) / 60.0; i = np.floor(h).astype(int) % 6; f = h - np.floor(h)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    r = np.choose(i, [v, q, p, p, t, v]); g = np.choose(i, [t, v, v, q, p, p]); b = np.choose(i, [p, p, t, v, v, q])
    return np.stack([r, g, b], -1)

def recolor(img, rules):
    a = np.asarray(img.convert("RGBA")).astype(np.float64) / 255.0
    rgb, alpha = a[..., :3], a[..., 3]
    h, s, v = rgb_to_hsv(rgb)
    H, S, V = h.copy(), s.copy(), v.copy()
    for ru in rules:
        if ru["kind"] == "steel":
            w = (1 - smooth(s, 0.10, 0.22)) * smooth(v, 0.18, 0.34) * (1 - smooth(v, 0.92, 0.99))
            V = V * (1 - w) + (V * ru["val_mul"]) * w
            S = S * (1 - 0.6 * w)                                   # le métal perd son reflet verdâtre
        elif ru["kind"] == "cloth":
            lo, hi = ru["hue"]
            w = smooth(h, lo - 8, lo + 8) * (1 - smooth(h, hi - 8, hi + 8)) * smooth(s, ru["sat_min"], ru["sat_min"] + 0.06)
            H = H * (1 - w) + ru["to_hue"] * w
            S = S * (1 - w) + ru["to_sat"] * w
            V = V * (1 - w) + np.clip(V * ru["val_mul"] + ru["val_add"], 0, 1) * w
    out = hsv_to_rgb(H, np.clip(S, 0, 1), np.clip(V, 0, 1))
    res = np.dstack([out, alpha])
    return Image.fromarray((np.clip(res, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")

if __name__ == "__main__":
    name = sys.argv[1]; cfg = OUTFITS[name]
    meta = json.load(open(META))
    for body in ("m", "f"):
        src = os.path.join(HERO, body, cfg["base"])
        if not os.path.isdir(src): continue
        dst = os.path.join(HERO, body, name); os.makedirs(dst, exist_ok=True)
        for act in ACTIONS:
            im = Image.open(os.path.join(src, act + ".webp"))
            recolor(im, cfg["rules"]).save(os.path.join(dst, act + ".webp"), "WEBP", quality=88, method=6)
        if f"{body}/{cfg['base']}" in meta: meta[f"{body}/{name}"] = meta[f"{body}/{cfg['base']}"]
    json.dump(meta, open(META, "w"), indent=1, ensure_ascii=False)
    print("ok", name)
