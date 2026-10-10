import * as THREE from 'three';
import { drawIsraeliFlag } from '../../shared/flag.js';
import {
  canvasTexture,
  redraw,
  makeSign,
  makePoster,
  tileTexture,
  wallTexture,
  drawQueueScreen,
} from './textures.js';

// The recruitment office (לשכת גיוס). Units are meters, +z points out of the
// front door toward the street, so walking in means moving toward -z.
//
//   z  0 .. -3   entrance + security check
//   z -3 .. -12  routing counter (ניתוב) and its queue
//   z -12 .. -30 waiting hall with screens
//   x < -14      data verification, computer test room
//   x > 14       medical: measurements, vision, doctor
//   z < -30      interview rooms

const WALL_H = 3.2;
const T = 0.2; // Wall thickness.

export const ROW_Z = [-14, -16.4, -18.8, -21.2, -23.6];
const SEAT_XS = [];
for (let x = 2.2; x <= 9.5; x += 0.62) SEAT_XS.push(+x.toFixed(2));

export const ROOMS = {
  data: { name: 'אימות נתונים', room: 'חדר 1', door: { x: -14, z: -15.5 }, inside: { x: -15.2, z: -15.5 } },
  dapar: { name: 'מבחנים ממוחשבים', room: 'חדר מחשבים', door: { x: -14, z: -24.5 }, inside: { x: -15.2, z: -24.5 } },
  measure: { name: 'בדיקות רפואיות', room: 'חדר מדידות', door: { x: 14, z: -15 }, inside: { x: 15.2, z: -15 } },
  vision: { name: 'בדיקת ראייה', room: 'חדר 5', door: { x: 14, z: -21 }, inside: { x: 15.2, z: -21 } },
  doctor: { name: 'רופא', room: 'חדר 6', door: { x: 14, z: -27 }, inside: { x: 15.2, z: -27 } },
  interview1: { name: 'ראיון אישי', room: 'חדר ראיונות 1', door: { x: -9.4, z: -30 }, inside: { x: -9.4, z: -31.2 } },
  interview2: { name: 'ראיון אישי', room: 'חדר ראיונות 2', door: { x: 0, z: -30 }, inside: { x: 0, z: -31.2 } },
  interview3: { name: 'ראיון אישי', room: 'חדר ראיונות 3', door: { x: 9.4, z: -30 }, inside: { x: 9.4, z: -31.2 } },
};

export function buildWorld(scene) {
  const colliders = [];
  const blockers = [];
  const updaters = [];
  const seatRows = [];

  const materials = {
    wall: new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 0.9 }),
    plain: new THREE.MeshStandardMaterial({ color: '#ece8de', roughness: 0.9 }),
    trim: new THREE.MeshStandardMaterial({ color: '#4a4f45', roughness: 0.6 }),
    metal: new THREE.MeshStandardMaterial({ color: '#9aa0a6', metalness: 0.6, roughness: 0.4 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: '#3d4247', metalness: 0.5, roughness: 0.5 }),
    wood: new THREE.MeshStandardMaterial({ color: '#b48a5a', roughness: 0.7 }),
    desk: new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: 0.6 }),
    counter: new THREE.MeshStandardMaterial({ color: '#5f6b45', roughness: 0.7 }),
    chair: new THREE.MeshStandardMaterial({ color: '#2f5d8a', roughness: 0.6 }),
    chairDark: new THREE.MeshStandardMaterial({ color: '#2b2f33', roughness: 0.7 }),
    glass: new THREE.MeshStandardMaterial({ color: '#cfe8f2', transparent: true, opacity: 0.25, roughness: 0.1, depthWrite: false }),
    screen: new THREE.MeshStandardMaterial({ color: '#1b2a3a', emissive: '#4a7fb5', emissiveIntensity: 0.6, roughness: 0.3 }),
    plant: new THREE.MeshStandardMaterial({ color: '#4c7a3a', roughness: 0.9, flatShading: true }),
    pot: new THREE.MeshStandardMaterial({ color: '#8a5a3c', roughness: 0.9 }),
    white: new THREE.MeshStandardMaterial({ color: '#f5f5f2', roughness: 0.6 }),
    belt: new THREE.MeshStandardMaterial({ color: '#1f3b73', roughness: 0.6 }),
  };

  // ---------- Helpers ----------

  function box(x, y, z, sx, sy, sz, material, { collide = true, block = false, parent = scene } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    if (collide) colliders.push({ minX: x - sx / 2, maxX: x + sx / 2, minZ: z - sz / 2, maxZ: z + sz / 2, mesh });
    if (block) blockers.push(mesh);
    return mesh;
  }

  // A wall along x at fixed z, with door openings [{at, width}].
  function wallX(z, x1, x2, doors = [], height = WALL_H, material = materials.wall) {
    let start = x1;
    const sorted = [...doors].sort((a, b) => a.at - b.at);
    for (const door of sorted) {
      const a = door.at - door.width / 2;
      const b = door.at + door.width / 2;
      if (a > start) box((start + a) / 2, height / 2, z, a - start, height, T, material, { block: true });
      box(door.at, (height + 2.3) / 2, z, door.width, height - 2.3, T, material, { collide: false, block: true });
      doorFrame(door.at, z, door.width, 'x');
      start = b;
    }
    if (x2 > start) box((start + x2) / 2, height / 2, z, x2 - start, height, T, material, { block: true });
  }

  // A wall along z at fixed x.
  function wallZ(x, z1, z2, doors = [], height = WALL_H, material = materials.wall) {
    let start = z1;
    const sorted = [...doors].sort((a, b) => a.at - b.at);
    for (const door of sorted) {
      const a = door.at - door.width / 2;
      const b = door.at + door.width / 2;
      if (a > start) box(x, height / 2, (start + a) / 2, T, height, a - start, material, { block: true });
      box(x, (height + 2.3) / 2, door.at, T, height - 2.3, door.width, material, { collide: false, block: true });
      doorFrame(x, door.at, door.width, 'z');
      start = b;
    }
    if (z2 > start) box(x, height / 2, (start + z2) / 2, T, height, z2 - start, material, { block: true });
  }

  function doorFrame(x, z, width, axis) {
    const opts = { collide: false };
    if (axis === 'x') {
      box(x - width / 2, 1.15, z, 0.08, 2.3, T + 0.06, materials.trim, opts);
      box(x + width / 2, 1.15, z, 0.08, 2.3, T + 0.06, materials.trim, opts);
      box(x, 2.32, z, width + 0.16, 0.08, T + 0.06, materials.trim, opts);
    } else {
      box(x, 1.15, z - width / 2, T + 0.06, 2.3, 0.08, materials.trim, opts);
      box(x, 1.15, z + width / 2, T + 0.06, 2.3, 0.08, materials.trim, opts);
      box(x, 2.32, z, T + 0.06, 0.08, width + 0.16, materials.trim, opts);
    }
  }

  // Place a mesh that faces +z so it faces `dir` ('+x', '-x', '+z', '-z').
  function face(mesh, dir) {
    mesh.rotation.y = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 }[dir];
    return mesh;
  }

  function addSign(lines, x, y, z, dir, options) {
    const sign = face(makeSign(lines, options), dir);
    sign.position.set(x, y, z);
    scene.add(sign);
    return sign;
  }

  function addPoster(title, lines, x, y, z, dir, options) {
    const poster = face(makePoster(title, lines, options), dir);
    poster.position.set(x, y, z);
    scene.add(poster);
    return poster;
  }

  function desk(x, z, width = 1.6, depth = 0.8, rotated = false) {
    const sx = rotated ? depth : width;
    const sz = rotated ? width : depth;
    box(x, 0.73, z, sx, 0.05, sz, materials.desk, { collide: false });
    box(x, 0.36, z, sx - 0.1, 0.7, sz - 0.1, materials.trim, { collide: true });
  }

  function monitor(x, z, dir, material = materials.screen) {
    const group = new THREE.Group();
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.34, 0.04), material);
    screen.position.y = 0.98;
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), materials.darkMetal);
    stand.position.y = 0.84;
    group.add(screen, stand);
    group.position.set(x, 0, z);
    face(group, dir);
    scene.add(group);
    return group;
  }

  function officeChair(x, z, dir) {
    const group = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.07, 0.46), materials.chairDark);
    seat.position.y = 0.45;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.05), materials.chairDark);
    back.position.set(0, 0.74, -0.22);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), materials.darkMetal);
    post.position.y = 0.22;
    group.add(seat, back, post);
    group.position.set(x, 0, z);
    face(group, dir);
    scene.add(group);
  }

  function plant(x, z, size = 1) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * size, 0.17 * size, 0.4 * size, 10), materials.pot);
    pot.position.set(x, 0.2 * size, z);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 * size, 0), materials.plant);
    leaves.position.set(x, 0.75 * size, z);
    leaves.scale.y = 1.3;
    scene.add(pot, leaves);
    colliders.push({ minX: x - 0.25, maxX: x + 0.25, minZ: z - 0.25, maxZ: z + 0.25 });
  }

  // ---------- Floors, ceiling, lights ----------

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 38),
    new THREE.MeshStandardMaterial({ map: tileTexture('#dcd8cf', '#c2bdb1', 52 / 0.6, 38 / 0.6), roughness: 0.6 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.001, -19);
  scene.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(52, 38), new THREE.MeshStandardMaterial({ color: '#f2f0ea', roughness: 1 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, WALL_H, -19);
  scene.add(ceiling);

  // Fluorescent panels.
  const panelSpots = [];
  for (let x = -24; x <= 24; x += 4) {
    for (let z = -2; z >= -36; z -= 4) panelSpots.push([x, z]);
  }
  const panels = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1.2, 0.6),
    new THREE.MeshBasicMaterial({ color: '#fffdf5' }),
    panelSpots.length,
  );
  const dummy = new THREE.Object3D();
  panelSpots.forEach(([x, z], i) => {
    dummy.position.set(x, WALL_H - 0.01, z);
    dummy.rotation.set(Math.PI / 2, 0, 0);
    dummy.updateMatrix();
    panels.setMatrixAt(i, dummy.matrix);
  });
  scene.add(panels);

  // ---------- Outer shell ----------

  // Front wall: interior part (3.2 m) plus the tall exterior facade above it.
  wallX(0, -26, 26, [{ at: 0, width: 3.2 }]);
  wallZ(-26, -38, 0);
  wallZ(26, -38, 0);
  wallX(-38, -26, 26);

  // ---------- Inner walls ----------

  wallZ(-14, -30, 0, [
    { at: ROOMS.data.door.z, width: 1.4 },
    { at: ROOMS.dapar.door.z, width: 1.4 },
  ]);
  wallZ(14, -30, 0, [
    { at: ROOMS.measure.door.z, width: 1.4 },
    { at: ROOMS.vision.door.z, width: 1.4 },
    { at: ROOMS.doctor.door.z, width: 1.4 },
  ]);
  wallX(-30, -26, 26, [
    { at: ROOMS.interview1.door.x, width: 1.4 },
    { at: ROOMS.interview2.door.x, width: 1.4 },
    { at: ROOMS.interview3.door.x, width: 1.4 },
  ]);
  wallX(-12, -26, -14);
  wallX(-19, -26, -14);
  wallX(-12, 14, 26);
  wallX(-18, 14, 26);
  wallX(-24, 14, 26);
  wallZ(-4.7, -38, -30);
  wallZ(4.7, -38, -30);

  // ---------- Exterior ----------
  buildExterior();

  // ---------- Security check ----------

  const railPosts = [];
  for (const [from, to] of [[-14, -0.75], [0.75, 14]]) {
    box((from + to) / 2, 0.98, -3, to - from, 0.06, 0.06, materials.metal, { collide: false });
    colliders.push({ minX: from, maxX: to, minZ: -3.1, maxZ: -2.9 });
    for (let x = from; x <= to + 0.01; x += 1.5) railPosts.push(x);
  }
  for (const x of railPosts) box(x, 0.5, -3, 0.06, 1, 0.06, materials.metal, { collide: false });

  // Metal detector arch.
  box(-0.72, 1.1, -3, 0.18, 2.2, 0.55, materials.white, { block: false });
  box(0.72, 1.1, -3, 0.18, 2.2, 0.55, materials.white, { block: false });
  box(0, 2.27, -3, 1.62, 0.18, 0.55, materials.white, { collide: false });
  const archLight = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.02), new THREE.MeshBasicMaterial({ color: '#d9534f' }));
  archLight.position.set(0, 2.27, -2.71);
  scene.add(archLight);

  const securityBarrier = { minX: -0.65, maxX: 0.65, minZ: -3.2, maxZ: -2.8 };
  colliders.push(securityBarrier);

  // Guard's table with a tray.
  box(2.5, 0.45, -1.8, 1.4, 0.9, 0.7, materials.desk);
  box(2.3, 0.93, -1.8, 0.5, 0.05, 0.35, materials.darkMetal, { collide: false });
  addSign(['בידוק ביטחוני', 'נא להניח טלפון ומפתחות בסלסלה'], 0, 2.75, -2.7, '+z', { width: 2.6, height: 0.5, bg: '#1f3b73' });

  // ---------- Routing (ניתוב) ----------

  box(-8.7, 1.3, -10.2, 10.2, 2.6, T, materials.plain, { block: true });
  box(-8.7, 0.55, -8.4, 10.2, 1.1, 0.7, materials.counter);
  box(-8.7, 1.12, -8.4, 10.3, 0.05, 0.8, materials.desk, { collide: false });
  for (const x of [-10.15, -7.45]) box(x, 1.55, -8.4, 0.04, 0.9, 0.7, materials.glass, { collide: false });
  box(-8.7, 1.62, -8.1, 10.2, 1.0, 0.03, materials.glass, { collide: false });

  const windows = [
    { x: -11.5, label: 'עמדה 1' },
    { x: -8.8, label: 'עמדה 2' },
    { x: -6.1, label: 'עמדה 3' },
  ];
  windows.forEach((w, i) => {
    officeChair(w.x, -9.35, '+z');
    monitor(w.x + 0.35, -8.6, '-z');
    addSign(i === 2 ? [w.label, 'סגורה'] : w.label, w.x, 2.35, -8.12, '+z', { width: 1.1, height: 0.36, bg: i === 2 ? '#7f2a24' : '#1f3b73' });
  });
  addSign(['ניתוב', 'הצגת תעודה מזהה וקבלת מדבקה'], -8.7, 2.85, -10.05, '+z', { width: 4, height: 0.6, bg: '#2f3a20', accent: '#f2c94c' });

  // Queue lane with belt stanchions.
  for (const z of [-5.2, -6.8]) {
    for (let x = -3.4; x <= 6.61; x += 2) {
      box(x, 0.45, z, 0.07, 0.9, 0.07, materials.metal, { collide: false });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 12), materials.darkMetal);
      base.position.set(x, 0.015, z);
      scene.add(base);
    }
    box(1.6, 0.88, z, 10, 0.05, 0.02, materials.belt, { collide: false });
    colliders.push({ minX: -3.45, maxX: 6.65, minZ: z - 0.05, maxZ: z + 0.05 });
  }
  addSign('סוף התור', 7.4, 1.6, -6.0, '+z', { width: 0.9, height: 0.3, bg: '#f2c94c', fg: '#1b1b1b' });
  box(7.4, 0.72, -6.0, 0.05, 1.45, 0.05, materials.metal, { collide: false });

  // Directory sign after the security arch.
  addSign(['אולם המתנה – ישר', 'ניתוב משמאל · בדיקות רפואיות מימין'], 3.2, 2.7, -3.25, '+z', {
    width: 5.6,
    height: 0.55,
    bg: '#2f3a20',
  });

  // Vending machine, water cooler, posters on the east side.
  box(13.45, 0.95, -5.6, 0.8, 1.9, 1.0, materials.chair, { block: true });
  const vendingFront = face(
    new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 1.7),
      new THREE.MeshStandardMaterial({
        map: canvasTexture(190, 340, (ctx, w, h) => {
          ctx.fillStyle = '#10243b';
          ctx.fillRect(0, 0, w, h);
          const colors = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#ecf0f1'];
          for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 4; c++) {
              ctx.fillStyle = colors[(r + c) % colors.length];
              ctx.fillRect(14 + c * 40, 20 + r * 52, 26, 38);
            }
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(14, h - 50, w - 28, 30);
        }),
        emissive: '#ffffff',
        emissiveIntensity: 0.15,
      }),
    ),
    '-x',
  );
  vendingFront.position.set(13.04, 1.0, -5.6);
  scene.add(vendingFront);
  box(13.55, 0.6, -7.3, 0.4, 1.2, 0.4, materials.white);
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 12), materials.glass);
  bottle.position.set(13.55, 1.4, -7.3);
  scene.add(bottle);

  addPoster('ברוכים הבאים, מלש״בים!', ['הצגתם תעודה מזהה בניתוב?', 'שימו לב למספר על המסך', 'סדר התחנות משתנה לפי העומס', 'בהצלחה!'], 13.88, 1.7, -9.4, '-x');
  addPoster('מה מביאים לצו ראשון?', ['תעודה מזהה + הצו', 'שאלון רפואי חתום', 'בדיקת שתן ובדיקת ראייה', 'משקפיים, מים ואוכל'], 13.88, 1.7, -3.9, '-x', { color: '#1f3b73' });

  // A toilet door that stays shut.
  box(13.88, 1.1, -11, 0.06, 2.2, 1.0, materials.wood, { collide: false });
  addSign('שירותים', 13.84, 2.45, -11, '-x', { width: 0.9, height: 0.28, bg: '#1f3b73' });

  // ---------- Waiting hall ----------

  const seatMaterial = materials.chair;
  const seatCount = ROW_Z.length * SEAT_XS.length * 2;
  const seats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.06, 0.46), seatMaterial, seatCount);
  const backs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.44, 0.05), seatMaterial, seatCount);
  let seatIndex = 0;
  const seatList = [];
  for (const rowZ of ROW_Z) {
    for (const side of [-1, 1]) {
      const xs = SEAT_XS.map((x) => x * side);
      const minX = Math.min(...xs) - 0.3;
      const maxX = Math.max(...xs) + 0.3;
      box((minX + maxX) / 2, 0.21, rowZ, maxX - minX, 0.06, 0.08, materials.darkMetal, { collide: false });
      for (const x of [minX + 0.1, maxX - 0.1]) box(x, 0.11, rowZ, 0.06, 0.22, 0.4, materials.darkMetal, { collide: false });
      colliders.push({ minX, maxX, minZ: rowZ - 0.26, maxZ: rowZ + 0.3 });

      const row = { z: rowZ, side, seats: [] };
      for (const x of xs) {
        dummy.rotation.set(0, 0, 0);
        dummy.position.set(x, 0.45, rowZ);
        dummy.updateMatrix();
        seats.setMatrixAt(seatIndex, dummy.matrix);
        dummy.position.set(x, 0.7, rowZ + 0.24);
        dummy.rotation.set(-0.08, 0, 0);
        dummy.updateMatrix();
        backs.setMatrixAt(seatIndex, dummy.matrix);
        seatIndex++;
        const seat = { x, z: rowZ, taken: false, row };
        row.seats.push(seat);
        seatList.push(seat);
      }
      const hitbox = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, 0.9, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
      hitbox.position.set((minX + maxX) / 2, 0.45, rowZ);
      scene.add(hitbox);
      row.hitbox = hitbox;
      seatRows.push(row);
    }
  }
  scene.add(seats, backs);

  addSign(['אולם המתנה', 'שבו והסתכלו על המסכים'], 0, 2.8, -12.3, '+z', { width: 3.6, height: 0.6, bg: '#2f3a20' });

  // Queue screens on the back wall.
  const screenState = { called: [], waiting: [], highlight: null };
  const screens = [-5.2, 5.2].map((x) => {
    const texture = canvasTexture(1024, 576, (ctx, w, h) => drawQueueScreen(ctx, w, h, screenState));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    screen.position.set(x, 2.15, -29.84);
    box(x, 2.15, -29.88, 3.32, 1.92, 0.04, materials.darkMetal, { collide: false });
    scene.add(screen);
    return texture;
  });

  function updateScreens(state) {
    Object.assign(screenState, state);
    for (const texture of screens) redraw(texture, (ctx, w, h) => drawQueueScreen(ctx, w, h, screenState));
  }

  // Wall clock that follows the game time.
  const clockTexture = canvasTexture(256, 256, () => {});
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.35, 32), new THREE.MeshStandardMaterial({ map: clockTexture }));
  clock.position.set(2.3, 2.55, -29.86);
  scene.add(clock);
  let clockMinutes = -1;
  function setClock(totalMinutes) {
    const minute = Math.floor(totalMinutes);
    if (minute === clockMinutes) return;
    clockMinutes = minute;
    redraw(clockTexture, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#222222';
      ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.fillStyle = '#222222';
        ctx.fillRect(w / 2 + Math.sin(a) * 100 - 3, h / 2 - Math.cos(a) * 100 - 3, 6, 6);
      }
      const hours = (minute / 60) % 12;
      const hand = (angle, length, width) => {
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(w / 2, h / 2);
        ctx.lineTo(w / 2 + Math.sin(angle) * length, h / 2 - Math.cos(angle) * length);
        ctx.stroke();
      };
      hand((hours / 12) * Math.PI * 2, 60, 9);
      hand(((minute % 60) / 60) * Math.PI * 2, 90, 6);
    });
  }

  plant(-12.8, -28.8);
  plant(12.8, -28.8);
  plant(-12.8, -12.8, 0.9);
  addPoster('הדרך שלך מתחילה כאן', ['ניתוב ← אימות נתונים', 'מבחנים ממוחשבים', 'בדיקות רפואיות', 'ראיון אישי'], -13.88, 1.7, -21.5, '+x', { color: '#2f3a20' });
  addPoster('שקט, בבקשה', ['ליד חדרי המבחנים', 'והראיונות מבקשים', 'לשמור על שקט'], 13.88, 1.7, -24, '-x', { color: '#7f2a24' });

  // Signs over the doors, facing the hall.
  const doorSign = (room, dir) => {
    const offset = { '+x': [0.12, 0], '-x': [-0.12, 0], '+z': [0, 0.12] }[dir];
    addSign([room.name, room.room], room.door.x + offset[0], 2.72, room.door.z + offset[1], dir, { width: 1.9, height: 0.5, bg: '#1f3b73' });
  };
  doorSign(ROOMS.data, '+x');
  doorSign(ROOMS.dapar, '+x');
  doorSign(ROOMS.measure, '-x');
  doorSign(ROOMS.vision, '-x');
  doorSign(ROOMS.doctor, '-x');
  doorSign(ROOMS.interview1, '+z');
  doorSign(ROOMS.interview2, '+z');
  doorSign(ROOMS.interview3, '+z');

  // ---------- Data verification room ----------

  const spots = {};
  desk(-18.2, -16.6);
  officeChair(-18.2, -17.35, '+z');
  officeChair(-18.2, -15.8, '-z');
  monitor(-18.0, -16.85, '-z');
  desk(-22.6, -16.6);
  officeChair(-22.6, -17.35, '+z');
  officeChair(-22.6, -15.8, '-z');
  monitor(-22.4, -16.85, '-z');
  box(-25.6, 1.0, -15.5, 0.6, 2.0, 3.2, materials.wood);
  addPoster('אימות נתונים', ['פרטים אישיים', 'פרטי משפחה', 'השכלה (צה״ר)', 'רמת עברית'], -21, 1.7, -12.12, '-z', { color: '#1f3b73' });
  spots.dataClerk = { x: -18.2, z: -17.35 };
  spots.dataClerk2 = { x: -22.6, z: -17.35 };
  spots.dataCandidate2 = { x: -22.6, z: -15.8 };
  spots.dataChair = { x: -18.2, z: -15.8 };

  // ---------- Computer test room ----------

  const daparStations = [];
  const testScreen = new THREE.MeshStandardMaterial({
    map: canvasTexture(128, 80, (ctx, w, h) => {
      ctx.fillStyle = '#e9eef5';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#1b3a5c';
      ctx.fillRect(0, 0, w, 16);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = '#c7d3e3';
        ctx.fillRect(14, 26 + i * 13, w - 28, 8);
      }
    }),
    emissive: '#ffffff',
    emissiveIntensity: 0.35,
    roughness: 0.4,
  });
  for (const [rowIndex, deskX] of [-19.2, -23.4].entries()) {
    for (let i = 0; i < 7; i++) {
      const z = -20.4 - i * 1.35;
      box(deskX, 0.73, z, 0.75, 0.05, 1.2, materials.desk, { collide: false });
      box(deskX, 0.36, z, 0.65, 0.7, 1.1, materials.trim);
      box(deskX + 0.05, 1.05, z + 0.66, 0.85, 0.6, 0.03, materials.plain, { collide: false });
      monitor(deskX - 0.12, z, '+x', testScreen);
      officeChair(deskX + 0.72, z, '-x');
      const number = rowIndex * 7 + i + 1;
      daparStations.push({ x: deskX + 0.72, z, number });
      const label = makeSign(String(number), { width: 0.24, height: 0.16, bg: '#f2c94c', fg: '#111111' });
      face(label, '+x');
      label.position.set(deskX + 0.38, 0.8, z + 0.42);
      scene.add(label);
    }
  }
  box(-14.9, 1.0, -29.2, 1.4, 2.0, 0.6, materials.metal);
  addSign('לוקרים לטלפונים', -14.9, 2.2, -28.88, '+z', { width: 1.3, height: 0.25, bg: '#3d4247' });
  addPoster('כללי המבחן', ['טלפונים בלוקר', 'בלי מחשבון', 'דף טיוטה אחד', 'הפסקה בין פרקים'], -25.88, 1.7, -24.5, '+x', { color: '#7f2a24' });
  spots.proctor = { x: -15.6, z: -21 };

  // ---------- Medical: measurements ----------

  box(23.8, 0.03, -13.2, 0.55, 0.06, 0.55, materials.white);
  box(23.8, 1.1, -12.95, 0.06, 2.2, 0.06, materials.metal, { collide: false });
  box(23.8, 1.95, -13.15, 0.3, 0.03, 0.3, materials.metal, { collide: false });
  colliders.push({ minX: 23.5, maxX: 24.1, minZ: -13.5, maxZ: -12.9 });
  desk(21, -17.3, 1.2, 0.6);
  box(21.2, 0.85, -17.3, 0.3, 0.18, 0.22, materials.white, { collide: false });
  box(25.4, 0.35, -15, 0.7, 0.7, 1.9, materials.white);
  addPoster('מדידות', ['גובה ומשקל', 'לחץ דם ודופק', 'מסירת שאלון רפואי', 'ובדיקת שתן'], 20, 1.7, -12.12, '-z', { color: '#16a085' });
  spots.measureMedic = { x: 20.4, z: -15.4 };

  // ---------- Medical: vision ----------

  const chart = face(
    new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 1.0),
      new THREE.MeshStandardMaterial({
        map: canvasTexture(280, 400, (ctx, w, h) => {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          const rows = [90, 64, 46, 34, 24, 17, 12];
          let y = 20;
          rows.forEach((size, r) => {
            const count = Math.min(r + 1, 6);
            ctx.font = `800 ${size}px Arial`;
            ctx.fillStyle = '#111111';
            ctx.textBaseline = 'top';
            const gap = w / (count + 1);
            for (let i = 0; i < count; i++) {
              ctx.save();
              ctx.translate(gap * (i + 1), y + size / 2);
              ctx.rotate(((r * 7 + i * 3) % 4) * (Math.PI / 2));
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('E', 0, 0);
              ctx.restore();
            }
            y += size + 10;
          });
        }),
        emissive: '#ffffff',
        emissiveIntensity: 0.25,
      }),
    ),
    '-x',
  );
  chart.position.set(25.88, 1.6, -21);
  scene.add(chart);
  box(19.8, 0.003, -21, 0.08, 0.005, 1.0, new THREE.MeshBasicMaterial({ color: '#f2c94c' }), { collide: false });
  desk(18.6, -22.9, 1.4, 0.7);
  officeChair(18.6, -23.5, '+z');
  addPoster('בדיקת ראייה', ['חדות ראייה', 'עיוורון צבעים', 'משקפיים? להביא!'], 20, 1.7, -18.12, '-z', { color: '#16a085' });
  spots.visionMedic = { x: 18.6, z: -23.5 };

  // ---------- Medical: doctor ----------

  desk(20.5, -25.2);
  officeChair(20.5, -24.55, '-z');
  officeChair(20.5, -26.0, '+z');
  monitor(20.2, -25.0, '+z');
  box(24.3, 0.32, -28.4, 0.85, 0.64, 1.95, materials.white);
  box(24.3, 0.68, -29.15, 0.8, 0.1, 0.4, materials.white, { collide: false });
  const curtain = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.0),
    new THREE.MeshStandardMaterial({ color: '#9ec9d9', side: THREE.DoubleSide, roughness: 0.9 }),
  );
  face(curtain, '+x');
  curtain.position.set(23.2, 1.2, -28.6);
  scene.add(curtain);
  colliders.push({ minX: 23.1, maxX: 23.3, minZ: -29.9, maxZ: -27.3 });
  box(15.4, 0.45, -29.5, 1.2, 0.9, 0.5, materials.white);
  addPoster('ועדה רפואית', ['הפרופיל נקבע כאן', 'אפשר לבקש רופא/ה', 'מאותו מין', 'אפשר לערער'], 25.88, 1.7, -26, '-x', { color: '#16a085' });
  spots.doctor = { x: 20.5, z: -24.55 };
  spots.doctorChair = { x: 20.5, z: -26.0 };

  // ---------- Interview rooms ----------

  for (const key of ['interview1', 'interview2', 'interview3']) {
    const cx = ROOMS[key].door.x;
    desk(cx, -34);
    officeChair(cx, -34.75, '+z');
    officeChair(cx, -33.2, '-z');
    monitor(cx - 0.45, -34.15, '-z');
    plant(cx + 3.6, -37.3, 0.9);
    const window = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 1.2),
      new THREE.MeshBasicMaterial({ color: '#bfe3ff' }),
    );
    window.position.set(cx, 1.8, -37.88);
    scene.add(window);
    box(cx, 1.8, -37.9, 2.36, 1.36, 0.02, materials.trim, { collide: false });
    spots[key] = { interviewer: { x: cx, z: -34.75 }, chair: { x: cx, z: -33.2 } };
  }

  // ---------- Exterior ----------

  function buildExterior() {
    const facadeTexture = canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#d9cfb8';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c9bea5';
      for (let y = 0; y < h; y += 32) ctx.fillRect(0, y, w, 2);
      ctx.fillStyle = '#5a6b7a';
      ctx.fillRect(48, 70, 160, 120);
      ctx.fillStyle = '#8fb3cc';
      ctx.fillRect(56, 78, 68, 104);
      ctx.fillRect(132, 78, 68, 104);
    });
    facadeTexture.wrapS = facadeTexture.wrapT = THREE.RepeatWrapping;

    const facadePart = (x1, x2, y1, y2) => {
      const texture = facadeTexture.clone();
      texture.needsUpdate = true;
      texture.repeat.set((x2 - x1) / 4, (y2 - y1) / 4);
      texture.offset.set(x1 / 4, y1 / 4);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, y2 - y1), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }));
      plane.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0.11);
      scene.add(plane);
    };
    facadePart(-26, -1.6, 0, 8);
    facadePart(1.6, 26, 0, 8);
    facadePart(-1.6, 1.6, 2.3, 8);
    box(0, 4.0, 0.25, 6.2, 0.15, 1.6, materials.trim, { collide: false });
    addSign(['לשכת גיוס', 'כניסה למלש״בים'], 0, 5.0, 0.13, '+z', { width: 4.2, height: 0.9, bg: '#2f3a20', accent: '#f2c94c' });

    // Glass doors, slid open.
    for (const side of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.25, 0.04), materials.glass);
      door.position.set(side * 2.3, 1.13, 0.2);
      scene.add(door);
    }

    // Ground: sidewalk, road, opposite side.
    const paving = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 10.5),
      new THREE.MeshStandardMaterial({ map: tileTexture('#c9c3b6', '#aea796', 80 / 1, 10.5 / 1), roughness: 0.95 }),
    );
    paving.rotation.x = -Math.PI / 2;
    paving.position.set(0, 0, 5.25);
    scene.add(paving);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(80, 7), new THREE.MeshStandardMaterial({ color: '#3a3b3f', roughness: 0.95 }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.002, 14);
    scene.add(road);
    for (let x = -38; x < 40; x += 4) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.15), new THREE.MeshBasicMaterial({ color: '#e8e2d0' }));
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.004, 14);
      scene.add(dash);
    }
    // Red and white curb.
    for (let x = -40; x < 40; x += 1) {
      const curb = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.15, 0.25),
        new THREE.MeshStandardMaterial({ color: Math.round(x) % 2 === 0 ? '#b3362c' : '#ece6d6', roughness: 0.8 }),
      );
      curb.position.set(x + 0.5, 0.075, 10.4);
      scene.add(curb);
    }
    const farSide = new THREE.Mesh(new THREE.PlaneGeometry(80, 30), new THREE.MeshStandardMaterial({ color: '#bdb5a3', roughness: 1 }));
    farSide.rotation.x = -Math.PI / 2;
    farSide.position.set(0, 0, 32.5);
    scene.add(farSide);

    // Buildings across the street.
    for (let i = 0; i < 6; i++) {
      const height = 9 + (i % 3) * 4;
      const texture = facadeTexture.clone();
      texture.needsUpdate = true;
      texture.repeat.set(3, height / 4);
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(12, height, 8),
        new THREE.MeshStandardMaterial({ map: texture, color: ['#ffffff', '#f3e6d0', '#e6eef2'][i % 3], roughness: 0.9 }),
      );
      building.position.set(-33 + i * 13.5, height / 2, 26);
      scene.add(building);
    }

    // Trees along the sidewalk.
    const trunk = new THREE.MeshStandardMaterial({ color: '#6b5a45', roughness: 1 });
    const leaves = new THREE.MeshStandardMaterial({ color: '#4f6f34', roughness: 1, flatShading: true });
    for (const x of [-20, -12, -6, 6, 12, 20]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 3, 6), trunk);
      t.position.set(x, 1.5, 8.6);
      const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0), leaves);
      top.position.set(x, 3.6, 8.6);
      scene.add(t, top);
      colliders.push({ minX: x - 0.25, maxX: x + 0.25, minZ: 8.35, maxZ: 8.85 });
    }

    // Flag pole.
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 9, 10), materials.metal);
    pole.position.set(-5, 4.5, 3.2);
    scene.add(pole);
    colliders.push({ minX: -5.15, maxX: -4.85, minZ: 3.05, maxZ: 3.35 });
    const flagGeometry = new THREE.PlaneGeometry(2.2, 1.6, 16, 8);
    flagGeometry.translate(1.1, 0, 0);
    const flag = new THREE.Mesh(
      flagGeometry,
      new THREE.MeshStandardMaterial({ map: canvasTexture(330, 240, drawIsraeliFlag), side: THREE.DoubleSide, roughness: 0.8 }),
    );
    flag.position.set(-4.95, 8.0, 3.2);
    scene.add(flag);
    const rest = flagGeometry.attributes.position.array.slice();
    updaters.push((t) => {
      const position = flagGeometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const x = rest[i * 3];
        position.setZ(i, Math.sin(x * 2.4 - t * 3) * 0.18 * (x / 2.2));
      }
      position.needsUpdate = true;
      flagGeometry.computeVertexNormals();
    });

    // Bench.
    box(6.5, 0.45, 1.6, 2.0, 0.08, 0.5, materials.wood);
    box(6.5, 0.22, 1.6, 1.8, 0.44, 0.1, materials.darkMetal, { collide: false });

    // Keep the player on this side of the street.
    colliders.push({ minX: -40, maxX: 40, minZ: 10.2, maxZ: 10.6 });
    colliders.push({ minX: -30.5, maxX: -29.5, minZ: 0, maxZ: 11 });
    colliders.push({ minX: 29.5, maxX: 30.5, minZ: 0, maxZ: 11 });
    colliders.push({ minX: -30.5, maxX: -26, minZ: -0.2, maxZ: 0.2 });
    colliders.push({ minX: 26, maxX: 30.5, minZ: -0.2, maxZ: 0.2 });
  }

  return {
    colliders,
    blockers,
    seatRows,
    seatList,
    daparStations,
    spots,
    windows,
    updateScreens,
    setClock,
    openSecurity() {
      const index = colliders.indexOf(securityBarrier);
      if (index >= 0) colliders.splice(index, 1);
      archLight.material.color.set('#3ad16b');
    },
    update(t) {
      for (const fn of updaters) fn(t);
    },
  };
}
