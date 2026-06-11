// Relic collection: random discovery and set completion.

import type { GameState } from './types';
import { RELICS, RELIC_SETS } from './data';
import { notify, logEvent } from './notifications';

export function unownedRelics(s: GameState): string[] {
  return RELICS.filter(r => !s.relicsOwned.includes(r.id)).map(r => r.id);
}

/** Awards a random unowned relic. Returns the relic id or null if all owned. */
export function tryFindRelic(s: GameState): string | null {
  const pool = unownedRelics(s);
  if (pool.length === 0) return null;
  const id = pool[Math.floor(Math.random() * pool.length)];
  s.relicsOwned.push(id);
  s.stats.relicsFound++;
  const def = RELICS.find(r => r.id === id)!;
  notify(`🔮 Relic recovered: ${def.icon} ${def.name}!`, 'achievement');
  logEvent(s, `Recovered the ${def.name}.`);

  const set = RELIC_SETS.find(x => x.id === def.set)!;
  const members = RELICS.filter(r => r.set === def.set);
  if (members.every(r => s.relicsOwned.includes(r.id))) {
    notify(`✨ Set complete: ${set.name}! (+${set.bonus.value}% ${set.bonus.key})`, 'achievement');
    logEvent(s, `Completed the ${set.name} relic set.`);
  }
  return id;
}

export function setProgress(s: GameState, setId: string): { owned: number; total: number } {
  const members = RELICS.filter(r => r.set === setId);
  return {
    owned: members.filter(r => s.relicsOwned.includes(r.id)).length,
    total: members.length,
  };
}
