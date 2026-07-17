// All DOM UI: tabs, panels, topbar, modals and the activity box. Rendering is
// innerHTML-based with click delegation so the 1s re-render never breaks
// buttons.

declare const __APP_VERSION__: string;

import type { GameState, ActivityId, BuildingId, MapQuality, OfflineSummary } from './types';
import {
  SKILLS, ACTIVITIES, SHIP_TYPES, BUILDINGS, TRADE_GOODS, ISLANDS, RELICS,
  RELIC_SETS, RAID_TARGETS, LEGEND_UPGRADES, MAP_QUALITIES, MAP_QUALITY_INFO,
  BOSSES, shipType, fmt,
} from './data';
import { currentBoss, bossWinChance, challengeBoss } from './bosses';
import { QUEST_TRACKS, currentGoal, trackIndex, completedGoals, totalGoals } from './quests';
import { computeBonuses, xpForLevel, masteryXpForLevel, totalSkillLevels } from './skills';
import { crewEfficiency, crewCapacity, recruitCost, hireCrewMember, promote, promotionCost, canPromote, averageMorale } from './crew';
import { fleetSpeed, fleetPower, fleetCargo, canOrderShip, orderShip, discountedCost, scrapShip, scrapValue } from './fleet';
import { buyGood, sellGood, fenceGoods, tradeRouteCount, tradeRouteIncome, cargoUsed, cargoFree } from './trade';
import { totalMaps, combineMaps, huntSuccessChance, fenceTreasure } from './treasure';
import { setProgress } from './relics';
import { buildingCost, upgradeBuilding, totalBuildingLevels } from './port';
import { getPendingEvent, resolveEventChoice } from './events';
import { ACHIEVEMENTS } from './achievements';
import {
  prestigeRequirements, canPrestige, legendPointsOnPrestige, becomeLegend,
  legendUpgradeLevel, legendUpgradeCost, buyLegendUpgrade,
} from './prestige';
import { setActivity, activityRates, computeRates, HUNT_POINTS, RAID_POINTS, VOYAGE_POINTS } from './game';
import { manualSave, exportSave, importSave } from './save';
import { notify } from './notifications';

type TabId =
  | 'overview' | 'resources' | 'skills' | 'activities' | 'fleet' | 'crew'
  | 'port' | 'maps' | 'treasure' | 'trade' | 'bounties' | 'relics'
  | 'achievements' | 'legend';

// What each activity produces (↑) and consumes (↓), and which skill it trains.
// Used to highlight affected resources and skills while an activity is running.
const ACTIVITY_TOUCHES: Record<string, {
  up: string[];
  down?: string[];
  skill: string;
}> = {
  sail:         { up: ['gold', 'supplies'],                           skill: 'sailing' },
  explore:      { up: ['knowledge'],         down: ['supplies'],      skill: 'navigation' },
  raid:         { up: ['gold', 'tradeGoods', 'reputation'],           skill: 'plundering' },
  trade:        { up: ['gold', 'tradeGoods'],                         skill: 'trading' },
  smuggle:      { up: ['gold', 'reputation'],                         skill: 'smuggling' },
  treasureHunt: { up: ['treasure'],          down: ['maps'],          skill: 'treasureHunting' },
  recruit:      { up: ['crew'],              down: ['gold'],          skill: 'crewManagement' },
  buildShips:   { up: ['ships'],                                      skill: 'shipbuilding' },
  tavern:       { up: ['rum', 'gold'],                                skill: 'tavernKeeping' },
  researchMaps: { up: ['maps', 'knowledge'],                          skill: 'cartography' },
  studyRelics:  { up: ['cursedRelics'],      down: ['knowledge'],     skill: 'cursedLore' },
  diplomacy:    { up: ['influence', 'reputation'],                    skill: 'diplomacy' },
};

const TABS: { id: TabId; name: string; icon: string }[] = [
  { id: 'overview', name: 'Overview', icon: '🏠' },
  { id: 'resources', name: 'Resources', icon: '📦' },
  { id: 'skills', name: 'Skills', icon: '📖' },
  { id: 'activities', name: 'Activities', icon: '⚙️' },
  { id: 'fleet', name: 'Fleet', icon: '⛵' },
  { id: 'crew', name: 'Crew', icon: '👥' },
  { id: 'port', name: 'Port', icon: '🏘️' },
  { id: 'maps', name: 'Maps', icon: '🗺️' },
  { id: 'treasure', name: 'Treasure', icon: '💎' },
  { id: 'trade', name: 'Trade', icon: '⚖️' },
  { id: 'bounties', name: 'Bounties', icon: '☠️' },
  { id: 'relics', name: 'Relics', icon: '🔮' },
  { id: 'achievements', name: 'Achievements', icon: '🏆' },
  { id: 'legend', name: 'Legend', icon: '🌟' },
];

let S: GameState;
let activeTab: TabId = 'overview';
let modalKind: 'none' | 'event' | 'outcome' | 'offline' | 'import' = 'none';
let onStateReplaced: ((s: GameState) => void) | null = null;

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function bar(frac: number, label: string, color = ''): string {
  const pct = Math.max(0, Math.min(100, frac * 100));
  return `<div class="progress-bar"><div class="fill ${color}" style="width:${pct}%"></div><div class="bar-label">${label}</div></div>`;
}

// ----------------------------------------------------------------- modals

function showModal(html: string, kind: typeof modalKind): void {
  modalKind = kind;
  const root = document.getElementById('modal-root')!;
  root.innerHTML = `<div class="modal-overlay"><div class="modal">${html}</div></div>`;
}

function closeModal(): void {
  modalKind = 'none';
  document.getElementById('modal-root')!.innerHTML = '';
}

export function showOfflineSummary(sum: OfflineSummary): void {
  const hours = Math.floor(sum.seconds / 3600);
  const mins = Math.floor((sum.seconds % 3600) / 60);
  showModal(`
    <h2>⚓ Welcome back, Captain!</h2>
    <div class="modal-desc">While you were away for <b class="gold-text">${hours}h ${mins}m</b>, your crew kept working:</div>
    <div class="res-row"><span class="res-name">💰 Gold earned</span><span class="res-val">${fmt(Math.max(0, sum.gold))}</span></div>
    <div class="res-row"><span class="res-name">⛵ Voyages completed</span><span class="res-val">${sum.voyages}</span></div>
    <div class="res-row"><span class="res-name">💎 Treasures found</span><span class="res-val">${sum.treasures}</span></div>
    <div class="res-row"><span class="res-name">👥 Crew recruited</span><span class="res-val">${sum.crew}</span></div>
    <div class="res-row"><span class="res-name">🗺️ Maps found</span><span class="res-val">${sum.maps}</span></div>
    <div class="mt8" style="text-align:right"><button class="btn primary" data-action="modal:close">Back to the helm!</button></div>
  `, 'offline');
}

function showImportModal(): void {
  showModal(`
    <h2>📥 Import Save</h2>
    <div class="modal-desc">Paste an exported save string below. <b class="red-text">This replaces your current game.</b></div>
    <textarea id="import-text" placeholder="Paste save data here..."></textarea>
    <div class="flex-between">
      <button class="btn" data-action="modal:close">Cancel</button>
      <button class="btn primary" data-action="import:confirm">Import</button>
    </div>
  `, 'import');
}

function renderEventModal(): void {
  const ev = getPendingEvent();
  if (ev && modalKind === 'none') {
    const choices = ev.choices.map((c, i) =>
      `<button class="btn" data-action="event:choice:${i}"><b>${esc(c.label)}</b><br><span class="muted">${esc(c.hint)}</span></button>`
    ).join('');
    showModal(`
      <h2>${ev.icon} ${esc(ev.name)}</h2>
      <div class="modal-desc">${esc(ev.desc)}</div>
      <div class="modal-choices">${choices}</div>
    `, 'event');
  }
}

// ----------------------------------------------------------------- topbar

function renderTopbar(): void {
  const el = document.getElementById('topbar-stats')!;
  el.innerHTML = `
    <span class="tstat">💰 <b>${fmt(S.resources.gold)}</b></span>
    <span class="tstat">👥 <b>${S.crewMembers.length}/${crewCapacity(S)}</b></span>
    <span class="tstat">⛵ <b>${S.fleet.length}</b></span>
    <span class="tstat">⚔️ <b>${fmt(S.resources.navalPower)}</b></span>
    <span class="tstat">⭐ <b>${fmt(S.resources.reputation)}</b></span>
    ${S.legend.points > 0 || S.legend.prestiges > 0 ? `<span class="tstat">🌟 <b>${S.legend.points}</b> LP</span>` : ''}
    <span class="tstat ver-stat">v${__APP_VERSION__}</span>
  `;
}

function renderTabs(): void {
  const el = document.getElementById('tabs')!;
  const boss = currentBoss(S);
  const b = computeBonuses(S);
  // Action badges: a pulsing gold marker on every tab where the player can
  // do something useful right now.
  const action = (icon: string) => `<span class="badge action">${icon}</span>`;
  el.innerHTML = TABS.map(t => {
    let badge = '';
    switch (t.id) {
      case 'activities':
        if (!S.activity) badge = '<span class="badge">!</span>';
        break;
      case 'port':
        if (BUILDINGS.some(def => S.resources.gold >= buildingCost(def.id, S.buildings[def.id]))) badge = action('⬆');
        break;
      case 'fleet':
        if (SHIP_TYPES.some(st => canOrderShip(S, st.id, b).ok)) badge = action('⚓');
        break;
      case 'crew':
        if (S.crewMembers.length < crewCapacity(S) && S.resources.gold >= recruitCost(S)) badge = action('+');
        break;
      case 'maps':
        if (MAP_QUALITIES.slice(0, 3).some(q => S.mapsInv[q] >= 4)) badge = action('⇪');
        break;
      case 'bounties':
        if (boss && S.bossCooldown <= 0 && bossWinChance(S, boss) >= 0.55) badge = action('⚔');
        break;
      case 'legend':
        if (canPrestige(S)) badge = '<span class="badge">!</span>';
        else if (LEGEND_UPGRADES.some(u => legendUpgradeLevel(S, u.id) < u.maxLevel && S.legend.points >= legendUpgradeCost(S, u.id))) badge = action('🌟');
        break;
    }
    return `<button class="tab-btn ${activeTab === t.id ? 'active' : ''}" data-action="tab:${t.id}">${t.icon} <span class="tab-label">${t.name}</span>${badge}</button>`;
  }).join('');
}

// ----------------------------------------------------------- activity box

function renderActivityBox(): void {
  const el = document.getElementById('activity-box')!;
  const def = S.activity ? ACTIVITIES.find(a => a.id === S.activity)! : null;
  let progress = '';
  if (S.activity === 'sail') progress = bar(S.voyageProgress / VOYAGE_POINTS, 'Voyage', 'blue');
  else if (S.activity === 'treasureHunt' && totalMaps(S) > 0) progress = bar(S.huntProgress / HUNT_POINTS, 'Digging...', '');
  else if (S.activity === 'raid') progress = bar(S.raidProgress / RAID_POINTS, 'Closing in...', '');
  else if (S.activity === 'explore') {
    const next = ISLANDS.find(i => !S.discoveredIslands.includes(i.id));
    if (next) progress = bar(S.exploreProgress / next.threshold, `Next island: ${fmt(S.exploreProgress)}/${fmt(next.threshold)}`, 'green');
  } else if (S.activity === 'buildShips' && S.buildOrder) {
    progress = bar(S.buildOrder.points / S.buildOrder.needed, `${shipType(S.buildOrder.typeId).name}`, 'blue');
  }

  // Build "Affects" summary: icons for produced/consumed resources + trained skill.
  let affects = '';
  if (def && S.activity) {
    const t = ACTIVITY_TOUCHES[S.activity];
    if (t) {
      const resIcon = (id: string) => RESOURCE_INFO.find(r => r.id === id)?.icon ?? id;
      const upStr   = t.up.map(resIcon).join(' ');
      const downStr = (t.down ?? []).map(resIcon).join(' ');
      const sk = SKILLS.find(s => s.id === t.skill);
      affects = `<div class="act-affects">
        <span class="green-text">↑ ${upStr}</span>${downStr ? ` <span class="red-text">↓ ${downStr}</span>` : ''}${sk ? ` · <span class="muted">${sk.icon} ${sk.name} XP</span>` : ''}
      </div>`;
    }
  }

  el.innerHTML = `
    <div class="flex-between">
      <b class="gold-text">${def ? `${def.icon} ${def.name}` : '😴 Idle'}</b>
      ${def ? '<button class="btn small" data-action="act:stop">Stop</button>' : ''}
    </div>
    ${affects}
    <div class="muted mt8">${activityRates(S)}</div>
    <div class="mt8">${progress}</div>
  `;
}

function renderGoalBox(): void {
  const el = document.getElementById('goal-box');
  if (!el) return;
  const rows = QUEST_TRACKS.map(track => {
    const goal = currentGoal(S, track);
    if (!goal) return `<div class="goal-row done" data-tip="${esc(track.name)} — complete!">${track.icon} <s class="muted">Path complete</s></div>`;
    const prog = goal.progress?.(S);
    const pct = prog ? Math.min(100, (prog.cur / prog.max) * 100).toFixed(0) + '%' : '';
    return `<div class="goal-row" data-tip="${esc(goal.hint)}">${track.icon} ${esc(goal.name)} ${pct ? `<span class="muted">${pct}</span>` : ''}</div>`;
  }).join('');
  el.innerHTML = `<h3>🎯 Goals</h3>${rows}`;
}

function renderLog(): void {
  const el = document.getElementById('event-log')!;
  el.innerHTML = S.log.slice(0, 40).map(l => `<div class="log-entry">${esc(l)}</div>`).join('') ||
    '<div class="muted">Your story begins...</div>';
}

// -------------------------------------------------------------- tab pages

const RESOURCE_INFO: { id: keyof GameState['resources']; name: string; icon: string; desc: string }[] = [
  { id: 'gold', name: 'Gold', icon: '💰', desc: 'The lifeblood of piracy. Buys ships, crew and buildings.' },
  { id: 'crew', name: 'Crew', icon: '👥', desc: 'Able hands aboard your ships.' },
  { id: 'supplies', name: 'Supplies', icon: '🍞', desc: 'Food and gear. Consumed by exploration and shipbuilding.' },
  { id: 'rum', name: 'Rum', icon: '🍺', desc: 'Keeps crew morale high. Crew drink it constantly.' },
  { id: 'maps', name: 'Maps', icon: '🗺️', desc: 'Treasure maps. Consumed by treasure hunting and island discovery.' },
  { id: 'treasure', name: 'Treasure', icon: '💎', desc: 'Hard plunder. Fence it for gold or fund great ships.' },
  { id: 'tradeGoods', name: 'Trade Goods', icon: '📦', desc: 'Generic cargo from raids and trading. Fenced or auto-sold by the Market.' },
  { id: 'reputation', name: 'Reputation', icon: '⭐', desc: 'Your name on the seas. Needed to Become a Legend.' },
  { id: 'influence', name: 'Influence', icon: '🎭', desc: 'Political sway with pirate lords. Needed to Become a Legend.' },
  { id: 'ships', name: 'Ships', icon: '⛵', desc: 'Vessels in your fleet.' },
  { id: 'cursedRelics', name: 'Cursed Fragments', icon: '☠️', desc: 'Strange shards from studies and ghost islands.' },
  { id: 'navalPower', name: 'Naval Power', icon: '⚔️', desc: 'Combined fighting strength of your crewed fleet.' },
  { id: 'knowledge', name: 'Knowledge', icon: '📚', desc: 'Scholarship of the seas. Spent studying relics.' },
];

function goalBoard(): string {
  const rows = QUEST_TRACKS.map(track => {
    const goal = currentGoal(S, track);
    const done = trackIndex(S, track.id);
    if (!goal) {
      return `<div class="goal-card complete">
        <div class="goal-track">${track.icon} ${track.name}</div>
        <div class="green-text">Path complete! (${track.goals.length}/${track.goals.length})</div>
      </div>`;
    }
    const prog = goal.progress?.(S);
    return `<div class="goal-card" data-tip="${esc(goal.hint)}">
      <div class="goal-track">${track.icon} ${track.name} <span class="muted">(${done}/${track.goals.length})</span></div>
      <div class="goal-name">${esc(goal.name)}</div>
      <div class="goal-hint">${esc(goal.hint)}</div>
      ${prog ? bar(Math.min(1, prog.cur / prog.max), `${fmt(prog.cur)} / ${fmt(prog.max)}`, 'green') : ''}
    </div>`;
  }).join('');
  return `
    <div class="panel highlight">
      <h3>🎯 Goals — pick your path <span class="muted">(${completedGoals(S)}/${totalGoals()} complete)</span></h3>
      <div class="muted mb8">Five paths, all open at once. Chase whichever suits your style — each milestone pays a reward.</div>
      <div class="goal-grid">${rows}</div>
    </div>`;
}

function pageOverview(): string {
  const b = computeBonuses(S);
  const ce = crewEfficiency(S, b);
  const next = ISLANDS.find(i => !S.discoveredIslands.includes(i.id));
  const recent = S.log.slice(0, 5).map(l => `<div class="log-entry">${esc(l)}</div>`).join('');
  return `
    <h2>Captain's Overview</h2>
    ${goalBoard()}
    <div class="grid cols2">
      <div class="panel">
        <h3>Treasury</h3>
        <div class="res-row"><span class="res-name">💰 Gold</span><span class="res-val">${fmt(S.resources.gold)}</span></div>
        <div class="res-row"><span class="res-name">💎 Treasure</span><span class="res-val">${fmt(S.resources.treasure)}</span></div>
        <div class="res-row"><span class="res-name">🍞 Supplies</span><span class="res-val">${fmt(S.resources.supplies)}</span></div>
        <div class="res-row"><span class="res-name">🍺 Rum</span><span class="res-val">${fmt(S.resources.rum)}</span></div>
        <div class="res-row"><span class="res-name">🗺️ Maps</span><span class="res-val">${totalMaps(S)}</span></div>
      </div>
      <div class="panel">
        <h3>Fleet &amp; Crew</h3>
        <div class="res-row"><span class="res-name">⛵ Ships</span><span class="res-val">${S.fleet.length}</span></div>
        <div class="res-row"><span class="res-name">⚔️ Naval Power</span><span class="res-val">${fmt(S.resources.navalPower)}</span></div>
        <div class="res-row"><span class="res-name">👥 Crew</span><span class="res-val">${S.crewMembers.length}/${crewCapacity(S)}</span></div>
        <div class="res-row"><span class="res-name">😊 Morale</span><span class="res-val">${averageMorale(S).toFixed(0)}%</span></div>
        <div class="res-row"><span class="res-name">💪 Crew Efficiency</span><span class="res-val">×${ce.toFixed(2)}</span></div>
      </div>
    </div>
    <div class="panel highlight">
      <h3>Current Focus</h3>
      <div class="grid cols4">
        ${ACTIVITIES.slice(0, 12).map(a => `
          <div class="activity-card ${S.activity === a.id ? 'active' : ''}" data-action="act:${a.id}" data-tip="${esc(a.desc)}">
            <div class="act-icon">${a.icon}</div>
            <div class="act-name" style="font-size:12px">${a.name}</div>
          </div>`).join('')}
      </div>
    </div>
    <div class="grid cols2">
      <div class="panel">
        <h3>Exploration</h3>
        ${next
          ? `<div class="muted mb8">Next landfall at ${fmt(next.threshold)} exploration ${next.mapNeed ? `(needs a ${MAP_QUALITY_INFO[next.mapNeed].name} map)` : ''}</div>${bar(S.exploreProgress / next.threshold, `${fmt(S.exploreProgress)} / ${fmt(next.threshold)}`, 'green')}`
          : '<div class="green-text">Every island charted — the map is yours!</div>'}
        <div class="muted mt8">Islands discovered: ${S.discoveredIslands.length}/${ISLANDS.length}</div>
      </div>
      <div class="panel">
        <h3>Recent Happenings</h3>
        ${recent || '<div class="muted">Nothing yet. Set sail!</div>'}
      </div>
    </div>
  `;
}

function pageResources(): string {
  const touches = S.activity ? ACTIVITY_TOUCHES[S.activity] : null;
  const upSet   = new Set(touches?.up ?? []);
  const downSet = new Set(touches?.down ?? []);
  const rates   = computeRates(S);

  const fmtRate = (v: number): string => {
    const a = Math.abs(v);
    const s = a < 0.1 ? a.toFixed(2) : a < 10 ? a.toFixed(1) : fmt(a);
    return `${v >= 0 ? '+' : '-'}${s}/s`;
  };

  return `
    <h2>Resources</h2>
    <div class="panel">
      ${RESOURCE_INFO.map(r => {
        const producing = upSet.has(r.id);
        const consuming = downSet.has(r.id);
        const cls   = producing ? 'producing' : consuming ? 'consuming' : '';
        const badge = producing ? '<span class="res-badge up">↑</span>' : consuming ? '<span class="res-badge dn">↓</span>' : '';
        const rv    = rates[r.id as string];
        const rateEl = rv !== undefined && Math.abs(rv) >= 0.01
          ? `<span class="res-rate${rv < 0 ? ' neg' : ''}">${fmtRate(rv)}</span>`
          : '';
        return `
        <div class="res-row ${cls}" data-tip="${esc(r.desc)}">
          <span class="res-name">${r.icon} ${r.name}${badge}</span>
          <span class="res-val">${fmt(S.resources[r.id])}${rateEl}</span>
        </div>`;
      }).join('')}
    </div>
    <div class="panel">
      <h3>Lifetime Statistics</h3>
      <div class="res-row"><span class="res-name">Total gold earned</span><span class="res-val">${fmt(S.stats.totalGold)}</span></div>
      <div class="res-row"><span class="res-name">Voyages completed</span><span class="res-val">${S.stats.voyages}</span></div>
      <div class="res-row"><span class="res-name">Raids won / lost</span><span class="res-val">${S.stats.raidsWon} / ${S.stats.raidsLost}</span></div>
      <div class="res-row"><span class="res-name">Treasures dug up</span><span class="res-val">${S.stats.treasures}</span></div>
      <div class="res-row"><span class="res-name">Smuggling runs</span><span class="res-val">${S.stats.smuggleRuns}</span></div>
      <div class="res-row"><span class="res-name">Crew recruited</span><span class="res-val">${S.stats.crewRecruited}</span></div>
      <div class="res-row"><span class="res-name">Ships built</span><span class="res-val">${S.stats.shipsBuilt}</span></div>
      <div class="res-row"><span class="res-name">Events faced</span><span class="res-val">${S.stats.eventsResolved}</span></div>
      <div class="res-row"><span class="res-name">Times prestiged</span><span class="res-val">${S.stats.prestiges}</span></div>
      <div class="res-row"><span class="res-name">Time played</span><span class="res-val">${(S.stats.playTime / 3600).toFixed(1)}h</span></div>
    </div>
  `;
}

function pageSkills(): string {
  const activeSkillId = S.activity ? ACTIVITY_TOUCHES[S.activity]?.skill : null;
  return `
    <h2>Skills <span class="muted">(total ${totalSkillLevels(S)} levels)</span></h2>
    <div class="grid cols2">
      ${SKILLS.map(def => {
        const sk = S.skills[def.id];
        const need = xpForLevel(sk.level);
        const mNeed = masteryXpForLevel(sk.mastery);
        const effects = def.effects.map(e => `+${e.perLevel}% ${e.key}/lvl`).join(', ');
        const isActive = def.id === activeSkillId;
        return `
          <div class="skill-card ${isActive ? 'active-skill' : ''}" data-tip="${esc(effects)}"${isActive ? ' title="Currently training"' : ''}>
            <div class="skill-head">
              <span class="skill-name">${def.icon} ${def.name}</span>
              <span class="skill-lvl">Lv ${sk.level}${sk.level >= 99 ? ' (MAX)' : ''}</span>
            </div>
            ${bar(sk.level >= 99 ? 1 : sk.xp / need, sk.level >= 99 ? 'MAX' : `${fmt(sk.xp)} / ${fmt(need)} XP`)}
            <div class="mastery">✨ Mastery ${sk.mastery} — ${bar(sk.masteryXp / mNeed, `${fmt(sk.masteryXp)} / ${fmt(mNeed)}`, 'purple')}</div>
            <div class="skill-desc">${esc(def.desc)}</div>
          </div>`;
      }).join('')}
    </div>
  `;
}

function pageActivities(): string {
  return `
    <h2>Activities</h2>
    <div class="muted mb8">Your crew focuses on one primary activity. Passive systems (port, routes, taverns) keep running regardless.</div>
    <div class="grid cols3">
      ${ACTIVITIES.map(a => {
        const sk = SKILLS.find(s => s.id === a.skill)!;
        return `
          <div class="activity-card ${S.activity === a.id ? 'active' : ''}" data-action="act:${a.id}">
            <div class="act-icon">${a.icon}</div>
            <div class="act-name">${a.name}</div>
            <div class="act-desc">${esc(a.desc)}</div>
            <div class="muted mt8">Trains ${sk.icon} ${sk.name} (Lv ${S.skills[a.skill].level})</div>
          </div>`;
      }).join('')}
    </div>
    ${S.activity ? '<div class="mt8"><button class="btn" data-action="act:stop">⏸️ Stop current activity</button></div>' : ''}
  `;
}

function pageFleet(): string {
  const b = computeBonuses(S);
  const rows = S.fleet.map(sh => {
    const t = shipType(sh.typeId);
    return `<tr>
      <td>${t.icon} <b>${esc(sh.name)}</b></td><td>${t.name}</td>
      <td class="m-hide">${t.capacity}</td><td class="m-hide">${t.speed}</td><td class="m-hide">${t.power}</td><td class="m-hide">${t.cargo}</td>
      <td><button class="btn small danger" data-action="ship:scrap:${sh.id}" data-tip="Scrap for ${fmt(scrapValue(sh.typeId))} gold">Scrap</button></td>
    </tr>`;
  }).join('');

  const order = S.buildOrder ? `
    <div class="panel highlight">
      <h3>🔨 Under Construction: ${shipType(S.buildOrder.typeId).name}</h3>
      ${bar(S.buildOrder.points / S.buildOrder.needed, `${fmt(S.buildOrder.points)} / ${fmt(S.buildOrder.needed)} build points`, 'blue')}
      <div class="muted mt8">Use the Build Ships activity or upgrade the Shipyard to speed this up.</div>
    </div>` : '';

  const shop = SHIP_TYPES.map(t => {
    const cost = discountedCost(t, b);
    const check = canOrderShip(S, t.id, b);
    const locked = S.skills.shipbuilding.level < t.skillReq;
    return `<tr ${locked ? 'style="opacity:.5"' : ''}>
      <td>${t.icon} <b>${t.name}</b></td>
      <td>${fmt(cost.gold)}💰 ${cost.supplies ? `${fmt(cost.supplies)}🍞` : ''} ${cost.treasure ? `${fmt(cost.treasure)}💎` : ''}</td>
      <td class="m-hide">${t.capacity}</td><td class="m-hide">${t.speed}</td><td class="m-hide">${t.power}</td><td class="m-hide">${t.cargo}</td>
      <td>${locked ? `<span class="muted">Shipbuilding ${t.skillReq}</span>`
        : `<button class="btn small ${check.ok ? 'primary' : ''}" data-action="ship:order:${t.id}" ${check.ok ? '' : 'disabled'} data-tip="${esc(check.ok ? `Build time: ${fmt(t.buildPoints)} pts` : check.reason)}">Order</button>`}</td>
    </tr>`;
  }).join('');

  return `
    <h2>Fleet <span class="muted">(speed ×${fleetSpeed(S, b).toFixed(1)}, cargo ${fmt(fleetCargo(S))}, power ${fmt(fleetPower(S, b, crewEfficiency(S, b)))})</span></h2>
    ${order}
    <div class="panel">
      <h3>Your Ships</h3>
      <table class="data-table">
        <tr><th>Name</th><th>Class</th><th class="m-hide">Bunks</th><th class="m-hide">Speed</th><th class="m-hide">Power</th><th class="m-hide">Cargo</th><th></th></tr>
        ${rows}
      </table>
    </div>
    <div class="panel">
      <h3>Shipyard Orders</h3>
      <table class="data-table">
        <tr><th>Class</th><th>Cost</th><th class="m-hide">Bunks</th><th class="m-hide">Speed</th><th class="m-hide">Power</th><th class="m-hide">Cargo</th><th></th></tr>
        ${shop}
      </table>
    </div>
  `;
}

function pageCrew(): string {
  const cap = crewCapacity(S);
  const cost = recruitCost(S);
  const rows = S.crewMembers.map(m => `
    <tr>
      <td><b>${esc(m.name)}</b></td><td>${m.role}</td><td class="m-hide">${m.level}</td>
      <td class="m-hide">${m.combat}</td><td class="m-hide">${m.navigation}</td>
      <td>${m.morale.toFixed(0)}%</td><td class="m-hide">${m.loyalty.toFixed(0)}%</td>
      <td>${canPromote(m)
        ? `<button class="btn small" data-action="crew:promote:${m.id}" ${S.resources.gold >= promotionCost(m) ? '' : 'disabled'} data-tip="Promote for ${fmt(promotionCost(m))} gold (+stats, +loyalty)">⬆ ${fmt(promotionCost(m))}💰</button>`
        : '<span class="muted">Max rank</span>'}</td>
    </tr>`).join('');
  return `
    <h2>Crew <span class="muted">(${S.crewMembers.length}/${cap} bunks)</span></h2>
    <div class="panel flex-between">
      <div>
        <div>Hire a new hand for <b class="gold-text">${fmt(cost)} gold</b></div>
        <div class="muted">Crew drink ~${(S.crewMembers.length * 0.015).toFixed(2)} rum/s. No rum = sour moods.</div>
      </div>
      <button class="btn primary" data-action="crew:hire" ${S.resources.gold >= cost && S.crewMembers.length < cap ? '' : 'disabled'}>👥 Hire</button>
    </div>
    <div class="panel">
      <table class="data-table">
        <tr><th>Name</th><th>Rank</th><th class="m-hide">Lv</th><th class="m-hide">⚔️</th><th class="m-hide">🧭</th><th>Morale</th><th class="m-hide">Loyalty</th><th></th></tr>
        ${rows}
      </table>
    </div>
  `;
}

function pagePort(): string {
  return `
    <h2>Pirate Port <span class="muted">(${totalBuildingLevels(S)} total levels)</span></h2>
    <div class="muted mb8">Buildings give permanent bonuses and passive production. The port grows in the harbor view as you build.</div>
    <div class="grid cols2">
      ${BUILDINGS.map(def => {
        const lvl = S.buildings[def.id];
        const cost = buildingCost(def.id, lvl);
        return `
          <div class="panel">
            <div class="flex-between">
              <b class="gold-text">${def.icon} ${def.name} <span class="muted">Lv ${lvl}</span></b>
              <button class="btn small ${S.resources.gold >= cost ? 'primary' : ''}" data-action="port:up:${def.id}" ${S.resources.gold >= cost ? '' : 'disabled'}>${fmt(cost)}💰</button>
            </div>
            <div class="muted mt8">${esc(def.desc)}</div>
            ${lvl > 0 ? `<div class="green-text mt8">Current: +${(def.bonus.perLevel * lvl)}% ${def.bonus.key}</div>` : ''}
          </div>`;
      }).join('')}
    </div>
  `;
}

function pageMaps(): string {
  return `
    <h2>Map Collection <span class="muted">(${totalMaps(S)} maps, ${S.stats.mapsFound} found all-time)</span></h2>
    <div class="grid cols4">
      ${MAP_QUALITIES.map((q, i) => {
        const info = MAP_QUALITY_INFO[q];
        const canCombine = i < MAP_QUALITIES.length - 1 && S.mapsInv[q] >= 4;
        return `
          <div class="panel" style="text-align:center; border-color:${info.color}">
            <div style="font-size:30px">${info.icon}</div>
            <div style="color:${info.color}; font-weight:bold">${info.name}</div>
            <div style="font-size:22px" class="gold-text">${S.mapsInv[q]}</div>
            ${i < MAP_QUALITIES.length - 1
              ? `<button class="btn small mt8" data-action="maps:combine:${q}" ${canCombine ? '' : 'disabled'} data-tip="Combine 4 ${info.name} maps into 1 ${MAP_QUALITY_INFO[MAP_QUALITIES[i + 1]].name}">Combine 4→1</button>`
              : '<div class="muted mt8">The rarest of all</div>'}
          </div>`;
      }).join('')}
    </div>
    <div class="panel">
      <h3>Where maps come from</h3>
      <div class="muted">
        • <b>Research Maps</b> activity (best source — scales with Cartography)<br>
        • Tavern rumors while managing the tavern<br>
        • Exploration discoveries, events and salvage<br><br>
        Maps are consumed by <b>Treasure Hunts</b> (lowest quality first) and by charting hidden islands. Higher qualities yield far richer treasure.
      </div>
    </div>
    <div class="panel">
      <h3>Charted Islands (${S.discoveredIslands.length}/${ISLANDS.length})</h3>
      <table class="data-table">
        <tr><th>Island</th><th>Type</th><th>Bonus</th></tr>
        ${ISLANDS.map(i => {
          const found = S.discoveredIslands.includes(i.id);
          return `<tr style="${found ? '' : 'opacity:.45'}">
            <td>${found ? `🏝️ <b>${i.name}</b>` : '❓ Uncharted'}</td>
            <td>${found ? i.type : `needs ${fmt(i.threshold)} expl.${i.mapNeed ? ` + ${MAP_QUALITY_INFO[i.mapNeed].name} map` : ''}`}</td>
            <td>${found ? `<span class="green-text">+${i.bonus.value}% ${i.bonus.key}</span>` : '???'}</td>
          </tr>`;
        }).join('')}
      </table>
    </div>
  `;
}

function pageTreasure(): string {
  const b = computeBonuses(S);
  const chance = huntSuccessChance(S, b);
  return `
    <h2>Treasure Hunting</h2>
    <div class="grid cols2">
      <div class="panel highlight">
        <h3>💎 Hoard: ${fmt(S.resources.treasure)} treasure</h3>
        <div class="muted mb8">Fence treasure for ${fmt(25 * b.gold)} gold each.</div>
        <button class="btn" data-action="treasure:fence:10" ${S.resources.treasure >= 1 ? '' : 'disabled'}>Fence 10</button>
        <button class="btn" data-action="treasure:fence:100" ${S.resources.treasure >= 1 ? '' : 'disabled'}>Fence 100</button>
        <button class="btn primary" data-action="treasure:fence:all" ${S.resources.treasure >= 1 ? '' : 'disabled'}>Fence All</button>
      </div>
      <div class="panel">
        <h3>Hunt Odds</h3>
        <div class="res-row"><span class="res-name">Success chance</span><span class="res-val">${(chance * 100).toFixed(0)}%</span></div>
        <div class="res-row"><span class="res-name">Maps ready</span><span class="res-val">${totalMaps(S)}</span></div>
        <div class="res-row"><span class="res-name">Treasures found</span><span class="res-val">${S.stats.treasures}</span></div>
        <div class="muted mt8">Improved by Treasure Hunting &amp; Navigation skills and crew quality. Epic and Legendary maps can uncover <b class="purple-text">relics</b>.</div>
      </div>
    </div>
    <div class="panel">
      <h3>How it works</h3>
      <div class="muted">
        Select the <b>Treasure Hunt</b> activity. Your crew digs at a steady pace; each completed dig consumes your lowest-quality map and rolls for treasure.
        Rewards scale enormously with map quality — combine maps in the Maps tab to chase the big hauls.
      </div>
      ${S.activity !== 'treasureHunt' ? '<button class="btn primary mt8" data-action="act:treasureHunt">⛏️ Start Hunting</button>' : `<div class="mt8">${bar(S.huntProgress / HUNT_POINTS, 'Digging...')}</div>`}
    </div>
  `;
}

function pageTrade(): string {
  const b = computeBonuses(S);
  const routes = tradeRouteCount(S);
  const rows = TRADE_GOODS.map(g => {
    const price = S.prices[g.id];
    const ratio = price / g.basePrice;
    const trend = ratio > 1.25 ? '<span class="green-text">▲ high</span>' : ratio < 0.75 ? '<span class="red-text">▼ low</span>' : '<span class="muted">●</span>';
    const held = S.cargo[g.id] ?? 0;
    return `<tr>
      <td>${g.icon} <b>${g.name}</b></td>
      <td>${fmt(price)} ${trend}</td>
      <td>${fmt(held)}</td>
      <td>
        <button class="btn small" data-action="trade:buy:${g.id}:1">Buy 1</button>
        <button class="btn small" data-action="trade:buy:${g.id}:10">×10</button>
      </td>
      <td>
        <button class="btn small" data-action="trade:sell:${g.id}:10" ${held > 0 ? '' : 'disabled'}>Sell 10</button>
        <button class="btn small" data-action="trade:sell:${g.id}:all" ${held > 0 ? '' : 'disabled'}>All</button>
      </td>
    </tr>`;
  }).join('');
  return `
    <h2>Trading</h2>
    <div class="grid cols2">
      <div class="panel">
        <h3>🚢 Trade Routes: ${routes}</h3>
        <div class="muted">Passive income: <b class="green-text">${fmt(tradeRouteIncome(S, b))} gold/s</b><br>
        +1 route per 8 Trading levels, +1 per discovered Trading Port. Income scales with fleet cargo capacity.</div>
      </div>
      <div class="panel">
        <h3>📦 Cargo Hold: ${fmt(cargoUsed(S))}/${fmt(fleetCargo(S))}</h3>
        <div class="muted mb8">Generic goods: ${fmt(S.resources.tradeGoods)} (worth ~${fmt(3 * b.trade)} each)</div>
        <button class="btn" data-action="trade:fence" ${S.resources.tradeGoods >= 1 ? '' : 'disabled'}>Fence all generic goods</button>
      </div>
    </div>
    <div class="panel">
      <h3>Commodity Exchange <span class="muted">(prices drift — buy low, sell high; selling earns ×${b.trade.toFixed(2)})</span></h3>
      <table class="data-table">
        <tr><th>Good</th><th>Price</th><th>Held</th><th>Buy</th><th>Sell</th></tr>
        ${rows}
      </table>
      <div class="muted mt8">Free cargo space: ${fmt(cargoFree(S))}</div>
    </div>
  `;
}

function pageRelics(): string {
  return `
    <h2>Relic Collection <span class="muted">(${S.relicsOwned.length}/${RELICS.length})</span></h2>
    <div class="muted mb8">Relics come from Epic/Legendary treasure hunts, studying relics, and rare events. Complete sets for powerful extra bonuses.</div>
    ${RELIC_SETS.map(set => {
      const prog = setProgress(S, set.id);
      const complete = prog.owned === prog.total;
      return `
        <div class="panel ${complete ? 'highlight' : ''}">
          <h3>${set.name} (${prog.owned}/${prog.total}) ${complete ? `<span class="green-text">— SET BONUS: +${set.bonus.value}% ${set.bonus.key} ✓</span>` : `<span class="muted">— set bonus: +${set.bonus.value}% ${set.bonus.key}</span>`}</h3>
          <div class="grid cols3">
            ${RELICS.filter(r => r.set === set.id).map(r => {
              const owned = S.relicsOwned.includes(r.id);
              return `
                <div class="relic-card ${owned ? 'owned' : ''}" data-tip="${esc(r.desc)}">
                  <div class="relic-icon">${owned ? r.icon : '❔'}</div>
                  <div class="relic-name">${owned ? r.name : '???'}</div>
                  <div class="relic-bonus">${owned ? `+${r.bonus.value}% ${r.bonus.key}` : 'undiscovered'}</div>
                </div>`;
            }).join('')}
          </div>
        </div>`;
    }).join('')}
  `;
}

function pageAchievements(): string {
  const unlocked = S.achievements.length;
  return `
    <h2>Achievements <span class="muted">(${unlocked}/${ACHIEVEMENTS.length})</span></h2>
    <div class="grid cols3">
      ${ACHIEVEMENTS.map(a => {
        const got = S.achievements.includes(a.id);
        return `
          <div class="ach-card ${got ? 'unlocked' : ''}">
            <div class="ach-name">${got ? '🏆' : '🔒'} ${a.name}</div>
            <div class="ach-desc">${esc(a.desc)}</div>
            <div class="ach-bonus">+${a.bonus.value}% ${a.bonus.key}</div>
          </div>`;
      }).join('')}
    </div>
  `;
}

function pageBounties(): string {
  const active = currentBoss(S);
  const cards = BOSSES.map((boss) => {
    const defeated = S.defeatedBosses.includes(boss.id);
    if (defeated) {
      return `<div class="panel" style="opacity:.75">
        <div class="flex-between">
          <b class="green-text">${boss.icon} ${boss.name} — DEFEATED ✓</b>
          <span class="green-text">+${boss.bonus.value}% ${boss.bonus.key}</span>
        </div>
        <div class="muted mt8">${esc(boss.desc)}</div>
      </div>`;
    }
    if (active && boss.id === active.id) {
      const chance = bossWinChance(S, boss);
      const ready = S.bossCooldown <= 0;
      const color = chance >= 0.6 ? 'green' : chance >= 0.35 ? '' : 'purple';
      return `<div class="panel highlight">
        <h3>${boss.icon} ${boss.name} <span class="muted">— power ${fmt(boss.power)}</span></h3>
        <div class="muted mb8">${esc(boss.desc)}</div>
        <div class="res-row"><span class="res-name">Your naval power</span><span class="res-val">${fmt(S.resources.navalPower)}</span></div>
        <div class="mb8">${bar(chance, `Victory chance: ${(chance * 100).toFixed(0)}%`, color)}</div>
        <div class="res-row"><span class="res-name">Bounty</span><span class="res-val">${fmt(boss.rewardGold)}💰 ${fmt(boss.rewardTreasure)}💎 ${boss.rewardMap ? MAP_QUALITY_INFO[boss.rewardMap].icon : ''} +${boss.bonus.value}% ${boss.bonus.key}</span></div>
        <div class="flex-between mt8">
          <span class="muted">${chance < 0.35 ? 'Too strong for now — grow your fleet, crew and combat skills.' : chance < 0.6 ? 'Winnable, but losses sting. Your call, captain.' : 'The odds favor you. Strike!'}</span>
          <button class="btn ${chance >= 0.5 ? 'primary' : 'danger'}" data-action="boss:fight:${boss.id}" ${ready ? '' : 'disabled'}>
            ${ready ? '⚔️ Attack!' : `⏳ ${Math.ceil(S.bossCooldown)}s`}
          </button>
        </div>
      </div>`;
    }
    return `<div class="panel" style="opacity:.4">
      <b>❓ Unknown Bounty</b>
      <div class="muted mt8">Defeat the bounty above to reveal this foe.</div>
    </div>`;
  }).join('');

  return `
    <h2>☠️ Bounty Board <span class="muted">(${S.defeatedBosses.length}/${BOSSES.length} this life, ${S.stats.bossesDefeated} all-time)</span></h2>
    <div class="muted mb8">Legendary foes in rising order of power — the truest measure of your fleet. Each kill pays a bounty and grants a <b class="green-text">permanent bonus</b> for this life. A failed attack costs morale and maybe a crew member, then 45s to regroup. The ladder resets when you Become a Legend.</div>
    ${cards}
  `;
}

function pageLegend(): string {
  const req = prestigeRequirements(S);
  const pts = legendPointsOnPrestige(S);
  const ready = canPrestige(S);
  return `
    <h2>🌟 Become a Legend</h2>
    <div class="panel ${ready ? 'highlight' : ''}">
      <div class="modal-desc">Retire this life of piracy and let your name pass into legend. Your gold, crew, ships, port and resources are lost — but <b class="purple-text">mastery, achievements, relics and Legend Points endure forever.</b></div>
      <div class="res-row"><span class="res-name">⭐ Reputation</span><span class="res-val">${fmt(S.resources.reputation)} / ${fmt(req.reputation)}</span></div>
      ${bar(Math.min(1, S.resources.reputation / req.reputation), '', '')}
      <div class="res-row mt8"><span class="res-name">🎭 Influence</span><span class="res-val">${fmt(S.resources.influence)} / ${fmt(req.influence)}</span></div>
      ${bar(Math.min(1, S.resources.influence / req.influence), '', 'purple')}
      <div class="flex-between mt8">
        <div>Reward: <b class="gold-text">${ready ? pts : '???'} Legend Points</b> <span class="muted">(prestige #${S.legend.prestiges + 1})</span></div>
        <button class="btn primary" data-action="legend:prestige" ${ready ? '' : 'disabled'}>🌟 Become a Legend</button>
      </div>
    </div>
    <h3>Legend Points: <span class="gold-text">${S.legend.points}</span></h3>
    <div class="grid cols2">
      ${LEGEND_UPGRADES.map(u => {
        const lvl = legendUpgradeLevel(S, u.id);
        const maxed = lvl >= u.maxLevel;
        const cost = legendUpgradeCost(S, u.id);
        return `
          <div class="panel">
            <div class="flex-between">
              <b class="gold-text">${u.name} <span class="muted">${lvl}/${u.maxLevel}</span></b>
              ${maxed ? '<span class="green-text">MAX</span>'
                : `<button class="btn small ${S.legend.points >= cost ? 'primary' : ''}" data-action="legend:buy:${u.id}" ${S.legend.points >= cost ? '' : 'disabled'}>${cost} LP</button>`}
            </div>
            <div class="muted mt8">${esc(u.desc)}</div>
            ${lvl > 0 ? `<div class="green-text">Current: +${u.bonus.perLevel * lvl}% ${u.bonus.key}</div>` : ''}
          </div>`;
      }).join('')}
    </div>
  `;
}

const PAGES: Record<TabId, () => string> = {
  overview: pageOverview, resources: pageResources, skills: pageSkills,
  activities: pageActivities, fleet: pageFleet, crew: pageCrew, port: pagePort,
  maps: pageMaps, treasure: pageTreasure, trade: pageTrade, bounties: pageBounties,
  relics: pageRelics, achievements: pageAchievements, legend: pageLegend,
};

// ------------------------------------------------------------------ actions

function handleAction(action: string): void {
  const parts = action.split(':');
  const b = computeBonuses(S);
  switch (parts[0]) {
    case 'tab':
      activeTab = parts[1] as TabId;
      break;
    case 'act':
      setActivity(S, parts[1] === 'stop' ? null : (parts[1] as ActivityId));
      break;
    case 'ship':
      if (parts[1] === 'order') orderShip(S, parts[2], b);
      else if (parts[1] === 'scrap') scrapShip(S, Number(parts[2]));
      break;
    case 'crew':
      if (parts[1] === 'hire') {
        const cost = recruitCost(S);
        const m = hireCrewMember(S);
        if (m) notify(`👥 ${m.name} signed aboard! (-${fmt(cost)} gold)`);
      } else if (parts[1] === 'promote') promote(S, Number(parts[2]));
      break;
    case 'port':
      if (parts[1] === 'up') upgradeBuilding(S, parts[2] as BuildingId);
      break;
    case 'maps':
      if (parts[1] === 'combine') combineMaps(S, parts[2] as MapQuality);
      break;
    case 'treasure':
      if (parts[1] === 'fence') fenceTreasure(S, parts[2] === 'all' ? Infinity : Number(parts[2]), b);
      break;
    case 'trade':
      if (parts[1] === 'buy') buyGood(S, parts[2], Number(parts[3]));
      else if (parts[1] === 'sell') sellGood(S, parts[2], parts[3] === 'all' ? Infinity : Number(parts[3]), b);
      else if (parts[1] === 'fence') fenceGoods(S, Infinity, b);
      break;
    case 'raid':
      if (parts[1] === 'target') S.raidTarget = Number(parts[2]);
      break;
    case 'boss':
      if (parts[1] === 'fight') challengeBoss(S, parts[2], b);
      break;
    case 'legend':
      if (parts[1] === 'prestige') {
        if (becomeLegend(S)) activeTab = 'overview';
      } else if (parts[1] === 'buy') buyLegendUpgrade(S, parts[2]);
      break;
    case 'event': {
      const outcome = resolveEventChoice(S, Number(parts[2]));
      closeModal();
      if (outcome) {
        showModal(`
          <h2>Outcome</h2>
          <div class="modal-desc">${esc(outcome)}</div>
          <div style="text-align:right"><button class="btn primary" data-action="modal:close">Continue</button></div>
        `, 'outcome');
      }
      break;
    }
    case 'modal':
      closeModal();
      break;
    case 'import': {
      const text = (document.getElementById('import-text') as HTMLTextAreaElement | null)?.value ?? '';
      const loaded = importSave(text);
      if (loaded) {
        closeModal();
        notify('📥 Save imported!');
        onStateReplaced?.(loaded);
      } else {
        notify('Import failed — invalid save string.', 'bad');
      }
      break;
    }
  }
  renderAll();
}

// --------------------------------------------------------------------- init

export function bindState(s: GameState): void {
  S = s;
}

export function initUI(s: GameState, stateReplaced: (next: GameState) => void): void {
  S = s;
  onStateReplaced = stateReplaced;

  document.getElementById('app')!.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (target && !target.hasAttribute('disabled')) handleAction(target.dataset.action!);
  });

  document.getElementById('btn-save')!.addEventListener('click', () => manualSave(S));
  document.getElementById('btn-export')!.addEventListener('click', async () => {
    const text = exportSave(S);
    try {
      await navigator.clipboard.writeText(text);
      notify('📤 Save copied to clipboard!');
    } catch {
      showModal(`
        <h2>📤 Export Save</h2>
        <div class="modal-desc">Copy this string somewhere safe:</div>
        <textarea readonly>${text}</textarea>
        <div style="text-align:right"><button class="btn primary" data-action="modal:close">Done</button></div>
      `, 'import');
    }
  });
  document.getElementById('btn-import')!.addEventListener('click', () => showImportModal());

  renderAll();
}

export function renderAll(): void {
  renderTopbar();
  renderTabs();
  renderActivityBox();
  renderGoalBox();
  renderLog();
  renderEventModal();

  const content = document.getElementById('content')!;
  const scroll = content.scrollTop;
  let html = PAGES[activeTab]();

  // Raid target selector rides along on the Activities page.
  if (activeTab === 'activities') {
    html += `
      <div class="panel mt8">
        <h3>🏴‍☠️ Raid Target</h3>
        <div class="grid cols3">
          ${RAID_TARGETS.map((t, i) => `
            <div class="activity-card ${S.raidTarget === i ? 'active' : ''}" data-action="raid:target:${i}">
              <div class="act-name">${t.name}</div>
              <div class="act-desc">Power ${fmt(t.power)} — ~${fmt(t.gold)}💰, +${t.rep}⭐</div>
            </div>`).join('')}
        </div>
      </div>`;
  }
  content.innerHTML = html;
  content.scrollTop = scroll;
}
