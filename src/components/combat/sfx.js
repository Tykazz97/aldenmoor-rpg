// Son du combat : vrais bruitages, musiques et ambiances (fichiers dans public/assets/audio, générés avec Ludo, ambiance sombre).
// Si un fichier n'est pas encore chargé (ou ne peut pas l'être), le petit son synthétisé d'origine joue à sa place.
let ctx = null, master = null, sfxBus = null, musicBus = null;
let muted = false;
let volume = 0.7;
try { muted = localStorage.getItem("aldenmoor.muted") === "1"; } catch { /* ignoré */ }
try { const v = parseFloat(localStorage.getItem("aldenmoor.volume")); if (v >= 0 && v <= 1) volume = v; } catch { /* ignoré */ }

const BASE = "/assets/audio/";
const SFX_FILES = ["hit_sword_1", "hit_sword_2", "hit_sword_3", "hit_crit", "swing_1", "swing_2", "dagger", "bow_shot", "arrow_hit", "magic_cast", "fire_hit", "frost_hit", "poison_hit", "arcane_hit", "heal", "buff", "parade", "dodge", "death_undead", "death_beast", "death_hero", "roar_boss", "turn_bell", "click", "combat_start", "levelup"];
// niveau de chaque son (les fichiers sont tous normalisés au même pic)
const LEVEL = { click: 0.5, turn_bell: 0.55, swing_1: 0.55, swing_2: 0.5, dodge: 0.6, buff: 0.7, heal: 0.75, bow_shot: 0.7, magic_cast: 0.7, combat_start: 0.7, roar_boss: 0.85 };

function ac() {
  if (muted) return null;
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = 1; musicBus.connect(master);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch { return null; }
}

// ---------- chargement des fichiers ----------
const bufs = new Map();   // chemin -> AudioBuffer | Promise | null (échec)
function load(path) {
  const c = ac();
  if (!c || typeof fetch !== "function") return Promise.resolve(null);
  const have = bufs.get(path);
  if (have) return have instanceof Promise ? have : Promise.resolve(have);
  if (bufs.has(path)) return Promise.resolve(null);
  const p = fetch(`${BASE}${path}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("fichier absent"))))
    .then((ab) => new Promise((ok, ko) => c.decodeAudioData(ab, ok, ko)))
    .then((b) => { bufs.set(path, b); return b; })
    .catch(() => { bufs.set(path, null); return null; });
  bufs.set(path, p);
  return p;
}
export function preload() { SFX_FILES.forEach((n) => load(`sfx/${n}`)); }

// joue un fichier chargé ; renvoie false s'il n'est pas prêt (le son synthétisé prend alors le relais)
function playFile(name, { vol = 1, rate = 0, delay = 0 } = {}) {
  const c = ac(); if (!c) return true;
  const b = bufs.get(`sfx/${name}`);
  if (!b || b instanceof Promise) { load(`sfx/${name}`); return false; }
  const src = c.createBufferSource(); src.buffer = b;
  src.playbackRate.value = rate || 0.95 + Math.random() * 0.1;   // petite variation pour que deux coups ne sonnent jamais pareil
  const g = c.createGain(); g.gain.value = vol * (LEVEL[name] ?? 1);
  src.connect(g).connect(sfxBus); src.start(c.currentTime + delay);
  return true;
}
const pick = (...a) => a[Math.floor(Math.random() * a.length)];

// ---------- sons synthétisés (secours) ----------
function tone({ f = 440, f2 = null, dur = 0.15, type = "sine", vol = 0.12, delay = 0 }) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxBus); o.start(t); o.stop(t + dur + 0.02);
}
function noise({ dur = 0.12, vol = 0.12, freq = 1200, delay = 0 }) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + delay;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq;
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(sfxBus); src.start(t);
}
const synth = {
  hit(crit) { noise({ dur: 0.1, vol: crit ? 0.2 : 0.13, freq: crit ? 900 : 1500 }); tone({ f: crit ? 180 : 140, f2: 60, dur: 0.14, type: "triangle", vol: crit ? 0.2 : 0.12 }); if (crit) tone({ f: 880, f2: 1320, dur: 0.18, type: "square", vol: 0.05, delay: 0.03 }); },
  miss() { noise({ dur: 0.18, vol: 0.05, freq: 3000 }); },
  swing() { noise({ dur: 0.14, vol: 0.06, freq: 2200 }); },
  magic() { tone({ f: 300, f2: 900, dur: 0.3, type: "sine", vol: 0.09 }); tone({ f: 450, f2: 1350, dur: 0.3, type: "triangle", vol: 0.04 }); },
  buff() { tone({ f: 400, f2: 700, dur: 0.25, type: "sine", vol: 0.08 }); tone({ f: 600, f2: 1000, dur: 0.25, type: "sine", vol: 0.05, delay: 0.08 }); },
  heal() { tone({ f: 520, dur: 0.12, vol: 0.07 }); tone({ f: 660, dur: 0.12, vol: 0.07, delay: 0.1 }); tone({ f: 880, dur: 0.2, vol: 0.07, delay: 0.2 }); },
  death() { tone({ f: 220, f2: 50, dur: 0.4, type: "sawtooth", vol: 0.08 }); },
  turn() { tone({ f: 660, dur: 0.1, type: "triangle", vol: 0.08 }); tone({ f: 990, dur: 0.16, type: "triangle", vol: 0.08, delay: 0.09 }); },
  roar() { tone({ f: 90, f2: 50, dur: 0.6, type: "sawtooth", vol: 0.12 }); noise({ dur: 0.5, vol: 0.08, freq: 400 }); },
  click() { tone({ f: 500, dur: 0.05, type: "square", vol: 0.04 }); },
};
const sound = (name, fallback, opts) => { if (!playFile(name, opts)) fallback(); };

// `kind` d'un coup reçu : "fire" | "frost" | "poison" | "arcane" | "dagger" | "arrow" | rien (arme blanche)
export const sfx = {
  hit(crit, kind) {
    const base = { fire: "fire_hit", frost: "frost_hit", poison: "poison_hit", arcane: "arcane_hit", dagger: "dagger", arrow: "arrow_hit" }[kind] || pick("hit_sword_1", "hit_sword_2", "hit_sword_3");
    if (crit) { sound("hit_crit", () => synth.hit(true)); playFile(base, { vol: 0.55, delay: 0.03 }); }
    else sound(base, () => synth.hit(false));
  },
  miss() { sound("dodge", synth.miss); },
  swing() { sound(pick("swing_1", "swing_2"), synth.swing); },
  dagger() { sound("swing_2", synth.swing, { vol: 0.9 }); },
  bow() { sound("bow_shot", synth.swing); },
  magic() { sound("magic_cast", synth.magic); },
  buff() { sound("buff", synth.buff); },
  heal() { sound("heal", synth.heal); },
  parade() { sound("parade", synth.hit); },
  death(kind = "hero") { sound(`death_${kind}`, synth.death); },
  turn() { sound("turn_bell", synth.turn); },
  roar() { sound("roar_boss", synth.roar); },
  start() { sound("combat_start", synth.roar, { rate: 1 }); },
  levelup() { sound("levelup", synth.heal, { rate: 1 }); },
  win() { music.stinger("victory"); },
  lose() { music.stinger("defeat"); },
  click() { sound("click", synth.click); },
};

// ---------- musique et ambiance ----------
const TRACK_LEVEL = { combat: 0.3, boss: 0.34, amb_field: 0.4, amb_dungeon: 0.4, victory: 0.55, defeat: 0.55 };
let want = null;          // { track, amb } demandés (pour reprendre quand on remet le son)
let live = [];            // boucles en cours : { src, gain }
let token = 0;

function fadeOutLive(sec) {
  const c = ctx; if (!c) return;
  for (const l of live) {
    try { l.gain.gain.cancelScheduledValues(c.currentTime); l.gain.gain.setValueAtTime(l.gain.gain.value, c.currentTime); l.gain.gain.linearRampToValueAtTime(0, c.currentTime + sec); l.src.stop(c.currentTime + sec + 0.05); } catch { /* déjà arrêté */ }
  }
  live = [];
}
function startLoop(track, fade = 1.5) {
  const my = token;
  return load(`music/${track}`).then((b) => {
    const c = ctx; if (!b || !c || my !== token) return;
    const src = c.createBufferSource(); src.buffer = b; src.loop = true;
    const g = c.createGain(); g.gain.setValueAtTime(0, c.currentTime); g.gain.linearRampToValueAtTime(TRACK_LEVEL[track] ?? 0.3, c.currentTime + fade);
    src.connect(g).connect(musicBus); src.start();
    live.push({ src, gain: g });
  });
}
export const music = {
  // musique de combat (ou de boss) et ambiance du décor, en boucle
  start(track = "combat", amb = "amb_field") {
    want = { track, amb };
    if (!ac()) return;
    token++; fadeOutLive(0.6);
    startLoop(track); startLoop(amb, 2.5);
  },
  stop(fade = 1.2) { want = null; token++; fadeOutLive(fade); },
  // jingle de fin : la musique se tait, le jingle joue une fois
  stinger(name) {
    want = null; token++;
    const c = ac(); if (!c) return;
    fadeOutLive(1.0);
    load(`music/${name}`).then((b) => {
      if (!b || !ctx) return;
      const src = ctx.createBufferSource(); src.buffer = b;
      const g = ctx.createGain(); g.gain.value = TRACK_LEVEL[name] ?? 0.5;
      src.connect(g).connect(musicBus); src.start(ctx.currentTime + 0.25);
    });
  },
};

// ---------- réglages ----------
export const isMuted = () => muted;
export function setMuted(v) {
  muted = !!v;
  try { localStorage.setItem("aldenmoor.muted", muted ? "1" : "0"); } catch { /* ignoré */ }
  if (muted) { token++; fadeOutLive(0.2); } else if (want) music.start(want.track, want.amb);
}
export const getVolume = () => volume;
export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  try { localStorage.setItem("aldenmoor.volume", String(volume)); } catch { /* ignoré */ }
  if (master) master.gain.value = volume;
}

// fichiers attendus (vérifiés par scripts/test-combatfx.js)
export const AUDIO_FILES = { sfx: SFX_FILES, music: [...Object.keys(TRACK_LEVEL)] };
