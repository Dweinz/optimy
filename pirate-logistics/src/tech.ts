// Technology tree: purchases and the multipliers other systems consume.

import type { GameState, TechBranchId, BuildingDef, ShipTypeDef, Island } from './types';
import { TECHS, techDef } from './data';
import { addAlert } from './notify';

export function techLevel(s: GameState, branch: TechBranchId): number {
  return s.techs[branch];
}

export function shipSpeedMult(s: GameState): number {
  return 1 + s.techs.navigation * 0.15;
}

export function prodSpeedMult(s: GameState): number {
  return 1 + (s.techs.industry >= 1 ? 0.2 : 0) + (s.techs.industry >= 3 ? 0.25 : 0);
}

export function storageMult(s: GameState): number {
  return s.techs.industry >= 2 ? 1.25 : 1;
}

export function sellPriceMult(s: GameState): number {
  return 1 + (s.techs.trade >= 2 ? 0.15 : 0) + (s.techs.trade >= 3 ? 0.15 : 0);
}

export function buyPriceMult(s: GameState): number {
  return s.techs.trade >= 3 ? 1.15 : 1.3;
}

export function maintenanceMult(s: GameState): number {
  return s.techs.smuggling >= 2 ? 0.85 : 1;
}

export function expeditionRisk(s: GameState): number {
  const base = 0.12;
  return base * Math.max(0.05, 1 - s.techs.navigation * 0.3);
}

export function expeditionSpeedMult(s: GameState): number {
  return s.techs.exploration >= 3 ? 2 : 1;
}

export function smugglingUnlocked(s: GameState): boolean {
  return s.techs.smuggling >= 1;
}

/** Total maps available across all owned islands (tech costs draw on these). */
export function totalMaps(s: GameState): number {
  return s.islands.filter(i => i.owned).reduce((sum, i) => sum + i.storage.maps, 0);
}

function consumeMaps(s: GameState, amount: number): void {
  for (const isl of s.islands) {
    if (!isl.owned || amount <= 0) continue;
    const take = Math.min(isl.storage.maps, amount);
    isl.storage.maps -= take;
    amount -= take;
  }
}

export function canResearch(s: GameState, branch: TechBranchId): { ok: boolean; reason: string } {
  const def = techDef(branch);
  const lvl = s.techs[branch];
  if (lvl >= def.costs.length) return { ok: false, reason: 'Maxed' };
  const cost = def.costs[lvl];
  if (s.gold < cost.gold) return { ok: false, reason: `Needs ${cost.gold} gold` };
  if (totalMaps(s) < cost.maps) return { ok: false, reason: `Needs ${cost.maps} maps` };
  if (s.influence < cost.influence) return { ok: false, reason: `Needs ${cost.influence} influence` };
  return { ok: true, reason: '' };
}

export function research(s: GameState, branch: TechBranchId): boolean {
  const check = canResearch(s, branch);
  if (!check.ok) return false;
  const def = techDef(branch);
  const cost = def.costs[s.techs[branch]];
  s.gold -= cost.gold;
  s.influence -= cost.influence;
  consumeMaps(s, cost.maps);
  s.techs[branch]++;
  addAlert(s, `${def.icon} Researched ${def.name} ${s.techs[branch]}: ${def.effects[s.techs[branch] - 1]}`, 'good', true);
  return true;
}

export function buildingUnlocked(s: GameState, def: BuildingDef): boolean {
  return !def.tech || s.techs[def.tech.branch] >= def.tech.level;
}

export function shipUnlocked(s: GameState, def: ShipTypeDef): boolean {
  return !def.tech || def.tech.every(t => s.techs[t.branch] >= t.level);
}

export function buildingAllowedOnIsland(def: BuildingDef, island: Island): boolean {
  if (!def.traitAny) return true;
  return def.traitAny.some(t => island.traits.includes(t));
}
