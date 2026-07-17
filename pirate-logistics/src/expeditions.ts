// Expeditions: exploration (lifting fog of war), looting ruins/treasure
// sites, and colonization of new islands.

import type { GameState, Island, Expedition } from './types';
import { shipDef, fmt } from './data';
import { islandById, distance } from './world';
import { expeditionRisk, expeditionSpeedMult, shipSpeedMult, techLevel } from './tech';
import { addToStorage, hasDock, recordProd } from './production';
import { addAlert } from './notify';

export interface ExpeditionCost {
  crew: number;
  food: number;
  rum: number;
}

export const EXPLORE_COST: ExpeditionCost = { crew: 3, food: 10, rum: 3 };
export const COLONIZE_COST = { crew: 5, food: 20, wood: 40, stone: 20 };

export function nearestUndiscovered(s: GameState, from: Island): Island | null {
  let best: Island | null = null;
  let bestD = Infinity;
  for (const isl of s.islands) {
    if (isl.discovered) continue;
    const d = distance(from, isl);
    if (d < bestD) { bestD = d; best = isl; }
  }
  return best;
}

export function lootableIslands(s: GameState): Island[] {
  return s.islands.filter(i =>
    i.discovered && !i.looted && (i.traits.includes('ruins') || i.traits.includes('treasureSite')),
  );
}

function payCost(island: Island, cost: ExpeditionCost): boolean {
  if (island.storage.crew < cost.crew || island.storage.food < cost.food || island.storage.rum < cost.rum) return false;
  island.storage.crew -= cost.crew;
  island.storage.food -= cost.food;
  island.storage.rum -= cost.rum;
  return true;
}

export function canLaunchExpedition(s: GameState, fromId: number, kind: 'explore' | 'loot'): { ok: boolean; reason: string } {
  const from = islandById(s, fromId);
  if (!from || !from.owned || !hasDock(from)) return { ok: false, reason: 'Needs an owned island with a dock' };
  if (!s.ships.some(sh => sh.state === 'idle')) return { ok: false, reason: 'Needs an idle ship' };
  const c = EXPLORE_COST;
  if (from.storage.crew < c.crew) return { ok: false, reason: `Needs ${c.crew} crew here` };
  if (from.storage.food < c.food) return { ok: false, reason: `Needs ${c.food} food here` };
  if (from.storage.rum < c.rum) return { ok: false, reason: `Needs ${c.rum} rum here` };
  if (kind === 'explore' && !nearestUndiscovered(s, from)) return { ok: false, reason: 'Every island is already charted!' };
  if (kind === 'loot' && lootableIslands(s).length === 0) return { ok: false, reason: 'No known ruins or treasure sites to loot' };
  return { ok: true, reason: '' };
}

export function launchExpedition(s: GameState, fromId: number, kind: 'explore' | 'loot'): boolean {
  const check = canLaunchExpedition(s, fromId, kind);
  if (!check.ok) return false;
  const from = islandById(s, fromId)!;
  const ship = s.ships.find(sh => sh.state === 'idle')!;

  let target: Island | null = null;
  if (kind === 'explore') {
    target = nearestUndiscovered(s, from);
  } else {
    const options = lootableIslands(s);
    options.sort((a, b) => distance(from, a) - distance(from, b));
    target = options[0] ?? null;
  }
  if (!target) return false;
  if (!payCost(from, EXPLORE_COST)) return false;

  const def = shipDef(ship.type);
  const travel = distance(from, target) / (def.speed * shipSpeedMult(s));
  const duration = Math.max(15, (travel * 2 + 20) / expeditionSpeedMult(s));

  ship.state = 'expedition';
  s.expeditions.push({
    id: s.nextId++, shipId: ship.id, fromId, targetId: target.id, kind,
    timeLeft: duration, duration,
  });
  addAlert(s, `🔭 ${ship.name} sets out ${kind === 'explore' ? 'to chart unknown waters' : `to loot ${target.name}`} (${Math.round(duration)}s)`, 'good');
  return true;
}

export function canColonize(s: GameState, fromId: number, targetId: number): { ok: boolean; reason: string } {
  const from = islandById(s, fromId);
  const target = islandById(s, targetId);
  if (!from || !from.owned || !hasDock(from)) return { ok: false, reason: 'Pick an owned source island with a dock' };
  if (!target || !target.discovered) return { ok: false, reason: 'Target not discovered' };
  if (target.owned) return { ok: false, reason: 'Already yours' };
  if (!s.ships.some(sh => sh.state === 'idle')) return { ok: false, reason: 'Needs an idle ship' };
  const c = COLONIZE_COST;
  if (from.storage.crew < c.crew) return { ok: false, reason: `Needs ${c.crew} crew at ${from.name}` };
  if (from.storage.food < c.food) return { ok: false, reason: `Needs ${c.food} food at ${from.name}` };
  if (from.storage.wood < c.wood) return { ok: false, reason: `Needs ${c.wood} wood at ${from.name}` };
  if (from.storage.stone < c.stone) return { ok: false, reason: `Needs ${c.stone} stone at ${from.name}` };
  return { ok: true, reason: '' };
}

export function colonize(s: GameState, fromId: number, targetId: number): boolean {
  const check = canColonize(s, fromId, targetId);
  if (!check.ok) { addAlert(s, `Cannot colonize: ${check.reason}`, 'warn'); return false; }
  const from = islandById(s, fromId)!;
  const target = islandById(s, targetId)!;
  const ship = s.ships.find(sh => sh.state === 'idle')!;

  from.storage.crew -= COLONIZE_COST.crew;
  from.storage.food -= COLONIZE_COST.food;
  from.storage.wood -= COLONIZE_COST.wood;
  from.storage.stone -= COLONIZE_COST.stone;

  const def = shipDef(ship.type);
  const duration = Math.max(10, distance(from, target) / (def.speed * shipSpeedMult(s)) + 12);
  ship.state = 'colonize';
  s.expeditions.push({
    id: s.nextId++, shipId: ship.id, fromId, targetId, kind: 'colonize',
    timeLeft: duration, duration,
  });
  addAlert(s, `🏴‍☠️ Colony ship ${ship.name} departs for ${target.name} (${Math.round(duration)}s)`, 'good');
  return true;
}

function resolveExpedition(s: GameState, e: Expedition): void {
  const ship = s.ships.find(sh => sh.id === e.shipId);
  const from = islandById(s, e.fromId);
  const target = islandById(s, e.targetId);
  if (!ship || !from || !target) return;

  if (e.kind === 'colonize') {
    target.owned = true;
    target.discovered = true;
    target.buildings.push({ id: s.nextId++, type: 'dock', level: 1, recipeIndex: 0, progress: 0, status: 'idle' });
    target.storage.crew = 5;
    target.storage.food = 10;
    ship.state = 'idle';
    ship.homeIslandId = target.id;
    addAlert(s, `🏝️ ${target.name} is now under your flag! A dock has been raised.`, 'good', true);
    return;
  }

  // Risk of losing the ship entirely (softened by Navigation tech).
  if (Math.random() < expeditionRisk(s)) {
    s.ships = s.ships.filter(sh => sh.id !== ship.id);
    s.totals.shipsLost++;
    addAlert(s, `🌊 ${ship.name} was lost at sea with all hands...`, 'bad');
    return;
  }
  ship.state = 'idle';
  s.totals.expeditions++;

  const mapYield = 1 + (techLevel(s, 'exploration') >= 1 ? 1 : 0);
  const lootMult = techLevel(s, 'exploration') >= 2 ? 2 : 1;

  if (e.kind === 'explore') {
    target.discovered = true;
    const got = addToStorage(s, from, 'maps', mapYield);
    recordProd(s, 'maps', got);
    addAlert(s, `🗺️ ${ship.name} charted ${target.name}! +${mapYield} maps at ${from.name}`, 'good', true);
  } else {
    target.looted = true;
    let treasure = 0;
    if (target.traits.includes('treasureSite')) treasure += (2 + Math.floor(Math.random() * 3)) * lootMult;
    if (target.traits.includes('ruins')) treasure += (1 + Math.floor(Math.random() * 2)) * lootMult;
    const gotT = addToStorage(s, from, 'treasure', treasure);
    const gotM = addToStorage(s, from, 'maps', mapYield);
    recordProd(s, 'treasure', gotT);
    recordProd(s, 'maps', gotM);
    s.totals.treasureFound += gotT;
    s.influence += 2;
    addAlert(s, `💎 ${ship.name} looted ${target.name}: +${fmt(gotT)} treasure, +${gotM} maps (delivered to ${from.name})`, 'good', true);
  }
}

export function tickExpeditions(s: GameState, dt: number): void {
  for (const e of [...s.expeditions]) {
    e.timeLeft -= dt;
    if (e.timeLeft <= 0) {
      s.expeditions = s.expeditions.filter(x => x.id !== e.id);
      resolveExpedition(s, e);
    }
  }
  // Loot sites slowly replenish so exploration stays a renewable loop.
  if (Math.random() < 0.002 * dt) {
    const looted = s.islands.filter(i => i.looted);
    if (looted.length > 0) {
      const isl = looted[Math.floor(Math.random() * looted.length)];
      isl.looted = false;
    }
  }
}

/** Render position for ships on expeditions (out-and-back along the line). */
export function expeditionShipPos(s: GameState, shipId: number): { x: number; z: number } | null {
  const e = s.expeditions.find(x => x.shipId === shipId);
  if (!e) return null;
  const from = islandById(s, e.fromId);
  const target = islandById(s, e.targetId);
  if (!from || !target) return null;
  const t = 1 - e.timeLeft / e.duration;
  const leg = e.kind === 'colonize' ? t : (t < 0.5 ? t * 2 : (1 - t) * 2);
  return { x: from.x + (target.x - from.x) * leg, z: from.z + (target.z - from.z) * leg };
}
