// 45 achievements, each granting a small permanent bonus. Checked every tick.

import type { AchievementDef, GameState, BonusKey } from './types';
import { SKILLS, BUILDINGS, RELICS, ISLANDS } from './data';
import { notify, logEvent } from './notifications';

function totalLevels(s: GameState): number {
  return SKILLS.reduce((sum, def) => sum + s.skills[def.id].level, 0);
}

function maxLevel(s: GameState): number {
  return SKILLS.reduce((m, def) => Math.max(m, s.skills[def.id].level), 0);
}

function totalBuildings(s: GameState): number {
  return BUILDINGS.reduce((sum, def) => sum + s.buildings[def.id], 0);
}

function a(id: string, name: string, desc: string, key: BonusKey, value: number, check: (s: GameState) => boolean): AchievementDef {
  return { id, name, desc, check, bonus: { key, value } };
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // Voyages & sailing
  a('firstVoyage', 'First Voyage', 'Complete your first voyage.', 'speed', 1, s => s.stats.voyages >= 1),
  a('voyages25', 'Sea Legs', 'Complete 25 voyages.', 'speed', 1, s => s.stats.voyages >= 25),
  a('voyages250', 'Old Salt', 'Complete 250 voyages.', 'speed', 2, s => s.stats.voyages >= 250),
  a('voyages2500', 'Eternal Mariner', 'Complete 2,500 voyages.', 'speed', 3, s => s.stats.voyages >= 2500),
  // Gold
  a('gold100', 'Pocket Change', 'Earn 100 gold in total.', 'gold', 1, s => s.stats.totalGold >= 100),
  a('gold10k', '10,000 Gold', 'Earn 10,000 gold in total.', 'gold', 1, s => s.stats.totalGold >= 10000),
  a('gold1m', 'Millionaire Corsair', 'Earn 1,000,000 gold in total.', 'gold', 2, s => s.stats.totalGold >= 1e6),
  a('gold100m', 'Dragon’s Hoard', 'Earn 100,000,000 gold in total.', 'gold', 3, s => s.stats.totalGold >= 1e8),
  // Crew
  a('crew5', 'Small Band', 'Recruit 5 crew in total.', 'recruit', 1, s => s.stats.crewRecruited >= 5),
  a('crew25', 'Full Roster', 'Recruit 25 crew in total.', 'recruit', 2, s => s.stats.crewRecruited >= 25),
  a('crew100', '100 Crew', 'Recruit 100 crew in total.', 'crewEff', 2, s => s.stats.crewRecruited >= 100),
  a('crew500', 'Pirate Armada Muster', 'Recruit 500 crew in total.', 'crewEff', 3, s => s.stats.crewRecruited >= 500),
  // Ships
  a('ships2', 'Two Masts', 'Own 2 ships at once.', 'speed', 1, s => s.fleet.length >= 2),
  a('ships5', 'Flotilla', 'Own 5 ships at once.', 'combat', 2, s => s.fleet.length >= 5),
  a('ships10', 'Fleet Admiral', 'Own 10 ships at once.', 'combat', 2, s => s.fleet.length >= 10),
  a('ships25', 'Sea Empire', 'Own 25 ships at once.', 'combat', 3, s => s.fleet.length >= 25),
  a('firstFrigate', 'First Frigate', 'Own a Frigate.', 'combat', 2, s => s.fleet.some(sh => sh.typeId === 'frigate')),
  a('manowar', 'Broadside Monarch', 'Own a Man O’ War.', 'combat', 3, s => s.fleet.some(sh => sh.typeId === 'manowar')),
  a('legendShip', 'Ship of Legend', 'Own a Legendary Ship.', 'gold', 5, s => s.fleet.some(sh => sh.typeId === 'legendary')),
  // Islands
  a('island1', 'Landfall', 'Discover your first island.', 'mapFind', 1, s => s.discoveredIslands.length >= 1),
  a('island5', 'Archipelago', 'Discover 5 islands.', 'mapFind', 2, s => s.discoveredIslands.length >= 5),
  a('island10', 'Chartered Waters', 'Discover 10 islands.', 'treasure', 2, s => s.discoveredIslands.length >= 10),
  a('islandAll', 'Edge of the Map', 'Discover every island.', 'treasure', 5, s => s.discoveredIslands.length >= ISLANDS.length),
  // Treasure
  a('firstTreasure', 'First Treasure', 'Dig up your first treasure.', 'treasure', 1, s => s.stats.treasures >= 1),
  a('treasure25', 'Gold Fever', 'Dig up 25 treasures.', 'treasure', 2, s => s.stats.treasures >= 25),
  a('treasure250', 'Treasure Master', 'Dig up 250 treasures.', 'treasure', 3, s => s.stats.treasures >= 250),
  a('hoard10k', 'Vault of Kings', 'Hold 10,000 treasure at once.', 'gold', 3, s => s.resources.treasure >= 10000),
  // Maps
  a('map1', 'X Marks the Spot', 'Find your first map.', 'mapFind', 1, s => s.stats.mapsFound >= 1),
  a('map50', 'Chart Collector', 'Find 50 maps.', 'mapFind', 2, s => s.stats.mapsFound >= 50),
  a('map500', 'The Grand Atlas', 'Find 500 maps.', 'mapFind', 3, s => s.stats.mapsFound >= 500),
  a('legendaryMap', 'First Legendary Map', 'Find a legendary map.', 'treasure', 3, s => s.stats.legendaryMaps >= 1),
  // Raiding
  a('raid1', 'First Blood', 'Win your first raid.', 'combat', 1, s => s.stats.raidsWon >= 1),
  a('raid50', 'Scourge of Merchants', 'Win 50 raids.', 'combat', 2, s => s.stats.raidsWon >= 50),
  a('raid500', 'Terror Incarnate', 'Win 500 raids.', 'combat', 3, s => s.stats.raidsWon >= 500),
  // Smuggling
  a('smuggle10', 'Night Runner', 'Complete 10 smuggling runs.', 'smuggleSafety', 2, s => s.stats.smuggleRuns >= 10),
  a('smuggle200', 'King of Smugglers', 'Complete 200 smuggling runs.', 'gold', 3, s => s.stats.smuggleRuns >= 200),
  // Skills
  a('skill25', 'Practiced Hand', 'Reach level 25 in any skill.', 'xp', 1, s => maxLevel(s) >= 25),
  a('skill50', 'Seasoned Expert', 'Reach level 50 in any skill.', 'xp', 2, s => maxLevel(s) >= 50),
  a('skill99', 'Living Legend', 'Reach level 99 in any skill.', 'xp', 3, s => maxLevel(s) >= 99),
  a('levels100', 'Jack of All Trades', 'Reach 100 total skill levels.', 'xp', 2, s => totalLevels(s) >= 100),
  a('levels500', 'Master of All Seas', 'Reach 500 total skill levels.', 'xp', 3, s => totalLevels(s) >= 500),
  // Relics
  a('relic1', 'First Relic', 'Recover your first relic.', 'relicFind', 2, s => s.relicsOwned.length >= 1),
  a('relic6', 'Cursed Collector', 'Recover 6 relics.', 'relicFind', 3, s => s.relicsOwned.length >= 6),
  a('relicAll', 'Keeper of the Deep', 'Recover every relic.', 'gold', 5, s => s.relicsOwned.length >= RELICS.length),
  // Port
  a('port5', 'Humble Harbor', 'Reach 5 total building levels.', 'gold', 1, s => totalBuildings(s) >= 5),
  a('port25', 'Thriving Port', 'Reach 25 total building levels.', 'trade', 2, s => totalBuildings(s) >= 25),
  a('port60', 'Pirate Capital', 'Reach 60 total building levels.', 'gold', 3, s => totalBuildings(s) >= 60),
  // Bounties
  a('boss1', 'Bounty Hunter', 'Defeat your first bounty boss.', 'combat', 2, s => s.stats.bossesDefeated >= 1),
  a('boss8', 'The Ladder Climbed', 'Defeat 8 bounty bosses.', 'combat', 3, s => s.stats.bossesDefeated >= 8),
  a('boss24', 'Nemesis of Legends', 'Defeat 24 bounty bosses across all lives.', 'gold', 4, s => s.stats.bossesDefeated >= 24),
  // Reputation & prestige
  a('pirateLord', 'Pirate Lord', 'Reach 50,000 reputation.', 'reputation', 3, s => s.resources.reputation >= 50000),
  a('legend1', 'Become a Legend', 'Prestige for the first time.', 'xp', 5, s => s.stats.prestiges >= 1),
  a('legend3', 'Legend of the Seas', 'Prestige 3 times.', 'gold', 5, s => s.stats.prestiges >= 3),
];

/** Checks all achievements and unlocks new ones. */
export function checkAchievements(s: GameState): void {
  for (const def of ACHIEVEMENTS) {
    if (!s.achievements.includes(def.id) && def.check(s)) {
      s.achievements.push(def.id);
      notify(`🏆 Achievement: ${def.name}! (+${def.bonus.value}% ${def.bonus.key})`, 'achievement');
      logEvent(s, `Achievement unlocked — ${def.name}.`);
    }
  }
}
