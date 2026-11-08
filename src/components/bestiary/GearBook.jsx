import React, { useMemo, useState } from "react";
import { color, border, radius, font, shadow } from "../../styles/theme.js";
import { RESOURCES, RESOURCE_RARITIES } from "../../data/resources.js";
import { ITEMS, SETS } from "../../data/items.js";
import { CLASSES } from "../../data/classes.js";
import { dropRate, pct } from "../../utils/bestiary.js";
import { isUpgradable } from "../../utils/upgrade.js";
import {
  SLOT_LABEL, itemStats, setClass, classLabel, setTier, setTotals, recipeOf, resourceSources, itemDrops, gearSections, gearMatches, weaponLabel,
} from "../../utils/gearbook.js";
import { ITEM_COLOR, Portrait, Pill, StatCell, Section, num } from "./parts.jsx";

// Équipements : tous les sets, armes, boucliers, accessoires et reliques, avec leurs stats, leur recette de fabrication
// (ressources, métier, niveau) et d'où viennent ces ressources. Les pourcentages de butin suivent ton bonus et ton groupe.

const RARITY_LABEL = { commune: "Commune", rare: "Rare", epique: "Épique", legendaire: "Légendaire" };
const itemColor = (it) => ITEM_COLOR[it.rarity] || color.parchmentDim;
const resColor = (r) => RESOURCE_RARITIES[r.rarity]?.color || color.mist;
const nameOf = (id) => RESOURCES[id]?.name || id;

function EntryRow({ item, active, onClick }) {
  const c = itemColor(item);
  return (
    <button
      data-gear-entry={item.id} onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: font.body,
        padding: "5px 10px", borderRadius: radius.md, border: active ? `1px solid ${color.gold}` : "1px solid transparent",
        background: active ? color.panelRaised : "transparent", color: active ? color.goldBright : color.parchment,
      }}
      onMouseEnter={(ev) => { if (!active) ev.currentTarget.style.background = color.panelRaised; }}
      onMouseLeave={(ev) => { if (!active) ev.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ width: 38, height: 38, flexShrink: 0, borderRadius: radius.md, background: color.void, border: `1px solid ${c}55`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Portrait src={item.img} name={item.name} size={32} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: active ? color.goldBright : c }}>{item.name}</div>
        <div style={{ fontSize: 10, color: color.mist, textTransform: "uppercase", letterSpacing: "0.06em" }}>{item.type === "arme" ? weaponLabel(item) : SLOT_LABEL[item.type]}</div>
      </div>
    </button>
  );
}

// D'où vient une ressource, en une ligne claire
function SourceLine({ s, dropBonus, group }) {
  const sub = { fontSize: 11, color: color.mist };
  if (s.kind === "refine") {
    return (
      <>
        <span style={sub}>⚒ {s.verb} {s.inputs.map((i) => `${i.qty} × ${nameOf(i.id)}`).join(", ")} <span style={{ color: color.parchmentDim }}>({s.profession} niv. {s.minLevel})</span></span>
        {s.inputs.map((i) => (
          <span key={i.id} style={{ ...sub, paddingLeft: 16 }}>↳ {nameOf(i.id)} : {resourceSources(i.id).slice(0, 3).map((x) => x.kind === "gather" ? `récolte (${x.node})` : x.kind === "drop" ? `${x.name} ${pct(dropRate(x.drop, dropBonus, group).rate)}` : "raffinage").join(" · ") || "marché"}</span>
        ))}
      </>
    );
  }
  if (s.kind === "gather") return <span style={sub}>🌿 Récolte : {s.node} <span style={{ color: color.parchmentDim }}>({s.profession} niv. {s.minLevel})</span></span>;
  const r = dropRate(s.drop, dropBonus, group);
  return <span style={sub}>🐾 {s.name} <b style={{ color: r.boosted ? color.goldBright : color.parchmentDim, fontFamily: font.data }}>{pct(r.rate)}</b></span>;
}

function IngredientRow({ ing, owned, dropBonus, group }) {
  const r = RESOURCES[ing.id];
  const c = resColor(r), have = owned || 0, enough = have >= ing.qty;
  const sources = resourceSources(ing.id);
  const drops = sources.filter((s) => s.kind === "drop"), others = sources.filter((s) => s.kind !== "drop");
  const shown = [...others, ...drops.slice(0, 3)];
  return (
    <div data-ingredient={ing.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", background: color.void, border: `1px solid ${c}33`, borderRadius: radius.md }}>
      <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: radius.md, background: color.panelRaised, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Portrait src={r.img} name={r.name} size={32} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: c }}>{r.name}</span>
          <Pill c={c}>{RESOURCE_RARITIES[r.rarity]?.label}</Pill>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 3 }}>
          {shown.map((s, i) => <SourceLine key={i} s={s} dropBonus={dropBonus} group={group} />)}
          {drops.length > 3 && <span style={{ fontSize: 11, color: color.mist }}>… et {drops.length - 3} autre{drops.length - 3 > 1 ? "s" : ""} monstre{drops.length - 3 > 1 ? "s" : ""}</span>}
          {shown.length === 0 && <span style={{ fontSize: 11, color: color.mist }}>Marché d'Aldenmoor</span>}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }} title="Quantité demandée par la recette (et ce que tu as dans ton sac)">
        <div style={{ fontFamily: font.data, fontSize: 18, fontWeight: 700, color: color.parchment }}>×{ing.qty}</div>
        <div style={{ fontFamily: font.data, fontSize: 11, color: enough ? color.success : color.mist }}>{have} en sac</div>
      </div>
    </div>
  );
}

function SetBlock({ set, currentId, onPick }) {
  const totals = setTotals(set);
  return (
    <Section title={set.name} hint={`${set.pieces.length} pièces · palier ${setTier(set)}${setClass(set) ? ` · ${classLabel(setClass(set))}` : ""}`}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {set.pieces.map((id) => {
          const it = ITEMS[id], on = id === currentId, c = itemColor(it);
          return (
            <button key={id} data-set-piece={id} onClick={() => onPick(id)} title={`${it.name} — ${SLOT_LABEL[it.type]}`}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, width: 84, padding: "8px 4px", cursor: "pointer", background: on ? color.panelRaised : color.void, border: on ? `1px solid ${color.gold}` : `1px solid ${c}33`, borderRadius: radius.md, fontFamily: font.body }}>
              <Portrait src={it.img} name={it.name} size={40} />
              <span style={{ fontSize: 10, color: on ? color.goldBright : color.parchmentDim, textTransform: "uppercase", letterSpacing: "0.05em" }}>{SLOT_LABEL[it.type]}</span>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: color.parchmentDim }}>
        <span style={{ color: color.mist }}>Total des 5 pièces :</span>
        {totals.map((t) => <span key={t.key}>{t.label} <b style={{ fontFamily: font.data, color: color.parchment }}>+{t.value}{t.suffix}</b></span>)}
      </div>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
        {Object.entries(set.bonuses).map(([n, b]) => (
          <div key={n} style={{ fontSize: 12, color: color.parchmentDim, background: `${set.color}12`, border: `1px solid ${set.color}55`, borderRadius: radius.md, padding: "7px 12px" }}>
            <b style={{ color: set.color }}>{n} pièces</b> : {b.desc}
          </div>
        ))}
      </div>
    </Section>
  );
}

function Detail({ item, player, dropBonus, group, onPick }) {
  const c = itemColor(item);
  const recipe = recipeOf(item.id), drops = itemDrops(item.id), stats = itemStats(item);
  const set = item.set ? SETS[item.set] : null;
  const cls = item.classKey || (set && setClass(set));
  return (
    <div data-gear-detail={item.id}>
      <div style={{ display: "flex", gap: 20, alignItems: "center", background: `radial-gradient(ellipse at 20% 50%, ${c}22, ${color.panel} 70%)`, border, borderRadius: radius.lg, padding: 16, boxShadow: shadow.panel, flexWrap: "wrap" }}>
        <div style={{ width: 150, height: 150, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(circle, ${color.panelRaised}, ${color.void})`, borderRadius: radius.lg, border: `1px solid ${c}55` }}>
          <Portrait src={item.img} name={item.name} size={110} glow />
        </div>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Pill c={c}>{RARITY_LABEL[item.rarity]}</Pill>
            <Pill c={color.mist}>{item.type === "arme" ? `${weaponLabel(item)}${item.twoHanded ? " · deux mains" : ""}` : SLOT_LABEL[item.type]}</Pill>
            {cls && <Pill c={color.success}>{CLASSES[cls]?.label || cls}</Pill>}
            {item.tier && <Pill c={color.gold}>Palier {item.tier}</Pill>}
          </div>
          <div style={{ fontFamily: font.display, fontSize: 24, color: color.goldBright, margin: "8px 0 4px" }}>{item.name}</div>
          {set && <div style={{ fontSize: 12, color: set.color }}>Pièce du set « {set.name} »</div>}
          {item.desc && <div style={{ fontSize: 12, color: color.parchmentDim, marginTop: 6 }}>{item.desc}</div>}
        </div>
      </div>

      <Section title="Caractéristiques">
        {stats.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
            {stats.map((s) => <StatCell key={s.key} label={s.label} value={`+${s.value}${s.suffix}`} c={color.parchment} />)}
          </div>
        )}
        {item.passiveDesc && <div style={{ marginTop: 8, fontSize: 12, color: color.goldBright, background: `${color.gold}14`, border: `1px solid ${color.gold}55`, borderRadius: radius.md, padding: "8px 12px" }}>{item.passiveDesc}</div>}
        {isUpgradable(item) && <div style={{ marginTop: 8, fontSize: 11, color: color.mist }}>Chaque amélioration (+1 à +3, à l'atelier) ajoute 10 % à ces valeurs.</div>}
      </Section>

      {recipe ? (
        <Section title="Fabrication" hint={`${recipe.icon} ${recipe.profession}, niveau ${recipe.minLevel} requis · main-d'œuvre ${num(recipe.gold)} or (la taxe de la ville s'ajoute)`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recipe.ingredients.map((ing) => <IngredientRow key={ing.id} ing={ing} owned={player?.resources?.[ing.id]} dropBonus={dropBonus} group={group} />)}
          </div>
        </Section>
      ) : (
        <Section title="Comment l'obtenir" hint="Ne se fabrique pas : il tombe sur certains monstres">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {drops.map((m) => {
              const r = dropRate(m.drop, dropBonus, group), mine = !m.drop.forClass || m.drop.forClass === player?.classKey;
              return (
                <div key={m.key} data-item-source={m.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: color.void, border, borderRadius: radius.md, opacity: mine ? 1 : 0.5 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: color.parchment, flex: 1 }}>🐾 {m.name}</span>
                  {m.drop.fixed && <Pill c={color.frost} title="Le bonus de butin ne s'applique pas">Taux fixe</Pill>}
                  {m.drop.forClass && <Pill c={mine ? color.success : color.mist}>{CLASSES[m.drop.forClass]?.label} uniquement</Pill>}
                  <span style={{ fontFamily: font.data, fontSize: 16, fontWeight: 700, color: r.boosted ? color.goldBright : color.parchment }}>{pct(r.rate)}</span>
                  {r.boosted && <span style={{ fontFamily: font.data, fontSize: 10, color: color.mist }}>base {pct(r.base)}</span>}
                </div>
              );
            })}
            {drops.length === 0 && <div style={{ fontSize: 12, color: color.mist }}>Aucune source connue pour l'instant.</div>}
          </div>
        </Section>
      )}

      {set && <SetBlock set={set} currentId={item.id} onPick={onPick} />}
    </div>
  );
}

export default function GearBook({ player, dropBonus, group, query }) {
  const sections = useMemo(() => gearSections(), []);
  const [selected, setSelected] = useState(sections[0].entries[0].key);
  const all = sections.flatMap((s) => s.entries);
  const current = (all.find((e) => e.key === selected) || all[0]).item;
  const shown = sections.map((s) => ({ ...s, entries: s.entries.filter((e) => gearMatches(e.item, query)) })).filter((s) => s.entries.length);
  return (
    <div data-gearbook style={{ flex: 1, display: "flex", gap: 16, minHeight: 0 }}>
      <div data-gear-list style={{ width: 268, flexShrink: 0, overflowY: "auto", background: color.panel, border, borderRadius: radius.lg, padding: 8 }}>
        {shown.length === 0 && <div style={{ padding: 18, fontSize: 12, color: color.mist, textAlign: "center" }}>Aucun équipement ne correspond.</div>}
        {shown.map((s) => (
          <div key={s.id} style={{ marginBottom: 8 }}>
            <div style={{ padding: "8px 10px 4px", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: font.display, fontSize: 13, color: s.set?.color || color.gold }}>{s.name}</span>
              <span style={{ fontSize: 10, color: color.mist, whiteSpace: "nowrap" }}>{s.entries.length} {s.entries.length > 1 ? "pièces" : "pièce"}</span>
            </div>
            {s.hint && <div style={{ padding: "0 10px 4px", fontSize: 10, color: color.mist }}>{s.hint}</div>}
            {s.entries.map((e) => <EntryRow key={e.key} item={e.item} active={e.key === current.id} onClick={() => setSelected(e.key)} />)}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", paddingRight: 4, paddingBottom: 24 }}>
        <Detail item={current} player={player} dropBonus={dropBonus} group={group} onPick={setSelected} />
      </div>
    </div>
  );
}
