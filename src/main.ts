// Entry point: load save, apply offline progress, boot UI + 3D scene,
// and run the game loop (1s logic ticks, 60fps rendering).

import './style.css';
import type { GameState } from './types';
import { loadGame, applyOfflineProgress, startAutosave, saveGame } from './save';
import { tick } from './game';
import { initUI, bindState, renderAll, showOfflineSummary } from './ui';
import { initScene, updateScene } from './threeScene';
import { logEvent } from './notifications';

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
