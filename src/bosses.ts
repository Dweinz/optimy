// Bounty bosses: a ladder of legendary foes that benchmarks your fleet.
// One bounty is active at a time; victory grants loot, a permanent bonus
// (for this run) and reveals the next. Bosses reset on prestige so each
// legend gets to climb the ladder again.

import type { GameState, Bonuses, BossDef } from './types';
import { BOSSES, fmt } from './data';
import { grantMap } from './treasure';
import { loseCrewMember } from './crew';
import { gainXp } from './skills';
import { notify, logEvent } from './notifications';

export const BOSS_COOLDOWN = 45;

/** The next undefeated boss, or null when the Sea King has fallen. */
export function currentBoss(s: GameState): BossDef | null {
  return BOSSES.find(b => !s.defeatedBosses.includes(b.id)) ?? null;
}

export function bossWinChance(s: GameState, boss: BossDef): number {
  const power = Math.max(1, s.resources.navalPower);
  return Math.min(0.95, power / (power + boss.power));
}

export function challengeBoss(s: GameState, bossId: string, b: Bonuses): void {
  if (s.bossCooldown > 0) return;
  const boss = currentBoss(s);
  if (!boss || boss.id !== bossId) return;

  s.bossCooldown = BOSS_COOLDOWN;
  const chance = bossWinChance(s, boss);

  if (Math.random() < chance) {
    const gold = boss.rewardGold * b.gold;
    s.resources.gold += gold;
    s.stats.totalGold += gold;
    s.resources.treasure += boss.rewardTreasure * b.treasure;
    s.resources.reputation += boss.power * 0.5 * b.reputation;
    if (boss.rewardMap) grantMap(s, boss.rewardMap);
    s.defeatedBosses.push(boss.id);
    s.stats.bossesDefeated++;
    gainXp(s, 'navalCombat', 100 + boss.power * 0.5, b);
    gainXp(s, 'plundering', 50 + boss.power * 0.25, b);
    notify(`⚔️ ${boss.name} defeated! +${fmt(gold)} gold, +${boss.bonus.value}% ${boss.bonus.key} (permanent)`, 'achievement');
    logEvent(s, `${boss.name} struck their colors! The bounty is yours.`);
  } else {
    s.crewMembers.forEach(m => { m.morale = Math.max(5, m.morale - 8); });
    if (Math.random() < 0.4) loseCrewMember(s, `fell battling ${boss.name}`);
    gainXp(s, 'navalCombat', 40, b);
    notify(`💥 ${boss.name} drove you off! Lick your wounds and grow stronger.`, 'bad');
    logEvent(s, `${boss.name} repelled your attack. The bounty stands.`);
  }
}
