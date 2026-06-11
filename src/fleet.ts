// Fleet: ship stats, ordering new ships, construction and scrapping.

import type { GameState, Bonuses, ShipTypeDef } from './types';
import { SHIP_TYPES, shipType, fmt } from './data';
import { notify, logEvent } from './notifications';

const SHIP_NAMES = ['Revenge', 'Fortune', 'Siren', 'Tempest', 'Vagrant', 'Dauntless', 'Wraith', 'Petrel', 'Corsair', 'Mermaid', 'Thunder', 'Whisper', 'Leviathan', 'Albatross', 'Banshee', 'Serpent'];
const SHIP_PREFIX = ['The', 'Black', 'Crimson', 'Salty', 'Golden', 'Silent', 'Royal', 'Drowned'];

export function randomShipName(): string {
  return `${SHIP_PREFIX[Math.floor(Math.random() * SHIP_PREFIX.length)]} ${SHIP_NAMES[Math.floor(Math.random() * SHIP_NAMES.length)]}`;
}

export function fleetSpeed(s: GameState, b: Bonuses): number {
  return s.fleet.reduce((sum, sh) => sum + shipType(sh.typeId).speed, 0) * b.speed;
}

export function fleetPower(s: GameState, b: Bonuses, crewEff: number): number {
  // Undercrewed fleets fight at reduced strength.
  const crewNeeded = s.fleet.reduce((sum, sh) => sum + shipType(sh.typeId).crewReq, 0);
  const crewRatio = crewNeeded > 0 ? Math.min(1, s.crewMembers.length / crewNeeded) : 1;
  const raw = s.fleet.reduce((sum, sh) => sum + shipType(sh.typeId).power, 0);
  return raw * b.combat * (0.4 + 0.6 * crewRatio) * Math.min(2, Math.max(0.5, crewEff));
}

export function fleetCargo(s: GameState): number {
  return s.fleet.reduce((sum, sh) => sum + shipType(sh.typeId).cargo, 0);
}

export function discountedCost(t: ShipTypeDef, b: Bonuses): { gold: number; supplies: number; treasure: number } {
  const disc = Math.min(0.6, b.shipDiscount);
  return {
    gold: Math.floor(t.costGold * (1 - disc)),
    supplies: Math.floor(t.costSupplies * (1 - disc)),
    treasure: t.costTreasure,
  };
}

export function canOrderShip(s: GameState, typeId: string, b: Bonuses): { ok: boolean; reason: string } {
  const t = shipType(typeId);
  if (s.buildOrder) return { ok: false, reason: 'Shipyard busy' };
  if (s.skills.shipbuilding.level < t.skillReq) return { ok: false, reason: `Needs Shipbuilding ${t.skillReq}` };
  const cost = discountedCost(t, b);
  if (s.resources.gold < cost.gold) return { ok: false, reason: `Needs ${fmt(cost.gold)} gold` };
  if (s.resources.supplies < cost.supplies) return { ok: false, reason: `Needs ${fmt(cost.supplies)} supplies` };
  if (s.resources.treasure < cost.treasure) return { ok: false, reason: `Needs ${fmt(cost.treasure)} treasure` };
  return { ok: true, reason: '' };
}

export function orderShip(s: GameState, typeId: string, b: Bonuses): boolean {
  const check = canOrderShip(s, typeId, b);
  if (!check.ok) return false;
  const t = shipType(typeId);
  const cost = discountedCost(t, b);
  s.resources.gold -= cost.gold;
  s.resources.supplies -= cost.supplies;
  s.resources.treasure -= cost.treasure;
  s.buildOrder = { typeId, points: 0, needed: t.buildPoints };
  notify(`🔨 Construction of a ${t.name} has begun!`);
  logEvent(s, `Ordered a ${t.name} from the shipyard.`);
  return true;
}

/** Applies build points; completes the order when done. */
export function progressConstruction(s: GameState, points: number): void {
  if (!s.buildOrder) return;
  s.buildOrder.points += points;
  if (s.buildOrder.points >= s.buildOrder.needed) {
    const t = shipType(s.buildOrder.typeId);
    s.fleet.push({ id: s.nextId++, typeId: t.id, name: randomShipName() });
    s.buildOrder = null;
    s.stats.shipsBuilt++;
    notify(`⚓ ${t.name} launched! She joins your fleet.`, 'achievement');
    logEvent(s, `A new ${t.name} was launched.`);
  }
}

export function scrapValue(typeId: string): number {
  return Math.floor(shipType(typeId).costGold * 0.3);
}

export function scrapShip(s: GameState, id: number): void {
  if (s.fleet.length <= 1) {
    notify('You cannot scrap your last ship!', 'bad');
    return;
  }
  const sh = s.fleet.find(x => x.id === id);
  if (!sh) return;
  s.fleet = s.fleet.filter(x => x.id !== id);
  const val = scrapValue(sh.typeId);
  s.resources.gold += val;
  notify(`Scrapped ${sh.name} for ${fmt(val)} gold.`);
  logEvent(s, `${sh.name} was scrapped for ${fmt(val)} gold.`);
}

export function bestShipTier(s: GameState): number {
  let best = 0;
  for (const sh of s.fleet) {
    const idx = SHIP_TYPES.findIndex(t => t.id === sh.typeId);
    if (idx > best) best = idx;
  }
  return best;
}
