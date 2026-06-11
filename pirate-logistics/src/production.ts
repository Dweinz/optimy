// Island production: recipe cycles, worker allocation, storage caps,
// construction, and the per-resource rate tracking that powers the
// bottleneck statistics.

import type { GameState, Island, BuildingInstance, BuildingTypeId, ResourceId, RateTracker } from './types';
import { BUILDINGS, buildingDef, RES_NAME } from './data';
import { prodSpeedMult, storageMult, buildingUnlocked, buildingAllowedOnIsland } from './tech';
import { newTracker } from './world';
import { addAlert } from './notify';

// ------------------------------------------------------------- rate stats

function track(map: Partial<Record<ResourceId, RateTracker>>, res: ResourceId, amount: number): void {
  (map[res] ??= newTracker()).current += amount;
}

export function recordProd(s: GameState, res: ResourceId, amount: number): void {
  track(s.stats.prod, res, amount);
}

export function recordCons(s: GameState, res: ResourceId, amount: number): void {
  track(s.stats.cons, res, amount);
}

export function recordGold(s: GameState, delta: number): void {
  if (delta >= 0) s.stats.goldIn.current += delta;
  else s.stats.goldOut.current += -delta;
}

function rotate(t: RateTracker): void {
  t.buckets.pop();
  t.buckets.unshift(t.current);
  t.current = 0;
}

/** Rolls the 10s stat buckets; called from the main tick. */
export function tickStats(s: GameState, dt: number): void {
  s.stats.bucketTimer += dt;
  while (s.stats.bucketTimer >= 10) {
    s.stats.bucketTimer -= 10;
    for (const t of Object.values(s.stats.prod)) rotate(t!);
    for (const t of Object.values(s.stats.cons)) rotate(t!);
    rotate(s.stats.goldIn);
    rotate(s.stats.goldOut);
    for (const r of s.routes) {
      r.perMin = r.deliveredWindow;
      r.deliveredWindow = 0;
      r.utilization = r.utilSamples > 0 ? r.utilSum / r.utilSamples : 0;
      r.utilSum = 0;
      r.utilSamples = 0;
    }
  }
}

/** Units per minute over the rolling window (buckets are 10s wide). */
export function ratePerMin(t: RateTracker | undefined): number {
  if (!t) return 0;
  const sum = t.buckets.reduce((a, b) => a + b, 0) + t.current;
  return sum; // 6 buckets * 10s = 60s window
}

// --------------------------------------------------------------- storage

export function storageCap(s: GameState, island: Island): number {
  const warehouses = island.buildings.filter(b => b.type === 'warehouse')
    .reduce((sum, b) => sum + b.level, 0);
  return Math.floor((80 + warehouses * 150) * storageMult(s));
}

export function crewCap(island: Island): number {
  const taverns = island.buildings.filter(b => b.type === 'tavern').reduce((sum, b) => sum + b.level, 0);
  const docks = island.buildings.filter(b => b.type === 'dock').reduce((sum, b) => sum + b.level, 0);
  return 12 + taverns * 10 + docks * 4;
}

export function addToStorage(s: GameState, island: Island, res: ResourceId, amount: number): number {
  const cap = res === 'crew' ? crewCap(island) : storageCap(s, island);
  const space = Math.max(0, cap - island.storage[res]);
  const added = Math.min(space, amount);
  island.storage[res] += added;
  return added;
}

// ------------------------------------------------------------ construction

export function hasDock(island: Island): boolean {
  return island.buildings.some(b => b.type === 'dock');
}

export function buildingSlots(island: Island): number {
  return 6 + Math.floor(island.size * 4);
}

/** Lists every missing resource with have/need amounts for tooltips. */
function missingList(s: GameState, island: Island, cost: Partial<Record<ResourceId, number>>, gold: number): string[] {
  const missing: string[] = [];
  if (s.gold < gold) missing.push(`${gold} gold (have ${Math.floor(s.gold)})`);
  for (const [res, qty] of Object.entries(cost)) {
    const have = Math.floor(island.storage[res as ResourceId]);
    if (have < qty!) missing.push(`${qty} ${RES_NAME[res as ResourceId]} (have ${have} here)`);
  }
  return missing;
}

export function canBuild(s: GameState, island: Island, type: BuildingTypeId): { ok: boolean; reason: string } {
  const def = buildingDef(type);
  if (!island.owned) return { ok: false, reason: 'Not your island' };
  if (!buildingUnlocked(s, def)) return { ok: false, reason: `Needs ${def.tech!.branch} ${def.tech!.level}` };
  if (!buildingAllowedOnIsland(def, island)) {
    return { ok: false, reason: `Island lacks the required terrain (${def.traitAny!.join(' or ')})` };
  }
  if (def.unique && island.buildings.some(b => b.type === type)) return { ok: false, reason: 'Already built (upgrade it instead)' };
  if (island.buildings.length >= buildingSlots(island)) return { ok: false, reason: 'No building slots left' };
  const missing = missingList(s, island, def.cost, def.costGold);
  if (missing.length) return { ok: false, reason: `Missing: ${missing.join(', ')}` };
  return { ok: true, reason: '' };
}

export function build(s: GameState, island: Island, type: BuildingTypeId): boolean {
  const check = canBuild(s, island, type);
  if (!check.ok) return false;
  const def = buildingDef(type);
  s.gold -= def.costGold;
  recordGold(s, -def.costGold);
  for (const [res, qty] of Object.entries(def.cost)) {
    island.storage[res as ResourceId] -= qty!;
    recordCons(s, res as ResourceId, qty!);
  }
  // Pick the first recipe valid for this island's traits.
  let recipeIndex = 0;
  for (let i = 0; i < def.recipes.length; i++) {
    if (!def.recipes[i].trait || island.traits.includes(def.recipes[i].trait!)) { recipeIndex = i; break; }
  }
  island.buildings.push({ id: s.nextId++, type, level: 1, recipeIndex, progress: 0, status: 'idle' });
  addAlert(s, `${def.icon} ${def.name} built on ${island.name}`, 'good');
  return true;
}

export function upgradeCost(b: BuildingInstance): { cost: Partial<Record<ResourceId, number>>; gold: number } {
  const def = buildingDef(b.type);
  const mult = Math.pow(2, b.level);
  const cost: Partial<Record<ResourceId, number>> = {};
  for (const [res, qty] of Object.entries(def.cost)) cost[res as ResourceId] = qty! * mult;
  return { cost, gold: def.costGold * mult };
}

export function canUpgrade(s: GameState, island: Island, b: BuildingInstance): { ok: boolean; reason: string } {
  const def = buildingDef(b.type);
  if (b.level >= def.maxLevel) return { ok: false, reason: 'Max level' };
  const { cost, gold } = upgradeCost(b);
  const missing = missingList(s, island, cost, gold);
  if (missing.length) return { ok: false, reason: `Missing: ${missing.join(', ')}` };
  return { ok: true, reason: '' };
}

export function upgrade(s: GameState, island: Island, buildingId: number): boolean {
  const b = island.buildings.find(x => x.id === buildingId);
  if (!b) return false;
  const check = canUpgrade(s, island, b);
  if (!check.ok) return false;
  const { cost, gold } = upgradeCost(b);
  s.gold -= gold;
  recordGold(s, -gold);
  for (const [res, qty] of Object.entries(cost)) {
    island.storage[res as ResourceId] -= qty!;
    recordCons(s, res as ResourceId, qty!);
  }
  b.level++;
  addAlert(s, `${buildingDef(b.type).icon} ${buildingDef(b.type).name} on ${island.name} → level ${b.level}`, 'good');
  return true;
}

export function demolish(s: GameState, island: Island, buildingId: number): void {
  const b = island.buildings.find(x => x.id === buildingId);
  if (!b) return;
  if (b.type === 'dock' && island.buildings.filter(x => x.type === 'dock').length === 1) {
    addAlert(s, 'Cannot demolish the only dock — the island would be cut off.', 'warn');
    return;
  }
  island.buildings = island.buildings.filter(x => x.id !== buildingId);
}

// ------------------------------------------------------------- simulation

/** Crew needed to staff every production building on the island. */
export function workersNeeded(island: Island): number {
  let total = 0;
  for (const b of island.buildings) {
    const def = buildingDef(b.type);
    const recipe = def.recipes[b.recipeIndex];
    if (recipe) total += recipe.workers;
  }
  return total;
}

/**
 * Runs production for every owned island. Buildings stall (with a visible
 * reason) when inputs are missing, storage is full or crew is short —
 * those stalls are the bottleneck report.
 */
export function tickProduction(s: GameState, dt: number, crewEfficiency: number): void {
  const speedMult = prodSpeedMult(s);

  for (const island of s.islands) {
    if (!island.owned) continue;

    const needed = workersNeeded(island);
    const staffing = needed > 0 ? Math.min(1, island.storage.crew / needed) : 1;

    for (const b of island.buildings) {
      const def = buildingDef(b.type);
      const recipe = def.recipes[b.recipeIndex];
      if (!recipe) { b.status = 'idle'; continue; }
      if (recipe.trait && !island.traits.includes(recipe.trait)) { b.status = 'idle'; continue; }

      if (staffing <= 0.05) { b.status = 'noCrew'; continue; }

      // Check inputs are present before progressing the cycle.
      let hasInputs = true;
      for (const [res, qty] of Object.entries(recipe.inputs)) {
        if (island.storage[res as ResourceId] < qty!) { hasInputs = false; break; }
      }
      if (!hasInputs) { b.status = 'noInput'; continue; }

      // Check output space (taverns also respect crew housing).
      let hasSpace = true;
      for (const [res, qty] of Object.entries(recipe.outputs)) {
        const cap = res === 'crew' ? crewCap(island) : storageCap(s, island);
        if (island.storage[res as ResourceId] + qty! > cap) { hasSpace = false; break; }
      }
      if (!hasSpace) { b.status = 'full'; continue; }

      b.status = 'ok';
      const levelMult = 1 + (b.level - 1) * 0.75;
      b.progress += dt * speedMult * levelMult * staffing * crewEfficiency;

      while (b.progress >= recipe.cycle) {
        b.progress -= recipe.cycle;
        // Re-verify inputs (multiple completions in one tick).
        let ok = true;
        for (const [res, qty] of Object.entries(recipe.inputs)) {
          if (island.storage[res as ResourceId] < qty!) { ok = false; break; }
        }
        if (!ok) break;
        for (const [res, qty] of Object.entries(recipe.inputs)) {
          island.storage[res as ResourceId] -= qty!;
          recordCons(s, res as ResourceId, qty!);
        }
        for (const [res, qty] of Object.entries(recipe.outputs)) {
          const added = addToStorage(s, island, res as ResourceId, qty!);
          recordProd(s, res as ResourceId, added);
        }
        // Special conversions: vault → gold, academy → influence.
        if (b.type === 'vault') {
          const gold = 30 * b.level;
          s.gold += gold;
          recordGold(s, gold);
        }
        if (b.type === 'academy') {
          s.influence += 2 * b.level;
        }
      }
    }
  }
}

/** All stalled buildings across the empire, for the bottleneck report. */
export interface Bottleneck {
  islandId: number;
  islandName: string;
  building: string;
  icon: string;
  status: 'noInput' | 'full' | 'noCrew';
  detail: string;
}

export function findBottlenecks(s: GameState): Bottleneck[] {
  const out: Bottleneck[] = [];
  for (const island of s.islands) {
    if (!island.owned) continue;
    for (const b of island.buildings) {
      if (b.status === 'ok' || b.status === 'idle') continue;
      const def = buildingDef(b.type);
      const recipe = def.recipes[b.recipeIndex];
      let detail = '';
      if (b.status === 'noInput' && recipe) {
        const missing = Object.entries(recipe.inputs)
          .filter(([res, qty]) => island.storage[res as ResourceId] < qty!)
          .map(([res]) => RES_NAME[res as ResourceId]);
        detail = `missing ${missing.join(', ')}`;
      } else if (b.status === 'full') {
        detail = 'storage full — ship goods out or add a Warehouse';
      } else if (b.status === 'noCrew') {
        detail = `island needs ${workersNeeded(island)} crew, has ${Math.floor(island.storage.crew)}`;
      }
      out.push({ islandId: island.id, islandName: island.name, building: def.name, icon: def.icon, status: b.status, detail });
    }
  }
  return out;
}

export const ALL_BUILDINGS = BUILDINGS;
