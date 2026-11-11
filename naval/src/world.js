import * as THREE from 'three';
import { canvasTexture, makeSign, makePoster } from '../../shared/engine/textures.js';
import { mergeStatic } from '../../shared/engine/merge.js';
import { drawIsraeliFlag } from '../../shared/flag.js';

// The naval gibbush site (עתלית, by the official page): the camp in the north, the drill dune in the middle,
// and over its crest the beach, the sea, a pier with a Sa'ar 6 and the boats. Far to the east, a separate
// little world: the inside of a submarine, for the tour on the last day (the March 2024 account).
// The layout keeps the same names as the יום סיירות dune (DUNE, SPOTS, height) so the shared drills run here.

export const DUNE = {
  startZ: 0,
  crawlEndZ: -12,
  bagRowZ: -14,
  crestZ: -30,
  halfWidth: 12,
  cones: [
    { x: -8, z: -30 },
    { x: 0, z: -30 },
    { x: 8, z: -30 },
  ],
};

export const SEA = { level: -0.35, shoreZ: -60 };

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
  hall: { x: -30, z: 36 },
  dark: { x: 30, z: 54 },
  committee: { x: 8, z: 56 },
  beach: { x: 0, z: -55 },
  boats: { x: -12, z: -57 },
  raft: { x: -6, z: -68 },
  pier: { x: 14, z: -58 },
  ship: { x: 21, z: -86 },
  rope: { x: 26, z: -50 },
  sub: { x: 400, z: 0 },
};

export const SUB = { x: 400, length: 34, radius: 2.3, floor: 0.0 };
export const inSub = (x) => x > 300;

const smooth = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);

/** Ground height at (x, z): the dune, the beach down to the water, low hills around. */
export function height(x, z) {
  if (inSub(x)) return SUB.floor;
  const t = THREE.MathUtils.clamp(-z / 30, 0, 1);
  const rise = t * t * (3 - 2 * t);
  const fall = z < -30 ? 1 - smooth(-z, 30, 50) : 1;
  const across = 1 - smooth(Math.abs(x), 18, 40);
  const dune = 5 * rise * fall * across;
  const ripples = 0.18 * Math.sin(x * 0.21 + z * 0.13) * Math.sin(z * 0.17 - x * 0.05);
  // The beach slopes into the sea south of the dune.
  const beach = -2.8 * smooth(-z, 50, 78);
  // Low hills on the land side only.
  const ring = z > -40 ? Math.max(0, Math.hypot(x, z - 10) - 72) : 0;
  const far = ring * 0.12 * (0.65 + 0.35 * Math.sin(x * 0.045) * Math.cos(z * 0.05));
  return dune + ripples * (z > -52 ? 1 : 0.3) + beach + far;
}

/**
 * options.checkinSign: the text on the check-in sign; options.groundHeight: a different ground (the Shayetet
 * stage adds a pool); options.extra(scene, helpers): more things to build before the static meshes are merged.
 */
export function buildWorld(scene, { checkinSign = ['קליטה', 'גיבוש חובלים / צוללות'], groundHeight = null, extra = null } = {}) {
  const H = groundHeight ?? height;
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
    stone: mat('#d9cfb8'),
    navy: mat('#1f3b73'),
    grey: mat('#8d96a0', { metalness: 0.3, roughness: 0.55 }),
    greyDark: mat('#5d666f', { metalness: 0.3, roughness: 0.6 }),
    deck: mat('#6f7378'),
    wood: mat('#9a7650'),
    table: mat('#d8d2c4'),
    sandbag: mat('#c9b48a'),
    rubber: mat('#2e3134', { roughness: 0.6 }),
    orange: mat('#ff6a1a', { roughness: 0.7 }),
    asphalt: mat('#5d5f5c', { roughness: 1 }),
    tape: mat('#f4f1e6', { emissive: '#ffffff', emissiveIntensity: 0.15 }),
    cone: mat('#ff7a1a', { emissive: '#ff7a1a', emissiveIntensity: 0.25 }),
  };

  function onGround(object, x, z, lift = 0) {
    object.position.set(x, H(x, z) + lift, z);
    scene.add(object);
    return object;
  }
  function box(x, z, sx, sy, sz, material, { lift = 0, collide = false, rotY = 0, y = null } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.rotation.y = rotY;
    if (y === null) onGround(mesh, x, z, sy / 2 + lift);
    else {
      mesh.position.set(x, y, z);
      scene.add(mesh);
    }
    if (collide) {
      const hx = (Math.abs(Math.cos(rotY)) * sx) / 2 + (Math.abs(Math.sin(rotY)) * sz) / 2;
      const hz = (Math.abs(Math.sin(rotY)) * sx) / 2 + (Math.abs(Math.cos(rotY)) * sz) / 2;
      colliders.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
    }
    return mesh;
  }
  function post(x, z, h = 1.2, material = M.wood, radius = 0.04, y = null) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, h, 8), material);
    if (y === null) return onGround(mesh, x, z, h / 2);
    mesh.position.set(x, y + h / 2, z);
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

  // ---------- Ground ----------

  const size = 300;
  const segments = 150;
  const groundGeometry = new THREE.PlaneGeometry(size, size, segments, segments);
  groundGeometry.rotateX(-Math.PI / 2);
  groundGeometry.translate(0, 0, -20);
  const position = groundGeometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const sand = new THREE.Color('#dcc497');
  const wet = new THREE.Color('#a8916a');
  const packed = new THREE.Color('#bba06f');
  const c = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const h = H(x, z);
    position.setY(i, h);
    c.copy(sand).offsetHSL(0, 0, (Math.sin(x * 1.7) * Math.cos(z * 1.3) + Math.random() - 0.5) * 0.02);
    if (Math.abs(x) < 14 && z < 2 && z > -32) c.lerp(packed, 0.45);
    if (h < SEA.level + 0.5) c.lerp(wet, THREE.MathUtils.clamp((SEA.level + 0.5 - h) * 1.5, 0, 1));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  groundGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  groundGeometry.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.userData.dynamic = true;
  scene.add(ground);

  // ---------- The sea ----------

  const seaUniforms = { time: { value: 0 } };
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 300, 1, 1),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: seaUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float time;
        varying vec3 vWorld;
        void main() {
          vec2 p = vWorld.xz;
          float w = sin(p.x * 0.35 + time * 0.9) * cos(p.y * 0.28 - time * 0.7) + 0.5 * sin((p.x + p.y) * 0.9 + time * 1.7);
          float far = clamp((-p.y - 60.0) / 140.0, 0.0, 1.0);
          vec3 shallow = vec3(0.24, 0.62, 0.66);
          vec3 deep = vec3(0.05, 0.27, 0.45);
          vec3 col = mix(shallow, deep, far) + w * 0.03;
          // Foam where the waves meet the sand.
          float foam = smoothstep(-54.5, -56.5, p.y) * (1.0 - smoothstep(-56.5, -59.5, p.y)) * (0.6 + 0.4 * sin(p.x * 0.6 + time * 2.0));
          col = mix(col, vec3(0.95), foam * 0.55);
          float sparkle = pow(max(0.0, w), 6.0) * 0.25;
          gl_FragColor = vec4(col + sparkle, 0.9);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }),
  );
  sea.rotation.x = -Math.PI / 2;
  // The ground goes under the water at about z = -56; the sea starts just before that.
  sea.position.set(0, SEA.level, -52 - 150);
  sea.userData.dynamic = true;
  sea.renderOrder = 1;
  scene.add(sea);
  updaters.push((t) => {
    seaUniforms.time.value = t;
  });

  // Keep the player in the site (the water's edge is a wall, except on the pier).
  const R = 68;
  colliders.push({ minX: -R - 1, maxX: -R, minZ: -66, maxZ: R });
  colliders.push({ minX: R, maxX: R + 1, minZ: -66, maxZ: R });
  colliders.push({ minX: -R, maxX: R, minZ: R, maxZ: R + 1 });
  colliders.push({ minX: -R, maxX: SPOTS.pier.x - 1.4, minZ: -66, maxZ: -65 });
  colliders.push({ minX: SPOTS.pier.x + 1.4, maxX: R, minZ: -66, maxZ: -65 });

  // ---------- Floodlights and the parade ground ----------

  const towers = [];
  function tower(x, z, target, withLight) {
    const h = 9;
    post(x, z, h, M.metal, 0.12);
    colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
    const headMaterial = new THREE.MeshStandardMaterial({ color: '#333333', emissive: '#fff4d6', emissiveIntensity: 0 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 0.3), headMaterial);
    head.userData.dynamic = true;
    onGround(head, x, z, h);
    head.lookAt(target.x, H(target.x, target.z) + 2, target.z);
    let light = null;
    if (withLight) {
      light = new THREE.SpotLight('#fff1d0', 0, 120, 0.75, 0.6, 1);
      light.position.set(x, H(x, z) + h, z);
      light.target.position.set(target.x, H(target.x, target.z), target.z);
      scene.add(light, light.target);
    }
    towers.push({ headMaterial, light });
  }
  tower(-18, 6, { x: -2, z: -18 }, true);
  tower(18, 6, { x: 2, z: -18 }, true);
  tower(-6, 34, { x: -10, z: 40 }, false);
  tower(16, -48, { x: 0, z: -58 }, true);
  const campLight = new THREE.PointLight('#ffcf8a', 0, 30, 1.5);
  campLight.position.set(SPOTS.circle.x, H(SPOTS.circle.x, SPOTS.circle.z) + 1.2, SPOTS.circle.z);
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

  // Parade ground with the flags.
  box(4, 32, 22, 0.04, 12, M.asphalt);
  post(4, 37.5, 8, M.metal, 0.06);
  const flagTexture = canvasTexture(330, 240, drawIsraeliFlag);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.15), new THREE.MeshStandardMaterial({ map: flagTexture, side: THREE.DoubleSide }));
  flag.userData.dynamic = true;
  onGround(flag, 4.85, 37.5, 7.3);
  updaters.push((t) => {
    flag.rotation.y = Math.sin(t * 1.3) * 0.15;
  });
  const navyFlag = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1),
    new THREE.MeshStandardMaterial({
      side: THREE.DoubleSide,
      map: canvasTexture(256, 180, (ctx, w, h) => {
        ctx.fillStyle = '#1f3b73';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#f2f0ea';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 46, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#f2f0ea';
        ctx.fillRect(w / 2 - 6, h / 2 - 60, 12, 120);
        ctx.fillRect(w / 2 - 40, h / 2 - 50, 80, 10);
      }),
    }),
  );
  navyFlag.userData.dynamic = true;
  post(0, 37.5, 6, M.metal, 0.05);
  onGround(navyFlag, 0.75, 37.5, 5.4);

  // ---------- Camp ----------

  // Low stone buildings of the base: the hall (tests, lectures, interviews), the committee, the dark room.
  function building(x, z, w, d, h, label, door = 'south') {
    box(x, z, w, h, d, M.stone, { collide: true });
    box(x, z, w + 0.4, 0.25, d + 0.4, M.greyDark, { lift: h });
    const dz = door === 'south' ? -d / 2 - 0.02 : d / 2 + 0.02;
    box(x, z + dz, 1.1, 2.1, 0.05, M.dark);
    for (const wx of [-w / 3, w / 3]) box(x + wx, z + dz, 1.2, 0.8, 0.05, M.navy, { lift: 1.2 });
    if (label) {
      const sign = makeSign(label, { width: 2.2, height: 0.5, bg: '#1f3b73' });
      sign.rotation.y = door === 'south' ? Math.PI : 0;
      onGround(sign, x, z + dz * 1.02, h - 0.5);
    }
  }
  building(SPOTS.hall.x, SPOTS.hall.z + 4, 14, 7, 3.6, 'כיתות', 'south');
  building(SPOTS.committee.x, SPOTS.committee.z + 4, 10, 6, 3.6, 'מפקדת הגיבוש', 'south');
  // A shipping container: the "dark room" in the accounts.
  box(SPOTS.dark.x, SPOTS.dark.z + 2, 6, 2.6, 2.4, mat('#4f6b3a'), { collide: true });
  box(SPOTS.dark.x, SPOTS.dark.z + 0.78, 1, 2.1, 0.04, M.dark);

  // Buses.
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
    const bus = new THREE.Mesh(new THREE.BoxGeometry(11, 3, 2.6), [M.white, M.white, M.white, M.white, new THREE.MeshStandardMaterial({ map: busTexture }), new THREE.MeshStandardMaterial({ map: busTexture })]);
    bus.userData.dynamic = true;
    onGround(bus, x, z, 1.85);
    colliders.push({ minX: x - 5.6, maxX: x + 5.6, minZ: z - 1.4, maxZ: z + 1.4 });
  }

  // Check-in and medic under a shade net, water station.
  const shade = new THREE.Mesh(new THREE.BoxGeometry(16, 0.05, 6), M.canvas);
  onGround(shade, 20, 40.5, 2.6);
  for (const [px, pz] of [
    [12.2, 37.7],
    [27.8, 37.7],
    [12.2, 43.3],
    [27.8, 43.3],
  ]) post(px, pz, 2.6, M.metal, 0.05);
  box(SPOTS.checkin.x, SPOTS.checkin.z - 1.2, 2.2, 0.75, 0.8, M.table, { collide: true });
  box(SPOTS.medic.x, SPOTS.medic.z - 1.2, 1.8, 0.75, 0.8, M.table, { collide: true });
  signOnPost(checkinSign, SPOTS.checkin.x + 1.8, SPOTS.checkin.z - 2.4, 0, { bg: '#1f3b73' });
  signOnPost('מרפאה', SPOTS.medic.x - 1.8, SPOTS.medic.z - 2.4, 0, { bg: '#7f2a24' });
  box(SPOTS.water.x, SPOTS.water.z, 2, 0.8, 0.8, M.table, { collide: true });
  signOnPost('תחנת מים', SPOTS.water.x + 1.4, SPOTS.water.z - 0.8, 0, { bg: '#1f3b73' });

  // Tents.
  function tent(x, z) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(6, 1.4, 4), M.olive);
    base.position.y = 0.7;
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 6, 3, 1), M.oliveDark);
    roof.rotation.z = Math.PI / 2;
    roof.rotation.x = -Math.PI / 2;
    roof.position.y = 2.05;
    roof.scale.set(1, 1, 0.75);
    group.add(base, roof);
    onGround(group, x, z);
    colliders.push({ minX: x - 3.2, maxX: x + 3.2, minZ: z - 2.2, maxZ: z + 2.2 });
  }
  tent(-32, 50);
  tent(-22, 52);
  tent(-12, 52);

  // The run track and its cones.
  for (let x = SPOTS.runTurn.x; x <= SPOTS.runStart.x; x += 8) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 10), M.cone);
    onGround(cone, x, SPOTS.runStart.z - 1.4, 0.22);
  }
  signOnPost('ריצת סינון', SPOTS.runStart.x + 2, SPOTS.runStart.z - 2, Math.PI, { bg: '#2f3a20' });

  // ---------- The drill dune ----------

  for (const cone of DUNE.cones) {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 12), M.cone);
    onGround(mesh, cone.x, cone.z, 0.35);
  }
  function tape(x1, z1, x2, z2) {
    const length = Math.hypot(x2 - x1, z2 - z1);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, 0.02, 0.08), M.tape);
    mesh.position.set((x1 + x2) / 2, (H(x1, z1) + H(x2, z2)) / 2 + 0.06, (z1 + z2) / 2);
    mesh.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    scene.add(mesh);
  }
  tape(-DUNE.halfWidth, DUNE.startZ, DUNE.halfWidth, DUNE.startZ);
  tape(-DUNE.halfWidth, DUNE.bagRowZ, DUNE.halfWidth, DUNE.bagRowZ);
  for (let i = 0; i < 10; i++) box(-9 + i * 2, DUNE.bagRowZ - 0.5, 0.52, 0.2, 0.32, M.sandbag);
  // Digging area, the sandbag pile, the team-task area (the drills use them).
  box(SPOTS.pile.x, SPOTS.pile.z, 2.2, 0.6, 1.4, M.sandbag, { collide: true });
  signOnPost('חפירות', SPOTS.dig.x + 3, SPOTS.dig.z + 3, 0, { bg: '#2f3a20' });

  // ---------- The beach: boats, the raft, the rope, the pier and the ship ----------

  function makeBoat(color) {
    const group = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const tube = new THREE.CapsuleGeometry(0.24, 2.6, 4, 10);
    tube.rotateX(Math.PI / 2);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(tube, hullMat);
      side.position.set(s * 0.62, 0.14, 0);
      group.add(side);
    }
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.24, 8, 12, Math.PI), hullMat);
    bow.rotation.x = -Math.PI / 2;
    bow.position.set(0, 0.14, -1.55);
    group.add(bow);
    const stern = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.46, 0.18), hullMat);
    stern.position.set(0, 0.14, 1.55);
    group.add(stern);
    const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 3), M.dark);
    group.add(floorMesh);
    // Paddles across.
    for (const pz of [-0.6, 0.5]) {
      const paddle = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.03, 0.1), M.wood);
      paddle.position.set(0, 0.1, pz);
      group.add(paddle);
    }
    group.traverse((o) => {
      o.userData.dynamic = true;
    });
    scene.add(group);
    return group;
  }
  const boats = [makeBoat('#2e3134'), makeBoat('#3b4148'), makeBoat('#2e3134')];
  boats.forEach((b, i) => {
    b.position.set(SPOTS.boats.x - 4 + i * 4, H(SPOTS.boats.x, SPOTS.boats.z) + 0.25, SPOTS.boats.z);
  });
  signOnPost('סירות', SPOTS.boats.x + 7, SPOTS.boats.z + 2, Math.PI, { bg: '#1f3b73' });

  // The closed raft ("סירת הקאות"): a round life raft with a canopy, floating off the beach.
  const raft = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.32, 10, 24), M.orange);
  ring.rotation.x = Math.PI / 2;
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ff8a2a', roughness: 0.8, side: THREE.DoubleSide }));
  canopy.scale.y = 0.85;
  const opening = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), M.dark);
  opening.position.set(0, 0.55, 1.55);
  raft.add(ring, canopy, opening);
  raft.traverse((o) => {
    o.userData.dynamic = true;
  });
  raft.position.set(SPOTS.raft.x, SEA.level + 0.1, SPOTS.raft.z);
  scene.add(raft);
  updaters.push((t) => {
    raft.position.y = SEA.level + 0.1 + Math.sin(t * 1.1) * 0.08;
    raft.rotation.z = Math.sin(t * 0.8) * 0.05;
    raft.rotation.x = Math.sin(t * 0.6 + 1) * 0.04;
    for (const [i, b] of boats.entries()) if (b.userData.afloat) b.position.y = SEA.level + 0.18 + Math.sin(t * 1.2 + i) * 0.06;
  });

  // The tug-of-war rope on the beach.
  const ropeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 14, 8), mat('#d9b46a'));
  ropeMesh.rotation.z = Math.PI / 2;
  ropeMesh.userData.dynamic = true;
  onGround(ropeMesh, SPOTS.rope.x, SPOTS.rope.z, 0.9);

  // The pier: planks on posts, from the beach into the sea.
  const pierLen = 34;
  const pz0 = -60;
  box(SPOTS.pier.x, pz0 - pierLen / 2, 3, 0.25, pierLen, M.deck, { y: 0.55 });
  for (let z = pz0; z >= pz0 - pierLen; z -= 4) {
    for (const dx of [-1.3, 1.3]) post(SPOTS.pier.x + dx, z, 3.2, M.greyDark, 0.12, -2.7);
  }
  for (let z = pz0; z >= pz0 - pierLen; z -= 2) {
    for (const dx of [-1.45, 1.45]) post(SPOTS.pier.x + dx, z, 0.9, M.metal, 0.025, 0.68);
  }
  // Walls along the pier so the player stays on it.
  colliders.push({ minX: SPOTS.pier.x - 1.6, maxX: SPOTS.pier.x - 1.4, minZ: pz0 - pierLen, maxZ: pz0 });
  colliders.push({ minX: SPOTS.pier.x + 1.4, maxX: SPOTS.pier.x + 1.6, minZ: pz0 - pierLen, maxZ: pz0 });
  colliders.push({ minX: SPOTS.pier.x - 1.6, maxX: SPOTS.pier.x + 1.6, minZ: pz0 - pierLen - 0.4, maxZ: pz0 - pierLen });

  // The Sa'ar 6 alongside the pier (a simple grey model; the shape is the game's, not a plan of the ship).
  const ship = new THREE.Group();
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-3.4, 0);
  hullShape.lineTo(3.4, 0);
  hullShape.lineTo(3.6, 2.6);
  hullShape.lineTo(-3.6, 2.6);
  hullShape.closePath();
  const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape, { depth: 76, bevelEnabled: false }), M.grey);
  hull.position.set(0, -1.6, -38);
  ship.add(hull);
  const bowGeo = new THREE.ConeGeometry(3.6, 12, 4, 1);
  bowGeo.rotateX(-Math.PI / 2);
  bowGeo.rotateZ(Math.PI / 4);
  const bowMesh = new THREE.Mesh(bowGeo, M.grey);
  bowMesh.scale.set(1, 0.72, 1);
  bowMesh.position.set(0, -0.3, -44);
  ship.add(bowMesh);
  const deckMesh = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.15, 76), M.deck);
  deckMesh.position.set(0, 1.05, 0);
  ship.add(deckMesh);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 14), M.grey);
  bridge.position.set(0, 3.6, -6);
  ship.add(bridge);
  const bridgeWin = new THREE.Mesh(new THREE.BoxGeometry(6.05, 0.7, 2), M.dark);
  bridgeWin.position.set(0, 5.3, -12.4);
  ship.add(bridgeWin);
  const mast = new THREE.Mesh(new THREE.BoxGeometry(2.6, 7, 2.6), M.greyDark);
  mast.position.set(0, 9.6, -4);
  ship.add(mast);
  const radar = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 0.3), M.dark);
  radar.position.set(0, 12.4, -4);
  ship.add(radar);
  const gun = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 1.2, 12), M.grey);
  gun.position.set(0, 1.8, -24);
  ship.add(gun);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 8), M.greyDark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 2.1, -26.5);
  ship.add(barrel);
  const hangar = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.6, 12), M.grey);
  hangar.position.set(0, 2.9, 10);
  ship.add(hangar);
  const number = makeSign('ש-6', { width: 2.2, height: 1.2, bg: '#8d96a0', fg: '#1b1f24' });
  number.rotation.y = -Math.PI / 2;
  number.position.set(-3.65, 0.2, -30);
  ship.add(number);
  ship.traverse((o) => {
    o.userData.dynamic = true;
  });
  ship.position.set(SPOTS.ship.x, SEA.level, SPOTS.ship.z);
  scene.add(ship);
  updaters.push((t) => {
    ship.rotation.z = Math.sin(t * 0.4) * 0.008;
  });

  // ---------- The submarine (inside), far to the east ----------

  const sub = new THREE.Group();
  const shellM = new THREE.MeshStandardMaterial({ color: '#c9ccc4', roughness: 0.7, side: THREE.BackSide });
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(SUB.radius, SUB.radius, SUB.length, 24, 1, false), shellM);
  shell.rotation.x = Math.PI / 2;
  shell.position.set(SUB.x, 1.35, 0);
  sub.add(shell);
  const floorPlate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, SUB.length), mat('#4a4e52', { metalness: 0.4 }));
  floorPlate.position.set(SUB.x, -0.02, 0);
  sub.add(floorPlate);
  // Pipes along the ceiling and the walls.
  const pipeM = [mat('#b8862c', { metalness: 0.5 }), mat('#2f6f9a', { metalness: 0.3 }), mat('#a33b2b', { metalness: 0.3 }), mat('#9aa0a6', { metalness: 0.6 })];
  for (let i = 0; i < 9; i++) {
    const a = -0.9 + i * 0.22;
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05 + (i % 3) * 0.02, 0.05 + (i % 3) * 0.02, SUB.length - 0.6, 8), pipeM[i % pipeM.length]);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(SUB.x + Math.sin(a) * (SUB.radius - 0.25), 1.35 + Math.cos(a) * (SUB.radius - 0.25), 0);
    sub.add(pipe);
  }
  // Bulkheads with round hatches, every 8 m.
  const hatchM = mat('#7d8288', { metalness: 0.5 });
  for (const z of [-8, 0, 8]) {
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 8, 24), hatchM);
    ringMesh.position.set(SUB.x, 1.0, z);
    sub.add(ringMesh);
    for (const s of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.2, 0.12), mat('#b4b8b0'));
      wall.position.set(SUB.x + s * 1.45, 1.35, z);
      sub.add(wall);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.2, 0.12), mat('#b4b8b0'));
    top.position.set(SUB.x, 2.15, z);
    sub.add(top);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.45, 0.12), mat('#b4b8b0'));
    sill.position.set(SUB.x, 0.2, z);
    sub.add(sill);
  }
  // Bunks (crew quarters, aft), control room (middle), torpedo room (fore).
  for (let z = 10; z < 16; z += 2.1) {
    for (const s of [-1, 1]) {
      for (const level of [0.35, 1.05, 1.75]) {
        const bunk = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 1.9), mat('#3d5a80'));
        bunk.position.set(SUB.x + s * 1.35, level, z);
        sub.add(bunk);
      }
    }
  }
  const screenM = new THREE.MeshStandardMaterial({ color: '#0a2a1a', emissive: '#2cff9a', emissiveIntensity: 0.6 });
  const amberM = new THREE.MeshStandardMaterial({ color: '#2a1a0a', emissive: '#ffb02c', emissiveIntensity: 0.6 });
  for (let z = -6; z < 6; z += 1.4) {
    for (const s of [-1, 1]) {
      const desk = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 1.2), mat('#5a5f66'));
      desk.position.set(SUB.x + s * 1.45, 0.55, z);
      sub.add(desk);
      const screen = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.8), (Math.round(z) + s) % 3 ? screenM : amberM);
      screen.position.set(SUB.x + s * 1.13, 1.45, z);
      screen.rotation.z = s * 0.25;
      sub.add(screen);
    }
  }
  const periscope = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.4, 12), mat('#3a3d40', { metalness: 0.5 }));
  periscope.position.set(SUB.x, 1.5, -1);
  sub.add(periscope);
  const handles = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.1), mat('#1b1d20'));
  handles.position.set(SUB.x, 1.35, -1);
  sub.add(handles);
  for (let z = -16; z < -10; z += 0.9) {
    for (const s of [-1, 1]) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 2.6, 14), mat('#7e848a', { metalness: 0.6 }));
      tube.rotation.x = Math.PI / 2;
      tube.position.set(SUB.x + s * 0.75, 0.6 + (Math.round(z * 10) % 2) * 0.65, -15);
      sub.add(tube);
    }
  }
  const lamps = [];
  for (const z of [-12, -4, 4, 12]) {
    const lamp = new THREE.PointLight('#fff2d6', 5, 9, 1.6);
    lamp.position.set(SUB.x, 2.6, z);
    sub.add(lamp);
    lamps.push(lamp);
  }
  scene.add(sub);
  colliders.push({ minX: SUB.x - 1.4, maxX: SUB.x - 1.0, minZ: -SUB.length / 2, maxZ: SUB.length / 2 });
  colliders.push({ minX: SUB.x + 1.0, maxX: SUB.x + 1.4, minZ: -SUB.length / 2, maxZ: SUB.length / 2 });
  colliders.push({ minX: SUB.x - 1.4, maxX: SUB.x + 1.4, minZ: -SUB.length / 2 - 0.4, maxZ: -SUB.length / 2 + 1.4 });
  colliders.push({ minX: SUB.x - 1.4, maxX: SUB.x + 1.4, minZ: SUB.length / 2 - 1.4, maxZ: SUB.length / 2 + 0.4 });
  const subSign = makePoster('צוללת', ['מחלקת לוחמה', 'אסור לגעת בכלום', 'רק במה שמראים לך'], { width: 0.7, height: 0.9, color: '#1f3b73' });
  subSign.rotation.y = Math.PI;
  subSign.position.set(SUB.x + 0.95, 1.5, 7.9);
  subSign.rotation.y = -Math.PI / 2;
  scene.add(subSign);

  const built = extra?.(scene, { box, post, signOnPost, onGround, colliders, updaters, M }) ?? {};
  mergeStatic(scene);

  return {
    colliders,
    blockers: [],
    floodlights,
    boats,
    raft,
    ship,
    sandbagMaterial: M.sandbag,
    jerrycanMaterial: mat('#4f6b3a'),
    metalMaterial: M.metal,
    oliveMaterial: M.olive,
    subLamps: lamps,
    ...built,
    update(t) {
      for (const fn of updaters) fn(t);
    },
  };
}
