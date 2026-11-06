// Petits effets sonores synthétisés (aucun fichier audio nécessaire).
let ctx = null;
let muted = false;
try { muted = localStorage.getItem("aldenmoor.muted") === "1"; } catch { /* ignoré */ }

function ac() {
  if (muted) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch { return null; }
}

function tone({ f = 440, f2 = null, dur = 0.15, type = "sine", vol = 0.12, delay = 0 }) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
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
  src.connect(f).connect(g).connect(c.destination); src.start(t);
}

export const sfx = {
  hit(crit) { noise({ dur: 0.1, vol: crit ? 0.2 : 0.13, freq: crit ? 900 : 1500 }); tone({ f: crit ? 180 : 140, f2: 60, dur: 0.14, type: "triangle", vol: crit ? 0.2 : 0.12 }); if (crit) tone({ f: 880, f2: 1320, dur: 0.18, type: "square", vol: 0.05, delay: 0.03 }); },
  miss() { noise({ dur: 0.18, vol: 0.05, freq: 3000 }); },
  swing() { noise({ dur: 0.14, vol: 0.06, freq: 2200 }); },
  magic() { tone({ f: 300, f2: 900, dur: 0.3, type: "sine", vol: 0.09 }); tone({ f: 450, f2: 1350, dur: 0.3, type: "triangle", vol: 0.04 }); },
  buff() { tone({ f: 400, f2: 700, dur: 0.25, type: "sine", vol: 0.08 }); tone({ f: 600, f2: 1000, dur: 0.25, type: "sine", vol: 0.05, delay: 0.08 }); },
  heal() { tone({ f: 520, dur: 0.12, vol: 0.07 }); tone({ f: 660, dur: 0.12, vol: 0.07, delay: 0.1 }); tone({ f: 880, dur: 0.2, vol: 0.07, delay: 0.2 }); },
  death() { tone({ f: 220, f2: 50, dur: 0.4, type: "sawtooth", vol: 0.08 }); },
  turn() { tone({ f: 660, dur: 0.1, type: "triangle", vol: 0.08 }); tone({ f: 990, dur: 0.16, type: "triangle", vol: 0.08, delay: 0.09 }); },
  roar() { tone({ f: 90, f2: 50, dur: 0.6, type: "sawtooth", vol: 0.12 }); noise({ dur: 0.5, vol: 0.08, freq: 400 }); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone({ f, dur: 0.22, type: "triangle", vol: 0.1, delay: i * 0.12 })); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone({ f, dur: 0.3, type: "sine", vol: 0.1, delay: i * 0.18 })); },
  click() { tone({ f: 500, dur: 0.05, type: "square", vol: 0.04 }); },
};

export const isMuted = () => muted;
export function setMuted(v) {
  muted = !!v;
  try { localStorage.setItem("aldenmoor.muted", muted ? "1" : "0"); } catch { /* ignoré */ }
}
