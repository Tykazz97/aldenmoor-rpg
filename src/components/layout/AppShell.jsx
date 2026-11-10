import SideNav from "./SideNav.jsx";
import { color } from "../../styles/theme.js";

export default function AppShell({ active, onChangeTab, children }) {
  return (
    <div style={{ display: "flex", height: "100vh", background: color.void }}>
      <SideNav active={active} onChange={onChangeTab} />
      <main style={{ flex: 1, padding: 24, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {children}
      </main>
    </div>
  );
}
