// Procedural archipelago generation and fresh-game state.

import type { GameState, Island, ResourceId, TraitId, RateTracker } from './types';
import { ISLAND_NAMES, BASE_PRICES, RESOURCES } from './data';

export const SAVE_VERSION = 1;

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function emptyStorage(): Record<ResourceId, number> {
  const out = {} as Record<ResourceId, number>;
  for (const r of RESOURCES) out[r.id] = 0;
  return out;
}

export function newTracker(): RateTracker {
  return { buckets: [0, 0, 0, 0, 0, 0], current: 0 };
}

function makeIsland(id: number, name: string, x: number, z: number, size: number, traits: TraitId[]): Island {
  return {
    id, name, x, z, size, traits,
    discovered: false, owned: false,
    storage: emptyStorage(),
    buildings: [],
    looted: false,
  };
}

/**
 * Generates ~26 islands around the home island with guaranteed trait coverage
 * so every production chain is completable.
 */
export function generateWorld(seed: number): Island[] {
  const rand = rng(seed);
  const islands: Island[] = [];

  // Home island: forest + fertile + stone — enough to bootstrap.
  islands.push(makeIsland(1, 'Home Haven', 0, 0, 1.6, ['forest', 'fertile', 'stone']));

  // Guaranteed trait sets so all chains are buildable, then random filler.
  const guaranteed: TraitId[][] = [
    ['iron'], ['iron', 'forest'], ['iron', 'stone'],
    ['coal'], ['coal', 'stone'],
    ['forest'], ['forest'], ['forest', 'fertile'],
    ['fertile'], ['fertile'], ['fertile', 'forest'],
    ['stone'], ['ruins'], ['ruins', 'forest'], ['ruins', 'iron'],
    ['treasureSite'], ['treasureSite', 'fertile'], ['ruins', 'treasureSite'],
  ];
  const fillerPool: TraitId[] = ['forest', 'fertile', 'iron', 'coal', 'stone', 'ruins', 'treasureSite'];
  const traitSets: TraitId[][] = [...guaranteed];
  while (traitSets.length < 26) {
    const t1 = fillerPool[Math.floor(rand() * fillerPool.length)];
    const t2 = fillerPool[Math.floor(rand() * fillerPool.length)];
    traitSets.push(t1 === t2 ? [t1] : [t1, t2]);
  }

  // Shuffle placement order so trait quality isn't tied to distance.
  for (let i = traitSets.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [traitSets[i], traitSets[j]] = [traitSets[j], traitSets[i]];
  }

  const names = [...ISLAND_NAMES];
  let nextId = 2;
  let attempts = 0;
  while (traitSets.length > 0 && attempts < 2000) {
    attempts++;
    const angle = rand() * Math.PI * 2;
    const dist = 34 + rand() * 130;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist * 0.85;
    let tooClose = false;
    for (const isl of islands) {
      const d = Math.hypot(isl.x - x, isl.z - z);
      if (d < 26) { tooClose = true; break; }
    }
    if (tooClose) continue;
    const traits = traitSets.pop()!;
    const name = names.length ? names.splice(Math.floor(rand() * names.length), 1)[0] : `Isle ${nextId}`;
    islands.push(makeIsland(nextId++, name, x, z, 1 + rand(), traits));
  }

  // Visibility: home + the two nearest islands are charted from the start.
  islands[0].discovered = true;
  islands[0].owned = true;
  const byDist = islands.slice(1).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  byDist[0].discovered = true;
  byDist[1].discovered = true;

  return islands;
}

export function distance(a: Island, b: Island): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

export function createNewGame(seed?: number): GameState {
  const s = seed ?? Math.floor(Math.random() * 2 ** 31);
  const islands = generateWorld(s);

  const home = islands[0];
  home.buildings.push({ id: 100, type: 'dock', level: 1, recipeIndex: 0, progress: 0, status: 'idle' });
  home.storage.wood = 60;
  home.storage.stone = 30;
  home.storage.food = 50;
  home.storage.rum = 12;
  home.storage.crew = 10;

  const state: GameState = {
    version: SAVE_VERSION,
    seed: s,
    time: 0,
    speed: 1,
    gold: 350,
    influence: 0,
    islands,
    ships: [{
      id: 200, name: 'First Light', type: 'cargo', state: 'idle', routeId: null,
      phase: 'loading', progress: 0, cargo: 0, homeIslandId: 1, condition: 100,
    }],
    routes: [],
    expeditions: [],
    techs: { navigation: 0, shipbuilding: 0, trade: 0, smuggling: 0, military: 0, exploration: 0, industry: 0 },
    prices: { ...BASE_PRICES },
    marketCrash: 0,
    autoTrade: [],
    alerts: [],
    eventTimer: 120,
    nextId: 1000,
    stats: { prod: {}, cons: {}, goldIn: newTracker(), goldOut: newTracker(), bucketTimer: 0 },
    totals: { expeditions: 0, shipsBuilt: 0, treasureFound: 0, shipsLost: 0 },
  };
  return state;
}

export function islandById(s: GameState, id: number): Island | undefined {
  return s.islands.find(i => i.id === id);
}
