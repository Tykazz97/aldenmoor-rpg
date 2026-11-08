import React from "react";
import Emblem from "./Emblem.jsx";
import { PALETTE, SHAPES, MOTIFS, SYMBOLS, randomEmblem } from "../../data/emblems.js";

// L'éditeur de blason de la création de guilde (comme dans Dofus) : aperçu en direct, forme, motif, deux couleurs de fond, symbole et sa couleur.
function Swatches({ value, onPick, k }) {
  return (
    <div className="gd-sw">
      {PALETTE.map((c, i) => <button key={i} type="button" className={`gd-swatch${value === i ? " on" : ""}`} style={{ background: c.hex }} title={c.name} aria-label={c.name} data-gd-em={`${k}-${i}`} onClick={() => onPick(i)} />)}
    </div>
  );
}

function Choices({ items, value, onPick, k, render }) {
  return (
    <div className="gd-ch">
      {items.map((it, i) => <button key={i} type="button" className={`gd-choice${value === i ? " on" : ""}`} title={it.name} aria-label={it.name} data-gd-em={`${k}-${i}`} onClick={() => onPick(i)}>{render(it, i)}</button>)}
    </div>
  );
}

export default function EmblemEditor({ emblem, onChange }) {
  const set = (patch) => onChange({ ...emblem, ...patch });
  const shapeIcon = (s) => <svg viewBox="0 0 100 120" width="22" height="26" aria-hidden><path d={s.d} fill="currentColor" /></svg>;
  const motifIcon = (m, i) => (
    <svg viewBox="0 0 100 120" width="22" height="26" aria-hidden>
      <defs><clipPath id={`gdm${i}`}><path d={SHAPES[0].d} /></clipPath></defs>
      <path d={SHAPES[0].d} fill="#555566" />{m.d && <path d={m.d} fill="#d9d0bd" clipPath={`url(#gdm${i})`} />}
    </svg>
  );
  const symIcon = (s) => s.img
    ? <div style={{ width: 24, height: 24, background: "#d9d0bd", WebkitMaskImage: `url(${s.img})`, maskImage: `url(${s.img})`, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" }} />
    : <svg viewBox="0 0 100 100" width="24" height="24" style={{ color: "#d9d0bd" }} aria-hidden dangerouslySetInnerHTML={{ __html: s.svg }} />;
  return (
    <div className="gd-emblem" data-gd-emblem-editor>
      <div className="gd-em-prev">
        <Emblem emblem={emblem} size={96} />
        <button type="button" className="gd-mini" data-gd-em-random onClick={() => onChange(randomEmblem(`${Date.now()}:${Math.random()}`))}>🎲 Au hasard</button>
      </div>
      <div className="gd-em-opts">
        <div className="gd-label">Forme</div>
        <Choices items={SHAPES} value={emblem.shape} k="shape" onPick={(i) => set({ shape: i })} render={shapeIcon} />
        <div className="gd-label">Motif</div>
        <Choices items={MOTIFS} value={emblem.motif} k="motif" onPick={(i) => set({ motif: i })} render={motifIcon} />
        <div className="gd-label">Couleur du fond</div>
        <Swatches value={emblem.c1} k="c1" onPick={(i) => set({ c1: i })} />
        <div className="gd-label">Couleur du motif et du bord</div>
        <Swatches value={emblem.c2} k="c2" onPick={(i) => set({ c2: i })} />
        <div className="gd-label">Symbole</div>
        <Choices items={SYMBOLS} value={emblem.sym} k="sym" onPick={(i) => set({ sym: i })} render={symIcon} />
        <div className="gd-label">Couleur du symbole</div>
        <Swatches value={emblem.c3} k="c3" onPick={(i) => set({ c3: i })} />
      </div>
    </div>
  );
}
