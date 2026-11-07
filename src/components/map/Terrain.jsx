import React, { memo } from "react";
import { tileAt, mapWidth, mapHeight } from "../../utils/mapPath.js";

// Décor de la carte dessiné en SVG (une tuile = 100 unités). Rendu une seule
// fois : les tuiles sont générées de façon déterministe (mêmes arbres à chaque
// affichage).
const T = 100;
const GRASS = ["#2d3a29", "#2c3927", "#2f3c2b", "#2b3727", "#2e3b2a"];
const DIRT = ["#5d4932", "#54432d", "#62503a"];
const WATER = ["#27475b", "#2f5266"];
const TREE_DARK = ["#13221a", "#172a1c", "#1b2f20"];
const TREE_LIGHT = ["#274a30", "#2d5636", "#24432c"];

// petit générateur pseudo-aléatoire déterministe par tuile
function rnd(x, y, k = 0) {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 10000) / 10000;
}
const pick = (arr, x, y, k) => arr[Math.floor(rnd(x, y, k) * arr.length)];

function Tree({ cx, cy, r, k }) {
  const dark = TREE_DARK[k % 3], light = TREE_LIGHT[k % 3];
  return (
    <g>
      <ellipse cx={cx} cy={cy + r * 0.85} rx={r * 0.95} ry={r * 0.32} fill="rgba(0,0,0,.45)" />
      <rect x={cx - r * 0.1} y={cy + r * 0.3} width={r * 0.2} height={r * 0.6} fill="#2a1f17" />
      <circle cx={cx} cy={cy} r={r} fill={dark} />
      <circle cx={cx - r * 0.25} cy={cy - r * 0.2} r={r * 0.72} fill={light} opacity=".9" />
      <circle cx={cx - r * 0.4} cy={cy - r * 0.38} r={r * 0.34} fill="#3d7040" opacity=".55" />
    </g>
  );
}

function Terrain({ map }) {
  const W = mapWidth(map), H = mapHeight(map);
  const grass = [], dirt = [], water = [], decor = [], trees = [];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = tileAt(map, x, y);
      const px = x * T, py = y * T;
      // sol de base partout (sous les arbres aussi)
      grass.push(<ellipse key={`g${x},${y}`} cx={px + 50} cy={py + 50} rx={85 + rnd(x, y, 8) * 40} ry={80 + rnd(x, y, 9) * 35} fill={pick(GRASS, x, y, 1)} opacity=".7" />);
      if (t === "." || t === "S") {
        for (let i = 0; i < 3; i++) {
          const gx = px + 10 + rnd(x, y, 10 + i) * 80, gy = py + 20 + rnd(x, y, 20 + i) * 70;
          decor.push(<path key={`t${x},${y},${i}`} d={`M${gx} ${gy} l-4 -12 M${gx} ${gy} l1 -15 M${gx} ${gy} l5 -11`} stroke="#4f6b3f" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity=".75" />);
        }
        if (rnd(x, y, 30) > 0.8) {
          const fx = px + 15 + rnd(x, y, 31) * 70, fy = py + 25 + rnd(x, y, 32) * 55;
          decor.push(<circle key={`f${x},${y}`} cx={fx} cy={fy} r="3.2" fill={rnd(x, y, 33) > 0.5 ? "#c9b458" : "#b25a5a"} opacity=".85" />);
        }
      }
      if (t === ":") dirt.push(<rect key={`d${x},${y}`} x={px - 6} y={py - 6} width={T + 12} height={T + 12} rx="30" fill={pick(DIRT, x, y, 2)} />);
      if (t === "~") water.push(<rect key={`w${x},${y}`} x={px - 8} y={py - 8} width={T + 16} height={T + 16} rx="38" fill={pick(WATER, x, y, 3)} />);
      if (t === "~") decor.push(<ellipse key={`wl${x},${y}`} cx={px + 35 + rnd(x, y, 4) * 30} cy={py + 40 + rnd(x, y, 5) * 20} rx="22" ry="6" fill="rgba(180,220,240,.16)" />);
      if (t === "#") {
        const n = 3;
        for (let i = 0; i < n; i++) {
          trees.push({ y: py + 60 + i * 12 + rnd(x, y, 40 + i) * 30, node: <Tree key={`tr${x},${y},${i}`} cx={px + 18 + rnd(x, y, 50 + i) * 64} cy={py + 38 + rnd(x, y, 60 + i) * 46} r={44 + rnd(x, y, 70 + i) * 18} k={x + y + i} /> });
        }
      }
      if (t === "r") {
        decor.push(
          <g key={`r${x},${y}`}>
            <ellipse cx={px + 50} cy={py + 78} rx="44" ry="12" fill="rgba(0,0,0,.4)" />
            <polygon points={`${px + 14},${py + 78} ${px + 30},${py + 34} ${px + 58},${py + 22} ${px + 84},${py + 60} ${px + 80},${py + 80}`} fill="#4b4b57" />
            <polygon points={`${px + 30},${py + 34} ${px + 58},${py + 22} ${px + 66},${py + 46} ${px + 42},${py + 54}`} fill="#6a6a76" />
            <polygon points={`${px + 58},${py + 22} ${px + 84},${py + 60} ${px + 66},${py + 46}`} fill="#5b5b67" />
          </g>
        );
      }
      if (t === "T") {
        decor.push(
          <g key={`dt${x},${y}`} stroke="#120f18" strokeLinecap="round" fill="none">
            <ellipse cx={px + 50} cy={py + 88} rx="30" ry="8" fill="rgba(0,0,0,.4)" stroke="none" />
            <path d={`M${px + 50} ${py + 88} L${px + 54} ${py + 22}`} strokeWidth="9" />
            <path d={`M${px + 53} ${py + 50} L${px + 80} ${py + 26} M${px + 52} ${py + 64} L${px + 24} ${py + 40} M${px + 54} ${py + 34} L${px + 36} ${py + 12}`} strokeWidth="5" />
          </g>
        );
      }
    }
  }
  trees.sort((a, b) => a.y - b.y);

  return (
    <svg className="mp-terrain" viewBox={`0 0 ${W * T} ${H * T}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <filter id="mp-rough" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="26" />
        </filter>
        <filter id="mp-blur" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="22" /></filter>
        <radialGradient id="mp-sun" cx="85%" cy="12%" r="70%">
          <stop offset="0" stopColor="rgba(255,190,110,.34)" />
          <stop offset="1" stopColor="rgba(255,190,110,0)" />
        </radialGradient>
        <radialGradient id="mp-vig" cx="50%" cy="50%" r="75%">
          <stop offset=".55" stopColor="rgba(0,0,0,0)" />
          <stop offset="1" stopColor="rgba(0,0,0,.6)" />
        </radialGradient>
      </defs>
      <rect width={W * T} height={H * T} fill="#2c3928" />
      <g filter="url(#mp-blur)">{grass}</g>
      <g filter="url(#mp-rough)">{dirt}</g>
      <g filter="url(#mp-rough)">{water}</g>
      <g>{decor}</g>
      <g>{trees.map((t) => t.node)}</g>
      <rect width={W * T} height={H * T} fill="url(#mp-sun)" />
      <rect width={W * T} height={H * T} fill="url(#mp-vig)" />
    </svg>
  );
}

export default memo(Terrain);
