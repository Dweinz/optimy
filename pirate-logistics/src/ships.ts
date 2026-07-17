// Fleet management: purchasing ships at shipyards, maintenance and repair.

import type { GameState, Island, ShipTypeId } from './types';
import { SHIP_TYPES, shipDef, fmt } from './data';
import { shipUnlocked, maintenanceMult } from './tech';
import { recordGold } from './production';
import { addAlert } from './notify';

const NAMES = ['Swift Gull', 'Sea Asp', 'Rum Runner', 'Dawn Chaser', 'Iron Maid', 'Wave Cutter', 'Night Heron', 'Bold Wind', 'Coral Queen', 'Grey Ghost', 'Stout Heart', 'Far Star', 'Salt Fox', 'Old Faithful', 'Red Sky'];

export function randomShipName(s: GameState): string {
  return `${NAMES[Math.floor(Math.random() * NAMES.length)]} ${Math.floor(s.totals.shipsBuilt + 2)}`;
}

export function hasShipyard(island: Island): boolean {
  return island.buildings.some(b => b.type === 'shipyard');
}

export function canBuyShip(s: GameState, island: Island, type: ShipTypeId): { ok: boolean; reason: string } {
  const def = shipDef(type);
  if (!hasShipyard(island)) return { ok: false, reason: 'Needs a Shipyard here' };
  if (!shipUnlocked(s, def)) {
    const t = def.tech!.map(x => `${x.branch} ${x.level}`).join(' + ');
    return { ok: false, reason: `Needs ${t}` };
  }
  const missing: string[] = [];
  if (s.gold < def.costGold) missing.push(`${def.costGold} gold (have ${Math.floor(s.gold)})`);
  if (island.storage.shipParts < def.costParts) missing.push(`${def.costParts} ship parts (have ${Math.floor(island.storage.shipParts)} here)`);
  if (island.storage.cannons < def.costCannons) missing.push(`${def.costCannons} cannons (have ${Math.floor(island.storage.cannons)} here)`);
  if (island.storage.crew < def.crewReq) missing.push(`${def.crewReq} crew (have ${Math.floor(island.storage.crew)} here)`);
  if (missing.length) return { ok: false, reason: `Missing: ${missing.join(', ')}` };
  return { ok: true, reason: '' };
}

export function buyShip(s: GameState, island: Island, type: ShipTypeId): boolean {
  const check = canBuyShip(s, island, type);
  if (!check.ok) return false;
  const def = shipDef(type);
  s.gold -= def.costGold;
  recordGold(s, -def.costGold);
  island.storage.shipParts -= def.costParts;
  island.storage.cannons -= def.costCannons;
  island.storage.crew -= def.crewReq;
  s.ships.push({
    id: s.nextId++,
    name: randomShipName(s),
    type,
    state: 'idle',
    routeId: null,
    phase: 'loading',
    progress: 0,
    cargo: 0,
    homeIslandId: island.id,
    condition: 100,
  });
  s.totals.shipsBuilt++;
  addAlert(s, `${def.icon} ${def.name} launched from ${island.name}!`, 'good', true);
  return true;
}

/**
 * Maintenance drains gold continuously. An empty treasury lets hulls rot:
 * condition falls, which slows every route (see tickRoutes).
 */
export function tickMaintenance(s: GameState, dt: number): void {
  const costPerSec = s.ships.reduce((sum, sh) => sum + shipDef(sh.type).maintenance, 0) * maintenanceMult(s) / 60;
  const cost = costPerSec * dt;
  if (s.gold >= cost) {
    s.gold -= cost;
    recordGold(s, -cost);
    for (const sh of s.ships) {
      sh.condition = Math.min(100, sh.condition + 0.2 * dt);
    }
  } else {
    for (const sh of s.ships) {
      sh.condition = Math.max(10, sh.condition - 0.8 * dt);
    }
  }
}

export function scrapShip(s: GameState, shipId: number): void {
  const ship = s.ships.find(sh => sh.id === shipId);
  if (!ship || ship.state !== 'idle') return;
  const def = shipDef(ship.type);
  const refund = Math.floor(def.costGold * 0.3);
  s.gold += refund;
  recordGold(s, refund);
  s.ships = s.ships.filter(sh => sh.id !== shipId);
  addAlert(s, `${ship.name} scrapped for ${fmt(refund)} gold.`, 'warn');
}

export function fleetSummary(s: GameState): { total: number; idle: number; onRoutes: number; expeditions: number; maintenance: number } {
  return {
    total: s.ships.length,
    idle: s.ships.filter(sh => sh.state === 'idle').length,
    onRoutes: s.ships.filter(sh => sh.state === 'route').length,
    expeditions: s.ships.filter(sh => sh.state === 'expedition' || sh.state === 'colonize').length,
    maintenance: s.ships.reduce((sum, sh) => sum + shipDef(sh.type).maintenance, 0) * maintenanceMult(s),
  };
}

export const ALL_SHIP_TYPES = SHIP_TYPES;
