import * as THREE from 'three';
import { canvasTexture, makeSign } from '../../shared/engine/textures.js';
import { mergeStatic } from '../../shared/engine/merge.js';
import { drawIsraeliFlag } from '../../shared/flag.js';

// The field site: a camp on flat sand next to a big dune.
//   camp (buses, check-in, sleeping area)  z ≈ 30 .. 55
//   threshold-run track                    along z = 22
//   the drill dune: start line at z = 0, crest at z = -36
//   digging area to the east, team-task area to the west

export const DUNE = {
  startZ: 0,
  crawlEndZ: -12,
  bagRowZ: -14,
  crestZ: -36,
  halfWidth: 12,
  cones: [
    { x: -8, z: -36 },
    { x: 0, z: -36 },
    { x: 8, z: -36 },
  ],
};

export const SPOTS = {
  arrival: { x: 33, z: 46 },
  checkin: { x: 24, z: 40 },
  medic: { x: 16, z: 40 },
  water: { x: 8, z: 46 },
  camp: { x: -18, z: 42 },
  circle: { x: 2, z: 30 },
  runStart: { x: 32, z: 22 },
  runTurn: { x: -48, z: 22 },
  briefing: { x: 0, z: 6 },
  dig: { x: 34, z: -4 },
  map: { x: -34, z: 2 },
  pile: { x: -38, z: 13 },
  pyramid: { x: -28, z: 10 },
};

const smooth = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);

/** Ground height at (x, z). */
export function height(x, z) {
  const t = THREE.MathUtils.clamp(-z / 36, 0, 1);
  const rise = t * t * (3 - 2 * t);
  const fall = z < -36 ? 1 - smooth(-z, 36, 80) : 1;
  const across = 1 - smooth(Math.abs(x), 18, 40);
  const dune = 7 * rise * fall * across;
  const ripples = 0.22 * Math.sin(x * 0.21 + z * 0.13) * Math.sin(z * 0.17 - x * 0.05);
  // Bigger dunes on the horizon.
  const ring = Math.max(0, Math.hypot(x, z - 10) - 72);
  const far = ring * 0.14 * (0.65 + 0.35 * Math.sin(x * 0.045) * Math.cos(z * 0.05));
  return dune + ripples + far;
}

export function buildWorld(scene) {
  const colliders = [];
  const updaters = [];

  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
  const M = {
    olive: mat('#5b6236'),
    oliveDark: mat('#434a28'),
    canvas: mat('#7a7d55'),
    metal: mat('#8b9096', { metalness: 0.5, roughness: 0.5 }),
    dark: mat('#2b2f33'),
    white: mat('#f2f0ea'),
    tape: mat('#f4f1e6', { emissive: '#ffffff', emissiveIntensity: 0.15 }),
    orange: mat('#ff7a1a', { emissive: '#ff7a1a', emissiveIntensity: 0.25 }),
    sandbag: mat('#c9b48a'),
    jerrycan: mat('#4f6b3a'),
    wood: mat('#9a7650'),
    table: mat('#d8d2c4'),
    plastic: mat('#2f5d8a'),
  };

  // ---------- Helpers ----------

  function onGround(object, x, z, lift = 0) {
    object.position.set(x, height(x, z) + lift, z);
    scene.add(object);
    return object;
  }

  function box(x, z, sx, sy, sz, material, { lift = 0, collide = false, rotY = 0 } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.rotation.y = rotY;
    onGround(mesh, x, z, sy / 2 + lift);
    if (collide) {
      const hx = Math.abs(Math.cos(rotY)) * sx / 2 + Math.abs(Math.sin(rotY)) * sz / 2;
      const hz = Math.abs(Math.sin(rotY)) * sx / 2 + Math.abs(Math.cos(rotY)) * sz / 2;
      colliders.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
    }
    return mesh;
  }

  function post(x, z, h = 1.2, material = M.wood, radius = 0.04) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, h, 6), material);
    return onGround(mesh, x, z, h / 2);
  }

  // A tape line between two points, a bit above the sand.
  function tape(x1, z1, x2, z2, y = 0.06, material = M.tape, thickness = 0.08) {
    const length = Math.hypot(x2 - x1, z2 - z1);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, 0.02, thickness), material);
    const mx = (x1 + x2) / 2;
    const mz = (z1 + z2) / 2;
    mesh.position.set(mx, (height(x1, z1) + height(x2, z2)) / 2 + y, mz);
    mesh.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    // Tilt along slopes (the box's +x end points at the second point).
    mesh.rotation.z = Math.atan2(height(x2, z2) - height(x1, z1), length);
    scene.add(mesh);
    return mesh;
  }

  function signOnPost(text, x, z, facing = 0, options = {}) {
    post(x, z, 2.2, M.wood, 0.05);
    const sign = makeSign(text, { width: 1.8, height: 0.5, ...options });
    sign.rotation.y = facing;
    onGround(sign, x, z, 2.0);
    return sign;
  }

  function sandbag(x, z, rotY = 0, lift = 0) {
    return box(x, z, 0.52, 0.2, 0.32, M.sandbag, { rotY, lift });
  }

  function jerrycan(x, z, rotY = 0) {
    return box(x, z, 0.18, 0.34, 0.27, M.jerrycan, { rotY });
  }

  // ---------- Ground ----------

  const size = 260;
  const segments = 130;
  const groundGeometry = new THREE.PlaneGeometry(size, size, segments, segments);
  groundGeometry.rotateX(-Math.PI / 2);
  const position = groundGeometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const sand = new THREE.Color('#d9bd8f');
  const packed = new THREE.Color('#b99a6c');
  const track = new THREE.Color('#a8885e');
  const c = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setY(i, height(x, z));
    c.copy(sand).offsetHSL(0, 0, (Math.sin(x * 1.7) * Math.cos(z * 1.3) + Math.random() - 0.5) * 0.02);
    // Footprint-packed sand where the drills happen, and the running track.
    if (Math.abs(x) < 14 && z < 2 && z > -38) c.lerp(packed, 0.45);
    if (Math.abs(z - 22) < 1.6 && x > -50 && x < 34) c.lerp(track, 0.7);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  groundGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  groundGeometry.computeVertexNormals();
  const grain = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) {
      const v = 200 + Math.random() * 55;
      ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
  });
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(70, 70);
  const ground = new THREE.Mesh(groundGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, map: grain, roughness: 1 }));
  ground.userData.dynamic = true;
  scene.add(ground);

  // Keep the player inside the site.
  const R = 68;
  colliders.push({ minX: -R - 1, maxX: -R, minZ: -R, maxZ: R });
  colliders.push({ minX: R, maxX: R + 1, minZ: -R, maxZ: R });
  colliders.push({ minX: -R, maxX: R, minZ: -R - 1, maxZ: -R });
  colliders.push({ minX: -R, maxX: R, minZ: R, maxZ: R + 1 });

  // ---------- Floodlights ----------

  const towers = [];
  function tower(x, z, target, withLight) {
    const h = 9;
    post(x, z, h, M.metal, 0.12);
    colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
    const headMaterial = new THREE.MeshStandardMaterial({ color: '#333333', emissive: '#fff4d6', emissiveIntensity: 0 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.3), headMaterial);
    head.userData.dynamic = true;
    onGround(head, x, z, h);
    head.lookAt(target.x, height(target.x, target.z) + 2, target.z);
    let light = null;
    if (withLight) {
      light = new THREE.SpotLight('#fff1d0', 0, 120, 0.75, 0.6, 1);
      light.position.set(x, height(x, z) + h, z);
      light.target.position.set(target.x, height(target.x, target.z), target.z);
      scene.add(light, light.target);
    }
    towers.push({ headMaterial, light });
  }
  tower(-18, 6, { x: -2, z: -18 }, true);
  tower(18, 6, { x: 2, z: -18 }, true);
  tower(-6, 34, { x: -10, z: 40 }, false);
  tower(28, 30, { x: 20, z: 38 }, false);

  const campLight = new THREE.PointLight('#ffcf8a', 0, 30, 1.5);
  campLight.position.set(SPOTS.circle.x, height(SPOTS.circle.x, SPOTS.circle.z) + 1.2, SPOTS.circle.z);
  scene.add(campLight);

  const floodlights = {
    setPower(power) {
      for (const t of towers) {
        t.headMaterial.emissiveIntensity = power * 2.5;
        if (t.light) t.light.intensity = power * 190;
      }
      campLight.intensity = power * 18;
    },
  };

  // ---------- Camp ----------

  // Buses that brought everyone.
  const busTexture = canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f4f4f0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1f5fa8';
    ctx.fillRect(0, h * 0.72, w, h * 0.12);
    ctx.fillStyle = '#26323d';
    for (let i = 0; i < 9; i++) ctx.fillRect(20 + i * 54, 18, 44, 40);
  });
  for (const [x, z] of [
    [42, 50],
    [42, 56],
  ]) {
    const bus = new THREE.Mesh(new THREE.BoxGeometry(11, 3, 2.6), [
      M.white,
      M.white,
      M.white,
      M.white,
      new THREE.MeshStandardMaterial({ map: busTexture, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ map: busTexture, roughness: 0.6 }),
    ]);
    bus.userData.dynamic = true;
    onGround(bus, x, z, 1.85);
    colliders.push({ minX: x - 5.6, maxX: x + 5.6, minZ: z - 1.4, maxZ: z + 1.4 });
    for (const wx of [-3.6, 3.6]) {
      for (const wz of [-1.25, 1.25]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 14), M.dark);
        wheel.rotation.x = Math.PI / 2;
        onGround(wheel, x + wx, z + wz, 0.5);
      }
    }
  }

  // Check-in and medical tables under a shade net.
  const shade = new THREE.Mesh(new THREE.BoxGeometry(16, 0.05, 6), M.canvas);
  onGround(shade, 20, 40.5, 2.6);
  for (const [px, pz] of [
    [12.2, 37.7],
    [27.8, 37.7],
    [12.2, 43.3],
    [27.8, 43.3],
  ]) {
    post(px, pz, 2.6, M.metal, 0.05);
  }
  box(SPOTS.checkin.x, SPOTS.checkin.z - 1.2, 2.2, 0.75, 0.8, M.table, { collide: true });
  box(SPOTS.medic.x, SPOTS.medic.z - 1.2, 1.8, 0.75, 0.8, M.table, { collide: true });
  box(SPOTS.medic.x + 0.4, SPOTS.medic.z - 1.2, 0.35, 0.2, 0.25, M.white, { lift: 0.75 });
  signOnPost(['קליטה', 'יום שדה · מספרים'], SPOTS.checkin.x + 1.8, SPOTS.checkin.z - 2.4, 0, { bg: '#2f3a20' });
  signOnPost('מרפאה', SPOTS.medic.x - 1.8, SPOTS.medic.z - 2.4, 0, { bg: '#7f2a24' });

  // Water station.
  box(SPOTS.water.x, SPOTS.water.z, 2, 0.8, 0.8, M.table, { collide: true });
  for (let i = 0; i < 6; i++) jerrycan(SPOTS.water.x - 0.75 + i * 0.3, SPOTS.water.z, 0);
  signOnPost('תחנת מים', SPOTS.water.x + 1.4, SPOTS.water.z - 0.8, 0, { bg: '#1f3b73' });

  // Sleeping area: tents and rows of sleeping bags on mats.
  function tent(x, z, rotY = 0) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(6, 1.4, 4), M.olive);
    base.position.y = 0.7;
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 6, 3, 1), M.oliveDark);
    // A 3-sided cylinder lying along x, turned so one edge is the ridge on top.
    roof.rotation.z = Math.PI / 2;
    roof.rotation.x = -Math.PI / 2;
    roof.position.y = 2.05;
    roof.scale.set(1, 1, 0.75);
    group.add(base, roof);
    group.rotation.y = rotY;
    onGround(group, x, z);
    colliders.push({ minX: x - 3.2, maxX: x + 3.2, minZ: z - 2.2, maxZ: z + 2.2 });
  }
  tent(-32, 50);
  tent(-22, 52);
  tent(-12, 52);
  const bagColors = ['#2d4f7a', '#7a2d2d', '#3d5a2d', '#5a4a2d', '#2d2d2d', '#4a2d5a'];
  const bagMaterials = bagColors.map((color) => mat(color));
  const matMaterial = mat('#5a7a3a');
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 9; i++) {
      const x = -32 + i * 2.2;
      const z = 38 + row * 3.4;
      box(x, z, 0.9, 0.02, 2.0, matMaterial);
      box(x, z + 0.1, 0.75, 0.22, 1.85, bagMaterials[(row * 9 + i) % bagMaterials.length], { lift: 0.02 });
    }
  }
  signOnPost('אזור שינה', -20, 34.5, 0, { bg: '#2f3a20' });

  // Interview circle around a lantern.
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.4, 10), new THREE.MeshStandardMaterial({ color: '#ffdca0', emissive: '#ffb347', emissiveIntensity: 1.5 }));
  lantern.userData.dynamic = true;
  onGround(lantern, SPOTS.circle.x, SPOTS.circle.z, 0.2);

  // Flag pole by the camp.
  post(6, 54, 8, M.metal, 0.06);
  const flagGeometry = new THREE.PlaneGeometry(2, 1.45, 14, 7);
  flagGeometry.translate(1, 0, 0);
  const flag = new THREE.Mesh(
    flagGeometry,
    new THREE.MeshStandardMaterial({ map: canvasTexture(330, 240, drawIsraeliFlag), side: THREE.DoubleSide }),
  );
  flag.userData.dynamic = true;
  onGround(flag, 6.05, 54, 7.2);
  const rest = flagGeometry.attributes.position.array.slice();
  updaters.push((t) => {
    const p = flagGeometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(rest[i * 3] * 2.4 - t * 3) * 0.16 * (rest[i * 3] / 2));
    p.needsUpdate = true;
    flagGeometry.computeVertexNormals();
  });

  // ---------- Threshold-run track ----------

  const banner = makeSign(['זינוק · סיום', 'ריצת 1,200 מטר'], { width: 4, height: 0.8, bg: '#7f2a24' });
  post(SPOTS.runStart.x, SPOTS.runStart.z - 2.2, 3, M.metal, 0.06);
  post(SPOTS.runStart.x, SPOTS.runStart.z + 2.2, 3, M.metal, 0.06);
  banner.rotation.y = -Math.PI / 2;
  onGround(banner, SPOTS.runStart.x, SPOTS.runStart.z, 2.8);
  const turnMaterial = M.orange;
  const cone = new THREE.ConeGeometry(0.25, 0.6, 12);
  const turnCone = new THREE.Mesh(cone, turnMaterial);
  onGround(turnCone, SPOTS.runTurn.x, SPOTS.runTurn.z, 0.3);
  post(SPOTS.runTurn.x - 0.6, SPOTS.runTurn.z, 2.2, M.metal, 0.04);
  const turnFlag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), new THREE.MeshStandardMaterial({ color: '#ff7a1a', side: THREE.DoubleSide }));
  onGround(turnFlag, SPOTS.runTurn.x - 0.25, SPOTS.runTurn.z, 1.95);
  for (let x = 26; x > -46; x -= 8) {
    onGround(new THREE.Mesh(cone, turnMaterial), x, SPOTS.runStart.z - 1.8, 0.3);
    onGround(new THREE.Mesh(cone, turnMaterial), x, SPOTS.runStart.z + 1.8, 0.3);
  }
  signOnPost('600 מ׳ · סיבוב', SPOTS.runTurn.x - 1.2, SPOTS.runTurn.z + 2.6, Math.PI / 2, { bg: '#7f2a24' });

  // ---------- Drill dune ----------

  const w = DUNE.halfWidth + 1;
  tape(-w, DUNE.startZ, w, DUNE.startZ, 0.05, M.white, 0.14); // Start line.
  tape(-w, DUNE.crawlEndZ, w, DUNE.crawlEndZ); // End of the crawl.
  for (const x of [-w, w]) {
    for (let z = DUNE.startZ; z >= DUNE.crawlEndZ; z -= 4) post(x, z, 0.6);
    tape(x, DUNE.startZ, x, DUNE.crawlEndZ, 0.55);
  }
  for (let x = -11; x <= 11; x += 1.6) sandbag(x, DUNE.bagRowZ, 0.1 * Math.sin(x));
  for (const c of DUNE.cones) onGround(new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 14), M.orange), c.x, c.z, 0.4);
  signOnPost('קו זינוק', -w - 1.4, DUNE.startZ + 0.6, 0, { bg: '#2f3a20' });
  signOnPost('סוף זחילה', w + 1.4, DUNE.crawlEndZ, 0, { bg: '#2f3a20' });

  // Spare stretcher and jerrycans next to the start line.
  const stretcherFrame = new THREE.Group();
  for (const side of [-0.32, 0.32]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.3, 6), M.metal);
    pole.rotation.x = Math.PI / 2;
    pole.position.set(side, 0.15, 0);
    stretcherFrame.add(pole);
  }
  const bed = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 1.8), M.olive);
  bed.position.y = 0.15;
  stretcherFrame.add(bed);
  stretcherFrame.rotation.y = 0.2;
  onGround(stretcherFrame, -17, 2.5);
  for (let i = 0; i < 4; i++) jerrycan(-15.2 + i * 0.3, 3.4);

  // ---------- Digging area ----------

  for (let i = 0; i < 4; i++) {
    const x = SPOTS.dig.x - 4.5 + i * 3;
    const z = SPOTS.dig.z;
    tape(x - 0.5, z - 0.5, x + 0.5, z - 0.5);
    tape(x - 0.5, z + 0.5, x + 0.5, z + 0.5);
    tape(x - 0.5, z - 0.5, x - 0.5, z + 0.5);
    tape(x + 0.5, z - 0.5, x + 0.5, z + 0.5);
  }
  signOnPost('חפירה', SPOTS.dig.x + 6.5, SPOTS.dig.z - 1, 0, { bg: '#2f3a20' });

  // ---------- Team tasks ----------

  const mapPatch = new THREE.Mesh(new THREE.PlaneGeometry(7, 9), new THREE.MeshStandardMaterial({ color: '#e3cba0', roughness: 1 }));
  mapPatch.rotation.x = -Math.PI / 2;
  onGround(mapPatch, SPOTS.map.x, SPOTS.map.z, 0.04);
  for (const [dx, dz] of [
    [-3.5, -4.5],
    [3.5, -4.5],
    [-3.5, 4.5],
    [3.5, 4.5],
  ]) {
    post(SPOTS.map.x + dx, SPOTS.map.z + dz, 0.5);
  }
  for (let i = 0; i < 16; i++) {
    sandbag(SPOTS.pile.x + (i % 4) * 0.55 - 0.8, SPOTS.pile.z + Math.floor(i / 4) * 0.36 - 0.5, 0, (i % 3) * 0.2);
  }
  colliders.push({ minX: SPOTS.pile.x - 1.2, maxX: SPOTS.pile.x + 1.2, minZ: SPOTS.pile.z - 0.8, maxZ: SPOTS.pile.z + 0.8 });
  const px = SPOTS.pyramid.x;
  const pz = SPOTS.pyramid.z;
  tape(px - 1.3, pz - 0.6, px + 1.3, pz - 0.6);
  tape(px - 1.3, pz + 0.6, px + 1.3, pz + 0.6);
  signOnPost('משימות צוות', SPOTS.map.x + 4.6, SPOTS.map.z + 5.2, 0, { bg: '#2f3a20' });

  mergeStatic(scene);

  return {
    colliders,
    blockers: [],
    floodlights,
    sandbagMaterial: M.sandbag,
    jerrycanMaterial: M.jerrycan,
    metalMaterial: M.metal,
    oliveMaterial: M.olive,
    update(t) {
      for (const fn of updaters) fn(t);
    },
  };
}
