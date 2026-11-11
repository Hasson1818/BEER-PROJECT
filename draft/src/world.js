import * as THREE from 'three';
import { canvasTexture, makeSign, makePoster, tileTexture } from '../../shared/engine/textures.js';
import { mergeStatic } from '../../shared/engine/merge.js';

// Two places in one scene:
//   the pool on a base (around the origin): a 25 m pool, 6 lanes, deck, fence, changing rooms, shade
//   your room at home (around x = -90): bed, desk, window; the phone gets the draft messages there
// The pool depth (2.20 m) is from one prep site (2022); where the pool is was never published.

export const POOL = {
  halfX: 6.25, // 12.5 m wide: six lanes
  halfZ: 12.5, // 25 m long
  water: -0.12, // water surface (the deck is at 0)
  bottom: -2.2,
  lanes: [-5.2, -3.125, -1.04, 1.04, 3.125, 5.2],
};

export const SPOTS = {
  gate: { x: 12, z: 26 },
  checkin: { x: 9, z: 21.5 },
  medic: { x: 13.5, z: 18 },
  lockers: { x: -6, z: 23 },
  briefing: { x: 0, z: 15.2 },
  bench: { x: 10.5, z: 4 },
  edgeEast: { x: 7.2, z: 0 },
  edgeWest: { x: -7.2, z: 0 },
  table: { x: 10.5, z: -9 },
  lifeguard: { x: -8.6, z: -4 },
  circle: { x: 0, z: -3 },
  weights: { x: -1.04, z: 4 },
  psych: { x: 12.2, z: -16 },
  home: { x: -90, z: 0 },
};

export const inPool = (x, z) => Math.abs(x) < POOL.halfX && Math.abs(z) < POOL.halfZ;

/** Floor height: the deck, or the bottom of the pool. */
export function height(x, z) {
  return inPool(x, z) ? POOL.bottom : 0;
}

/** Where people stand "in" the water: feet low enough that only the head and shoulders stay out. */
export const TREAD_Y = POOL.water - 1.42;

export function buildWorld(scene) {
  const colliders = [];
  const updaters = [];
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
  const M = {
    deck: new THREE.MeshStandardMaterial({ map: tileTexture('#e9e4d8', '#d2cbbb', 60, 60), roughness: 0.9 }),
    tile: new THREE.MeshStandardMaterial({ map: tileTexture('#8fd0e6', '#6fb6cf', 40, 6), roughness: 0.4 }),
    tileFloor: new THREE.MeshStandardMaterial({ map: tileTexture('#9ad8ec', '#7cc2da', 50, 100), roughness: 0.4 }),
    laneLine: mat('#1d3f8a'),
    coping: mat('#f4f2ec'),
    olive: mat('#5b6236'),
    wall: mat('#d8d2c2'),
    roof: mat('#9a9f8a'),
    metal: mat('#b9bec4', { metalness: 0.6, roughness: 0.35 }),
    dark: mat('#2b2f33'),
    fence: mat('#6f7a5a', { metalness: 0.3, roughness: 0.6 }),
    net: new THREE.MeshStandardMaterial({ color: '#4d5a3c', transparent: true, opacity: 0.78, side: THREE.DoubleSide, roughness: 1 }),
    shade: new THREE.MeshStandardMaterial({ color: '#6f8a5a', transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 1 }),
    wood: mat('#9a7650'),
    white: mat('#f2f0ea'),
    red: mat('#c0392b'),
    orange: mat('#ff7a1a'),
    plastic: mat('#2f5d8a'),
    grass: mat('#7d9a4f', { roughness: 1 }),
    asphalt: mat('#5d5f5c', { roughness: 1 }),
    rubber: mat('#2e3134', { roughness: 0.7 }),
    mattress: mat('#3d5a80'),
    floorHome: mat('#c7b299'),
    wallHome: mat('#eae4d6'),
    glass: new THREE.MeshStandardMaterial({ color: '#bfe3f5', emissive: '#bfe3f5', emissiveIntensity: 0.6, roughness: 0.2 }),
  };

  function add(mesh, x, y, z) {
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  }

  function box(x, z, sx, sy, sz, material, { y = 0, collide = false, rotY = 0 } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.rotation.y = rotY;
    add(mesh, x, y + sy / 2, z);
    if (collide) {
      const hx = (Math.abs(Math.cos(rotY)) * sx) / 2 + (Math.abs(Math.sin(rotY)) * sz) / 2;
      const hz = (Math.abs(Math.sin(rotY)) * sx) / 2 + (Math.abs(Math.cos(rotY)) * sz) / 2;
      colliders.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
    }
    return mesh;
  }

  function post(x, z, h, material = M.metal, radius = 0.04, y = 0) {
    return add(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, h, 8), material), x, y + h / 2, z);
  }

  function sign(text, x, y, z, facing = 0, options = {}) {
    const mesh = makeSign(text, { width: 2.2, height: 0.55, ...options });
    mesh.rotation.y = facing;
    return add(mesh, x, y, z);
  }

  // ---------- Ground around the pool ----------

  // Grass all around, with a hole where the pool is.
  const { halfX: hx, halfZ: hz } = POOL;
  const outline = new THREE.Shape([new THREE.Vector2(-100, -100), new THREE.Vector2(100, -100), new THREE.Vector2(100, 100), new THREE.Vector2(-100, 100)]);
  outline.holes.push(new THREE.Path([new THREE.Vector2(-hx, -hz), new THREE.Vector2(-hx, hz), new THREE.Vector2(hx, hz), new THREE.Vector2(hx, -hz)]));
  const grass = new THREE.Mesh(new THREE.ShapeGeometry(outline), M.grass);
  grass.rotation.x = -Math.PI / 2;
  add(grass, 0, -0.03, 0);
  // The deck, with a hole for the pool: four slabs.
  const DX = 15;
  const DZ = 22;
  box((-DX - hx) / 2, 0, DX - hx, 0.02, DZ * 2, M.deck, { y: -0.02 });
  box((DX + hx) / 2, 0, DX - hx, 0.02, DZ * 2, M.deck, { y: -0.02 });
  box(0, (-DZ - hz) / 2, hx * 2, 0.02, DZ - hz, M.deck, { y: -0.02 });
  box(0, (DZ + hz) / 2, hx * 2, 0.02, DZ - hz, M.deck, { y: -0.02 });
  // A road outside the fence.
  box(28, 0, 8, 0.02, 120, M.asphalt, { y: -0.015 });

  // ---------- The pool ----------

  const depth = -POOL.bottom;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(hx * 2, hz * 2), M.tileFloor);
  floor.rotation.x = -Math.PI / 2;
  add(floor, 0, POOL.bottom, 0);
  // Walls (inside faces).
  const wallSide = new THREE.PlaneGeometry(hz * 2, depth);
  const wallEnd = new THREE.PlaneGeometry(hx * 2, depth);
  const w1 = add(new THREE.Mesh(wallSide, M.tile), -hx, POOL.bottom / 2, 0);
  w1.rotation.y = Math.PI / 2;
  const w2 = add(new THREE.Mesh(wallSide, M.tile), hx, POOL.bottom / 2, 0);
  w2.rotation.y = -Math.PI / 2;
  add(new THREE.Mesh(wallEnd, M.tile), 0, POOL.bottom / 2, -hz);
  const w4 = add(new THREE.Mesh(wallEnd, M.tile), 0, POOL.bottom / 2, hz);
  w4.rotation.y = Math.PI;
  // Lane lines on the bottom, with the T at each end.
  for (const x of POOL.lanes) {
    box(x, 0, 0.25, 0.01, hz * 2 - 4, M.laneLine, { y: POOL.bottom });
    for (const s of [-1, 1]) box(x, s * (hz - 2), 1, 0.01, 0.25, M.laneLine, { y: POOL.bottom });
  }
  // Coping stones around the edge, the player can't step off them into the water by accident.
  box(0, -hz - 0.2, hx * 2 + 0.8, 0.08, 0.4, M.coping);
  box(0, hz + 0.2, hx * 2 + 0.8, 0.08, 0.4, M.coping);
  box(-hx - 0.2, 0, 0.4, 0.08, hz * 2, M.coping);
  box(hx + 0.2, 0, 0.4, 0.08, hz * 2, M.coping);
  colliders.push({ minX: -hx - 0.05, maxX: hx + 0.05, minZ: -hz - 0.05, maxZ: -hz }); // edges: thin walls
  colliders.push({ minX: -hx - 0.05, maxX: hx + 0.05, minZ: hz, maxZ: hz + 0.05 });
  colliders.push({ minX: -hx - 0.05, maxX: -hx, minZ: -hz, maxZ: hz });
  colliders.push({ minX: hx, maxX: hx + 0.05, minZ: -hz, maxZ: hz });

  // Lane ropes: red and white floats (the inner ropes blue and white).
  const floatTexture = (color) =>
    canvasTexture(256, 16, (ctx, w, h) => {
      for (let i = 0; i < 32; i++) {
        ctx.fillStyle = i % 2 ? '#f5f5f5' : color;
        ctx.fillRect((i * w) / 32, 0, w / 32 + 1, h);
      }
    });
  const ropeGeo = new THREE.CylinderGeometry(0.06, 0.06, hz * 2, 10);
  ropeGeo.rotateX(Math.PI / 2);
  const ropeX = [-4.16, -2.08, 0, 2.08, 4.16];
  const laneRopes = [];
  ropeX.forEach((x, i) => {
    const t = floatTexture(i === 0 || i === ropeX.length - 1 ? '#c0392b' : '#2a6fc9');
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(1, 1);
    const rope = new THREE.Mesh(ropeGeo, new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }));
    rope.rotation.y = 0;
    // Map the stripes along the length: rotate the texture.
    t.center.set(0.5, 0.5);
    t.rotation = Math.PI / 2;
    t.repeat.set(12, 1);
    rope.userData.dynamic = true;
    laneRopes.push(add(rope, x, POOL.water + 0.02, 0));
  });
  // Starting blocks at the south end, ladders at the corners.
  for (const x of POOL.lanes) {
    box(x, hz + 0.55, 0.55, 0.7, 0.6, M.white, { collide: true });
    const n = add(makeSign(String(POOL.lanes.indexOf(x) + 1), { width: 0.3, height: 0.3, bg: '#1d3f8a', fg: '#ffffff' }), x, 0.42, hz + 0.86);
    n.rotation.y = 0;
  }
  for (const [x, z] of [
    [-hx + 0.6, -hz],
    [hx - 0.6, -hz],
    [-hx + 0.6, hz],
    [hx - 0.6, hz],
  ]) {
    for (const dx of [-0.25, 0.25]) {
      const rail = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.025, 6, 12, Math.PI), M.metal);
      rail.rotation.y = z > 0 ? 0 : Math.PI;
      rail.rotation.x = 0;
      rail.rotation.z = 0;
      add(rail, x + dx, 0.1, z + (z > 0 ? -0.2 : 0.2));
      rail.rotation.set(0, Math.PI / 2, 0);
      post(x + dx, z + (z > 0 ? -0.15 : 0.15), 1.5, M.metal, 0.025, -1.4);
    }
  }
  // Depth markings.
  for (const [x, z, facing] of [
    [-hx - 0.7, 0, Math.PI / 2],
    [hx + 0.7, 0, -Math.PI / 2],
  ]) {
    const mark = makeSign('2.20 מ׳', { width: 0.7, height: 0.25, bg: '#f4f2ec', fg: '#1d3f8a' });
    mark.rotation.set(-Math.PI / 2, 0, facing);
    add(mark, x, 0.011, z);
  }

  // Water: a moving surface with light patterns; seen from below it is blue and dim.
  const waterUniforms = {
    time: { value: 0 },
    deep: { value: new THREE.Color('#0d6f9a') },
    shallow: { value: new THREE.Color('#5fd0e8') },
  };
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(hx * 2, hz * 2, 1, 1),
    new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      uniforms: waterUniforms,
      vertexShader: /* glsl */ `
        varying vec2 vPos;
        varying vec3 vWorld;
        void main() {
          vPos = position.xy;
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float time;
        uniform vec3 deep;
        uniform vec3 shallow;
        varying vec2 vPos;
        varying vec3 vWorld;
        float wave(vec2 p, float t) {
          return sin(p.x * 1.7 + t * 1.3) * cos(p.y * 1.3 - t * 1.1) + 0.5 * sin(p.x * 3.1 - p.y * 2.3 + t * 2.0);
        }
        void main() {
          float w = wave(vPos, time);
          float caustic = pow(abs(sin(vPos.x * 2.3 + w + time) * sin(vPos.y * 2.1 - w * 0.7 + time * 0.8)), 6.0);
          vec3 col = mix(deep, shallow, 0.45 + 0.15 * w) + vec3(caustic) * 0.35;
          float facing = gl_FrontFacing ? 1.0 : 0.0;
          float alpha = mix(0.9, 0.62, facing);
          // Seen from under the water: darker, no sparkle.
          col = mix(col * 0.55, col, facing);
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.userData.dynamic = true;
  water.renderOrder = 2;
  add(water, 0, POOL.water, 0);
  updaters.push((t) => {
    waterUniforms.time.value = t;
  });

  // ---------- Around the pool ----------

  // Fence with green shade net.
  for (let x = -DX; x <= DX; x += 3) {
    post(x, -DZ, 2.4, M.fence, 0.04);
    post(x, DZ, 2.4, M.fence, 0.04);
  }
  for (let z = -DZ; z <= DZ; z += 3) {
    post(-DX, z, 2.4, M.fence, 0.04);
    post(DX, z, 2.4, M.fence, 0.04);
  }
  const netNS = new THREE.PlaneGeometry(DX * 2, 2.2);
  const netEW = new THREE.PlaneGeometry(DZ * 2, 2.2);
  add(new THREE.Mesh(netNS, M.net), 0, 1.2, -DZ);
  // The north fence has the gate: two pieces.
  const gateGap = 3;
  const northLeft = new THREE.Mesh(new THREE.PlaneGeometry(DX + SPOTS.gate.x - gateGap / 2, 2.2), M.net);
  add(northLeft, (-DX + SPOTS.gate.x - gateGap / 2) / 2, 1.2, DZ);
  const northRight = new THREE.Mesh(new THREE.PlaneGeometry(DX - SPOTS.gate.x - gateGap / 2, 2.2), M.net);
  add(northRight, (DX + SPOTS.gate.x + gateGap / 2) / 2, 1.2, DZ);
  const west = add(new THREE.Mesh(netEW, M.net), -DX, 1.2, 0);
  west.rotation.y = Math.PI / 2;
  const east = add(new THREE.Mesh(netEW, M.net), DX, 1.2, 0);
  east.rotation.y = Math.PI / 2;
  colliders.push({ minX: -DX - 0.2, maxX: DX + 0.2, minZ: -DZ - 0.2, maxZ: -DZ });
  colliders.push({ minX: -DX - 0.2, maxX: SPOTS.gate.x - gateGap / 2, minZ: DZ, maxZ: DZ + 0.2 });
  colliders.push({ minX: SPOTS.gate.x + gateGap / 2, maxX: DX + 0.2, minZ: DZ, maxZ: DZ + 0.2 });
  colliders.push({ minX: -DX - 0.2, maxX: -DX, minZ: -DZ, maxZ: DZ });
  colliders.push({ minX: DX, maxX: DX + 0.2, minZ: -DZ, maxZ: DZ });
  // Outside the gate there is a little more room, then the base fence.
  colliders.push({ minX: 0, maxX: 24, minZ: 34, maxZ: 35 });
  colliders.push({ minX: 0, maxX: 1, minZ: DZ, maxZ: 34 });
  colliders.push({ minX: 23, maxX: 24, minZ: DZ, maxZ: 34 });
  sign(['בריכה', 'יום מיון · 669'], SPOTS.gate.x, 2.75, DZ + 0.1, 0, { bg: '#1d3f8a' });
  post(SPOTS.gate.x - 1.55, DZ, 3, M.fence, 0.06);
  post(SPOTS.gate.x + 1.55, DZ, 3, M.fence, 0.06);
  box(SPOTS.gate.x, DZ, 3.2, 0.12, 0.12, M.fence, { y: 3 });

  // Changing rooms: an olive block along the north side, inside the fence.
  box(-6, 20.4, 14, 3, 3, M.olive, { collide: true });
  box(-6, 20.4, 14.6, 0.2, 3.6, M.roof, { y: 3 });
  sign('מלתחות', -6, 2.6, 18.89, 0, { width: 1.6, height: 0.42 });
  for (const x of [-10, -2]) box(x, 18.88, 1, 2.1, 0.04, M.dark);
  const rules = makePoster('כללי הבריכה', ['אסור לרוץ על הדק', 'נכנסים למים רק באישור', 'מציל בעמדה כל הזמן', 'כובע ים לפי הוראה'], { width: 0.9, height: 1.2, color: '#1d3f8a' });
  add(rules, 1.6, 1.6, 18.89);

  // Check-in table at the gate, a medic's corner, benches on the east side under a shade net.
  box(SPOTS.checkin.x, SPOTS.checkin.z - 0.6, 2.2, 0.75, 0.8, M.white, { collide: true });
  box(SPOTS.checkin.x + 0.4, SPOTS.checkin.z - 0.6, 0.35, 0.02, 0.25, M.white, { y: 0.76 });
  const box1 = box(SPOTS.medic.x, SPOTS.medic.z - 0.6, 0.6, 0.35, 0.4, M.red, { y: 0.75 });
  box1.userData.dynamic = false;
  box(SPOTS.medic.x, SPOTS.medic.z - 0.6, 1.2, 0.75, 0.7, M.white, { collide: true });
  for (let z = -14; z <= 14; z += 4.5) {
    box(SPOTS.bench.x + 1.2, z, 0.5, 0.45, 3.6, M.wood, { collide: true });
  }
  // Shade: posts and a net roof over the benches.
  for (const z of [-16, -8, 0, 8, 16]) {
    post(9.2, z, 3.4, M.metal, 0.07);
    post(14.2, z, 3.4, M.metal, 0.07);
    colliders.push({ minX: 9.05, maxX: 9.35, minZ: z - 0.15, maxZ: z + 0.15 });
  }
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 34), M.shade);
  shade.rotation.x = -Math.PI / 2;
  add(shade, 11.7, 3.4, 0);
  // A table for the knots and the stretcher, near the south-east corner.
  box(SPOTS.table.x, SPOTS.table.z, 1.6, 0.75, 2.4, M.white, { collide: true });

  // Lifeguard chair on the west side.
  const lg = SPOTS.lifeguard;
  for (const [dx, dz] of [
    [-0.4, -0.4],
    [0.4, -0.4],
    [-0.4, 0.4],
    [0.4, 0.4],
  ]) post(lg.x + dx, lg.z + dz, 1.8, M.white, 0.04);
  box(lg.x, lg.z, 1, 0.08, 1, M.white, { y: 1.8 });
  colliders.push({ minX: lg.x - 0.5, maxX: lg.x + 0.5, minZ: lg.z - 0.5, maxZ: lg.z + 0.5 });
  const buoy = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 8, 16), M.orange);
  buoy.rotation.y = Math.PI / 2;
  add(buoy, lg.x + 0.55, 1.2, lg.z);

  // Rubber boats and ropes are dynamic (they move in the rescue task).
  function makeBoat(color) {
    const group = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const tube = new THREE.CapsuleGeometry(0.22, 2.2, 4, 10);
    tube.rotateX(Math.PI / 2);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(tube, hullMat);
      side.position.set(s * 0.55, 0.12, 0);
      group.add(side);
    }
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.22, 8, 12, Math.PI), hullMat);
    bow.rotation.x = -Math.PI / 2;
    bow.position.set(0, 0.12, -1.32);
    group.add(bow);
    const stern = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 0.18), hullMat);
    stern.position.set(0, 0.12, 1.32);
    group.add(stern);
    const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 2.6), new THREE.MeshStandardMaterial({ color: '#3a3d40', roughness: 0.8 }));
    floorMesh.position.y = -0.02;
    group.add(floorMesh);
    group.traverse((o) => {
      o.userData.dynamic = true;
    });
    scene.add(group);
    return group;
  }
  const boats = [makeBoat('#2e3134'), makeBoat('#3b4148')];
  boats[0].position.set(4.2, 0.05, 19);
  boats[0].rotation.y = Math.PI / 2;
  boats[1].position.set(4.2, 0.05, 16.6);
  boats[1].rotation.y = Math.PI / 2;

  // A rope between two points, redrawn when its ends move.
  const ropeMaterial = new THREE.MeshStandardMaterial({ color: '#e9c46a', roughness: 0.9 });
  function makeRope() {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), ropeMaterial);
    mesh.userData.dynamic = true;
    mesh.visible = false;
    scene.add(mesh);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    return {
      mesh,
      set(from, to) {
        a.copy(from);
        b.copy(to);
        const length = a.distanceTo(b);
        mesh.visible = length > 0.05;
        mesh.scale.set(1, length, 1);
        mesh.position.copy(a).add(b).multiplyScalar(0.5);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      },
      hide() {
        mesh.visible = false;
      },
    };
  }

  // The rescue stretcher ("the 669 stretcher" in the prep-site lists; this one is drawn by the game).
  const stretcher = new THREE.Group();
  for (const s of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 8), M.metal);
    pole.rotation.x = Math.PI / 2;
    pole.position.x = s * 0.27;
    stretcher.add(pole);
  }
  const bed = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.02, 1.8), new THREE.MeshStandardMaterial({ color: '#e05a1a', roughness: 0.8 }));
  stretcher.add(bed);
  stretcher.traverse((o) => {
    o.userData.dynamic = true;
  });
  stretcher.position.set(SPOTS.table.x, 0.8, SPOTS.table.z);
  scene.add(stretcher);

  // Weights on the bottom: a bar with plates the candidates take apart.
  const weights = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8), M.metal);
  bar.rotation.z = Math.PI / 2;
  weights.add(bar);
  const plates = [];
  for (const x of [-0.6, -0.48, 0.48, 0.6]) {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 16), M.dark);
    plate.rotation.z = Math.PI / 2;
    plate.position.x = x;
    weights.add(plate);
    plates.push(plate);
  }
  weights.traverse((o) => {
    o.userData.dynamic = true;
  });
  weights.position.set(SPOTS.weights.x, POOL.bottom + 0.2, SPOTS.weights.z);
  scene.add(weights);

  // Outside: a water tower and two base buildings, so it reads as a base.
  post(-24, -30, 12, M.metal, 0.3);
  box(-24, -30, 4, 3, 4, M.white, { y: 12 });
  box(30, -10, 10, 4, 8, M.olive);
  box(30, 14, 10, 4, 8, M.olive);
  const flagPole = post(18, 30, 7, M.metal, 0.05);
  flagPole.userData.dynamic = false;

  // ---------- Home: your room ----------

  const H = SPOTS.home;
  const roomW = 3.6;
  const roomD = 4.4;
  box(H.x, H.z, roomW, 0.02, roomD, M.floorHome, { y: 0 });
  box(H.x, H.z, roomW, 0.04, roomD, M.wallHome, { y: 2.7 });
  const wall = (x, z, sx, sz) => box(x, z, sx, 2.7, sz, M.wallHome, { collide: true });
  wall(H.x, H.z - roomD / 2, roomW, 0.1);
  wall(H.x, H.z + roomD / 2, roomW, 0.1);
  wall(H.x - roomW / 2, H.z, 0.1, roomD);
  // The east wall has a window.
  box(H.x + roomW / 2, H.z - 1.5, 0.1, 2.7, 1.4, M.wallHome, { collide: true });
  box(H.x + roomW / 2, H.z + 1.5, 0.1, 2.7, 1.4, M.wallHome, { collide: true });
  box(H.x + roomW / 2, H.z, 0.1, 0.9, 1.6, M.wallHome, { collide: true });
  box(H.x + roomW / 2, H.z, 0.1, 0.6, 1.6, M.wallHome, { y: 2.1 });
  box(H.x + roomW / 2 + 0.06, H.z, 0.02, 1.2, 1.6, M.glass, { y: 0.9 });
  // Bed, desk, chair, a poster.
  box(H.x - 1.2, H.z - 1.1, 1, 0.45, 2, M.wood, { collide: true });
  box(H.x - 1.2, H.z - 1.1, 0.95, 0.15, 1.95, M.mattress, { y: 0.45 });
  box(H.x + 0.9, H.z + 1.7, 1.4, 0.75, 0.6, M.wood, { collide: true });
  box(H.x + 0.9, H.z + 1.65, 0.45, 0.02, 0.3, M.dark, { y: 0.76 });
  box(H.x + 0.9, H.z + 1.1, 0.45, 0.45, 0.45, M.plastic);
  const poster = makePoster('כושר', ['ריצה 3 ק״מ', 'שחייה פעמיים בשבוע', 'מתח · מקבילים', 'לישון מוקדם'], { width: 0.7, height: 0.95, color: '#1d3f8a' });
  poster.rotation.y = Math.PI / 2;
  add(poster, H.x - roomW / 2 + 0.06, 1.6, H.z + 0.8);
  const lamp = new THREE.PointLight('#ffe2b0', 6, 9, 1.4);
  lamp.position.set(H.x, 2.5, H.z);
  scene.add(lamp);

  mergeStatic(scene);

  return {
    colliders,
    blockers: [],
    floodlights: { setPower() {} },
    boats,
    stretcher,
    weights,
    plates,
    makeRope,
    /** After the swim test the lane ropes come out, so the group can work in the whole pool. */
    setLaneRopes(on) {
      for (const r of laneRopes) r.visible = on;
    },
    update(t) {
      for (const fn of updaters) fn(t);
    },
  };
}
