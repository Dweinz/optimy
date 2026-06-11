// Toast notifications and the alert feed shown over the viewport.

import type { GameState, Alert } from './types';

export function notify(text: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
  const root = document.getElementById('notifications');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `notif ${kind === 'info' ? '' : kind}`;
  el.textContent = text;
  root.appendChild(el);
  while (root.children.length > 5) root.removeChild(root.firstChild!);
  setTimeout(() => el.remove(), 4500);
}

export function addAlert(s: GameState, text: string, kind: Alert['kind']): void {
  s.alerts.unshift({ t: s.time, text, kind });
  if (s.alerts.length > 30) s.alerts.length = 30;
  notify(text, kind === 'bad' ? 'bad' : kind === 'good' ? 'good' : 'info');
}
