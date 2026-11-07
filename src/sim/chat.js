// ============================================================
// Ce que disent les joueurs simulés dans le hub. Des phrases courtes, comme dans un vrai chat :
// recherche de groupe, échange de ressources, questions de débutants, bavardage.
// {lvl} = niveau du joueur, {zone}/{res}/{mob} = éléments du jeu.
// ============================================================
const ZONES = ["les Prairies", "les Prairies Sauvages", "les Champs Calcinés"];
const RES = ["du frêne", "du chêne", "du minerai de fer", "du cuivre", "de l'ortie", "de la sauge", "des crocs de loup", "des peaux de sanglier"];
const MOBS = ["les loups", "les sangliers", "les bandits", "le boss des prairies"];

const BY_ACTIVITY = {
  combattant: [
    "Quelqu'un pour farmer {mob} ? Je suis niv {lvl}",
    "Cherche un groupe pour {zone}, niv {lvl}",
    "{mob} drop bien en ce moment ?",
    "Qui veut faire {mob} avec moi ?",
    "Je pars chasser {mob}, rdv au portail",
    "Le boss des prairies m'a encore roulé dessus...",
    "Un petit donjon ce soir, ça tente ?",
  ],
  recolteur: [
    "Je cherche {res}, quelqu'un en a ?",
    "Qui vend {res} ?",
    "Je monte mon métier, {res} à gogo en ce moment",
    "Atelier : il me manque {res} pour mon craft",
    "Ça pousse bien du côté de {zone}",
    "Je range mon sac au coffre et je repars récolter",
  ],
  marchand: [
    "Achète {res}, bon prix",
    "Vend {res}, MP",
    "Le marché ouvre bientôt, il parait",
    "Vous avez vu les prix {res} ? n'importe quoi",
    "Je prépare un stock pour l'ouverture du marché",
  ],
  flaneur: [
    "Salut tout le monde",
    "Belle ville quand même",
    "Quelqu'un sait où acheter du stuff au niveau {lvl} ?",
    "Je viens de commencer, des conseils ?",
    "C'est quoi la meilleure classe pour débuter ?",
    "Je traîne un peu en ville avant de repartir",
    "Y'a du monde aujourd'hui !",
    "Qui connaît une guilde sympa ?",
    "Bon, j'y retourne",
  ],
};
const REPLIES = {
  group: ["Je viens !", "Moi aussi je cherche", "go, rdv au portail", "Niv {lvl} ici, je peux venir", "Dans 5 min je suis dispo"],
  trade: ["Passe me voir, j'en ai", "Moi j'en ai un peu, MP", "Pas ce soir désolé", "Combien tu en veux ?"],
  help: ["Prends guerrier, c'est plus simple", "Fais les Prairies d'abord, c'est tranquille", "Regarde l'atelier, ça aide pour l'équipement", "Bienvenue !"],
  hello: ["Salut !", "Hello", "Bonsoir", "yo", "Bienvenue à Aldenmoor"],
};
const GROUP_RX = /(groupe|farmer|chasser|donjon|rdv|boss)/i, TRADE_RX = /(vend|achète|achete|cherche (du|de|des)|qui vend|prix)/i, HELP_RX = /(conseil|débuter|debuter|commencé|classe)/i;

const fill = (tpl, rng, bot) => tpl
  .replace("{lvl}", bot.level).replace("{zone}", rng.pick(ZONES)).replace("{res}", rng.pick(RES)).replace("{mob}", rng.pick(MOBS));
const casualize = (t) => t.toLowerCase().replace(/[.!?…]+$/g, "").replace(/'/g, "'");

export function sayLine(rng, bot) {
  const text = fill(rng.pick(BY_ACTIVITY[bot.activity] || BY_ACTIVITY.flaneur), rng, bot);
  return bot.casual ? casualize(text) : text;
}
export function replyKind(text) {
  if (/^(salut|bonjour|bonsoir|hello|coucou|slt|yo)\b/i.test(text.trim())) return "hello";
  if (GROUP_RX.test(text)) return "group";
  if (HELP_RX.test(text)) return "help";
  if (TRADE_RX.test(text)) return "trade";
  return null;
}
export function replyLine(rng, bot, text) {
  const kind = replyKind(text);
  if (!kind) return null;
  const r = fill(rng.pick(REPLIES[kind]), rng, bot);
  return bot.casual ? casualize(r) : r;
}
