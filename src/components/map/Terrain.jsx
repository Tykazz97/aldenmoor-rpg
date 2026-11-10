import { memo } from "react";
import { tileAt, mapWidth, mapHeight } from "../../utils/mapPath.js";

// Décor de la carte dessiné en SVG (une tuile = 100 unités). Rendu une seule
// fois : les tuiles sont générées de façon déterministe (mêmes arbres à chaque
// affichage).
const T = 100;
// Palettes par région (map.theme) : prairie par défaut, champs calcinés, lisière hantée
const THEMES = {
  prairie: {
    base: "#2c3928", grass: ["#2d3a29", "#2c3927", "#2f3c2b", "#2b3727", "#2e3b2a"], blade: "#4f6b3f",
    dirt: ["#5d4932", "#54432d", "#62503a"], water: ["#27475b", "#2f5266"],
    treeDark: ["#13221a", "#172a1c", "#1b2f20"], treeLight: ["#274a30", "#2d5636", "#24432c"], treeTop: "#3d7040",
    sun: "255,190,110", sunA: 0.34, flowers: ["#c9b458", "#b25a5a"],
    tex: { ground: "/assets/map/tex/prairie_ground.webp", dirt: "/assets/map/tex/prairie_dirt.webp", size: 500 },   // textures Ludo (sinon : aplats de couleur)
    deco: { tree: ["/assets/map/deco/tree_p1.webp", "/assets/map/deco/tree_p2.webp", "/assets/map/deco/tree_p3.webp"], rock: ["/assets/map/deco/rock_p1.webp", "/assets/map/deco/rock_p2.webp"], dead: ["/assets/map/deco/dead_1.webp", "/assets/map/deco/dead_2.webp"] },
  },
  calcine: {
    base: "#2b241f", grass: ["#302822", "#2d261f", "#352b24", "#2a231d", "#33291f"], blade: "#6b5238",
    dirt: ["#4a3a2c", "#3f3226", "#533f2e"], water: ["#2c3a35", "#34453e"],
    treeDark: ["#120d0b", "#17100d", "#1c140f"], treeLight: ["#3a2a20", "#43301f", "#33251c"], treeTop: "#5a3a22",
    sun: "255,120,60", sunA: 0.38, flowers: ["#d8742c", "#8a3b24"],
    tex: { ground: "/assets/map/tex/calcine_ground.webp", dirt: "/assets/map/tex/calcine_dirt.webp", size: 700 },
    deco: { tree: ["/assets/map/deco/tree_c1.webp", "/assets/map/deco/tree_c2.webp", "/assets/map/deco/tree_c3.webp"], rock: ["/assets/map/deco/rock_c1.webp", "/assets/map/deco/rock_c2.webp"], dead: ["/assets/map/deco/dead_1.webp", "/assets/map/deco/dead_2.webp"] },
  },
  lisiere: {
    base: "#1d2629", grass: ["#1f292b", "#1c2528", "#222d2f", "#1a2326", "#20292e"], blade: "#3f5a5c",
    dirt: ["#3a3140", "#322a38", "#41374a"], water: ["#1f2f4a", "#273a5a"],
    treeDark: ["#0e1418", "#10171d", "#131b22"], treeLight: ["#233a3d", "#2a3f4a", "#25344a"], treeTop: "#4b4a8a",
    sun: "150,110,255", sunA: 0.3, flowers: ["#9a7ae0", "#5fb5b0"],
    tex: { ground: "/assets/map/tex/lisiere_ground.webp", dirt: "/assets/map/tex/lisiere_dirt.webp", size: 600 },
    deco: { tree: ["/assets/map/deco/tree_l1.webp", "/assets/map/deco/tree_l2.webp", "/assets/map/deco/tree_l3.webp"], rock: ["/assets/map/deco/rock_l1.webp", "/assets/map/deco/rock_l2.webp"], dead: ["/assets/map/deco/dead_1.webp", "/assets/map/deco/dead_2.webp"] },
  },
};

const PAVE = ["#6d675a", "#625c50", "#756f61", "#686254"];

// petit générateur pseudo-aléatoire déterministe par tuile
function rnd(x, y, k = 0) {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 10000) / 10000;
}
const pick = (arr, x, y, k) => arr[Math.floor(rnd(x, y, k) * arr.length)];

// sprite posé « au sol » : boîte carrée de côté `size`, ancré en bas au centre
const Sprite = ({ href, cx, base, size }) => (
  <image href={href} x={cx - size / 2} y={base - size} width={size} height={size} preserveAspectRatio="xMidYMax meet" />
);

function Tree({ cx, cy, r, k, th }) {
  if (th.deco) {
    return (
      <g>
        <ellipse cx={cx} cy={cy + r * 0.95} rx={r * 0.8} ry={r * 0.26} fill="rgba(0,0,0,.45)" />
        <Sprite href={th.deco.tree[k % th.deco.tree.length]} cx={cx} base={cy + r * 1.05} size={r * 3} />
      </g>
    );
  }
  const dark = th.treeDark[k % 3], light = th.treeLight[k % 3];
  return (
    <g>
      <ellipse cx={cx} cy={cy + r * 0.85} rx={r * 0.95} ry={r * 0.32} fill="rgba(0,0,0,.45)" />
      <rect x={cx - r * 0.1} y={cy + r * 0.3} width={r * 0.2} height={r * 0.6} fill="#2a1f17" />
      <circle cx={cx} cy={cy} r={r} fill={dark} />
      <circle cx={cx - r * 0.25} cy={cy - r * 0.2} r={r * 0.72} fill={light} opacity=".9" />
      <circle cx={cx - r * 0.4} cy={cy - r * 0.38} r={r * 0.34} fill={th.treeTop} opacity=".55" />
    </g>
  );
}

function Terrain({ map }) {
  const th = THEMES[map.theme] || THEMES.prairie;
  const W = mapWidth(map), H = mapHeight(map);
  const grass = [], dirt = [], water = [], pave = [], decor = [], trees = [];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = tileAt(map, x, y);
      const px = x * T, py = y * T;
      // sol de base partout (sous les arbres aussi)
      grass.push(<ellipse key={`g${x},${y}`} cx={px + 50} cy={py + 50} rx={85 + rnd(x, y, 8) * 40} ry={80 + rnd(x, y, 9) * 35} fill={pick(th.grass, x, y, 1)} opacity=".7" />);
      if (t === "." || t === "S") {
        for (let i = 0; i < 3; i++) {
          const gx = px + 10 + rnd(x, y, 10 + i) * 80, gy = py + 20 + rnd(x, y, 20 + i) * 70;
          decor.push(<path key={`t${x},${y},${i}`} d={`M${gx} ${gy} l-4 -12 M${gx} ${gy} l1 -15 M${gx} ${gy} l5 -11`} stroke={th.blade} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity=".75" />);
        }
        if (rnd(x, y, 30) > 0.8) {
          const fx = px + 15 + rnd(x, y, 31) * 70, fy = py + 25 + rnd(x, y, 32) * 55;
          decor.push(<circle key={`f${x},${y}`} cx={fx} cy={fy} r="3.2" fill={rnd(x, y, 33) > 0.5 ? th.flowers[0] : th.flowers[1]} opacity=".85" />);
        }
      }
      if (t === "P" || t === "B" || t === "F") {
        pave.push(
          <g key={`p${x},${y}`}>
            <rect x={px + 1.5} y={py + 1.5} width={T - 3} height={T - 3} rx="9" fill={pick(PAVE, x, y, 6)} />
            <path d={`M${px + 14} ${py + 30 + rnd(x, y, 7) * 40} h${22 + rnd(x, y, 12) * 20} M${px + 52} ${py + 22 + rnd(x, y, 13) * 50} h${24}`} stroke="rgba(0,0,0,.18)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </g>
        );
      }
      if (t === "F" && tileAt(map, x - 1, y) !== "F" && tileAt(map, x, y - 1) !== "F") {
        decor.push(
          <g key={`fo${x},${y}`}>
            <ellipse cx={px + 100} cy={py + 150} rx="92" ry="30" fill="rgba(0,0,0,.4)" />
            <ellipse cx={px + 100} cy={py + 112} rx="88" ry="52" fill="#8b8576" />
            <ellipse cx={px + 100} cy={py + 106} rx="74" ry="40" fill="#3d6f87" />
            <ellipse cx={px + 100} cy={py + 106} rx="74" ry="40" fill="none" stroke="rgba(190,230,245,.35)" strokeWidth="3" />
            <rect x={px + 90} y={py + 40} width="20" height="66" rx="6" fill="#9a9484" />
            <ellipse cx={px + 100} cy={py + 40} rx="26" ry="9" fill="#a8a292" />
            <path d={`M${px + 100} ${py + 34} q-30 -26 -42 8 M${px + 100} ${py + 34} q30 -26 42 8`} stroke="rgba(190,230,245,.7)" strokeWidth="4" fill="none" strokeLinecap="round" />
          </g>
        );
      }
      if (t === ":") dirt.push(<rect key={`d${x},${y}`} x={px - 6} y={py - 6} width={T + 12} height={T + 12} rx="30" fill={th.tex?.dirt ? undefined : pick(th.dirt, x, y, 2)} />);
      if (t === "~") water.push(<rect key={`w${x},${y}`} x={px - 8} y={py - 8} width={T + 16} height={T + 16} rx="38" fill={pick(th.water, x, y, 3)} />);
      if (t === "~") decor.push(<ellipse key={`wl${x},${y}`} cx={px + 35 + rnd(x, y, 4) * 30} cy={py + 40 + rnd(x, y, 5) * 20} rx="22" ry="6" fill="rgba(180,220,240,.16)" />);
      if (t === "#") {
        const n = 3;
        for (let i = 0; i < n; i++) {
          trees.push({ y: py + 60 + i * 12 + rnd(x, y, 40 + i) * 30, node: <Tree key={`tr${x},${y},${i}`} cx={px + 18 + rnd(x, y, 50 + i) * 64} cy={py + 38 + rnd(x, y, 60 + i) * 46} r={44 + rnd(x, y, 70 + i) * 18} k={x + y + i} th={th} /> });
        }
      }
      if (t === "r" && th.deco) {
        decor.push(
          <g key={`r${x},${y}`}>
            <ellipse cx={px + 50} cy={py + 84} rx="46" ry="11" fill="rgba(0,0,0,.4)" />
            <Sprite href={pick(th.deco.rock, x, y, 8)} cx={px + 50} base={py + 88} size={126} />
          </g>
        );
      } else if (t === "r") {
        decor.push(
          <g key={`r${x},${y}`}>
            <ellipse cx={px + 50} cy={py + 78} rx="44" ry="12" fill="rgba(0,0,0,.4)" />
            <polygon points={`${px + 14},${py + 78} ${px + 30},${py + 34} ${px + 58},${py + 22} ${px + 84},${py + 60} ${px + 80},${py + 80}`} fill="#4b4b57" />
            <polygon points={`${px + 30},${py + 34} ${px + 58},${py + 22} ${px + 66},${py + 46} ${px + 42},${py + 54}`} fill="#6a6a76" />
            <polygon points={`${px + 58},${py + 22} ${px + 84},${py + 60} ${px + 66},${py + 46}`} fill="#5b5b67" />
          </g>
        );
      }
      if (t === "T" && th.deco) {
        decor.push(
          <g key={`dt${x},${y}`}>
            <ellipse cx={px + 50} cy={py + 90} rx="30" ry="8" fill="rgba(0,0,0,.4)" />
            <Sprite href={pick(th.deco.dead, x, y, 9)} cx={px + 50} base={py + 94} size={160} />
          </g>
        );
      } else if (t === "T") {
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
        {th.tex && Object.entries(th.tex).filter(([k]) => k !== "size").map(([k, href]) => (
          <pattern key={k} id={`mp-tex-${k}`} width={th.tex.size} height={th.tex.size} patternUnits="userSpaceOnUse"><image href={href} width={th.tex.size} height={th.tex.size} preserveAspectRatio="none" /></pattern>
        ))}
        <filter id="mp-rough" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="26" />
        </filter>
        <filter id="mp-blur" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="22" /></filter>
        <radialGradient id="mp-sun" cx="85%" cy="12%" r="70%">
          <stop offset="0" stopColor={`rgba(${th.sun},${th.sunA})`} />
          <stop offset="1" stopColor={`rgba(${th.sun},0)`} />
        </radialGradient>
        <radialGradient id="mp-vig" cx="50%" cy="50%" r="75%">
          <stop offset=".55" stopColor="rgba(0,0,0,0)" />
          <stop offset="1" stopColor="rgba(0,0,0,.6)" />
        </radialGradient>
      </defs>
      <rect width={W * T} height={H * T} fill={th.base} />
      {th.tex?.ground && <rect width={W * T} height={H * T} fill="url(#mp-tex-ground)" />}
      <g filter="url(#mp-blur)" opacity={th.tex?.ground ? 0.35 : 1}>{grass}</g>
      <g filter="url(#mp-rough)" fill={th.tex?.dirt ? "url(#mp-tex-dirt)" : undefined}>{dirt}</g>
      <g filter="url(#mp-rough)">{water}</g>
      <g>{pave}</g>
      <g>{decor}</g>
      <g>{trees.map((t) => t.node)}</g>
      <rect width={W * T} height={H * T} fill="url(#mp-sun)" />
      <rect width={W * T} height={H * T} fill="url(#mp-vig)" />
    </svg>
  );
}

export default memo(Terrain);
