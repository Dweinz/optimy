// Crew members: recruitment, leveling, morale, promotion and loss.

import type { GameState, CrewMember, Bonuses, CrewRole } from './types';
import { shipType } from './data';
import { notify, logEvent } from './notifications';

const FIRST = ['Salty', 'One-Eye', 'Red', 'Mad', 'Iron', 'Black', 'Lucky', 'Grim', 'Silver', 'Bold', 'Cannonball', 'Quiet', 'Howling', 'Rusty', 'Gentle', 'Sly'];
const LAST = ['Jack', 'Anne', 'Morgan', 'Flint', 'Bess', 'Davy', 'Marlow', 'Kidd', 'Bonny', 'Teach', 'Rackham', 'Vane', 'Greta', 'Sam', 'Nell', 'Bart'];

export function randomName(): string {
  return `${FIRST[Math.floor(Math.random() * FIRST.length)]} ${LAST[Math.floor(Math.random() * LAST.length)]}`;
}

export function crewCapacity(s: GameState): number {
  return s.fleet.reduce((sum, sh) => sum + shipType(sh.typeId).capacity, 0);
}

export function recruitCost(s: GameState): number {
  return Math.floor(25 * Math.pow(1.12, s.crewMembers.length));
}

export function canRecruit(s: GameState): boolean {
  return s.crewMembers.length < crewCapacity(s) && s.resources.gold >= recruitCost(s);
}

export function hireCrewMember(s: GameState, free = false): CrewMember | null {
  if (s.crewMembers.length >= crewCapacity(s)) return null;
  if (!free) {
    const cost = recruitCost(s);
    if (s.resources.gold < cost) return null;
    s.resources.gold -= cost;
  }
  const m: CrewMember = {
    id: s.nextId++,
    name: randomName(),
    role: 'Deckhand',
    level: 1,
    xp: 0,
    morale: 60 + Math.floor(Math.random() * 25),
    combat: 2 + Math.floor(Math.random() * 4),
    navigation: 2 + Math.floor(Math.random() * 4),
    loyalty: 40 + Math.floor(Math.random() * 30),
  };
  s.crewMembers.push(m);
  s.stats.crewRecruited++;
  return m;
}

export function crewXpForLevel(level: number): number {
  return Math.floor(50 * Math.pow(level, 1.7));
}

const ROLE_ORDER: CrewRole[] = ['Deckhand', 'Sailor', 'Officer', 'Quartermaster'];

export function promotionCost(m: CrewMember): number {
  const idx = ROLE_ORDER.indexOf(m.role);
  return Math.floor(100 * Math.pow(6, idx) * m.level);
}

export function canPromote(m: CrewMember): boolean {
  return ROLE_ORDER.indexOf(m.role) < ROLE_ORDER.length - 1;
}

export function promote(s: GameState, id: number): void {
  const m = s.crewMembers.find(c => c.id === id);
  if (!m || !canPromote(m)) return;
  const cost = promotionCost(m);
  if (s.resources.gold < cost) return;
  s.resources.gold -= cost;
  m.role = ROLE_ORDER[ROLE_ORDER.indexOf(m.role) + 1];
  m.combat += 3;
  m.navigation += 3;
  m.loyalty = Math.min(100, m.loyalty + 15);
  m.morale = Math.min(100, m.morale + 10);
  notify(`${m.name} promoted to ${m.role}!`, 'levelup');
  logEvent(s, `${m.name} was promoted to ${m.role}.`);
}

function roleMult(role: CrewRole): number {
  return 1 + ROLE_ORDER.indexOf(role) * 0.25;
}

/** Overall crew quality multiplier feeding nearly every system. */
export function crewEfficiency(s: GameState, b: Bonuses): number {
  if (s.crewMembers.length === 0) return 0.25;
  let statSum = 0;
  let moraleSum = 0;
  for (const m of s.crewMembers) {
    statSum += ((m.combat + m.navigation) / 2 + m.level) * roleMult(m.role);
    moraleSum += m.morale;
  }
  const avgStat = statSum / s.crewMembers.length;
  const avgMorale = moraleSum / s.crewMembers.length;
  const quality = 0.5 + Math.min(2.5, avgStat / 15);
  return quality * (avgMorale / 75) * b.crewEff;
}

export function averageMorale(s: GameState): number {
  if (s.crewMembers.length === 0) return 0;
  return s.crewMembers.reduce((a, m) => a + m.morale, 0) / s.crewMembers.length;
}

/** Per-tick crew upkeep: rum keeps morale up, crew slowly gains experience. */
export function tickCrew(s: GameState, dt: number): void {
  const n = s.crewMembers.length;
  if (n === 0) return;

  const rumNeed = 0.015 * n * dt;
  const hasRum = s.resources.rum >= rumNeed;
  if (hasRum) s.resources.rum -= rumNeed;

  for (const m of s.crewMembers) {
    const target = hasRum ? 85 : 45;
    m.morale += (target - m.morale) * 0.01 * dt;
    m.morale = Math.max(5, Math.min(100, m.morale));

    if (s.activity !== null) {
      m.xp += 0.2 * dt;
      while (m.xp >= crewXpForLevel(m.level)) {
        m.xp -= crewXpForLevel(m.level);
        m.level++;
        if (Math.random() < 0.5) m.combat++; else m.navigation++;
        m.loyalty = Math.min(100, m.loyalty + 2);
      }
    }
  }
}

/** Removes the least-loyal crew member; returns their name or null. */
export function loseCrewMember(s: GameState, reason: string): string | null {
  if (s.crewMembers.length <= 1) return null;
  let worst = s.crewMembers[0];
  for (const m of s.crewMembers) if (m.loyalty < worst.loyalty) worst = m;
  s.crewMembers = s.crewMembers.filter(m => m.id !== worst.id);
  notify(`☠️ ${worst.name} was lost (${reason}).`, 'bad');
  logEvent(s, `${worst.name} was lost: ${reason}.`);
  return worst.name;
}
