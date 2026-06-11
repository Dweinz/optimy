// Entry point: load save, boot UI + 3D scene, run the fixed-step simulation
// (4 Hz logic, scaled by game speed) and the 60fps render loop.

import './style.css';
import type { GameState } from './types';
import { loadGame, startAutosave, saveGame } from './save';
import { tickProduction, tickStats } from './production';
import { tickRoutes } from './routes';
import { tickMaintenance } from './ships';
import { tickExpeditions } from './expeditions';
import { tickCrewUpkeep, tickAutoTrade, tickPrices } from './economy';
import { tickEvents } from './events';
import { initUI, bindState, renderAll, selectIsland, getSelectedIsland } from './ui';
import { initScene, updateScene } from './threeScene';
import { initTutorial } from './tutorial';
import { addAlert } from './notify';

let state: GameState = loadGame();

if (state.time < 1) {
  addAlert(state, '🏴‍☠️ Welcome, Quartermaster! Build a Wood Camp and a Farm on Home Haven, then explore for iron.', 'good');
}

initUI(state, (next) => {
  state = next;
  bindState(state);
  renderAll();
});

initScene(document.getElementById('scene-container')!, (islandId) => {
  if (islandId !== null) selectIsland(islandId);
});
initTutorial();

/** One simulation step. Order matters: upkeep → production → logistics. */
function simTick(dt: number): void {
  state.time += dt;
  const upkeep = tickCrewUpkeep(state, dt);
  tickProduction(state, dt, upkeep.efficiency);
  tickRoutes(state, dt, 1);
  tickMaintenance(state, dt);
  tickExpeditions(state, dt);
  tickAutoTrade(state, dt);
  tickPrices(state, dt);
  tickEvents(state, dt);
  tickStats(state, dt);
}

// Fixed-step logic at 4 Hz, scaled by the speed setting (0 = paused).
const STEP = 0.25;
setInterval(() => {
  if (state.speed <= 0) return;
  for (let i = 0; i < state.speed; i++) simTick(STEP);
}, 250);

// UI refresh at 2 Hz.
setInterval(() => renderAll(), 500);

// Render loop.
let lastFrame = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  updateScene(state, dt * Math.max(1, state.speed), getSelectedIsland());
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

startAutosave(() => state);
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveGame(state);
});
