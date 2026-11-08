import React from "react";
import Emblem from "./Emblem.jsx";

// La sentinelle : un golem de pierre qui tient une hampe nue ; la bannière de la guilde (son blason) est posée par-dessus, en haut de la hampe.
// Le dessin fait 320 × 736 ; la hampe est à x ≈ 48, son sommet à y ≈ 4.
const W = 320, H = 736, POLE_X = 50, BANNER_TOP = 14, BANNER_SIZE = 62;

export default function SentinelSprite({ emblem, seed = "x", width = 120, title }) {
  const k = width / W;
  return (
    <div data-sentinel-sprite title={title} style={{ position: "relative", width, height: Math.round(H * k), flexShrink: 0 }}>
      <img src="/assets/sentinel/golem.png" alt="Sentinelle" width={width} height={Math.round(H * k)} draggable={false} style={{ display: "block", width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", left: POLE_X * k, top: (BANNER_TOP - 4) * k, width: BANNER_SIZE * k * 1.05, height: 5 * k, background: "#5a3b22", borderRadius: 2 }} />
      <div style={{ position: "absolute", left: (POLE_X + 3) * k, top: BANNER_TOP * k }}>
        <Emblem emblem={emblem} seed={seed} size={Math.round(BANNER_SIZE * k)} />
      </div>
    </div>
  );
}
