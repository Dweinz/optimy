// Port buildings: costs, upgrades and passive production.

import type { GameState, BuildingId, Bonuses } from './types';
import { BUILDINGS, fmt } from './data';
import { hireCrewMember } from './crew';
import { notify, logEvent } from './notifications';

export function buildingCost(id: BuildingId, level: number): number {
  const def = BUILDINGS.find(b => b.id === id)!;
  return Math.floor(def.baseCost * Math.pow(def.costMult, level));
}

export function upgradeBuilding(s: GameState, id: BuildingId): boolean {
  const lvl = s.buildings[id];
  const cost = buildingCost(id, lvl);
  if (s.resources.gold < cost) return false;
  s.resources.gold -= cost;
  s.buildings[id] = lvl + 1;
  const def = BUILDINGS.find(b => b.id === id)!;
  notify(`${def.icon} ${def.name} upgraded to level ${lvl + 1}!`);
  logEvent(s, `${def.name} upgraded to level ${lvl + 1} (${fmt(cost)} gold).`);
  return true;
}

export function totalBuildingLevels(s: GameState): number {
  return BUILDINGS.reduce((sum, def) => sum + s.buildings[def.id], 0);
}

/** Passive production from port buildings, runs every tick. */
export function tickPort(s: GameState, dt: number, b: Bonuses): void {
  // Warehouse stockpiles provisions.
  if (s.buildings.warehouse > 0) {
    s.resources.supplies += 0.06 * s.buildings.warehouse * b.supplies * dt;
  }
  // Tavern brews rum and occasionally attracts a free recruit.
  if (s.buildings.tavern > 0) {
    s.resources.rum += 0.05 * s.buildings.tavern * b.rum * dt;
    const p = 0.0004 * s.buildings.tavern * b.recruit * dt;
    if (Math.random() < Math.min(0.5, p)) {
      const m = hireCrewMember(s, true);
      if (m) {
        notify(`🍺 ${m.name} signed on at the tavern!`);
        logEvent(s, `${m.name} joined the crew at the tavern.`);
      }
    }
  }
  // Market auto-sells generic trade goods.
  if (s.buildings.market > 0 && s.resources.tradeGoods > 0) {
    const sold = Math.min(s.resources.tradeGoods, 0.2 * s.buildings.market * dt);
    s.resources.tradeGoods -= sold;
    const earned = sold * 3 * b.trade;
    s.resources.gold += earned;
    s.stats.totalGold += earned;
    s.stats.goodsTraded += sold;
  }
  // Shipyard contributes passive construction.
  if (s.buildings.shipyard > 0 && s.buildOrder) {
    // progressConstruction is handled by the caller via returned points to
    // avoid circular churn — kept simple: import-free arithmetic here.
    s.buildOrder.points += 0.15 * s.buildings.shipyard * dt;
  }
}
