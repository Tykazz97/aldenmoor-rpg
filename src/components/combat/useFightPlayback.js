import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { sfx } from "./sfx.js";
import { HERO_X, HERO_B, HERO_H, ANIMS, ELEMENT_COLOR, RANGED, STATUS_LABEL, ALLY_POS, ALLY_H, isHeroId, enemySlots, groupEvents, sleepMs } from "./stage.js";

let fxCounter = 0;

// Met en scène les évènements du moteur de combat : animations des sprites, dégâts flottants,
// effets, bandeaux, barres de vie, frise d'initiative. Ne décide d'aucune règle.
// `onIdle` est appelé quand tout est joué et que le combat continue (le joueur peut agir).
export function useFightPlayback({ initial, csRef, speed, onIdle }) {
  const busyRef = useRef(true);
  const aliveRef = useRef(true);
  const speedRef = useRef(1);
  const spriteRefs = useRef({});
  const shakeRef = useRef(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  const [busy, setBusy] = useState(true);
  const [hpView, setHpView] = useState(() => Object.fromEntries([initial.player, ...(initial.allies || []), ...initial.enemies].map((a) => [a.id, a.hp])));
  const [ghost, setGhost] = useState(() => Object.fromEntries([initial.player, ...(initial.allies || []), ...initial.enemies].map((a) => [a.id, a.hp])));
  const [dead, setDead] = useState({});
  const [enraged, setEnraged] = useState({});
  const [appeared, setAppeared] = useState({});   // renforts déjà montrés à l'écran
  const [floats, setFloats] = useState([]);
  const [fxs, setFxs] = useState([]);
  const [banner, setBanner] = useState(null);
  const [ended, setEnded] = useState(null);
  const [timeline, setTimeline] = useState({ n: 0, order: [] });
  const [activeId, setActiveId] = useState(null);

  const slots = useMemo(() => enemySlots(initial.enemies), [initial]);
  const anchor = (id) => {
    if (id === "player") return { x: HERO_X, y: HERO_B + HERO_H * 0.5 };
    if (id.startsWith("ally")) { const a = ALLY_POS[Number(id.slice(4))]; return { x: a.x, y: a.b + ALLY_H * 0.5 }; }
    const s = slots[Number(id.slice(1))];
    return { x: s.x, y: s.b + s.h * 0.5 };
  };

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; }; }, []);

  const sleep = useCallback((ms) => sleepMs(ms / speedRef.current), []);

  // --- petites aides visuelles ---
  const pulse = useCallback((id, name, vars) => {
    const el = spriteRefs.current[id]; const a = ANIMS[name];
    if (!el || !a || !el.animate) return;
    if (vars) Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v));
    el.animate(a.frames, { duration: a.ms / speedRef.current, easing: a.easing });
  }, []);
  const shake = useCallback((strong) => {
    const el = shakeRef.current; if (!el || !el.animate) return;
    const m = strong ? 9 : 5;
    el.animate([{ transform: "translate(0,0)" }, { transform: `translate(${-m}px,${m / 2}px)` }, { transform: `translate(${m}px,${-m / 2}px)` }, { transform: `translate(${-m / 2}px,0)` }, { transform: "translate(0,0)" }], { duration: 320, easing: "ease-out" });
  }, []);
  const addFloat = useCallback((id, text, cls, dy = 0) => {
    const a = anchor(id); const key = ++fxCounter;
    setFloats((f) => [...f, { key, x: a.x + (Math.random() * 3 - 1.5), y: a.y + 40 + dy, text, cls }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.key !== key)), 1150);
  }, []); // eslint-disable-line
  const addFx = useCallback((id, kind, opts = {}) => {
    const a = anchor(id); const key = ++fxCounter;
    setFxs((f) => [...f, { key, x: a.x, y: a.y, kind, ...opts }]);
    setTimeout(() => setFxs((f) => f.filter((x) => x.key !== key)), 1100);
  }, []); // eslint-disable-line
  const showBanner = useCallback((text, cls = "", ms = 1200) => {
    const key = ++fxCounter; setBanner({ key, text, cls });
    setTimeout(() => setBanner((b) => (b && b.key === key ? null : b)), ms);
  }, []);

  // --- lecture d'une action (liste d'évènements du moteur) ---
  const playGroup = useCallback(async (g) => {
    const cast = g.find((e) => e.type === "cast");
    const isHero = !!cast && isHeroId(cast.from);

    if (cast) {
      if (isHero) {
        const ranged = RANGED.has(cast.spellId) || cast.spellType === "mag";
        if (cast.spellType === "buff") { pulse(cast.from, "cast"); sfx.buff(); }
        else if (ranged) { pulse(cast.from, "cast"); cast.spellType === "mag" ? sfx.magic() : sfx.swing(); }
        else { pulse(cast.from, "attackR"); setTimeout(sfx.swing, 120 / speedRef.current); }
        addFloat(cast.from, cast.label, "label", 70);
        await sleep(cast.spellType === "buff" ? 400 : ranged ? 300 : 250);
        if (ranged && cast.spellType !== "buff") {
          const from = anchor(cast.from);
          cast.targets.forEach((tid) => {
            const to = anchor(tid); const key = ++fxCounter;
            const col = ELEMENT_COLOR[cast.element] || (cast.spellType === "mag" ? ELEMENT_COLOR.arcane : null);
            setFxs((f) => [...f, { key, kind: "proj", x0: from.x + 6, y0: from.y, x1: to.x, y1: to.y, col, arrow: cast.spellType !== "mag" }]);
            setTimeout(() => setFxs((f) => f.filter((x) => x.key !== key)), 400);
          });
          await sleep(250);
        }
      } else if (cast.spellType === "buff") {
        pulse(cast.from, "cast"); sfx.buff();
        addFloat(cast.from, cast.label, "label", 90);
        await sleep(400);
      } else {
        pulse(cast.from, "attackL");
        addFloat(cast.from, cast.label, "label", 90);
        sfx.swing();
        await sleep(300);
      }
    }

    for (const e of g) {
      switch (e.type) {
        case "hit": {
          setHpView((v) => ({ ...v, [e.to]: e.hpAfter }));
          setTimeout(() => setGhost((v) => ({ ...v, [e.to]: e.hpAfter })), 450);
          pulse(e.to, "hurt", { "--kb": isHeroId(e.to) ? "-14px" : "14px" });
          const kind = e.element === "feu" ? "fire" : e.element === "poison" ? "poison" : e.element === "givre" ? "frost" : e.dmgType === "mag" ? "arcane" : "slash";
          addFx(e.to, kind, { flip: isHeroId(e.to) });
          addFx(e.to, "spark", { crit: e.crit });
          addFloat(e.to, e.crit ? `${e.amount} !` : `${e.amount}`, e.crit ? "crit" : isHeroId(e.to) ? "dmgP" : "dmg");
          if (e.crit) shake(true); else if (e.to === "player") shake(false);
          sfx.hit(e.crit);
          if (cast?.aoe) await sleep(120);
          break;
        }
        case "miss":
          addFloat(e.to, "Esquive", "miss");
          pulse(e.to, "dodge", { "--dg": isHeroId(e.to) ? "-40px" : "40px" });
          sfx.miss();
          break;
        case "death":
          setDead((d) => ({ ...d, [e.id]: true }));
          sfx.death();
          await sleep(200);
          break;
        case "dot":
          setHpView((v) => ({ ...v, [e.id]: e.hpAfter }));
          setTimeout(() => setGhost((v) => ({ ...v, [e.id]: e.hpAfter })), 450);
          pulse(e.id, "hurt");
          addFx(e.id, e.element === "feu" ? "fire" : "poison");
          addFloat(e.id, `${e.amount}`, e.element || "dmg");
          sfx.hit(false);
          await sleep(450);
          break;
        case "heal":
          setHpView((v) => ({ ...v, [e.id]: e.hpAfter }));
          setGhost((v) => ({ ...v, [e.id]: e.hpAfter }));
          addFx(e.id, "heal");
          addFloat(e.id, `+${e.amount}`, "heal");
          sfx.heal();
          break;
        case "effect": {
          const label = e.kind === "dot" ? STATUS_LABEL.dot[e.element] : STATUS_LABEL[e.kind];
          if (label) addFloat(e.id, label, `status ${e.element || ""}`, 36);
          if (e.kind === "parade" || e.kind === "shield" || e.kind === "reduce" || e.kind === "armor") addFx(e.id, "shield");
          if (e.kind === "shadow") addFx(e.id, "smoke");
          if (e.kind === "weaken") addFx(e.id, "frost");
          break;
        }
        case "paLoss":
          addFloat(e.id, `-${e.amount} PA`, "status", 36);
          pulse(e.id, "stun");
          break;
        case "counter":
          addFloat(e.from, "Contre-attaque", "label", 70);
          pulse(e.from, "attackR");
          await sleep(220);
          break;
        case "phase":
          setEnraged((r) => ({ ...r, [e.id]: true }));
          showBanner(e.text, "rage small", 1500);
          pulse(e.id, "rage"); shake(true); sfx.roar();
          await sleep(1000);
          break;
        case "summon":
          showBanner("Des esprits surgissent !", "rage small", 1400);
          sfx.roar();
          setHpView((v) => ({ ...v, ...Object.fromEntries(e.enemies.map((a) => [a.id, a.hp])) }));
          setGhost((v) => ({ ...v, ...Object.fromEntries(e.enemies.map((a) => [a.id, a.hp])) }));
          setAppeared((a) => ({ ...a, ...Object.fromEntries(e.enemies.map((x) => [x.id, true])) }));
          setTimeline((tl) => {
            const at = tl.order.indexOf(e.from) + 1;
            const order = [...tl.order]; order.splice(at, 0, ...e.enemies.map((x) => x.id));
            return { ...tl, order };
          });
          await sleep(900);
          break;
        case "lastStand":
          setHpView((v) => ({ ...v, [e.id]: e.hpAfter }));
          setGhost((v) => ({ ...v, [e.id]: e.hpAfter }));
          showBanner("Dernier souffle !", "small", 1400);
          addFx(e.id, "heal");
          addFloat(e.id, "Dernier souffle", "heal", 70);
          sfx.heal();
          await sleep(700);
          break;
        case "round":
          setTimeline({ n: e.n, order: e.order });
          if (e.n > 1) { showBanner(`Tour ${e.n}`, "small", 700); await sleep(350); }
          break;
        case "turn":
          setActiveId(e.id);
          await sleep(e.id === "player" ? 0 : 140);
          break;
        case "skip":
          addFloat(e.id, "Plus de PA !", "status", 36);
          await sleep(450);
          break;
        case "playerTurn":
          showBanner("À vous !", "small", 800); sfx.turn();
          await sleep(350);
          break;
        case "victory": sfx.win(); await sleep(500); break;
        case "defeat": sfx.lose(); await sleep(600); break;
        default: break;
      }
    }
    await sleep(cast ? 380 : 120);
  }, []); // eslint-disable-line

  const play = useCallback(async (events) => {
    busyRef.current = true; setBusy(true);
    for (const g of groupEvents(events)) {
      if (!aliveRef.current) return;
      await playGroup(g);
    }
    if (!aliveRef.current) return;
    busyRef.current = false; setBusy(false);
    const ph = csRef.current.phase;
    if (ph === "victory" || ph === "defeat") { setEnded(ph); setActiveId(null); }
    else if (ph === "playerTurn") onIdleRef.current?.();
  }, [playGroup, csRef]);

  return { busy, busyRef, play, allyPos: ALLY_POS, allyH: ALLY_H, showBanner, hpView, ghost, dead, enraged, appeared, floats, fxs, banner, ended, timeline, activeId, slots, spriteRefs, shakeRef };
}
