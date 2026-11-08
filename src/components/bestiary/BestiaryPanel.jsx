import React, { useMemo, useState } from "react";
import { color, border, radius, font, shadow } from "../../styles/theme.js";
import { RESOURCES, RESOURCE_RARITIES } from "../../data/resources.js";
import { ITEMS } from "../../data/items.js";
import { CLASSES } from "../../data/classes.js";
import { PARTY_DROP_MULT } from "../../combat/engine.js";
import { ZONES } from "../../data/zones.js";
import { DUNGEONS } from "../../data/dungeons.js";
import {
  GROUP_SIZES, ROLE_LABEL, bestiarySections, dropMultiplier, dropRate, dropVisibleFor, matchesSearch, pct, phasesOf, spellsOf, spellFrequencies,
} from "../../utils/bestiary.js";

// Bestiaire : tous les monstres, leurs caractéristiques, leurs sorts et leur butin — avec les taux de drop calculés
// pour TON bonus de butin et la taille de ton groupe (exactement comme au moment du tirage en combat).

const ITEM_COLOR = { commune: "#9a95a8", rare: "#5fa3c4", epique: "#a855f7", legendaire: "#d9b568" };
const ROLE_COLOR = { monstre: color.mist, miniboss: "#c9a13f", boss: color.bloodBright };
const GROUP_LABEL = { 1: "Solo", 2: "Duo", 3: "Trio" };
const ELEMENT_COLOR = { feu: color.fire, poison: color.poison, givre: color.frost };
const mult = (x) => `×${(Math.round(x * 100) / 100).toString().replace(".", ",")}`;
const num = (n) => Math.round(n).toLocaleString("fr-FR");

const SECTION_INFO = (() => {
  const info = {};
  for (const r of ZONES.aldenmoor.regions) info[r.key] = r.levels;
  info.manoir = DUNGEONS.manoir_englouti.levels;
  info.manoir_difficile = DUNGEONS.manoir_englouti.levels;
  return info;
})();

function dropInfo(d) {
  if (d.type === "resource") {
    const r = RESOURCES[d.id];
    return { name: r.name, img: r.img, color: RESOURCE_RARITIES[r.rarity]?.color || color.mist, rarityLabel: RESOURCE_RARITIES[r.rarity]?.label || "", kind: "Ressource" };
  }
  const it = ITEMS[d.id];
  return { name: it.name, img: it.img, color: ITEM_COLOR[it.rarity] || color.parchmentDim, rarityLabel: it.rarity === "legendaire" ? "Légendaire" : it.rarity === "epique" ? "Épique" : it.rarity === "rare" ? "Rare" : "Commune", kind: "Équipement" };
}

function Portrait({ src, name, size, glow }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div style={{ width: size, height: size, borderRadius: radius.md, background: color.panelRaised, display: "flex", alignItems: "center", justifyContent: "center", color: color.mist, fontFamily: font.display, fontSize: size * 0.4 }}>{name[0]}</div>;
  }
  return <img src={src} alt={name} onError={() => setFailed(true)} draggable={false} style={{ width: size, height: size, objectFit: "contain", display: "block", filter: glow ? `drop-shadow(0 6px 14px rgba(0,0,0,.7))` : "none" }} />;
}

function Pill({ children, c = color.mist, title }) {
  return <span title={title} style={{ fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: c, border: `1px solid ${c}66`, background: `${c}18`, borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>{children}</span>;
}

// ---------- barre du haut : groupe, bonus, recherche ----------
function Controls({ dropBonus, group, onGroup, query, onQuery }) {
  const total = dropMultiplier(dropBonus, group);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 14 }}>
      <input
        data-bestiary-search value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Chercher un monstre ou un butin…"
        style={{ flex: "1 1 220px", maxWidth: 320, background: color.panel, border, borderRadius: radius.md, color: color.parchment, padding: "8px 12px", fontSize: 13, fontFamily: font.body, outline: "none" }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: color.mist, textTransform: "uppercase", letterSpacing: "0.06em" }}>Je chasse en</span>
        <div style={{ display: "flex", background: color.panel, border, borderRadius: radius.md, overflow: "hidden" }}>
          {GROUP_SIZES.map((n) => (
            <button
              key={n} data-group-btn={n} onClick={() => onGroup(n)}
              title={n === 1 ? "Seul : pas de bonus de groupe, mais +25 % d'XP" : `Groupe de ${n} héros : ${mult(PARTY_DROP_MULT[n])} sur le butin`}
              style={{ padding: "7px 14px", fontSize: 12, fontFamily: font.body, cursor: "pointer", border: "none", background: group === n ? color.gold : "transparent", color: group === n ? color.void : color.parchmentDim, fontWeight: group === n ? 700 : 500 }}
            >{GROUP_LABEL[n]}</button>
          ))}
        </div>
      </div>
      <div
        data-bestiary-mult
        title="Bonus de butin du personnage × bonus de groupe. Il multiplie la chance de chaque butin ordinaire (les butins à taux fixe ne changent pas)."
        style={{ fontSize: 12, color: color.parchmentDim, background: color.panel, border, borderRadius: radius.md, padding: "7px 12px" }}
      >
        Bonus de butin <b style={{ color: color.gold, fontFamily: font.data }}>+{(dropBonus || 0).toFixed(1).replace(".", ",")} %</b>
        {group > 1 && <> · groupe <b style={{ color: color.gold, fontFamily: font.data }}>{mult(PARTY_DROP_MULT[group])}</b></>}
        {" "}= chances <b style={{ color: color.goldBright, fontFamily: font.data }}>{mult(total)}</b>
      </div>
    </div>
  );
}

// ---------- liste de gauche ----------
function EntryRow({ e, active, onClick }) {
  const rc = ROLE_COLOR[e.role];
  return (
    <button
      data-bestiary-entry={e.key} onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: font.body,
        padding: "6px 10px", borderRadius: radius.md, border: active ? `1px solid ${color.gold}` : "1px solid transparent",
        background: active ? color.panelRaised : "transparent", color: active ? color.goldBright : color.parchment,
      }}
      onMouseEnter={(ev) => { if (!active) ev.currentTarget.style.background = color.panelRaised; }}
      onMouseLeave={(ev) => { if (!active) ev.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: radius.md, background: color.void, border: `1px solid ${rc}55`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        <Portrait src={e.enemy.img} name={e.enemy.name} size={40} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.enemy.name.replace(" (difficile)", "")}</div>
        <div style={{ fontSize: 10, color: e.role === "monstre" ? color.mist : rc, textTransform: "uppercase", letterSpacing: "0.06em" }}>{ROLE_LABEL[e.role]}</div>
      </div>
    </button>
  );
}

// ---------- fiche : caractéristiques ----------
function StatCell({ label, value, c = color.parchment, dim }) {
  return (
    <div style={{ background: color.void, border, borderRadius: radius.md, padding: "8px 10px", opacity: dim ? 0.45 : 1 }}>
      <div style={{ fontSize: 10, color: color.mist, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontFamily: font.data, fontSize: 16, color: c, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Section({ title, hint, children }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10, borderBottom: `1px solid ${color.line}`, paddingBottom: 6 }}>
        <span style={{ fontFamily: font.display, fontSize: 15, color: color.goldBright }}>{title}</span>
        {hint && <span style={{ fontSize: 11, color: color.mist }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ---------- fiche : sorts ----------
function SpellCard({ sp, freq, twoPhases }) {
  const tc = sp.type === "mag" ? color.mag : color.phys;
  const ec = ELEMENT_COLOR[sp.element];
  return (
    <div data-spell={sp.id} style={{ background: color.void, border, borderLeft: `3px solid ${ec || tc}`, borderRadius: radius.md, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: color.parchment }}>{sp.name}</span>
        <Pill c={tc}>{sp.type === "mag" ? "Magique" : "Physique"}</Pill>
        <span style={{ marginLeft: "auto", fontFamily: font.data, fontSize: 12, color: color.gold }} title="Points d'action dépensés par le monstre">{sp.pa} PA</span>
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 11, color: color.parchmentDim, flexWrap: "wrap" }}>
        <span title="Multiplie l'attaque du monstre">Puissance <b style={{ fontFamily: font.data, color: color.parchment }}>{mult(sp.power)}</b></span>
        <span title="Part de ses tours où il choisit ce sort (parmi ceux qu'il peut payer)">Fréquence <b style={{ fontFamily: font.data, color: color.parchment }}>{Math.round((sp.belowHp != null ? freq.second : freq.first) * 100)} %</b>{twoPhases && sp.belowHp == null && <span style={{ color: color.mist }}> ({Math.round(freq.second * 100)} % en seconde phase)</span>}</span>
        {sp.belowHp != null && <Pill c={color.bloodBright} title="Ce sort n'apparaît qu'en seconde phase du combat">Sous {sp.belowHp} % de PV</Pill>}
      </div>
      {sp.text && <div style={{ marginTop: 6, fontSize: 12, color: ec || color.parchment }}>{sp.text}</div>}
    </div>
  );
}

// ---------- fiche : butin ----------
function DropRow({ d, dropBonus, group, classKey }) {
  const info = dropInfo(d);
  const r = dropRate(d, dropBonus, group);
  const mine = dropVisibleFor(d, classKey);
  const rare = d.chance < 0.05;
  const qty = d.min === d.max ? `×${d.min}` : `×${d.min}–${d.max}`;
  const tip = r.fixed
    ? `Taux fixe : ni ton bonus de butin ni le groupe ne le modifient (${pct(r.base)} à chaque combat).`
    : `Base ${pct(r.base)}${r.boosted ? ` → ${pct(r.rate)} avec ton bonus${group > 1 ? " et ton groupe" : ""}` : " (aucun bonus actif)"}${r.capped ? " — plafonné à 100 %" : ""}.`;
  return (
    <div data-drop-row={d.id} title={tip} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", background: color.void, border: `1px solid ${info.color}33`, borderRadius: radius.md, opacity: mine ? 1 : 0.5 }}>
      <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: radius.md, background: color.panelRaised, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {info.img ? <img src={info.img} alt="" width={32} height={32} style={{ objectFit: "contain" }} draggable={false} /> : <span style={{ color: color.mist }}>?</span>}
      </div>
      <div style={{ minWidth: 0, flex: "1 1 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: info.color }}>{info.name}</span>
          <span style={{ fontFamily: font.data, fontSize: 11, color: color.mist }}>{qty}</span>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
          <Pill c={info.color}>{info.rarityLabel}</Pill>
          {d.forClass && <Pill c={mine ? color.success : color.mist} title="Arme unique, réservée à une classe">{CLASSES[d.forClass]?.label || d.forClass} uniquement</Pill>}
          {r.fixed && <Pill c={color.frost} title="Le bonus de butin ne s'applique pas à ce drop">Taux fixe</Pill>}
          {rare && !r.fixed && /commune/i.test(info.rarityLabel) && <Pill c="#c9a13f">Très rare</Pill>}
        </div>
      </div>
      <div style={{ width: 150, flexShrink: 0 }}>
        <div style={{ textAlign: "right", lineHeight: 1.1 }}>
          <span data-drop-rate style={{ fontFamily: font.data, fontSize: 18, fontWeight: 700, color: r.boosted ? color.goldBright : color.parchment }}>{pct(r.rate)}</span>
          {r.boosted && <div style={{ fontSize: 10, color: color.mist, fontFamily: font.data, marginTop: 2 }}>base {pct(r.base)}</div>}
        </div>
        <div style={{ height: 5, borderRadius: 3, background: color.line, marginTop: 5, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, width: `${Math.max(2, r.rate * 100)}%`, background: r.boosted ? `linear-gradient(90deg, ${info.color}, ${color.goldBright})` : info.color, borderRadius: 3 }} />
          {r.boosted && <div style={{ position: "absolute", inset: 0, width: `${Math.max(1.5, r.base * 100)}%`, background: "rgba(0,0,0,.45)", borderRadius: 3 }} />}
        </div>
      </div>
    </div>
  );
}

// ---------- fiche complète ----------
function Detail({ entry, dropBonus, group, classKey }) {
  const e = entry.enemy, st = e.stats, rc = ROLE_COLOR[entry.role];
  const spells = spellsOf(e), freq = spellFrequencies(e);
  const drops = [...(e.drops || [])].sort((a, b) => b.chance - a.chance);   // du plus fréquent au plus rare
  const soloXp = group === 1;
  const xp = Math.round(e.xp * (soloXp ? 1.25 : 1));
  const phases = phasesOf(e);
  return (
    <div data-bestiary-detail={e.key}>
      <div style={{ display: "flex", gap: 20, alignItems: "center", background: `radial-gradient(ellipse at 20% 50%, ${rc}22, ${color.panel} 70%)`, border, borderRadius: radius.lg, padding: 16, boxShadow: shadow.panel, flexWrap: "wrap" }}>
        <div style={{ width: 190, height: 190, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `radial-gradient(circle, ${color.panelRaised}, ${color.void})`, borderRadius: radius.lg, border: `1px solid ${rc}55` }}>
          <Portrait src={e.img} name={e.name} size={170} glow />
        </div>
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Pill c={rc}>{ROLE_LABEL[entry.role]}</Pill>
            {e.hard && <Pill c={color.bloodBright}>Difficile</Pill>}
          </div>
          <div style={{ fontFamily: font.display, fontSize: 26, color: color.goldBright, margin: "6px 0 8px" }}>{e.name.replace(" (difficile)", "")}</div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: color.parchmentDim }}>{e.desc}</div>
          <div style={{ display: "flex", gap: 18, marginTop: 12, flexWrap: "wrap", fontSize: 12, color: color.parchmentDim }}>
            <span title={soloXp ? "Seul : +25 % d'XP" : "En groupe, l'XP du monstre est inchangée"}>XP <b style={{ fontFamily: font.data, color: color.parchment, fontSize: 15 }}>{num(xp)}</b>{soloXp && <span style={{ color: color.mist }}> (solo +25 %)</span>}</span>
            <span>Or <b style={{ fontFamily: font.data, color: "#d9b568", fontSize: 15 }}>{e.gold ? `${num(e.gold[0])}–${num(e.gold[1])}` : "—"}</b></span>
          </div>
        </div>
      </div>

      <Section title="Caractéristiques">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))", gap: 8 }}>
          <StatCell label="Points de vie" value={num(st.hp)} c={color.bloodBright} />
          <StatCell label="Attaque phys." value={num(st.atkPhys)} c={color.phys} dim={!st.atkPhys} />
          <StatCell label="Attaque magie" value={num(st.atkMagie)} c={color.mag} dim={!st.atkMagie} />
          <StatCell label="Défense phys." value={num(st.defPhys)} />
          <StatCell label="Défense magie" value={num(st.defMagie)} />
          <StatCell label="Esquive" value={`${st.esquive} %`} dim={!st.esquive} />
          <StatCell label="Critique" value={`${st.critique} %`} />
          <StatCell label="Vitesse" value={st.vitesse} />
          <StatCell label="Points d'action" value={st.pa} c={color.gold} />
        </div>
        {phases.map((ph, i) => (
          <div key={i} data-phase style={{ marginTop: 10, fontSize: 12, color: color.parchmentDim, background: `${color.bloodBright}14`, border: `1px solid ${color.bloodBright}55`, borderRadius: radius.md, padding: "8px 12px" }}>
            <b style={{ color: color.bloodBright }}>{phases.length > 1 ? `Phase ${i + 2}` : "Seconde phase"}</b> sous {ph.below} % de PV : {ph.lines.join(" ; ")}.
            {ph.announce && <i style={{ color: color.mist }}> « {ph.announce} »</i>}
          </div>
        ))}
      </Section>

      <Section title="Sorts" hint={`${spells.length} attaque${spells.length > 1 ? "s" : ""} — il en choisit une au hasard parmi celles qu'il peut payer`}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
          {spells.map((sp) => <SpellCard key={sp.id} sp={sp} freq={freq[sp.id]} twoPhases={spells.some((x) => x.belowHp != null)} />)}
        </div>
      </Section>

      <Section title="Butin" hint={`Chances par combat — ${group === 1 ? "en solo" : `en ${GROUP_LABEL[group].toLowerCase()}`}, avec ton bonus de butin`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {drops.map((d, i) => <DropRow key={`${d.id}${i}`} d={d} dropBonus={dropBonus} group={group} classKey={classKey} />)}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: color.mist, lineHeight: 1.5 }}>
          Chaque chance de base est multipliée par ton bonus de butin et par le bonus de groupe (duo {mult(PARTY_DROP_MULT[2])}, trio {mult(PARTY_DROP_MULT[3])}), puis plafonnée à 100 %.
          Les butins « taux fixe » ne bougent pas. Les armes uniques ne tombent que pour leur classe. Les renforts appelés en combat ne donnent rien.
        </div>
      </Section>
    </div>
  );
}

export default function BestiaryPanel({ player, stats }) {
  const sections = useMemo(() => bestiarySections(), []);
  const [selected, setSelected] = useState(sections[0].entries[0].key);
  const [group, setGroup] = useState(1);
  const [query, setQuery] = useState("");
  const dropBonus = stats?.dropBonus || 0;
  const nameOfDrop = (d) => dropInfo(d).name;

  const all = sections.flatMap((s) => s.entries);
  const current = all.find((e) => e.key === selected) || all[0];
  const shown = sections
    .map((s) => ({ ...s, entries: s.entries.filter((e) => matchesSearch(e.enemy, query, nameOfDrop)) }))
    .filter((s) => s.entries.length);

  return (
    <div data-bestiary style={{ height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box", minHeight: 0 }}>
      <div style={{ fontFamily: font.display, fontSize: 22, color: color.goldBright, marginBottom: 12 }}>Bestiaire</div>
      <Controls dropBonus={dropBonus} group={group} onGroup={setGroup} query={query} onQuery={setQuery} />
      <div style={{ flex: 1, display: "flex", gap: 16, minHeight: 0 }}>
        <div data-bestiary-list style={{ width: 268, flexShrink: 0, overflowY: "auto", background: color.panel, border, borderRadius: radius.lg, padding: 8 }}>
          {shown.length === 0 && <div style={{ padding: 18, fontSize: 12, color: color.mist, textAlign: "center" }}>Aucun monstre ni butin ne correspond.</div>}
          {shown.map((s) => (
            <div key={s.id} style={{ marginBottom: 8 }}>
              <div style={{ padding: "8px 10px 4px", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: font.display, fontSize: 13, color: color.gold }}>{s.name}</span>
                <span style={{ fontSize: 10, color: color.mist, whiteSpace: "nowrap" }}>{SECTION_INFO[s.id]}</span>
              </div>
              {s.entries.map((e) => <EntryRow key={e.key} e={e} active={e.key === current.key} onClick={() => setSelected(e.key)} />)}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto", paddingRight: 4, paddingBottom: 24 }}>
          <Detail entry={current} dropBonus={dropBonus} group={group} classKey={player?.classKey} />
        </div>
      </div>
    </div>
  );
}
