// Skill XP, levels, mastery, and the global bonus computation that ties
// every system (skills, buildings, relics, islands, achievements, legend
// upgrades) into a single multiplier table.

import type { GameState, SkillId, Bonuses, BonusKey } from './types';
import { SKILLS, BUILDINGS, RELICS, RELIC_SETS, ISLANDS, LEGEND_UPGRADES, BOSSES } from './data';
import { ACHIEVEMENTS } from './achievements';
import { notify, logEvent } from './notifications';

export const SKILL_CAP = 99;

export function xpForLevel(level: number): number {
  return Math.floor(80 * Math.pow(level, 1.9));
}

export function masteryXpForLevel(mastery: number): number {
  return Math.floor(1000 * Math.pow(mastery + 1, 1.6));
}

export function gainXp(s: GameState, skillId: SkillId, amount: number, bonuses?: Bonuses): void {
  const xpMult = bonuses ? bonuses.xp : 1;
  const sk = s.skills[skillId];
  const gained = amount * xpMult;

  if (sk.level < SKILL_CAP) {
    sk.xp += gained;
    while (sk.level < SKILL_CAP && sk.xp >= xpForLevel(sk.level)) {
      sk.xp -= xpForLevel(sk.level);
      sk.level++;
      const def = SKILLS.find(d => d.id === skillId)!;
      notify(`${def.icon} ${def.name} reached level ${sk.level}!`, 'levelup');
      logEvent(s, `${def.name} is now level ${sk.level}.`);
    }
  }

  // Mastery accrues at 10% of xp and persists through prestige.
  sk.masteryXp += gained * 0.1;
  while (sk.masteryXp >= masteryXpForLevel(sk.mastery)) {
    sk.masteryXp -= masteryXpForLevel(sk.mastery);
    sk.mastery++;
    const def = SKILLS.find(d => d.id === skillId)!;
    notify(`✨ ${def.name} mastery ${sk.mastery}! (+1% to its bonuses, forever)`, 'achievement');
    logEvent(s, `${def.name} mastery reached ${sk.mastery}.`);
  }
}

function blankBonuses(): Bonuses {
  return {
    gold: 1, xp: 1, speed: 1, treasure: 1, recruit: 1, trade: 1, combat: 1,
    supplies: 1, rum: 1, mapFind: 1, knowledge: 1, influence: 1, reputation: 1,
    smuggleSafety: 1, crewSafety: 1, shipDiscount: 0, build: 1, relicFind: 1, crewEff: 1,
  };
}

/**
 * Computes the full bonus table. All sources contribute additive percentages
 * on top of a base of 1 (except shipDiscount, which is a flat fraction
 * capped at 0.6 when consumed).
 */
export function computeBonuses(s: GameState): Bonuses {
  const b = blankBonuses();
  const add = (key: BonusKey, pct: number) => { b[key] += pct / 100; };

  // Skills + mastery (each mastery level boosts that skill's effects by 1%).
  for (const def of SKILLS) {
    const sk = s.skills[def.id];
    const masteryMult = 1 + sk.mastery * 0.01;
    for (const eff of def.effects) {
      add(eff.key, eff.perLevel * (sk.level - 1) * masteryMult);
    }
  }

  // Port buildings.
  for (const def of BUILDINGS) {
    const lvl = s.buildings[def.id];
    if (lvl > 0) add(def.bonus.key, def.bonus.perLevel * lvl);
  }
  // Secondary building effects.
  add('gold', s.buildings.smugglerDen * 1);
  add('crewSafety', s.buildings.fortress * 2);
  add('knowledge', s.buildings.relicVault * 2);

  // Relics and completed sets.
  for (const r of RELICS) {
    if (s.relicsOwned.includes(r.id)) add(r.bonus.key, r.bonus.value);
  }
  for (const set of RELIC_SETS) {
    const members = RELICS.filter(r => r.set === set.id);
    if (members.every(r => s.relicsOwned.includes(r.id))) {
      add(set.bonus.key, set.bonus.value);
    }
  }

  // Discovered islands.
  for (const isl of ISLANDS) {
    if (s.discoveredIslands.includes(isl.id)) add(isl.bonus.key, isl.bonus.value);
  }

  // Achievements.
  for (const a of ACHIEVEMENTS) {
    if (s.achievements.includes(a.id)) add(a.bonus.key, a.bonus.value);
  }

  // Defeated bounty bosses (reset each prestige).
  for (const boss of BOSSES) {
    if (s.defeatedBosses.includes(boss.id)) add(boss.bonus.key, boss.bonus.value);
  }

  // Legend upgrades.
  for (const u of LEGEND_UPGRADES) {
    const lvl = s.legend.spent[u.id] ?? 0;
    if (lvl > 0) add(u.bonus.key, u.bonus.perLevel * lvl);
  }

  return b;
}

export function totalSkillLevels(s: GameState): number {
  return SKILLS.reduce((sum, def) => sum + s.skills[def.id].level, 0);
}
