import React, { useState } from "react";
import { color, border, radius, font } from "../../styles/theme.js";
import { RESOURCES } from "../../data/resources.js";
import { CLASSES } from "../../data/classes.js";
import { UPGRADE_MAX, UPGRADE_BONUS, CLASS_RARE } from "../../data/upgrade.js";
import { upgradablePieces, canUpgrade, plusOf, itemLabel } from "../../utils/upgrade.js";

const btn = (on) => ({ padding: "5px 10px", fontSize: 12, fontWeight: 600, borderRadius: radius.sm, background: on ? color.gold : color.panelRaised, color: on ? color.void : color.mist, border: `1px solid ${on ? color.goldBright : color.line}`, cursor: on ? "pointer" : "not-allowed" });

// Un coût : « Éclat brut 2/3 » (rouge s'il en manque)
function Need({ id, have, need, data }) {
  const ok = have >= need;
  return <span data-need={data} data-ok={ok ? "1" : "0"} style={{ fontFamily: font.data, fontSize: 11, color: ok ? color.parchmentDim : color.blood }}>{RESOURCES[id].name} {have}/{need}</span>;
}

// Amélioration de l'équipement (utils/upgrade.js) : à l'atelier de la ville, taxe de la ville comprise
export default function UpgradePanel({ player, city, onUpgrade }) {
  const fx = { rate: city.rate, city: city.key };
  const [showBag, setShowBag] = useState(false);
  const [msg, setMsg] = useState(null);
  const pieces = upgradablePieces(player).filter((p) => p.slot || showBag);
  const bagCount = upgradablePieces(player).filter((p) => !p.slot).length;
  const cls = CLASSES[player.classKey];
  const res = player.resources || {};

  const run = (ref) => {
    const c = canUpgrade(player, ref, fx);
    if (!c.ok) { setMsg(c.reason); return; }
    onUpgrade(ref, fx);
    setMsg(`Amélioré : +${c.needs.to} pour ${c.needs.total} or`);
  };

  return (
    <div data-upgrade style={{ margin: "8px 12px 0", padding: "8px 10px", background: color.void, border, borderRadius: radius.sm, display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: color.mist, textTransform: "uppercase", letterSpacing: "0.08em", flex: 1 }}>Amélioration · +{Math.round(UPGRADE_BONUS * 100)} % de stats par niveau, jusqu'à +{UPGRADE_MAX}</span>
        {bagCount > 0 && <button data-upgrade-bag onClick={() => setShowBag((v) => !v)} style={{ ...btn(true), background: color.panelRaised, color: color.parchmentDim, border }}>{showBag ? "Masquer le sac" : `Pièces du sac (${bagCount})`}</button>}
      </div>
      <div style={{ fontSize: 11, color: color.mist }}>
        Éclats : brut (monstres de zone) pour +1, dense (boss) pour +2, pur (donjon) pour +3. Et la ressource rare de ta classe{cls ? ` (${cls.label})` : ""} : {RESOURCES[CLASS_RARE[player.classKey]]?.name}, trouvée en récoltant.
      </div>
      {pieces.map(({ ref, item, slot }) => {
        const c = canUpgrade(player, ref, fx), n = c.needs;
        return (
          <div key={ref} data-upgrade-row={slot || "bag"} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: color.parchmentDim, flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 150 }}>{itemLabel(item)}{!slot && <span style={{ color: color.mist }}> (dans le sac)</span>}</span>
            {n ? (
              <>
                <Need id={n.shard} have={res[n.shard] || 0} need={n.shardQty} data="shard" />
                {n.rare && <Need id={n.rare} have={res[n.rare] || 0} need={n.rareQty} data="rare" />}
                <button data-upgrade-btn disabled={!c.ok} onClick={() => run(ref)} style={btn(c.ok)}
                  title={`${n.gold} or + ${n.tax} or de taxe de ${city.name}`}>
                  +{plusOf(item)} → +{n.to} · <span style={{ fontFamily: font.data }}>{n.total}</span> or
                </button>
              </>
            ) : <span style={{ color: color.goldBright, fontFamily: font.data }}>+{UPGRADE_MAX} · au maximum</span>}
          </div>
        );
      })}
      {msg && <div style={{ fontSize: 11, color: color.mist }}>{msg}</div>}
    </div>
  );
}
