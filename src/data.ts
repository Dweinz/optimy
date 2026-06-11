// Static game data: skills, activities, ships, buildings, goods, islands,
// relics, raid targets and legend upgrades. Achievements & events live in
// their own modules.

import type {
  SkillDef, ActivityDef, ShipTypeDef, BuildingDef, TradeGoodDef,
  IslandDef, RelicDef, RelicSetDef, LegendUpgradeDef, RaidTargetDef, MapQuality,
  BossDef,
} from './types';

export const SKILLS: SkillDef[] = [
  { id: 'sailing', name: 'Sailing', icon: '⛵', desc: 'Faster voyages and better supply gathering at sea.', effects: [{ key: 'speed', perLevel: 1 }, { key: 'supplies', perLevel: 0.5 }] },
  { id: 'navigation', name: 'Navigation', icon: '🧭', desc: 'Improves voyage success and treasure discovery.', effects: [{ key: 'speed', perLevel: 0.5 }, { key: 'treasure', perLevel: 1 }] },
  { id: 'plundering', name: 'Plundering', icon: '🏴‍☠️', desc: 'More loot from raids on merchant shipping.', effects: [{ key: 'combat', perLevel: 1 }, { key: 'gold', perLevel: 0.3 }] },
  { id: 'treasureHunting', name: 'Treasure Hunting', icon: '💎', desc: 'Better odds and richer rewards when digging for treasure.', effects: [{ key: 'treasure', perLevel: 1.5 }] },
  { id: 'trading', name: 'Trading', icon: '⚖️', desc: 'Increases trade profits and unlocks trade routes (1 route per 8 levels).', effects: [{ key: 'trade', perLevel: 1.5 }] },
  { id: 'smuggling', name: 'Smuggling', icon: '🌑', desc: 'Safer smuggling runs and a little extra coin everywhere.', effects: [{ key: 'smuggleSafety', perLevel: 1 }, { key: 'gold', perLevel: 0.2 }] },
  { id: 'shipbuilding', name: 'Shipbuilding', icon: '🔨', desc: 'Unlocks new ship classes, builds faster and cheaper.', effects: [{ key: 'build', perLevel: 2 }, { key: 'shipDiscount', perLevel: 0.5 }] },
  { id: 'crewManagement', name: 'Crew Management', icon: '👥', desc: 'Crew works harder and fewer hands are lost.', effects: [{ key: 'crewEff', perLevel: 1 }, { key: 'crewSafety', perLevel: 1 }] },
  { id: 'diplomacy', name: 'Diplomacy', icon: '🤝', desc: 'Gain influence and reputation faster.', effects: [{ key: 'influence', perLevel: 1.5 }, { key: 'reputation', perLevel: 1 }] },
  { id: 'cartography', name: 'Cartography', icon: '🗺️', desc: 'Find maps faster and of higher quality.', effects: [{ key: 'mapFind', perLevel: 1.5 }, { key: 'treasure', perLevel: 0.5 }] },
  { id: 'tavernKeeping', name: 'Tavern Keeping', icon: '🍺', desc: 'Brew more rum and attract recruits.', effects: [{ key: 'rum', perLevel: 2 }, { key: 'recruit', perLevel: 1 }] },
  { id: 'navalCombat', name: 'Naval Combat', icon: '⚔️', desc: 'Stronger fleet in battle, safer crews.', effects: [{ key: 'combat', perLevel: 1.5 }, { key: 'crewSafety', perLevel: 0.5 }] },
  { id: 'cursedLore', name: 'Cursed Lore', icon: '☠️', desc: 'Unlocks relic powers and arcane knowledge.', effects: [{ key: 'relicFind', perLevel: 1.5 }, { key: 'knowledge', perLevel: 1 }] },
];

export const ACTIVITIES: ActivityDef[] = [
  { id: 'sail', name: 'Sail', icon: '⛵', skill: 'sailing', desc: 'Patrol the seas: earn gold and gather supplies.' },
  { id: 'explore', name: 'Explore', icon: '🧭', skill: 'navigation', desc: 'Chart unknown waters and discover islands. Consumes supplies.' },
  { id: 'raid', name: 'Raid', icon: '🏴‍☠️', skill: 'plundering', desc: 'Attack merchant shipping for gold, goods and reputation.' },
  { id: 'trade', name: 'Trade', icon: '⚖️', skill: 'trading', desc: 'Run cargo for steady gold; produces trade goods.' },
  { id: 'smuggle', name: 'Smuggle', icon: '🌑', skill: 'smuggling', desc: 'High risk, high reward runs. Can go badly wrong.' },
  { id: 'treasureHunt', name: 'Treasure Hunt', icon: '💎', skill: 'treasureHunting', desc: 'Follow maps to buried treasure. Consumes maps.' },
  { id: 'recruit', name: 'Recruit Crew', icon: '👥', skill: 'crewManagement', desc: 'Scour the docks for able hands. Costs gold per recruit.' },
  { id: 'buildShips', name: 'Build Ships', icon: '🔨', skill: 'shipbuilding', desc: 'Work the shipyard to finish ordered ships faster.' },
  { id: 'tavern', name: 'Manage Tavern', icon: '🍺', skill: 'tavernKeeping', desc: 'Brew rum and listen for rumors of treasure.' },
  { id: 'researchMaps', name: 'Research Maps', icon: '🗺️', skill: 'cartography', desc: 'Piece together sea charts and treasure maps.' },
  { id: 'studyRelics', name: 'Study Relics', icon: '☠️', skill: 'cursedLore', desc: 'Probe cursed mysteries. Spends knowledge, may reveal relics.' },
  { id: 'diplomacy', name: 'Diplomacy', icon: '🤝', skill: 'diplomacy', desc: 'Court pirate lords and governors for influence.' },
];

export const SHIP_TYPES: ShipTypeDef[] = [
  { id: 'raft', name: 'Raft', icon: '🛶', costGold: 30, costSupplies: 0, costTreasure: 0, buildPoints: 10, capacity: 2, crewReq: 1, speed: 1, power: 1, cargo: 5, skillReq: 1 },
  { id: 'sloop', name: 'Sloop', icon: '⛵', costGold: 250, costSupplies: 50, costTreasure: 0, buildPoints: 60, capacity: 6, crewReq: 4, speed: 2, power: 4, cargo: 20, skillReq: 4 },
  { id: 'brig', name: 'Brig', icon: '🚤', costGold: 1500, costSupplies: 300, costTreasure: 0, buildPoints: 220, capacity: 14, crewReq: 10, speed: 3, power: 12, cargo: 60, skillReq: 10 },
  { id: 'brigantine', name: 'Brigantine', icon: '⛴️', costGold: 8000, costSupplies: 1200, costTreasure: 0, buildPoints: 650, capacity: 24, crewReq: 18, speed: 4.5, power: 30, cargo: 150, skillReq: 18 },
  { id: 'frigate', name: 'Frigate', icon: '🚢', costGold: 40000, costSupplies: 5000, costTreasure: 50, buildPoints: 2200, capacity: 45, crewReq: 35, speed: 6, power: 80, cargo: 400, skillReq: 28 },
  { id: 'manowar', name: 'Man O’ War', icon: '🛳️', costGold: 220000, costSupplies: 22000, costTreasure: 300, buildPoints: 7000, capacity: 100, crewReq: 80, speed: 7, power: 220, cargo: 900, skillReq: 40 },
  { id: 'legendary', name: 'Legendary Ship', icon: '🐉', costGold: 1500000, costSupplies: 100000, costTreasure: 2000, buildPoints: 22000, capacity: 200, crewReq: 150, speed: 10, power: 600, cargo: 2500, skillReq: 55 },
];

export const BUILDINGS: BuildingDef[] = [
  { id: 'dock', name: 'Dock', icon: '⚓', desc: 'Faster loading and departures. +2% voyage speed per level.', baseCost: 50, costMult: 1.6, bonus: { key: 'speed', perLevel: 2 } },
  { id: 'warehouse', name: 'Warehouse', icon: '📦', desc: 'Stores provisions. +3% supplies gain and passive supplies per level.', baseCost: 80, costMult: 1.6, bonus: { key: 'supplies', perLevel: 3 } },
  { id: 'tavern', name: 'Tavern', icon: '🍺', desc: 'Attracts sailors. +3% recruitment per level, brews rum passively.', baseCost: 120, costMult: 1.6, bonus: { key: 'recruit', perLevel: 3 } },
  { id: 'shipyard', name: 'Shipyard', icon: '🔨', desc: '+5% build speed per level and passive construction progress.', baseCost: 200, costMult: 1.65, bonus: { key: 'build', perLevel: 5 } },
  { id: 'market', name: 'Market', icon: '⚖️', desc: '+3% trade profit per level, auto-sells trade goods.', baseCost: 150, costMult: 1.6, bonus: { key: 'trade', perLevel: 3 } },
  { id: 'smugglerDen', name: 'Smuggler Den', icon: '🌑', desc: '+3% smuggling safety and +1% gold per level.', baseCost: 400, costMult: 1.65, bonus: { key: 'smuggleSafety', perLevel: 3 } },
  { id: 'mapArchive', name: 'Map Archive', icon: '🗺️', desc: '+4% map finding per level.', baseCost: 600, costMult: 1.65, bonus: { key: 'mapFind', perLevel: 4 } },
  { id: 'fortress', name: 'Fortress', icon: '🏰', desc: '+4% combat power and +2% crew safety per level.', baseCost: 1000, costMult: 1.7, bonus: { key: 'combat', perLevel: 4 } },
  { id: 'relicVault', name: 'Relic Vault', icon: '🔮', desc: '+5% relic finding and +2% knowledge per level.', baseCost: 2500, costMult: 1.7, bonus: { key: 'relicFind', perLevel: 5 } },
];

export const TRADE_GOODS: TradeGoodDef[] = [
  { id: 'sugar', name: 'Sugar', icon: '🍬', basePrice: 4, volatility: 0.35 },
  { id: 'tea', name: 'Tea', icon: '🍵', basePrice: 6, volatility: 0.4 },
  { id: 'rumCasks', name: 'Rum Casks', icon: '🛢️', basePrice: 9, volatility: 0.45 },
  { id: 'spices', name: 'Spices', icon: '🌶️', basePrice: 12, volatility: 0.5 },
  { id: 'tobacco', name: 'Tobacco', icon: '🍂', basePrice: 15, volatility: 0.5 },
  { id: 'silk', name: 'Silk', icon: '🎀', basePrice: 25, volatility: 0.55 },
  { id: 'weapons', name: 'Weapons', icon: '🗡️', basePrice: 40, volatility: 0.6 },
  { id: 'exotic', name: 'Exotic Goods', icon: '🦜', basePrice: 90, volatility: 0.7 },
];

export const MAP_QUALITIES: MapQuality[] = ['common', 'rare', 'epic', 'legendary'];

export const MAP_QUALITY_INFO: Record<MapQuality, { name: string; icon: string; color: string }> = {
  common: { name: 'Common', icon: '📄', color: '#c9b896' },
  rare: { name: 'Rare', icon: '📜', color: '#6aa7d8' },
  epic: { name: 'Epic', icon: '🗞️', color: '#b58ae0' },
  legendary: { name: 'Legendary', icon: '🏮', color: '#f0cf5d' },
};

export const ISLANDS: IslandDef[] = [
  { id: 'driftwood', name: 'Driftwood Cay', type: 'Jungle Island', threshold: 25, mapNeed: null, reward: { knowledge: 5, gold: 20 }, bonus: { key: 'supplies', value: 3 }, desc: 'A sleepy cay of palms and driftwood huts.' },
  { id: 'saltport', name: 'Saltport', type: 'Trading Port', threshold: 60, mapNeed: null, reward: { knowledge: 10, gold: 50 }, bonus: { key: 'trade', value: 4 }, desc: 'A bustling free port. Opens a trade route.' },
  { id: 'emberpeak', name: 'Ember Peak', type: 'Volcanic Island', threshold: 110, mapNeed: null, reward: { knowledge: 15, gold: 100 }, rewardMaps: { common: 1 }, bonus: { key: 'build', value: 5 }, desc: 'Obsidian shores rich in shipbuilding timber and tar.' },
  { id: 'verdance', name: 'Verdance Isle', type: 'Jungle Island', threshold: 180, mapNeed: null, reward: { knowledge: 20, supplies: 100 }, bonus: { key: 'supplies', value: 5 }, desc: 'Endless jungle bursting with provisions.' },
  { id: 'gullroost', name: 'Gull’s Roost', type: 'Smuggler Haven', threshold: 280, mapNeed: null, reward: { knowledge: 25, gold: 250 }, bonus: { key: 'smuggleSafety', value: 5 }, desc: 'Smugglers trade secrets over cheap rum.' },
  { id: 'oldstones', name: 'Old Stones', type: 'Ancient Ruins', threshold: 420, mapNeed: null, reward: { knowledge: 60 }, rewardMaps: { rare: 1 }, bonus: { key: 'knowledge', value: 6 }, desc: 'Crumbled pillars of a forgotten empire.' },
  { id: 'cannonreef', name: 'Cannon Reef', type: 'Naval Fortress', threshold: 600, mapNeed: null, reward: { knowledge: 40, gold: 600 }, bonus: { key: 'combat', value: 5 }, desc: 'An abandoned fortress bristling with iron.' },
  { id: 'silkharbor', name: 'Silk Harbor', type: 'Trading Port', threshold: 850, mapNeed: 'common', reward: { knowledge: 50, gold: 1000 }, bonus: { key: 'trade', value: 6 }, desc: 'Wealthy eastern port. Opens a trade route.' },
  { id: 'mistisle', name: 'Mist Isle', type: 'Ghost Island', threshold: 1200, mapNeed: 'common', reward: { knowledge: 80, cursedRelics: 2 }, bonus: { key: 'relicFind', value: 6 }, desc: 'The fog whispers names of the drowned.' },
  { id: 'goldtooth', name: 'Goldtooth Atoll', type: 'Treasure Island', threshold: 1700, mapNeed: 'rare', reward: { gold: 3000, treasure: 30 }, rewardMaps: { epic: 1 }, bonus: { key: 'treasure', value: 6 }, desc: 'Sand the color of doubloons.' },
  { id: 'blackmaw', name: 'Blackmaw Caldera', type: 'Volcanic Island', threshold: 2400, mapNeed: 'rare', reward: { knowledge: 150, gold: 4000 }, bonus: { key: 'build', value: 8 }, desc: 'Forge-hot springs temper legendary hulls.' },
  { id: 'sirensgrave', name: 'Siren’s Grave', type: 'Ghost Island', threshold: 3300, mapNeed: 'epic', reward: { knowledge: 250, cursedRelics: 5 }, bonus: { key: 'relicFind', value: 8 }, desc: 'Songs still rise from the wrecks below.' },
  { id: 'ironbar', name: 'Iron Bar', type: 'Naval Fortress', threshold: 4500, mapNeed: 'epic', reward: { gold: 12000, reputation: 500 }, bonus: { key: 'combat', value: 8 }, desc: 'A navy bastion ripe for the taking.' },
  { id: 'sunkencourt', name: 'The Sunken Court', type: 'Ancient Ruins', threshold: 6000, mapNeed: 'epic', reward: { knowledge: 600, treasure: 150 }, rewardMaps: { legendary: 1 }, bonus: { key: 'knowledge', value: 10 }, desc: 'Throne rooms of coral and bone.' },
  { id: 'midnightmarket', name: 'Midnight Market', type: 'Smuggler Haven', threshold: 8000, mapNeed: 'legendary', reward: { gold: 50000, influence: 300 }, bonus: { key: 'trade', value: 10 }, desc: 'Everything is for sale here. Everything.' },
  { id: 'worldsend', name: 'World’s End', type: 'Treasure Island', threshold: 11000, mapNeed: 'legendary', reward: { gold: 150000, treasure: 1000, cursedRelics: 10 }, bonus: { key: 'treasure', value: 12 }, desc: 'The last island on every legendary map.' },
];

export const RELIC_SETS: RelicSetDef[] = [
  { id: 'deep', name: 'Curse of the Deep', bonus: { key: 'relicFind', value: 10 } },
  { id: 'regalia', name: 'Captain’s Regalia', bonus: { key: 'xp', value: 10 } },
  { id: 'navigator', name: 'Navigator’s Secrets', bonus: { key: 'treasure', value: 10 } },
  { id: 'cache', name: 'Smuggler’s Cache', bonus: { key: 'trade', value: 10 } },
];

export const RELICS: RelicDef[] = [
  { id: 'blackPearl', name: 'Black Pearl Fragment', icon: '⚫', set: 'deep', bonus: { key: 'gold', value: 5 }, desc: 'A shard of the cursed pearl. Gold seeks it.' },
  { id: 'krakenTooth', name: 'Kraken Tooth', icon: '🦷', set: 'deep', bonus: { key: 'combat', value: 8 }, desc: 'Still sharp. Still hungry.' },
  { id: 'ghostLantern', name: 'Ghost Lantern', icon: '🏮', set: 'deep', bonus: { key: 'treasure', value: 8 }, desc: 'Its light falls only on buried things.' },
  { id: 'captainsCompass', name: 'Captain’s Compass', icon: '🧭', set: 'regalia', bonus: { key: 'speed', value: 8 }, desc: 'Points to what you want most.' },
  { id: 'cursedCoin', name: 'Cursed Coin', icon: '🪙', set: 'regalia', bonus: { key: 'gold', value: 10 }, desc: 'It always comes back. With friends.' },
  { id: 'seaKingsCrown', name: 'Sea King’s Crown', icon: '👑', set: 'regalia', bonus: { key: 'influence', value: 15 }, desc: 'Heavy is the head beneath the waves.' },
  { id: 'starChart', name: 'Celestial Star Chart', icon: '✨', set: 'navigator', bonus: { key: 'mapFind', value: 10 }, desc: 'The stars never lie. Sailors do.' },
  { id: 'brassSpyglass', name: 'Brass Spyglass', icon: '🔭', set: 'navigator', bonus: { key: 'treasure', value: 6 }, desc: 'Sees through fog, lies, and hull planks.' },
  { id: 'stormGlass', name: 'Storm Glass', icon: '🌀', set: 'navigator', bonus: { key: 'speed', value: 6 }, desc: 'Predicts the weather. Occasionally causes it.' },
  { id: 'markedDoubloon', name: 'Marked Doubloon', icon: '🔱', set: 'cache', bonus: { key: 'trade', value: 8 }, desc: 'Every fence in the seven seas honors it.' },
  { id: 'shadowFlag', name: 'Shadow Flag', icon: '🏴', set: 'cache', bonus: { key: 'smuggleSafety', value: 10 }, desc: 'Ships flying it cast no silhouette.' },
  { id: 'hollowBarrel', name: 'Hollow Barrel', icon: '🛢️', set: 'cache', bonus: { key: 'gold', value: 6 }, desc: 'False bottom. True profits.' },
];

export const RAID_TARGETS: RaidTargetDef[] = [
  { id: 'fisher', name: 'Fishing Sloop', power: 4, gold: 30, goods: 2, rep: 1 },
  { id: 'merchant', name: 'Merchant Brig', power: 22, gold: 160, goods: 10, rep: 4 },
  { id: 'convoy', name: 'Trade Convoy', power: 90, gold: 750, goods: 40, rep: 15 },
  { id: 'galleon', name: 'Treasure Galleon', power: 380, gold: 4200, goods: 150, rep: 60 },
  { id: 'flagship', name: 'Navy Flagship', power: 1500, gold: 22000, goods: 500, rep: 260 },
];

// Bounty bosses: a clear power ladder to measure your fleet against. Each
// defeat grants a permanent (per-run) bonus and reveals the next bounty.
export const BOSSES: BossDef[] = [
  { id: 'dan', name: 'Scurvy Dog Dan', icon: '🐀', power: 12, rewardGold: 300, rewardTreasure: 5, rewardMap: 'common', bonus: { key: 'gold', value: 3 }, desc: 'A loud-mouthed cutthroat shaking down fishermen. Every legend starts somewhere.' },
  { id: 'bonecrush', name: 'Captain Bonecrush', icon: '💀', power: 50, rewardGold: 1500, rewardTreasure: 20, rewardMap: 'rare', bonus: { key: 'combat', value: 4 }, desc: 'Wears a necklace of jawbones. Wants yours for the collection.' },
  { id: 'commodore', name: 'The Iron Commodore', icon: '⚙️', power: 180, rewardGold: 6000, rewardTreasure: 60, rewardMap: 'rare', bonus: { key: 'speed', value: 5 }, desc: 'A navy turncoat with an armored flagship and a grudge against everyone.' },
  { id: 'hexx', name: 'Madame Hexx', icon: '🔮', power: 550, rewardGold: 20000, rewardTreasure: 180, rewardMap: 'epic', bonus: { key: 'relicFind', value: 8 }, desc: 'Sails a ship of whale-bone. Her cannons fire curses as often as iron.' },
  { id: 'ghostadmiral', name: 'The Ghost Admiral', icon: '👻', power: 1600, rewardGold: 65000, rewardTreasure: 500, rewardMap: 'epic', bonus: { key: 'xp', value: 5 }, desc: 'Commands a fleet that sank two hundred years ago. It has not noticed.' },
  { id: 'krakenpriest', name: 'Priest of the Kraken', icon: '🐙', power: 4500, rewardGold: 220000, rewardTreasure: 1500, rewardMap: 'legendary', bonus: { key: 'treasure', value: 8 }, desc: 'Feeds ships to his god. Yours looks delicious.' },
  { id: 'leviathan', name: 'The Leviathan', icon: '🐋', power: 12000, rewardGold: 750000, rewardTreasure: 4000, rewardMap: 'legendary', bonus: { key: 'gold', value: 8 }, desc: 'Not a captain. Not a ship. A vast hunger older than the charts.' },
  { id: 'seaking', name: 'The Sea King', icon: '🔱', power: 40000, rewardGold: 3000000, rewardTreasure: 15000, rewardMap: 'legendary', bonus: { key: 'influence', value: 20 }, desc: 'The drowned monarch of all seven seas. Defeat him, and the throne is yours.' },
];

export const LEGEND_UPGRADES: LegendUpgradeDef[] = [
  { id: 'legXp', name: 'Tales of Glory', desc: '+10% all XP per level.', baseCost: 1, costMult: 2, maxLevel: 10, bonus: { key: 'xp', perLevel: 10 } },
  { id: 'legGold', name: 'Golden Reputation', desc: '+10% gold per level.', baseCost: 1, costMult: 2, maxLevel: 10, bonus: { key: 'gold', perLevel: 10 } },
  { id: 'legSpeed', name: 'Favorable Winds', desc: '+5% voyage speed per level.', baseCost: 2, costMult: 2, maxLevel: 10, bonus: { key: 'speed', perLevel: 5 } },
  { id: 'legTreasure', name: 'Treasure Sense', desc: '+10% treasure chance per level.', baseCost: 2, costMult: 2, maxLevel: 10, bonus: { key: 'treasure', perLevel: 10 } },
  { id: 'legRecruit', name: 'Famous Captain', desc: '+10% crew recruitment per level.', baseCost: 2, costMult: 2, maxLevel: 10, bonus: { key: 'recruit', perLevel: 10 } },
  { id: 'legTrade', name: 'Merchant Prince', desc: '+10% trade profit per level.', baseCost: 2, costMult: 2, maxLevel: 10, bonus: { key: 'trade', perLevel: 10 } },
  { id: 'legCombat', name: 'Terror of the Seas', desc: '+10% combat power per level.', baseCost: 3, costMult: 2, maxLevel: 10, bonus: { key: 'combat', perLevel: 10 } },
  { id: 'legRelic', name: 'Cursed Affinity', desc: '+10% relic find per level.', baseCost: 3, costMult: 2, maxLevel: 8, bonus: { key: 'relicFind', perLevel: 10 } },
  { id: 'legBuild', name: 'Master Shipwright', desc: '+10% build speed per level.', baseCost: 2, costMult: 2, maxLevel: 10, bonus: { key: 'build', perLevel: 10 } },
];

export function shipType(id: string): ShipTypeDef {
  return SHIP_TYPES.find(t => t.id === id) ?? SHIP_TYPES[0];
}

export function fmt(n: number): string {
  if (!isFinite(n)) return '∞';
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (abs >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  if (abs >= 100) return Math.floor(n).toString();
  if (abs >= 10) return (Math.floor(n * 10) / 10).toString();
  return (Math.floor(n * 100) / 100).toString();
}
