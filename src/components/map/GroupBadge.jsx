import { useMemo } from "react";
import { groupOf, GROUP_MAX } from "../../utils/group.js";
import { heroSpriteUrl } from "../../data/heroSprites.js";
import { CLASSES } from "../../data/classes.js";

// Le rappel du groupe sur la carte : les membres présents (avatar, pseudo, niveau) ; un clic ouvre l'onglet Groupe.
export default function GroupBadge({ player, onManage }) {
  const members = useMemo(() => groupOf(player).members, [player.companions, player.market?.sims]); // eslint-disable-line
  if (!members.length) return null;
  return (
    <button data-map-group onClick={onManage} title="Gérer mon groupe" style={{ position: "absolute", bottom: 10, left: 10, zIndex: 1100, display: "flex", gap: 10, alignItems: "center", padding: "6px 10px", borderRadius: 10, background: "rgba(10,8,18,.88)", border: "1px solid #3a6a58", color: "#cfe8dd", font: "600 12px 'Inter', sans-serif", cursor: "pointer" }}>
      <span style={{ opacity: 0.7 }}>👥 {members.length + 1}/{GROUP_MAX + 1}</span>
      {members.map((b) => (
        <span key={b.id} data-map-group-member={b.id} style={{ display: "flex", alignItems: "center", gap: 5 }} title={`${CLASSES[b.classKey]?.label} niveau ${b.level}`}>
          <img src={heroSpriteUrl(b.look)} alt="" style={{ width: 26, height: 26, objectFit: "contain", objectPosition: "center top", imageRendering: "pixelated" }} />
          {b.name} <i style={{ fontStyle: "normal", color: "#7aa898" }}>niv. {b.level}</i>
        </span>
      ))}
    </button>
  );
}
