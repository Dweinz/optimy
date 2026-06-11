// Static definitions: resources, buildings & recipes, ships, tech tree.

import type { ResourceId, BuildingDef, ShipTypeDef, TechBranchDef, TraitId } from './types';

export const RESOURCES: { id: ResourceId; name: string; icon: string }[] = [
  { id: 'wood', name: 'Wood', icon: '🪵' },
  { id: 'stone', name: 'Stone', icon: '🪨' },
  { id: 'ironOre', name: 'Iron Ore', icon: '⛏️' },
  { id: 'iron', name: 'Iron', icon: '🔩' },
  { id: 'coal', name: 'Coal', icon: '⚫' },
  { id: 'food', name: 'Food', icon: '🍞' },
  { id: 'sugar', name: 'Sugar', icon: '🍬' },
  { id: 'rum', name: 'Rum', icon: '🍺' },
  { id: 'cloth', name: 'Cloth', icon: '🧵' },
  { id: 'cannons', name: 'Cannons', icon: '💣' },
  { id: 'weapons', name: 'Weapons', icon: '🗡️' },
  { id: 'shipParts', name: 'Ship Parts', icon: '⚙️' },
  { id: 'maps', name: 'Maps', icon: '🗺️' },
  { id: 'treasure', name: 'Treasure', icon: '💎' },
  { id: 'crew', name: 'Crew', icon: '👥' },
];

export const RES_ICON: Record<ResourceId, string> = Object.fromEntries(
  RESOURCES.map(r => [r.id, r.icon]),
) as Record<ResourceId, string>;

export const RES_NAME: Record<ResourceId, string> = Object.fromEntries(
  RESOURCES.map(r => [r.id, r.name]),
) as Record<ResourceId, string>;

export const TRAIT_INFO: Record<TraitId, { name: string; icon: string }> = {
  forest: { name: 'Forest', icon: '🌲' },
  iron: { name: 'Iron Deposit', icon: '⛏️' },
  coal: { name: 'Coal Seam', icon: '⚫' },
  stone: { name: 'Stone Quarry', icon: '🪨' },
  fertile: { name: 'Fertile Land', icon: '🌾' },
  ruins: { name: 'Ancient Ruins', icon: '🏛️' },
  treasureSite: { name: 'Treasure Site', icon: '💎' },
};

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'dock', name: 'Dock', icon: '⚓', maxLevel: 3, unique: true,
    desc: 'The heart of an island. Required for routes, expeditions and colonization. Higher levels load ships faster.',
    cost: { wood: 25 }, costGold: 0, recipes: [],
  },
  {
    id: 'warehouse', name: 'Warehouse', icon: '📦', maxLevel: 3,
    desc: '+150 storage capacity per resource per level on this island.',
    cost: { wood: 20, stone: 10 }, costGold: 0, recipes: [],
  },
  {
    id: 'woodCamp', name: 'Wood Camp', icon: '🪓', maxLevel: 3, traitAny: ['forest'],
    desc: 'Fells timber. Needs a forest island.',
    cost: { wood: 10 }, costGold: 0,
    recipes: [{ name: 'Cut Wood', inputs: {}, outputs: { wood: 4 }, cycle: 6, workers: 2, trait: 'forest' }],
  },
  {
    id: 'mine', name: 'Mine', icon: '⛏️', maxLevel: 3, traitAny: ['iron', 'coal', 'stone'],
    desc: 'Extracts whatever the island holds: iron ore, coal or stone.',
    cost: { wood: 15, stone: 5 }, costGold: 0,
    recipes: [
      { name: 'Mine Iron Ore', inputs: {}, outputs: { ironOre: 3 }, cycle: 7, workers: 3, trait: 'iron' },
      { name: 'Mine Coal', inputs: {}, outputs: { coal: 3 }, cycle: 7, workers: 3, trait: 'coal' },
      { name: 'Quarry Stone', inputs: {}, outputs: { stone: 4 }, cycle: 6, workers: 3, trait: 'stone' },
    ],
  },
  {
    id: 'farm', name: 'Farm', icon: '🌾', maxLevel: 3, traitAny: ['fertile'],
    desc: 'Grows food. Crew everywhere are hungry.',
    cost: { wood: 10 }, costGold: 0,
    recipes: [{ name: 'Grow Food', inputs: {}, outputs: { food: 5 }, cycle: 8, workers: 2, trait: 'fertile' }],
  },
  {
    id: 'plantation', name: 'Sugar Plantation', icon: '🎍', maxLevel: 3, traitAny: ['fertile'],
    desc: 'Cane for the rum trade. Needs fertile land.',
    cost: { wood: 12 }, costGold: 0,
    recipes: [
      { name: 'Harvest Sugar', inputs: {}, outputs: { sugar: 3 }, cycle: 8, workers: 2, trait: 'fertile' },
      { name: 'Weave Cloth', inputs: {}, outputs: { cloth: 1 }, cycle: 12, workers: 2, trait: 'fertile' },
    ],
  },
  {
    id: 'smelter', name: 'Smelter', icon: '🔥', maxLevel: 3,
    desc: 'Smelts iron ore with coal into iron bars.',
    cost: { stone: 20, wood: 10 }, costGold: 0,
    recipes: [{ name: 'Smelt Iron', inputs: { ironOre: 3, coal: 1 }, outputs: { iron: 2 }, cycle: 8, workers: 2 }],
  },
  {
    id: 'distillery', name: 'Rum Distillery', icon: '🍺', maxLevel: 3,
    desc: 'Turns sugar into rum — the true currency of the seas.',
    cost: { wood: 15, stone: 5, iron: 2 }, costGold: 0,
    recipes: [{ name: 'Distill Rum', inputs: { sugar: 3 }, outputs: { rum: 2 }, cycle: 8, workers: 1 }],
  },
  {
    id: 'tavern', name: 'Tavern', icon: '🏠', maxLevel: 3,
    desc: 'Recruits crew with rum and a hot meal. +10 crew housing per level.',
    cost: { wood: 20, food: 5 }, costGold: 0,
    recipes: [{ name: 'Recruit Crew', inputs: { rum: 1, food: 2 }, outputs: { crew: 1 }, cycle: 12, workers: 1 }],
  },
  {
    id: 'shipyard', name: 'Shipyard', icon: '🛠️', maxLevel: 3, tech: { branch: 'shipbuilding', level: 1 },
    desc: 'Crafts ship parts and builds new ships.',
    cost: { wood: 30, stone: 10, iron: 5 }, costGold: 50,
    recipes: [{ name: 'Craft Ship Parts', inputs: { iron: 2, wood: 3, cloth: 1 }, outputs: { shipParts: 1 }, cycle: 10, workers: 3 }],
  },
  {
    id: 'fort', name: 'Fort', icon: '🏰', maxLevel: 3, tech: { branch: 'military', level: 1 },
    desc: 'Defends the island from raids and forges armaments.',
    cost: { stone: 30, iron: 10 }, costGold: 100,
    recipes: [
      { name: 'Cast Cannons', inputs: { iron: 2, wood: 1 }, outputs: { cannons: 1 }, cycle: 12, workers: 2 },
      { name: 'Forge Weapons', inputs: { iron: 1, coal: 1 }, outputs: { weapons: 1 }, cycle: 10, workers: 2 },
    ],
  },
  {
    id: 'marketplace', name: 'Marketplace', icon: '⚖️', maxLevel: 3, tech: { branch: 'trade', level: 1 }, unique: true,
    desc: 'Trade with passing merchants: manual and automatic buying/selling for gold.',
    cost: { wood: 25, stone: 10 }, costGold: 100,
    recipes: [],
  },
  {
    id: 'vault', name: 'Treasure Vault', icon: '🗝️', maxLevel: 3,
    desc: 'Fences treasure safely into gold.',
    cost: { stone: 25, iron: 5 }, costGold: 50,
    recipes: [{ name: 'Fence Treasure', inputs: { treasure: 1 }, outputs: {}, cycle: 6, workers: 1 }], // gold handled specially
  },
  {
    id: 'cartographer', name: 'Cartographer', icon: '🗺️', maxLevel: 3, tech: { branch: 'exploration', level: 1 },
    desc: 'Draws sea charts used by expeditions and technology.',
    cost: { wood: 15, cloth: 2 }, costGold: 50,
    recipes: [{ name: 'Draw Maps', inputs: { wood: 1 }, outputs: { maps: 1 }, cycle: 18, workers: 1 }],
  },
  {
    id: 'academy', name: 'Naval Academy', icon: '🎖️', maxLevel: 3, tech: { branch: 'military', level: 2 },
    desc: 'Trains officers; converts arms and rum into influence.',
    cost: { stone: 20, iron: 10, wood: 20 }, costGold: 200,
    recipes: [{ name: 'Train Officers', inputs: { rum: 1, weapons: 1 }, outputs: {}, cycle: 15, workers: 2 }], // influence handled specially
  },
];

export function buildingDef(id: string): BuildingDef {
  return BUILDINGS.find(b => b.id === id)!;
}

export const SHIP_TYPES: ShipTypeDef[] = [
  { id: 'cargo', name: 'Cargo Ship', icon: '🛶', capacity: 20, speed: 7, maintenance: 1, crewReq: 3, costGold: 100, costParts: 3, costCannons: 0 },
  { id: 'sloop', name: 'Sloop', icon: '⛵', capacity: 15, speed: 11, maintenance: 1.5, crewReq: 4, costGold: 200, costParts: 4, costCannons: 0, tech: [{ branch: 'shipbuilding', level: 1 }] },
  { id: 'merchant', name: 'Merchant Ship', icon: '🚤', capacity: 45, speed: 6, maintenance: 2, crewReq: 6, costGold: 300, costParts: 6, costCannons: 0, tech: [{ branch: 'trade', level: 1 }] },
  { id: 'brig', name: 'Brig', icon: '⛴️', capacity: 35, speed: 8.5, maintenance: 3, crewReq: 9, costGold: 550, costParts: 9, costCannons: 1, tech: [{ branch: 'shipbuilding', level: 2 }] },
  { id: 'frigate', name: 'Frigate', icon: '🚢', capacity: 55, speed: 9.5, maintenance: 5, crewReq: 16, costGold: 1300, costParts: 14, costCannons: 4, tech: [{ branch: 'shipbuilding', level: 2 }, { branch: 'military', level: 1 }] },
  { id: 'galleon', name: 'Galleon', icon: '🛳️', capacity: 120, speed: 5, maintenance: 8, crewReq: 26, costGold: 3000, costParts: 25, costCannons: 8, tech: [{ branch: 'shipbuilding', level: 3 }] },
];

export function shipDef(id: string): ShipTypeDef {
  return SHIP_TYPES.find(s => s.id === id)!;
}

export const TECHS: TechBranchDef[] = [
  {
    id: 'navigation', name: 'Navigation', icon: '🧭',
    effects: ['+15% ship speed, safer expeditions', '+15% ship speed, much safer expeditions', '+15% ship speed, expeditions nearly risk-free'],
    costs: [{ gold: 150, maps: 0, influence: 0 }, { gold: 600, maps: 5, influence: 0 }, { gold: 2500, maps: 15, influence: 30 }],
  },
  {
    id: 'shipbuilding', name: 'Shipbuilding', icon: '🛠️',
    effects: ['Unlocks Shipyard & Sloop', 'Unlocks Brig & Frigate hulls', 'Unlocks the mighty Galleon'],
    costs: [{ gold: 100, maps: 0, influence: 0 }, { gold: 800, maps: 5, influence: 0 }, { gold: 3500, maps: 20, influence: 50 }],
  },
  {
    id: 'trade', name: 'Trade', icon: '⚖️',
    effects: ['Unlocks Marketplace & Merchant Ship', '+15% sell prices', '+30% sell prices, cheaper imports'],
    costs: [{ gold: 150, maps: 0, influence: 0 }, { gold: 700, maps: 4, influence: 0 }, { gold: 3000, maps: 12, influence: 40 }],
  },
  {
    id: 'smuggling', name: 'Smuggling', icon: '🌑',
    effects: ['Smuggle rum & weapons at +100% price (risk of navy raids)', '-15% ship maintenance', 'Navy raids rarely catch you'],
    costs: [{ gold: 250, maps: 2, influence: 0 }, { gold: 900, maps: 6, influence: 10 }, { gold: 3200, maps: 15, influence: 50 }],
  },
  {
    id: 'military', name: 'Military', icon: '⚔️',
    effects: ['Unlocks Fort (defense + armaments)', 'Unlocks Naval Academy (influence)', 'Forts repel nearly all attacks'],
    costs: [{ gold: 200, maps: 0, influence: 0 }, { gold: 850, maps: 5, influence: 10 }, { gold: 3000, maps: 15, influence: 60 }],
  },
  {
    id: 'exploration', name: 'Exploration', icon: '🔭',
    effects: ['Unlocks Cartographer; +1 map per expedition', 'Expeditions loot more treasure', 'Expeditions are twice as fast'],
    costs: [{ gold: 150, maps: 0, influence: 0 }, { gold: 650, maps: 5, influence: 0 }, { gold: 2800, maps: 12, influence: 40 }],
  },
  {
    id: 'industry', name: 'Industry', icon: '🏭',
    effects: ['+20% production speed', '+25% storage capacity', '+25% production speed'],
    costs: [{ gold: 200, maps: 0, influence: 0 }, { gold: 900, maps: 6, influence: 0 }, { gold: 3600, maps: 18, influence: 50 }],
  },
];

export function techDef(id: string): TechBranchDef {
  return TECHS.find(t => t.id === id)!;
}

export const BASE_PRICES: Record<ResourceId, number> = {
  wood: 2, stone: 2, ironOre: 4, iron: 9, coal: 4, food: 2, sugar: 3, rum: 9,
  cloth: 12, cannons: 35, weapons: 28, shipParts: 45, maps: 30, treasure: 40, crew: 0,
};

export const ISLAND_NAMES = [
  'Tortuga Rest', 'Skull Cay', 'Palm Hollow', 'Iron Reach', 'Coal Hook',
  'Greenmantle', 'Saltwind Isle', 'Ruined Crown', 'Gull Rock', 'Cane Shore',
  'Black Sand Bar', 'Old Anchor', 'Mistmoor', 'Crab Shallows', 'Fearless Point',
  'Sunken Idol', 'Windward Spit', 'Maroon Hold', 'Cinder Peak', 'Whaler’s End',
  'Lantern Key', 'Driftbone', 'Parrot Perch', 'Quiet Lagoon', 'Storm Watch',
  'Golden Strand', 'Half Moon Bank', 'Serpent Coil',
];

export function fmt(n: number): string {
  if (!isFinite(n)) return '∞';
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (abs >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  if (abs >= 100) return Math.round(n).toString();
  if (abs >= 10) return (Math.round(n * 10) / 10).toString();
  return (Math.round(n * 100) / 100).toString();
}

export function fmtRate(n: number): string {
  const s = fmt(Math.abs(n));
  return (n >= 0 ? '+' : '-') + s;
}
