import React from "react";
import { MAPS, CITY_KEY } from "../../data/maps.js";

// Carte du monde : on choisit la région où l'on veut aller. Une région sans carte
// détaillée (pas encore dessinée) reste verrouillée.
const SPOTS = {
  [CITY_KEY]: { x: 37, y: 38 },
  prairies_sauvages: { x: 22, y: 52 },
  champs_calcines: { x: 58, y: 50 },
  lisiere_des_ombres: { x: 86, y: 44 },
};

export default function WorldMap({ regions, current, onTravel }) {
  return (
    <div className="wm">
      <div className="wm-art" style={{ backgroundImage: "url(/assets/map/world.webp)" }} />
      <div className="wm-shade" />
      <div className="wm-title">Royaume d'Aldenmoor</div>
      {regions.map((r) => {
        const spot = SPOTS[r.key] || { x: 50, y: 50 };
        const open = !!MAPS[r.key];
        return (
          <button key={r.key} className={`wm-spot ${open ? "open" : "locked"} ${current === r.key ? "here" : ""}`}
            style={{ left: `${spot.x}%`, top: `${spot.y}%` }} onClick={() => onTravel(r.key)}>
            <span className="wm-pin">{open ? (r.key === CITY_KEY ? "🏰" : "⚔") : "🔒"}</span>
            <span className="wm-card">
              <b>{r.name}</b>
              <i>{r.difficulty}</i>
              <small>{open ? (current === r.key ? "Tu es ici" : "Voyager") : "Bientôt disponible"}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
