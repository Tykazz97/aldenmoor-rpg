import { memo } from "react";
import { tileAt, mapWidth, mapHeight } from "../../utils/mapPath.js";

// Décor de la ville : une cité fortifiée (remparts, tours d'angle, portes, maisons), dessinée en SVG
// avec des textures et des sprites Ludo (public/assets/map/citydeco/). Une tuile = 100 unités.
// La grille de la ville (maps.js) ne change pas : seule son apparence est ici.
const T = 100;
const D = "/assets/map/citydeco/";
const WALL = 2;      // épaisseur des remparts, en tuiles

// Sprites : [fichier, largeur/hauteur]
const SPR = {
  tower: [`${D}tower.webp`, 0.763],
  gate: [`${D}gate.webp`, 1.062], gateB: [`${D}gate_b.webp`, 0.795],
  house1: [`${D}house1.webp`, 0.883], house2: [`${D}house2.webp`, 0.822], house3: [`${D}house3.webp`, 0.917], house4: [`${D}house4.webp`, 0.919],
  goods1: [`${D}goods1.webp`, 1.087], goods2: [`${D}goods2.webp`, 0.954], goods3: [`${D}goods3.webp`, 0.846],
  cart1: [`${D}cart1.webp`, 1.121], cart2: [`${D}cart2.webp`, 1.417],
};
// Tours d'angle, portes, maisons : [sprite, centre x, pied (y), hauteur] en tuiles
const TOWER_H = 4.6;
const standing = (W, H) => [
  ["tower", 1.6, 3.6, TOWER_H], ["tower", W - 1.6, 3.6, TOWER_H], ["tower", 1.6, H - 0.3, TOWER_H], ["tower", W - 1.6, H - 0.3, TOWER_H],
  // tours intermédiaires le long des remparts
  ["tower", 11, 2.6, 3.4], ["tower", W - 11, 2.6, 3.4], ["tower", 11, H - 0.3, 3.4], ["tower", W - 11, H - 0.3, 3.4],
  ["tower", 1.3, 9, 3.4], ["tower", W - 1.3, 9, 3.4], ["tower", 1.3, 20.6, 3.4], ["tower", W - 1.3, 20.6, 3.4],
  ["gate", W / 2, 2.3, 2.6], ["gateB", 1.3, 16.3, 3.4], ["gateB", W - 1.3, 16.3, 3.4],
  // blocs de maisons dans les quatre coins de la place
  ["house1", 4.0, 5.0, 2.6], ["house3", 5.6, 4.3, 2.4],
  ["house2", W - 4.0, 5.0, 2.6], ["house4", W - 5.6, 4.3, 2.4],
  ["house4", 4.4, 24.0, 2.6], ["house2", 6.2, 23.4, 2.4],
  ["house3", W - 4.4, 24.0, 2.6], ["house1", W - 6.2, 23.4, 2.4],
];
const PROPS = ["goods1", "goods2", "goods3", "cart1", "goods2", "cart2", "goods1", "goods3"];

function Sprite({ id, cx, base, h }) {
  const [href, ratio] = SPR[id];
  const w = h * ratio;
  return <image href={href} x={cx - w / 2} y={base - h} width={w} height={h} preserveAspectRatio="xMidYMax meet" />;
}

// créneaux le long du bord extérieur des remparts
function merlons(W, H) {
  const out = [], step = 60, a = 34, b = 26;
  for (let x = 130; x < W * T - 130; x += step) { out.push(<rect key={`mn${x}`} x={x} y={2} width={a} height={b} />); out.push(<rect key={`ms${x}`} x={x} y={H * T - b - 2} width={a} height={b} />); }
  for (let y = 130; y < H * T - 130; y += step) { out.push(<rect key={`mw${y}`} x={2} y={y} width={b} height={a} />); out.push(<rect key={`me${y}`} x={W * T - b - 2} y={y} width={b} height={a} />); }
  return out;
}

function CityTerrain({ map }) {
  const W = mapWidth(map), H = mapHeight(map);
  const dirt = [], pave = [], wall = [], things = [];
  let propN = 0;
  let pMin = [W, H], pMax = [0, 0];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = tileAt(map, x, y), px = x * T, py = y * T;
      if (t === ":") dirt.push(<rect key={`d${x},${y}`} x={px - 4} y={py - 4} width={T + 8} height={T + 8} rx="26" />);
      if (t === "P" || t === "F") {
        pave.push(<rect key={`p${x},${y}`} x={px} y={py} width={T + 0.6} height={T + 0.6} />);
        if (t === "P") { pMin = [Math.min(pMin[0], x), Math.min(pMin[1], y)]; pMax = [Math.max(pMax[0], x), Math.max(pMax[1], y)]; }
      }
      if (t === "F" && tileAt(map, x - 1, y) !== "F" && tileAt(map, x, y - 1) !== "F") {
        things.push({ y: py + 150, node: (
          <g key={`fo${x},${y}`}>
            <ellipse cx={px + 100} cy={py + 150} rx="92" ry="30" fill="rgba(0,0,0,.4)" />
            <ellipse cx={px + 100} cy={py + 112} rx="88" ry="52" fill="#8b8576" stroke="#1b1712" strokeWidth="3" />
            <ellipse cx={px + 100} cy={py + 106} rx="74" ry="40" fill="#3d6f87" />
            <ellipse cx={px + 100} cy={py + 106} rx="74" ry="40" fill="none" stroke="rgba(190,230,245,.35)" strokeWidth="3" />
            <rect x={px + 90} y={py + 40} width="20" height="66" rx="6" fill="#9a9484" stroke="#1b1712" strokeWidth="2" />
            <ellipse cx={px + 100} cy={py + 40} rx="26" ry="9" fill="#a8a292" stroke="#1b1712" strokeWidth="2" />
            <path d={`M${px + 100} ${py + 34} q-30 -26 -42 8 M${px + 100} ${py + 34} q30 -26 42 8`} stroke="rgba(190,230,245,.7)" strokeWidth="4" fill="none" strokeLinecap="round" />
          </g>
        ) });
      }
      if (t === "#") {
        // remparts : le bord de la carte (les touffes « # » intérieures sont remplacées par des maisons)
        const edge = x < WALL || y < WALL || x >= W - WALL || y >= H - WALL;
        if (edge) wall.push(<rect key={`w${x},${y}`} x={px} y={py} width={T + 0.6} height={T + 0.6} fill={y === 1 && x >= WALL && x < W - WALL ? "url(#ct-wallface)" : "url(#ct-rampart)"} />);
      }
      if (t === "r") {
        const id = PROPS[propN++ % PROPS.length];
        things.push({ y: py + 92, node: (
          <g key={`r${x},${y}`}>
            <ellipse cx={px + 50} cy={py + 86} rx="46" ry="11" fill="rgba(0,0,0,.4)" />
            <Sprite id={id} cx={px + 50} base={py + 92} h={id.startsWith("cart") ? 170 : 160} />
          </g>
        ) });
      }
    }
  }
  standing(W, H).forEach(([id, cx, base, h], i) => things.push({ y: base * T, node: (
    <g key={`s${i}`}>
      <ellipse cx={cx * T} cy={base * T - 6} rx={h * T * 0.28} ry={h * T * 0.07} fill="rgba(0,0,0,.4)" />
      <Sprite id={id} cx={cx * T} base={base * T} h={h * T} />
    </g>
  ) }));
  things.sort((a, b) => a.y - b.y);

  const inner = { x: WALL * T, y: WALL * T, w: (W - 2 * WALL) * T, h: (H - 2 * WALL) * T };
  return (
    <svg className="mp-terrain" viewBox={`0 0 ${W * T} ${H * T}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        {[["cobble", 360], ["flag", 440], ["rampart", 360], ["wallface", 400], ["dirt", 500]].map(([k, s]) => (
          <pattern key={k} id={`ct-${k}`} width={s} height={s} patternUnits="userSpaceOnUse"><image href={`${D}${k}.webp`} width={s} height={s} preserveAspectRatio="none" /></pattern>
        ))}
        <filter id="ct-rough" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="18" />
        </filter>
        <linearGradient id="ct-shade-n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgba(0,0,0,.55)" /><stop offset="1" stopColor="rgba(0,0,0,0)" /></linearGradient>
        <linearGradient id="ct-shade-w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="rgba(0,0,0,.5)" /><stop offset="1" stopColor="rgba(0,0,0,0)" /></linearGradient>
        <linearGradient id="ct-shade-e" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stopColor="rgba(0,0,0,.5)" /><stop offset="1" stopColor="rgba(0,0,0,0)" /></linearGradient>
        <linearGradient id="ct-shade-s" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="rgba(0,0,0,.5)" /><stop offset="1" stopColor="rgba(0,0,0,0)" /></linearGradient>
        <radialGradient id="ct-sun" cx="70%" cy="10%" r="75%"><stop offset="0" stopColor="rgba(255,200,130,.28)" /><stop offset="1" stopColor="rgba(255,200,130,0)" /></radialGradient>
        <radialGradient id="ct-vig" cx="50%" cy="50%" r="75%"><stop offset=".6" stopColor="rgba(0,0,0,0)" /><stop offset="1" stopColor="rgba(0,0,0,.5)" /></radialGradient>
      </defs>
      <rect width={W * T} height={H * T} fill="url(#ct-cobble)" />
      <g fill="url(#ct-dirt)" filter="url(#ct-rough)">{dirt}</g>
      <g fill="url(#ct-flag)">{pave}{pMax[0] >= pMin[0] && <rect x={pMin[0] * T} y={pMin[1] * T} width={(pMax[0] - pMin[0] + 1) * T} height={(pMax[1] - pMin[1] + 1) * T} />}</g>
      {pMax[0] >= pMin[0] && <rect x={pMin[0] * T} y={pMin[1] * T} width={(pMax[0] - pMin[0] + 1) * T} height={(pMax[1] - pMin[1] + 1) * T} fill="none" stroke="rgba(20,16,12,.55)" strokeWidth="6" />}
      <g>{wall}</g>
      <g fill="#7b7e88" stroke="#14110d" strokeWidth="3">{merlons(W, H)}</g>
      {/* ombre portée des remparts sur le sol */}
      <rect x={inner.x} y={inner.y} width={inner.w} height={T * 0.5} fill="url(#ct-shade-n)" />
      <rect x={inner.x} y={inner.y} width={T * 0.45} height={inner.h} fill="url(#ct-shade-w)" />
      <rect x={inner.x + inner.w - T * 0.45} y={inner.y} width={T * 0.45} height={inner.h} fill="url(#ct-shade-e)" />
      <rect x={inner.x} y={inner.y + inner.h - T * 0.35} width={inner.w} height={T * 0.35} fill="url(#ct-shade-s)" />
      <rect x={WALL * T - 2} y={WALL * T - 2} width={inner.w + 4} height={inner.h + 4} fill="none" stroke="rgba(10,8,6,.7)" strokeWidth="5" />
      <g>{things.map((o) => o.node)}</g>
      <rect width={W * T} height={H * T} fill="url(#ct-sun)" />
      <rect width={W * T} height={H * T} fill="url(#ct-vig)" />
    </svg>
  );
}

export default memo(CityTerrain);
