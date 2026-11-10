import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import CrashScreen, { CrashView } from "./components/CrashScreen.jsx";
import "./styles/global.css";

const root = createRoot(document.getElementById("root"));
root.render(<CrashScreen><App /></CrashScreen>);

// erreur hors rendu (démarrage, calcul asynchrone) alors que la page est restée vide : on l'affiche aussi
const showIfBlank = (error) => {
  const el = document.getElementById("root");
  if (el && !el.childElementCount) root.render(<CrashView error={error} />);
};
window.addEventListener("error", (e) => showIfBlank(e.error || e.message));
window.addEventListener("unhandledrejection", (e) => showIfBlank(e.reason));
