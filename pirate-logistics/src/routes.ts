// Shipping routes: the conveyor belts of the archipelago. Each route binds a
// source island, a destination island and one cargo type; assigned ships
// loop load → sail → unload → return automatically.

import type { GameState, Route, Ship, ResourceId, Island } from './types';
import { shipDef, RES_NAME } from './data';
import { islandById, distance } from './world';
import { shipSpeedMult } from './tech';
import { addToStorage, recordProd, recordCons, hasDock } from './production';
import { addAlert } from './notify';

const LOAD_TIME = 3; // seconds at dock per transfer (reduced by dock level)

export function createRoute(s: GameState, sourceId: number, destId: number, resource: ResourceId): Route | null {
  const src = islandById(s, sourceId);
  const dst = islandById(s, destId);
  if (!src || !dst || src.id === dst.id) return null;
  if (!src.owned || !dst.owned) { addAlert(s, 'Routes need both islands under your flag.', 'warn'); return null; }
  if (!hasDock(src) || !hasDock(dst)) { addAlert(s, 'Both islands need a Dock.', 'warn'); return null; }
  const route: Route = {
    id: s.nextId++,
    sourceId, destId, resource,
    shipIds: [],
    delivered: 0, deliveredWindow: 0, perMin: 0,
    utilization: 0, utilSamples: 0, utilSum: 0,
  };
  s.routes.push(route);
  addAlert(s, `Route opened: ${src.name} → ${dst.name} (${RES_NAME[resource]})`, 'good');
  return route;
}

export function deleteRoute(s: GameState, routeId: number): void {
  const route = s.routes.find(r => r.id === routeId);
  if (!route) return;
  for (const shipId of route.shipIds) {
    const ship = s.ships.find(sh => sh.id === shipId);
    if (ship) {
      // Cargo aboard is returned to the source island to avoid item deletion.
      if (ship.cargo > 0) {
        const src = islandById(s, route.sourceId);
        if (src) addToStorage(s, src, route.resource, ship.cargo);
        ship.cargo = 0;
      }
      ship.state = 'idle';
      ship.routeId = null;
      ship.phase = 'loading';
      ship.progress = 0;
    }
  }
  s.routes = s.routes.filter(r => r.id !== routeId);
}

export function assignShip(s: GameState, routeId: number, shipId: number): boolean {
  const route = s.routes.find(r => r.id === routeId);
  const ship = s.ships.find(sh => sh.id === shipId);
  if (!route || !ship || ship.state !== 'idle') return false;
  ship.state = 'route';
  ship.routeId = routeId;
  ship.phase = 'loading';
  ship.progress = 0;
  ship.cargo = 0;
  route.shipIds.push(shipId);
  return true;
}

export function unassignShip(s: GameState, shipId: number): void {
  const ship = s.ships.find(sh => sh.id === shipId);
  if (!ship || ship.routeId === null) return;
  const route = s.routes.find(r => r.id === ship.routeId);
  if (route) {
    route.shipIds = route.shipIds.filter(id => id !== shipId);
    if (ship.cargo > 0) {
      const src = islandById(s, route.sourceId);
      if (src) addToStorage(s, src, route.resource, ship.cargo);
      ship.cargo = 0;
    }
  }
  ship.state = 'idle';
  ship.routeId = null;
  ship.phase = 'loading';
  ship.progress = 0;
}

function dockLevel(island: Island): number {
  return island.buildings.filter(b => b.type === 'dock').reduce((m, b) => Math.max(m, b.level), 1);
}

/** Advances every ship on every route. */
export function tickRoutes(s: GameState, dt: number, speedPenalty: number): void {
  const spdMult = shipSpeedMult(s) * speedPenalty;

  for (const route of s.routes) {
    const src = islandById(s, route.sourceId);
    const dst = islandById(s, route.destId);
    if (!src || !dst) continue;
    const dist = Math.max(1, distance(src, dst));

    for (const shipId of route.shipIds) {
      const ship = s.ships.find(sh => sh.id === shipId);
      if (!ship) continue;
      const def = shipDef(ship.type);
      const travelTime = dist / (def.speed * spdMult);
      const conditionMult = 0.5 + (ship.condition / 100) * 0.5;

      switch (ship.phase) {
        case 'loading': {
          ship.progress += dt * dockLevel(src);
          if (ship.progress >= LOAD_TIME) {
            const want = def.capacity - ship.cargo;
            const take = Math.min(want, Math.floor(src.storage[route.resource]));
            src.storage[route.resource] -= take;
            ship.cargo += take;
            route.utilSum += ship.cargo / def.capacity;
            route.utilSamples++;
            ship.phase = 'toDest';
            ship.progress = 0;
          }
          break;
        }
        case 'toDest': {
          ship.progress += (dt * conditionMult) / travelTime;
          if (ship.progress >= 1) {
            ship.phase = 'unloading';
            ship.progress = 0;
          }
          break;
        }
        case 'unloading': {
          ship.progress += dt * dockLevel(dst);
          if (ship.progress >= LOAD_TIME) {
            if (ship.cargo > 0) {
              const delivered = addToStorage(s, dst, route.resource, ship.cargo);
              route.delivered += delivered;
              route.deliveredWindow += delivered;
              // Anything that didn't fit stays aboard and rides back.
              ship.cargo -= delivered;
            }
            ship.phase = 'toSource';
            ship.progress = 0;
          }
          break;
        }
        case 'toSource': {
          ship.progress += (dt * conditionMult) / travelTime;
          if (ship.progress >= 1) {
            // Return any cargo that bounced off a full destination.
            if (ship.cargo > 0) {
              addToStorage(s, src, route.resource, ship.cargo);
              ship.cargo = 0;
            }
            ship.phase = 'loading';
            ship.progress = 0;
          }
          break;
        }
      }
    }
  }
}

/** World-space position for rendering a ship on its route. */
export function shipWorldPos(s: GameState, ship: Ship): { x: number; z: number } | null {
  if (ship.state === 'route' && ship.routeId !== null) {
    const route = s.routes.find(r => r.id === ship.routeId);
    if (!route) return null;
    const src = islandById(s, route.sourceId);
    const dst = islandById(s, route.destId);
    if (!src || !dst) return null;
    let t = 0;
    if (ship.phase === 'loading') t = 0;
    else if (ship.phase === 'toDest') t = ship.progress;
    else if (ship.phase === 'unloading') t = 1;
    else t = 1 - ship.progress;
    return { x: src.x + (dst.x - src.x) * t, z: src.z + (dst.z - src.z) * t };
  }
  return null;
}

export function idleShips(s: GameState): Ship[] {
  return s.ships.filter(sh => sh.state === 'idle');
}
