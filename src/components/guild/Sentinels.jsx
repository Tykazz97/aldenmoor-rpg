import { RESOURCES } from "../../data/resources.js";
import { SENT_REGIONS, sentinelSlots, sentinelGoldCap, sentinelResCap } from "../../data/sentinel.js";
import { sentinelsOf, sentinelCount, sentinelOwner, placeProblem, stockEmpty } from "../../utils/sentinel.js";
import { guildsOf, placeSentinelAction, removeSentinelAction, collectSentinelAction } from "../../utils/guildActions.js";
import SentinelSprite from "./SentinelSprite.jsx";
import SentinelSheet from "./SentinelSheet.jsx";

const num = (n) => Math.round(n).toLocaleString("fr-FR");

// Onglet « Sentinelles » : une carte par région ; la sentinelle de ma guilde, ou celle d'une autre, ou la place libre
export default function Sentinels({ player, g, run, spend, wd }) {
  const G = guildsOf(player);
  const slots = sentinelSlots(g.level), used = sentinelCount(g);
  const gcap = sentinelGoldCap(g.level), rcap = sentinelResCap(g.level);
  return (
    <>
    <div className="gd-card" data-gd-sentinels>
      <div className="gd-sub">Une sentinelle est un golem de pierre posté dans une région. Dans chaque combat de la région, elle se comporte comme un aventurier invisible de plus : elle tire son propre butin (or et ressources) sans rien prendre aux autres. Le chef ou le bras droit relève son stock : l'or va à la caisse, les ressources au coffre.</div>
      <div className="gd-stats"><span>Sentinelles <b data-gd-sent-count>{used}</b>/{slots}</span><span>Stock max. <b>{num(gcap)}</b> or, <b>{num(rcap)}</b> par ressource</span><span className="gd-sub">Une de plus tous les 10 niveaux de guilde</span></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {SENT_REGIONS.map((r) => {
          const mineS = sentinelsOf(g)[r.key], owner = sentinelOwner(G, r.key);
          const pp = !mineS && !owner ? placeProblem(G, g, r.key) : null;
          const resIds = mineS ? Object.keys(mineS.res).sort((a, b) => (RESOURCES[a]?.name || a).localeCompare(RESOURCES[b]?.name || b, "fr")) : [];
          return (
            <div key={r.key} data-gd-sent-region={r.key} className="gd-list-row" style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "10px 4px" }}>
              {(mineS || owner) ? <SentinelSprite emblem={(owner || g).emblem} seed={(owner || g).id} width={104} title={`Sentinelle de ${(owner || g).name}`} /> : <div style={{ width: 104, height: 239, border: "1px dashed #2a2a3d", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#3a3a52", fontSize: 11, textAlign: "center" }}>Place libre</div>}
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontWeight: 700 }}>{r.name} <span className="gd-sub">· {r.levels}</span></div>
                {mineS ? (
                  <>
                    <div className="gd-stats">
                      <span>Or <b data-gd-sent-gold={r.key}>{num(mineS.gold || 0)}</b> / {num(gcap)}</span>
                      <span>Ressources <b>{resIds.length}</b> type{resIds.length > 1 ? "s" : ""}</span>
                    </div>
                    {!!resIds.length && <div className="gd-sub" data-gd-sent-res={r.key}>{resIds.map((id) => `${RESOURCES[id]?.name || id} ×${num(mineS.res[id])}`).join(" · ")}</div>}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button className="gd-mini" data-gd-sent-collect={r.key} disabled={!wd || stockEmpty(mineS)} onClick={() => run(() => collectSentinelAction(player, r.key), "Butin relevé.")}>Relever</button>
                      <button className="gd-mini danger" data-gd-sent-remove={r.key} disabled={!spend || !stockEmpty(mineS)} title={stockEmpty(mineS) ? "" : "Relève d'abord le butin"} onClick={() => run(() => removeSentinelAction(player, r.key), "Sentinelle retirée.")}>Retirer</button>
                    </div>
                    {!wd && <div className="gd-sub">Seuls le chef et le bras droit relèvent le butin.</div>}
                  </>
                ) : owner ? (
                  <div className="gd-sub" data-gd-sent-taken={r.key}>Gardée par la guilde <b>{owner.name}</b>.</div>
                ) : (
                  <>
                    <div className="gd-sub">Aucune sentinelle. Prix : <b>{num(r.cost)}</b> or de la caisse.</div>
                    <div><button className="gd-mini" data-gd-sent-place={r.key} disabled={!spend || !!pp} title={pp === "caisse" ? "La caisse ne suffit pas" : pp === "sentinelle_max" ? "Niveau de guilde insuffisant pour une sentinelle de plus" : ""} onClick={() => run(() => placeSentinelAction(player, r.key), "Sentinelle posée !")}>Poser{pp === "caisse" ? " (caisse)" : pp === "sentinelle_max" ? " (niveau)" : ""}</button></div>
                    {!spend && <div className="gd-sub">Seuls le chef et le bras droit peuvent en poser une.</div>}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
    <SentinelSheet player={player} g={g} run={run} spend={spend} />
    </>
  );
}
