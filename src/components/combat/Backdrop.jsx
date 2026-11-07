import React from "react";

// ------------------------------------------------------------
// Décor : crépuscule sur la prairie
// ------------------------------------------------------------
const EMBERS = Array.from({ length: 16 }, (_, i) => ({ left: (i * 37) % 100, delay: (i * 1.7) % 9, dur: 7 + ((i * 13) % 6), dx: ((i * 29) % 80) - 40 }));

export default function Backdrop() {
  return (
    <>
      <div className="cb-sky" />
      <div className="cb-sun" />
      <svg className="cb-hills" viewBox="0 0 1000 440" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 270 C120 220 220 250 330 235 C450 215 520 255 640 240 C760 225 880 250 1000 225 L1000 440 L0 440Z" fill="#2a2036" opacity=".85" />
        <path d="M0 305 C100 270 210 300 330 285 C470 268 560 305 700 290 C820 278 920 300 1000 285 L1000 440 L0 440Z" fill="#1d1828" />
        {/* arbre mort + tour en ruine */}
        <g fill="#14111c" opacity=".95">
          <path d="M120 300 L124 215 L110 190 M124 240 L142 218 M124 255 L108 238" stroke="#14111c" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M610 292 L610 215 L624 215 L624 232 L640 232 L640 215 L654 215 L654 292Z" />
        </g>
        <path d="M0 340 C150 320 300 345 480 332 C660 320 820 345 1000 330 L1000 440 L0 440Z" fill="#16131d" />
      </svg>
      <div className="cb-fog" />
      <div className="cb-ground" />
      {EMBERS.map((e, i) => (
        <span key={i} className="cb-ember" style={{ left: `${e.left}%`, animationDelay: `${e.delay}s`, animationDuration: `${e.dur}s`, "--dx": `${e.dx}px` }} />
      ))}
    </>
  );
}
