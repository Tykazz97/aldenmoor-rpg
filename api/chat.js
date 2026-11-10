// ============================================================
// /api/chat — fait parler un joueur simulé grâce à un modèle de langage (Anthropic).
//
// Mise en place (une seule fois) :
//   1. Créer une clé sur console.anthropic.com et fixer une limite de dépense mensuelle.
//   2. Vercel → Settings → Environment Variables : ANTHROPIC_API_KEY = la clé.
//   3. Redéployer. Sans clé, la route répond 503 et le jeu retombe sur les phrases préécrites.
// Réglages facultatifs : BOT_MODEL (défaut claude-haiku-5-5), BOT_DAILY_CAP (défaut 400 réponses/jour/instance).
//
// Le jeu étant public, la route se protège : même origine uniquement, messages courts,
// quelques réponses par minute et par visiteur, et un plafond quotidien global.
// ============================================================
import { buildSystem } from "./_prompt.js";

const MODEL = process.env.BOT_MODEL || "claude-haiku-5-5";
const DAILY_CAP = Number(process.env.BOT_DAILY_CAP) || 400;
const PER_MINUTE = 8, PER_DAY_PER_IP = 120;

const hits = new Map();           // ip -> { minute: [timestamps], day: n, dayKey }
let global = { day: "", n: 0 };

// eslint-disable-next-line no-control-regex -- on retire volontairement les caractères de contrôle
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const dayKey = () => new Date().toISOString().slice(0, 10);

export function checkLimits(ip, now = Date.now()) {
  const dk = dayKey();
  if (global.day !== dk) global = { day: dk, n: 0 };
  if (global.n >= DAILY_CAP) return "daily";
  let h = hits.get(ip);
  if (!h || h.dayKey !== dk) { h = { minute: [], day: 0, dayKey: dk }; hits.set(ip, h); }
  h.minute = h.minute.filter((t) => now - t < 60000);
  if (h.minute.length >= PER_MINUTE || h.day >= PER_DAY_PER_IP) return "rate";
  h.minute.push(now); h.day++; global.n++;
  if (hits.size > 5000) hits.clear();
  return null;
}
export const _resetLimits = () => { hits.clear(); global = { day: "", n: 0 }; };

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;                         // appel direct / même page sans en-tête
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

export function sanitize(body = {}) {
  const b = body.bot || {}, p = body.player || {};
  const bot = {
    name: clean(b.name, 20) || "Voyageur",
    classKey: ["guerrier", "assassin", "magicien"].includes(b.classKey) ? b.classKey : "guerrier",
    gender: b.gender === "f" ? "f" : "m",
    level: Math.max(1, Math.min(50, Number(b.level) || 1)),
    activity: clean(b.activity, 20) || "flaneur",
    trait: clean(b.trait, 80) || "tranquille",
    goal: clean(b.goal, 100) || "tu traînes en ville",
    place: clean(b.place, 60) || "en ville",
    casual: !!b.casual,
  };
  const player = { name: clean(p.name, 20) || "Héros", classKey: clean(p.classKey, 12), level: Math.max(1, Math.min(50, Number(p.level) || 1)) };
  const message = clean(body.message, 160);
  const history = (Array.isArray(body.history) ? body.history : []).slice(-8).map((h) => ({ me: !!h.me, text: clean(h.text, 160) })).filter((h) => h.text);
  const feed = (Array.isArray(body.feed) ? body.feed : []).slice(-6).map((f) => ({ name: clean(f.name, 20), text: clean(f.text, 160) })).filter((f) => f.text);
  return { bot, player, message, history, feed };
}

export function buildUserMessage({ bot, player, message, history, feed }) {
  const lines = [];
  if (feed.length) lines.push("Derniers messages du chat de la ville :", ...feed.map((f) => `${f.name} : ${f.text}`), "");
  if (history.length) lines.push(`Ce que ${player.name} et toi vous êtes déjà dit :`, ...history.map((h) => `${h.me ? player.name : bot.name} : ${h.text}`), "");
  lines.push(`${player.name} (${player.classKey || "aventurier"}, niveau ${player.level}) t'écrit maintenant :`, `${player.name} : ${message}`, "", `Écris ta réponse, ${bot.name}.`);
  return lines.join("\n");
}

export function cleanReply(raw, botName) {
  let t = String(raw || "").split("\n")[0].trim();
  t = t.replace(new RegExp(`^${botName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*`, "i"), "").replace(/^["«»\s]+|["«»\s]+$/g, "").replace(/\*[^*]*\*/g, "").trim();
  return t.slice(0, 200);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "méthode" });
  if (!sameOrigin(req)) return res.status(403).json({ error: "origine" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: "pas de clé" });

  const input = sanitize(typeof req.body === "string" ? safeJson(req.body) : req.body);
  if (!input.message) return res.status(400).json({ error: "message vide" });

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
  const limited = checkLimits(ip);
  if (limited) return res.status(429).json({ error: limited });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL, max_tokens: 90, temperature: 0.9,
        system: buildSystem(input.bot),
        messages: [{ role: "user", content: buildUserMessage(input) }],
      }),
    });
    if (!r.ok) return res.status(502).json({ error: `modèle ${r.status}` });
    const data = await r.json();
    const text = cleanReply((data.content || []).filter((c) => c.type === "text").map((c) => c.text).join(" "), input.bot.name);
    if (!text) return res.status(502).json({ error: "réponse vide" });
    return res.status(200).json({ text });
  } catch {
    return res.status(502).json({ error: "réseau" });
  }
}
function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }
