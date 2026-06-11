// Floating notifications, achievement popups and the captain's log.
// Kept separate from ui.ts so game logic can notify without import cycles.

import type { GameState } from './types';

let silent = false;

/** Suppress popups (used during offline simulation). */
export function setSilent(v: boolean): void {
  silent = v;
}

export type NotifKind = 'info' | 'achievement' | 'levelup' | 'bad';

export function notify(text: string, kind: NotifKind = 'info'): void {
  if (silent) return;
  const root = document.getElementById('notifications');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `notif ${kind}`;
  el.textContent = text;
  root.appendChild(el);
  while (root.children.length > 6) root.removeChild(root.firstChild!);
  setTimeout(() => el.remove(), 4100);
}

export function logEvent(s: GameState, text: string): void {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  s.log.unshift(`[${time}] ${text}`);
  if (s.log.length > 60) s.log.length = 60;
}
