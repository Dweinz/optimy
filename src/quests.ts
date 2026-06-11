// The goal board: five parallel progression tracks, each with its own ladder
// of milestones. All tracks are visible at once and advance independently —
// the player chooses which path to chase. Completions grant rewards.
// Progress is lifetime (stat-based) and survives prestige.

import type { GameState, QuestDef } from './types';
import { SKILLS, RELICS, ISLANDS, fmt } from './data';
import { grantMap } from './treasure';
import { totalBuildingLevels } from './port';
import { notify, logEvent } from './notifications';

export interface QuestTrack {
  id: string;
  name: string;
  icon: string;
  goals: QuestDef[];
}

function gold(amount: number) {
  return (s: GameState) => {
    s.resources.gold += amount;
    s.stats.totalGold += amount;
    return `${fmt(amount)} gold`;
  };
}

function supplies(amount: number) {
  return (s: GameState) => {
    s.resources.supplies += amount;
    return `${fmt(amount)} supplies`;
  };
}

function map(quality: 'common' | 'rare' | 'epic' | 'legendary') {
  return (s: GameState) => {
    grantMap(s, quality);
    return `a ${quality} map`;
  };
}

function maxSkill(s: GameState): number {
  return SKILLS.reduce((m, def) => Math.max(m, s.skills[def.id].level), 0);
}

export const QUEST_TRACKS: QuestTrack[] = [
  {
    id: 'combat', name: 'Path of the Corsair', icon: '⚔️',
    goals: [
      { id: 'raid3', name: 'Blood the Cannons', hint: 'Win 3 raids — pick a target you can beat (Activities tab).', check: s => s.stats.raidsWon >= 3, progress: s => ({ cur: s.stats.raidsWon, max: 3 }), reward: map('common') },
      { id: 'boss1', name: 'Bounty: Scurvy Dog Dan', hint: 'Take your first bounty in the Bounties tab. Grow naval power until the odds look good.', check: s => s.stats.bossesDefeated >= 1, reward: gold(250) },
      { id: 'raid25', name: 'Feared Flag', hint: 'Win 25 raids in total.', check: s => s.stats.raidsWon >= 25, progress: s => ({ cur: s.stats.raidsWon, max: 25 }), reward: gold(800) },
      { id: 'boss2', name: 'Bounty: Captain Bonecrush', hint: 'Defeat Captain Bonecrush. Promote crew and raise the Fortress.', check: s => s.stats.bossesDefeated >= 2, reward: map('rare') },
      { id: 'boss3', name: 'Bounty: The Iron Commodore', hint: 'Break the Iron Commodore — a Brigantine or two will help.', check: s => s.stats.bossesDefeated >= 3, reward: gold(5000) },
      { id: 'boss4', name: 'Bounty: Madame Hexx', hint: 'Sink the witch’s whale-bone ship.', check: s => s.stats.bossesDefeated >= 4, reward: map('epic') },
      { id: 'raid250', name: 'Scourge of the Seas', hint: 'Win 250 raids in total.', check: s => s.stats.raidsWon >= 250, progress: s => ({ cur: s.stats.raidsWon, max: 250 }), reward: gold(50000) },
      { id: 'boss6', name: 'Bounty: Priest of the Kraken', hint: 'Defeat the Ghost Admiral, then his master’s priest.', check: s => s.stats.bossesDefeated >= 6, reward: map('legendary') },
      { id: 'boss8', name: 'Dethrone the Sea King', hint: 'Climb the full bounty ladder and take the drowned throne.', check: s => s.stats.bossesDefeated >= 8, reward: gold(1000000) },
    ],
  },
  {
    id: 'explore', name: 'Path of the Navigator', icon: '🧭',
    goals: [
      { id: 'isle1', name: 'Landfall', hint: 'Discover your first island with the Explore activity (consumes supplies).', check: s => s.discoveredIslands.length >= 1, reward: gold(60) },
      { id: 'dig1', name: 'First Dig', hint: 'Dig up a treasure with the Treasure Hunt activity — it uses maps, or scrounges one.', check: s => s.stats.treasures >= 1, reward: gold(75) },
      { id: 'isle5', name: 'Five Flags', hint: 'Discover 5 islands. Each grants a permanent bonus.', check: s => s.discoveredIslands.length >= 5, progress: s => ({ cur: s.discoveredIslands.length, max: 5 }), reward: gold(500) },
      { id: 'dig20', name: 'Gold Fever', hint: 'Dig up 20 treasures. Combine maps (Maps tab) for richer hauls.', check: s => s.stats.treasures >= 20, progress: s => ({ cur: s.stats.treasures, max: 20 }), reward: map('rare') },
      { id: 'isle10', name: 'Beyond the Horizon', hint: 'Discover 10 islands — later ones need Rare and Epic maps.', check: s => s.discoveredIslands.length >= 10, progress: s => ({ cur: s.discoveredIslands.length, max: 10 }), reward: map('epic') },
      { id: 'legMap', name: 'The Final Chart', hint: 'Find or combine your way to a Legendary map.', check: s => s.stats.legendaryMaps >= 1, reward: gold(10000) },
      { id: 'isleAll', name: 'Edge of the Map', hint: `Chart all ${ISLANDS.length} islands.`, check: s => s.discoveredIslands.length >= ISLANDS.length, progress: s => ({ cur: s.discoveredIslands.length, max: ISLANDS.length }), reward: gold(100000) },
    ],
  },
  {
    id: 'wealth', name: 'Path of the Merchant King', icon: '💰',
    goals: [
      { id: 'gold75', name: 'Earn Your Keep', hint: 'Earn 75 gold in total — Sail is the steady starter.', check: s => s.stats.totalGold >= 75, progress: s => ({ cur: s.stats.totalGold, max: 75 }), reward: map('common') },
      { id: 'dock1', name: 'Lay the First Plank', hint: 'Build a Dock in the Port tab. Buildings are permanent bonuses.', check: s => s.buildings.dock >= 1, reward: gold(40) },
      { id: 'tavern1', name: 'Pour the Rum', hint: 'Build a Tavern — crew drink rum to stay happy, and happy crews work harder.', check: s => s.buildings.tavern >= 1, reward: (s) => { s.resources.rum += 20; return '20 rum'; } },
      { id: 'trade100', name: 'Merchant Mind', hint: 'Trade 100 goods: buy low (▼), sell high (▲) on the Trade tab, or fence raid loot.', check: s => s.stats.goodsTraded >= 100, progress: s => ({ cur: s.stats.goodsTraded, max: 100 }), reward: gold(300) },
      { id: 'smuggle5', name: 'Night Work', hint: 'Complete 5 smuggling runs — lucrative, but risky.', check: s => s.stats.smuggleRuns >= 5, progress: s => ({ cur: s.stats.smuggleRuns, max: 5 }), reward: gold(300) },
      { id: 'port15', name: 'Port Town', hint: 'Reach 15 total building levels. Watch the harbor grow in the 3D view.', check: s => totalBuildingLevels(s) >= 15, progress: s => ({ cur: totalBuildingLevels(s), max: 15 }), reward: gold(1500) },
      { id: 'gold100k', name: 'War Chest', hint: 'Earn 100,000 gold in total. Trade routes and treasure scale hard.', check: s => s.stats.totalGold >= 100000, progress: s => ({ cur: s.stats.totalGold, max: 100000 }), reward: map('epic') },
      { id: 'gold1m', name: 'Millionaire Corsair', hint: 'Earn 1,000,000 gold in total.', check: s => s.stats.totalGold >= 1000000, progress: s => ({ cur: s.stats.totalGold, max: 1000000 }), reward: map('legendary') },
    ],
  },
  {
    id: 'fleet', name: 'Path of the Admiral', icon: '⛵',
    goals: [
      { id: 'crew2', name: 'Hands on Deck', hint: 'Recruit 2 crew (Crew tab, or the Recruit Crew activity).', check: s => s.stats.crewRecruited >= 2, progress: s => ({ cur: s.stats.crewRecruited, max: 2 }), reward: supplies(25) },
      { id: 'sloop', name: 'A Real Ship', hint: 'Order a Sloop (Fleet tab), then finish her with the Build Ships activity.', check: s => s.stats.shipsBuilt >= 1, reward: gold(100) },
      { id: 'crew6', name: 'Growing Crew', hint: 'Crew up to 6 hands — you may need a second ship for the bunks.', check: s => s.crewMembers.length >= 6, progress: s => ({ cur: s.crewMembers.length, max: 6 }), reward: supplies(100) },
      { id: 'promote1', name: 'First Mate', hint: 'Promote a crew member in the Crew tab. Officers pull far more weight.', check: s => s.crewMembers.some(m => m.role !== 'Deckhand'), reward: gold(200) },
      { id: 'brig', name: 'Iron Hull', hint: 'Build a Brig (Shipbuilding 10).', check: s => s.fleet.some(sh => sh.typeId === 'brig'), reward: gold(400) },
      { id: 'frigate', name: 'Tall Ships', hint: 'Build a Frigate (Shipbuilding 28). She fights best with 35 crew.', check: s => s.fleet.some(sh => sh.typeId === 'frigate'), reward: gold(5000) },
      { id: 'crew30', name: 'A Proper Company', hint: 'Muster 30 crew at once.', check: s => s.crewMembers.length >= 30, progress: s => ({ cur: s.crewMembers.length, max: 30 }), reward: gold(20000) },
      { id: 'manowar', name: 'Broadside Monarch', hint: 'Build a Man O’ War (Shipbuilding 40).', check: s => s.fleet.some(sh => sh.typeId === 'manowar'), reward: map('legendary') },
      { id: 'legendShip', name: 'Ship of Legend', hint: 'Build the Legendary Ship (Shipbuilding 55, costs treasure).', check: s => s.fleet.some(sh => sh.typeId === 'legendary'), reward: gold(500000) },
    ],
  },
  {
    id: 'legend', name: 'Path of the Legend', icon: '🌟',
    goals: [
      { id: 'skill25', name: 'Master of One', hint: 'Reach level 25 in any skill — focused activities train fastest.', check: s => maxSkill(s) >= 25, progress: s => ({ cur: maxSkill(s), max: 25 }), reward: gold(1000) },
      { id: 'relic1', name: 'Relic Seeker', hint: 'Recover a relic: Epic+ treasure hunts, Study Relics, or rare events.', check: s => s.relicsOwned.length >= 1, reward: (s) => { s.resources.knowledge += 50; return '50 knowledge'; } },
      { id: 'skill50', name: 'Seasoned Expert', hint: 'Reach level 50 in any skill.', check: s => maxSkill(s) >= 50, progress: s => ({ cur: maxSkill(s), max: 50 }), reward: gold(10000) },
      { id: 'relicSet', name: 'Complete a Set', hint: 'Collect all 3 relics of one set for its set bonus.', check: s => ['deep', 'regalia', 'navigator', 'cache'].some(set => RELICS.filter(r => r.set === set).every(r => s.relicsOwned.includes(r.id))), reward: gold(25000) },
      { id: 'rep10k', name: 'A Whispered Name', hint: 'Reach 10,000 reputation — diplomacy, raids and smuggling all build it.', check: s => s.resources.reputation >= 10000, progress: s => ({ cur: s.resources.reputation, max: 10000 }), reward: gold(5000) },
      { id: 'prestige1', name: 'Become a Legend', hint: 'Hit the Legend tab requirements and prestige. Mastery, relics and achievements carry over!', check: s => s.stats.prestiges >= 1, reward: gold(500) },
      { id: 'allRelics', name: 'Keeper of the Deep', hint: `Recover all ${RELICS.length} relics.`, check: s => s.relicsOwned.length >= RELICS.length, progress: s => ({ cur: s.relicsOwned.length, max: RELICS.length }), reward: gold(250000) },
      { id: 'prestige3', name: 'Legend of the Seas', hint: 'Prestige 3 times. Each legend compounds the last.', check: s => s.stats.prestiges >= 3, reward: gold(100000) },
    ],
  },
];

export function trackIndex(s: GameState, trackId: string): number {
  return s.questProgress[trackId] ?? 0;
}

export function currentGoal(s: GameState, track: QuestTrack): QuestDef | null {
  const idx = trackIndex(s, track.id);
  return idx < track.goals.length ? track.goals[idx] : null;
}

/** Advances every track (at most one completion per track per tick). */
export function tickQuests(s: GameState): void {
  for (const track of QUEST_TRACKS) {
    const goal = currentGoal(s, track);
    if (goal && goal.check(s)) {
      const rewardText = goal.reward(s);
      s.questProgress[track.id] = trackIndex(s, track.id) + 1;
      notify(`${track.icon} Goal complete: ${goal.name}! Reward: ${rewardText}`, 'achievement');
      logEvent(s, `Goal complete — ${goal.name} (reward: ${rewardText}).`);
    }
  }
}

export function totalGoals(): number {
  return QUEST_TRACKS.reduce((sum, t) => sum + t.goals.length, 0);
}

export function completedGoals(s: GameState): number {
  return QUEST_TRACKS.reduce((sum, t) => sum + Math.min(trackIndex(s, t.id), t.goals.length), 0);
}
