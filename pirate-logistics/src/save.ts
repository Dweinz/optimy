// Save/load via localStorage, plus export/import strings.
// No offline progress — this is a real-time sim, the world pauses with you.

import type { GameState } from './types';
import { createNewGame, SAVE_VERSION, newTracker, emptyStorage } from './world';
import { BASE_PRICES } from './data';
import { notify } from './notify';

const KEY = 'pirateLogistics.save.v1';

export function saveGame(s: GameState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (e) {
    console.error('Save failed', e);
  }
}

function hydrate(raw: Partial<GameState>): GameState {
  const base = createNewGame();
  const s: GameState = {
    ...base,
    ...raw,
    version: SAVE_VERSION,
    prices: { ...BASE_PRICES, ...(raw.prices ?? {}) },
    techs: { ...base.techs, ...(raw.techs ?? {}) },
    stats: { prod: {}, cons: {}, goldIn: newTracker(), goldOut: newTracker(), bucketTimer: 0 },
    totals: { ...base.totals, ...(raw.totals ?? {}) },
    alerts: raw.alerts ?? [],
    autoTrade: raw.autoTrade ?? [],
    expeditions: raw.expeditions ?? [],
    speed: 1,
  };
  // Ensure island storages contain every resource key.
  for (const isl of s.islands) {
    isl.storage = { ...emptyStorage(), ...isl.storage };
  }
  return s;
}

export function loadGame(): GameState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return createNewGame();
    return hydrate(JSON.parse(raw));
  } catch (e) {
    console.error('Load failed, starting fresh', e);
    return createNewGame();
  }
}

export function wipeAndNew(): GameState {
  localStorage.removeItem(KEY);
  const s = createNewGame();
  saveGame(s);
  return s;
}

export function exportSave(s: GameState): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(s))));
}

export function importSave(text: string): GameState | null {
  try {
    const s = hydrate(JSON.parse(decodeURIComponent(escape(atob(text.trim())))));
    saveGame(s);
    return s;
  } catch (e) {
    console.error('Import failed', e);
    return null;
  }
}

let handle: number | undefined;

export function startAutosave(getState: () => GameState): void {
  if (handle !== undefined) clearInterval(handle);
  handle = window.setInterval(() => saveGame(getState()), 10000);
  window.addEventListener('beforeunload', () => saveGame(getState()));
}

export function manualSave(s: GameState): void {
  saveGame(s);
  notify('💾 Game saved.');
}
