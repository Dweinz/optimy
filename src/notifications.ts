// Floating notifications, achievement popups and the captain's log.
// Kept separate from ui.ts so game logic can notify without import cycles.

import type { GameState } from './types';

let silent = false;

/** Suppress popups (used during offline simulation). */
export function setSilent(v: boolean): void {
  silent = v;
}

export type NotifKind = 'info' | 'achievement' | 'levelup' | 'bad';

function fxRoot(): HTMLElement {
  let el = document.getElementById('fx-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fx-root';
    document.body.appendChild(el);
  }
  return el;
}

/** Particle burst of coins/sparkles from the upper-center of the screen. */
export function burst(count = 16, emojis: string[] = ['🪙', '✨', '💰']): void {
  if (silent) return;
  const root = fxRoot();
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight * 0.32;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'fx-particle';
    p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    const ang = Math.random() * Math.PI * 2;
    const dist = 90 + Math.random() * 170;
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    p.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(ang) * dist * 0.7 - 50}px`);
    p.style.setProperty('--rot', `${(Math.random() - 0.5) * 540}deg`);
    p.style.animationDelay = `${Math.random() * 0.12}s`;
    root.appendChild(p);
    setTimeout(() => p.remove(), 1700);
  }
}

let bannerUntil = 0;

/** Big celebratory banner for major rewards. Throttled so it never stacks. */
export function showBanner(text: string): void {
  if (silent) return;
  const now = Date.now();
  if (now < bannerUntil) return;
  bannerUntil = now + 2400;
  const b = document.createElement('div');
  b.className = 'fx-banner';
  b.textContent = text;
  fxRoot().appendChild(b);
  setTimeout(() => b.remove(), 2700);
}

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

  // Rewards get celebrated, not just listed.
  if (kind === 'achievement') {
    showBanner(text);
    burst(18);
  } else if (kind === 'levelup') {
    burst(8, ['✨', '⭐']);
  }
}

export function logEvent(s: GameState, text: string): void {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  s.log.unshift(`[${time}] ${text}`);
  if (s.log.length > 60) s.log.length = 60;
}
