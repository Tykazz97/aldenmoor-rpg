
// Élément signature de l'app — en-tête en forme de bannière héraldique,
// utilisé pour toutes les sections plutôt qu'un titre de carte générique.
export default function BannerHeader({ icon, title, right }) {
  return (
    <div className="banner-header" style={{ justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {icon && <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>}
        <span className="banner-header__title">{title}</span>
      </div>
      {right && <div style={{ fontSize: 12, color: "#74748a" }}>{right}</div>}
    </div>
  );
}
