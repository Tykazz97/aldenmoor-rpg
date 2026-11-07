import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { getLivePopulation } from "../../sim/simWorld.js";
import { createCityLife, playerSays, pickResponder, queueSay, whereIs } from "../../sim/cityLife.js";
import { askBot, loadMemory, remember } from "../../sim/brain.js";
import { SIM_PLAYERS } from "../../sim/config.js";


// Joueurs simulés de la ville et fil de discussion (inactifs tant que SIM_PLAYERS est à false :
// `life` vaut alors null et le reste ne fait rien).
export function useCityChat({ map, isCity, playerRef, posRef }) {
  const [feed, setFeed] = useState([]);
  const [heroBubble, setHeroBubble] = useState(null);
  const feedKey = useRef(0);
  const bubbleTimer = useRef(null);
  const life = useMemo(() => (isCity && SIM_PLAYERS ? createCityLife({ map, population: getLivePopulation(), seed: (Date.now() & 0xfffff) + 1 }) : null), [isCity, map]);
  const addFeed = useCallback((m) => setFeed((f) => [...f, { ...m, key: ++feedKey.current }].slice(-40)), []);
  useEffect(() => {
    setFeed(life ? life.history.map((h) => ({ ...h, key: ++feedKey.current })) : []);
  }, [life]);
  const onCityEvents = useCallback((evs) => { for (const e of evs) if (e.type === "say") addFeed(e); }, [addFeed]);
  const feedRef = useRef(feed);
  feedRef.current = feed;
  const sendChat = useCallback(async (text) => {
    const pl = playerRef.current;
    addFeed({ name: pl.name, level: pl.level, text, me: true });
    setHeroBubble(text);
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setHeroBubble(null), 5500);
    if (!life) return;
    // un simulé répond : via le modèle de langage si disponible, sinon avec une phrase préécrite
    const agent = pickResponder(life, text, posRef.current);
    if (!agent) return;
    const reply = await askBot({
      bot: agent.bot, place: whereIs(life, agent), player: { name: pl.name, classKey: pl.classKey, level: pl.level },
      message: text, history: loadMemory(agent.id),
      feed: feedRef.current.filter((m) => !m.me).slice(-5).map((m) => ({ name: m.name, text: m.text })),
    });
    if (reply) {
      remember(agent.id, [{ me: true, text }, { me: false, text: reply }]);
      queueSay(life, agent.id, reply, 0.5 + Math.min(2.5, reply.length * 0.05));   // le temps de taper
    } else playerSays(life, text);
  }, [addFeed, life]);
  useEffect(() => () => clearTimeout(bubbleTimer.current), []);

  return { life, feed, heroBubble, sendChat, onCityEvents };
}
