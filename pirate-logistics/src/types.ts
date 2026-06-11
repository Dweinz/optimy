// Core type definitions for Pirate Logistics.

export type ResourceId =
  | 'wood' | 'stone' | 'ironOre' | 'iron' | 'coal' | 'food' | 'sugar' | 'rum'
  | 'cloth' | 'cannons' | 'weapons' | 'shipParts' | 'maps' | 'treasure' | 'crew';

export type TraitId = 'forest' | 'iron' | 'coal' | 'stone' | 'fertile' | 'ruins' | 'treasureSite';

export type BuildingTypeId =
  | 'dock' | 'warehouse' | 'woodCamp' | 'mine' | 'farm' | 'plantation'
  | 'smelter' | 'distillery' | 'tavern' | 'shipyard' | 'fort' | 'marketplace'
  | 'vault' | 'cartographer' | 'academy';

export type ShipTypeId = 'cargo' | 'sloop' | 'merchant' | 'brig' | 'frigate' | 'galleon';

export type TechBranchId =
  | 'navigation' | 'shipbuilding' | 'trade' | 'smuggling' | 'military' | 'exploration' | 'industry';

export type BuildingStatus = 'ok' | 'noInput' | 'full' | 'noCrew' | 'idle';

export interface Recipe {
  name: string;
  inputs: Partial<Record<ResourceId, number>>;
  outputs: Partial<Record<ResourceId, number>>;
  cycle: number;     // seconds per cycle at level 1
  workers: number;   // crew required on the island
  trait?: TraitId;   // recipe only available on islands with this trait
}

export interface BuildingDef {
  id: BuildingTypeId;
  name: string;
  icon: string;
  desc: string;
  cost: Partial<Record<ResourceId, number>>;
  costGold: number;
  recipes: Recipe[];
  maxLevel: number;
  tech?: { branch: TechBranchId; level: number };
  traitAny?: TraitId[]; // island must have at least one of these traits
  unique?: boolean;     // max one per island
}

export interface BuildingInstance {
  id: number;
  type: BuildingTypeId;
  level: number;
  recipeIndex: number;
  progress: number; // seconds into current cycle
  status: BuildingStatus;
}

export interface Island {
  id: number;
  name: string;
  x: number;
  z: number;
  size: number; // 1..2 visual + building slots
  traits: TraitId[];
  discovered: boolean;
  owned: boolean;
  storage: Record<ResourceId, number>;
  buildings: BuildingInstance[];
  looted: boolean; // ruins/treasure sites can be looted once per expedition wave
}

export interface ShipTypeDef {
  id: ShipTypeId;
  name: string;
  icon: string;
  capacity: number;
  speed: number;       // world units per second
  maintenance: number; // gold per minute
  crewReq: number;
  costGold: number;
  costParts: number;
  costCannons: number;
  tech?: { branch: TechBranchId; level: number }[];
}

export type ShipState = 'idle' | 'route' | 'expedition' | 'colonize';
export type RoutePhase = 'loading' | 'toDest' | 'unloading' | 'toSource';

export interface Ship {
  id: number;
  name: string;
  type: ShipTypeId;
  state: ShipState;
  routeId: number | null;
  phase: RoutePhase;
  progress: number;    // 0..1 along current leg, or seconds for load/unload
  cargo: number;       // units currently aboard
  homeIslandId: number;
  condition: number;   // 0..100
}

export interface Route {
  id: number;
  sourceId: number;
  destId: number;
  resource: ResourceId;
  shipIds: number[];
  delivered: number;       // lifetime
  deliveredWindow: number; // units delivered in current stats window
  perMin: number;          // computed rolling rate
  utilization: number;     // avg fraction of capacity used, 0..1
  utilSamples: number;
  utilSum: number;
}

export interface Expedition {
  id: number;
  shipId: number;
  fromId: number;
  targetId: number;
  kind: 'explore' | 'loot' | 'colonize';
  timeLeft: number;
  duration: number;
}

export interface TechBranchDef {
  id: TechBranchId;
  name: string;
  icon: string;
  effects: string[]; // one description per level
  costs: { gold: number; maps: number; influence: number }[];
}

export interface Alert {
  t: number;
  text: string;
  kind: 'bad' | 'good' | 'warn';
}

export interface RateTracker {
  buckets: number[];
  current: number;
}

export interface GameState {
  version: number;
  seed: number;
  time: number; // sim-seconds elapsed
  speed: number;
  gold: number;
  influence: number;
  islands: Island[];
  ships: Ship[];
  routes: Route[];
  expeditions: Expedition[];
  techs: Record<TechBranchId, number>;
  prices: Record<ResourceId, number>;
  marketCrash: number; // seconds remaining of crashed prices
  autoTrade: { islandId: number; resource: ResourceId; mode: 'sell' | 'buy'; threshold: number }[];
  alerts: Alert[];
  eventTimer: number;
  nextId: number;
  stats: {
    prod: Partial<Record<ResourceId, RateTracker>>;
    cons: Partial<Record<ResourceId, RateTracker>>;
    goldIn: RateTracker;
    goldOut: RateTracker;
    bucketTimer: number;
  };
  totals: { expeditions: number; shipsBuilt: number; treasureFound: number; shipsLost: number };
}
