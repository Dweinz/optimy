// Cozy low-poly pirate harbor built from primitives: animated ocean, island,
// dock, lighthouse, treasure pile, fleet ships, NPC traffic, particles,
// day/night cycle and rain. The scene grows with the player's progress.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GameState } from './types';
import { SHIP_TYPES } from './data';
import { totalBuildingLevels } from './port';

let renderer: THREE.WebGLRenderer;
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let controls: OrbitControls;

let ocean: THREE.Mesh;
let oceanGeo: THREE.PlaneGeometry;
let baseWave: Float32Array;

let sun: THREE.DirectionalLight;
let ambient: THREE.AmbientLight;
let lighthouseLamp: THREE.PointLight;

let fleetGroup: THREE.Group;
let trafficGroup: THREE.Group;
let buildingsGroup: THREE.Group;
let treasureGroup: THREE.Group;
let particles: THREE.Points;
let rain: THREE.Points;
let rainVel: Float32Array;

let dayTime = 0.3;       // 0..1, 0.5 = noon-ish curve below
let weatherTimer = 30;
let raining = false;
let elapsed = 0;

const FLEET_CAP = 14;
const TRAFFIC_CAP = 8;

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, ...opts });
}

/** Enables soft shadows on every mesh in a subtree. */
function shadows<T extends THREE.Object3D>(obj: T): T {
  obj.traverse(o => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return obj;
}

function makeShipMesh(tier: number): THREE.Group {
  const g = new THREE.Group();
  const size = 0.6 + tier * 0.35;
  const hullColor = tier >= 5 ? 0x3a2a3a : 0x5a3c22;

  const hull = new THREE.Mesh(new THREE.BoxGeometry(size * 2, size * 0.5, size * 0.8), mat(hullColor));
  hull.position.y = size * 0.25;
  g.add(hull);

  const bow = new THREE.Mesh(new THREE.ConeGeometry(size * 0.4, size * 0.8, 4), mat(hullColor));
  bow.rotation.z = -Math.PI / 2;
  bow.position.set(size * 1.3, size * 0.25, 0);
  g.add(bow);

  const masts = Math.min(3, 1 + Math.floor(tier / 2));
  for (let i = 0; i < masts; i++) {
    const x = (i - (masts - 1) / 2) * size * 0.8;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, size * 1.6, 5), mat(0x3a2a18));
    mast.position.set(x, size * 1.05, 0);
    g.add(mast);
    const sailColor = tier >= 4 ? 0x222222 : 0xe8d9b5;
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.7, size * 0.9), mat(sailColor, { side: THREE.DoubleSide }));
    sail.position.set(x, size * 1.1, 0);
    g.add(sail);
  }
  // Pirate flag on the tallest mast
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.35, size * 0.2), mat(0x111111, { side: THREE.DoubleSide }));
  flag.position.set(0, size * 1.95, 0);
  g.add(flag);
  return shadows(g);
}

function makeHouse(seed: number): THREE.Group {
  const g = new THREE.Group();
  const colors = [0x8a6d4a, 0x7a5c3a, 0x9a7a52, 0x6a5a40];
  const w = 0.5 + (seed % 3) * 0.15;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, 0.45, w), mat(colors[seed % colors.length]));
  body.position.y = 0.22;
  g.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.85, 0.4, 4), mat(0xa83232));
  roof.position.y = 0.65;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  return shadows(g);
}

function makePalm(): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 1.1, 5), mat(0x6a4a2a));
  trunk.position.y = 0.55;
  g.add(trunk);
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.8, 4), mat(0x2e7d32));
    const a = (i / 5) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.3, 1.15, Math.sin(a) * 0.3);
    leaf.rotation.set(Math.cos(a) * 1.2, 0, Math.sin(a) * -1.2);
    g.add(leaf);
  }
  return g;
}

export function initScene(container: HTMLElement): void {
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a1a2a, 18, 45);

  camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(9, 7, 11);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 6;
  controls.maxDistance = 30;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.target.set(0, 0.5, 0);
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.4;

  // Lights
  ambient = new THREE.AmbientLight(0x88aacc, 0.5);
  scene.add(ambient);
  scene.add(new THREE.HemisphereLight(0x9ec3e8, 0x2a4a66, 0.45));
  sun = new THREE.DirectionalLight(0xffeedd, 1.2);
  sun.position.set(10, 12, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.002;
  scene.add(sun);

  // Ocean
  oceanGeo = new THREE.PlaneGeometry(70, 70, 48, 48);
  baseWave = new Float32Array(oceanGeo.attributes.position.array.length);
  baseWave.set(oceanGeo.attributes.position.array as Float32Array);
  ocean = new THREE.Mesh(oceanGeo, mat(0x1c5d8c, { transparent: true, opacity: 0.92, metalness: 0.25, roughness: 0.6 }));
  ocean.rotation.x = -Math.PI / 2;
  ocean.receiveShadow = true;
  scene.add(ocean);

  // Island
  const island = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.2, 9), mat(0xd9c08a));
  island.position.y = -0.4;
  scene.add(shadows(island));
  const hill = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.2, 8), mat(0x4a8a3a));
  hill.position.set(-0.8, 0.9, -0.6);
  scene.add(shadows(hill));

  const palmPositions: [number, number][] = [[2.2, 1.4], [-2.6, 1.2], [1.4, -2.4], [-1.2, 2.6]];
  for (const [x, z] of palmPositions) {
    const p = makePalm();
    p.position.set(x, 0.45, z);
    scene.add(shadows(p));
  }

  // Dock
  const dock = new THREE.Group();
  const plank = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.9), mat(0x6a4a2a));
  plank.position.set(4.6, 0.35, 1.2);
  dock.add(plank);
  for (let i = 0; i < 4; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 5), mat(0x4a3320));
    post.position.set(3.4 + i * 0.85, 0, 0.8 + (i % 2) * 0.8);
    dock.add(post);
  }
  scene.add(shadows(dock));

  // Lighthouse
  const lh = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 1.8, 8), mat(0xe8e0d0));
  tower.position.y = 1.2;
  lh.add(tower);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.36, 0.4, 8), mat(0xa83232));
  band.position.y = 1.2;
  lh.add(band);
  const lampHouse = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 8), mat(0x333333));
  lampHouse.position.y = 2.25;
  lh.add(lampHouse);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.3, 8), mat(0xa83232));
  cap.position.y = 2.55;
  lh.add(cap);
  lh.position.set(2.6, 0.3, -2.2);
  scene.add(shadows(lh));
  lighthouseLamp = new THREE.PointLight(0xffdd88, 0, 14);
  lighthouseLamp.position.set(2.6, 2.6, -2.2);
  scene.add(lighthouseLamp);

  // Treasure chest on the beach
  const chest = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.35), mat(0x7a4a22));
  box.position.y = 0.15;
  chest.add(box);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.35), mat(0x8a5a2a));
  lid.position.set(0, 0.36, -0.1);
  lid.rotation.x = -0.7;
  chest.add(lid);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.28), mat(0xf0cf5d, { emissive: 0xaa8820, emissiveIntensity: 0.7 }));
  glow.position.y = 0.3;
  chest.add(glow);
  chest.position.set(3.3, 0.32, 2.6);
  chest.rotation.y = -0.6;
  scene.add(shadows(chest));

  treasureGroup = new THREE.Group();
  treasureGroup.position.set(3.3, 0.3, 2.6);
  scene.add(treasureGroup);

  fleetGroup = new THREE.Group();
  scene.add(fleetGroup);
  trafficGroup = new THREE.Group();
  scene.add(trafficGroup);
  buildingsGroup = new THREE.Group();
  scene.add(buildingsGroup);

  // Floating particles (fireflies / sea sparkle)
  const pCount = 120;
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 30;
    pPos[i * 3 + 1] = 0.3 + Math.random() * 3.5;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * 30;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xf0cf5d, size: 0.07, transparent: true, opacity: 0.7 }));
  scene.add(particles);

  // Rain (hidden until weather rolls it)
  const rCount = 400;
  const rPos = new Float32Array(rCount * 3);
  rainVel = new Float32Array(rCount);
  for (let i = 0; i < rCount; i++) {
    rPos[i * 3] = (Math.random() - 0.5) * 36;
    rPos[i * 3 + 1] = Math.random() * 12;
    rPos[i * 3 + 2] = (Math.random() - 0.5) * 36;
    rainVel[i] = 6 + Math.random() * 6;
  }
  const rGeo = new THREE.BufferGeometry();
  rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
  rain = new THREE.Points(rGeo, new THREE.PointsMaterial({ color: 0x99bbdd, size: 0.05, transparent: true, opacity: 0.6 }));
  rain.visible = false;
  scene.add(rain);

  window.addEventListener('resize', () => resize(container));
  resize(container);
}

function resize(container: HTMLElement): void {
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w === 0 || h === 0) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

interface ShipVisual {
  tier: number;
  mesh: THREE.Group;
  radius: number;
  angle: number;
  speed: number;
}

const shipVisuals: ShipVisual[] = [];
const trafficVisuals: ShipVisual[] = [];
let lastBuildingLevels = -1;
let lastTreasureSteps = -1;

function syncFleet(s: GameState): void {
  const wanted: number[] = s.fleet
    .slice(0, FLEET_CAP)
    .map(sh => Math.max(0, SHIP_TYPES.findIndex(t => t.id === sh.typeId)));

  let changed = wanted.length !== shipVisuals.length;
  if (!changed) {
    for (let i = 0; i < wanted.length; i++) {
      if (shipVisuals[i].tier !== wanted[i]) { changed = true; break; }
    }
  }
  if (!changed) return;

  for (const v of shipVisuals) fleetGroup.remove(v.mesh);
  shipVisuals.length = 0;
  wanted.forEach((tier, i) => {
    const mesh = makeShipMesh(tier);
    fleetGroup.add(mesh);
    shipVisuals.push({
      tier, mesh,
      radius: 6.5 + (i % 4) * 1.6,
      angle: (i / wanted.length) * Math.PI * 2,
      speed: 0.1 - tier * 0.008,
    });
  });
}

function syncTraffic(s: GameState): void {
  const count = Math.min(TRAFFIC_CAP, Math.floor(Math.sqrt(Math.max(0, s.resources.reputation) / 50)));
  while (trafficVisuals.length < count) {
    const tier = Math.floor(Math.random() * 3);
    const mesh = makeShipMesh(tier);
    mesh.scale.setScalar(0.8);
    trafficGroup.add(mesh);
    trafficVisuals.push({
      tier, mesh,
      radius: 14 + Math.random() * 8,
      angle: Math.random() * Math.PI * 2,
      speed: 0.05 + Math.random() * 0.05,
    });
  }
  while (trafficVisuals.length > count) {
    const v = trafficVisuals.pop()!;
    trafficGroup.remove(v.mesh);
  }
}

function syncBuildings(s: GameState): void {
  const levels = totalBuildingLevels(s);
  if (levels === lastBuildingLevels) return;
  lastBuildingLevels = levels;
  buildingsGroup.clear();
  const count = Math.min(16, levels);
  for (let i = 0; i < count; i++) {
    const h = makeHouse(i);
    const a = 0.6 + i * 0.5;
    const r = 2.6 + (i % 3) * 0.55;
    h.position.set(Math.cos(a) * r, 0.42 + Math.max(0, 0.9 - r * 0.18), Math.sin(a) * r);
    h.rotation.y = -a;
    h.scale.setScalar(0.8 + (i % 4) * 0.08);
    buildingsGroup.add(h);
  }
}

function syncTreasure(s: GameState): void {
  const steps = Math.min(12, Math.floor(Math.log10(Math.max(1, s.resources.treasure + s.resources.gold / 100)) * 3));
  if (steps === lastTreasureSteps) return;
  lastTreasureSteps = steps;
  treasureGroup.clear();
  for (let i = 0; i < steps * 3; i++) {
    const coin = new THREE.Mesh(
      new THREE.SphereGeometry(0.06 + Math.random() * 0.05, 5, 4),
      mat(0xf0cf5d, { emissive: 0x886611, emissiveIntensity: 0.4 }),
    );
    const a = Math.random() * Math.PI * 2;
    const r = 0.3 + Math.random() * 0.5;
    coin.position.set(Math.cos(a) * r, 0.04 + Math.random() * 0.1 * (steps / 4), Math.sin(a) * r);
    treasureGroup.add(coin);
  }
}

const SKY_NIGHT = new THREE.Color(0x070d1a);
const SKY_DAWN = new THREE.Color(0xcc7755);
const SKY_DAY = new THREE.Color(0x7ec8e3);
const skyColor = new THREE.Color();

function updateDayNight(dt: number): void {
  dayTime = (dayTime + dt / 240) % 1; // full cycle every 4 minutes
  const a = dayTime * Math.PI * 2;
  const sunHeight = Math.sin(a);

  sun.position.set(Math.cos(a) * 14, sunHeight * 14, 6);
  sun.intensity = Math.max(0.05, sunHeight) * (raining ? 0.7 : 1.3);
  ambient.intensity = 0.18 + Math.max(0, sunHeight) * 0.45;

  if (sunHeight > 0.25) skyColor.copy(SKY_DAY);
  else if (sunHeight > -0.05) skyColor.copy(SKY_DAWN).lerp(SKY_DAY, (sunHeight + 0.05) / 0.3);
  else skyColor.copy(SKY_NIGHT).lerp(SKY_DAWN, Math.max(0, (sunHeight + 0.4) / 0.35));
  if (raining) skyColor.multiplyScalar(0.55);

  scene.background = skyColor;
  scene.fog!.color.copy(skyColor);
  lighthouseLamp.intensity = sunHeight < 0.1 ? 2.2 + Math.sin(elapsed * 4) * 0.8 : 0;
  (particles.material as THREE.PointsMaterial).opacity = sunHeight < 0.1 ? 0.85 : 0.35;
}

function updateWeather(dt: number): void {
  weatherTimer -= dt;
  if (weatherTimer <= 0) {
    raining = !raining && Math.random() < 0.4;
    weatherTimer = raining ? 20 + Math.random() * 25 : 40 + Math.random() * 60;
    rain.visible = raining;
  }
  if (raining) {
    const pos = rain.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - rainVel[i] * dt;
      if (y < 0) y = 10 + Math.random() * 2;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }
}

export function updateScene(s: GameState, dt: number): void {
  if (!renderer) return;
  elapsed += dt;

  // Animated water
  const pos = oceanGeo.attributes.position as THREE.BufferAttribute;
  const arr = pos.array as Float32Array;
  const waveScale = raining ? 0.22 : 0.12;
  for (let i = 0; i < pos.count; i++) {
    const x = baseWave[i * 3];
    const y = baseWave[i * 3 + 1];
    arr[i * 3 + 2] = Math.sin(x * 0.5 + elapsed * 1.2) * Math.cos(y * 0.45 + elapsed * 0.9) * waveScale;
  }
  pos.needsUpdate = true;
  oceanGeo.computeVertexNormals();

  syncFleet(s);
  syncTraffic(s);
  syncBuildings(s);
  syncTreasure(s);

  // Sail the ships in lazy circles, bobbing on the swell
  for (const list of [shipVisuals, trafficVisuals]) {
    for (const v of list) {
      v.angle += v.speed * dt;
      const x = Math.cos(v.angle) * v.radius;
      const z = Math.sin(v.angle) * v.radius;
      v.mesh.position.set(x, Math.sin(elapsed * 1.5 + v.radius) * 0.08, z);
      v.mesh.rotation.y = -v.angle;
      v.mesh.rotation.z = Math.sin(elapsed * 1.2 + v.angle) * 0.04;
    }
  }

  // Drifting particles
  const pp = particles.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pp.count; i++) {
    pp.setY(i, pp.getY(i) + Math.sin(elapsed * 0.8 + i) * 0.002);
  }
  pp.needsUpdate = true;

  updateDayNight(dt);
  updateWeather(dt);

  controls.update();
  renderer.render(scene, camera);
}
