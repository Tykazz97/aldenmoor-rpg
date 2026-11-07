import React from "react";

// ------------------------------------------------------------
// Effets visuels ponctuels
// ------------------------------------------------------------
export default function Fx({ fx }) {
  const pos = { left: `${fx.x}%`, bottom: fx.y };
  switch (fx.kind) {
    case "slash":
      return <div className="cb-fx cb-slash" style={{ ...pos, transform: `translate(-50%, 50%) rotate(${fx.flip ? 25 : -20}deg) scaleX(${fx.flip ? -1 : 1})` }} />;
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
    case "fire": return <><div className="cb-fx cb-orb" style={{ ...pos, background: "radial-gradient(circle, #fff1b0, #ff8a2a 40%, rgba(255,60,0,0) 70%)" }} /><div className="cb-fx cb-ring" style={{ ...pos, color: "#ff8a2a" }} /></>;
    case "poison": return <div className="cb-fx cb-orb" style={{ ...pos, background: "radial-gradient(circle, #d7ff9a, #6fbf3a 40%, rgba(60,140,30,0) 70%)" }} />;
    case "frost": return <><div className="cb-fx cb-orb" style={{ ...pos, background: "radial-gradient(circle, #ffffff, #8fd3f5 40%, rgba(80,160,230,0) 70%)" }} /><div className="cb-fx cb-ring" style={{ ...pos, color: "#8fd3f5" }} /></>;
    case "arcane": return <><div className="cb-fx cb-orb" style={{ ...pos, background: "radial-gradient(circle, #ffffff, #a99bff 40%, rgba(124,111,217,0) 70%)" }} /><div className="cb-fx cb-ring" style={{ ...pos, color: "#a99bff" }} /></>;
    case "shield": return <div className="cb-fx cb-shield" style={pos} />;
    case "smoke": return <div className="cb-fx cb-smoke" style={pos} />;
    case "heal":
      return (
        <div className="cb-fx cb-heal-p" style={pos}>
          {[-30, -12, 8, 26].map((dx, i) => <i key={i} style={{ "--dx": `${dx}px`, animationDelay: `${i * 0.12}s` }}>+</i>)}
        </div>
      );
    case "proj":
      return (
        <div
          className={`cb-proj ${fx.arrow ? "arrow" : ""}`}
          style={{
            "--x0": `${fx.x0}%`, "--y0": `${fx.y0}px`, "--x1": `${fx.x1}%`, "--y1": `${fx.y1}px`,
            ...(fx.arrow ? {} : { background: `radial-gradient(circle, #fff, ${fx.col || "#a99bff"} 45%, transparent 72%)`, boxShadow: `0 0 18px ${fx.col || "#a99bff"}` }),
          }}
        />
      );
    default: return null;
  }
}
