import React, { useState } from "react";
import { color, border, radius, font } from "../../styles/theme.js";
import { CLASSES } from "../../data/classes.js";
import {
  MAX_RANK, classSlots, loadoutOf, rankOf, rankSpell, rankCost, weaponSpellOf,
  spellPointsLeft, spellPointsTotal, resetCost,
} from "../../utils/spellbook.js";

const typeColor = (sp) => (sp.type === "mag" ? color.mag : sp.type === "buff" ? color.frost : color.phys);
const small = { fontSize: 11, color: color.mist, textTransform: "uppercase", letterSpacing: ".08em" };

// Grimoire : barre de combat (emplacements), rangs des sorts et points de sort
export default function SpellsPanel({ player, spellbook }) {
  const cls = CLASSES[player.classKey];
  const [slot, setSlot] = useState(null);           // emplacement choisi dans la barre
  if (!cls) return null;

  const weapon = player.equipped.arme;
  const weaponSpell = weaponSpellOf(player);
  const slots = classSlots(player.level);
  const bar = loadoutOf(player);
  const byId = Object.fromEntries(cls.spells.map((s) => [s.id, s]));
  const points = spellPointsLeft(player);
  const reset = resetCost(player);
  const canChoose = cls.spells.filter((s) => s.level <= player.level).length > bar.length;   // plus de sorts que de places

  const equipHere = (id) => { if (slot === null) return; spellbook.equip(slot, id); setSlot(null); };

  return (
    <div data-spellbook style={{ background: color.panel, border, borderRadius: radius.lg, padding: 16, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
        <div style={{ fontFamily: font.display, color: color.goldBright, fontSize: 15 }}>Sorts — {cls.label}</div>
        <div style={{ fontSize: 12, color: color.parchmentDim }}>
          Points de sort : <b data-points style={{ color: points > 0 ? color.goldBright : color.mist }}>{points}</b> / {spellPointsTotal(player.level)}
          {reset > 0 && (
            <button data-act="reset" disabled={player.gold < reset} onClick={() => { if (window.confirm(`Remettre tous les rangs à 1 pour ${reset} or ? Les points sont rendus.`)) spellbook.reset(); }}
              title="Rend tous les points de sort" style={{ ...linkBtn, marginLeft: 10, opacity: player.gold < reset ? 0.5 : 1 }}>Réinitialiser ({reset} or)</button>
          )}
        </div>
      </div>
      <div style={{ fontSize: 11, color: color.mist, marginBottom: 10 }}>
        1 point de sort par niveau. Monter un sort du rang r au rang r+1 coûte r points ; chaque rang renforce ses effets (+8 % de dégâts…), et le rang {MAX_RANK} réduit son coût de 1 PA.
      </div>

      {/* Barre de combat */}
      <div style={{ ...small, marginBottom: 6 }}>Barre de combat</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
        <div title="Le sort de l'arme équipée est toujours dans la barre" style={{ ...chip(false), borderColor: color.line, cursor: "default" }}>
          <span style={{ color: color.mist, fontSize: 10 }}>Arme</span>
          <span style={{ color: color.parchment }}>{weaponSpell.name}</span>
        </div>
        {Array.from({ length: slots }, (_, i) => {
          const sp = byId[bar[i]];
          const on = slot === i;
          return (
            <button key={i} data-slot={i} disabled={!sp || !canChoose} onClick={() => setSlot(on ? null : i)} title={canChoose ? "Choisis cet emplacement, puis le sort à y placer" : "Tous tes sorts sont déjà dans la barre"} style={chip(on)}>
              <span style={{ color: color.mist, fontSize: 10 }}>{i + 1}</span>
              <span style={{ color: sp ? color.parchment : color.line }}>{sp ? sp.name : "vide"}</span>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: color.mist, marginBottom: 10 }}>
        {canChoose
          ? (slot === null ? "Tu as plus de sorts que de places : clique sur un emplacement, puis sur « Placer » à côté du sort voulu." : `Emplacement ${slot + 1} choisi : clique sur « Placer » à côté du sort voulu.`)
          : `${slots} emplacements de classe (un de plus aux niveaux 10 et 25).`}
      </div>

      {/* Sort d'arme */}
      <div style={{ ...small, margin: "10px 0 6px" }}>Arme</div>
      {weapon
        ? <Row sp={weaponSpell} tag={weapon.name} player={player} spellbook={spellbook} points={points} />
        : <div style={{ fontSize: 12, color: color.mist, marginBottom: 7 }}>Aucune arme équipée : seul le coup de poing est disponible.</div>}

      {/* Sorts de classe */}
      <div style={{ ...small, margin: "10px 0 6px" }}>Classe</div>
      {cls.spells.map((sp) => {
        const locked = sp.level > player.level;
        const inBar = bar.includes(sp.id);
        return <Row key={sp.id} sp={sp} level={sp.level} locked={locked} inBar={inBar} player={player} spellbook={spellbook} points={points}
          onPlace={!locked && canChoose && !inBar && slot !== null ? () => equipHere(sp.id) : null} swapHint={!locked && canChoose && !inBar} />;
      })}
    </div>
  );
}

function Row({ sp, level, tag, locked, inBar, player, spellbook, points, onPlace, swapHint }) {
  const rank = locked ? 1 : rankOf(player, sp.id);
  const shown = rankSpell(sp, rank);
  const cost = rankCost(rank);
  const maxed = rank >= MAX_RANK;
  const canRank = !locked && !maxed && points >= cost;
  return (
    <div data-spell={sp.id} data-rank={rank} style={{ fontSize: 12, color: locked ? color.mist : color.parchmentDim, borderLeft: `3px solid ${locked ? color.line : typeColor(sp)}`, paddingLeft: 8, marginBottom: 8, opacity: locked ? 0.75 : 1, display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: locked ? color.mist : color.parchment, fontWeight: 600 }}>{sp.name}</span>
        <span style={{ color: color.gold }}> · {shown.pa} PA{shown.pa < sp.pa ? ` (au lieu de ${sp.pa})` : ""}</span>
        {level && <span style={{ color: color.goldBright }}> · niveau {level}</span>}
        {tag && <span style={{ color: color.mist }}> · {tag}</span>}
        {sp.exclusive && <span style={{ color: color.blood }}> · exclusif</span>}
        {inBar && <span style={{ color: color.success }}> · dans la barre</span>}
        <div style={{ fontSize: 11 }}>{sp.desc}</div>
        {!locked && <div style={{ fontSize: 11, color: color.mist }}>{rankLine(sp, shown)}</div>}
      </div>
      {!locked && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flex: "none" }}>
          <div title={`Rang ${rank} sur ${MAX_RANK}`} style={{ letterSpacing: 2, color: color.goldBright, fontSize: 12 }}>{"●".repeat(rank)}<span style={{ color: color.line }}>{"●".repeat(MAX_RANK - rank)}</span></div>
          <div style={{ display: "flex", gap: 6 }}>
            {swapHint && <button data-act="place" disabled={!onPlace} onClick={onPlace} style={{ ...linkBtn, opacity: onPlace ? 1 : 0.4 }}>Placer</button>}
            <button data-act="rank" disabled={!canRank} onClick={() => spellbook.rankUp(sp.id)} title={maxed ? "Rang maximum" : `Coûte ${cost} point${cost > 1 ? "s" : ""} de sort`} style={{ ...linkBtn, opacity: canRank ? 1 : 0.4 }}>
              {maxed ? "Rang max" : `Rang ${rank + 1} (${cost} pt${cost > 1 ? "s" : ""})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Résumé chiffré du sort à son rang actuel (ce qui change vraiment quand on monte de rang)
function rankLine(base, s) {
  const bits = [];
  if (s.power) bits.push(`puissance ×${s.power}`);
  if (s.effect?.kind === "dot") bits.push(`${Math.round(s.effect.ratio * 100)} % de l'attaque par tour`);
  if (s.effect?.kind === "weaken" || s.effect?.kind === "defDown") bits.push(`effet ${Math.round(s.effect.value * 100)} %`);
  if (s.effect?.kind === "paLoss") bits.push(`−${s.effect.value} PA à la cible`);
  if (s.selfEffect?.kind === "parade") bits.push(`+${s.selfEffect.defUp} DEF, contre ×${s.selfEffect.counter}, ${s.selfEffect.turns} tours`);
  if (s.lifesteal) bits.push(`vol de vie ${Math.round(s.lifesteal * 100)} %`);
  if (s.armorPen) bits.push(`ignore ${Math.round(s.armorPen * 100)} % de DEF`);
  if (s.critBonus) bits.push(`+${s.critBonus} % critique`);
  return `Rang ${s.rank} : ${bits.join(" · ") || "—"}`;
}

const chip = (on) => ({
  display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1, minWidth: 96, padding: "5px 9px", borderRadius: 8, fontSize: 12, fontFamily: font.body,
  background: on ? "rgba(201,162,75,.16)" : "#0a0a0f", border: `1px solid ${on ? color.gold : color.line}`, cursor: "pointer",
});
const linkBtn = {
  background: "transparent", border: `1px solid ${color.line}`, color: color.goldBright, borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer", fontFamily: font.body,
};
