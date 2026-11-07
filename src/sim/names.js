// Pseudos de joueurs simulés : le mélange qu'on trouve dans un vrai MMO francophone
// (noms fantasy, prénoms + chiffres, jeux de mots, pseudos de gamer).
const START = ["Kae", "Dra", "Syr", "Lun", "Mor", "Thal", "Eri", "Vael", "Gor", "Nym", "Ash", "Bael", "Cor", "Fen", "Isol", "Jor", "Kyr", "Lir", "Mal", "Nor", "Orin", "Pyr", "Rhae", "Sel", "Tor", "Ulf", "Var", "Wyn", "Zeph", "Alar", "Bran", "Cael", "Dun", "Elr", "Garr", "Hal"];
const MID = ["", "", "a", "e", "i", "o", "ra", "li", "ne", "va", "dro", "sa", "mi", "ta"];
const END = ["ith", "or", "ys", "an", "iel", "ak", "eth", "us", "ia", "en", "ard", "on", "wen", "ric", "dor", "mir", "as", "el", "in", "os"];
const FIRST = ["Léo", "Hugo", "Lina", "Théo", "Maëlle", "Nolan", "Chloé", "Axel", "Inès", "Enzo", "Manon", "Jules", "Camille", "Lucas", "Zoé", "Louis", "Emma", "Rémi", "Sarah", "Tom", "Alix", "Noé", "Elsa", "Max", "Lola", "Gaël", "Anaïs", "Yanis", "Océane", "Bastien"];
const WORDS = ["Tonton_Hache", "LaDameDuLac", "Gobelin_Gourmand", "PetitPain", "MaitreGrimoire", "Le_Vieux_Loup", "SansPeur", "Baguette_Sacree", "Croque_Loup", "DameCorbeau", "Fromage_Ardent", "Le_Boulanger", "TeteDeLoup", "Rat_Savant", "Poule_Guerriere", "Chevalier_Pasta", "Moine_Fou", "Sire_Tartine", "PotionSeller", "Vagabond", "Dernier_Lame", "Ombre_Douce", "Fée_Clochette", "Gros_Marteau", "Mage_Cafe", "TrollDuDimanche", "Capitaine_Rouille", "Soupe_Magique", "LeBucheron", "Mineur_Dur"];
const SUFFIXES = ["", "", "", "_", "x", "FR", "77", "92", "69", "13", "01", "666", "2k", "xD"];

export function makePseudo(rng) {
  const style = rng.weighted([["fantasy", 46], ["firstnum", 22], ["words", 14], ["gamer", 10], ["lower", 8]]);
  let n;
  if (style === "fantasy") n = rng.pick(START) + rng.pick(MID) + rng.pick(END) + (rng.chance(0.25) ? rng.int(1, 99) : "");
  else if (style === "firstnum") n = rng.pick(FIRST) + (rng.chance(0.5) ? "_" : "") + (rng.chance(0.6) ? rng.int(1, 99) : rng.int(1980, 2008));
  else if (style === "words") n = rng.pick(WORDS) + (rng.chance(0.3) ? rng.int(1, 99) : "");
  else if (style === "gamer") n = rng.chance(0.6) ? `xX_${rng.pick(START)}${rng.pick(END)}_Xx` : `_${rng.pick(START)}${rng.pick(END)}_`;
  else n = (rng.pick(START) + rng.pick(END)).toLowerCase() + rng.pick(SUFFIXES);
  return n.replace(/[^A-Za-zÀ-ÿ0-9_]/g, "").slice(0, 16);
}
