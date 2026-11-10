
// ============================================================
// Icônes de slots d'équipement — silhouettes SVG dessinées à la
// main, réutilisées de la V1. Utilisent currentColor pour
// s'adapter au thème (gris muet = vide, or = rempli).
// ============================================================

const SLOT_ICONS = {
  chapeau: (
    <svg viewBox="0 0 40 40" width="38" height="38" style={{display:"block"}} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 28 Q8 12 20 10 Q32 12 32 28 Z" stroke="currentColor" strokeWidth="2.5" fill="none"/>
      <rect x="6" y="27" width="28" height="6" rx="3" fill="none" stroke="currentColor" strokeWidth="2"/>
      <rect x="15" y="29" width="10" height="3" rx="1.5" fill="rgba(0,0,0,0.35)"/>
      <line x1="20" y1="10" x2="20" y2="17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      <circle cx="20" cy="9" r="2.5" fill="currentColor"/>
    </svg>
  ),
  cape: (
    <svg viewBox="0 0 40 40" width="38" height="38" style={{display:"block"}} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 8 Q20 5 28 8 L33 34 Q20 29 7 34 Z" stroke="currentColor" strokeWidth="2.5" fill="none"/>
      <path d="M12 8 Q20 12 28 8" stroke="currentColor" strokeWidth="2.5" fill="none"/>
      <circle cx="20" cy="8" r="3" fill="currentColor"/>
    </svg>
  ),
  plastron: (
    <svg viewBox="0 0 40 40" width="38" height="38" style={{display:"block"}} fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="10" cy="13" rx="6" ry="5" fill="none" stroke="currentColor" strokeWidth="2"/>
      <ellipse cx="30" cy="13" rx="6" ry="5" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M10 14 L10 32 Q10 35 20 35 Q30 35 30 32 L30 14 Q25 11 20 11 Q15 11 10 14Z" fill="none" stroke="currentColor" strokeWidth="2.5"/>
      <line x1="20" y1="13" x2="20" y2="34" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M11 21 Q20 25 29 21" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    </svg>
  ),
  gants: (
    <svg viewBox="0 0 40 40" width="38" height="38" style={{display:"block"}} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 18 L10 34 Q10 37 14 37 L26 37 Q30 37 30 34 L30 18 Q28 15 25 16 L25 12 Q25 9 22 9 Q19 9 19 12 L19 15 Q18 12 15 12 Q12 12 12 15 L12 18 Q11 15 10 18Z" fill="none" stroke="currentColor" strokeWidth="2"/>
      <line x1="19" y1="14" x2="19" y2="22" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="12" y1="17" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="26" y1="16" x2="26" y2="22" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  ceinture: (
    <svg viewBox="0 0 40 40" width="38" height="38" style={{display:"block"}} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="15" width="32" height="10" rx="5" fill="none" stroke="currentColor" strokeWidth="2.5"/>
      <rect x="14" y="13" width="12" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
      <line x1="20" y1="15" x2="20" y2="27" stroke="currentColor" strokeWidth="2"/>
      <line x1="14" y1="20" x2="26" y2="20" stroke="currentColor" strokeWidth="2"/>
      <circle cx="20" cy="20" r="3" fill="currentColor"/>
    </svg>
  ),
  jambieres: (
    <svg viewBox="0 0 40 40" width="38" height="38" style={{display:"block"}} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 6 L9 26 Q9 32 13 33 L15 33 L15 26 L12 26 L12 6 Z" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M21 6 L21 26 Q21 32 25 33 L27 33 L27 26 L24 26 L24 6 Z" fill="none" stroke="currentColor" strokeWidth="2"/>
      <line x1="9" y1="16" x2="12" y2="16" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="24" y1="16" x2="27" y2="16" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="9" y1="22" x2="12" y2="22" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="24" y1="22" x2="27" y2="22" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  anneau: (
    <svg viewBox="0 0 40 40" width="38" height="38" style={{display:"block"}} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="24" r="11" stroke="currentColor" strokeWidth="3" fill="none"/>
      <circle cx="20" cy="24" r="6" stroke="currentColor" strokeWidth="2" fill="none"/>
      <polygon points="20,13 23,18 20,16 17,18" fill="currentColor"/>
      <circle cx="20" cy="13" r="4" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="20" cy="13" r="2" fill="currentColor"/>
    </svg>
  ),
  amulette: (
    <svg viewBox="0 0 40 40" width="38" height="38" style={{display:"block"}} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 8 Q20 5 26 8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <line x1="20" y1="6" x2="20" y2="16" stroke="currentColor" strokeWidth="2"/>
      <circle cx="20" cy="26" r="9" fill="none" stroke="currentColor" strokeWidth="2.5"/>
      <circle cx="20" cy="26" r="5" fill="rgba(0,0,0,0.35)" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="20" cy="26" r="2.5" fill="currentColor"/>
    </svg>
  ),
  arme: (
    <svg viewBox="0 0 40 40" width="38" height="38" style={{display:"block"}} fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="20" y1="4" x2="20" y2="30" stroke="currentColor" strokeWidth="3"/>
      <path d="M20 4 L17 10 L20 9 L23 10 Z" fill="currentColor"/>
      <line x1="10" y1="26" x2="30" y2="26" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"/>
      <rect x="18" y="26" width="4" height="10" rx="2" fill="currentColor"/>
    </svg>
  ),
  bouclier: (
    <svg viewBox="0 0 40 40" width="38" height="38" style={{display:"block"}} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 4 L33 9 L33 22 Q33 32 20 36 Q7 32 7 22 L7 9 Z" fill="none" stroke="currentColor" strokeWidth="2.5"/>
      <path d="M20 9 L28 13 L28 22 Q28 28 20 31 Q12 28 12 22 L12 13 Z" fill="rgba(0,0,0,0.35)" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="20" y1="12" x2="20" y2="29" stroke="currentColor" strokeWidth="2"/>
      <line x1="13" y1="20" x2="27" y2="20" stroke="currentColor" strokeWidth="2"/>
    </svg>
  ),
  relique1: null,
  relique2: null,
  relique3: null,
  relique4: null,
};

export default SLOT_ICONS;
