import { color, border, radius, font } from "../../styles/theme.js";

export default function ComingSoon({ title }) {
  return (
    <div style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
      background: color.panel, borderRadius: radius.lg, border,
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: font.display, fontSize: 20, color: color.goldBright, marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: color.mist }}>Cette section n'est pas encore construite.</div>
      </div>
    </div>
  );
}
