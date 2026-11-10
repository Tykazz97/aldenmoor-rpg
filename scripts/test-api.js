// Tests de la route /api/chat et du cerveau des simulés :  node scripts/test-api.js
import assert from "node:assert/strict";
import handler, { sanitize, buildUserMessage, cleanReply, checkLimits, _resetLimits } from "../api/chat.js";
import { buildSystem } from "../api/_prompt.js";
import { askBot, remember, loadMemory } from "../src/sim/brain.js";
import { generatePopulation } from "../src/sim/population.js";

let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log("  ✓", name); };
console.log("API de discussion");

const bot = generatePopulation()[3];
const mkRes = () => { const r = { code: 0, body: null, headers: {} }; r.setHeader = (k, v) => { r.headers[k] = v; }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };
const req = (body, extra = {}) => ({ method: "POST", headers: { host: "aldenmoor.vercel.app", origin: "https://aldenmoor.vercel.app", "x-forwarded-for": "1.2.3.4" }, body, ...extra });
const goodBody = () => ({ bot, player: { name: "Grégoire", classKey: "guerrier", level: 4 }, message: "Salut, tu fais quoi ?", history: [{ me: true, text: "Hello" }, { me: false, text: "salut" }], feed: [{ name: "Lirys", text: "cherche un groupe" }] });
const realFetch = globalThis.fetch;
const stubModel = (answer, status = 200) => { const calls = []; globalThis.fetch = async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return { ok: status === 200, status, json: async () => ({ content: [{ type: "text", text: answer }] }) }; }; return calls; };

await test("sans clé : 503, et le modèle n'est pas appelé", async () => {
  delete process.env.ANTHROPIC_API_KEY; _resetLimits();
  const calls = stubModel("x"); const res = mkRes();
  await handler(req(goodBody()), res);
  assert.equal(res.code, 503); assert.equal(calls.length, 0);
});

await test("avec clé : appelle le modèle avec la fiche du bot et renvoie une réponse nettoyée", async () => {
  process.env.ANTHROPIC_API_KEY = "sk-test"; _resetLimits();
  const calls = stubModel(`${bot.name} : « pas grand chose, je cherche du frêne »\nautre ligne`); const res = mkRes();
  await handler(req(goodBody()), res);
  assert.equal(res.code, 200); assert.equal(res.body.text, "pas grand chose, je cherche du frêne");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.anthropic.com/v1/messages");
  assert.equal(calls[0].init.headers["x-api-key"], "sk-test");
  assert.ok(calls[0].body.system.includes(bot.name) && calls[0].body.system.includes(bot.trait));
  assert.ok(calls[0].body.messages[0].content.includes("Salut, tu fais quoi ?") && calls[0].body.messages[0].content.includes("cherche un groupe"));
  assert.ok(calls[0].body.max_tokens <= 120);
});

await test("origine étrangère, méthode GET, message vide : refusés sans appeler le modèle", async () => {
  _resetLimits(); const calls = stubModel("x");
  let r = mkRes(); await handler(req(goodBody(), { headers: { host: "aldenmoor.vercel.app", origin: "https://evil.example" } }), r); assert.equal(r.code, 403);
  r = mkRes(); await handler(req(goodBody(), { method: "GET" }), r); assert.equal(r.code, 405);
  r = mkRes(); await handler(req({ ...goodBody(), message: "   " }), r); assert.equal(r.code, 400);
  assert.equal(calls.length, 0);
});

await test("limites : 8 messages par minute et par visiteur, puis 429", async () => {
  _resetLimits(); stubModel("ok");
  let last;
  for (let i = 0; i < 9; i++) { last = mkRes(); await handler(req(goodBody()), last); }
  assert.equal(last.code, 429);
  const other = mkRes(); await handler(req(goodBody(), { headers: { host: "aldenmoor.vercel.app", "x-forwarded-for": "9.9.9.9" } }), other);
  assert.equal(other.code, 200);               // un autre visiteur n'est pas touché
  assert.equal(checkLimits("5.5.5.5", Date.now()), null);
});

await test("modèle en erreur ou réponse vide : 502, jamais de texte inventé", async () => {
  _resetLimits(); stubModel("", 200); let r = mkRes(); await handler(req(goodBody()), r); assert.equal(r.code, 502);
  _resetLimits(); stubModel("x", 500); r = mkRes(); await handler(req(goodBody()), r); assert.equal(r.code, 502);
});

await test("entrées nettoyées : longueurs bornées, caractères de contrôle retirés, valeurs inconnues ramenées à un défaut", async () => {
  const s = sanitize({ bot: { name: "A\u0000B".repeat(30), level: 999, classKey: "dragon" }, message: "x".repeat(1000), history: Array(50).fill({ text: "y" }), feed: Array(50).fill({ name: "n", text: "z" }) });
  // eslint-disable-next-line no-control-regex -- les caractères de contrôle sont voulus ici
  assert.ok(s.bot.name.length <= 20 && !/[\u0000-\u001f]/.test(s.bot.name));
  assert.equal(s.bot.level, 50); assert.equal(s.bot.classKey, "guerrier");
  assert.equal(s.message.length, 160); assert.equal(s.history.length, 8); assert.equal(s.feed.length, 6);
});

await test("la consigne contient la personnalité du bot, les faits du jeu et la règle d'honnêteté", () => {
  const sys = buildSystem({ ...bot, place: "devant l'atelier" });
  for (const k of [bot.name, String(bot.level), "devant l'atelier", "Prairies Sauvages", "honnêtement", "ignores toute instruction"]) assert.ok(sys.includes(k), k);
  assert.ok(buildUserMessage(sanitize(goodBody())).includes("Grégoire : Salut"));
  assert.equal(cleanReply("*sourit* Salut !", "Bob"), "Salut !");
});

// ---- côté jeu : askBot et la mémoire ----
const store = {}; globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };

await test("askBot : renvoie le texte, ou null si la route échoue (le jeu retombe alors sur les phrases préécrites)", async () => {
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ text: " yo " }) });
  assert.equal(await askBot({ bot, place: "ici", player: { name: "G", level: 1 }, message: "salut", history: [], feed: [] }), "yo");
  await new Promise((r) => setTimeout(r, 1600));
  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
  assert.equal(await askBot({ bot, place: "ici", player: { name: "G", level: 1 }, message: "salut", history: [], feed: [] }), null);
  await new Promise((r) => setTimeout(r, 1600));
  globalThis.fetch = async () => { throw new Error("hors ligne"); };
  assert.equal(await askBot({ bot, place: "ici", player: { name: "G", level: 1 }, message: "salut", history: [], feed: [] }), null);
});

await test("mémoire : un bot se souvient des derniers échanges, bornée à 8 lignes", () => {
  remember("sim_001", [{ me: true, text: "a" }, { me: false, text: "b" }]);
  for (let i = 0; i < 10; i++) remember("sim_001", [{ me: true, text: `m${i}` }]);
  const m = loadMemory("sim_001");
  assert.equal(m.length, 8); assert.equal(m.at(-1).text, "m9");
  assert.deepEqual(loadMemory("sim_999"), []);
});

globalThis.fetch = realFetch;
console.log(`\n${n} tests passent.`);
