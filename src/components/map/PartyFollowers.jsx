import { useEffect, useRef } from "react";
import { heroAnimMeta, heroSheetUrl, heroFrameLayout, frameBackground } from "../../data/heroAnims.js";
import { canStand } from "../../utils/mapPath.js";
import { WALK_CYCLE, cq } from "./mapConstants.js";

const GAP = 1.05;          // distance, en tuiles de chemin, entre deux compagnons derrière le héros
const CHASE = 5.6;         // vitesse maxi pour rattraper (un peu plus que le héros)
const MIN_STEP = 0.13;     // le héros doit avoir bougé de cela pour qu'un point soit ajouté à sa trace
const JUMP = 2.5;          // un saut plus grand (changement de carte, retour de combat) : la trace est remise à zéro

// Les membres du groupe sur la carte : ils suivent le héros à la file, en marchant sur son propre chemin (donc jamais coincés
// dans un décor), avec la même animation de marche, leur pseudo et leur niveau. Chacun garde l'apparence du set qu'il porte.
export default function PartyFollowers({ members, posRef, map }) {
  const els = useRef({});            // id -> { ent, flip, anim }
  const keys = useRef({});           // id -> image de marche affichée
  const st = useRef({ trail: [], fol: {} });

  useEffect(() => {
    const s = st.current;
    for (const id of Object.keys(s.fol)) if (!members.some((m) => m.id === id)) delete s.fol[id];
    for (const id of Object.keys(keys.current)) if (!members.some((m) => m.id === id)) delete keys.current[id];
    for (const m of members) new Image().src = heroSheetUrl(m.look, "walk");
  }, [members]);

  useEffect(() => {
    let raf, last = performance.now();
    // trace de départ : une file derrière le héros, dans la direction où il y a le plus de place (les compagnons s'y rangent d'eux-mêmes)
    const seed = (h) => {
      const need = GAP * (members.length + 1) + 0.6;
      let best = [];
      for (const [ux, uy] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) {
        const pts = [];
        for (let d = 0.3; d <= need; d += 0.3) { const x = h.x + ux * d, y = h.y + uy * d; if (!canStand(map, x, y)) break; pts.push({ x, y }); }
        if (pts.length > best.length) best = pts;
        if (best.length * 0.3 >= need - 0.3) break;
      }
      return [{ x: h.x, y: h.y }, ...best];
    };
    const frame = (t) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const s = st.current, h = posRef.current;
      if (!h) return;
      // la trace du héros : ses derniers points, du plus récent au plus ancien
      const head = s.trail[0];
      if (!head || Math.hypot(h.x - head.x, h.y - head.y) > JUMP) {
        s.trail = seed(h);
        s.fol = {};                                  // chacun est reposé sur la trace, sans marcher depuis l'ancien endroit
      } else if (Math.hypot(h.x - head.x, h.y - head.y) > MIN_STEP) {
        s.trail.unshift({ x: h.x, y: h.y });
        let len = 0, cut = s.trail.length;
        for (let i = 1; i < s.trail.length; i++) { len += Math.hypot(s.trail[i].x - s.trail[i - 1].x, s.trail[i].y - s.trail[i - 1].y); if (len > GAP * (members.length + 1) + 2) { cut = i + 1; break; } }
        s.trail.length = cut;
      }
      members.forEach((m, i) => {
        const e = els.current[m.id]; if (!e) return;
        // le point de la trace situé à (i + 1) intervalles derrière le héros
        let want = GAP * (i + 1), px = h.x, py = h.y, tx = s.trail[s.trail.length - 1].x, ty = s.trail[s.trail.length - 1].y;
        for (let j = 0; j < s.trail.length; j++) {
          const p = s.trail[j], d = Math.hypot(p.x - px, p.y - py);
          if (d >= want) { const k = want / d; tx = px + (p.x - px) * k; ty = py + (p.y - py) * k; break; }
          want -= d; px = p.x; py = p.y;
        }
        const f = s.fol[m.id] || (s.fol[m.id] = { x: tx, y: ty, facing: 1, moving: false });
        const dx = tx - f.x, dy = ty - f.y, d = Math.hypot(dx, dy);
        let moved = false;
        if (d > 9) { f.x = tx; f.y = ty; }
        else if (d > 0.04) { const step = Math.min(d, Math.min(CHASE, d * 5 + 0.6) * dt); f.x += (dx / d) * step; f.y += (dy / d) * step; moved = step > 0.004; if (Math.abs(dx) > 0.02) f.facing = Math.sign(dx); }
        else if (Math.abs(h.x - f.x) > 0.4) f.facing = Math.sign(h.x - f.x);          // à l'arrêt, il regarde vers le héros
        if (moved !== f.moving) { f.moving = moved; e.anim.classList.toggle("idle", !moved); }

        e.ent.style.transform = `translate3d(calc(var(--tile) * ${f.x.toFixed(3)}), calc(var(--tile) * ${(f.y + 0.4).toFixed(3)}), 0)`;
        const z = String(Math.floor((f.y + 0.4) * 10) + 5);
        if (e.ent.style.zIndex !== z) e.ent.style.zIndex = z;
        if (e.facing !== f.facing) { e.facing = f.facing; e.flip.style.transform = `scaleX(${f.facing})`; }
        const meta = heroAnimMeta(m.look);
        const fi = moved ? Math.floor((((t / 1000 + i * 0.31) / WALK_CYCLE) % 1) * meta.actions.walk.frames) : 0;
        if (keys.current[m.id] !== fi) {
          if (keys.current[m.id] === undefined) {
            const w = meta.actions.walk;
            e.anim.style.backgroundImage = `url(${heroSheetUrl(m.look, "walk")})`;
            e.anim.style.backgroundSize = `${w.cols * 100}% ${w.rows * 100}%`;
          }
          e.anim.style.backgroundPosition = frameBackground(meta.actions.walk, fi);
          keys.current[m.id] = fi;
        }
      });
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [members, posRef, map]);

  return (
    <>
      {members.map((m) => {
        const lay = heroFrameLayout(m.look);
        return (
          <div key={m.id} className="mp-ent mp-mate" data-map-mate={m.id}
            ref={(el) => { if (el) { els.current[m.id] = { ent: el, flip: el.querySelector(".mp-flip"), anim: el.querySelector(".mp-hero-anim") }; keys.current[m.id] = undefined; } else { delete els.current[m.id]; delete keys.current[m.id]; } }}>
            <span className="mp-shadow" />
            <div className="mp-flip">
              <div className="mp-hero-anim idle" role="img" aria-label={m.name}
                style={{ width: cq(lay.w), height: cq(lay.h), left: cq(-lay.ax), top: cq(-lay.ay) }} />
            </div>
            <span className="mp-nick mate">{m.name}<i>{m.level}</i></span>
          </div>
        );
      })}
    </>
  );
}
