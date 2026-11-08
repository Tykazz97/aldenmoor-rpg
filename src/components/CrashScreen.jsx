import React from "react";

// Filet de sécurité : si le jeu plante, on affiche l'erreur (au lieu d'un écran noir) et on laisse
// récupérer la sauvegarde. Les erreurs de rendu sont attrapées ici ; celles du démarrage, par main.jsx.
const box = { minHeight: "100vh", background: "#0b0b12", color: "#e8dcc0", fontFamily: "Inter, system-ui, sans-serif", padding: "32px 20px", display: "flex", justifyContent: "center" };
const card = { maxWidth: 720, width: "100%" };
const btn = { background: "#c8a456", color: "#1a1408", border: 0, borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer", marginRight: 10, marginTop: 8 };
const pre = { background: "#14141e", border: "1px solid #2a2a3a", borderRadius: 8, padding: 12, fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 260, overflow: "auto", color: "#c9b9a0" };

// Télécharge le contenu brut de la sauvegarde (IndexedDB « aldenmoor » / « kv » / « save »)
function downloadSave() {
  const r = indexedDB.open("aldenmoor");
  r.onsuccess = () => {
    const g = r.result.transaction("kv").objectStore("kv").get("save");
    g.onsuccess = () => {
      r.result.close();
      if (!g.result) { alert("Aucune sauvegarde trouvée."); return; }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([g.result], { type: "application/json" }));
      a.download = "aldenmoor-sauvegarde.json"; a.click();
    };
  };
}

export function CrashView({ error }) {
  const text = String(error?.stack || error?.message || error || "Erreur inconnue").slice(0, 2000);
  return (
    <div style={box}>
      <div style={card}>
        <h1 style={{ fontFamily: "Cinzel, serif", color: "#c8a456", marginTop: 0 }}>Aldenmoor a rencontré un problème</h1>
        <p>Rien n'est perdu : ta sauvegarde est intacte. Recharge la page ; si ça recommence, envoie-moi le texte ci-dessous.</p>
        <pre style={pre}>{text}</pre>
        <button style={btn} onClick={() => location.reload()}>Recharger</button>
        <button style={btn} onClick={downloadSave}>Télécharger ma sauvegarde</button>
      </div>
    </div>
  );
}

export default class CrashScreen extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("Plantage du jeu :", error, info?.componentStack); }
  render() { return this.state.error ? <CrashView error={this.state.error} /> : this.props.children; }
}
