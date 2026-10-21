import * as THREE from 'three';
import { mergeStatic } from '../../shared/engine/merge.js';
import { drawIsraeliFlag } from '../../shared/flag.js';
import { canvasTexture, redraw, makeSign, makePoster, tileTexture, wallTexture, drawQueueScreen } from '../../shared/engine/textures.js';

// The reception and screening base in Tel HaShomer (בקו"ם), for "שבוע ראיונות".
// Units are meters; +z points toward the street, so walking into the building means moving toward -z.
//
//   z  64 .. 44   bus stop and the road
//   z  44 .. 22   the base entrance: guard booth, plaza, palms
//   z  20 .. -14  registration and the big waiting hall (x -16 .. 16)
//   z -14 .. -34  corridor (x -4 .. 4) with three interview rooms on each side
//   z 116 .. 124  (far away) the player's bedroom at home

const WALL_H = 4.2;
const T = 0.2;

export const HALL = { x1: -16, x2: 16, z1: -14, z2: 20 };

export const SPOTS = {
  busStop: { x: -10, z: 56 },
  arrive: { x: 0, z: 62 },
  gate: { x: 0, z: 43 },
  door: { x: 0, z: 22.5 },
  desks: [
    { x: -6, z: 13.2 },
    { x: 6, z: 13.2 },
  ],
  screen: { x: 0, z: -13.7 },
  corridor: { x: 0, z: -20 },
  vending: { x: 13.2, z: 3 },
  cooler: { x: -13.4, z: 3 },
  boards: { x: 15.7, z: -7 },
  // Home.
  bed: { x: -2, z: 121 },
  desk: { x: 1.6, z: 121.4 },
  homeDoor: { x: 0, z: 123.6 },
};

// Six interview rooms. West rooms open to the east, east rooms to the west.
const ROOM_Z = [-19, -25, -31];
export const ROOMS = [
  ...ROOM_Z.map((z, i) => ({ id: i + 1, side: 'west', door: { x: -4, z }, chair: { x: -7.4, z }, yaw: Math.PI / 2, table: { x: -8.8, z }, panel: [{ x: -9.95, z: z - 0.95 }, { x: -9.95, z: z + 0.95 }], face: Math.PI / 2 })),
  ...ROOM_Z.map((z, i) => ({ id: i + 4, side: 'east', door: { x: 4, z }, chair: { x: 7.4, z }, yaw: -Math.PI / 2, table: { x: 8.8, z }, panel: [{ x: 9.95, z: z - 0.95 }, { x: 9.95, z: z + 0.95 }], face: -Math.PI / 2 })),
];

export function buildWorld(scene) {
  const colliders = [];
  const blockers = [];
  const updaters = [];

  const M = {
    wall: new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 0.9 }),
    outerWall: new THREE.MeshStandardMaterial({ color: '#d9cfb8', roughness: 0.95 }),
    plain: new THREE.MeshStandardMaterial({ color: '#ece8de', roughness: 0.9 }),
    trim: new THREE.MeshStandardMaterial({ color: '#4a4f45', roughness: 0.6 }),
    metal: new THREE.MeshStandardMaterial({ color: '#9aa0a6', metalness: 0.6, roughness: 0.4 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: '#3d4247', metalness: 0.5, roughness: 0.5 }),
    wood: new THREE.MeshStandardMaterial({ color: '#b48a5a', roughness: 0.7 }),
    desk: new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: 0.6 }),
    chair: new THREE.MeshStandardMaterial({ color: '#2f5d8a', roughness: 0.6 }),
    chairDark: new THREE.MeshStandardMaterial({ color: '#2b2f33', roughness: 0.7 }),
    asphalt: new THREE.MeshStandardMaterial({ color: '#55565a', roughness: 0.95 }),
    paving: new THREE.MeshStandardMaterial({ color: '#b8b0a0', roughness: 0.95 }),
    grass: new THREE.MeshStandardMaterial({ color: '#7d8f4a', roughness: 1 }),
    line: new THREE.MeshStandardMaterial({ color: '#f4f1e6', roughness: 0.8 }),
    white: new THREE.MeshStandardMaterial({ color: '#f5f5f2', roughness: 0.6 }),
    red: new THREE.MeshStandardMaterial({ color: '#b3322a', roughness: 0.7 }),
    olive: new THREE.MeshStandardMaterial({ color: '#5b6236', roughness: 0.85 }),
    glass: new THREE.MeshStandardMaterial({ color: '#cfe8f2', transparent: true, opacity: 0.25, roughness: 0.1, depthWrite: false }),
    trunk: new THREE.MeshStandardMaterial({ color: '#7a6045', roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#4c7a3a', roughness: 0.9, flatShading: true, side: THREE.DoubleSide }),
    light: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4dc', emissiveIntensity: 1.1 }),
    bedcover: new THREE.MeshStandardMaterial({ color: '#4a6a8a', roughness: 0.9 }),
    vending: new THREE.MeshStandardMaterial({ color: '#1f4f8f', roughness: 0.4 }),
    floorHome: new THREE.MeshStandardMaterial({ color: '#c8b08a', roughness: 0.8 }),
  };

  // ---------- Helpers ----------

  function box(x, y, z, sx, sy, sz, material, { collide = true, block = false } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    if (collide) colliders.push({ minX: x - sx / 2, maxX: x + sx / 2, minZ: z - sz / 2, maxZ: z + sz / 2 });
    if (block) blockers.push(mesh);
    return mesh;
  }

  function wallX(z, x1, x2, doors = [], height = WALL_H, material = M.wall) {
    let start = x1;
    for (const door of [...doors].sort((a, b) => a.at - b.at)) {
      const a = door.at - door.width / 2;
      const b = door.at + door.width / 2;
      if (a > start) box((start + a) / 2, height / 2, z, a - start, height, T, material, { block: true });
      box(door.at, (height + 2.3) / 2, z, door.width, height - 2.3, T, material, { collide: false, block: true });
      frame(door.at, z, door.width, 'x');
      start = b;
    }
    if (x2 > start) box((start + x2) / 2, height / 2, z, x2 - start, height, T, material, { block: true });
  }

  function wallZ(x, z1, z2, doors = [], height = WALL_H, material = M.wall) {
    let start = z1;
    for (const door of [...doors].sort((a, b) => a.at - b.at)) {
      const a = door.at - door.width / 2;
      const b = door.at + door.width / 2;
      if (a > start) box(x, height / 2, (start + a) / 2, T, height, a - start, material, { block: true });
      box(x, (height + 2.3) / 2, door.at, T, height - 2.3, door.width, material, { collide: false, block: true });
      frame(x, door.at, door.width, 'z');
      start = b;
    }
    if (z2 > start) box(x, height / 2, (start + z2) / 2, T, height, z2 - start, material, { block: true });
  }

  function frame(x, z, width, axis) {
    const o = { collide: false };
    if (axis === 'x') {
      box(x - width / 2, 1.15, z, 0.08, 2.3, T + 0.06, M.trim, o);
      box(x + width / 2, 1.15, z, 0.08, 2.3, T + 0.06, M.trim, o);
      box(x, 2.32, z, width + 0.16, 0.08, T + 0.06, M.trim, o);
    } else {
      box(x, 1.15, z - width / 2, T + 0.06, 2.3, 0.08, M.trim, o);
      box(x, 1.15, z + width / 2, T + 0.06, 2.3, 0.08, M.trim, o);
      box(x, 2.32, z, T + 0.06, 0.08, width + 0.16, M.trim, o);
    }
  }

  function face(mesh, dir) {
    mesh.rotation.y = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 }[dir];
    return mesh;
  }

  function sign(lines, x, y, z, dir, options) {
    const s = face(makeSign(lines, options), dir);
    s.position.set(x, y, z);
    scene.add(s);
    return s;
  }

  function poster(title, lines, x, y, z, dir, options) {
    const p = face(makePoster(title, lines, options), dir);
    p.position.set(x, y, z);
    scene.add(p);
    return p;
  }

  function floor(x1, x2, z1, z2, material, y = 0.01) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    scene.add(mesh);
    return mesh;
  }

  const ceilingMaterial = new THREE.MeshBasicMaterial({ color: '#cfcac0' });
  function ceiling(x1, x2, z1, z2, lights = true, y = WALL_H) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), ceilingMaterial);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    scene.add(mesh);
    if (!lights) return;
    for (let x = x1 + 3; x < x2 - 1; x += 6) {
      for (let z = z1 + 3; z < z2 - 1; z += 6) box(x, y - 0.03, z, 1.8, 0.05, 0.5, M.light, { collide: false });
    }
  }

  function chair(x, z, yaw, material = M.chair) {
    const group = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.07, 0.46), material);
    seat.position.y = 0.45;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.05), material);
    back.position.set(0, 0.7, -0.22);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.06), M.darkMetal);
    post.position.y = 0.21;
    group.add(seat, back, post);
    group.position.set(x, 0, z);
    group.rotation.y = yaw;
    scene.add(group);
  }

  function desk(x, z, w = 1.6, d = 0.8, rotated = false) {
    const sx = rotated ? d : w;
    const sz = rotated ? w : d;
    box(x, 0.74, z, sx, 0.05, sz, M.desk, { collide: false });
    box(x, 0.36, z, sx - 0.1, 0.7, sz - 0.1, M.trim, { collide: true });
  }

  function palm(x, z, scale = 1) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.24 * scale, 6 * scale, 7), M.trunk);
    trunk.position.set(x, 3 * scale, z);
    trunk.rotation.z = 0.05;
    scene.add(trunk);
    for (let i = 0; i < 9; i++) {
      const frond = new THREE.Mesh(new THREE.PlaneGeometry(0.5 * scale, 3 * scale, 1, 2), M.leaf);
      frond.geometry.translate(0, 1.5 * scale, 0);
      frond.position.set(x, 6 * scale, z);
      frond.rotation.set(1.0, (i / 9) * Math.PI * 2, 0, 'YXZ');
      scene.add(frond);
    }
    colliders.push({ minX: x - 0.35, maxX: x + 0.35, minZ: z - 0.35, maxZ: z + 0.35 });
  }

  // ---------- Ground and the street ----------

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), M.grass);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  floor(-40, 40, 19.9, 52, M.paving, 0.02); // The plaza in front of the building.
  floor(-60, 60, 52, 70, M.asphalt, 0.02); // The road.
  for (let x = -56; x < 56; x += 8) floor(x, x + 4, 60.9, 61.1, M.line, 0.03);
  floor(-14, 14, 44, 52, M.paving, 0.025);

  // Keep the player inside the area.
  colliders.push({ minX: -60, maxX: 60, minZ: 69, maxZ: 70 });
  colliders.push({ minX: -61, maxX: -60, minZ: -40, maxZ: 70 });
  colliders.push({ minX: 60, maxX: 61, minZ: -40, maxZ: 70 });
  colliders.push({ minX: -61, maxX: 61, minZ: -41, maxZ: -40 });

  // Bus stop with a shelter.
  box(SPOTS.busStop.x, 2.4, SPOTS.busStop.z + 0.3, 3.2, 0.08, 1.6, M.glass, { collide: false });
  for (const dx of [-1.5, 1.5]) box(SPOTS.busStop.x + dx, 1.2, SPOTS.busStop.z - 0.4, 0.07, 2.4, 0.07, M.darkMetal, { collide: false });
  box(SPOTS.busStop.x, 0.45, SPOTS.busStop.z - 0.3, 2.6, 0.08, 0.5, M.wood, { collide: false });
  sign(['תחנה', 'תל השומר'], SPOTS.busStop.x + 1.9, 2.0, SPOTS.busStop.z, '+z', { width: 1, height: 0.4, bg: '#1f3b73' });

  // Fence and the guard booth at the entrance.
  for (let x = -40; x <= 40; x += 2) {
    if (Math.abs(x) < 4.2) continue;
    box(x, 1.1, 44, 0.06, 2.2, 0.06, M.darkMetal, { collide: false });
  }
  box(-22, 1.9, 44, 36, 0.05, 0.05, M.darkMetal, { collide: false });
  box(22, 1.9, 44, 36, 0.05, 0.05, M.darkMetal, { collide: false });
  box(-22, 1.1, 44, 36, 0.05, 0.05, M.darkMetal, { collide: false });
  box(22, 1.1, 44, 36, 0.05, 0.05, M.darkMetal, { collide: false });
  colliders.push({ minX: -40, maxX: -4, minZ: 43.9, maxZ: 44.1 });
  colliders.push({ minX: 4, maxX: 40, minZ: 43.9, maxZ: 44.1 });
  box(5.6, 1.5, 42, 2.2, 3, 2.2, M.plain, { block: true });
  box(5.6, 3.05, 42, 2.8, 0.15, 2.8, M.darkMetal, { collide: false });
  box(4.5, 1.7, 42, 0.05, 1.0, 1.6, M.glass, { collide: false });
  sign(['בקו״ם', 'בסיס קליטה ומיון · תל השומר'], 0, 4.4, 44, '+z', { width: 5.6, height: 0.9, bg: '#2f3a20' });
  box(-2.1, 3.2, 44, 0.3, 6.4, 0.3, M.darkMetal, { collide: false });
  box(2.1, 3.2, 44, 0.3, 6.4, 0.3, M.darkMetal, { collide: false });
  box(0, 6.2, 44, 4.5, 0.3, 0.3, M.darkMetal, { collide: false });
  // Barrier arm, raised.
  const arm = box(-2.2, 1.0, 43.3, 0.08, 0.08, 4.0, M.red, { collide: false });
  arm.rotation.z = 0;

  // Flag, palms and benches.
  box(-12, 4.5, 38, 0.1, 9, 0.1, M.metal, { collide: false });
  const flagGeometry = new THREE.PlaneGeometry(2.2, 1.6, 14, 7);
  flagGeometry.translate(1.1, 0, 0);
  const flag = new THREE.Mesh(flagGeometry, new THREE.MeshStandardMaterial({ map: canvasTexture(330, 240, drawIsraeliFlag), side: THREE.DoubleSide }));
  flag.userData.dynamic = true;
  flag.position.set(-11.95, 8.1, 38);
  scene.add(flag);
  const rest = flagGeometry.attributes.position.array.slice();
  updaters.push((t) => {
    const p = flagGeometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(rest[i * 3] * 2.4 - t * 3) * 0.17 * (rest[i * 3] / 2.2));
    p.needsUpdate = true;
    flagGeometry.computeVertexNormals();
  });
  for (const [x, z, s] of [[-18, 40, 1], [-8, 33, 0.9], [8, 33, 1.1], [18, 40, 1], [-24, 28, 1], [24, 28, 0.95]]) palm(x, z, s);
  for (const x of [-15, 15]) {
    box(x, 0.45, 30, 2, 0.1, 0.5, M.wood, { collide: false });
    box(x - 0.8, 0.22, 30, 0.1, 0.44, 0.45, M.darkMetal, { collide: false });
    box(x + 0.8, 0.22, 30, 0.1, 0.44, 0.45, M.darkMetal, { collide: false });
    colliders.push({ minX: x - 1, maxX: x + 1, minZ: 29.7, maxZ: 30.3 });
  }

  // ---------- The building: facade and hall ----------

  const { x1, x2, z1, z2 } = HALL;
  // Facade (z = 20) with a wide entrance, and a big sign above it.
  wallX(z2, x1, x2, [{ at: 0, width: 3.6 }], WALL_H + 1.2, M.outerWall);
  sign(['קבלת פנים · שבוע ראיונות', 'ברוכים הבאים · רישום בכניסה'], 0, WALL_H + 0.35, z2 + 0.12, '+z', { width: 6, height: 0.9, bg: '#1f3b73' });
  box(0, WALL_H + 0.8, z2 + 1.5, 12, 0.2, 3, M.darkMetal, { collide: false }); // Canopy.
  // Side and back walls.
  wallZ(x1, z1, z2, [], WALL_H, M.wall);
  wallZ(x2, z1, z2, [], WALL_H, M.wall);
  wallX(z1, x1, x2, [{ at: 0, width: 3.2 }], WALL_H, M.wall);
  floor(x1, x2, z1, z2, new THREE.MeshStandardMaterial({ map: tileTexture('#bdb9b0', '#9d988d', 16, 17), roughness: 0.7 }), 0.03);
  ceiling(x1, x2, z1, z2, true);

  // Windows and a darker base on the facade.
  const windowGlass = new THREE.MeshStandardMaterial({ color: '#2c4a63', metalness: 0.5, roughness: 0.25 });
  for (const x of [-13.5, -10, -6.5, 6.5, 10, 13.5]) {
    box(x, 2.5, z2 + 0.12, 2.2, 1.7, 0.05, windowGlass, { collide: false });
    box(x, 1.55, z2 + 0.14, 2.4, 0.08, 0.1, M.trim, { collide: false });
  }
  for (const x of [-15.9, -3.2, 3.2, 15.9]) box(x, 2.6, z2 + 0.2, 0.5, WALL_H + 1, 0.4, M.metal, { collide: false });
  box(0, 0.45, z2 + 0.12, 32, 0.9, 0.06, M.trim, { collide: false });

  // Windows on the side walls.
  for (const z of [-4, 8]) {
    for (const x of [x1 + 0.12, x2 - 0.12]) box(x, 2.2, z, 0.04, 1.4, 3, M.glass, { collide: false });
  }

  // Registration desks near the door.
  SPOTS.desks.forEach((d, i) => {
    desk(d.x, d.z, 2.8, 0.9);
    box(d.x, 1.0, d.z - 0.2, 0.55, 0.34, 0.04, new THREE.MeshStandardMaterial({ color: '#1b2a3a', emissive: '#4a7fb5', emissiveIntensity: 0.6 }), { collide: false });
    sign(['רישום', `שולחן ${i + 1}`], d.x, 2.6, d.z + 0.1, '+z', { width: 1.5, height: 0.45, bg: '#2f3a20' });
  });

  // Rows of chairs facing the screen.
  const seatList = [];
  const rows = [3.4, 1.9, 0.4, -1.1, -2.6, -4.1];
  rows.forEach((rowZ) => {
    for (const block of [-1, 1]) {
      for (let k = 0; k < 7; k++) {
        const x = block * (3.4 + k * 0.62);
        chair(x, rowZ, Math.PI);
        seatList.push({ x, z: rowZ, taken: false, row: rowZ, block });
      }
    }
  });
  // A few low tables with candidates' water and books.
  for (const x of [-13, 13]) box(x, 0.3, -9, 0.9, 0.6, 0.9, M.wood, { collide: true });

  // Screen with the called numbers (above the corridor door).
  const screenCanvas = canvasTexture(1024, 576, (ctx, w, h) => drawQueueScreen(ctx, w, h, { called: [], waiting: [], highlight: null }));
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3.15), new THREE.MeshBasicMaterial({ map: screenCanvas, toneMapped: false }));
  screenMesh.userData.dynamic = true;
  screenMesh.position.set(0, 2.65, z1 + 0.14);
  screenMesh.rotation.y = 0;
  scene.add(screenMesh);
  const setCalled = (called, waiting, highlight) =>
    redraw(screenCanvas, (ctx, w, h) => drawQueueScreen(ctx, w, h, { called, waiting, highlight }));

  // Vending machine and water cooler.
  box(SPOTS.vending.x, 1.0, SPOTS.vending.z, 1.0, 2.0, 0.8, M.vending, { block: true });
  box(SPOTS.vending.x - 0.52, 1.2, SPOTS.vending.z, 0.04, 1.2, 0.6, M.glass, { collide: false });
  box(SPOTS.cooler.x, 0.55, SPOTS.cooler.z, 0.45, 1.1, 0.45, M.white, { block: true });
  box(SPOTS.cooler.x, 1.3, SPOTS.cooler.z, 0.32, 0.4, 0.32, M.glass, { collide: false });

  // Notice boards with the units' posters (read them with the action key).
  const POSTERS = [
    { id: 'paratroopers', title: 'צנחנים', color: '#8a1f1f' },
    { id: 'recon', title: 'סיירות חי״ר', color: '#5b6236' },
    { id: 'yahalom', title: 'יהל״ם', color: '#4b5a6a' },
    { id: 'oketz', title: 'עוקץ', color: '#3a3a3a' },
    { id: 'lotar', title: 'לוטר', color: '#2f4b6e' },
  ];
  const posterSpots = [];
  POSTERS.forEach((p, i) => {
    const z = -2 - i * 2.3;
    poster(p.title, ['יחידה שמגיעה לשבוע ראיונות', 'ראיונות בבקו״ם', 'לקריאה: מקש E'], x2 - 0.15, 1.8, z, '-x', { color: p.color, width: 0.9, height: 1.2 });
    posterSpots.push({ ...p, x: x2 - 1.0, z });
  });
  box(x2 - 0.1, 1.8, -7, 0.06, 1.5, 11.6, M.wood, { collide: false });
  sign('לוח ראיונות', x2 - 0.2, 3.0, -7, '-x', { width: 2.2, height: 0.5, bg: '#1f3b73' });

  // Plants and bins.
  for (const [x, z] of [[-14.2, 18.2], [14.2, 18.2], [-14.2, -12.2], [14.2, -12.2]]) {
    box(x, 0.3, z, 0.5, 0.6, 0.5, M.trim, { collide: true });
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), M.leaf);
    bush.position.set(x, 0.95, z);
    scene.add(bush);
  }

  // ---------- Corridor and interview rooms ----------

  const cz1 = -34;
  floor(-4, 4, cz1, z1, new THREE.MeshStandardMaterial({ map: tileTexture('#b4b0a6', '#97928a', 8, 20), roughness: 0.7 }), 0.03);
  ceiling(-4, 4, cz1, z1, true);
  wallX(cz1, -4, 4, [], WALL_H, M.wall);
  // Side walls of the corridor with a doorway per room.
  wallZ(-4, cz1, z1, ROOM_Z.map((z) => ({ at: z, width: 1.3 })), WALL_H, M.wall);
  wallZ(4, cz1, z1, ROOM_Z.map((z) => ({ at: z, width: 1.3 })), WALL_H, M.wall);
  sign(['חדרי ראיונות', 'הממתינים מוזמנים לפי מספר'], 0, 3.3, z1 - 0.4, '-z', { width: 3.2, height: 0.5, bg: '#2f3a20' });
  const roomFloor = new THREE.MeshStandardMaterial({ map: tileTexture('#bcb6a8', '#9f998c', 8, 6), roughness: 0.7 });
  for (const room of ROOMS) {
    const west = room.side === 'west';
    const xa = west ? -12 : 4;
    const xb = west ? -4 : 12;
    const za = room.door.z - 2.5;
    const zb = room.door.z + 2.5;
    floor(xa, xb, za, zb, roomFloor, 0.03);
    ceiling(xa, xb, za, zb, false);
    box((xa + xb) / 2, WALL_H - 0.03, room.door.z, 1.4, 0.05, 0.5, M.light, { collide: false });
    // Walls at the far end and between rooms.
    box(west ? xa : xb, WALL_H / 2, room.door.z, T, WALL_H, 5, M.wall, { block: true });
    if (room.door.z === ROOM_Z[0] || true) {
      box((xa + xb) / 2, WALL_H / 2, zb, xb - xa, WALL_H, T, M.wall, { block: true });
      box((xa + xb) / 2, WALL_H / 2, za, xb - xa, WALL_H, T, M.wall, { block: true });
    }
    // Table with a laptop and papers, interviewers on the far side, a chair for the candidate.
    box(room.table.x, 0.74, room.table.z, 1.0, 0.05, 2.8, M.desk, { collide: false });
    box(room.table.x, 0.36, room.table.z, 0.9, 0.7, 2.7, M.trim, { collide: true });
    box(room.table.x + (west ? 0.2 : -0.2), 0.88, room.table.z + 0.4, 0.04, 0.3, 0.45, M.darkMetal, { collide: false });
    // Chairs face along their local +z: the candidate looks toward the far wall, the panel toward the door.
    chair(room.chair.x, room.chair.z, west ? -Math.PI / 2 : Math.PI / 2, M.chairDark);
    for (const p of room.panel) chair(p.x, p.z, west ? Math.PI / 2 : -Math.PI / 2, M.chairDark);
    // A window onto the base on the far wall.
    box(west ? xa + 0.12 : xb - 0.12, 2.2, room.door.z, 0.04, 1.2, 1.8, M.glass, { collide: false });
  }
  // Door signs: filled in by the stage (the units that interview you).
  const doorSigns = [];
  for (const room of ROOMS) {
    const west = room.side === 'west';
    const s = makeSign(['חדר ' + room.id, ''], { width: 0.9, height: 0.34, bg: '#1f3b73' });
    s.position.set(west ? -3.88 : 3.88, 2.55, room.door.z + 1.05);
    s.rotation.y = west ? Math.PI / 2 : -Math.PI / 2;
    s.userData.dynamic = true; // The stage swaps the texture for the unit's name.
    scene.add(s);
    doorSigns.push(s);
  }

  // ---------- Home (a bedroom far away) ----------

  floor(-3.5, 3.5, 116, 124, M.floorHome, 0.03);
  ceiling(-3.5, 3.5, 116, 124, false, 2.8);
  box(0, 1.4, 116, 7.2, 2.8, T, M.plain, { block: true });
  box(-3.5, 1.4, 120, T, 2.8, 8, M.plain, { block: true });
  box(3.5, 1.4, 120, T, 2.8, 8, M.plain, { block: true });
  wallX(124, -3.5, 3.5, [{ at: 0, width: 1.0 }], 2.8, M.plain);
  box(0, 2.76, 120, 1.4, 0.05, 0.5, M.light, { collide: false });
  // Bed, desk with a laptop, wardrobe, window.
  box(-2.1, 0.3, 120.4, 1.4, 0.4, 2.2, M.wood, { block: true });
  box(-2.1, 0.55, 120.4, 1.3, 0.2, 2.1, M.bedcover, { collide: false });
  box(-2.1, 0.7, 119.6, 0.5, 0.1, 0.3, M.white, { collide: false });
  desk(1.6, 121.4, 1.8, 0.8);
  const laptopScreen = box(1.6, 1.0, 121.7, 0.5, 0.32, 0.03, new THREE.MeshStandardMaterial({ color: '#16202c', emissive: '#4a8fd5', emissiveIntensity: 0.9 }), { collide: false });
  laptopScreen.rotation.x = -0.15;
  box(1.6, 0.78, 121.3, 0.52, 0.02, 0.34, M.darkMetal, { collide: false });
  box(3.0, 1.1, 118.5, 0.5, 2.2, 1.2, M.wood, { block: true });
  box(0, 1.7, 116.12, 1.8, 1.2, 0.04, M.glass, { collide: false });
  poster('חלום', ['כנפי טיס', 'עוד לא ויתרתי'], -3.38, 1.6, 119.2, '+x', { width: 0.7, height: 0.95, color: '#1f3b73' });
  const homeLight = new THREE.PointLight('#fff4e0', 18, 14, 1.4);
  homeLight.position.set(0, 2.4, 120);
  scene.add(homeLight);
  const hallLight = new THREE.PointLight('#fff8ea', 90, 60, 1.3);
  hallLight.position.set(0, 3.6, 3);
  scene.add(hallLight);
  const hallLight2 = new THREE.PointLight('#fff8ea', 60, 40, 1.3);
  hallLight2.position.set(0, 3.6, -22);
  scene.add(hallLight2);

  mergeStatic(scene, blockers);

  return {
    colliders,
    blockers,
    floodlights: { setPower() {} },
    seatList,
    posterSpots,
    doorSigns,
    setCalled,
    update(t) {
      for (const fn of updaters) fn(t);
    },
  };
}
