import { useId } from "react";
import { PALETTE, SHAPES, MOTIFS, SYMBOLS, cleanEmblem, randomEmblem } from "../../data/emblems.js";

// Le blason d'une guilde : forme d'écu + motif (deux couleurs) + symbole teinté. `seed` : sans blason enregistré, on en tire un à partir de cette graine.
export default function Emblem({ emblem, seed = "x", size = 48, title }) {
  const e = emblem ? cleanEmblem(emblem) : randomEmblem(seed);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const shape = SHAPES[e.shape], motif = MOTIFS[e.motif], sym = SYMBOLS[e.sym];
  const c1 = PALETTE[e.c1].hex, c2 = PALETTE[e.c2].hex, c3 = PALETTE[e.c3].hex;
  const h = Math.round(size * 1.2);
  return (
    <div data-emblem title={title} style={{ position: "relative", width: size, height: h, flexShrink: 0 }}>
      <svg viewBox="0 0 100 120" width={size} height={h} aria-hidden style={{ display: "block", filter: "drop-shadow(0 1px 2px rgba(0,0,0,.6))" }}>
        <defs><clipPath id={`c${uid}`}><path d={shape.d} /></clipPath></defs>
        <path d={shape.d} fill={c1} />
        {motif.d && <path d={motif.d} fill={c2} clipPath={`url(#c${uid})`} />}
        <path d={shape.d} fill="none" stroke={c2} strokeWidth="4" strokeLinejoin="round" />
      </svg>
      <div style={{ position: "absolute", left: "25%", top: "29%", width: "50%", height: `${(50 / 120) * 100}%` }}>
        {sym.img ? (
          <div style={{ width: "100%", height: "100%", background: c3, WebkitMaskImage: `url(${sym.img})`, maskImage: `url(${sym.img})`, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" }} />
        ) : (
          <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ color: c3, display: "block" }} aria-hidden dangerouslySetInnerHTML={{ __html: sym.svg }} />
        )}
      </div>
    </div>
  );
}
