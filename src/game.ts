// The heart of the game: the tick loop, all 12 activities, passive systems,
// exploration, raiding and derived-resource syncing. All rate code is
// dt-robust so offline simulation can run in large chunks.

import type { GameState, ActivityId, Bonuses } from './types';
import { ISLANDS, RAID_TARGETS, ACTIVITIES, fmt, MAP_QUALITY_INFO } from './data';
import { computeBonuses, gainXp } from './skills';
import {
  crewEfficiency, tickCrew, hireCrewMember, loseCrewMember, recruitCost, crewCapacity,
} from './crew';
import { fleetSpeed, fleetPower, fleetCargo, progressConstruction } from './fleet';
import { fluctuatePrices, tradeRouteIncome } from './trade';
import { totalMaps, resolveHunt, grantMap, huntSuccessChance } from './treasure';
import { tryFindRelic } from './relics';
import { tickPort } from './port';
import { triggerRandomEvent, getPendingEvent } from './events';
import { checkAchievements } from './achievements';
import { tickQuests } from './quests';
import { notify, logEvent } from './notifications';

export const HUNT_POINTS = 40;
export const RAID_POINTS = 25;
export const VOYAGE_POINTS = 30;
export const SMUGGLE_POINTS = 25;

export function setActivity(s: GameState, id: ActivityId | null): void {
  if (s.activity === id) return;
  s.activity = id;
  if (id) {
    const def = ACTIVITIES.find(x => x.id === id)!;
    logEvent(s, `Now focusing on: ${def.name}.`);
  }
}

function addGold(s: GameState, amount: number): void {
  s.resources.gold += amount;
  s.stats.totalGold += amount;
}

/** Probability helper that stays sane for large dt (offline chunks). */
function chance(perSecond: number, dt: number): boolean {
  return Math.random() < 1 - Math.exp(-perSecond * dt);
}

// ---------------------------------------------------------------- activities

function actSail(s: GameState, dt: number, b: Bonuses, ce: number): void {
  const spd = fleetSpeed(s, b);
  addGold(s, 0.6 * spd * ce * b.gold * dt);
  s.resources.supplies += 0.4 * spd * b.supplies * dt;
  s.voyageProgress += spd * 0.35 * dt;
  while (s.voyageProgress >= VOYAGE_POINTS) {
    s.voyageProgress -= VOYAGE_POINTS;
    s.stats.voyages++;
    const bonus = 5 * Math.sqrt(spd) * b.gold;
    addGold(s, bonus);
    if (chance(0.6, 1)) gainXp(s, 'sailing', 25, b);
  }
  gainXp(s, 'sailing', 3 * dt, b);
  gainXp(s, 'navigation', 1 * dt, b);
}

function actExplore(s: GameState, dt: number, b: Bonuses, ce: number): void {
  const need = 0.5 * dt;
  let mult = 1;
  if (s.resources.supplies >= need) {
    s.resources.supplies -= need;
  } else {
    mult = 0.35; // pressing on with empty holds is slow going
  }
  s.exploreProgress += (0.5 + fleetSpeed(s, b) * 0.4) * ce * mult * dt;
  s.resources.knowledge += 0.2 * b.knowledge * dt;
  gainXp(s, 'navigation', 2.5 * dt, b);
  gainXp(s, 'cartography', 1 * dt, b);
  checkIslandDiscovery(s, b);
}

function checkIslandDiscovery(s: GameState, b: Bonuses): void {
  for (const isl of ISLANDS) {
    if (s.discoveredIslands.includes(isl.id)) continue;
    if (s.exploreProgress < isl.threshold) continue;
    if (isl.mapNeed) {
      if (s.mapsInv[isl.mapNeed] < 1) continue;
      s.mapsInv[isl.mapNeed]--;
      notify(`Used a ${MAP_QUALITY_INFO[isl.mapNeed].name} map to chart the way.`);
    }
    s.discoveredIslands.push(isl.id);
    for (const [res, amt] of Object.entries(isl.reward)) {
      (s.resources as Record<string, number>)[res] += amt!;
      if (res === 'gold') s.stats.totalGold += amt!;
    }
    if (isl.rewardMaps) {
      for (const [q, n] of Object.entries(isl.rewardMaps)) {
        for (let i = 0; i < (n ?? 0); i++) grantMap(s, q as never);
      }
    }
    notify(`🏝️ Discovered ${isl.name} (${isl.type})! +${isl.bonus.value}% ${isl.bonus.key}`, 'achievement');
    logEvent(s, `Discovered ${isl.name} — ${isl.desc}`);
    gainXp(s, 'navigation', 100 + isl.threshold * 0.2, b);
    gainXp(s, 'cartography', 50 + isl.threshold * 0.1, b);
    break; // one discovery at a time
  }
}

function actRaid(s: GameState, dt: number, b: Bonuses, ce: number): void {
  const target = RAID_TARGETS[Math.min(s.raidTarget, RAID_TARGETS.length - 1)];
  s.raidProgress += (1 + fleetSpeed(s, b) * 0.2) * dt;
  gainXp(s, 'plundering', 2 * dt, b);

  while (s.raidProgress >= RAID_POINTS) {
    s.raidProgress -= RAID_POINTS;
    const power = fleetPower(s, b, ce);
    const winChance = Math.min(0.95, power / (power + target.power * 1.25));
    if (Math.random() < winChance) {
      const gold = target.gold * (0.8 + Math.random() * 0.4) * b.gold;
      addGold(s, gold);
      s.resources.tradeGoods += target.goods;
      s.resources.reputation += target.rep * b.reputation;
      s.stats.raidsWon++;
      gainXp(s, 'plundering', 20 + target.rep * 2, b);
      gainXp(s, 'navalCombat', 15 + target.rep * 1.5, b);
      logEvent(s, `Raided a ${target.name}: +${fmt(gold)} gold, +${target.goods} goods.`);
    } else {
      s.stats.raidsLost++;
      s.crewMembers.forEach(m => { m.morale = Math.max(5, m.morale - 4); });
      const lossChance = Math.max(0.05, 0.45 / b.crewSafety);
      if (Math.random() < lossChance) loseCrewMember(s, `lost raiding a ${target.name}`);
      gainXp(s, 'navalCombat', 10, b);
      logEvent(s, `A raid on a ${target.name} was repelled.`);
    }
  }
}

function actTrade(s: GameState, dt: number, b: Bonuses, ce: number): void {
  addGold(s, (1 + Math.sqrt(fleetCargo(s)) * 0.3) * ce * b.trade * b.gold * dt);
  s.resources.tradeGoods += 0.3 * ce * dt;
  gainXp(s, 'trading', 3 * dt, b);
}

function actSmuggle(s: GameState, dt: number, b: Bonuses, ce: number): void {
  addGold(s, (2.5 + fleetSpeed(s, b) * 0.8) * ce * b.gold * dt);
  s.resources.reputation += 0.3 * b.reputation * dt;
  s.smuggleProgress += (1 + fleetSpeed(s, b) * 0.15) * dt;
  while (s.smuggleProgress >= SMUGGLE_POINTS) {
    s.smuggleProgress -= SMUGGLE_POINTS;
    s.stats.smuggleRuns++;
    gainXp(s, 'smuggling', 30, b);
  }
  // The risk: busts scale down with smuggleSafety.
  const bustRate = Math.max(0.0006, 0.005 / b.smuggleSafety);
  if (chance(bustRate, dt)) {
    const fine = Math.floor(s.resources.gold * 0.15);
    s.resources.gold -= fine;
    s.crewMembers.forEach(m => { m.morale = Math.max(5, m.morale - 6); });
    if (Math.random() < 0.3) loseCrewMember(s, 'arrested during a smuggling run');
    notify(`🚨 Busted! Confiscation costs you ${fmt(fine)} gold.`, 'bad');
    logEvent(s, `A smuggling run went bad — lost ${fmt(fine)} gold.`);
  }
  gainXp(s, 'smuggling', 3 * dt, b);
}

function actTreasureHunt(s: GameState, dt: number, b: Bonuses, ce: number): void {
  if (totalMaps(s) === 0) {
    // No maps: scour the coastline instead (very slow map hunting).
    s.mapTimer += dt;
    if (s.mapTimer >= 90 / b.mapFind) {
      s.mapTimer = 0;
      grantMap(s, 'common');
    }
    gainXp(s, 'treasureHunting', 0.5 * dt, b);
    return;
  }
  s.huntProgress += (1 + fleetSpeed(s, b) * 0.3) * ce * b.treasure * 0.5 * dt;
  while (s.huntProgress >= HUNT_POINTS && totalMaps(s) > 0) {
    s.huntProgress -= HUNT_POINTS;
    resolveHunt(s, b);
  }
  gainXp(s, 'treasureHunting', 2 * dt, b);
}

function actRecruit(s: GameState, dt: number, b: Bonuses, ce: number): void {
  s.recruitTimer += b.recruit * dt;
  const interval = 15;
  while (s.recruitTimer >= interval) {
    s.recruitTimer -= interval;
    if (s.crewMembers.length >= crewCapacity(s)) {
      notify('No bunks left — build bigger ships!', 'bad');
      break;
    }
    const cost = recruitCost(s);
    if (s.resources.gold < cost) break;
    const m = hireCrewMember(s);
    if (m) {
      notify(`👥 ${m.name} signed aboard! (-${fmt(cost)} gold)`);
      gainXp(s, 'crewManagement', 25, b);
    }
  }
  gainXp(s, 'crewManagement', 2 * dt, b);
}

function actBuildShips(s: GameState, dt: number, b: Bonuses, ce: number): void {
  if (s.buildOrder) {
    progressConstruction(s, 1.5 * b.build * ce * dt);
    gainXp(s, 'shipbuilding', 3 * dt, b);
  } else {
    // No order: gather materials instead.
    s.resources.supplies += 0.3 * b.supplies * dt;
    gainXp(s, 'shipbuilding', 1 * dt, b);
  }
}

function actTavern(s: GameState, dt: number, b: Bonuses, ce: number): void {
  s.resources.rum += 0.6 * b.rum * dt;
  addGold(s, 0.3 * b.gold * dt); // paying customers
  if (chance(0.012, dt)) {
    const roll = Math.random();
    if (roll < 0.45) {
      grantMap(s);
      logEvent(s, 'A drunk sailor traded a map for a round of rum.');
    } else if (roll < 0.7 && s.crewMembers.length < crewCapacity(s)) {
      const m = hireCrewMember(s, true);
      if (m) notify(`🍺 Rumor pays off — ${m.name} joins for free!`);
    } else {
      const gold = 20 * (1 + Math.sqrt(s.stats.totalGold / 1000)) * b.gold;
      addGold(s, gold);
      notify(`🍺 A rumor leads to a hidden stash: +${fmt(gold)} gold!`);
      logEvent(s, `Tavern rumor paid out ${fmt(gold)} gold.`);
    }
  }
  gainXp(s, 'tavernKeeping', 3 * dt, b);
}

function actResearchMaps(s: GameState, dt: number, b: Bonuses, ce: number): void {
  s.resources.knowledge += 0.4 * b.knowledge * dt;
  s.mapTimer += b.mapFind * ce * dt;
  const interval = 30;
  while (s.mapTimer >= interval) {
    s.mapTimer -= interval;
    grantMap(s);
    gainXp(s, 'cartography', 30, b);
  }
  gainXp(s, 'cartography', 3 * dt, b);
}

function actStudyRelics(s: GameState, dt: number, b: Bonuses, ce: number): void {
  s.resources.knowledge += 0.5 * b.knowledge * dt;
  s.relicTimer += dt;
  const interval = 45;
  while (s.relicTimer >= interval) {
    s.relicTimer -= interval;
    if (s.resources.knowledge >= 50) {
      s.resources.knowledge -= 50;
      if (Math.random() < Math.min(0.8, 0.22 * b.relicFind)) {
        if (!tryFindRelic(s)) {
          s.resources.cursedRelics += 2;
          notify('All relics found — your study yields cursed fragments instead.');
        }
      } else {
        s.resources.cursedRelics += 1;
        gainXp(s, 'cursedLore', 40, b);
        logEvent(s, 'Your studies yield a cursed fragment.');
      }
    }
  }
  gainXp(s, 'cursedLore', 3 * dt, b);
}

function actDiplomacy(s: GameState, dt: number, b: Bonuses, ce: number): void {
  s.resources.influence += 0.25 * (1 + s.resources.reputation / 5000) * b.influence * dt;
  s.resources.reputation += 0.5 * b.reputation * dt;
  gainXp(s, 'diplomacy', 3 * dt, b);
}

const ACTIVITY_FNS: Record<ActivityId, (s: GameState, dt: number, b: Bonuses, ce: number) => void> = {
  sail: actSail, explore: actExplore, raid: actRaid, trade: actTrade,
  smuggle: actSmuggle, treasureHunt: actTreasureHunt, recruit: actRecruit,
  buildShips: actBuildShips, tavern: actTavern, researchMaps: actResearchMaps,
  studyRelics: actStudyRelics, diplomacy: actDiplomacy,
};

// ------------------------------------------------------------------ passives

function runPassives(s: GameState, dt: number, b: Bonuses): void {
  tickPort(s, dt, b);
  progressConstruction(s, 0); // finalize shipyard passive progress

  // Trade routes deliver whether or not you're watching.
  addGold(s, tradeRouteIncome(s, b) * dt);

  // Idle ships still patrol a little.
  addGold(s, s.fleet.length * 0.05 * b.gold * dt);

  // Reputation trickles from naval power; influence from reputation.
  s.resources.reputation += Math.sqrt(s.resources.navalPower) * 0.01 * b.reputation * dt;
  s.resources.influence += Math.sqrt(Math.max(0, s.resources.reputation)) * 0.002 * b.influence * dt;
}

function syncDerived(s: GameState, b: Bonuses, ce: number): void {
  s.resources.crew = s.crewMembers.length;
  s.resources.ships = s.fleet.length;
  s.resources.maps = totalMaps(s);
  s.resources.navalPower = Math.round(fleetPower(s, b, ce));
}

// ---------------------------------------------------------------------- tick

export interface TickOptions {
  offline?: boolean;
}

export function tick(s: GameState, dt: number, opts: TickOptions = {}): void {
  const b = computeBonuses(s);
  const ce = crewEfficiency(s, b);
  s.stats.playTime += dt;

  if (s.activity) {
    ACTIVITY_FNS[s.activity](s, dt, b, ce);
  }

  runPassives(s, dt, b);
  tickCrew(s, dt);
  fluctuatePrices(s, dt);
  syncDerived(s, b, ce);
  s.bossCooldown = Math.max(0, s.bossCooldown - dt);

  if (!opts.offline) {
    tickQuests(s);
    if (!getPendingEvent()) {
      s.eventTimer -= dt;
      if (s.eventTimer <= 0) {
        triggerRandomEvent(s);
        s.eventTimer = 99999; // reset properly when the event resolves
      }
    }
    checkAchievements(s);
  }
}

// ---------------------------------------------------------- resource rates

export type ResourceRateMap = Partial<Record<string, number>>;

/**
 * Computes the approximate net rate (per second) for each resource given the
 * current game state. Episodic gains/losses are averaged over their interval.
 */
export function computeRates(s: GameState): ResourceRateMap {
  const b = computeBonuses(s);
  const ce = crewEfficiency(s, b);
  const spd = fleetSpeed(s, b);
  const rates: Record<string, number> = {};
  const add = (id: string, v: number): void => { rates[id] = (rates[id] ?? 0) + v; };

  // ── Always-on passives ────────────────────────────────────────
  add('gold', s.fleet.length * 0.05 * b.gold);
  add('gold', tradeRouteIncome(s, b));
  add('reputation', Math.sqrt(s.resources.navalPower) * 0.01 * b.reputation);
  add('influence', Math.sqrt(Math.max(0, s.resources.reputation)) * 0.002 * b.influence);
  if (s.buildings.warehouse > 0) add('supplies', 0.06 * s.buildings.warehouse * b.supplies);
  if (s.buildings.tavern > 0)    add('rum',      0.05 * s.buildings.tavern * b.rum);
  if (s.buildings.market > 0 && s.resources.tradeGoods > 0) {
    const sell = 0.2 * s.buildings.market;
    add('tradeGoods', -sell);
    add('gold', sell * 3 * b.trade);
  }

  if (!s.activity) return rates;

  // ── Activity rates ────────────────────────────────────────────
  switch (s.activity) {
    case 'sail':
      add('gold',     0.6 * spd * ce * b.gold);
      add('supplies', 0.4 * spd * b.supplies);
      break;
    case 'explore':
      add('supplies', -0.5);
      add('knowledge', 0.2 * b.knowledge);
      break;
    case 'raid': {
      const target = RAID_TARGETS[Math.min(s.raidTarget, RAID_TARGETS.length - 1)];
      const power = fleetPower(s, b, ce);
      const win = Math.min(0.95, power / (power + target.power * 1.25));
      const rate = (1 + spd * 0.2) / RAID_POINTS;
      add('gold',        target.gold * win * rate * b.gold);
      add('tradeGoods',  target.goods * win * rate);
      add('reputation',  target.rep  * win * rate * b.reputation);
      break;
    }
    case 'trade':
      add('gold',       (1 + Math.sqrt(fleetCargo(s)) * 0.3) * ce * b.trade * b.gold);
      add('tradeGoods', 0.3 * ce);
      break;
    case 'smuggle':
      add('gold',       (2.5 + spd * 0.8) * ce * b.gold);
      add('reputation', 0.3 * b.reputation);
      break;
    case 'treasureHunt':
      if (totalMaps(s) > 0) {
        const huntRate = (1 + spd * 0.3) * ce * b.treasure * 0.5 / HUNT_POINTS;
        add('maps',     -huntRate);
        add('treasure', 2 * huntRate);
      }
      break;
    case 'recruit':
      add('crew', b.recruit / 15);
      add('gold', -recruitCost(s) * b.recruit / 15);
      break;
    case 'buildShips':
      if (!s.buildOrder) add('supplies', 0.3 * b.supplies);
      break;
    case 'tavern':
      add('rum',  0.6 * b.rum);
      add('gold', 0.3 * b.gold);
      break;
    case 'researchMaps':
      add('knowledge', 0.4 * b.knowledge);
      add('maps',      b.mapFind * ce / 30);
      break;
    case 'studyRelics':
      // +0.5*b.knowledge/s produced, −50 knowledge consumed every 45 s
      add('knowledge', 0.5 * b.knowledge - 50 / 45);
      break;
    case 'diplomacy':
      add('influence',  0.25 * (1 + s.resources.reputation / 5000) * b.influence);
      add('reputation', 0.5 * b.reputation);
      break;
  }

  return rates;
}

// ------------------------------------------------------------- ui helpers

/** Human-readable per-second summary for the current activity. */
export function activityRates(s: GameState): string {
  if (!s.activity) return 'Idle — choose an activity to focus your crew.';
  const b = computeBonuses(s);
  const ce = crewEfficiency(s, b);
  const spd = fleetSpeed(s, b);
  switch (s.activity) {
    case 'sail': return `~${fmt(0.6 * spd * ce * b.gold)} gold/s, ~${fmt(0.4 * spd * b.supplies)} supplies/s`;
    case 'explore': return `${fmt((0.5 + spd * 0.4) * ce)} exploration/s (uses 0.5 supplies/s)`;
    case 'raid': {
      const t = RAID_TARGETS[Math.min(s.raidTarget, RAID_TARGETS.length - 1)];
      const power = fleetPower(s, b, ce);
      const win = Math.min(0.95, power / (power + t.power * 1.25));
      return `Target: ${t.name} — ${(win * 100).toFixed(0)}% win chance`;
    }
    case 'trade': return `~${fmt((1 + Math.sqrt(fleetCargo(s)) * 0.3) * ce * b.trade * b.gold)} gold/s + goods`;
    case 'smuggle': return `~${fmt((2.5 + spd * 0.8) * ce * b.gold)} gold/s — risky!`;
    case 'treasureHunt': {
      if (totalMaps(s) === 0) return 'No maps! Scouring the coast for one...';
      return `${(huntSuccessChance(s, b) * 100).toFixed(0)}% success per dig`;
    }
    case 'recruit': return `Hiring every ~${fmt(15 / b.recruit)}s at ${fmt(recruitCost(s))} gold each`;
    case 'buildShips': return s.buildOrder ? `+${fmt(1.5 * b.build * ce)} build pts/s` : 'No order — gathering materials';
    case 'tavern': return `+${fmt(0.6 * b.rum)} rum/s, listening for rumors...`;
    case 'researchMaps': return `New map every ~${fmt(30 / (b.mapFind * ce))}s`;
    case 'studyRelics': return `Studying (needs 50 knowledge per attempt, every 45s)`;
    case 'diplomacy': return `+${fmt(0.25 * (1 + s.resources.reputation / 5000) * b.influence)} influence/s`;
  }
}
