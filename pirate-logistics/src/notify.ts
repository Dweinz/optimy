// Toast notifications, the alert feed, and the celebration layer
// (banners + particle bursts) for milestone rewards.

import type { GameState, Alert } from './types';

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
export function burst(count = 16, emojis: string[] = ['🪙', '✨', '⚓']): void {
  const root = fxRoot();
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight * 0.3;
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

/** Big celebratory banner for major milestones. Throttled so it never stacks. */
export function showBanner(text: string): void {
  const now = Date.now();
  if (now < bannerUntil) return;
  bannerUntil = now + 2400;
  const b = document.createElement('div');
  b.className = 'fx-banner';
  b.textContent = text;
  fxRoot().appendChild(b);
  setTimeout(() => b.remove(), 2700);
}

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

/** `big` marks milestone rewards: they get a banner + particle burst. */
export function addAlert(s: GameState, text: string, kind: Alert['kind'], big = false): void {
  s.alerts.unshift({ t: s.time, text, kind });
  if (s.alerts.length > 30) s.alerts.length = 30;
  notify(text, kind === 'bad' ? 'bad' : kind === 'good' ? 'good' : 'info');
  if (big && kind === 'good') {
    showBanner(text);
    burst(18);
  }
}
