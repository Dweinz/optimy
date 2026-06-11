// GameState construction and reset helpers.

import type { GameState, ResourceId, SkillId, BuildingId, MapQuality, Stats } from './types';
import { SKILLS, BUILDINGS, TRADE_GOODS } from './data';

export const SAVE_VERSION = 1;

export function freshResources(): Record<ResourceId, number> {
  return {
    gold: 10, crew: 1, supplies: 5, rum: 0, maps: 0, treasure: 0, tradeGoods: 0,
    reputation: 0, influence: 0, ships: 1, cursedRelics: 0, navalPower: 0, knowledge: 0,
  };
}

export function freshStats(): Stats {
  return {
    totalGold: 0, voyages: 0, treasures: 0, crewRecruited: 0, raidsWon: 0,
    raidsLost: 0, mapsFound: 0, legendaryMaps: 0, goodsTraded: 0, smuggleRuns: 0,
    shipsBuilt: 0, eventsResolved: 0, relicsFound: 0, prestiges: 0, playTime: 0,
    bossesDefeated: 0,
  };
}

export function freshSkills(): Record<SkillId, { level: number; xp: number; mastery: number; masteryXp: number }> {
  const out = {} as Record<SkillId, { level: number; xp: number; mastery: number; masteryXp: number }>;
  for (const s of SKILLS) out[s.id] = { level: 1, xp: 0, mastery: 0, masteryXp: 0 };
  return out;
}

export function freshBuildings(): Record<BuildingId, number> {
  const out = {} as Record<BuildingId, number>;
  for (const b of BUILDINGS) out[b.id] = 0;
  return out;
}

export function freshMaps(): Record<MapQuality, number> {
  return { common: 0, rare: 0, epic: 0, legendary: 0 };
}

export function freshPrices(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of TRADE_GOODS) out[g.id] = g.basePrice;
  return out;
}

export function freshCargo(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of TRADE_GOODS) out[g.id] = 0;
  return out;
}

export function createNewGame(): GameState {
  return {
    version: SAVE_VERSION,
    resources: freshResources(),
    skills: freshSkills(),
    activity: null,
    fleet: [{ id: 1, typeId: 'raft', name: 'The Splinter' }],
    crewMembers: [{
      id: 2, name: 'Old Pete', role: 'Deckhand', level: 1, xp: 0,
      morale: 75, combat: 3, navigation: 3, loyalty: 60,
    }],
    buildings: freshBuildings(),
    mapsInv: freshMaps(),
    discoveredIslands: [],
    exploreProgress: 0,
    huntProgress: 0,
    raidProgress: 0,
    raidTarget: 0,
    voyageProgress: 0,
    smuggleProgress: 0,
    buildOrder: null,
    recruitTimer: 0,
    mapTimer: 0,
    relicTimer: 0,
    relicsOwned: [],
    achievements: [],
    prices: freshPrices(),
    cargo: freshCargo(),
    legend: { points: 0, spent: {}, prestiges: 0 },
    stats: freshStats(),
    eventTimer: 90,
    nextId: 10,
    log: [],
    lastSeen: Date.now(),
    defeatedBosses: [],
    bossCooldown: 0,
    questProgress: {},
  };
}
