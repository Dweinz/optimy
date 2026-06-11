// Maps and treasure hunting: map finding, quality rolls, combining maps,
// and resolving treasure hunts.

import type { GameState, Bonuses, MapQuality } from './types';
import { MAP_QUALITIES, MAP_QUALITY_INFO, fmt } from './data';
import { crewEfficiency } from './crew';
import { tryFindRelic } from './relics';
import { gainXp } from './skills';
import { notify, logEvent } from './notifications';

export function totalMaps(s: GameState): number {
  return MAP_QUALITIES.reduce((sum, q) => sum + s.mapsInv[q], 0);
}

/** Rolls a map quality; cartography skill shifts the odds upward. */
export function rollMapQuality(s: GameState): MapQuality {
  const carto = s.skills.cartography.level;
  const r = Math.random() * 100;
  const legendaryChance = carto >= 25 ? 0.5 + carto * 0.05 : 0;
  const epicChance = carto >= 12 ? 3 + carto * 0.2 : 0;
  const rareChance = 10 + carto * 0.4;
  if (r < legendaryChance) return 'legendary';
  if (r < legendaryChance + epicChance) return 'epic';
  if (r < legendaryChance + epicChance + rareChance) return 'rare';
  return 'common';
}

export function grantMap(s: GameState, quality?: MapQuality): MapQuality {
  const q = quality ?? rollMapQuality(s);
  s.mapsInv[q]++;
  s.stats.mapsFound++;
  if (q === 'legendary') s.stats.legendaryMaps++;
  const info = MAP_QUALITY_INFO[q];
  notify(`${info.icon} Found a ${info.name} map!`, q === 'common' ? 'info' : 'achievement');
  logEvent(s, `Found a ${info.name} treasure map.`);
  return q;
}

/** Combine 4 maps of one tier into 1 of the next tier. */
export function combineMaps(s: GameState, from: MapQuality): void {
  const idx = MAP_QUALITIES.indexOf(from);
  if (idx < 0 || idx >= MAP_QUALITIES.length - 1) return;
  if (s.mapsInv[from] < 4) return;
  const to = MAP_QUALITIES[idx + 1];
  s.mapsInv[from] -= 4;
  s.mapsInv[to]++;
  if (to === 'legendary') s.stats.legendaryMaps++;
  notify(`🗺️ Combined 4 ${MAP_QUALITY_INFO[from].name} maps into 1 ${MAP_QUALITY_INFO[to].name}!`);
}

/** Picks the lowest-quality map available (cheap maps are spent first). */
export function lowestMap(s: GameState): MapQuality | null {
  for (const q of MAP_QUALITIES) if (s.mapsInv[q] > 0) return q;
  return null;
}

const HUNT_REWARDS: Record<MapQuality, { gold: number; treasure: number; relicChance: number; cursed: number }> = {
  common: { gold: 120, treasure: 5, relicChance: 0.02, cursed: 0 },
  rare: { gold: 600, treasure: 22, relicChance: 0.08, cursed: 1 },
  epic: { gold: 3200, treasure: 90, relicChance: 0.2, cursed: 3 },
  legendary: { gold: 16000, treasure: 350, relicChance: 0.45, cursed: 8 },
};

export function huntSuccessChance(s: GameState, b: Bonuses): number {
  const th = s.skills.treasureHunting.level;
  const nav = s.skills.navigation.level;
  const ce = crewEfficiency(s, b);
  return Math.min(0.95, 0.45 + th * 0.005 + nav * 0.003 + ce * 0.04);
}

/** Resolves one treasure hunt by consuming the lowest-quality map. */
export function resolveHunt(s: GameState, b: Bonuses): void {
  const q = lowestMap(s);
  if (!q) return;
  s.mapsInv[q]--;

  const chance = huntSuccessChance(s, b);
  const info = MAP_QUALITY_INFO[q];

  if (Math.random() > chance) {
    notify(`The ${info.name} map led nowhere... the trail went cold.`, 'bad');
    logEvent(s, `A ${info.name} treasure hunt came up empty.`);
    gainXp(s, 'treasureHunting', 15, b);
    return;
  }

  const r = HUNT_REWARDS[q];
  const gold = r.gold * (0.7 + Math.random() * 0.6) * b.gold * b.treasure;
  const treasure = r.treasure * (0.7 + Math.random() * 0.6) * b.treasure;
  s.resources.gold += gold;
  s.stats.totalGold += gold;
  s.resources.treasure += treasure;
  s.resources.cursedRelics += r.cursed;
  s.stats.treasures++;

  notify(`💎 Treasure found! +${fmt(gold)} gold, +${fmt(treasure)} treasure`, 'achievement');
  logEvent(s, `Dug up treasure worth ${fmt(gold)} gold (${info.name} map).`);
  gainXp(s, 'treasureHunting', 60 + HUNT_REWARDS[q].treasure, b);
  gainXp(s, 'navigation', 20, b);

  if (Math.random() < r.relicChance * b.relicFind) {
    tryFindRelic(s);
  }
}

/** Sell treasure for gold. */
export function fenceTreasure(s: GameState, qty: number, b: Bonuses): void {
  qty = Math.min(qty, Math.floor(s.resources.treasure));
  if (qty <= 0) return;
  const earned = qty * 25 * b.gold;
  s.resources.treasure -= qty;
  s.resources.gold += earned;
  s.stats.totalGold += earned;
  notify(`Fenced ${fmt(qty)} treasure for ${fmt(earned)} gold.`);
}
