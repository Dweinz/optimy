// Core type definitions for Seven Seas Idle.

export type ResourceId =
  | 'gold' | 'crew' | 'supplies' | 'rum' | 'maps' | 'treasure' | 'tradeGoods'
  | 'reputation' | 'influence' | 'ships' | 'cursedRelics' | 'navalPower' | 'knowledge';

export type SkillId =
  | 'sailing' | 'navigation' | 'plundering' | 'treasureHunting' | 'trading'
  | 'smuggling' | 'shipbuilding' | 'crewManagement' | 'diplomacy' | 'cartography'
  | 'tavernKeeping' | 'navalCombat' | 'cursedLore';

export type ActivityId =
  | 'sail' | 'explore' | 'raid' | 'trade' | 'smuggle' | 'treasureHunt'
  | 'recruit' | 'buildShips' | 'tavern' | 'researchMaps' | 'studyRelics' | 'diplomacy';

export type BuildingId =
  | 'dock' | 'warehouse' | 'tavern' | 'shipyard' | 'market'
  | 'smugglerDen' | 'mapArchive' | 'fortress' | 'relicVault';

export type MapQuality = 'common' | 'rare' | 'epic' | 'legendary';

export type BonusKey =
  | 'gold' | 'xp' | 'speed' | 'treasure' | 'recruit' | 'trade' | 'combat'
  | 'supplies' | 'rum' | 'mapFind' | 'knowledge' | 'influence' | 'reputation'
  | 'smuggleSafety' | 'crewSafety' | 'shipDiscount' | 'build' | 'relicFind' | 'crewEff';

export type Bonuses = Record<BonusKey, number>;

export interface SkillState {
  level: number;
  xp: number;        // xp into current level
  mastery: number;   // mastery level (kept on prestige)
  masteryXp: number;
}

export interface SkillDef {
  id: SkillId;
  name: string;
  icon: string;
  desc: string;
  effects: { key: BonusKey; perLevel: number }[]; // percent per level
}

export interface ActivityDef {
  id: ActivityId;
  name: string;
  icon: string;
  skill: SkillId;
  desc: string;
}

export interface ShipTypeDef {
  id: string;
  name: string;
  icon: string;
  costGold: number;
  costSupplies: number;
  costTreasure: number;
  buildPoints: number;
  capacity: number;   // crew slots provided
  crewReq: number;    // crew needed for full effectiveness
  speed: number;
  power: number;
  cargo: number;
  skillReq: number;   // shipbuilding level required
}

export interface Ship {
  id: number;
  typeId: string;
  name: string;
}

export type CrewRole = 'Deckhand' | 'Sailor' | 'Officer' | 'Quartermaster';

export interface CrewMember {
  id: number;
  name: string;
  role: CrewRole;
  level: number;
  xp: number;
  morale: number;    // 0-100
  combat: number;
  navigation: number;
  loyalty: number;   // 0-100
}

export interface BuildingDef {
  id: BuildingId;
  name: string;
  icon: string;
  desc: string;
  baseCost: number;
  costMult: number;
  bonus: { key: BonusKey; perLevel: number };
}

export interface TradeGoodDef {
  id: string;
  name: string;
  icon: string;
  basePrice: number;
  volatility: number;
}

export type IslandType =
  | 'Trading Port' | 'Volcanic Island' | 'Ancient Ruins' | 'Jungle Island'
  | 'Naval Fortress' | 'Smuggler Haven' | 'Ghost Island' | 'Treasure Island';

export interface IslandDef {
  id: string;
  name: string;
  type: IslandType;
  threshold: number;          // exploration progress needed
  mapNeed: MapQuality | null; // map consumed on discovery
  reward: Partial<Record<ResourceId, number>>;
  rewardMaps?: Partial<Record<MapQuality, number>>;
  bonus: { key: BonusKey; value: number };
  desc: string;
}

export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  set: string;
  bonus: { key: BonusKey; value: number };
  desc: string;
}

export interface RelicSetDef {
  id: string;
  name: string;
  bonus: { key: BonusKey; value: number };
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  check: (s: GameState) => boolean;
  bonus: { key: BonusKey; value: number };
}

export interface LegendUpgradeDef {
  id: string;
  name: string;
  desc: string;
  baseCost: number;
  costMult: number;
  maxLevel: number;
  bonus: { key: BonusKey; perLevel: number };
}

export interface BossDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  power: number;
  rewardGold: number;
  rewardTreasure: number;
  rewardMap: MapQuality | null;
  bonus: { key: BonusKey; value: number };
}

export interface QuestDef {
  id: string;
  name: string;
  hint: string;
  check: (s: GameState) => boolean;
  progress?: (s: GameState) => { cur: number; max: number };
  reward: (s: GameState) => string;
}

export interface RaidTargetDef {
  id: string;
  name: string;
  power: number;
  gold: number;
  goods: number;
  rep: number;
}

export interface EventChoice {
  label: string;
  hint: string;
  apply: (s: GameState) => string; // returns outcome text
}

export interface GameEventDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  weight: number;
  choices: EventChoice[];
}

export interface Stats {
  totalGold: number;
  voyages: number;
  treasures: number;
  crewRecruited: number;
  raidsWon: number;
  raidsLost: number;
  mapsFound: number;
  legendaryMaps: number;
  goodsTraded: number;
  smuggleRuns: number;
  shipsBuilt: number;
  eventsResolved: number;
  relicsFound: number;
  prestiges: number;
  playTime: number;
  bossesDefeated: number;
}

export interface BuildOrder {
  typeId: string;
  points: number;
  needed: number;
}

export interface GameState {
  version: number;
  resources: Record<ResourceId, number>;
  skills: Record<SkillId, SkillState>;
  activity: ActivityId | null;
  fleet: Ship[];
  crewMembers: CrewMember[];
  buildings: Record<BuildingId, number>;
  mapsInv: Record<MapQuality, number>;
  discoveredIslands: string[];
  exploreProgress: number;
  huntProgress: number;
  raidProgress: number;
  raidTarget: number;
  voyageProgress: number;
  smuggleProgress: number;
  buildOrder: BuildOrder | null;
  recruitTimer: number;
  mapTimer: number;
  relicTimer: number;
  relicsOwned: string[];
  achievements: string[];
  prices: Record<string, number>;
  cargo: Record<string, number>;
  legend: { points: number; spent: Record<string, number>; prestiges: number };
  stats: Stats;
  eventTimer: number;
  nextId: number;
  log: string[];
  lastSeen: number;
  defeatedBosses: string[];
  bossCooldown: number;
  questProgress: Record<string, number>;
}

export interface OfflineSummary {
  seconds: number;
  gold: number;
  voyages: number;
  treasures: number;
  crew: number;
  maps: number;
}
