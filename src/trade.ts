// Trading: fluctuating prices, cargo buy/sell, trade routes and the market.

import type { GameState, Bonuses } from './types';
import { TRADE_GOODS, ISLANDS, fmt } from './data';
import { fleetCargo } from './fleet';
import { notify } from './notifications';

/** Random-walk prices around a slow sine drift, clamped to sane bounds. */
export function fluctuatePrices(s: GameState, dt: number): void {
  const t = s.stats.playTime;
  for (const g of TRADE_GOODS) {
    const phase = g.basePrice * 7.13;
    const drift = g.basePrice * (1 + g.volatility * Math.sin(t / 90 + phase));
    let p = s.prices[g.id] ?? g.basePrice;
    p += (drift - p) * 0.01 * dt + (Math.random() - 0.5) * g.basePrice * 0.02 * dt;
    s.prices[g.id] = Math.max(g.basePrice * 0.35, Math.min(g.basePrice * 2.4, p));
  }
}

export function cargoUsed(s: GameState): number {
  return Object.values(s.cargo).reduce((a, b) => a + b, 0);
}

export function cargoFree(s: GameState): number {
  return Math.max(0, fleetCargo(s) - cargoUsed(s));
}

export function buyGood(s: GameState, goodId: string, qty: number): void {
  const price = s.prices[goodId];
  if (price === undefined) return;
  qty = Math.min(qty, cargoFree(s), Math.floor(s.resources.gold / price));
  if (qty <= 0) {
    notify('No gold or cargo space for that.', 'bad');
    return;
  }
  s.resources.gold -= price * qty;
  s.cargo[goodId] = (s.cargo[goodId] ?? 0) + qty;
}

export function sellGood(s: GameState, goodId: string, qty: number, b: Bonuses): void {
  const have = s.cargo[goodId] ?? 0;
  qty = Math.min(qty, have);
  if (qty <= 0) return;
  const price = s.prices[goodId];
  const earned = price * qty * b.trade;
  s.cargo[goodId] = have - qty;
  s.resources.gold += earned;
  s.stats.totalGold += earned;
  s.stats.goodsTraded += qty;
  notify(`Sold ${qty} ${TRADE_GOODS.find(g => g.id === goodId)?.name} for ${fmt(earned)} gold.`);
}

/** Trade routes come from the Trading skill and discovered trading ports. */
export function tradeRouteCount(s: GameState): number {
  const fromSkill = Math.floor(s.skills.trading.level / 8);
  const fromPorts = ISLANDS.filter(i => i.type === 'Trading Port' && s.discoveredIslands.includes(i.id)).length;
  return fromSkill + fromPorts;
}

export function tradeRouteIncome(s: GameState, b: Bonuses): number {
  const routes = tradeRouteCount(s);
  if (routes === 0) return 0;
  // Routes scale with cargo capacity — bigger fleets move more goods.
  const cargoFactor = 1 + Math.sqrt(fleetCargo(s)) * 0.12;
  return routes * 0.8 * cargoFactor * b.trade * b.gold;
}

/** Generic trade-goods are fenced at a flat base rate. */
export function fenceGoods(s: GameState, qty: number, b: Bonuses): void {
  qty = Math.min(qty, Math.floor(s.resources.tradeGoods));
  if (qty <= 0) return;
  const earned = qty * 3 * b.trade;
  s.resources.tradeGoods -= qty;
  s.resources.gold += earned;
  s.stats.totalGold += earned;
  s.stats.goodsTraded += qty;
  notify(`Fenced ${qty} goods for ${fmt(earned)} gold.`);
}
