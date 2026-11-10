import { color, font } from "../../styles/theme.js";

// Lieux de la ville pas encore ouverts : on explique à quoi ils serviront.
export default function ComingSoonPlace({ icon, title, lines }) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center", color: color.parchmentDim, padding: 24 }}>
      <div style={{ fontSize: 46 }}>{icon}</div>
      <div style={{ fontFamily: font.display, fontSize: 22, color: color.goldBright }}>{title}</div>
      <div style={{ maxWidth: 460, fontSize: 14, lineHeight: 1.6 }}>
        {lines.map((l, i) => <p key={i} style={{ margin: "0 0 8px" }}>{l}</p>)}
      </div>
      <div style={{ fontSize: 11, color: color.mist, letterSpacing: ".1em", textTransform: "uppercase" }}>Bientôt disponible</div>
    </div>
  );
}
