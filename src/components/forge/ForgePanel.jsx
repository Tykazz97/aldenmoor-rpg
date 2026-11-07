import React, { useState, useRef, useEffect } from "react";
import BannerHeader from "../shared/BannerHeader.jsx";
import { color, border, radius, font } from "../../styles/theme.js";
import { NODES, nodesOfProfession } from "../../data/gathering.js";
import { PROFESSIONS, PROFESSION_ORDER, recipesOfProfession, xpForLevel, MAX_PROFESSION_LEVEL } from "../../data/professions.js";
import { RECIPES } from "../../data/recipes.js";
import { ITEMS } from "../../data/items.js";
import { RESOURCES, RESOURCE_ORDER, RESOURCE_RARITIES } from "../../data/resources.js";
import { canCraft } from "../../utils/crafting.js";
import { itemStatLines } from "../../utils/itemText.js";

const RARITY_ITEM_COLOR = { commune: "#9a95a8", rare: "#5fa3c4", epique: "#a855f7", legendaire: "#d9b568" };

// Icône de ressource, avec une pastille de remplacement tant que le visuel n'existe pas
function ResourceIcon({ resource, size = 28 }) {
  const [failed, setFailed] = useState(false);
  const rc = RESOURCE_RARITIES[resource.rarity]?.color || color.mist;
  if (resource.img && !failed) {
    return (
      <img
        src={resource.img} alt={resource.name} width={size} height={size}
        onError={() => setFailed(true)}
        style={{ objectFit: "contain", display: "block", flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, flexShrink: 0, borderRadius: "50%",
      background: `${rc}22`, border: `1px solid ${rc}`, color: rc,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.45, fontFamily: font.display,
    }}>
      {resource.name[0]}
    </div>
  );
}

function ProfessionButton({ profession, state, selected, onClick }) {
  const needed = xpForLevel(state.level);
  const atMax = state.level >= MAX_PROFESSION_LEVEL;
  const pct = atMax ? 100 : Math.min(100, (state.xp / needed) * 100);
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left", padding: "10px 12px",
        background: selected ? color.panelRaised : color.panel,
        border: `1px solid ${selected ? color.gold : color.line}`,
        borderRadius: radius.md, display: "flex", flexDirection: "column", gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>{profession.icon}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: selected ? color.goldBright : color.parchment }}>
          {profession.name}
        </span>
        <span style={{ fontSize: 11, fontFamily: font.data, color: color.parchmentDim }}>
          Niv. {state.level}{atMax ? " (max)" : ""}
        </span>
      </div>
      <div style={{ height: 5, background: color.void, borderRadius: 3, overflow: "hidden", border }}>
        <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${color.gold}88, ${color.goldBright})`, transition: "width 0.3s ease" }} />
      </div>
      {!atMax && (
        <div style={{ fontSize: 10, color: color.mist, fontFamily: font.data }}>
          {state.xp} / {needed} xp
        </div>
      )}
    </button>
  );
}

function RecipeCard({ itemId, check, onCraft }) {
  const item = ITEMS[itemId];
  const recipe = RECIPES[itemId];
  const rc = RARITY_ITEM_COLOR[item.rarity] || color.parchmentDim;
  const stats = itemStatLines(item);

  let blocker = null;
  if (check.lacksLevel) blocker = `Niveau ${check.minLevel} requis`;
  else if (check.lacksResources) blocker = "Ressources manquantes";
  else if (check.lacksGold) blocker = "Or insuffisant";

  return (
    <div style={{
      background: color.panel, border: `1px solid ${check.ok ? color.gold + "66" : color.line}`,
      borderRadius: radius.md, padding: 12, display: "flex", gap: 12,
      opacity: check.lacksLevel ? 0.6 : 1,
    }}>
      <div style={{
        width: 52, height: 52, flexShrink: 0, borderRadius: radius.sm,
        background: color.panelRaised, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {item.img ? <img src={item.img} alt={item.name} width="42" height="42" style={{ objectFit: "contain" }} /> : <span>?</span>}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: rc }}>{item.name}</span>
          <span style={{ fontSize: 10, color: color.mist }}>{stats.join(" · ")}</span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {Object.entries(recipe.ingredients).map(([resId, qty]) => {
            const res = RESOURCES[resId];
            const have = qty - (check.missing?.[resId] || 0);
            const enough = have >= qty;
            return (
              <div key={resId} title={res.name} style={{
                display: "flex", alignItems: "center", gap: 5, padding: "2px 7px 2px 3px",
                background: color.void, borderRadius: 999,
                border: `1px solid ${enough ? color.line : color.danger + "99"}`,
              }}>
                <ResourceIcon resource={res} size={20} />
                <span style={{ fontSize: 11, color: enough ? color.parchmentDim : "#d98a8a" }}>{res.name}</span>
                <span style={{ fontSize: 11, fontFamily: font.data, color: enough ? color.success : "#d98a8a" }}>
                  {have}/{qty}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between", gap: 6, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontFamily: font.data, color: check.lacksGold ? "#d98a8a" : color.goldBright }}>
          {recipe.gold} or
        </div>
        <button
          disabled={!check.ok}
          onClick={() => onCraft(itemId)}
          style={{
            padding: "6px 14px", fontSize: 12, fontWeight: 600, borderRadius: radius.sm,
            background: check.ok ? color.gold : color.panelRaised,
            color: check.ok ? color.void : color.mist,
            border: `1px solid ${check.ok ? color.goldBright : color.line}`,
            cursor: check.ok ? "pointer" : "not-allowed",
          }}
        >
          {check.ok ? "Crafter" : blocker}
        </button>
      </div>
    </div>
  );
}

function NodeCard({ node, level }) {
  const res = RESOURCES[node.resource];
  const ok = level >= node.minLevel;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: color.void, borderRadius: radius.md, border, opacity: ok ? 1 : 0.55 }}>
      <img src={node.img} alt="" style={{ width: 44, height: 44, objectFit: "contain" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: color.parchment }}>{node.name}</div>
        <div style={{ fontSize: 11, color: color.mist }}>{node.verb} sur la carte · {node.yield[0]}–{node.yield[1]} par récolte · +{node.xp} xp</div>
      </div>
      <ResourceIcon resource={res} size={28} />
      <span style={{ fontSize: 12, color: RESOURCE_RARITIES[res.rarity].color, minWidth: 90 }}>{res.name}</span>
      <span style={{ fontSize: 11, fontFamily: font.data, color: ok ? color.success : color.mist }}>{ok ? "Disponible" : `Niv. ${node.minLevel} requis`}</span>
    </div>
  );
}

export default function ForgePanel({ player, onCraft, onTestResources, onTestGold }) {
  const [selected, setSelected] = useState(PROFESSION_ORDER[0]);
  const [flash, setFlash] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const handleCraft = (itemId) => {
    onCraft(itemId);
    setFlash(`${ITEMS[itemId].name} fabriqué — ajouté à ton sac`);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlash(null), 2500);
  };

  const gatherNodes = PROFESSIONS[selected].kind === "gather" ? nodesOfProfession(selected) : null;
  const recipes = recipesOfProfession(selected);
  const owned = RESOURCE_ORDER.filter((id) => (player.resources[id] || 0) > 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 300px", gap: 20, height: "100%", minHeight: 0 }}>
      {/* Métiers */}
      <div style={{ background: color.panel, borderRadius: radius.lg, border, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <BannerHeader icon="⚒" title="Métiers" />
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {PROFESSION_ORDER.map((key) => (
            <ProfessionButton
              key={key} profession={PROFESSIONS[key]} state={player.professions[key]}
              selected={selected === key} onClick={() => setSelected(key)}
            />
          ))}
        </div>
      </div>

      {/* Recettes */}
      <div style={{ background: color.panel, borderRadius: radius.lg, border, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <BannerHeader icon={PROFESSIONS[selected].icon} title={PROFESSIONS[selected].name} right={gatherNodes ? `${gatherNodes.length} ressource${gatherNodes.length > 1 ? "s" : ""}` : `${recipes.length} recette${recipes.length > 1 ? "s" : ""}`} />
        <div style={{ padding: "8px 12px 0", fontSize: 12, color: color.mist }}>{PROFESSIONS[selected].desc}</div>
        {flash && (
          <div style={{ margin: "8px 12px 0", padding: "6px 10px", fontSize: 12, color: color.success, background: "#5c9c5c18", border: `1px solid ${color.success}66`, borderRadius: radius.sm }}>
            ✔ {flash}
          </div>
        )}
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
          {gatherNodes && gatherNodes.map((n) => <NodeCard key={n.id} node={n} level={player.professions[selected]?.level ?? 1} />)}
          {!gatherNodes && recipes.map(({ itemId }) => (
            <RecipeCard key={itemId} itemId={itemId} check={canCraft(player, itemId)} onCraft={handleCraft} />
          ))}
        </div>
      </div>

      {/* Ressources + outils de test */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20, minHeight: 0 }}>
        <div style={{ background: color.panel, borderRadius: radius.lg, border, overflow: "hidden", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <BannerHeader icon="🪨" title="Ressources" right={`${player.gold} or`} />
          <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6, overflowY: "auto" }}>
            {owned.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: color.mist }}>
                Aucune ressource. Récolte-les sur la carte ou prends-les aux monstres.
              </div>
            ) : (
              owned.map((id) => {
                const res = RESOURCES[id];
                const rc = RESOURCE_RARITIES[res.rarity].color;
                return (
                  <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", background: color.void, borderRadius: radius.sm, border }}>
                    <ResourceIcon resource={res} size={28} />
                    <span style={{ flex: 1, fontSize: 12, color: rc }}>{res.name}</span>
                    <span style={{ fontSize: 12, fontFamily: font.data, color: color.parchment }}>×{player.resources[id]}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div style={{ border: `1px dashed ${color.lineBright}`, borderRadius: radius.md, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, color: color.mist, textTransform: "uppercase", letterSpacing: "0.08em" }}>Outils de test</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => onTestResources()} style={testBtn}>+ Ressources</button>
            <button onClick={() => onTestGold(500)} style={testBtn}>+ 500 or</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const testBtn = {
  flex: 1, padding: "6px 8px", fontSize: 12, color: color.parchmentDim,
  background: color.panelRaised, border, borderRadius: radius.sm,
};
