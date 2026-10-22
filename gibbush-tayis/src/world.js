import * as THREE from 'three';
import { canvasTexture, makeSign } from '../../shared/engine/textures.js';
import { mergeStatic } from '../../shared/engine/merge.js';
import { drawIsraeliFlag } from '../../shared/flag.js';

// "גבעת הגיבוש" at Hatzerim (the flight school base, near Be'er Sheva).
//   sports hall (intake, sleeping on some nights)   east,   x ≈ 53 .. 87
//   camp: class tents, container, formation spot     north,  z ≈ 38 .. 60
//   screening-run road                               along z = 26
//   crawl pit                                        middle
//   playground: plum rack, planks, barrels, fence    west
//   the hill (צוקון), sprint lane, digging           south / south-east
//   scout-tent site for the night march              far north-west

export const HALL = { x: 70, z: 50, w: 34, d: 24, h: 9, doorZ: 50 };

export const SPOTS = {
  hallStart: { x: 82, z: 44 },
  medic: { x: 60, z: 41 },
  uniforms: { x: 67, z: 41 },
  helmets: { x: 74, z: 41 },
  classMat: { x: 77, z: 55 },
  stage: { x: 84, z: 50 },
  container: { x: 44, z: 42 },
  tent: { x: 10, z: 48 },
  form: { x: 10, z: 39 },
  gear: { x: 22, z: 38 },
  runStart: { x: 46, z: 26 },
  runTurn: { x: -46, z: 26 },
  crawlStart: { x: -2, z: 19 },
  crawlBag: { x: -2, z: 5 },
  rack: { x: -32, z: 10 },
  planks: { x: -40, z: -4 },
  logs: { x: -24, z: -6 },
  fence: { x: -46, z: 12 },
  board: { x: -16, z: 6 },
  fill: { x: 28, z: -3 },
  crest: { x: 28, z: -19 },
  sprintStart: { x: 52, z: 8 },
  sprintCone: { x: 52, z: -10 },
  dig: { x: 54, z: -24 },
  night: { x: -50, z: 50 },
};

// The march route at night, marked with glow sticks.
export const MARCH = [
  { x: 6, z: 36 },
  { x: -12, z: 32 },
  { x: -34, z: 30 },
  { x: -58, z: 30 },
  { x: -64, z: 42 },
  { x: -54, z: 50 },
];

export const RACK = { ...SPOTS.rack, r: 2.8, barY: 2.3, slots: 16 };

const smooth = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);

/** Ground height at (x, z): flat base areas, a sandy hill to the south, low ridges far away. */
export function height(x, z) {
  // The hill used for the צוקון: the crest runs along z ≈ -19.
  const hx = (x - 28) / 16;
  const hz = (z + 19) / 9;
  const hill = 5.5 * Math.exp(-(hx * hx + hz * hz) * 1.1);
  // Gentle loess ripples everywhere except the hall, the camp and the run road.
  const flat = Math.max(
    1 - smooth(Math.max(Math.abs(x - HALL.x) - HALL.w / 2, Math.abs(z - HALL.z) - HALL.d / 2), 0, 6),
    1 - smooth(Math.abs(z - 26), 2, 6),
    1 - smooth(Math.max(Math.abs(x - 10) - 26, Math.abs(z - 48) - 12), 0, 6),
  );
  const ripples = 0.25 * Math.sin(x * 0.12 + z * 0.07) * Math.sin(z * 0.11 - x * 0.04) * (1 - flat);
  // Low ridges on the horizon.
  const ring = Math.max(0, Math.hypot(x, z) - 110);
  const far = ring * 0.12 * (0.6 + 0.4 * Math.sin(x * 0.03) * Math.cos(z * 0.035));
  return hill + ripples + far;
}

export function buildWorld(scene) {
  const colliders = [];
  const updaters = [];

  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
  const M = {
    olive: mat('#5b6236'),
    oliveDark: mat('#434a28'),
    canvas: mat('#6f7450', { side: THREE.DoubleSide }),
    net: mat('#3b3f33', { side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
    metal: mat('#8b9096', { metalness: 0.5, roughness: 0.5 }),
    rust: mat('#7c5a3e', { metalness: 0.3, roughness: 0.7 }),
    dark: mat('#2b2f33'),
    white: mat('#f2f0ea'),
    tape: mat('#f4f1e6', { emissive: '#ffffff', emissiveIntensity: 0.15 }),
    orange: mat('#ff7a1a', { emissive: '#ff7a1a', emissiveIntensity: 0.25 }),
    sandbag: mat('#c9b48a'),
    wood: mat('#9a7650'),
    log: mat('#7a5a3a'),
    barrel: mat('#3e5a7a', { metalness: 0.3, roughness: 0.6 }),
    concrete: mat('#b9b4a8'),
    hallWall: mat('#d9d2c2'),
    hallRoof: mat('#8e959b', { metalness: 0.4, roughness: 0.6, side: THREE.DoubleSide }),
    floor: mat('#b98a5a'),
    line: mat('#f4f1e6'),
    table: mat('#d8d2c4'),
    mattress: mat('#4f5a3a'),
    container: mat('#7a8a5a', { metalness: 0.3, roughness: 0.6 }),
    tree: mat('#4d6b3a'),
    trunk: mat('#6b5642'),
    glow: new THREE.MeshBasicMaterial({ color: '#7dff8a', toneMapped: false }),
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
      const hx = (Math.abs(Math.cos(rotY)) * sx) / 2 + (Math.abs(Math.sin(rotY)) * sz) / 2;
      const hz = (Math.abs(Math.sin(rotY)) * sx) / 2 + (Math.abs(Math.cos(rotY)) * sz) / 2;
      colliders.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
    }
    return mesh;
  }

  function post(x, z, h = 1.2, material = M.wood, radius = 0.04, lift = 0) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, h, 6), material);
    return onGround(mesh, x, z, h / 2 + lift);
  }

  // A thin bar between two points at heights y1, y2 above the ground.
  function bar(x1, z1, y1, x2, z2, y2, radius = 0.03, material = M.metal) {
    const a = new THREE.Vector3(x1, height(x1, z1) + y1, z1);
    const b = new THREE.Vector3(x2, height(x2, z2) + y2, z2);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 6), material);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    scene.add(mesh);
    return mesh;
  }

  function tape(x1, z1, x2, z2, y = 0.06, material = M.tape, thickness = 0.08) {
    const length = Math.hypot(x2 - x1, z2 - z1);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, 0.02, thickness), material);
    mesh.position.set((x1 + x2) / 2, (height(x1, z1) + height(x2, z2)) / 2 + y, (z1 + z2) / 2);
    mesh.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
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

  function barrel(x, z, lying = false) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.88, 12), M.barrel);
    if (lying) {
      mesh.rotation.z = Math.PI / 2;
      onGround(mesh, x, z, 0.3);
    } else {
      onGround(mesh, x, z, 0.44);
      colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
    }
    return mesh;
  }

  function plank(x, z, length = 3, rotY = 0, lift = 0) {
    return box(x, z, 0.3, 0.06, length, M.wood, { rotY, lift });
  }

  function logPiece(x, z, length = 3, rotY = 0, radius = 0.16) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 8), M.log);
    mesh.rotation.z = Math.PI / 2;
    mesh.rotation.y = rotY;
    return onGround(mesh, x, z, radius);
  }

  // ---------- Ground ----------

  const size = 340;
  const segments = 150;
  const groundGeometry = new THREE.PlaneGeometry(size, size, segments, segments);
  groundGeometry.rotateX(-Math.PI / 2);
  const position = groundGeometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const loess = new THREE.Color('#d2ad80');
  const packed = new THREE.Color('#bf9a6c');
  const sand = new THREE.Color('#e3c89c');
  const road = new THREE.Color('#a8865e');
  const gravel = new THREE.Color('#9d9282');
  const asphalt = new THREE.Color('#55565a');
  const c = new THREE.Color();
  const inRect = (x, z, cx, cz, hw, hd) => Math.abs(x - cx) < hw && Math.abs(z - cz) < hd;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setY(i, height(x, z));
    c.copy(loess).offsetHSL(0, 0, (Math.sin(x * 1.3) * Math.cos(z * 1.1) + Math.random() - 0.5) * 0.025);
    if (inRect(x, z, 10, 46, 30, 12)) c.lerp(packed, 0.55); // Camp.
    if (Math.abs(z - 26) < 1.8 && x > -50 && x < 50) c.lerp(road, 0.75); // Screening-run road.
    if (inRect(x, z, SPOTS.crawlStart.x, 12, 7, 9)) c.lerp(sand, 0.8); // Crawl pit.
    if (inRect(x, z, 28, -12, 14, 14)) c.lerp(sand, 0.5); // The hill.
    if (inRect(x, z, 52, -1, 5, 11)) c.lerp(gravel, 0.75); // Sprint lane / stretcher loop.
    if (inRect(x, z, SPOTS.rack.x - 4, 4, 16, 14)) c.lerp(packed, 0.5); // Playground.
    if (inRect(x, z, HALL.x, HALL.z, HALL.w / 2 + 4, HALL.d / 2 + 4) || inRect(x, z, 48, 46, 6, 6)) c.lerp(asphalt, 0.9);
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
  grain.repeat.set(90, 90);
  const ground = new THREE.Mesh(groundGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, map: grain, roughness: 1 }));
  ground.userData.dynamic = true;
  scene.add(ground);

  // Keep the player inside the gibbush area.
  const R = 78;
  colliders.push({ minX: -R - 1, maxX: -R, minZ: -R, maxZ: R });
  colliders.push({ minX: R + 14, maxX: R + 15, minZ: -R, maxZ: R });
  colliders.push({ minX: -R, maxX: R + 14, minZ: -R - 1, maxZ: -R });
  colliders.push({ minX: -R, maxX: R + 14, minZ: R, maxZ: R + 1 });

  // ---------- Sports hall ----------

  const hx0 = HALL.x - HALL.w / 2;
  const hx1 = HALL.x + HALL.w / 2;
  const hz0 = HALL.z - HALL.d / 2;
  const hz1 = HALL.z + HALL.d / 2;
  const wall = 0.3;
  const door = 5; // Opening in the west wall.
  box(HALL.x, hz0, HALL.w, HALL.h, wall, M.hallWall, { collide: true });
  box(HALL.x, hz1, HALL.w, HALL.h, wall, M.hallWall, { collide: true });
  box(hx1, HALL.z, wall, HALL.h, HALL.d, M.hallWall, { collide: true });
  const sideLen = (HALL.d - door) / 2;
  box(hx0, hz0 + sideLen / 2, wall, HALL.h, sideLen, M.hallWall, { collide: true });
  box(hx0, hz1 - sideLen / 2, wall, HALL.h, sideLen, M.hallWall, { collide: true });
  box(hx0, HALL.z, wall, HALL.h - 3.2, door, M.hallWall, { lift: 3.2 });
  // Curved metal roof, like a real "אולם ספורט" in a base.
  // Half a cylinder lying along x; its local x becomes the arch height, flattened.
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(HALL.d / 2 + 0.6, HALL.d / 2 + 0.6, HALL.w + 0.6, 24, 1, true, 0, Math.PI), M.hallRoof);
  roof.rotation.z = Math.PI / 2;
  roof.scale.set(0.28, 1, 1);
  roof.position.set(HALL.x, HALL.h, HALL.z);
  scene.add(roof);
  // Close the two ends of the arch above the walls.
  const gableMaterial = mat('#d9d2c2', { side: THREE.DoubleSide });
  for (const x of [hx0, hx1]) {
    const gable = new THREE.Mesh(new THREE.CircleGeometry(HALL.d / 2 + 0.6, 24, 0, Math.PI), gableMaterial);
    gable.rotation.y = Math.PI / 2;
    gable.scale.set(1, 0.28, 1);
    gable.position.set(x, HALL.h, HALL.z);
    scene.add(gable);
  }
  // Floor with court lines.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL.w - 0.4, HALL.d - 0.4), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(HALL.x, 0.02, HALL.z);
  scene.add(floor);
  const court = (x1, z1, x2, z2) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.08, Math.abs(x2 - x1)), Math.max(0.08, Math.abs(z2 - z1))), M.line);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((x1 + x2) / 2, 0.03, (z1 + z2) / 2);
    scene.add(mesh);
  };
  court(hx0 + 3, hz0 + 3, hx1 - 3, hz0 + 3);
  court(hx0 + 3, hz1 - 3, hx1 - 3, hz1 - 3);
  court(hx0 + 3, hz0 + 3, hx0 + 3, hz1 - 3);
  court(hx1 - 3, hz0 + 3, hx1 - 3, hz1 - 3);
  court(HALL.x, hz0 + 3, HALL.x, hz1 - 3);
  // Basketball hoops on the short walls.
  for (const [x, dir] of [
    [hx0 + 1.2, 1],
    [hx1 - 1.2, -1],
  ]) {
    if (dir === 1) continue; // The west wall has the door.
    box(x, HALL.z, 0.1, 1.1, 1.8, M.white, { lift: 2.9 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.02, 6, 16), M.orange);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x + dir * 0.35, 3.05, HALL.z);
    scene.add(ring);
  }
  // Stations along the north wall: medic, uniforms, helmets.
  box(SPOTS.medic.x, SPOTS.medic.z - 1.3, 2.4, 0.75, 0.8, M.table, { collide: true });
  box(SPOTS.medic.x + 0.6, SPOTS.medic.z - 1.3, 0.3, 0.2, 0.25, M.white, { lift: 0.75 });
  box(SPOTS.uniforms.x, SPOTS.uniforms.z - 1.3, 2.4, 0.75, 0.8, M.table, { collide: true });
  for (let i = 0; i < 5; i++) box(SPOTS.uniforms.x - 0.9 + i * 0.45, SPOTS.uniforms.z - 1.3, 0.36, 0.12 + (i % 3) * 0.05, 0.42, M.olive, { lift: 0.75 });
  box(SPOTS.helmets.x, SPOTS.helmets.z - 1.3, 2.4, 0.75, 0.8, M.table, { collide: true });
  const helmetGeo = new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const helmet = new THREE.Mesh(helmetGeo, M.oliveDark);
    helmet.position.set(SPOTS.helmets.x - 1 + i * 0.4, 0.78, SPOTS.helmets.z - 1.3);
    scene.add(helmet);
  }
  const hallSign = (text, spot, bg = '#2f3a20') => {
    const sign = makeSign(text, { width: 2.2, height: 0.55, bg });
    sign.position.set(spot.x, 2.6, hz0 + 0.2);
    scene.add(sign);
  };
  hallSign('חובש · רופא', SPOTS.medic, '#7f2a24');
  hallSign('מדים', SPOTS.uniforms);
  hallSign('קסדות ובקבוקים', SPOTS.helmets);
  // Screen for the opening talk on the east wall.
  const screenTexture = canvasTexture(512, 288, (ctx, w, h) => {
    ctx.fillStyle = '#0d1b2e';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f1e8cf';
    ctx.textAlign = 'center';
    ctx.font = '700 46px Heebo, Arial';
    ctx.fillText('גיבוש טיס', w / 2, h * 0.42);
    ctx.font = '400 26px Heebo, Arial';
    ctx.fillText('בית הספר לטיסה · חצרים', w / 2, h * 0.62);
    ctx.strokeStyle = '#f2c94c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w * 0.3, h * 0.75);
    ctx.lineTo(w * 0.7, h * 0.75);
    ctx.stroke();
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2.9), new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false }));
  screen.userData.dynamic = true;
  screen.rotation.y = -Math.PI / 2;
  screen.position.set(hx1 - 0.25, 4, HALL.z);
  scene.add(screen);
  // Mattresses where classes wait (and sleep on cold nights).
  for (let i = 0; i < 16; i++) {
    const x = SPOTS.classMat.x - 6 + (i % 8) * 1.6;
    const z = SPOTS.classMat.z + 2.5 + Math.floor(i / 8) * 2.4;
    box(x, z, 0.75, 0.06, 1.9, M.mattress);
  }
  // Lights inside the hall.
  const hallLight = new THREE.PointLight('#fff4e0', 60, 40, 1.4);
  hallLight.position.set(HALL.x, HALL.h - 1.5, HALL.z);
  scene.add(hallLight);

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
      light = new THREE.SpotLight('#fff1d0', 0, 110, 0.8, 0.6, 1);
      light.position.set(x, height(x, z) + h, z);
      light.target.position.set(target.x, height(target.x, target.z), target.z);
      scene.add(light, light.target);
    }
    towers.push({ headMaterial, light });
  }
  tower(-12, 14, { x: -2, z: 10 }, true); // Crawl pit.
  tower(-22, 2, { x: -32, z: 8 }, true); // Playground.
  tower(26, 34, { x: 10, z: 44 }, true); // Camp.
  tower(-56, 40, { x: -50, z: 50 }, true); // Scout-tent site.
  tower(40, -4, { x: 30, z: -14 }, false);

  const floodlights = {
    setPower(power) {
      for (const t of towers) {
        t.headMaterial.emissiveIntensity = power * 2.5;
        if (t.light) t.light.intensity = power * 170;
      }
    },
  };

  // ---------- Camp ----------

  // Big class tents with the sides rolled up and field beds inside.
  function classTent(x, z, beds = true) {
    const w = 9;
    const d = 6.5;
    for (const [px, pz] of [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [-w / 2, d / 2],
      [w / 2, d / 2],
      [0, -d / 2],
      [0, d / 2],
    ]) {
      post(x + px, z + pz, 1.9, M.wood, 0.05);
    }
    post(x, z, 3.4, M.wood, 0.07);
    // A square pyramid, stretched to the tent's length.
    const roofGeometry = new THREE.ConeGeometry((d / 2 + 0.3) * Math.SQRT2, 1.7, 4, 1, true);
    roofGeometry.rotateY(Math.PI / 4);
    const tentRoof = new THREE.Mesh(roofGeometry, M.canvas);
    tentRoof.scale.set(w / d, 1, 1);
    onGround(tentRoof, x, z, 1.9 + 0.85);
    // Rolled-up side walls.
    for (const side of [-1, 1]) {
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, w, 6), M.oliveDark);
      roll.rotation.z = Math.PI / 2;
      onGround(roll, x, z + (side * d) / 2, 1.85);
    }
    if (!beds) return;
    for (let i = 0; i < 16; i++) {
      const bx = x - w / 2 + 0.75 + (i % 8) * 1.08;
      const bz = z + (i < 8 ? -1.5 : 1.5);
      box(bx, bz, 0.7, 0.05, 1.9, M.olive, { lift: 0.38 });
      for (const [lx, lz] of [
        [-0.3, -0.85],
        [0.3, -0.85],
        [-0.3, 0.85],
        [0.3, 0.85],
      ]) {
        post(bx + lx, bz + lz, 0.38, M.metal, 0.015);
      }
    }
  }
  classTent(SPOTS.tent.x, SPOTS.tent.z);
  classTent(-6, 48);
  classTent(26, 48);
  classTent(-6, 58, false);
  classTent(10, 58, false);
  classTent(26, 58, false);
  signOnPost(['פלוגה ב׳', 'כיתה 4'], SPOTS.tent.x + 5.4, SPOTS.tent.z - 3.6, 0);

  // Gear piled outside the tents (kitbags, rolled mattresses), like in the photos.
  const kitbagGeo = new THREE.CapsuleGeometry(0.2, 0.5, 3, 8);
  for (let i = 0; i < 26; i++) {
    const kb = new THREE.Mesh(kitbagGeo, i % 3 ? M.olive : M.oliveDark);
    kb.rotation.z = Math.PI / 2;
    kb.rotation.y = Math.random() * Math.PI;
    onGround(kb, -10 + (i % 13) * 3.1 + Math.random(), 43 - Math.floor(i / 13) * 0.9, 0.2);
  }

  // Container for the personal bags (no access until the last day).
  box(SPOTS.container.x, SPOTS.container.z - 2, 6, 2.6, 2.4, M.container, { collide: true });
  for (let i = 0; i < 6; i++) box(SPOTS.container.x - 2.5 + i, SPOTS.container.z - 2, 0.06, 2.4, 2.45, M.oliveDark, { lift: 0.1 });
  signOnPost('ציוד אישי · מכולה', SPOTS.container.x + 3.6, SPOTS.container.z - 0.4, 0);

  // Equipment issue tables (קיטבג, תד״ל, שק״ש, מזרן).
  box(SPOTS.gear.x, SPOTS.gear.z - 1.2, 3, 0.75, 0.8, M.table, { collide: true });
  for (let i = 0; i < 4; i++) {
    const kb = new THREE.Mesh(kitbagGeo, M.olive);
    kb.rotation.z = Math.PI / 2;
    onGround(kb, SPOTS.gear.x - 1.2 + i * 0.8, SPOTS.gear.z - 2.4, 0.2);
  }
  signOnPost('אפסנאות גיבוש', SPOTS.gear.x + 2, SPOTS.gear.z - 2.2, 0);

  // Flag.
  post(34, 56, 8, M.metal, 0.06);
  const flagGeometry = new THREE.PlaneGeometry(2, 1.45, 14, 7);
  flagGeometry.translate(1, 0, 0);
  const flag = new THREE.Mesh(flagGeometry, new THREE.MeshStandardMaterial({ map: canvasTexture(330, 240, drawIsraeliFlag), side: THREE.DoubleSide }));
  flag.userData.dynamic = true;
  onGround(flag, 34.05, 56, 7.2);
  const rest = flagGeometry.attributes.position.array.slice();
  updaters.push((t) => {
    const p = flagGeometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(rest[i * 3] * 2.4 - t * 3) * 0.16 * (rest[i * 3] / 2));
    p.needsUpdate = true;
    flagGeometry.computeVertexNormals();
  });

  // ---------- Screening-run road ----------

  const banner = makeSign(['זינוק · סיום', 'ריצת ניפוי 1,000 מ׳'], { width: 4, height: 0.8, bg: '#1f3b73' });
  post(SPOTS.runStart.x, SPOTS.runStart.z - 2.2, 3, M.metal, 0.06);
  post(SPOTS.runStart.x, SPOTS.runStart.z + 2.2, 3, M.metal, 0.06);
  banner.rotation.y = -Math.PI / 2;
  onGround(banner, SPOTS.runStart.x, SPOTS.runStart.z, 2.8);
  const cone = new THREE.ConeGeometry(0.25, 0.6, 12);
  onGround(new THREE.Mesh(cone, M.orange), SPOTS.runTurn.x, SPOTS.runTurn.z, 0.3);
  post(SPOTS.runTurn.x - 0.6, SPOTS.runTurn.z, 2.2, M.metal, 0.04);
  const turnFlag = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), new THREE.MeshStandardMaterial({ color: '#ff7a1a', side: THREE.DoubleSide }));
  onGround(turnFlag, SPOTS.runTurn.x - 0.25, SPOTS.runTurn.z, 1.95);
  for (let x = 40; x > -44; x -= 9) {
    onGround(new THREE.Mesh(cone, M.orange), x, SPOTS.runStart.z - 2, 0.3);
    onGround(new THREE.Mesh(cone, M.orange), x, SPOTS.runStart.z + 2, 0.3);
  }
  signOnPost('500 מ׳ · סיבוב', SPOTS.runTurn.x - 1.2, SPOTS.runTurn.z + 2.8, Math.PI / 2, { bg: '#1f3b73' });

  // ---------- Crawl pit ----------

  const cx = SPOTS.crawlStart.x;
  tape(cx - 7, SPOTS.crawlStart.z, cx + 7, SPOTS.crawlStart.z, 0.05, M.white, 0.14);
  for (const x of [cx - 7, cx + 7]) {
    for (let z = SPOTS.crawlStart.z; z >= SPOTS.crawlBag.z - 2; z -= 4) post(x, z, 0.5);
    tape(x, SPOTS.crawlStart.z, x, SPOTS.crawlBag.z - 2, 0.45);
  }
  // A row of sandbags to crawl to and around.
  for (let x = cx - 6.3; x <= cx + 6.4; x += 1.8) sandbag(x, SPOTS.crawlBag.z, 0.2 * Math.sin(x));
  signOnPost('בריכת זחילות', cx + 8.4, SPOTS.crawlStart.z + 0.6, 0);

  // ---------- Playground ----------

  // The plum rack ("מתלה שזיפים"): a ring of posts, a ring of bars, a shade net on top.
  const posts = 12;
  for (let i = 0; i < posts; i++) {
    const a = (i / posts) * Math.PI * 2;
    const px = RACK.x + Math.cos(a) * RACK.r;
    const pz = RACK.z + Math.sin(a) * RACK.r;
    post(px, pz, 3.1, M.metal, 0.05);
    colliders.push({ minX: px - 0.08, maxX: px + 0.08, minZ: pz - 0.08, maxZ: pz + 0.08 });
    const b = ((i + 1) / posts) * Math.PI * 2;
    bar(px, pz, RACK.barY, RACK.x + Math.cos(b) * RACK.r, RACK.z + Math.sin(b) * RACK.r, RACK.barY, 0.03);
    bar(px, pz, 3.05, RACK.x + Math.cos(b) * RACK.r, RACK.z + Math.sin(b) * RACK.r, 3.05, 0.025);
  }
  const shadeNet = new THREE.Mesh(new THREE.CircleGeometry(RACK.r + 0.4, 24), M.net);
  shadeNet.rotation.x = -Math.PI / 2 + 0.06;
  onGround(shadeNet, RACK.x, RACK.z, 3.15);

  // Planks and barrels ("להעביר את הכיתה בלי לגעת בקרקע").
  barrel(SPOTS.planks.x - 2, SPOTS.planks.z);
  barrel(SPOTS.planks.x + 2.5, SPOTS.planks.z + 1);
  barrel(SPOTS.planks.x + 1, SPOTS.planks.z - 2, true);
  plank(SPOTS.planks.x - 3.5, SPOTS.planks.z + 2, 3.2, 0.3);
  plank(SPOTS.planks.x - 3.1, SPOTS.planks.z + 2.4, 3.2, 0.25);
  tape(SPOTS.planks.x - 6, SPOTS.planks.z - 4, SPOTS.planks.x - 6, SPOTS.planks.z + 4);
  tape(SPOTS.planks.x + 6, SPOTS.planks.z - 4, SPOTS.planks.x + 6, SPOTS.planks.z + 4);
  // Platforms and a concrete block.
  box(SPOTS.planks.x - 7, SPOTS.planks.z, 1.2, 0.4, 1.2, M.wood, { collide: true });
  box(SPOTS.planks.x + 7, SPOTS.planks.z, 1.2, 0.4, 1.2, M.wood, { collide: true });
  box(SPOTS.planks.x, SPOTS.planks.z + 5, 3, 1.4, 0.4, M.concrete, { collide: true });

  // Logs and beams.
  logPiece(SPOTS.logs.x, SPOTS.logs.z, 4.5, 0.2, 0.2);
  logPiece(SPOTS.logs.x + 1.5, SPOTS.logs.z + 2, 2.4, -0.4);
  logPiece(SPOTS.logs.x - 1.4, SPOTS.logs.z + 2.6, 2.4, 0.9);
  logPiece(SPOTS.logs.x + 0.4, SPOTS.logs.z - 2.2, 2.4, 1.4);
  logPiece(SPOTS.logs.x + 2.4, SPOTS.logs.z - 1.2, 2.4, 0.1);

  // Low wire fence to dig under.
  for (const dz of [-2, 2]) post(SPOTS.fence.x, SPOTS.fence.z + dz, 0.6, M.metal, 0.03);
  bar(SPOTS.fence.x, SPOTS.fence.z - 2, 0.22, SPOTS.fence.x, SPOTS.fence.z + 2, 0.22, 0.01, M.dark);
  bar(SPOTS.fence.x, SPOTS.fence.z - 2, 0.42, SPOTS.fence.x, SPOTS.fence.z + 2, 0.42, 0.01, M.dark);

  // Human checkers: a 6×6 board drawn in the sand.
  for (let i = 0; i <= 6; i++) {
    tape(SPOTS.board.x - 3, SPOTS.board.z - 3 + i, SPOTS.board.x + 3, SPOTS.board.z - 3 + i, 0.03, M.tape, 0.05);
    tape(SPOTS.board.x - 3 + i, SPOTS.board.z - 3, SPOTS.board.x - 3 + i, SPOTS.board.z + 3, 0.03, M.tape, 0.05);
  }
  signOnPost('מגרש המשחקים', SPOTS.rack.x + 5, SPOTS.rack.z + 4.5, 0);

  // ---------- The hill (צוקון) ----------

  // Sand to fill bags at the bottom, piles at the top: one per candidate and one for the class.
  const sandPile = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.1, 14), mat('#e0c393'));
  onGround(sandPile, SPOTS.fill.x - 3.5, SPOTS.fill.z + 0.5, 0.45);
  for (let i = 0; i < 8; i++) sandbag(SPOTS.fill.x - 1 + (i % 4) * 0.6, SPOTS.fill.z + 1.4 + Math.floor(i / 4) * 0.4, 0.1 * i);
  for (let i = 0; i < 8; i++) {
    const x = SPOTS.crest.x - 7 + i * 2;
    post(x, SPOTS.crest.z - 1.2, 0.7, M.wood, 0.04);
  }
  const classPeg = makeSign('ערימה כיתתית', { width: 1.5, height: 0.4 });
  onGround(classPeg, SPOTS.crest.x + 10, SPOTS.crest.z - 1.2, 1.1);
  post(SPOTS.crest.x + 10, SPOTS.crest.z - 1.2, 0.95, M.wood, 0.04);
  tape(SPOTS.fill.x - 8, SPOTS.fill.z - 1, SPOTS.fill.x + 12, SPOTS.fill.z - 1, 0.05, M.white, 0.12);

  // ---------- Sprint lane and stretcher loop ----------

  tape(SPOTS.sprintStart.x - 4, SPOTS.sprintStart.z, SPOTS.sprintStart.x + 4, SPOTS.sprintStart.z, 0.05, M.white, 0.14);
  onGround(new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 14), M.orange), SPOTS.sprintCone.x, SPOTS.sprintCone.z, 0.4);
  for (const x of [SPOTS.sprintStart.x - 4.2, SPOTS.sprintStart.x + 4.2]) {
    for (let z = SPOTS.sprintStart.z; z >= SPOTS.sprintCone.z; z -= 3) onGround(new THREE.Mesh(cone, M.orange), x, z, 0.3);
  }

  // ---------- Digging ----------

  for (let i = 0; i < 4; i++) {
    const x = SPOTS.dig.x - 4.5 + i * 3;
    const z = SPOTS.dig.z;
    tape(x - 0.5, z - 0.5, x + 0.5, z - 0.5);
    tape(x - 0.5, z + 0.5, x + 0.5, z + 0.5);
    tape(x - 0.5, z - 0.5, x - 0.5, z + 0.5);
    tape(x + 0.5, z - 0.5, x + 0.5, z + 0.5);
  }
  // The shared class pit.
  const gx = SPOTS.dig.x;
  const gz = SPOTS.dig.z - 4;
  tape(gx - 2, gz - 1, gx + 2, gz - 1, 0.06, M.orange);
  tape(gx - 2, gz + 1, gx + 2, gz + 1, 0.06, M.orange);
  tape(gx - 2, gz - 1, gx - 2, gz + 1, 0.06, M.orange);
  tape(gx + 2, gz - 1, gx + 2, gz + 1, 0.06, M.orange);
  signOnPost('חפירה', SPOTS.dig.x + 6.5, SPOTS.dig.z - 1, 0);

  // ---------- Night march route and the scout-tent site ----------

  const glowGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.18, 5);
  for (let i = 0; i < MARCH.length - 1; i++) {
    const a = MARCH[i];
    const b = MARCH[i + 1];
    const steps = Math.floor(Math.hypot(b.x - a.x, b.z - a.z) / 4);
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      const stick = new THREE.Mesh(glowGeo, M.glow);
      stick.rotation.z = 0.5;
      onGround(stick, x + (s % 2 ? 1.2 : -1.2), z, 0.06);
    }
  }
  for (let i = 0; i < 6; i++) {
    tape(SPOTS.night.x - 6 + i * 2.4, SPOTS.night.z - 3, SPOTS.night.x - 6 + i * 2.4, SPOTS.night.z + 3, 0.04, M.tape, 0.05);
  }

  // ---------- Hatzerim around the gibbush area ----------

  // Base fence.
  for (let x = -R; x <= R + 14; x += 6) post(x, -R - 2, 2.2, M.metal, 0.04);
  bar(-R, -R - 2, 2.1, R + 14, -R - 2, 2.1, 0.015, M.metal);
  bar(-R, -R - 2, 1.2, R + 14, -R - 2, 1.2, 0.015, M.metal);
  // Hardened aircraft shelters and a control tower in the distance.
  const shelterGeo = new THREE.CylinderGeometry(9, 9, 22, 18, 1, false, 0, Math.PI);
  for (const [x, z] of [
    [150, -40],
    [150, 0],
    [150, 40],
    [-40, -150],
    [10, -150],
  ]) {
    const shelter = new THREE.Mesh(shelterGeo, M.concrete);
    shelter.rotation.z = Math.PI / 2;
    shelter.rotation.y = Math.abs(x) > 100 ? 0 : Math.PI / 2;
    shelter.scale.set(0.75, 1, 1);
    shelter.position.set(x, height(x, z), z);
    scene.add(shelter);
  }
  box(120, 90, 4, 22, 4, M.concrete);
  box(120, 90, 6, 3, 6, mat('#2d4b5a', { metalness: 0.4, roughness: 0.3 }), { lift: 22 });
  // Eucalyptus tree line to the north, like on the edge of the base.
  const crown = new THREE.SphereGeometry(2.6, 8, 6);
  const trunk = new THREE.CylinderGeometry(0.25, 0.35, 5, 6);
  for (let i = 0; i < 40; i++) {
    const x = -150 + i * 8 + Math.sin(i * 7) * 3;
    const z = 110 + Math.cos(i * 3) * 6;
    onGround(new THREE.Mesh(trunk, M.trunk), x, z, 2.5);
    const top = new THREE.Mesh(crown, M.tree);
    top.scale.set(1, 1.4 + (i % 3) * 0.2, 1);
    onGround(top, x, z, 6.5);
  }

  mergeStatic(scene);

  // ---------- Aircraft overhead ----------
  // "Throughout the gibbush, the flight school's planes and Hatzerim's fighter jets fly above the candidates."

  const jetMaterial = mat('#8d949b', { metalness: 0.4, roughness: 0.5 });
  const trainerMaterial = mat('#f2f2ee');
  const trainerStripe = mat('#c0392b');
  function jet() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.25, 14, 8), jetMaterial);
    body.rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.5, 8), jetMaterial);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 8.2;
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 3);
    wingShape.lineTo(-4.8, -2);
    wingShape.lineTo(4.8, -2);
    wingShape.closePath();
    const wings = new THREE.Mesh(new THREE.ShapeGeometry(wingShape), jetMaterial);
    wings.material.side = THREE.DoubleSide;
    wings.rotation.x = -Math.PI / 2;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 2.2), jetMaterial);
    fin.position.set(0, 1.4, -5.5);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(5, 0.08, 1.6), jetMaterial);
    tail.position.z = -6;
    g.add(body, nose, wings, fin, tail);
    return g;
  }
  function trainer() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.3, 9, 8), trainerMaterial);
    body.rotation.x = Math.PI / 2;
    const wings = new THREE.Mesh(new THREE.BoxGeometry(10, 0.12, 1.6), trainerMaterial);
    wings.position.z = 0.8;
    const tips = new THREE.Mesh(new THREE.BoxGeometry(10.05, 0.13, 0.4), trainerStripe);
    tips.position.z = 0.8;
    tips.scale.x = 1;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 1), trainerMaterial);
    tail.position.z = -4;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 1.2), trainerStripe);
    fin.position.set(0, 0.8, -4);
    g.add(body, wings, tips, tail, fin);
    return g;
  }
  const flights = [
    { jets: true, craft: [jet(), jet()], altitude: 160, speed: 140, period: 55, offset: 5, from: [-500, -60], to: [500, 40] },
    { craft: [trainer()], altitude: 110, speed: 60, period: 40, offset: 20, from: [80, 500], to: [-60, -500] },
    { jets: true, craft: [jet()], altitude: 220, speed: 160, period: 70, offset: 45, from: [400, -400], to: [-400, 300] },
  ];
  for (const f of flights) {
    f.dir = new THREE.Vector3(f.to[0] - f.from[0], 0, f.to[1] - f.from[1]);
    f.length = f.dir.length();
    f.dir.normalize();
    f.craft.forEach((craft, i) => {
      craft.rotation.y = Math.atan2(f.dir.x, f.dir.z);
      craft.userData.dynamic = true;
      craft.userData.wing = i;
      craft.visible = false;
      scene.add(craft);
    });
  }
  const hooks = { onFlyover: null };
  updaters.push((t) => {
    for (const f of flights) {
      const local = (t + f.offset) % f.period;
      const travel = local * f.speed;
      const flying = travel < f.length;
      // A jet's roar starts as it appears (the stage plays the sound).
      if (flying && !f.wasFlying && f.jets) hooks.onFlyover?.();
      f.wasFlying = flying;
      f.craft.forEach((craft, i) => {
        craft.visible = flying;
        if (!flying) return;
        // Wingmen fly behind and to the side.
        const back = i * 30;
        const sideX = -f.dir.z * i * 25;
        const sideZ = f.dir.x * i * 25;
        craft.position.set(f.from[0] + f.dir.x * (travel - back) + sideX, f.altitude + i * 6, f.from[1] + f.dir.z * (travel - back) + sideZ);
      });
    }
  });

  return {
    hooks,
    colliders,
    blockers: [],
    floodlights,
    sandbagMaterial: M.sandbag,
    metalMaterial: M.metal,
    oliveMaterial: M.olive,
    woodMaterial: M.wood,
    canvasMaterial: M.canvas,
    update(t) {
      for (const fn of updaters) fn(t);
    },
  };
}
