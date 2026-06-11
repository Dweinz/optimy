// Low-poly 3D archipelago view: animated ocean, islands that grow with
// their buildings, ships sailing routes in real time, route lines, fog of
// war, hover tooltips and click-to-select.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GameState, Island, TraitId } from './types';
import { shipDef, TRAIT_INFO } from './data';
import { shipWorldPos } from './routes';
import { expeditionShipPos } from './expeditions';
import { islandById } from './world';

let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let controls: OrbitControls;
let raycaster: THREE.Raycaster;
let container: HTMLElement;

let ocean: THREE.Mesh;
let oceanGeo: THREE.PlaneGeometry;
let oceanBase: Float32Array;
let selectionRing: THREE.Mesh;
let routeLinesGroup: THREE.Group;
let elapsed = 0;

interface IslandVisual {
  group: THREE.Group;
  hitMesh: THREE.Mesh;
  builtKey: string;
  owned: boolean;
  discovered: boolean;
}

const islandVisuals = new Map<number, IslandVisual>();
const shipMeshes = new Map<number, THREE.Group>();
let routesKey = '';

let onSelectIsland: (id: number | null) => void = () => {};

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, ...opts });
}

// ------------------------------------------------------------ island meshes

const BUILDING_COLORS: Record<string, number> = {
  dock: 0x8a6a4a, warehouse: 0xb09a6a, woodCamp: 0x6a8a4a, mine: 0x777788,
  farm: 0xc9c95a, plantation: 0x7ac95a, smelter: 0xcc6a3a, distillery: 0xa86a8a,
  tavern: 0xd9a05a, shipyard: 0x5a8ac9, fort: 0x999999, marketplace: 0xe8c95a,
  vault: 0xc9a93a, cartographer: 0x5ac9c9, academy: 0x9a5ac9,
};

function buildIslandGroup(island: Island): THREE.Group {
  const g = new THREE.Group();
  const r = 4 + island.size * 3;

  // Base mound: sandy if owned, grey-green if merely discovered.
  const baseColor = island.owned ? 0xd9c08a : 0x8a9a8a;
  const mound = new THREE.Mesh(new THREE.ConeGeometry(r, 2.2 + island.size, 8), mat(baseColor));
  mound.position.y = -0.6;
  g.add(mound);
  const top = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, 1.6, 7), mat(island.owned ? 0x6aa84a : 0x6a8a6a));
  top.position.y = 0.7;
  g.add(top);

  // Trait props
  if (island.traits.includes('forest')) {
    for (let i = 0; i < 5; i++) {
      const tree = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 5), mat(0x2e7d32));
      const a = i * 1.4;
      tree.position.set(Math.cos(a) * r * 0.45, 1.6, Math.sin(a) * r * 0.45);
      g.add(tree);
    }
  }
  if (island.traits.includes('iron') || island.traits.includes('stone') || island.traits.includes('coal')) {
    const color = island.traits.includes('iron') ? 0x9a8a7a : island.traits.includes('coal') ? 0x333333 : 0x888888;
    for (let i = 0; i < 3; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + i * 0.15, 0), mat(color));
      rock.position.set(-r * 0.3 + i * 0.9, 1.2, r * 0.25 - i * 0.5);
      g.add(rock);
    }
  }
  if (island.traits.includes('fertile')) {
    const field = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, 0.18, 6), mat(0xb8d95a));
    field.position.set(r * 0.3, 1.1, -r * 0.3);
    g.add(field);
  }
  if (island.traits.includes('ruins')) {
    for (let i = 0; i < 3; i++) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1 + (i % 2) * 0.5, 5), mat(0xc9c9b0));
      pillar.position.set(-r * 0.35 + i * 0.55, 1.5, -r * 0.35);
      g.add(pillar);
    }
  }
  if (island.traits.includes('treasureSite') && !island.looted) {
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), mat(0xe8c95a, { emissive: 0x6a5a10, emissiveIntensity: 0.5 }));
    chest.position.set(0, 1.4, r * 0.4);
    g.add(chest);
  }

  // Buildings spiral around the island as the colony grows.
  island.buildings.forEach((b, i) => {
    const color = BUILDING_COLORS[b.type] ?? 0xaaaaaa;
    const h = 0.5 + b.level * 0.25;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, h, 0.8), mat(color));
    const a = 0.8 + i * 0.9;
    const rr = r * 0.55 + (i % 2) * 0.7;
    box.position.set(Math.cos(a) * rr, 1.1 + h / 2, Math.sin(a) * rr);
    box.rotation.y = -a;
    g.add(box);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.4, 4), mat(0x8a3a2a));
    roof.position.set(box.position.x, box.position.y + h / 2 + 0.2, box.position.z);
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
  });

  // Dock pier sticking out to sea.
  if (island.buildings.some(b => b.type === 'dock')) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 1), mat(0x6a4a2a));
    pier.position.set(r + 1.2, 0.35, 0);
    g.add(pier);
  }

  g.position.set(island.x, 0, island.z);
  return g;
}

function islandBuiltKey(island: Island): string {
  return island.buildings.map(b => `${b.type}${b.level}`).join(',') + (island.looted ? '|L' : '');
}

function makeShipMesh(typeId: string): THREE.Group {
  const def = shipDef(typeId);
  const size = 0.8 + def.capacity / 70;
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(size * 2, size * 0.45, size * 0.7), mat(0x5a3c22));
  hull.position.y = size * 0.2;
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(size * 0.35, size * 0.7, 4), mat(0x5a3c22));
  bow.rotation.z = -Math.PI / 2;
  bow.position.set(size * 1.15, size * 0.2, 0);
  g.add(bow);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, size * 1.5, 4), mat(0x3a2a18));
  mast.position.y = size;
  g.add(mast);
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.8, size * 0.9), mat(0xe8e0d0, { side: THREE.DoubleSide }));
  sail.position.y = size * 1.05;
  g.add(sail);
  return g;
}

// ------------------------------------------------------------------- init

export function initScene(el: HTMLElement, selectCb: (id: number | null) => void): void {
  container = el;
  onSelectIsland = selectCb;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1a28);
  scene.fog = new THREE.Fog(0x0e1a28, 160, 360);

  camera = new THREE.PerspectiveCamera(55, el.clientWidth / el.clientHeight, 0.5, 800);
  camera.position.set(0, 70, 60);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(el.clientWidth, el.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  el.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 18;
  controls.maxDistance = 260;
  controls.maxPolarAngle = Math.PI * 0.45;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };

  scene.add(new THREE.AmbientLight(0x8aa5c8, 0.6));
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.2);
  sun.position.set(60, 90, 40);
  scene.add(sun);

  oceanGeo = new THREE.PlaneGeometry(700, 700, 56, 56);
  oceanBase = new Float32Array(oceanGeo.attributes.position.array as Float32Array);
  ocean = new THREE.Mesh(oceanGeo, mat(0x1c5d8c, { transparent: true, opacity: 0.94, metalness: 0.2, roughness: 0.65 }));
  ocean.rotation.x = -Math.PI / 2;
  scene.add(ocean);

  selectionRing = new THREE.Mesh(
    new THREE.TorusGeometry(9, 0.28, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0xffc55c }),
  );
  selectionRing.rotation.x = -Math.PI / 2;
  selectionRing.position.y = 0.3;
  selectionRing.visible = false;
  scene.add(selectionRing);

  routeLinesGroup = new THREE.Group();
  scene.add(routeLinesGroup);

  raycaster = new THREE.Raycaster();

  // Click-to-select with drag detection (so panning doesn't select).
  let downPos: { x: number; y: number } | null = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { downPos = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downPos) return;
    const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
    downPos = null;
    if (moved > 6) return;
    const id = pickIsland(e);
    onSelectIsland(id);
  });
  renderer.domElement.addEventListener('pointermove', (e) => updateHover(e));

  window.addEventListener('resize', resize);
  resize();
}

function resize(): void {
  if (!container) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w === 0 || h === 0) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function pointerNdc(e: PointerEvent): THREE.Vector2 {
  const rect = renderer.domElement.getBoundingClientRect();
  return new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1,
  );
}

function pickIsland(e: PointerEvent): number | null {
  raycaster.setFromCamera(pointerNdc(e), camera);
  const hits: THREE.Intersection[] = [];
  for (const v of islandVisuals.values()) {
    hits.push(...raycaster.intersectObject(v.hitMesh, false));
  }
  hits.sort((a, b) => a.distance - b.distance);
  return hits.length > 0 ? (hits[0].object.userData.islandId as number) : null;
}

let hoverState: GameState | null = null;

function updateHover(e: PointerEvent): void {
  const tip = document.getElementById('hover-tip');
  if (!tip || !hoverState) return;
  const id = pickIsland(e);
  if (id === null) { tip.style.display = 'none'; return; }
  const island = islandById(hoverState, id);
  if (!island) { tip.style.display = 'none'; return; }
  const traits = island.traits.map(t => `${TRAIT_INFO[t as TraitId].icon} ${TRAIT_INFO[t as TraitId].name}`).join(', ');
  tip.innerHTML = `<b>${island.name}</b> ${island.owned ? '🏴‍☠️' : island.discovered ? '' : '❓'}<br>
    <span class="muted">${traits || 'Barren'}</span><br>
    <span class="muted">${island.owned ? `${island.buildings.length} buildings, ${Math.floor(island.storage.crew)} crew` : island.discovered ? 'Unclaimed — colonize it!' : ''}</span>`;
  const rect = container.getBoundingClientRect();
  tip.style.display = 'block';
  tip.style.left = `${e.clientX - rect.left + 14}px`;
  tip.style.top = `${e.clientY - rect.top + 10}px`;
}

// ------------------------------------------------------------------ update

function syncIslands(s: GameState): void {
  for (const island of s.islands) {
    if (!island.discovered) {
      const existing = islandVisuals.get(island.id);
      if (existing) { scene.remove(existing.group); islandVisuals.delete(island.id); }
      continue;
    }
    const key = islandBuiltKey(island);
    const existing = islandVisuals.get(island.id);
    if (existing && existing.builtKey === key && existing.owned === island.owned && existing.discovered) continue;

    if (existing) scene.remove(existing.group);
    const group = buildIslandGroup(island);
    scene.add(group);
    const hitMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(5 + island.size * 3.4, 5 + island.size * 3.4, 4, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitMesh.position.set(island.x, 1, island.z);
    hitMesh.userData.islandId = island.id;
    scene.add(hitMesh);
    if (existing) scene.remove(existing.hitMesh);
    islandVisuals.set(island.id, { group, hitMesh, builtKey: key, owned: island.owned, discovered: true });
  }
}

function syncRouteLines(s: GameState): void {
  const key = s.routes.map(r => `${r.id}:${r.sourceId}-${r.destId}`).join('|');
  if (key === routesKey) return;
  routesKey = key;
  routeLinesGroup.clear();
  for (const r of s.routes) {
    const src = islandById(s, r.sourceId);
    const dst = islandById(s, r.destId);
    if (!src || !dst) continue;
    const pts = [new THREE.Vector3(src.x, 0.35, src.z), new THREE.Vector3(dst.x, 0.35, dst.z)];
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({ color: 0xe8a33d, dashSize: 1.6, gapSize: 1.2, transparent: true, opacity: 0.65 }),
    );
    line.computeLineDistances();
    routeLinesGroup.add(line);
  }
}

function syncShips(s: GameState): void {
  const alive = new Set<number>();
  s.ships.forEach((ship, idx) => {
    alive.add(ship.id);
    let mesh = shipMeshes.get(ship.id);
    if (!mesh) {
      mesh = makeShipMesh(ship.type);
      shipMeshes.set(ship.id, mesh);
      scene.add(mesh);
    }
    let pos = shipWorldPos(s, ship);
    if (!pos && (ship.state === 'expedition' || ship.state === 'colonize')) {
      pos = expeditionShipPos(s, ship.id);
    }
    if (!pos) {
      // Idle ships anchor in a row off their home island.
      const home = islandById(s, ship.homeIslandId) ?? s.islands[0];
      const slot = idx % 5;
      pos = { x: home.x + 8 + (slot * 2.4), z: home.z + 6 + (idx % 3) * 2.2 };
    }
    const targetX = pos.x;
    const targetZ = pos.z;
    const dx = targetX - mesh.position.x;
    const dz = targetZ - mesh.position.z;
    if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
      mesh.rotation.y = Math.atan2(-dz, dx);
    }
    mesh.position.set(targetX, Math.sin(elapsed * 1.6 + ship.id) * 0.12, targetZ);
  });
  for (const [id, mesh] of shipMeshes) {
    if (!alive.has(id)) { scene.remove(mesh); shipMeshes.delete(id); }
  }
}

export function updateScene(s: GameState, dt: number, selectedIslandId: number | null): void {
  if (!renderer) return;
  hoverState = s;
  elapsed += dt;

  // Gentle ocean swell.
  const pos = oceanGeo.attributes.position as THREE.BufferAttribute;
  const arr = pos.array as Float32Array;
  for (let i = 0; i < pos.count; i++) {
    const x = oceanBase[i * 3];
    const y = oceanBase[i * 3 + 1];
    arr[i * 3 + 2] = Math.sin(x * 0.08 + elapsed) * Math.cos(y * 0.07 + elapsed * 0.8) * 0.5;
  }
  pos.needsUpdate = true;

  syncIslands(s);
  syncRouteLines(s);
  syncShips(s);

  if (selectedIslandId !== null) {
    const island = islandById(s, selectedIslandId);
    if (island && island.discovered) {
      selectionRing.visible = true;
      selectionRing.position.set(island.x, 0.3, island.z);
      const r = 5.5 + island.size * 3.4;
      selectionRing.scale.setScalar(r / 9);
      (selectionRing.material as THREE.MeshBasicMaterial).color.setHex(island.owned ? 0xffc55c : 0x5aa7e3);
    } else {
      selectionRing.visible = false;
    }
  } else {
    selectionRing.visible = false;
  }

  controls.update();
  renderer.render(scene, camera);
}

/** Pans the camera to an island (used by UI "locate" buttons). */
export function focusIsland(s: GameState, id: number): void {
  const island = islandById(s, id);
  if (!island) return;
  const offset = camera.position.clone().sub(controls.target);
  controls.target.set(island.x, 0, island.z);
  camera.position.copy(controls.target).add(offset);
}
