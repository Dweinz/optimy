// Economy: market prices, manual & automatic trading, smuggling, and crew
// upkeep (food + rum consumption with efficiency penalties).

import type { GameState, Island, ResourceId } from './types';
import { BASE_PRICES, RES_NAME, fmt } from './data';
import { sellPriceMult, buyPriceMult, smugglingUnlocked, techLevel } from './tech';
import { addToStorage, recordGold, recordCons, recordProd } from './production';
import { addAlert } from './notify';

export function hasMarketplace(island: Island): boolean {
  return island.buildings.some(b => b.type === 'marketplace');
}

export function sellPrice(s: GameState, res: ResourceId, smuggle = false): number {
  let p = s.prices[res] * 0.8 * sellPriceMult(s);
  if (s.marketCrash > 0) p *= 0.5;
  if (smuggle && (res === 'rum' || res === 'weapons')) p = s.prices[res] * 2;
  return p;
}

export function buyPrice(s: GameState, res: ResourceId): number {
  let p = s.prices[res] * buyPriceMult(s);
  if (s.marketCrash > 0) p *= 0.7; // crashes are buying opportunities
  return p;
}

export function sellResource(s: GameState, island: Island, res: ResourceId, qty: number, smuggle = false): void {
  if (!hasMarketplace(island)) return;
  if (smuggle && !smugglingUnlocked(s)) return;
  qty = Math.min(qty, Math.floor(island.storage[res]));
  if (qty <= 0) return;
  const earned = sellPrice(s, res, smuggle) * qty;
  island.storage[res] -= qty;
  s.gold += earned;
  recordGold(s, earned);
  recordCons(s, res, qty);
  addAlert(s, `${smuggle ? '🌑 Smuggled' : '⚖️ Sold'} ${qty} ${RES_NAME[res]} for ${fmt(earned)} gold`, 'good');

  // Smuggling can attract the navy.
  if (smuggle) {
    const caughtChance = techLevel(s, 'smuggling') >= 3 ? 0.05 : 0.18;
    if (Math.random() < caughtChance) {
      const fine = Math.min(s.gold, earned * 1.5);
      s.gold -= fine;
      recordGold(s, -fine);
      addAlert(s, `🚨 Navy patrol intercepted the deal! Fined ${fmt(fine)} gold.`, 'bad');
    }
  }
}

export function buyResource(s: GameState, island: Island, res: ResourceId, qty: number): void {
  if (!hasMarketplace(island)) return;
  const price = buyPrice(s, res);
  qty = Math.min(qty, Math.floor(s.gold / price));
  if (qty <= 0) { addAlert(s, 'Not enough gold.', 'warn'); return; }
  const added = addToStorage(s, island, res, qty);
  if (added <= 0) { addAlert(s, 'No storage space on the island.', 'warn'); return; }
  s.gold -= price * added;
  recordGold(s, -price * added);
  recordProd(s, res, added);
}

/** Auto-trade rules configured per marketplace island. */
export function tickAutoTrade(s: GameState, dt: number): void {
  for (const rule of s.autoTrade) {
    const island = s.islands.find(i => i.id === rule.islandId);
    if (!island || !island.owned || !hasMarketplace(island)) continue;
    if (rule.mode === 'sell') {
      const excess = island.storage[rule.resource] - rule.threshold;
      if (excess >= 1) {
        const qty = Math.min(Math.floor(excess), Math.ceil(2 * dt));
        const earned = sellPrice(s, rule.resource) * qty;
        island.storage[rule.resource] -= qty;
        s.gold += earned;
        recordGold(s, earned);
        recordCons(s, rule.resource, qty);
      }
    } else {
      const deficit = rule.threshold - island.storage[rule.resource];
      if (deficit >= 1) {
        const price = buyPrice(s, rule.resource);
        const qty = Math.min(Math.floor(deficit), Math.ceil(2 * dt), Math.floor(s.gold / price));
        if (qty > 0) {
          const added = addToStorage(s, island, rule.resource, qty);
          s.gold -= price * added;
          recordGold(s, -price * added);
          recordProd(s, rule.resource, added);
        }
      }
    }
  }
}

/** Prices drift back toward base with random wobble. */
export function tickPrices(s: GameState, dt: number): void {
  for (const [res, base] of Object.entries(BASE_PRICES)) {
    if (res === 'crew') continue;
    const r = res as ResourceId;
    let p = s.prices[r];
    p += (base - p) * 0.005 * dt + (Math.random() - 0.5) * base * 0.01 * dt;
    s.prices[r] = Math.max(base * 0.4, Math.min(base * 2.5, p));
  }
  if (s.marketCrash > 0) s.marketCrash = Math.max(0, s.marketCrash - dt);
}

export interface CrewUpkeepResult {
  efficiency: number; // production multiplier from fed/happy crews
  totalCrew: number;
  fedRatio: number;
  rumRatio: number;
}

/**
 * Crew eat food and drink rum, drawn from their own island's stores.
 * Hungry or sober islands work dramatically slower — logistics failure
 * is immediately visible in the production stats.
 */
export function tickCrewUpkeep(s: GameState, dt: number): CrewUpkeepResult {
  let totalCrew = 0;
  let fedCrew = 0;
  let rummedCrew = 0;

  for (const island of s.islands) {
    if (!island.owned) continue;
    const crew = island.storage.crew;
    if (crew <= 0) continue;
    totalCrew += crew;

    const foodNeed = crew * 0.012 * dt;
    if (island.storage.food >= foodNeed) {
      island.storage.food -= foodNeed;
      recordCons(s, 'food', foodNeed);
      fedCrew += crew;
    }
    const rumNeed = crew * 0.006 * dt;
    if (island.storage.rum >= rumNeed) {
      island.storage.rum -= rumNeed;
      recordCons(s, 'rum', rumNeed);
      rummedCrew += crew;
    }
  }

  const fedRatio = totalCrew > 0 ? fedCrew / totalCrew : 1;
  const rumRatio = totalCrew > 0 ? rummedCrew / totalCrew : 1;
  // Starvation halves output; sobriety knocks off another quarter.
  const efficiency = (0.5 + 0.5 * fedRatio) * (0.75 + 0.25 * rumRatio);
  return { efficiency, totalCrew, fedRatio, rumRatio };
}
