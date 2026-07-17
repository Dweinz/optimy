// Entry point: load save, apply offline progress, boot UI + 3D scene,
// and run the game loop (1s logic ticks, 60fps rendering).

import './style.css';
import type { GameState } from './types';

declare const __APP_VERSION__: string;
import { loadGame, applyOfflineProgress, startAutosave, saveGame } from './save';
import { tick } from './game';
import { initUI, bindState, renderAll, showOfflineSummary, showInstallInstructions } from './ui';
import { initScene, updateScene } from './threeScene';
import { initTutorial } from './tutorial';
import { initTouch } from './touch';
import { logEvent } from './notifications';

// PWA install — the button is always visible unless the app is already running
// as an installed PWA (standalone mode). We capture beforeinstallprompt so we
// can trigger the native dialog directly; if the browser doesn't fire it (app
// already installed, or Chrome's engagement threshold not yet met), clicking
// the button shows step-by-step manual instructions instead.
interface BeforeInstallPromptEvent extends Event {
  prompt(): void;
  userChoice: Promise<{ outcome: string }>;
}
const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as { standalone?: boolean }).standalone === true;

const installBtn = document.getElementById('btn-install') as HTMLButtonElement | null;
if (installBtn && isStandalone()) installBtn.style.display = 'none';

let installPrompt: BeforeInstallPromptEvent | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e as BeforeInstallPromptEvent;
});
installBtn?.addEventListener('click', () => {
  if (installPrompt) {
    installPrompt.prompt();
    installPrompt.userChoice.then(() => { installPrompt = null; });
  } else {
    showInstallInstructions();
  }
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  if (installBtn) installBtn.style.display = 'none';
});

let state: GameState = loadGame();

const offline = applyOfflineProgress(state);

const isNewGame = state.stats.playTime < 1;
if (isNewGame) {
  logEvent(state, 'You wake on a creaking raft with 10 gold, one loyal hand, and the whole sea ahead. Pick an activity to begin!');
}

initUI(state, (next) => {
  // Called when an imported save replaces the running state.
  state = next;
  bindState(state);
  renderAll();
});

initScene(document.getElementById('scene-container')!);
initTutorial();
initTouch();

if (offline && (offline.gold > 0 || offline.voyages > 0 || offline.seconds > 300)) {
  showOfflineSummary(offline);
}

// Logic tick: 1 second.
setInterval(() => {
  tick(state, 1);
  renderAll();
}, 1000);

// Render loop: every frame.
let lastFrame = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  updateScene(state, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

startAutosave(() => state);
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveGame(state);
});
