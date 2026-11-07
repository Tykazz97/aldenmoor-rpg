import React, { useState, useRef, useEffect } from "react";
import BannerHeader from "../shared/BannerHeader.jsx";
import { color, border, radius, font } from "../../styles/theme.js";
import { NODES, nodesOfProfession } from "../../data/gathering.js";
import { PROFESSIONS, PROFESSION_ORDER, recipesOfProfession, xpForLevel, MAX_PROFESSION_LEVEL } from "../../data/professions.js";
import { RECIPES } from "../../data/recipes.js";
import { ITEMS } from "../../data/items.js";
import { RESOURCES, RESOURCE_ORDER, RESOURCE_RARITIES } from "../../data/resources.js";
import { REFINING, refiningOf } from "../../data/refining.js";
import { ALCHEMY, alchemyOf } from "../../data/alchemy.js";
import { canCraft, canRefine, maxRefine, canBrew, maxBrew, professionOf } from "../../utils/crafting.js";
import { perkLines, isMasterwork } from "../../utils/perks.js";
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
          <span title="Taxe de la ville, en pourcentage du prix de l'objet">{check.fee > 0 ? `${check.fee} or de taxe` : "sans taxe"}</span>
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

// Raffinage : on transforme des matières brutes en matière raffinée, par 1, par 5 ou au maximum
// (la même carte sert à l'Alchimiste : `brew` choisit la table des potions)
function RefineCard({ id, player, onRefine, brew = false, fx = {} }) {
  const rec = (brew ? ALCHEMY : REFINING)[id], out = RESOURCES[id];
  const max = brew ? maxBrew(player, id, fx) : maxRefine(player, id, fx), check = brew ? canBrew(player, id, 1, fx) : canRefine(player, id, 1, fx);
  const effect = !brew ? "" : rec.heal ? ` · rend ${Math.round(rec.heal * 100)} % des PV` : rec.revive ? ` · relève un héros tombé à ${Math.round(rec.revive * 100)} % des PV` : "";
  const rc = RESOURCE_RARITIES[out.rarity]?.color || color.mist;
  const btn = (n, label) => {
    const on = n >= 1 && max >= n;
    return (
      <button {...{ [brew ? "data-brew" : "data-refine"]: n === max ? "max" : String(n) }} disabled={!on} onClick={() => onRefine(id, n)} style={{ padding: "5px 10px", fontSize: 12, fontWeight: 600, borderRadius: radius.sm, background: on ? color.gold : color.panelRaised, color: on ? color.void : color.mist, border: `1px solid ${on ? color.goldBright : color.line}`, cursor: on ? "pointer" : "not-allowed" }}>{label}</button>
    );
  };
  let blocker = null;
  if (check.lacksLevel) blocker = `Niveau ${check.minLevel} requis`;
  else if (check.lacksResources) blocker = "Matières manquantes";
  else if (check.lacksGold) blocker = "Or insuffisant";
  return (
    <div {...{ [brew ? "data-brew-recipe" : "data-refine-recipe"]: id }} style={{ background: color.panel, border: `1px solid ${max > 0 ? color.gold + "66" : color.line}`, borderRadius: radius.md, padding: 12, display: "flex", gap: 12, opacity: check.lacksLevel ? 0.6 : 1 }}>
      <div style={{ width: 52, height: 52, flexShrink: 0, borderRadius: radius.sm, background: color.panelRaised, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ResourceIcon resource={out} size={42} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: rc }}>{out.name}</span>
          <span style={{ fontSize: 10, color: color.mist }}>{rec.verb} · +{rec.xp} xp par unité{effect} · vaut {out.value} or · tu en as {player.resources[id] || 0}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {Object.entries(rec.ingredients).map(([resId, qty]) => {
            const res = RESOURCES[resId], have = player.resources[resId] || 0, enough = have >= qty;
            return (
              <div key={resId} title={res.name} style={{ display: "flex", alignItems: "center", gap: 5, padding: "2px 7px 2px 3px", background: color.void, borderRadius: 999, border: `1px solid ${enough ? color.line : color.danger + "99"}` }}>
                <ResourceIcon resource={res} size={20} />
                <span style={{ fontSize: 11, color: enough ? color.parchmentDim : "#d98a8a" }}>{res.name}</span>
                <span style={{ fontSize: 11, fontFamily: font.data, color: enough ? color.success : "#d98a8a" }}>{have}/{qty}</span>
              </div>
            );
          })}
          <span style={{ fontSize: 11, fontFamily: font.data, color: color.goldBright, alignSelf: "center" }}>→ 1 pour {check.fee > 0 ? `${check.fee} or de taxe` : "sans taxe"}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", gap: 6, flexShrink: 0 }}>
        {max > 0 ? (
          <div style={{ display: "flex", gap: 6 }}>{btn(1, "×1")}{max >= 5 && btn(5, "×5")}{max > 1 && max !== 5 && btn(max, `Max (${max})`)}</div>
        ) : <span style={{ fontSize: 11, color: color.mist }}>{blocker}</span>}
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

export default function ForgePanel({ player, city = { key: "aldenmoor", name: "Aldenmoor", rate: 0.01 }, onCraft, onRefine, onBrew, onTestResources, onTestGold }) {
  const fx = { rate: city.rate, city: city.key };                    // la taxe de la ville où l'on fabrique
  const [selected, setSelected] = useState(PROFESSION_ORDER[0]);
  const [flash, setFlash] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Ce qu'une action a vraiment produit (avantages de niveau compris) se lit sur le joueur une fois mis à jour
  const pending = useRef(null);
  useEffect(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    let text = null;
    if (p.type === "craft" && player.inventory.length > p.invLen) {
      const it = player.inventory[player.inventory.length - 1];
      text = isMasterwork(it) ? `✦ Chef-d'œuvre ! ${it.name} — ajouté à ton sac` : `${it.name} fabriqué — ajouté à ton sac`;
    } else if (p.type === "refine") {
      const made = (player.resources[p.id] || 0) - p.have;
      if (made > 0) text = `${RESOURCES[p.id].name} ×${made} produit${made > 1 ? "s" : ""}${made > p.n ? ` (dont ${made - p.n} en bonus de niveau)` : ""} — ajouté${made > 1 ? "s" : ""} à ton sac`;
    }
    if (text) { setFlash(text); clearTimeout(timer.current); timer.current = setTimeout(() => setFlash(null), 3000); }
  }, [player]);

  const handleCraft = (itemId) => {
    pending.current = { type: "craft", invLen: player.inventory.length };
    onCraft(itemId, fx);
  };
  const handleBrew = (id, n) => {
    pending.current = { type: "refine", id, n, have: player.resources[id] || 0 };
    onBrew(id, n, fx);
  };
  const handleRefine = (id, n) => {
    pending.current = { type: "refine", id, n, have: player.resources[id] || 0 };
    onRefine(id, n, fx);
  };

  const kind = PROFESSIONS[selected].kind;
  const brewIds = selected === "alchimiste" ? alchemyOf(selected) : null;
  const gatherNodes = kind === "gather" ? nodesOfProfession(selected) : null;
  const refineIds = kind === "refine" ? refiningOf(selected) : null;
  const recipes = brewIds ? [] : recipesOfProfession(selected);
  const owned = RESOURCE_ORDER.filter((id) => (player.resources[id] || 0) > 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr 300px", gap: 20, height: "100%", minHeight: 0 }}>
      {/* Métiers */}
      <div style={{ background: color.panel, borderRadius: radius.lg, border, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <BannerHeader icon="⚒" title="Métiers" />
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {PROFESSION_ORDER.map((key, i) => {
            const k = PROFESSIONS[key].kind || "craft", prev = i > 0 ? PROFESSIONS[PROFESSION_ORDER[i - 1]].kind || "craft" : null;
            return (
              <React.Fragment key={key}>
                {k !== prev && <div style={{ fontSize: 10, color: color.mist, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: i ? 6 : 0 }}>{{ craft: "Fabrication", gather: "Récolte", refine: "Raffinage" }[k]}</div>}
                <ProfessionButton profession={PROFESSIONS[key]} state={professionOf(player, key)} selected={selected === key} onClick={() => setSelected(key)} />
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Recettes */}
      <div style={{ background: color.panel, borderRadius: radius.lg, border, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <BannerHeader icon={PROFESSIONS[selected].icon} title={PROFESSIONS[selected].name} right={gatherNodes ? `${gatherNodes.length} ressource${gatherNodes.length > 1 ? "s" : ""}` : refineIds ? `${refineIds.length} transformation${refineIds.length > 1 ? "s" : ""}` : brewIds ? `${brewIds.length} potion${brewIds.length > 1 ? "s" : ""}` : `${recipes.length} recette${recipes.length > 1 ? "s" : ""}`} />
        <div style={{ padding: "8px 12px 0", fontSize: 12, color: color.mist }}>{PROFESSIONS[selected].desc}</div>
        <div data-city-tax style={{ margin: "8px 12px 0", padding: "6px 10px", fontSize: 12, color: color.parchmentDim, background: color.void, border, borderRadius: radius.sm }}>
          Atelier de {city.name}{city.place ? ` (tu es en ${city.place})` : ""} · taxe de fabrication <span style={{ fontFamily: font.data, color: color.goldBright }}>{String(Math.round(city.rate * 1000) / 10).replace(".", ",")} %</span> du prix de ce que tu obtiens
          {!city.guild && <span style={{ color: color.mist }}> · aucune guilde ne contrôle encore la ville : taux par défaut</span>}
        </div>
        <div data-perks style={{ margin: "8px 12px 0", padding: "8px 10px", background: color.void, border, borderRadius: radius.sm, display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ fontSize: 10, color: color.mist, textTransform: "uppercase", letterSpacing: "0.08em" }}>Avantages du niveau {professionOf(player, selected).level}</div>
          {perkLines(selected, professionOf(player, selected).level, MAX_PROFESSION_LEVEL).map((l) => (
            <div key={l.label} style={{ display: "flex", gap: 8, fontSize: 12, color: color.parchmentDim, flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 180 }}>{l.label}</span>
              <span data-perk-now style={{ fontFamily: font.data, color: color.goldBright }}>{l.now}</span>
              {l.next && <span style={{ fontFamily: font.data, fontSize: 11, color: color.mist }}>→ {l.next} au niveau {professionOf(player, selected).level + 1}</span>}
            </div>
          ))}
        </div>
        {flash && (
          <div style={{ margin: "8px 12px 0", padding: "6px 10px", fontSize: 12, color: color.success, background: "#5c9c5c18", border: `1px solid ${color.success}66`, borderRadius: radius.sm }}>
            ✔ {flash}
          </div>
        )}
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
          {gatherNodes && gatherNodes.map((n) => <NodeCard key={n.id} node={n} level={professionOf(player, selected).level} />)}
          {refineIds && refineIds.map((id) => <RefineCard key={id} id={id} player={player} fx={fx} onRefine={handleRefine} />)}
          {brewIds && brewIds.map((id) => <RefineCard key={id} id={id} brew player={player} fx={fx} onRefine={handleBrew} />)}
          {!gatherNodes && !refineIds && recipes.map(({ itemId }) => (
            <RecipeCard key={itemId} itemId={itemId} check={canCraft(player, itemId, fx)} onCraft={handleCraft} />
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
