// Factorio-style management UI: side panel with six tabs, topbar, alerts.
// Rendering is innerHTML + event delegation; form widget values live in
// module state so the periodic re-render never eats user input.

import type { GameState, ResourceId, BuildingTypeId, ShipTypeId, TechBranchId, Island } from './types';
import {
  RESOURCES, RES_ICON, RES_NAME, TRAIT_INFO, BUILDINGS, SHIP_TYPES, TECHS,
  buildingDef, shipDef, fmt, fmtRate,
} from './data';
import { islandById, distance } from './world';
import {
  storageCap, crewCap, canBuild, build, canUpgrade, upgrade, upgradeCost, demolish,
  workersNeeded, findBottlenecks, ratePerMin,
} from './production';
import { createRoute, deleteRoute, assignShip, unassignShip, idleShips } from './routes';
import { canBuyShip, buyShip, scrapShip, fleetSummary } from './ships';
import {
  canLaunchExpedition, launchExpedition, canColonize, colonize,
  EXPLORE_COST, COLONIZE_COST, lootableIslands,
} from './expeditions';
import {
  hasMarketplace, sellPrice, buyPrice, sellResource, buyResource,
} from './economy';
import { canResearch, research, techLevel, buildingUnlocked, shipUnlocked, smugglingUnlocked, totalMaps } from './tech';
import { manualSave, exportSave, importSave, wipeAndNew } from './save';
import { notify } from './notify';
import { focusIsland } from './threeScene';

type PanelId = 'island' | 'routes' | 'ships' | 'production' | 'tech' | 'economy';

const PANELS: { id: PanelId; icon: string; tip: string }[] = [
  { id: 'island', icon: '🏝️', tip: 'Islands — build & manage (click an island in the map)' },
  { id: 'routes', icon: '🔁', tip: 'Shipping routes — your conveyor belts' },
  { id: 'ships', icon: '⛵', tip: 'Fleet — buy and assign ships' },
  { id: 'production', icon: '📊', tip: 'Production statistics & bottlenecks' },
  { id: 'tech', icon: '🔬', tip: 'Technology tree' },
  { id: 'economy', icon: '💰', tip: 'Market & economy' },
];

let S: GameState;
let activePanel: PanelId = 'island';
let selectedIslandId: number | null = 1;
let onStateReplaced: (next: GameState) => void = () => {};

// Form state that must survive re-renders.
const form = {
  routeSource: 0,
  routeDest: 0,
  routeRes: 'wood' as ResourceId,
  colonizeSource: 1,
  marketQty: 10,
};

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function getSelectedIsland(): number | null {
  return selectedIslandId;
}

export function selectIsland(id: number | null): void {
  if (id !== null) {
    selectedIslandId = id;
    activePanel = 'island';
    renderAll();
  }
}

function progressBar(frac: number, label: string, color = ''): string {
  const pct = Math.max(0, Math.min(100, frac * 100));
  return `<div class="progress"><div class="fill ${color}" style="width:${pct}%"></div><div class="lbl">${label}</div></div>`;
}

// ------------------------------------------------------------------ topbar

function renderTopbar(): void {
  const el = document.getElementById('topbar-stats')!;
  const goldRate = ratePerMin(S.stats.goldIn) - ratePerMin(S.stats.goldOut);
  const fleet = fleetSummary(S);
  const crew = S.islands.filter(i => i.owned).reduce((sum, i) => sum + i.storage.crew, 0);
  const owned = S.islands.filter(i => i.owned).length;
  el.innerHTML = `
    <span class="tstat">💰 <b>${fmt(S.gold)}</b> <span class="rate ${goldRate >= 0 ? 'good' : 'bad'}">(${fmtRate(goldRate)}/min)</span></span>
    <span class="tstat">🎖️ <b>${fmt(S.influence)}</b></span>
    <span class="tstat">🏝️ <b>${owned}</b>/${S.islands.filter(i => i.discovered).length}</span>
    <span class="tstat">⛵ <b>${fleet.total}</b> <span class="rate muted">(${fleet.idle} idle)</span></span>
    <span class="tstat">👥 <b>${fmt(crew)}</b></span>
    <span class="tstat">🗺️ <b>${fmt(totalMaps(S))}</b></span>
    <span class="tstat muted">⏱️ ${Math.floor(S.time / 60)}m</span>
  `;
  document.querySelectorAll('#speed-controls .btn').forEach(btn => {
    const b = btn as HTMLElement;
    b.classList.toggle('active', b.dataset.action === `speed:${S.speed}`);
  });
}

function renderPanelTabs(): void {
  const el = document.getElementById('panel-tabs')!;
  const bottlenecks = findBottlenecks(S).length;
  el.innerHTML = PANELS.map(p => {
    const badge = p.id === 'production' && bottlenecks > 0 ? `<span class="badge">${bottlenecks}</span>` : '';
    return `<button class="ptab ${activePanel === p.id ? 'active' : ''}" data-action="panel:${p.id}" data-tip="${p.tip}">${p.icon}${badge}</button>`;
  }).join('');
}

let alertsKey = '';

function renderAlerts(): void {
  const el = document.getElementById('alerts')!;
  // Only the last 30 sim-seconds stay in the overlay (full history lives in
  // the Economy panel). Skip the re-render entirely when nothing changed so
  // the slide-in animation doesn't replay every refresh.
  const recent = S.alerts.filter(a => S.time - a.t < 30).slice(0, 5);
  const key = recent.map(a => `${a.t}:${a.text}`).join('|');
  if (key === alertsKey) return;
  alertsKey = key;
  el.innerHTML = recent.map(a =>
    `<div class="alert ${a.kind === 'good' ? 'good' : a.kind === 'warn' ? 'warn' : ''}">${esc(a.text)}</div>`,
  ).join('');
}

// ------------------------------------------------------------ island panel

function islandStorageTable(island: Island): string {
  const cap = storageCap(S, island);
  const rows = RESOURCES.filter(r => island.storage[r.id] >= 0.5 || r.id === 'crew' || r.id === 'food' || r.id === 'wood')
    .map(r => {
      const v = island.storage[r.id];
      const c = r.id === 'crew' ? crewCap(island) : cap;
      const cls = v >= c * 0.95 ? 'warn' : '';
      return `<tr><td>${r.icon} ${r.name}</td><td class="num ${cls}">${fmt(v)}</td><td class="num muted">/${c}</td></tr>`;
    }).join('');
  return `<table class="t"><tr><th>Resource</th><th class="num">Stored</th><th class="num">Cap</th></tr>${rows}</table>`;
}

function buildMenu(island: Island): string {
  const items = BUILDINGS.map(def => {
    const check = canBuild(S, island, def.id);
    const locked = !buildingUnlocked(S, def);
    const cost = Object.entries(def.cost).map(([r, q]) => `${q}${RES_ICON[r as ResourceId]}`).join(' ') +
      (def.costGold ? ` ${def.costGold}💰` : '');
    return `<div class="build-item ${check.ok ? '' : 'disabled'}" data-action="${check.ok ? `build:${def.id}` : ''}"
      data-tip="${esc(def.desc)}${check.ok ? '' : `\n⚠ ${esc(check.reason)}`}">
      <div class="bi-name">${def.icon} ${def.name}${locked ? ' 🔒' : ''}</div>
      <div class="bi-cost">${cost}</div>
    </div>`;
  }).join('');
  return `<div class="build-grid">${items}</div>`;
}

function buildingList(island: Island): string {
  if (island.buildings.length === 0) return '<div class="muted">No buildings yet.</div>';
  return island.buildings.map(b => {
    const def = buildingDef(b.type);
    const recipe = def.recipes[b.recipeIndex];
    const up = canUpgrade(S, island, b);
    const upCost = upgradeCost(b);
    const upCostStr = Object.entries(upCost.cost).map(([r, q]) => `${q}${RES_ICON[r as ResourceId]}`).join(' ') + (upCost.gold ? ` ${upCost.gold}💰` : '');
    const recipeOptions = def.recipes.length > 1
      ? `<div class="row mt4">${def.recipes.map((r, i) => {
          const available = !r.trait || island.traits.includes(r.trait);
          return `<button class="btn small ${i === b.recipeIndex ? 'primary' : ''}" data-action="brecipe:${b.id}:${i}" ${available ? '' : 'disabled'}>${r.name}</button>`;
        }).join('')}</div>`
      : '';
    const statusText = { ok: 'Running', noInput: 'Missing input!', full: 'Storage full!', noCrew: 'No crew!', idle: '' }[b.status];
    return `<div class="card">
      <div class="row">
        <b>${def.icon} ${def.name} <span class="muted">L${b.level}</span></b>
        <span><span class="status-dot ${b.status}"></span><span class="${b.status === 'ok' ? 'good' : b.status === 'idle' ? 'muted' : 'bad'}">${statusText}</span></span>
      </div>
      ${recipe ? `<div class="muted">${recipe.name}: ${Object.entries(recipe.inputs).map(([r, q]) => `${q}${RES_ICON[r as ResourceId]}`).join('+') || '—'} → ${Object.entries(recipe.outputs).map(([r, q]) => `${q}${RES_ICON[r as ResourceId]}`).join('+') || (b.type === 'vault' ? '💰' : b.type === 'academy' ? '🎖️' : '')} every ${recipe.cycle}s (${recipe.workers}👥)</div>` : ''}
      ${recipe ? progressBar(b.progress / recipe.cycle, '', b.status === 'ok' ? 'green' : '') : ''}
      ${recipeOptions}
      <div class="row mt4">
        <button class="btn small ${up.ok ? '' : 'disabled'}" data-action="bupgrade:${b.id}" data-tip="${up.ok ? `Upgrade: ${esc(upCostStr)}` : esc(up.reason)}">⬆ Upgrade</button>
        <button class="btn small danger" data-action="bdemolish:${b.id}">✕</button>
      </div>
    </div>`;
  }).join('');
}

function panelIsland(): string {
  const island = selectedIslandId !== null ? islandById(S, selectedIslandId) : undefined;
  const ownedList = S.islands.filter(i => i.owned);
  const listHtml = `
    <h3>Your Islands</h3>
    <div class="row" style="flex-wrap:wrap; justify-content:flex-start; gap:4px">
      ${ownedList.map(i => `<button class="btn small ${i.id === selectedIslandId ? 'primary' : ''}" data-action="island:select:${i.id}">${i.name}</button>`).join('')}
    </div>`;

  if (!island || !island.discovered) {
    return `<h2>Islands</h2><div class="muted mb8">Click an island on the map to inspect it. Drag to pan, scroll to zoom, right-drag to rotate.</div>${listHtml}`;
  }

  const traits = island.traits.map(t => `<span data-tip="${TRAIT_INFO[t].name}">${TRAIT_INFO[t].icon}</span>`).join(' ');

  if (!island.owned) {
    const sources = ownedList.filter(i => i.buildings.some(b => b.type === 'dock'));
    const check = canColonize(S, form.colonizeSource, island.id);
    const dist = sources.length ? Math.round(distance(islandById(S, form.colonizeSource) ?? sources[0], island)) : 0;
    return `
      <h2>${island.name} ${traits}</h2>
      <div class="muted mb8">Unclaimed island. Colonize it to expand your empire.</div>
      <div class="card highlight">
        <h3>Colonize</h3>
        <div class="muted mb8">Costs ${COLONIZE_COST.wood}🪵 ${COLONIZE_COST.stone}🪨 ${COLONIZE_COST.food}🍞 ${COLONIZE_COST.crew}👥 from the source island + one idle ship (~${dist}u away).</div>
        <div class="row">
          <select data-field="colonizeSource">
            ${sources.map(i => `<option value="${i.id}" ${i.id === form.colonizeSource ? 'selected' : ''}>${i.name}</option>`).join('')}
          </select>
          <button class="btn primary ${check.ok ? '' : 'disabled'}" data-action="colonize:${island.id}" data-tip="${check.ok ? 'Send the colony ship!' : esc(check.reason)}">🏴‍☠️ Colonize</button>
        </div>
      </div>
      ${listHtml}`;
  }

  const needed = workersNeeded(island);
  const crewHere = Math.floor(island.storage.crew);
  const expExplore = canLaunchExpedition(S, island.id, 'explore');
  const expLoot = canLaunchExpedition(S, island.id, 'loot');

  return `
    <h2>${island.name} ${traits}</h2>
    <div class="row muted mb8">
      <span>👥 ${crewHere}/${crewCap(island)} crew</span>
      <span class="${crewHere < needed ? 'bad' : 'good'}">${needed} workers needed</span>
    </div>
    ${hasMarketplace(island) ? marketSection(island) : ''}
    <h3>Storage</h3>
    ${islandStorageTable(island)}
    <h3>Buildings (${island.buildings.length})</h3>
    ${buildingList(island)}
    <h3>Construct</h3>
    <div class="muted mb8">Costs are paid from THIS island's storage — ship materials here first.</div>
    ${buildMenu(island)}
    <h3>Expeditions</h3>
    <div class="muted mb8">Cost: ${EXPLORE_COST.crew}👥 ${EXPLORE_COST.food}🍞 ${EXPLORE_COST.rum}🍺 + an idle ship.</div>
    <div class="row">
      <button class="btn ${expExplore.ok ? '' : 'disabled'}" data-action="exp:explore" data-tip="${expExplore.ok ? 'Chart the nearest unknown island' : esc(expExplore.reason)}">🔭 Explore</button>
      <button class="btn ${expLoot.ok ? '' : 'disabled'}" data-action="exp:loot" data-tip="${expLoot.ok ? `Loot ruins/treasure sites (${lootableIslands(S).length} known)` : esc(expLoot.reason)}">💎 Loot Expedition</button>
    </div>
    ${S.expeditions.length ? `<div class="mt8">${S.expeditions.map(e => {
      const t = islandById(S, e.targetId);
      return `<div class="muted">⛵ ${e.kind} → ${t?.discovered || e.kind !== 'explore' ? t?.name : '???'} — ${Math.ceil(e.timeLeft)}s</div>`;
    }).join('')}</div>` : ''}
    ${listHtml}`;
}

function marketSection(island: Island): string {
  const tradables = RESOURCES.filter(r => r.id !== 'crew');
  const rows = tradables.map(r => {
    const stored = Math.floor(island.storage[r.id]);
    const canSmuggle = smugglingUnlocked(S) && (r.id === 'rum' || r.id === 'weapons');
    return `<tr>
      <td>${r.icon} ${r.name}</td>
      <td class="num">${stored}</td>
      <td class="num good">${fmt(sellPrice(S, r.id))}</td>
      <td class="num bad">${fmt(buyPrice(S, r.id))}</td>
      <td>
        <button class="btn small" data-action="market:sell:${r.id}" ${stored > 0 ? '' : 'disabled'}>Sell</button>
        <button class="btn small" data-action="market:buy:${r.id}">Buy</button>
        ${canSmuggle ? `<button class="btn small danger ${stored > 0 ? '' : 'disabled'}" data-action="market:smuggle:${r.id}" data-tip="${stored > 0 ? 'Sell at 2× price — risk of navy fines' : `No ${r.name} stored here to smuggle`}">🌑</button>` : ''}
      </td>
    </tr>`;
  }).join('');
  return `
    <div class="card highlight">
      <h3 style="margin-top:0">⚖️ Marketplace ${S.marketCrash > 0 ? `<span class="bad">(CRASH ${Math.ceil(S.marketCrash)}s)</span>` : ''}</h3>
      <div class="row mb8">
        <span class="muted">Trade quantity:</span>
        <input type="number" data-field="marketQty" value="${form.marketQty}" min="1" max="999" style="width:70px">
      </div>
      <table class="t"><tr><th>Good</th><th class="num">Here</th><th class="num">Sell</th><th class="num">Buy</th><th></th></tr>${rows}</table>
    </div>`;
}

// ------------------------------------------------------------ routes panel

function panelRoutes(): string {
  const owned = S.islands.filter(i => i.owned && i.buildings.some(b => b.type === 'dock'));
  if (form.routeSource === 0 && owned.length) form.routeSource = owned[0].id;
  if (form.routeDest === 0 && owned.length > 1) form.routeDest = owned[1].id;

  const idle = idleShips(S);
  const tradables = RESOURCES.filter(r => r.id !== 'crew' || true); // crew can be shipped too!

  const list = S.routes.map(r => {
    const src = islandById(S, r.sourceId);
    const dst = islandById(S, r.destId);
    const srcStock = src ? Math.floor(src.storage[r.resource]) : 0;
    const starving = srcStock < 5 && r.perMin < 1;
    return `<div class="card">
      <div class="row">
        <b>${src?.name} → ${dst?.name}</b>
        <button class="btn small danger" data-action="route:delete:${r.id}">✕</button>
      </div>
      <div class="row muted">
        <span>${RES_ICON[r.resource]} ${RES_NAME[r.resource]}</span>
        <span>${r.shipIds.length} ship${r.shipIds.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="row">
        <span class="${r.perMin > 0 ? 'good' : 'muted'}">${fmt(r.perMin)}/min delivered</span>
        <span class="${r.utilization > 0.85 ? 'good' : r.utilization > 0.4 ? 'warn' : 'bad'}" data-tip="Average ship fill — low means the source can't keep up or you have too many ships">${Math.round(r.utilization * 100)}% full</span>
      </div>
      ${starving ? `<div class="bad">⚠ Source has only ${srcStock} ${RES_NAME[r.resource]} — production can't keep up</div>` : ''}
      <div class="row mt4">
        <button class="btn small ${idle.length ? '' : 'disabled'}" data-action="route:addship:${r.id}" data-tip="${idle.length ? `Assign ${idle[0].name}` : 'No idle ships — buy one or recall a ship'}">+ Ship</button>
        <button class="btn small" data-action="route:removeship:${r.id}" ${r.shipIds.length ? '' : 'disabled'}>− Ship</button>
      </div>
    </div>`;
  }).join('');

  return `
    <h2>Shipping Routes</h2>
    <div class="muted mb8">Routes are your conveyor belts: each moves ONE resource from source to destination with its assigned ships.</div>
    <div class="card highlight">
      <h3 style="margin-top:0">New Route</h3>
      <div class="row mb8">
        <select data-field="routeSource" style="flex:1">
          ${owned.map(i => `<option value="${i.id}" ${i.id === form.routeSource ? 'selected' : ''}>${i.name}</option>`).join('')}
        </select>
        →
        <select data-field="routeDest" style="flex:1">
          ${owned.map(i => `<option value="${i.id}" ${i.id === form.routeDest ? 'selected' : ''}>${i.name}</option>`).join('')}
        </select>
      </div>
      <div class="row">
        <select data-field="routeRes" style="flex:1">
          ${tradables.map(r => `<option value="${r.id}" ${r.id === form.routeRes ? 'selected' : ''}>${r.icon} ${r.name}</option>`).join('')}
        </select>
        <button class="btn primary ${owned.length >= 2 ? '' : 'disabled'}" data-action="route:create" data-tip="${owned.length >= 2 ? 'Create the route, then assign ships' : 'You need two owned islands with docks'}">Create</button>
      </div>
    </div>
    ${list || '<div class="muted">No routes yet. Colonize a second island, then connect them!</div>'}`;
}

// ------------------------------------------------------------- ships panel

function panelShips(): string {
  const fleet = fleetSummary(S);
  const island = selectedIslandId !== null ? islandById(S, selectedIslandId) : undefined;
  const yardIsland = island?.owned && island.buildings.some(b => b.type === 'shipyard')
    ? island
    : S.islands.find(i => i.owned && i.buildings.some(b => b.type === 'shipyard'));

  const shipRows = S.ships.map(sh => {
    const def = shipDef(sh.type);
    let status = 'Idle';
    if (sh.state === 'route') {
      const r = S.routes.find(x => x.id === sh.routeId);
      const src = r ? islandById(S, r.sourceId)?.name : '?';
      const dst = r ? islandById(S, r.destId)?.name : '?';
      status = `${src}→${dst} (${sh.cargo}/${def.capacity})`;
    } else if (sh.state === 'expedition') status = 'Expedition';
    else if (sh.state === 'colonize') status = 'Colonizing';
    return `<tr>
      <td>${def.icon} ${sh.name}</td>
      <td class="muted">${status}</td>
      <td class="num ${sh.condition < 50 ? 'bad' : ''}">${Math.round(sh.condition)}%</td>
      <td>${sh.state === 'route' ? `<button class="btn small" data-action="ship:unassign:${sh.id}">Recall</button>` : ''}
          ${sh.state === 'idle' ? `<button class="btn small danger" data-action="ship:scrap:${sh.id}" data-tip="Scrap for 30% refund">✕</button>` : ''}</td>
    </tr>`;
  }).join('');

  const buyRows = SHIP_TYPES.map(t => {
    const unlocked = shipUnlocked(S, t);
    const check = yardIsland ? canBuyShip(S, yardIsland, t.id) : { ok: false, reason: 'Build a Shipyard first' };
    return `<tr ${unlocked ? '' : 'style="opacity:.45"'}>
      <td>${t.icon} <b>${t.name}</b></td>
      <td class="num">${t.capacity}</td>
      <td class="num">${t.speed}</td>
      <td class="num">${t.maintenance}/m</td>
      <td class="num">${t.crewReq}</td>
      <td class="muted">${t.costGold}💰 ${t.costParts}⚙️${t.costCannons ? ` ${t.costCannons}💣` : ''}</td>
      <td><button class="btn small ${check.ok ? 'primary' : 'disabled'}" data-action="ship:buy:${t.id}" data-tip="${check.ok ? `Build at ${yardIsland!.name}` : esc(check.reason)}">Build</button></td>
    </tr>`;
  }).join('');

  return `
    <h2>Fleet</h2>
    <div class="row mb8">
      <span>Total: <b class="accent">${fleet.total}</b></span>
      <span class="muted">${fleet.idle} idle · ${fleet.onRoutes} on routes · ${fleet.expeditions} away</span>
    </div>
    <div class="row mb8"><span class="muted">Maintenance</span><span class="bad">−${fmt(fleet.maintenance)} gold/min</span></div>
    <table class="t"><tr><th>Ship</th><th>Status</th><th class="num">Hull</th><th></th></tr>${shipRows}</table>
    <h3>Shipyard ${yardIsland ? `<span class="muted">(${yardIsland.name})</span>` : '<span class="bad">— none built</span>'}</h3>
    <table class="t">
      <tr><th>Class</th><th class="num">Cap</th><th class="num">Spd</th><th class="num">Upkeep</th><th class="num">Crew</th><th>Cost</th><th></th></tr>
      ${buyRows}
    </table>
    <div class="muted mt4">Ship parts ⚙️, cannons 💣 and crew 👥 must be stocked at the shipyard island.</div>`;
}

// -------------------------------------------------------- production panel

function panelProduction(): string {
  const interesting = RESOURCES.filter(r => {
    const p = ratePerMin(S.stats.prod[r.id]);
    const c = ratePerMin(S.stats.cons[r.id]);
    const stored = S.islands.filter(i => i.owned).reduce((sum, i) => sum + i.storage[r.id], 0);
    return p > 0 || c > 0 || stored > 0;
  });

  const rows = interesting.map(r => {
    const p = ratePerMin(S.stats.prod[r.id]);
    const c = ratePerMin(S.stats.cons[r.id]);
    const net = p - c;
    const stored = S.islands.filter(i => i.owned).reduce((sum, i) => sum + i.storage[r.id], 0);
    return `<tr>
      <td>${r.icon} ${r.name}</td>
      <td class="num good">${fmt(p)}</td>
      <td class="num bad">${fmt(c)}</td>
      <td class="num ${net >= 0 ? 'good' : 'bad'}"><b>${fmtRate(net)}</b></td>
      <td class="num">${fmt(stored)}</td>
    </tr>`;
  }).join('');

  const bottlenecks = findBottlenecks(S);
  const bnHtml = bottlenecks.length === 0
    ? '<div class="good">✓ No stalled buildings — the machine hums.</div>'
    : bottlenecks.map(b => `
      <div class="card">
        <div class="row">
          <b>${b.icon} ${b.building}</b>
          <button class="btn small" data-action="island:select:${b.islandId}">${b.islandName} →</button>
        </div>
        <div class="${b.status === 'full' ? 'warn' : 'bad'}">${b.status === 'noInput' ? '⛔' : b.status === 'full' ? '📦' : '👥'} ${esc(b.detail)}</div>
      </div>`).join('');

  return `
    <h2>Production <span class="muted">(per minute)</span></h2>
    <table class="t">
      <tr><th>Resource</th><th class="num">Prod</th><th class="num">Cons</th><th class="num">Net</th><th class="num">Stored</th></tr>
      ${rows || '<tr><td colspan="5" class="muted">Build something to see throughput.</td></tr>'}
    </table>
    <h3>Bottlenecks (${bottlenecks.length})</h3>
    <div class="muted mb8">Stalled buildings and why. Fix these and throughput rises.</div>
    ${bnHtml}`;
}

// -------------------------------------------------------------- tech panel

function panelTech(): string {
  const cards = TECHS.map(t => {
    const lvl = techLevel(S, t.id);
    const maxed = lvl >= t.costs.length;
    const check = canResearch(S, t.id);
    const next = maxed ? null : t.costs[lvl];
    return `<div class="card ${check.ok ? 'highlight' : ''}">
      <div class="row">
        <b>${t.icon} ${t.name} <span class="accent">${lvl}/${t.costs.length}</span></b>
        ${maxed ? '<span class="good">MAX</span>' : `
          <button class="btn small ${check.ok ? 'primary' : 'disabled'}" data-action="tech:${t.id}" data-tip="${check.ok ? 'Research!' : esc(check.reason)}">
            ${next!.gold}💰${next!.maps ? ` ${next!.maps}🗺️` : ''}${next!.influence ? ` ${next!.influence}🎖️` : ''}
          </button>`}
      </div>
      ${t.effects.map((e, i) => `<div class="${i < lvl ? 'good' : 'muted'}">${i < lvl ? '✓' : `${i + 1}.`} ${esc(e)}</div>`).join('')}
    </div>`;
  }).join('');
  return `
    <h2>Technology</h2>
    <div class="muted mb8">Research costs gold, maps (from expeditions & cartographers) and influence (from the Naval Academy).</div>
    ${cards}`;
}

// ------------------------------------------------------------ economy panel

function panelEconomy(): string {
  const goldIn = ratePerMin(S.stats.goldIn);
  const goldOut = ratePerMin(S.stats.goldOut);
  const fleet = fleetSummary(S);
  const markets = S.islands.filter(i => i.owned && hasMarketplace(i));

  const priceRows = RESOURCES.filter(r => r.id !== 'crew').map(r => `
    <tr>
      <td>${r.icon} ${r.name}</td>
      <td class="num good">${fmt(sellPrice(S, r.id))}</td>
      <td class="num bad">${fmt(buyPrice(S, r.id))}</td>
    </tr>`).join('');

  return `
    <h2>Economy</h2>
    <div class="card">
      <div class="row"><span>Income</span><span class="good">+${fmt(goldIn)}/min</span></div>
      <div class="row"><span>Expenses</span><span class="bad">−${fmt(goldOut)}/min</span></div>
      <div class="row"><b>Net</b><b class="${goldIn - goldOut >= 0 ? 'good' : 'bad'}">${fmtRate(goldIn - goldOut)}/min</b></div>
      <div class="row muted"><span>of which fleet upkeep</span><span>−${fmt(fleet.maintenance)}/min</span></div>
    </div>
    ${S.gold < fleet.maintenance ? '<div class="card"><span class="bad">⚠ Treasury nearly dry! Unpaid ships rot and slow down. Sell goods at a marketplace.</span></div>' : ''}
    <h3>Market Prices ${S.marketCrash > 0 ? `<span class="bad">CRASH ${Math.ceil(S.marketCrash)}s</span>` : ''}</h3>
    <div class="muted mb8">Trade at islands with a Marketplace (${markets.length ? markets.map(m => m.name).join(', ') : 'none yet — research Trade'}). Select the island to trade.</div>
    <table class="t"><tr><th>Good</th><th class="num">Sell</th><th class="num">Buy</th></tr>${priceRows}</table>
    <h3>Empire Records</h3>
    <div class="row muted"><span>Expeditions completed</span><span>${S.totals.expeditions}</span></div>
    <div class="row muted"><span>Ships built / lost</span><span>${S.totals.shipsBuilt} / ${S.totals.shipsLost}</span></div>
    <div class="row muted"><span>Treasure recovered</span><span>${S.totals.treasureFound}</span></div>
    <h3>Alert History</h3>
    ${S.alerts.slice(0, 12).map(a => `<div class="muted" style="padding:2px 0;border-bottom:1px solid var(--panel-lighter)">${esc(a.text)}</div>`).join('') || '<div class="muted">Quiet seas so far.</div>'}`;
}

const PANEL_FNS: Record<PanelId, () => string> = {
  island: panelIsland, routes: panelRoutes, ships: panelShips,
  production: panelProduction, tech: panelTech, economy: panelEconomy,
};

// ------------------------------------------------------------------ modals

function showModal(html: string): void {
  document.getElementById('modal-root')!.innerHTML = `<div class="overlay"><div class="modal">${html}</div></div>`;
}

function closeModal(): void {
  document.getElementById('modal-root')!.innerHTML = '';
}

// ----------------------------------------------------------------- actions

function handleAction(action: string): void {
  const parts = action.split(':');
  const island = selectedIslandId !== null ? islandById(S, selectedIslandId) : undefined;

  switch (parts[0]) {
    case 'panel': activePanel = parts[1] as PanelId; break;
    case 'speed': S.speed = Number(parts[1]); break;
    case 'island':
      if (parts[1] === 'select') {
        selectedIslandId = Number(parts[2]);
        activePanel = 'island';
        focusIsland(S, selectedIslandId);
      }
      break;
    case 'build': if (island) build(S, island, parts[1] as BuildingTypeId); break;
    case 'bupgrade': if (island) upgrade(S, island, Number(parts[1])); break;
    case 'bdemolish': if (island) demolish(S, island, Number(parts[1])); break;
    case 'brecipe': {
      if (island) {
        const b = island.buildings.find(x => x.id === Number(parts[1]));
        if (b) { b.recipeIndex = Number(parts[2]); b.progress = 0; }
      }
      break;
    }
    case 'route':
      if (parts[1] === 'create') {
        const r = createRoute(S, form.routeSource, form.routeDest, form.routeRes);
        if (r && idleShips(S).length > 0) assignShip(S, r.id, idleShips(S)[0].id);
      } else if (parts[1] === 'delete') deleteRoute(S, Number(parts[2]));
      else if (parts[1] === 'addship') {
        const idle = idleShips(S);
        if (idle.length) assignShip(S, Number(parts[2]), idle[0].id);
      } else if (parts[1] === 'removeship') {
        const route = S.routes.find(r => r.id === Number(parts[2]));
        if (route && route.shipIds.length) unassignShip(S, route.shipIds[route.shipIds.length - 1]);
      }
      break;
    case 'ship':
      if (parts[1] === 'buy') {
        const yard = (island?.owned && island.buildings.some(b => b.type === 'shipyard'))
          ? island
          : S.islands.find(i => i.owned && i.buildings.some(b => b.type === 'shipyard'));
        if (yard) buyShip(S, yard, parts[2] as ShipTypeId);
      } else if (parts[1] === 'scrap') scrapShip(S, Number(parts[2]));
      else if (parts[1] === 'unassign') unassignShip(S, Number(parts[2]));
      break;
    case 'exp':
      if (island) launchExpedition(S, island.id, parts[1] as 'explore' | 'loot');
      break;
    case 'colonize':
      colonize(S, form.colonizeSource, Number(parts[1]));
      break;
    case 'tech':
      research(S, parts[1] as TechBranchId);
      break;
    case 'market': {
      if (!island) break;
      const res = parts[2] as ResourceId;
      if (parts[1] === 'sell') sellResource(S, island, res, form.marketQty);
      else if (parts[1] === 'buy') buyResource(S, island, res, form.marketQty);
      else if (parts[1] === 'smuggle') sellResource(S, island, res, form.marketQty, true);
      break;
    }
    case 'modal': closeModal(); break;
    case 'import': {
      const text = (document.getElementById('import-text') as HTMLTextAreaElement | null)?.value ?? '';
      const next = importSave(text);
      if (next) { closeModal(); notify('📥 Save imported!'); onStateReplaced(next); }
      else notify('Import failed — invalid string.', 'bad');
      break;
    }
    case 'newgame':
      if (parts[1] === 'confirm') {
        closeModal();
        onStateReplaced(wipeAndNew());
        notify('🌊 A fresh archipelago rises from the mist!');
      }
      break;
  }
  renderAll();
}

// -------------------------------------------------------------------- init

export function bindState(s: GameState): void {
  S = s;
  selectedIslandId = 1;
}

/**
 * One global tooltip that follows the cursor. Unlike CSS ::after tooltips it
 * can't be clipped by scroll containers, and it clamps to the viewport.
 * Driven by mousemove so it survives the periodic panel re-renders.
 */
function initTooltip(): void {
  const tip = document.createElement('div');
  tip.id = 'global-tip';
  document.body.appendChild(tip);

  document.addEventListener('mousemove', (e) => {
    const target = (e.target as HTMLElement | null)?.closest?.('[data-tip]') as HTMLElement | null;
    const text = target?.dataset.tip;
    if (!text) { tip.style.display = 'none'; return; }
    tip.textContent = text;
    tip.style.display = 'block';
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    let x = e.clientX + 14;
    let y = e.clientY + 16;
    if (x + w > window.innerWidth - 6) x = e.clientX - w - 10;
    if (y + h > window.innerHeight - 6) y = e.clientY - h - 10;
    tip.style.left = `${Math.max(4, x)}px`;
    tip.style.top = `${Math.max(4, y)}px`;
  });
  document.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
}

export function initUI(s: GameState, stateReplaced: (next: GameState) => void): void {
  S = s;
  onStateReplaced = stateReplaced;
  initTooltip();

  document.getElementById('app')!.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    // .disabled (class) buttons stay hoverable for tooltips but don't act.
    if (t && !t.hasAttribute('disabled') && !t.classList.contains('disabled') && t.dataset.action) {
      handleAction(t.dataset.action);
    }
  });

  // Form fields persist across re-renders via the module-level form object.
  document.getElementById('app')!.addEventListener('change', (e) => {
    const t = e.target as HTMLElement;
    const field = t.dataset.field;
    if (!field) return;
    const value = (t as HTMLInputElement | HTMLSelectElement).value;
    if (field === 'routeSource') form.routeSource = Number(value);
    else if (field === 'routeDest') form.routeDest = Number(value);
    else if (field === 'routeRes') form.routeRes = value as ResourceId;
    else if (field === 'colonizeSource') form.colonizeSource = Number(value);
    else if (field === 'marketQty') form.marketQty = Math.max(1, Number(value) || 1);
    // Release focus so the panel resumes its live refresh (renderAll skips
    // updates while a form control is focused).
    (t as HTMLElement).blur();
  });

  document.getElementById('btn-save')!.addEventListener('click', () => manualSave(S));
  document.getElementById('btn-export')!.addEventListener('click', async () => {
    const text = exportSave(S);
    try {
      await navigator.clipboard.writeText(text);
      notify('📤 Save copied to clipboard!');
    } catch {
      showModal(`<h2>📤 Export</h2><textarea readonly>${text}</textarea>
        <button class="btn primary" data-action="modal:close">Done</button>`);
    }
  });
  document.getElementById('btn-import')!.addEventListener('click', () => {
    showModal(`<h2>📥 Import Save</h2>
      <div class="muted">Paste an exported save string. This replaces the current game.</div>
      <textarea id="import-text"></textarea>
      <div class="row"><button class="btn" data-action="modal:close">Cancel</button>
      <button class="btn primary" data-action="import:confirm">Import</button></div>`);
  });
  document.getElementById('btn-newgame')!.addEventListener('click', () => {
    showModal(`<h2>🔄 New Archipelago</h2>
      <div class="muted mb8">Abandon this world and generate a brand new one? Your current save will be erased.</div>
      <div class="row"><button class="btn" data-action="modal:close">Cancel</button>
      <button class="btn danger" data-action="newgame:confirm">Start Over</button></div>`);
  });

  renderAll();
}

export function renderAll(): void {
  renderTopbar();
  renderPanelTabs();
  renderAlerts();
  const panel = document.getElementById('panel')!;
  // Replacing innerHTML while a <select> is open snaps it shut (and eats
  // half-typed input). Freeze the panel while a form control has focus.
  const active = document.activeElement;
  if (active && panel.contains(active) && (active.tagName === 'SELECT' || active.tagName === 'INPUT')) return;
  const scroll = panel.scrollTop;
  panel.innerHTML = PANEL_FNS[activePanel]();
  panel.scrollTop = scroll;
}
