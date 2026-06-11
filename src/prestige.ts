// Prestige ("Become a Legend"): reset the run, keep mastery, achievements,
// relics and legend points. Each prestige raises the next requirement.

import type { GameState } from './types';
import { LEGEND_UPGRADES } from './data';
import {
  freshResources, freshBuildings, freshMaps, freshPrices, freshCargo,
} from './state';
import { SKILLS } from './data';
import { notify, logEvent } from './notifications';

export function prestigeRequirements(s: GameState): { reputation: number; influence: number } {
  const mult = Math.pow(4, s.legend.prestiges);
  return { reputation: 25000 * mult, influence: 2500 * mult };
}

export function canPrestige(s: GameState): boolean {
  const req = prestigeRequirements(s);
  return s.resources.reputation >= req.reputation && s.resources.influence >= req.influence;
}

export function legendPointsOnPrestige(s: GameState): number {
  const req = prestigeRequirements(s);
  const repPts = Math.sqrt(s.resources.reputation / req.reputation) * 6;
  const infPts = Math.sqrt(s.resources.influence / req.influence) * 6;
  return Math.floor(repPts + infPts);
}

export function becomeLegend(s: GameState): boolean {
  if (!canPrestige(s)) return false;
  const points = legendPointsOnPrestige(s);

  s.legend.points += points;
  s.legend.prestiges++;
  s.stats.prestiges++;

  // Reset the run. Mastery, achievements, relics, legend and stats persist.
  s.resources = freshResources();
  s.fleet = [{ id: s.nextId++, typeId: 'raft', name: 'The Splinter' }];
  s.crewMembers = [{
    id: s.nextId++, name: 'Old Pete', role: 'Deckhand', level: 1, xp: 0,
    morale: 75, combat: 3, navigation: 3, loyalty: 60,
  }];
  s.buildings = freshBuildings();
  s.mapsInv = freshMaps();
  s.discoveredIslands = [];
  s.cargo = freshCargo();
  s.prices = freshPrices();
  s.exploreProgress = 0;
  s.huntProgress = 0;
  s.raidProgress = 0;
  s.raidTarget = 0;
  s.voyageProgress = 0;
  s.smuggleProgress = 0;
  s.buildOrder = null;
  s.recruitTimer = 0;
  s.mapTimer = 0;
  s.relicTimer = 0;
  s.activity = null;
  s.eventTimer = 120;
  s.defeatedBosses = []; // the bounty ladder resets — climb it again, stronger
  s.bossCooldown = 0;

  for (const def of SKILLS) {
    const sk = s.skills[def.id];
    sk.level = 1;
    sk.xp = 0;
    // mastery & masteryXp persist
  }

  notify(`🌟 You have become a Legend! +${points} Legend Points`, 'achievement');
  logEvent(s, `Prestiged! Earned ${points} Legend Points (total ${s.legend.points}).`);
  return true;
}

export function legendUpgradeLevel(s: GameState, id: string): number {
  return s.legend.spent[id] ?? 0;
}

export function legendUpgradeCost(s: GameState, id: string): number {
  const def = LEGEND_UPGRADES.find(u => u.id === id)!;
  return Math.floor(def.baseCost * Math.pow(def.costMult, legendUpgradeLevel(s, id)));
}

export function buyLegendUpgrade(s: GameState, id: string): boolean {
  const def = LEGEND_UPGRADES.find(u => u.id === id);
  if (!def) return false;
  const lvl = legendUpgradeLevel(s, id);
  if (lvl >= def.maxLevel) return false;
  const cost = legendUpgradeCost(s, id);
  if (s.legend.points < cost) return false;
  s.legend.points -= cost;
  s.legend.spent[id] = lvl + 1;
  notify(`🌟 ${def.name} → level ${lvl + 1}`, 'achievement');
  return true;
}
