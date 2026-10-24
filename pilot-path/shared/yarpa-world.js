import * as THREE from 'three';
import { mergeStatic } from '../../shared/engine/merge.js';
import { drawIsraeliFlag } from '../../shared/flag.js';
import { canvasTexture, redraw, makeSign, makePoster, tileTexture, wallTexture } from '../../shared/engine/textures.js';

// The aeromedical unit in Tel HaShomer (Camp Dori), for ירפ״א א׳ and ב׳. A reconstruction: the real building is
// not described anywhere in detail, so this is a believable clinic building, not a copy.
// Units are meters; +z points toward the street, so walking into the building means moving toward -z.
//
//   z  64 .. 44   bus stop and the road
//   z  44 .. 22   the gate, plaza, palms
//   z  20 .. -8   check-in and the waiting hall (x -18 .. 18)
//   z  -8 .. -42  corridor (x -4 .. 4) with rooms on both sides:
//                 west: tests lab (z -14), forms room (z -26)    east: simulator A (z -14), simulator B (z -26)

const WALL_H = 4.0;
const T = 0.2;

export const HALL = { x1: -18, x2: 18, z1: -8, z2: 20 };

export const SPOTS = {
  busStop: { x: -10, z: 56 },
  arrive: { x: 0, z: 62 },
  gate: { x: 0, z: 43 },
  door: { x: 0, z: 22.5 },
  desks: [
    { x: -7, z: 13.4 },
    { x: 7, z: 13.4 },
  ],
  vending: { x: 17.3, z: 3 },
  cooler: { x: -17.3, z: 3 },
  board: { x: 0, z: 19.6 },
  corridor: { x: 0, z: -9 },
  endWait: { x: 0, z: -37.5 },
  // Rooms
  lab: { door: { x: -4, z: -14 }, center: { x: -10, z: -14 }, proctor: { x: -14.4, z: -10.6 } },
  simA: { door: { x: 4, z: -14 }, chair: { x: 11.2, z: -14 }, instructor: { x: 13.6, z: -11 } },
  forms: { door: { x: -4, z: -26 }, center: { x: -10, z: -26 }, proctor: { x: -14.4, z: -22.6 } },
  simB: { door: { x: 4, z: -26 }, chair: { x: 11.2, z: -26 }, instructor: { x: 13.6, z: -23 } },
  eye: { x: -2.2, z: -37.5 },
};

export function buildYarpaWorld(scene) {
  const colliders = [];
  const blockers = [];
  const updaters = [];

  const M = {
    wall: new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 0.9 }),
    outerWall: new THREE.MeshStandardMaterial({ color: '#e0d6bf', roughness: 0.95 }),
    plain: new THREE.MeshStandardMaterial({ color: '#ece8de', roughness: 0.9 }),
    darkWall: new THREE.MeshStandardMaterial({ color: '#1d2433', roughness: 0.95 }),
    trim: new THREE.MeshStandardMaterial({ color: '#4a4f45', roughness: 0.6 }),
    metal: new THREE.MeshStandardMaterial({ color: '#9aa0a6', metalness: 0.6, roughness: 0.4 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: '#3d4247', metalness: 0.5, roughness: 0.5 }),
    wood: new THREE.MeshStandardMaterial({ color: '#b48a5a', roughness: 0.7 }),
    desk: new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: 0.6 }),
    chair: new THREE.MeshStandardMaterial({ color: '#2f5d8a', roughness: 0.6 }),
    chairDark: new THREE.MeshStandardMaterial({ color: '#25282d', roughness: 0.7 }),
    asphalt: new THREE.MeshStandardMaterial({ color: '#55565a', roughness: 0.95 }),
    paving: new THREE.MeshStandardMaterial({ color: '#b8b0a0', roughness: 0.95 }),
    grass: new THREE.MeshStandardMaterial({ color: '#7d8f4a', roughness: 1 }),
    line: new THREE.MeshStandardMaterial({ color: '#f4f1e6', roughness: 0.8 }),
    white: new THREE.MeshStandardMaterial({ color: '#f5f5f2', roughness: 0.6 }),
    red: new THREE.MeshStandardMaterial({ color: '#b3322a', roughness: 0.7 }),
    glass: new THREE.MeshStandardMaterial({ color: '#cfe8f2', transparent: true, opacity: 0.25, roughness: 0.1, depthWrite: false }),
    trunk: new THREE.MeshStandardMaterial({ color: '#7a6045', roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#4c7a3a', roughness: 0.9, flatShading: true, side: THREE.DoubleSide }),
    light: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff4dc', emissiveIntensity: 1.1 }),
    blueLight: new THREE.MeshStandardMaterial({ color: '#0a1020', emissive: '#4a8fff', emissiveIntensity: 1.2 }),
    vending: new THREE.MeshStandardMaterial({ color: '#1f4f8f', roughness: 0.4 }),
    screenOff: new THREE.MeshStandardMaterial({ color: '#10161f', emissive: '#2a4b7a', emissiveIntensity: 0.6 }),
    keyboard: new THREE.MeshStandardMaterial({ color: '#1b1d22', roughness: 0.5 }),
    foam: new THREE.MeshStandardMaterial({ color: '#16191f', roughness: 1 }),
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

  const faceTo = (mesh, dir) => {
    mesh.rotation.y = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 }[dir];
    return mesh;
  };

  function sign(lines, x, y, z, dir, options) {
    const s = faceTo(makeSign(lines, options), dir);
    s.position.set(x, y, z);
    scene.add(s);
    return s;
  }

  function poster(title, lines, x, y, z, dir, options) {
    const p = faceTo(makePoster(title, lines, options), dir);
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
  const darkCeiling = new THREE.MeshBasicMaterial({ color: '#0b0f18' });
  function ceiling(x1, x2, z1, z2, { lights = true, dark = false, y = WALL_H } = {}) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), dark ? darkCeiling : ceilingMaterial);
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

  function desk(x, z, w = 1.6, d = 0.8) {
    box(x, 0.74, z, w, 0.05, d, M.desk, { collide: false });
    box(x, 0.36, z, w - 0.1, 0.7, d - 0.1, M.trim, { collide: true });
  }

  function palm(x, z, scale = 1) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.24 * scale, 6 * scale, 7), M.trunk);
    trunk.position.set(x, 3 * scale, z);
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

  // ---------- Ground, street, gate ----------

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), M.grass);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  floor(-44, 44, 19.9, 52, M.paving, 0.02);
  floor(-60, 60, 52, 70, M.asphalt, 0.02);
  for (let x = -56; x < 56; x += 8) floor(x, x + 4, 60.9, 61.1, M.line, 0.03);
  floor(-14, 14, 44, 52, M.paving, 0.025);
  colliders.push({ minX: -60, maxX: 60, minZ: 69, maxZ: 70 });
  colliders.push({ minX: -61, maxX: -60, minZ: -48, maxZ: 70 });
  colliders.push({ minX: 60, maxX: 61, minZ: -48, maxZ: 70 });
  colliders.push({ minX: -61, maxX: 61, minZ: -49, maxZ: -48 });

  box(SPOTS.busStop.x, 2.4, SPOTS.busStop.z + 0.3, 3.2, 0.08, 1.6, M.glass, { collide: false });
  for (const dx of [-1.5, 1.5]) box(SPOTS.busStop.x + dx, 1.2, SPOTS.busStop.z - 0.4, 0.07, 2.4, 0.07, M.darkMetal, { collide: false });
  box(SPOTS.busStop.x, 0.45, SPOTS.busStop.z - 0.3, 2.6, 0.08, 0.5, M.wood, { collide: false });
  sign(['תחנה', 'תל השומר · שער 3'], SPOTS.busStop.x + 1.9, 2.0, SPOTS.busStop.z, '+z', { width: 1.2, height: 0.4, bg: '#1f3b73' });

  for (let x = -44; x <= 44; x += 2) {
    if (Math.abs(x) < 4.2) continue;
    box(x, 1.1, 44, 0.06, 2.2, 0.06, M.darkMetal, { collide: false });
  }
  for (const [cx, w] of [[-24, 40], [24, 40]]) {
    box(cx, 1.9, 44, w, 0.05, 0.05, M.darkMetal, { collide: false });
    box(cx, 1.1, 44, w, 0.05, 0.05, M.darkMetal, { collide: false });
  }
  colliders.push({ minX: -44, maxX: -4, minZ: 43.9, maxZ: 44.1 });
  colliders.push({ minX: 4, maxX: 44, minZ: 43.9, maxZ: 44.1 });
  box(5.6, 1.5, 42, 2.2, 3, 2.2, M.plain, { block: true });
  box(5.6, 3.05, 42, 2.8, 0.15, 2.8, M.darkMetal, { collide: false });
  box(4.5, 1.7, 42, 0.05, 1.0, 1.6, M.glass, { collide: false });
  sign(['מחנה דורי', 'תל השומר · כניסה לבסיס'], 0, 4.4, 44, '+z', { width: 5.8, height: 0.9, bg: '#2f3a20' });
  box(-2.1, 3.2, 44, 0.3, 6.4, 0.3, M.darkMetal, { collide: false });
  box(2.1, 3.2, 44, 0.3, 6.4, 0.3, M.darkMetal, { collide: false });
  box(0, 6.2, 44, 4.5, 0.3, 0.3, M.darkMetal, { collide: false });
  box(-2.2, 1.0, 43.3, 0.08, 0.08, 4.0, M.red, { collide: false });

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
  for (const [x, z, s] of [[-20, 40, 1], [-9, 33, 0.9], [9, 33, 1.1], [20, 40, 1], [-26, 28, 1], [26, 28, 0.95], [-15, 24, 0.9], [15, 24, 1]]) palm(x, z, s);
  for (const x of [-15, 15]) {
    box(x, 0.45, 30, 2, 0.1, 0.5, M.wood, { collide: false });
    box(x - 0.8, 0.22, 30, 0.1, 0.44, 0.45, M.darkMetal, { collide: false });
    box(x + 0.8, 0.22, 30, 0.1, 0.44, 0.45, M.darkMetal, { collide: false });
    colliders.push({ minX: x - 1, maxX: x + 1, minZ: 29.7, maxZ: 30.3 });
  }

  // ---------- The building: facade and the waiting hall ----------

  const { x1, x2, z1, z2 } = HALL;
  wallX(z2, x1, x2, [{ at: 0, width: 3.6 }], WALL_H + 1.2, M.outerWall);
  sign(['היחידה לרפואה אווירית', 'ירפ״א · רישום בכניסה'], 0, WALL_H + 0.35, z2 + 0.12, '+z', { width: 6.6, height: 0.9, bg: '#1f3b73' });
  box(0, WALL_H + 0.8, z2 + 1.5, 12, 0.2, 3, M.darkMetal, { collide: false });
  wallZ(x1, z1, z2, [], WALL_H, M.wall);
  wallZ(x2, z1, z2, [], WALL_H, M.wall);
  wallX(z1, x1, x2, [{ at: 0, width: 3.2 }], WALL_H, M.wall);
  floor(x1, x2, z1, z2, new THREE.MeshStandardMaterial({ map: tileTexture('#a9a498', '#8a857a', 18, 14), roughness: 0.7 }), 0.03);
  ceiling(x1, x2, z1, z2);

  const windowGlass = new THREE.MeshStandardMaterial({ color: '#2c4a63', metalness: 0.5, roughness: 0.25 });
  for (const x of [-14.5, -11, -7.5, 7.5, 11, 14.5]) {
    box(x, 2.5, z2 + 0.12, 2.2, 1.7, 0.05, windowGlass, { collide: false });
    box(x, 1.55, z2 + 0.14, 2.4, 0.08, 0.1, M.trim, { collide: false });
  }
  box(0, 0.45, z2 + 0.12, 36, 0.9, 0.06, M.trim, { collide: false });

  SPOTS.desks.forEach((d, i) => {
    desk(d.x, d.z, 2.8, 0.9);
    box(d.x, 1.0, d.z - 0.2, 0.55, 0.34, 0.04, M.screenOff, { collide: false });
    sign(['רישום', `עמדה ${i + 1}`], d.x, 2.6, d.z + 0.1, '+z', { width: 1.5, height: 0.45, bg: '#2f3a20' });
  });

  // Rows of chairs facing the notice board.
  const seatList = [];
  [3.6, 2.1, 0.6, -0.9, -2.4, -3.9, -5.4].forEach((rowZ) => {
    for (const block of [-1, 1]) {
      for (let k = 0; k < 7; k++) {
        const x = block * (3.6 + k * 0.62);
        chair(x, rowZ, Math.PI);
        seatList.push({ x, z: rowZ, taken: false, row: rowZ, block });
      }
    }
  });

  // Notice board (a TV) above the corridor door: shows who is called.
  const boardTexture = canvasTexture(1024, 576, (ctx, w, h) => drawBoard(ctx, w, h, 'ממתינים לקריאה', ''));
  const board = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.93), new THREE.MeshBasicMaterial({ map: boardTexture, toneMapped: false }));
  board.userData.dynamic = true;
  board.position.set(0, 2.75, z1 + 0.14);
  scene.add(board);
  const setBoard = (title, line) => redraw(boardTexture, (ctx, w, h) => drawBoard(ctx, w, h, title, line));

  box(SPOTS.vending.x, 1.0, SPOTS.vending.z, 1.0, 2.0, 0.8, M.vending, { block: true });
  box(SPOTS.vending.x - 0.52, 1.2, SPOTS.vending.z, 0.04, 1.2, 0.6, M.glass, { collide: false });
  box(SPOTS.cooler.x, 0.55, SPOTS.cooler.z, 0.45, 1.1, 0.45, M.white, { block: true });
  box(SPOTS.cooler.x, 1.3, SPOTS.cooler.z, 0.32, 0.4, 0.32, M.glass, { collide: false });
  poster('כנפיים', ['חיל האוויר', 'מי שמעז מנצח'], x2 - 0.15, 1.8, 10, '-x', { color: '#1f3b73', width: 0.9, height: 1.2 });
  poster('חוסן', ['מנטלי', 'יוזמה', 'גמישות'], x2 - 0.15, 1.8, 12, '-x', { color: '#2f3a20', width: 0.9, height: 1.2 });
  poster('בדיקה רפואית', ['מקבלים תוצאות', 'במקום'], x1 + 0.15, 1.8, 10, '+x', { color: '#2b5a6e', width: 0.9, height: 1.2 });
  for (const [x, z] of [[-16.2, 18.2], [16.2, 18.2], [-16.2, -6.2], [16.2, -6.2]]) {
    box(x, 0.3, z, 0.5, 0.6, 0.5, M.trim, { collide: true });
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), M.leaf);
    bush.position.set(x, 0.95, z);
    scene.add(bush);
  }

  // ---------- Corridor ----------

  const cz1 = -42;
  floor(-4, 4, cz1, z1, new THREE.MeshStandardMaterial({ map: tileTexture('#a39e93', '#85807a', 8, 24), roughness: 0.7 }), 0.03);
  ceiling(-4, 4, cz1, z1);
  wallX(cz1, -4, 4, [], WALL_H, M.wall);
  const doorsAt = [-14, -26];
  wallZ(-4, cz1, z1, doorsAt.map((z) => ({ at: z, width: 1.4 })));
  wallZ(4, cz1, z1, doorsAt.map((z) => ({ at: z, width: 1.4 })));
  sign(['חדרי בדיקה', 'ממתינים בכיסאות עד שקוראים'], 0, 3.3, z1 - 0.4, '-z', { width: 3.2, height: 0.5, bg: '#2f3a20' });
  // Waiting benches at the end of the corridor and a window.
  for (const x of [-2.6, 2.6]) {
    box(x, 0.45, -39.5, 1.2, 0.1, 0.5, M.wood, { collide: false });
    colliders.push({ minX: x - 0.6, maxX: x + 0.6, minZ: -39.8, maxZ: -39.2 });
  }
  box(0, 2.0, cz1 + 0.1, 2.4, 1.3, 0.04, M.glass, { collide: false });
  sign(['המתנה לתוצאות'], 0, 3.1, cz1 + 0.15, '+z', { width: 2.2, height: 0.4, bg: '#1f3b73' });

  // ---------- Rooms ----------

  const tileRoom = new THREE.MeshStandardMaterial({ map: tileTexture('#a59f91', '#878175', 10, 8), roughness: 0.7 });
  function room(xa, xb, za, zb, { dark = false } = {}) {
    floor(xa, xb, za, zb, dark ? new THREE.MeshStandardMaterial({ color: '#1a1d24', roughness: 0.9 }) : tileRoom, 0.03);
    ceiling(xa, xb, za, zb, { lights: !dark, dark });
    const wall = dark ? M.darkWall : M.wall;
    const west = xb < 0;
    box(west ? xa : xb, WALL_H / 2, (za + zb) / 2, T, WALL_H, zb - za, wall, { block: true });
    box((xa + xb) / 2, WALL_H / 2, zb, xb - xa, WALL_H, T, wall, { block: true });
    box((xa + xb) / 2, WALL_H / 2, za, xb - xa, WALL_H, T, wall, { block: true });
  }

  // The tests lab (west, z -14): a grid of computer stations, a proctor's desk.
  room(-16, -4, -19.5, -8.5);
  const labSeats = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const x = -14.4 + col * 2.5;
      const z = -17.6 + row * 3.0;
      desk(x, z - 0.1, 1.5, 0.7);
      box(x, 1.0, z - 0.3, 0.5, 0.32, 0.04, M.screenOff, { collide: false });
      box(x, 0.78, z + 0.0, 0.42, 0.015, 0.14, M.keyboard, { collide: false });
      box(x - 0.45, 0.78, z + 0.05, 0.14, 0.12, 0.14, M.darkMetal, { collide: false }); // headphones
      chair(x, z + 0.75, Math.PI, M.chairDark);
      labSeats.push({ x, z: z + 0.75, taken: false, yaw: 0, row, col, monitor: { x, y: 1.0, z: z - 0.3 } });
    }
  }
  desk(SPOTS.lab.proctor.x + 0.8, SPOTS.lab.proctor.z - 0.2, 1.8, 0.7);
  sign(['מעבדת מבחנים', 'שקט. עובדים'], -3.88, 2.55, -14 + 1.05, '+x', { width: 0.95, height: 0.34, bg: '#1f3b73' }).rotation.y = Math.PI / 2;

  // Simulator A (east, z -14) and B (east, z -26): dark rooms with a cockpit chair, a stick and a throttle.
  const simSeats = {};
  for (const [name, spot] of [['A', SPOTS.simA], ['B', SPOTS.simB]]) {
    const z = spot.chair.z;
    room(4, 16, z - 5.5, z + 5.5, { dark: true });
    // Cockpit seat facing the big screen on the east wall.
    const seat = new THREE.Group();
    seat.position.set(spot.chair.x, 0, z);
    seat.rotation.y = -Math.PI / 2; // looks toward +x
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.32, 1.0), M.chairDark);
    base.position.y = 0.16;
    const sitter = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.62), M.chairDark);
    sitter.position.set(0, 0.5, 0);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.14), M.chairDark);
    back.position.set(0, 0.95, 0.31);
    const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.12), M.chairDark);
    headrest.position.set(0, 1.5, 0.34);
    seat.add(base, sitter, back, headrest);
    scene.add(seat);
    colliders.push({ minX: spot.chair.x - 0.5, maxX: spot.chair.x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 });
    // Stick (right hand) and throttle (left hand) on small stands; the screen in front.
    box(spot.chair.x + 0.62, 0.52, z + 0.38, 0.18, 0.7, 0.18, M.darkMetal, { collide: false });
    box(spot.chair.x + 0.62, 0.95, z + 0.38, 0.05, 0.4, 0.05, M.darkMetal, { collide: false }); // stick
    box(spot.chair.x + 0.62, 1.18, z + 0.38, 0.1, 0.1, 0.1, M.red, { collide: false });
    box(spot.chair.x + 0.5, 0.52, z - 0.42, 0.34, 0.7, 0.14, M.darkMetal, { collide: false });
    box(spot.chair.x + 0.55, 0.9, z - 0.42, 0.06, 0.06, 0.34, M.darkMetal, { collide: false }); // throttle lever
    const screenTexture = canvasTexture(1024, 576, (ctx, w, h) => drawSimScreen(ctx, w, h, 'ready'));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.93), new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false }));
    screen.userData.dynamic = true;
    screen.position.set(15.86, 1.9, z);
    screen.rotation.y = -Math.PI / 2;
    scene.add(screen);
    box(15.9, 1.9, z, 0.08, 3.2, 5.6, M.darkMetal, { collide: false });
    // Soft blue lights and acoustic foam panels on the north and south walls.
    box(8, WALL_H - 0.05, z, 6, 0.05, 0.12, M.blueLight, { collide: false });
    for (let k = 0; k < 4; k++) {
      box(7 + k * 2.3, 1.8, z - 5.4, 1.6, 2.4, 0.08, M.foam, { collide: false });
      box(7 + k * 2.3, 1.8, z + 5.4, 1.6, 2.4, 0.08, M.foam, { collide: false });
    }
    desk(spot.instructor.x - 1.0, spot.instructor.z + 0.3, 1.4, 0.7);
    box(spot.instructor.x - 1.0, 1.0, spot.instructor.z + 0.3, 0.5, 0.32, 0.04, M.screenOff, { collide: false });
    sign([`סימולטור ${name}`, 'כניסה בתור'], 3.88, 2.55, z + 1.05, '-x', { width: 0.95, height: 0.34, bg: '#1f3b73' }).rotation.y = -Math.PI / 2;
    const glow = new THREE.PointLight('#4a8fff', 7, 16, 1.7);
    glow.position.set(12, 2.4, z);
    scene.add(glow);
    simSeats[name] = { x: spot.chair.x, z, yaw: -Math.PI / 2, screenTexture, setScreen: (mode, extra) => redraw(screenTexture, (ctx, w, h) => drawSimScreen(ctx, w, h, mode, extra)) };
  }

  // The forms room (west, z -26): the same as the lab (for the questionnaires of ירפ״א ב׳).
  room(-16, -4, -31.5, -20.5);
  const formSeats = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const x = -14.4 + col * 2.5;
      const z = -29.6 + row * 3.0;
      desk(x, z - 0.1, 1.5, 0.7);
      box(x, 1.0, z - 0.3, 0.5, 0.32, 0.04, M.screenOff, { collide: false });
      box(x, 0.78, z + 0.0, 0.42, 0.015, 0.14, M.keyboard, { collide: false });
      chair(x, z + 0.75, Math.PI, M.chairDark);
      formSeats.push({ x, z: z + 0.75, taken: false, yaw: 0, row, col, monitor: { x, y: 1.0, z: z - 0.3 } });
    }
  }
  desk(SPOTS.forms.proctor.x + 0.8, SPOTS.forms.proctor.z - 0.2, 1.8, 0.7);
  sign(['שאלונים', 'עונים בכנות ובשקט'], -3.88, 2.55, -26 + 1.05, '+x', { width: 0.95, height: 0.34, bg: '#1f3b73' }).rotation.y = Math.PI / 2;

  // Eye-test station at the end of the corridor (chin rest and a chart).
  box(SPOTS.eye.x, 0.7, SPOTS.eye.z - 0.1, 0.5, 1.0, 0.5, M.white, { collide: true });
  box(SPOTS.eye.x, 1.25, SPOTS.eye.z - 0.1, 0.35, 0.25, 0.3, M.metal, { collide: false });
  poster('בדיקת ראייה', ['האותיות מתקטנות', 'קראו בקול'], -3.88, 1.7, -39, '+x', { color: '#2b5a6e', width: 0.7, height: 0.9 });

  // ---------- Lights ----------

  const lightDefs = [
    [0, 3.6, 10, 55, 55],
    [0, 3.6, -2, 55, 50],
    [0, 3.4, -16, 28, 18],
    [0, 3.4, -30, 28, 18],
    [-10, 3.4, -14, 40, 20],
    [-10, 3.4, -26, 40, 20],
  ];
  for (const [x, y, z, intensity, distance] of lightDefs) {
    const l = new THREE.PointLight('#fff8ea', intensity, distance, 1.3);
    l.position.set(x, y, z);
    scene.add(l);
  }

  mergeStatic(scene, blockers);

  return {
    colliders,
    blockers,
    floodlights: { setPower() {} },
    seatList,
    labSeats,
    formSeats,
    simSeats,
    setBoard,
    update(t) {
      for (const fn of updaters) fn(t);
    },
  };
}

function drawBoard(ctx, w, h, title, line) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0e2142');
  g.addColorStop(1, '#09152b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7cc4ff';
  ctx.font = '800 54px Heebo, sans-serif';
  ctx.fillText('ירפ״א · היחידה לרפואה אווירית', w / 2, 90);
  ctx.fillStyle = '#fff';
  ctx.font = '700 84px Heebo, sans-serif';
  ctx.fillText(title, w / 2, 280);
  ctx.fillStyle = '#ffc857';
  ctx.font = '700 56px Heebo, sans-serif';
  ctx.fillText(line, w / 2, 380);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '500 36px Heebo, sans-serif';
  ctx.fillText('אפשר לשתות מים. יש להישאר בסביבה.', w / 2, 500);
}

function drawSimScreen(ctx, w, h, mode, extra) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, mode === 'ready' ? '#0a1c3a' : '#16406e');
  g.addColorStop(1, mode === 'ready' ? '#050b18' : '#c8a46a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7dffb0';
  ctx.font = '700 72px Heebo, sans-serif';
  ctx.fillText(mode === 'ready' ? 'סימולטור מוכן' : extra ?? 'בטיסה', w / 2, h / 2);
  ctx.fillStyle = 'rgba(125,255,176,0.6)';
  ctx.font = '500 34px Heebo, sans-serif';
  ctx.fillText(mode === 'ready' ? 'שבו בכיסא, סטיק ביד ימין ומצערת ביד שמאל' : '', w / 2, h / 2 + 70);
}
