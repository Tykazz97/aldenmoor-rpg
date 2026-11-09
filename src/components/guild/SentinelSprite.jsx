import React from "react";
import Emblem from "./Emblem.jsx";

// La sentinelle : un golem de pierre qui tient une hampe nue ; la bannière de la guilde (son blason) est posée par-dessus, en haut de la hampe.
// Le dessin fait 320 × 736 ; la hampe est à x ≈ 48, son sommet à y ≈ 4.
const W = 320, H = 736, POLE_X = 50, BANNER_TOP = 14, BANNER_SIZE = 62;

// `flip` : le golem regarde vers la droite (quand il combat aux côtés du joueur) ; la bannière suit la hampe sans être retournée
export default function SentinelSprite({ emblem, seed = "x", width = 120, title, flip = false }) {
  const k = width / W, bar = BANNER_SIZE * 1.05;
  return (
    <div data-sentinel-sprite title={title} style={{ position: "relative", width, height: Math.round(H * k), flexShrink: 0 }}>
      <img src="/assets/sentinel/golem.webp" alt="Sentinelle" width={width} height={Math.round(H * k)} draggable={false} style={{ display: "block", width: "100%", height: "100%", transform: flip ? "scaleX(-1)" : undefined }} />
      <div style={{ position: "absolute", left: (flip ? W - POLE_X - bar : POLE_X) * k, top: (BANNER_TOP - 4) * k, width: bar * k, height: 5 * k, background: "#5a3b22", borderRadius: 2 }} />
      <div style={{ position: "absolute", left: (flip ? W - POLE_X - 3 - BANNER_SIZE : POLE_X + 3) * k, top: BANNER_TOP * k }}>
        <Emblem emblem={emblem} seed={seed} size={Math.round(BANNER_SIZE * k)} />
      </div>
    </div>
  );
}
