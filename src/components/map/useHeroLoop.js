import { useEffect } from "react";
import { heroAnimMeta, heroSheetUrl, frameBackground } from "../../data/heroAnims.js";
import { stepMove, canStand } from "../../utils/mapPath.js";
import { VIEW_W, SPEED, TOUCH, HARVEST_MS, WALK_CYCLE, MOVE_KEYS } from "./mapConstants.js";

// Le héros sur la carte : clavier, déplacement le long du chemin cliqué, collisions, animation de marche
// ou de récolte, caméra qui suit, point sur la minicarte. Tout se fait dans une boucle d'animation
// qui écrit directement dans le DOM (pas de re-rendu React à chaque image).
export function useHeroLoop({ map, W, H, fight, syncPos, openPopup, openBuilding, startHarvest, setPopup, setFacing, setWalking, refs }) {
  const { viewRef, worldElRef, heroRef, heroAnimRef, dotRef, harvestAct, animKey, posRef, camRef, pathRef, keysRef, touchRef, pausedRef, facingRef, walkingRef, outfitRef, blockedRef, objsRef } = refs;

  // ---------- clavier ----------
  useEffect(() => {
    const norm = (k) => (k.length === 1 ? k.toLowerCase() : k);
    const typing = (ev) => ev.target && /^(INPUT|TEXTAREA)$/.test(ev.target.tagName);
    const down = (ev) => {
      if (typing(ev)) return;
      const k = norm(ev.key);
      if (!MOVE_KEYS[k]) return;
      ev.preventDefault();
      keysRef.current.add(k);
      setPopup(null);
    };
    const up = (ev) => keysRef.current.delete(norm(ev.key));
    const clear = () => keysRef.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", clear); };
  }, []);
  useEffect(() => { if (fight) { keysRef.current.clear(); pathRef.current = null; } }, [fight]);

  // ---------- boucle d'animation : déplacement, caméra ----------
  useEffect(() => {
    let raf, last = performance.now(), lastSync = 0, wasMoving = false;
    const frame = (t) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const view = viewRef.current, wel = worldElRef.current, hel = heroRef.current;
      if (!view || !wel || !hel) return;
      const tile = view.clientWidth / VIEW_W;
      const pos = posRef.current, bl = blockedRef.current;
      let vx = 0, vy = 0, moving = false;

      // si un objet réapparaît sur le héros, on le dégage vers la tuile libre la plus proche
      if (!canStand(map, pos.x, pos.y, bl)) {
        let best = null;
        for (let r = 1; r <= 4 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const c = { x: Math.floor(pos.x) + dx + 0.5, y: Math.floor(pos.y) + dy + 0.5 };
          if (canStand(map, c.x, c.y, bl) && (!best || Math.hypot(c.x - pos.x, c.y - pos.y) < Math.hypot(best.x - pos.x, best.y - pos.y))) best = c;
        }
        if (best) { pos.x = best.x; pos.y = best.y; }
      }

      if (!pausedRef.current) {
        const keys = keysRef.current;
        if (keys.size) {
          let dx = 0, dy = 0;
          for (const k of keys) { dx += MOVE_KEYS[k][0]; dy += MOVE_KEYS[k][1]; }
          const len = Math.hypot(dx, dy);
          if (len) {
            pathRef.current = null;
            vx = dx / len; vy = dy / len;
            const n = stepMove(map, pos, vx * SPEED * dt, vy * SPEED * dt, bl);
            moving = n.x !== pos.x || n.y !== pos.y;
            pos.x = n.x; pos.y = n.y;
          }
        } else if (pathRef.current) {
          const p = pathRef.current;
          let step = SPEED * dt;
          while (step > 0 && p.pts.length) {
            const tg = p.pts[0], d = Math.hypot(tg.x - pos.x, tg.y - pos.y);
            if (d <= step) { pos.x = tg.x; pos.y = tg.y; step -= d; p.pts.shift(); moving = true; }
            else {
              vx = (tg.x - pos.x) / d; vy = (tg.y - pos.y) / d;
              const nx = pos.x + vx * step, ny = pos.y + vy * step;
              if (canStand(map, nx, ny, bl)) { pos.x = nx; pos.y = ny; moving = true; } else { p.pts.length = 0; p.then = null; }
              step = 0;
            }
          }
          if (!p.pts.length) { pathRef.current = null; p.then?.(); }
        }

        // toucher un objet en marchant au clavier
        if (moving && keys.size) {
          const { groups: gs, nodes: ns, buildings: bs } = objsRef.current;
          for (const o of [...gs, ...ns, ...bs]) {
            if (touchRef.current === o.id) continue;
            if (Math.hypot(o.x + 0.5 - pos.x, o.y + 0.5 - pos.y) < TOUCH) {
              touchRef.current = o.id;
              keys.clear();
              if (o.kind) openBuilding(o); else if (o.encounter) openPopup(o); else startHarvest(o);
              break;
            }
          }
        }
        if (touchRef.current) {
          const { groups: gs, nodes: ns, buildings: bs } = objsRef.current;
          const o = [...gs, ...ns, ...bs].find((e) => e.id === touchRef.current);
          if (!o || Math.hypot(o.x + 0.5 - pos.x, o.y + 0.5 - pos.y) > 1.7) touchRef.current = null;
        }
      }

      // orientation / animation de marche
      if (Math.abs(vx) > 0.2 && Math.sign(vx) !== facingRef.current) { facingRef.current = Math.sign(vx); setFacing(facingRef.current); }
      if (moving !== walkingRef.current) { walkingRef.current = moving; setWalking(moving); }

      // position du héros (point d'appui = les pieds) et image d'animation
      hel.style.transform = `translate3d(${pos.x * tile}px, ${(pos.y + 0.4) * tile}px, 0)`;
      const z = String(Math.floor((pos.y + 0.4) * 10) + 5);
      if (hel.style.zIndex !== z) hel.style.zIndex = z;
      const anim = heroAnimRef.current;
      if (anim) {
        const of = outfitRef.current, meta = heroAnimMeta(of);
        let act = "walk", fi = 0;                         // à l'arrêt : première image de la marche
        const h = harvestAct.current;
        if (h) { act = h.action; fi = Math.min(meta.actions[act].frames - 1, Math.floor(((t - h.t0) / (h.ms || HARVEST_MS)) * meta.actions[act].frames)); }
        else if (moving) { const n = meta.actions.walk.frames; fi = Math.floor((((t / 1000) / WALK_CYCLE) % 1) * n); }
        const key = `${of}/${act}/${fi}`;
        if (key !== animKey.current) {
          const [kOf, kAct] = animKey.current.split("/");
          if (kOf !== of || kAct !== act) {
            const a = meta.actions[act];
            anim.style.backgroundImage = `url(${heroSheetUrl(of, act)})`;
            anim.style.backgroundSize = `${a.cols * 100}% ${a.rows * 100}%`;
          }
          anim.style.backgroundPosition = frameBackground(meta.actions[act], fi);
          animKey.current = key;
        }
      }

      // caméra : suit le héros avec un peu d'inertie, bornée aux bords de la carte
      const hw = VIEW_W / 2, hh = view.clientHeight / tile / 2;
      const clampC = (v, half, size) => (size <= half * 2 ? size / 2 : Math.max(half, Math.min(size - half, v)));
      const tx = clampC(pos.x, hw, W), ty = clampC(pos.y, hh, H);
      if (!camRef.current) camRef.current = { x: tx, y: ty };
      const c = camRef.current, k = Math.min(1, dt * 7);
      c.x += (tx - c.x) * k; c.y += (ty - c.y) * k;
      wel.style.transform = `translate3d(${-(c.x - hw) * tile}px, ${-(c.y - hh) * tile}px, 0)`;
      if (dotRef.current) { dotRef.current.style.left = `${(pos.x / W) * 100}%`; dotRef.current.style.top = `${(pos.y / H) * 100}%`; }

      // on enregistre la position dans l'état du monde (pour le retour d'un combat ou d'un autre onglet)
      if (moving && t - lastSync > 500) { lastSync = t; syncPos(); }
      if (wasMoving && !moving) syncPos();
      wasMoving = moving;
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [map, W, H, syncPos, openPopup, openBuilding, startHarvest, fight]);
}
