// ============================================================
// VILLES — chaque grande région (zone) dépend d'une ville, dont l'atelier prélève une taxe de fabrication (utils/cityTax.js).
// Où que tu sois dans la grande région (la ville, la prairie, la lisière…), le raccourci « Atelier » t'ouvre l'atelier de SA ville :
// c'est la taxe de cette ville qui s'applique. Aujourd'hui : une seule ville, Aldenmoor, sans guilde (taxe par défaut, 1 %).
// Plus tard : `guild` désignera la guilde qui contrôle la ville et fixera `taxRate` (0 % à 5 %), versé dans `world.cities[ville].taxRate`.
// ============================================================
import { MAPS, CITY_KEY } from "./maps.js";
import { ZONES } from "./zones.js";
import { DEFAULT_TAX_RATE, clampTaxRate } from "../utils/cityTax.js";

export const CITIES = {
  aldenmoor: { key: "aldenmoor", name: "Aldenmoor", zone: "aldenmoor", cityMap: CITY_KEY, taxRate: DEFAULT_TAX_RATE, guild: null },
};
export const CITY_ORDER = Object.keys(CITIES);

// La zone d'une carte (la ville elle-même ou l'une de ses régions)
export function zoneOfMap(mapKey) {
  const map = MAPS[mapKey];
  if (!map) return null;
  for (const z of Object.values(ZONES)) if (z.regions.some((r) => r.key === map.regionKey)) return z.key;
  return Object.values(CITIES).find((c) => c.cityMap === mapKey)?.zone || null;
}
// La ville dont dépend l'endroit où l'on se trouve (null hors de toute zone)
export const cityOfMap = (mapKey) => Object.values(CITIES).find((c) => c.zone === zoneOfMap(mapKey)) || null;
// Taux en vigueur : celui que la guilde a fixé (world.cities[ville].taxRate), sinon le taux par défaut de la ville ; toujours entre 0 % et 5 %
export const cityTaxRate = (world, cityKey) => clampTaxRate(world?.cities?.[cityKey]?.taxRate ?? CITIES[cityKey]?.taxRate);
// Ce que l'atelier doit savoir de l'endroit où l'on se trouve : { key, name, rate, guild, place } ; la ville par défaut hors de toute zone
export function workshopOf(world) {
  const city = cityOfMap(world?.mapKey) || CITIES.aldenmoor;
  const map = MAPS[world?.mapKey];
  const region = map && Object.values(ZONES).flatMap((z) => z.regions).find((r) => r.key === map.regionKey);
  return { key: city.key, name: city.name, rate: cityTaxRate(world, city.key), guild: city.guild, place: region?.name || null };     // place : la région où l'on se trouve (null en ville)
}
