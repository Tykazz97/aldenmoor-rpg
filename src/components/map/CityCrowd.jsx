import { useEffect, useRef, useState } from "react";
import { heroAnimMeta, heroSheetUrl, heroFrameLayout, frameBackground } from "../../data/heroAnims.js";
import { stepCityLife } from "../../sim/cityLife.js";

const cq = (n) => `calc(var(--cq) * ${n})`;
const WALK_CYCLE = 0.72;
const BUBBLE_MS = 5500;

// Les joueurs simulés présents en ville. Même rendu que le héros : feuille d'animation de marche,
// ombre, pseudo au-dessus de la tête, bulle quand ils parlent. La simulation avance ici, à chaque image.
export default function CityCrowd({ life, paused, onEvents, step = stepCityLife }) {
  const [ids, setIds] = useState(() => life.agents.map((a) => a.id));
  const [bubbles, setBubbles] = useState({});          // id -> { text, until }
  const els = useRef({});                               // id -> { ent, flip, anim }
  const keys = useRef({});                              // id -> "<look>/<action>/<frame>"
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const idsRef = useRef(ids.join());

  // précharge les feuilles de marche des looks présents
  useEffect(() => { for (const l of new Set(life.population.map((b) => b.look))) { const im = new Image(); im.src = heroSheetUrl(l, "walk"); } }, [life]);

  useEffect(() => {
    let raf, last = performance.now();
    const frame = (t) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      // la simulation continue même pendant un combat ou une fenêtre ouverte : la ville vit sans nous
      const events = step(life, dt);
      if (events.length) {
        onEvents?.(events);
        const says = events.filter((e) => e.type === "say");
        if (says.length) setBubbles((b) => { const n = { ...b }; const now = Date.now(); for (const e of says) n[e.id] = { text: e.text, until: now + BUBBLE_MS }; return n; });
      }
      const sig = life.agents.map((a) => a.id).join();
      if (sig !== idsRef.current) { idsRef.current = sig; setIds(life.agents.map((a) => a.id)); }

      for (const a of life.agents) {
        const e = els.current[a.id];
        if (!e) continue;
        const hidden = a.state === "inside";
        if (e.hidden !== hidden) { e.hidden = hidden; e.ent.style.display = hidden ? "none" : ""; }
        if (hidden) continue;
        e.ent.style.transform = `translate3d(calc(var(--tile) * ${a.x.toFixed(3)}), calc(var(--tile) * ${(a.y + 0.4).toFixed(3)}), 0)`;
        const z = String(Math.floor((a.y + 0.4) * 10) + 5);
        if (e.ent.style.zIndex !== z) e.ent.style.zIndex = z;
        if (e.facing !== a.facing) { e.facing = a.facing; e.flip.style.transform = `scaleX(${a.facing})`; }
        const walking = a.state === "walk" || a.state === "leaving";
        if (e.walking !== walking) { e.walking = walking; e.anim.classList.toggle("idle", !walking); }
        const meta = heroAnimMeta(a.bot.look);
        const fi = walking ? Math.floor((((t / 1000 + a.bot.speed * 3.7) / WALK_CYCLE) % 1) * meta.actions.walk.frames) : 0;
        if (keys.current[a.id] !== fi) {
          if (keys.current[a.id] === undefined) {
            const w = meta.actions.walk;
            e.anim.style.backgroundImage = `url(${heroSheetUrl(a.bot.look, "walk")})`;
            e.anim.style.backgroundSize = `${w.cols * 100}% ${w.rows * 100}%`;
          }
          e.anim.style.backgroundPosition = frameBackground(meta.actions.walk, fi);
          keys.current[a.id] = fi;
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [life, onEvents, step]);

  // efface les bulles périmées
  useEffect(() => {
    const id = setInterval(() => setBubbles((b) => {
      const now = Date.now(); let changed = false; const n = {};
      for (const [k, v] of Object.entries(b)) { if (v.until > now) n[k] = v; else changed = true; }
      return changed ? n : b;
    }), 800);
    return () => clearInterval(id);
  }, []);

  const byId = new Map(life.agents.map((a) => [a.id, a]));
  return (
    <>
      {ids.map((id) => {
        const a = byId.get(id);
        if (!a) return null;
        const lay = heroFrameLayout(a.bot.look);
        const bub = bubbles[id];
        return (
          <div key={id} className="mp-ent mp-sim" style={{ display: "none" }}
            ref={(el) => { if (el) { if (!els.current[id]) els.current[id] = { ent: el, flip: el.querySelector(".mp-flip"), anim: el.querySelector(".mp-hero-anim"), hidden: true }; } else { delete els.current[id]; delete keys.current[id]; } }}>
            <span className="mp-shadow" />
            <div className="mp-flip">
              <div className="mp-hero-anim idle" role="img" aria-label={a.bot.name}
                style={{ width: cq(lay.w), height: cq(lay.h), left: cq(-lay.ax), top: cq(-lay.ay) }} />
            </div>
            <span className="mp-nick">{a.bot.name}<i>{a.bot.level}</i></span>
            {bub && <span className="mp-bubble">{bub.text}</span>}
          </div>
        );
      })}
    </>
  );
}
