// Persistence: localStorage saves, export/import strings, and offline
// progress simulation (capped at 12 hours, run in 60-second chunks).

import type { GameState, OfflineSummary } from './types';
import { createNewGame, SAVE_VERSION, freshResources, freshSkills, freshBuildings, freshMaps, freshPrices, freshCargo, freshStats } from './state';
import { tick } from './game';
import { setSilent, notify } from './notifications';

const SAVE_KEY = 'sevenSeasIdle.save.v1';
export const OFFLINE_CAP_SECONDS = 12 * 60 * 60;

export function saveGame(s: GameState): void {
  s.lastSeen = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch (e) {
    console.error('Save failed', e);
  }
}

/** Deep-merges a parsed save over a fresh state so old saves never miss keys. */
function hydrate(raw: Partial<GameState>): GameState {
  const base = createNewGame();
  const s: GameState = {
    ...base,
    ...raw,
    version: SAVE_VERSION,
    resources: { ...freshResources(), ...(raw.resources ?? {}) },
    skills: { ...freshSkills(), ...(raw.skills ?? {}) },
    buildings: { ...freshBuildings(), ...(raw.buildings ?? {}) },
    mapsInv: { ...freshMaps(), ...(raw.mapsInv ?? {}) },
    prices: { ...freshPrices(), ...(raw.prices ?? {}) },
    cargo: { ...freshCargo(), ...(raw.cargo ?? {}) },
    stats: { ...freshStats(), ...(raw.stats ?? {}) },
    legend: { points: 0, spent: {}, prestiges: 0, ...(raw.legend ?? {}) },
    fleet: raw.fleet ?? base.fleet,
    crewMembers: raw.crewMembers ?? base.crewMembers,
    discoveredIslands: raw.discoveredIslands ?? [],
    relicsOwned: raw.relicsOwned ?? [],
    achievements: raw.achievements ?? [],
    log: raw.log ?? [],
  };
  return s;
}

export function loadGame(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createNewGame();
    return hydrate(JSON.parse(raw));
  } catch (e) {
    console.error('Load failed, starting fresh', e);
    return createNewGame();
  }
}

export function wipeSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export function exportSave(s: GameState): string {
  s.lastSeen = Date.now();
  return btoa(unescape(encodeURIComponent(JSON.stringify(s))));
}

export function importSave(text: string): GameState | null {
  try {
    const json = decodeURIComponent(escape(atob(text.trim())));
    const s = hydrate(JSON.parse(json));
    saveGame(s);
    return s;
  } catch (e) {
    console.error('Import failed', e);
    return null;
  }
}

/**
 * Simulates offline time in 60s chunks (silenced, no events) and returns a
 * summary of what happened, or null if the player was barely away.
 */
export function applyOfflineProgress(s: GameState): OfflineSummary | null {
  const elapsed = Math.floor((Date.now() - s.lastSeen) / 1000);
  if (elapsed < 30) return null;

  const seconds = Math.min(elapsed, OFFLINE_CAP_SECONDS);
  const before = {
    gold: s.resources.gold,
    voyages: s.stats.voyages,
    treasures: s.stats.treasures,
    crew: s.stats.crewRecruited,
    maps: s.stats.mapsFound,
  };

  setSilent(true);
  let remaining = seconds;
  while (remaining > 0) {
    const chunk = Math.min(60, remaining);
    tick(s, chunk, { offline: true });
    remaining -= chunk;
  }
  setSilent(false);

  return {
    seconds,
    gold: s.resources.gold - before.gold,
    voyages: s.stats.voyages - before.voyages,
    treasures: s.stats.treasures - before.treasures,
    crew: s.stats.crewRecruited - before.crew,
    maps: s.stats.mapsFound - before.maps,
  };
}

let autosaveHandle: number | undefined;

export function startAutosave(getState: () => GameState): void {
  if (autosaveHandle !== undefined) clearInterval(autosaveHandle);
  autosaveHandle = window.setInterval(() => saveGame(getState()), 5000);
  window.addEventListener('beforeunload', () => saveGame(getState()));
}

export function manualSave(s: GameState): void {
  saveGame(s);
  notify('💾 Game saved.');
}
