import { useState } from "react";


// Effets en images (dessinés avec Ludo, fond transparent) : chaque image « claque » (zoom + fondu) sur la cible.
const FX_IMG = "/assets/combat/fx/";
// largeur (px), durée (ms), halo
const IMG = {
  fire: { w: 240, ms: 650, glow: "#ff7a2a" },
  frost: { w: 220, ms: 650, glow: "#8fd3f5" },
  poison: { w: 230, ms: 800, glow: "#8fdc5a" },
  arcane: { w: 230, ms: 700, glow: "#a58cff" },
  crit: { w: 320, ms: 650, glow: "#ff3a2a" },
  shield: { w: 220, ms: 900, glow: "#9fd0ff", cls: "cb-fxi-ward" },
  heal: { w: 180, ms: 1200, glow: "#e8d9a0", cls: "cb-fxi-rise" },
};

export default function Fx({ fx }) {
  const [rnd] = useState(() => Math.random());
  const pos = { left: `${fx.x}%`, bottom: fx.y };
  const img = (name, { w, ms, glow, cls = "", rot = 0, flip = false }) => (
    <div className="cb-fx cb-fxi" style={pos}>
      <img className={cls} src={`${FX_IMG}${name}.webp`} alt="" draggable={false}
        style={{ width: w, animationDuration: `${ms}ms`, "--r": `${rot}deg`, "--sx": flip ? -1 : 1, filter: `drop-shadow(0 0 12px ${glow})` }} />
    </div>
  );
  switch (fx.kind) {
    case "slash": return img(rnd < 0.5 ? "slash_a" : "slash_b", { w: 210, ms: 450, glow: "#c8201a", rot: (rnd - 0.5) * 30, flip: fx.flip });
    case "spark": {
      const n = fx.crit ? 14 : 8;
      return (
        <div className="cb-fx cb-spark" style={pos}>
          {Array.from({ length: n }, (_, i) => {
            const a = (i / n) * Math.PI * 2 + Math.random() * 0.4; const d = (fx.crit ? 70 : 45) + Math.random() * 25;
            return <i key={i} style={{ "--dx": `${Math.cos(a) * d}px`, "--dy": `${Math.sin(a) * d}px`, background: fx.crit ? "#ffd23f" : undefined }} />;
          })}
        </div>
      );
    }
    case "fire": case "frost": case "poison": case "arcane": case "crit": case "shield": case "heal":
      return img(fx.kind, IMG[fx.kind]);
    case "smoke": return <div className="cb-fx cb-smoke" style={pos} />;
    case "proj":
      return (
        <div
          className={`cb-proj ${fx.arrow ? "arrow" : ""}`}
          style={{
            "--x0": `${fx.x0}%`, "--y0": `${fx.y0}px`, "--x1": `${fx.x1}%`, "--y1": `${fx.y1}px`,
            ...(fx.arrow ? {} : { background: `radial-gradient(circle, #fff, ${fx.col || "#a99bff"} 45%, transparent 72%)`, boxShadow: `0 0 18px ${fx.col || "#a99bff"}, -22px 0 22px -6px ${fx.col || "#a99bff"}` }),
          }}
        />
      );
    default: return null;
  }
}
