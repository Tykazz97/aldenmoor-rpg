import React, { useEffect, useRef } from "react";
import { tileAt, mapWidth, mapHeight } from "../../utils/mapPath.js";

// Mini-carte en coin : relief, groupes (rouge), ressources (vert) et héros (point doré,
// déplacé à chaque image par MapScreen via `dotRef`).
const PX = 4;
const COLORS = { ".": "#33402d", S: "#33402d", ":": "#6a563b", "#": "#14241a", "~": "#2d566e", r: "#5a5a66", T: "#241c28", P: "#7a7466", B: "#4a3626", F: "#2d566e" };

export default function Minimap({ map, groups, nodes, dotRef }) {
  const ref = useRef(null);
  const W = mapWidth(map), H = mapHeight(map);

  useEffect(() => {
    const ctx = ref.current.getContext("2d");
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      ctx.fillStyle = COLORS[tileAt(map, x, y)] || "#000";
      ctx.fillRect(x * PX, y * PX, PX, PX);
    }
    ctx.fillStyle = "#6fcf5a";
    for (const n of nodes) ctx.fillRect(n.x * PX + 1, n.y * PX + 1, PX - 1, PX - 1);
    ctx.fillStyle = "#ff6a52";
    for (const g of groups) ctx.fillRect(g.x * PX, g.y * PX, PX + 1, PX + 1);
  }, [map, groups, nodes, W, H]);

  return (
    <div className="mp-mini" style={{ aspectRatio: `${W} / ${H}` }}>
      <canvas ref={ref} width={W * PX} height={H * PX} />
      <span className="mp-mini-dot" ref={dotRef} />
    </div>
  );
}
