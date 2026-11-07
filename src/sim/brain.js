// ============================================================
// Cerveau des joueurs simulés : quand on leur parle, ils répondent via /api/chat (modèle de langage).
// Chacun garde en mémoire ce que le joueur lui a dit (localStorage) et s'en souvient d'une visite à l'autre.
// Si la route est indisponible (pas de clé, limite atteinte, hors ligne), on retourne null :
// l'appelant retombe alors sur les phrases préécrites, sans rien casser.
// ============================================================
const MEM_KEY = "aldenmoor:botmem";
const MAX_LINES = 8, MAX_BOTS = 60;

export function loadMemory(botId) {
  try { return (JSON.parse(localStorage.getItem(MEM_KEY) || "{}")[botId]) || []; } catch { return []; }
}
export function remember(botId, lines) {
  try {
    const all = JSON.parse(localStorage.getItem(MEM_KEY) || "{}");
    const merged = [...(all[botId] || []), ...lines].slice(-MAX_LINES);
    delete all[botId]; all[botId] = merged;                       // le plus récent en dernier
    const ids = Object.keys(all);
    for (const k of ids.slice(0, Math.max(0, ids.length - MAX_BOTS))) delete all[k];
    localStorage.setItem(MEM_KEY, JSON.stringify(all));
  } catch { /* stockage indisponible : le bot oublie, sans plus */ }
}

let lastCall = 0;
export async function askBot({ bot, place, player, message, history, feed, timeoutMs = 9000, endpoint = "/api/chat" }) {
  const now = Date.now();
  if (now - lastCall < 1500) return null;                         // pas de rafale : on retombe sur les phrases préécrites
  lastCall = now;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: "POST", headers: { "content-type": "application/json" }, signal: ctl.signal,
      body: JSON.stringify({
        bot: { name: bot.name, classKey: bot.classKey, gender: bot.gender, level: bot.level, activity: bot.activity, trait: bot.trait, goal: bot.goal, casual: bot.casual, place },
        player: { name: player.name, classKey: player.classKey, level: player.level },
        message, history, feed,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.text === "string" && data.text.trim() ? data.text.trim() : null;
  } catch { return null; } finally { clearTimeout(timer); }
}
