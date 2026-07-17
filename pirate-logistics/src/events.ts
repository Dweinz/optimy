// Random world events: storms, raids, discoveries, crashes, disease, mutiny.
// Events auto-resolve into alerts; mitigation comes from forts, tech and
// good logistics rather than dialog choices.

import type { GameState, Island, ResourceId } from './types';
import { RES_NAME, fmt } from './data';
import { techLevel, smugglingUnlocked } from './tech';
import { addAlert } from './notify';
import { triggerStorm, pulseAtIsland } from './threeScene';

function ownedIslands(s: GameState): Island[] {
  return s.islands.filter(i => i.owned);
}

function fortLevel(island: Island): number {
  return island.buildings.filter(b => b.type === 'fort').reduce((sum, b) => sum + b.level, 0);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const CARGO_RESOURCES: ResourceId[] = ['wood', 'stone', 'iron', 'coal', 'food', 'sugar', 'rum', 'cloth', 'shipParts'];

function storm(s: GameState): void {
  triggerStorm();
  const onRoutes = s.ships.filter(sh => sh.state === 'route');
  if (onRoutes.length === 0) {
    addAlert(s, '⛈️ A storm passes harmlessly over empty sea lanes.', 'warn');
    return;
  }
  const hit = Math.max(1, Math.floor(onRoutes.length * 0.4));
  for (let i = 0; i < hit; i++) {
    const ship = pick(onRoutes);
    ship.condition = Math.max(15, ship.condition - (15 + Math.random() * 20));
  }
  addAlert(s, `⛈️ A storm batters ${hit} ship${hit > 1 ? 's' : ''} on your routes — hulls damaged, speeds reduced.`, 'bad');
}

function pirateAttack(s: GameState): void {
  const targets = ownedIslands(s);
  if (targets.length === 0) return;
  const island = pick(targets);
  const fort = fortLevel(island);
  const defense = fort * (techLevel(s, 'military') >= 3 ? 2 : 1);
  if (defense >= 2 || (defense >= 1 && Math.random() < 0.6)) {
    pulseAtIsland(island.x, island.z, 0x6fcf7c);
    addAlert(s, `🏰 Pirates attacked ${island.name} — the fort drove them off!`, 'good');
    return;
  }
  const stocked = CARGO_RESOURCES.filter(r => island.storage[r] >= 5);
  if (stocked.length === 0) {
    addAlert(s, `🏴‍☠️ Pirates raided ${island.name} but found bare shelves.`, 'warn');
    return;
  }
  const res = pick(stocked);
  const stolen = Math.floor(island.storage[res] * (0.2 + Math.random() * 0.2));
  island.storage[res] -= stolen;
  pulseAtIsland(island.x, island.z, 0xe36a5a);
  addAlert(s, `🏴‍☠️ Pirates raided ${island.name}: stole ${stolen} ${RES_NAME[res]}! Build a Fort to defend.`, 'bad');
}

function navyRaid(s: GameState): void {
  if (!smugglingUnlocked(s)) return storm(s);
  if (techLevel(s, 'smuggling') >= 3 && Math.random() < 0.7) {
    addAlert(s, '⚓ A navy sweep finds nothing — your smugglers are ghosts.', 'good');
    return;
  }
  const fine = Math.min(s.gold, 50 + s.gold * 0.08);
  s.gold -= fine;
  addAlert(s, `⚓ Navy crackdown on smuggling! Fined ${fmt(fine)} gold.`, 'bad');
}

function treasureDiscovery(s: GameState): void {
  const sites = ownedIslands(s).filter(i => i.traits.includes('ruins') || i.traits.includes('treasureSite'));
  const island = sites.length ? pick(sites) : pick(ownedIslands(s));
  const amount = 2 + Math.floor(Math.random() * 4);
  island.storage.treasure = Math.min(island.storage.treasure + amount, 999);
  s.totals.treasureFound += amount;
  pulseAtIsland(island.x, island.z, 0xffd75c);
  addAlert(s, `💎 Workers on ${island.name} unearthed ${amount} treasure!`, 'good');
}

function marketCrash(s: GameState): void {
  s.marketCrash = 90;
  addAlert(s, '📉 Market crash! Sell prices halved (and imports cheap) for 90s.', 'bad');
}

function disease(s: GameState): void {
  const hungry = ownedIslands(s).filter(i => i.storage.crew > 3 && i.storage.food < 2);
  if (hungry.length === 0) {
    addAlert(s, '🤒 A fever spreads through the islands, but well-fed crews shrug it off.', 'warn');
    return;
  }
  const island = pick(hungry);
  const lost = Math.max(1, Math.floor(island.storage.crew * 0.25));
  island.storage.crew -= lost;
  pulseAtIsland(island.x, island.z, 0x8ae08a);
  addAlert(s, `🤒 Disease sweeps starving ${island.name}: ${lost} crew lost! Ship in food.`, 'bad');
}

function mutiny(s: GameState): void {
  const sober = ownedIslands(s).filter(i => i.storage.crew > 5 && i.storage.rum < 1);
  if (sober.length === 0) {
    addAlert(s, '🍺 Murmurs of mutiny die down — the rum is flowing.', 'warn');
    return;
  }
  const island = pick(sober);
  const lost = Math.max(1, Math.floor(island.storage.crew * 0.2));
  island.storage.crew -= lost;
  pulseAtIsland(island.x, island.z, 0xe3a05a);
  addAlert(s, `🗡️ Mutiny on ${island.name}! ${lost} crew stole a longboat and deserted. Keep the rum stocked!`, 'bad');
}

const EVENTS: ((s: GameState) => void)[] = [
  storm, storm, pirateAttack, pirateAttack, navyRaid,
  treasureDiscovery, treasureDiscovery, marketCrash, disease, mutiny,
];

export function tickEvents(s: GameState, dt: number): void {
  s.eventTimer -= dt;
  if (s.eventTimer <= 0) {
    s.eventTimer = 90 + Math.random() * 90;
    pick(EVENTS)(s);
  }
}
