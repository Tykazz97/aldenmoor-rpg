import { bagUsed, bagCapacity } from "../../utils/bag.js";
import EquipmentPanel from "./EquipmentPanel.jsx";
import StatsPanel from "./StatsPanel.jsx";
import InventoryPanel from "./InventoryPanel.jsx";
import { color, border, radius, font } from "../../styles/theme.js";
import SpellsPanel from "./SpellsPanel.jsx";
import { xpToNext } from "../../utils/progression.js";
import { CLASSES } from "../../data/classes.js";
import { BODIES, OUTFIT_LABELS, availableOutfits, heroLook, heroOutfit, heroSpriteUrl } from "../../data/heroSprites.js";

function ResourceBar({ label, value, max, colorFrom, colorTo }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: color.mist, marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ fontFamily: font.data }}>{value}/{max}</span>
      </div>
      <div style={{ height: 8, background: color.void, borderRadius: 4, overflow: "hidden", border }}>
        <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${colorFrom}, ${colorTo})`, transition: "width 0.3s ease" }} />
      </div>
    </div>
  );
}

const smallBtn = { background: color.panelRaised, color: color.parchmentDim, border, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontFamily: font.body };

export default function CharacterSheet({ player, stats, onEquipSlotClick, onUnequip, onAddCaracPoint, onEquipItem, onSetAppearance, onExport, onTestMaxOut, onNewCharacter, spellbook }) {
  const cls = CLASSES[player.classKey];
  const outfits = availableOutfits(player);
  const current = heroOutfit(player, stats);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
      {/* En-tête personnage */}
      <div style={{
        background: color.panel, borderRadius: radius.lg, border,
        padding: "16px 24px", display: "flex", alignItems: "center", gap: 24,
      }}>
        <div style={{ width: 54, height: 64, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <img src={heroSpriteUrl(heroLook(player, stats))} alt="" style={{ height: 64 }} draggable={false} />
        </div>
        <div>
          <div style={{ fontFamily: font.display, fontSize: 20, color: color.goldBright, letterSpacing: "0.02em" }}>
            {player.name}
          </div>
          <div style={{ fontSize: 12, color: color.mist }}>{cls ? `${cls.label} · ` : ""}{BODIES[player.gender] || ""} · Niveau {player.level}</div>
        </div>
        <div style={{ display: "flex", gap: 20, flex: 1 }}>
          <ResourceBar label="Points de Vie (pleins avant chaque combat)" value={stats.maxHp} max={stats.maxHp} colorFrom="#6b1f1f" colorTo={color.blood} />
          <ResourceBar label="Expérience" value={player.xp} max={xpToNext(player.level)} colorFrom="#6b5a1f" colorTo={color.goldBright} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 150 }}>
          <label style={{ fontSize: 11, color: color.mist }} htmlFor="appearance">Apparence (cosmétique)</label>
          <select id="appearance" value={player.appearance || ""} onChange={(e) => onSetAppearance(e.target.value || null)}
            style={{ background: color.void, color: color.parchment, border, borderRadius: 6, padding: "5px 6px", fontFamily: font.body, fontSize: 12 }}>
            <option value="">Selon l'équipement ({OUTFIT_LABELS[current]})</option>
            {outfits.map((o) => <option key={o} value={o}>{OUTFIT_LABELS[o]}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button onClick={onExport} style={smallBtn} title="Télécharger ta sauvegarde (fichier)">Exporter</button>
          {onTestMaxOut && <button onClick={onTestMaxOut} style={smallBtn} title="Outil de test : niveau maximum et tous les objets du jeu dans le sac">Test : niv. max + tout</button>}
          <button onClick={onNewCharacter} style={smallBtn} title="Effacer ce personnage et en créer un nouveau">Nouveau perso</button>
        </div>
      </div>

      {/* Contenu trois colonnes — équipement, stats, sac */}
      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr 320px", gap: 20, flex: 1, minHeight: 0 }}>
        <EquipmentPanel equipped={player.equipped} onEquipSlotClick={onEquipSlotClick} onUnequip={onUnequip} />
        <div style={{ overflowY: "auto" }}>
          <StatsPanel player={player} stats={stats} onAddCaracPoint={onAddCaracPoint} />
          <SpellsPanel player={player} spellbook={spellbook} />
        </div>
        <InventoryPanel inventory={player.inventory} onEquip={onEquipItem} level={player.level} used={bagUsed(player)} capacity={bagCapacity(player)} />
      </div>
    </div>
  );
}
