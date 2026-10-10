import * as THREE from 'three';

// Background for the main screen: the gate of an induction base at sunset,
// seen from the road, with a slow first-person camera drift.

const COLORS = {
  skyTop: '#16213b',
  skyMid: '#6b4d6e',
  horizon: '#f0a35e',
  sun: '#ffcf8a',
  sand: '#a88f66',
  asphalt: '#34353a',
  concrete: '#cfc5af',
  wall: '#d8ccb0',
  roof: '#8d8578',
  olive: '#4b5320',
  foliage: ['#4c5a2c', '#56633a', '#435026'],
  trunk: '#6b5a45',
  hills: '#8a6f78',
  lamp: '#ffd59a',
};

// Seeded random so the scene looks the same on every load.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(1818);
const range = (min, max) => min + rand() * (max - min);

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function redraw(texture, draw) {
  const canvas = texture.image;
  draw(canvas.getContext('2d'), canvas.width, canvas.height);
  texture.needsUpdate = true;
}

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ---------- Sky ----------

function createSky(sunDir) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(COLORS.skyTop) },
      mid: { value: new THREE.Color(COLORS.skyMid) },
      horizon: { value: new THREE.Color(COLORS.horizon) },
      sunColor: { value: new THREE.Color(COLORS.sun) },
      sunDir: { value: sunDir },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 mid;
      uniform vec3 horizon;
      uniform vec3 sunColor;
      uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        vec3 dir = normalize(vDir);
        float h = dir.y;
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.22, h));
        col = mix(col, top, smoothstep(0.18, 0.65, h));
        col = mix(col, horizon * 0.85, 1.0 - smoothstep(-0.05, 0.0, h));
        float s = max(dot(dir, normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.45);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), material);
  sky.renderOrder = -1;
  return sky;
}

function createHills() {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: COLORS.hills, roughness: 1, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const hill = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), material);
    hill.scale.set(range(35, 60), range(8, 18), range(18, 30));
    hill.position.set(-160 + i * 40 + range(-10, 10), -2, range(-190, -160));
    group.add(hill);
  }
  return group;
}

// ---------- Ground and road ----------

function createGround() {
  const group = new THREE.Group();

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ color: COLORS.sand, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.receiveShadow = true;
  group.add(sand);

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 200),
    new THREE.MeshStandardMaterial({ color: COLORS.asphalt, roughness: 0.9 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.01, -40);
  road.receiveShadow = true;
  group.add(road);

  const dummy = new THREE.Object3D();

  // Dashed center line.
  const dashCount = 30;
  const dashes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.15, 0.02, 1.6),
    new THREE.MeshStandardMaterial({ color: '#e8e2d0', roughness: 0.8 }),
    dashCount,
  );
  for (let i = 0; i < dashCount; i++) {
    dummy.position.set(0, 0.02, 58 - i * 4);
    dummy.updateMatrix();
    dashes.setMatrixAt(i, dummy.matrix);
  }
  dashes.receiveShadow = true;
  group.add(dashes);

  // Red-and-white curbs up to the gate.
  const curbGeometry = new THREE.BoxGeometry(0.3, 0.18, 1);
  const segments = 58;
  const red = new THREE.InstancedMesh(curbGeometry, new THREE.MeshStandardMaterial({ color: '#b3362c', roughness: 0.8 }), segments);
  const white = new THREE.InstancedMesh(curbGeometry, new THREE.MeshStandardMaterial({ color: '#ece6d6', roughness: 0.8 }), segments);
  let r = 0;
  let w = 0;
  for (const x of [-4.15, 4.15]) {
    for (let i = 0; i < segments / 2; i++) {
      for (const isRed of [true, false]) {
        const z = 60 - (i * 2 + (isRed ? 0 : 1)) - 0.5;
        dummy.position.set(x, 0.09, z);
        dummy.updateMatrix();
        if (isRed) red.setMatrixAt(r++, dummy.matrix);
        else white.setMatrixAt(w++, dummy.matrix);
      }
    }
  }
  red.receiveShadow = white.receiveShadow = true;
  group.add(red, white);

  return group;
}

// ---------- Fence ----------

function createFence() {
  const group = new THREE.Group();
  const height = 2.6;
  const length = 62;

  const wireTexture = canvasTexture(64, 64, (ctx, w, h) => {
    ctx.strokeStyle = 'rgba(70, 72, 70, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, h);
    ctx.moveTo(w, 0);
    ctx.lineTo(0, h);
    ctx.stroke();
  });
  wireTexture.wrapS = wireTexture.wrapT = THREE.RepeatWrapping;
  wireTexture.repeat.set(length / 0.7, height / 0.7);

  const wireMaterial = new THREE.MeshStandardMaterial({
    map: wireTexture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    metalness: 0.3,
    roughness: 0.7,
  });
  const postMaterial = new THREE.MeshStandardMaterial({ color: '#6f716c', metalness: 0.5, roughness: 0.6 });
  const postGeometry = new THREE.CylinderGeometry(0.06, 0.06, height + 0.3, 6);
  const postsPerSide = Math.floor(length / 3) + 1;
  const posts = new THREE.InstancedMesh(postGeometry, postMaterial, postsPerSide * 2);
  const dummy = new THREE.Object3D();
  let p = 0;

  for (const dir of [-1, 1]) {
    const startX = dir * 9;
    const wire = new THREE.Mesh(new THREE.PlaneGeometry(length, height), wireMaterial);
    wire.position.set(startX + (dir * length) / 2, height / 2, 0);
    group.add(wire);

    const topRail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.05, 0.05), postMaterial);
    topRail.position.set(wire.position.x, height, 0);
    group.add(topRail);

    for (let i = 0; i < postsPerSide; i++) {
      dummy.position.set(startX + dir * i * 3, (height + 0.3) / 2, 0);
      dummy.updateMatrix();
      posts.setMatrixAt(p++, dummy.matrix);
    }
  }
  posts.castShadow = true;
  group.add(posts);
  return group;
}

// ---------- Gate ----------

function drawSign(ctx, w, h) {
  ctx.fillStyle = '#2f3a20';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#c9b98f';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.fillStyle = '#efe4c4';
  ctx.font = '700 64px Heebo, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.direction = 'rtl';
  ctx.fillText('בסיס קליטה ומיון', w / 2, h / 2 + 4);
}

function drawBarrier(ctx, w, h) {
  const stripes = 8;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#c0392b' : '#f4efe4';
    ctx.fillRect((i * w) / stripes, 0, w / stripes, h);
  }
}

function createGate() {
  const group = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: COLORS.concrete, roughness: 0.95 });
  const olive = new THREE.MeshStandardMaterial({ color: COLORS.olive, roughness: 0.9 });

  for (const x of [-5.2, 5.2]) {
    const pillar = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1, 5, 1), concrete));
    pillar.position.set(x, 2.5, 0);
    group.add(pillar);
  }

  const signTexture = canvasTexture(1024, 118, drawSign);
  const signMaterial = new THREE.MeshStandardMaterial({ map: signTexture, roughness: 0.8 });
  // Box faces: +x, -x, +y, -y, +z (front, toward the camera), -z.
  const beam = shadowed(
    new THREE.Mesh(new THREE.BoxGeometry(11.4, 1.3, 0.5), [concrete, concrete, concrete, concrete, signMaterial, concrete]),
  );
  beam.position.set(0, 5.6, 0);
  group.add(beam);

  // Barrier arm, closed.
  const barrierPost = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.5), olive));
  barrierPost.position.set(-4.3, 0.55, 1.2);
  const arm = shadowed(
    new THREE.Mesh(
      new THREE.BoxGeometry(7.8, 0.18, 0.18),
      new THREE.MeshStandardMaterial({ map: canvasTexture(256, 16, drawBarrier), roughness: 0.6 }),
    ),
  );
  arm.position.set(-0.3, 1.05, 1.2);
  group.add(barrierPost, arm);

  // Guard booth.
  const booth = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 2.4), concrete));
  booth.position.set(-8, 1.3, 2.5);
  const boothRoof = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 3), olive));
  boothRoof.position.set(-8, 2.7, 2.5);
  const boothWindow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.9),
    new THREE.MeshStandardMaterial({ color: '#2a2a22', emissive: COLORS.lamp, emissiveIntensity: 1.6 }),
  );
  boothWindow.position.set(-8, 1.6, 3.71);
  const boothLight = new THREE.PointLight(COLORS.lamp, 8, 8);
  boothLight.position.set(-8, 1.8, 4.4);
  group.add(booth, boothRoof, boothWindow, boothLight);

  // Re-draw the sign once the Hebrew web font is ready.
  document.fonts?.load('700 64px Heebo').then(() => redraw(signTexture, drawSign), () => {});

  return group;
}

// ---------- Flag ----------

function drawIsraeliFlag(ctx, w, h) {
  const u = h / 160; // Official proportions are given for a 220 x 160 flag.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#0038b8';
  ctx.fillRect(0, 15 * u, w, 25 * u);
  ctx.fillRect(0, h - 40 * u, w, 25 * u);

  ctx.strokeStyle = '#0038b8';
  ctx.lineWidth = 5.5 * u;
  ctx.lineJoin = 'miter';
  const cx = w / 2;
  const cy = h / 2;
  const radius = 22 * u;
  for (const rotation of [-Math.PI / 2, Math.PI / 2]) {
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const angle = rotation + (i * 2 * Math.PI) / 3;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
}

function createFlag() {
  const group = new THREE.Group();
  const poleHeight = 12;

  const metal = new THREE.MeshStandardMaterial({ color: '#d9d9d9', metalness: 0.6, roughness: 0.35 });
  const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, poleHeight, 12), metal));
  pole.position.y = poleHeight / 2;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), metal);
  knob.position.y = poleHeight + 0.1;
  group.add(pole, knob);

  const width = 3.3;
  const height = 2.4;
  const geometry = new THREE.PlaneGeometry(width, height, 24, 12);
  geometry.translate(width / 2, 0, 0); // Hinge the flag on the pole.
  const flag = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ map: canvasTexture(330, 240, drawIsraeliFlag), side: THREE.DoubleSide, roughness: 0.8 }),
  );
  flag.position.set(0.08, poleHeight - 1.4, 0);
  flag.castShadow = true;
  group.add(flag);

  const rest = geometry.attributes.position.array.slice();
  const position = geometry.attributes.position;

  function update(t) {
    for (let i = 0; i < position.count; i++) {
      const x = rest[i * 3];
      const y = rest[i * 3 + 1];
      const k = x / width; // 0 at the pole, 1 at the free edge.
      const z = (Math.sin(x * 2.2 - t * 3.2 + y * 0.6) * 0.28 + Math.sin(x * 4.1 - t * 5) * 0.06) * k;
      position.setZ(i, z);
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  return { group, update };
}

// ---------- Buildings ----------

function windowTextures(cols, rows) {
  const cell = 64;
  const lit = Array.from({ length: cols * rows }, () => rand() < 0.45);

  const eachWindow = (ctx, paint) => {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        paint(lit[row * cols + col], col * cell + 18, row * cell + 20);
      }
    }
  };

  const map = canvasTexture(cols * cell, rows * cell, (ctx, w, h) => {
    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(0, 0, w, h);
    const grime = ctx.createLinearGradient(0, 0, 0, h);
    grime.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grime.addColorStop(1, 'rgba(80, 60, 30, 0.25)');
    ctx.fillStyle = grime;
    ctx.fillRect(0, 0, w, h);
    eachWindow(ctx, (isLit, x, y) => {
      ctx.fillStyle = isLit ? '#ffd88a' : '#3a3f45';
      ctx.fillRect(x, y, 28, 30);
    });
  });

  const emissive = canvasTexture(cols * cell, rows * cell, (ctx, w, h) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    eachWindow(ctx, (isLit, x, y) => {
      if (!isLit) return;
      ctx.fillStyle = '#ffc46b';
      ctx.fillRect(x, y, 28, 30);
    });
  });

  return { map, emissive };
}

const roofMaterial = new THREE.MeshStandardMaterial({ color: COLORS.roof, roughness: 1 });

function wallMaterial(textures) {
  return new THREE.MeshStandardMaterial({
    map: textures.map,
    emissiveMap: textures.emissive,
    emissive: 0xffffff,
    emissiveIntensity: 1.4,
    roughness: 0.95,
  });
}

function createBuilding(width, floors, depth) {
  const height = floors * 3.2;
  const front = wallMaterial(windowTextures(Math.max(2, Math.round(width / 3.2)), floors));
  const side = wallMaterial(windowTextures(Math.max(1, Math.round(depth / 3.2)), floors));
  const building = shadowed(
    new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), [side, side, roofMaterial, roofMaterial, front, front]),
  );
  building.position.y = height / 2;
  return building;
}

function createWaterTower() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#7d7a70', metalness: 0.4, roughness: 0.7 });
  for (const [x, z] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
    const leg = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 10, 6), metal));
    leg.position.set(x, 5, z);
    group.add(leg);
  }
  const tank = shadowed(
    new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 3.2, 16), new THREE.MeshStandardMaterial({ color: '#c8bfa9', roughness: 0.8 })),
  );
  tank.position.y = 11.6;
  const cap = shadowed(new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 16), metal));
  cap.position.y = 13.8;
  group.add(tank, cap);
  return group;
}

function createBase() {
  const group = new THREE.Group();
  const layout = [
    // [x, z, width, floors, depth, rotationY]
    [-18, -14, 18, 2, 8, 0],
    [17, -16, 20, 2, 9, 0],
    [-34, -30, 22, 3, 9, 0.15],
    [33, -34, 24, 2, 10, -0.12],
    [2, -42, 26, 3, 10, 0],
    [-14, -60, 20, 2, 9, 0],
    [22, -62, 18, 3, 9, 0],
  ];
  for (const [x, z, width, floors, depth, rotation] of layout) {
    const building = createBuilding(width, floors, depth);
    building.position.x = x;
    building.position.z = z;
    building.rotation.y = rotation;
    group.add(building);
  }

  const tower = createWaterTower();
  tower.position.set(-24, 0, -46);
  group.add(tower);
  return group;
}

// ---------- Trees and lamps ----------

const trunkMaterial = new THREE.MeshStandardMaterial({ color: COLORS.trunk, roughness: 1 });
const foliageMaterials = COLORS.foliage.map(
  (color) => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }),
);

function createTree(scale) {
  const tree = new THREE.Group();
  const trunk = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.2 * scale, 4 * scale, 6), trunkMaterial));
  trunk.position.y = 2 * scale;
  tree.add(trunk);

  const material = foliageMaterials[Math.floor(rand() * foliageMaterials.length)];
  for (let i = 0; i < 3; i++) {
    const blob = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(range(1.2, 1.9) * scale, 0), material));
    blob.position.set(range(-0.8, 0.8) * scale, range(4, 5.2) * scale, range(-0.8, 0.8) * scale);
    tree.add(blob);
  }
  return tree;
}

function createTrees() {
  const group = new THREE.Group();
  let placed = 0;
  while (placed < 26) {
    const x = range(-45, 45);
    const z = range(-55, 50);
    if (Math.abs(x) < 7.5) continue; // Keep the road clear.
    if (Math.abs(z) < 3) continue; // Keep the fence line clear.
    const tree = createTree(range(0.9, 1.4));
    tree.position.set(x, 0, z);
    tree.rotation.y = range(0, Math.PI * 2);
    group.add(tree);
    placed++;
  }
  return group;
}

function createLamps() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: '#5b5d58', metalness: 0.5, roughness: 0.6 });
  const glow = new THREE.MeshStandardMaterial({ color: '#2a2a22', emissive: COLORS.lamp, emissiveIntensity: 3 });

  for (const z of [44, 30, 16, 5]) {
    for (const side of [-1, 1]) {
      const x = side * 5.2;
      const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 6, 8), metal));
      pole.position.set(x, 3, z);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.08), metal);
      arm.position.set(x - side * 0.6, 6, z);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.3), glow);
      head.position.set(x - side * 1.1, 5.94, z);
      group.add(pole, arm, head);

      // Real lights only on the lamps closest to the gate.
      if (z === 5) {
        const light = new THREE.PointLight(COLORS.lamp, 40, 18);
        light.position.set(x - side * 1.1, 5.7, z);
        group.add(light);
      }
    }
  }
  return group;
}

// ---------- Dust ----------

function createDust() {
  const count = 350;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = range(-20, 20);
    positions[i * 3 + 1] = range(0.2, 8);
    positions[i * 3 + 2] = range(-10, 32);
    speeds[i] = range(0.05, 0.25);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: '#ffe2b0', size: 0.07, transparent: true, opacity: 0.55, depthWrite: false }),
  );

  function update(dt) {
    for (let i = 0; i < count; i++) {
      positions[i * 3] += speeds[i] * dt;
      positions[i * 3 + 1] += Math.sin(positions[i * 3] * 0.8) * 0.05 * dt;
      if (positions[i * 3] > 20) positions[i * 3] = -20;
    }
    geometry.attributes.position.needsUpdate = true;
  }

  return { points, update };
}

// ---------- Setup ----------

export function createBackground(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(COLORS.horizon, 40, 230);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 600);

  // The sun sits low behind the base, so the buildings face the camera in shade.
  const sunDir = new THREE.Vector3(-0.35, 0.06, -1).normalize();
  const sky = createSky(sunDir);
  scene.add(sky);

  scene.add(new THREE.HemisphereLight('#ffd9b0', '#3b3326', 1.1));
  const sun = new THREE.DirectionalLight('#ffb070', 2.6);
  sun.position.set(-0.35, 0.3, -1).normalize().multiplyScalar(90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 250 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const flag = createFlag();
  flag.group.position.set(-10, 0, -6);
  const dust = createDust();

  scene.add(createHills(), createGround(), createFence(), createGate(), createBase(), createTrees(), createLamps());
  scene.add(flag.group, dust.points);

  // ---------- Camera motion ----------

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = { x: 0, y: 0 };
  const smoothPointer = { x: 0, y: 0 };
  const lookAt = new THREE.Vector3();

  window.addEventListener('pointermove', (event) => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  });

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  let t = 0;
  let last = performance.now();

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    t += dt;
    const still = reducedMotion.matches;

    smoothPointer.x += (pointer.x - smoothPointer.x) * 0.04;
    smoothPointer.y += (pointer.y - smoothPointer.y) * 0.04;

    // Slow walk toward the gate and back, with a light head bob.
    const walk = still ? 0 : (1 - Math.cos(t * 0.06)) * 3;
    const bob = still ? 0 : Math.sin(t * 1.4) * 0.025;
    camera.position.set(smoothPointer.x * 0.8, 1.7 + bob - smoothPointer.y * 0.3, 30 - walk);

    // On wide screens the menu covers the right side, so aim a little right to keep the gate visible.
    const aimX = camera.aspect > 1.2 ? 4 : 0;
    lookAt.set(aimX + smoothPointer.x * 1.5, 3.2 - smoothPointer.y * 0.8, -20);
    camera.lookAt(lookAt);

    sky.position.copy(camera.position);
    if (!still) {
      flag.update(t);
      dust.update(dt);
    }

    renderer.render(scene, camera);
  }

  // Draw the flag once so it isn't flat when motion is reduced.
  flag.update(0);

  function syncLoop() {
    renderer.setAnimationLoop(document.hidden ? null : frame);
  }
  document.addEventListener('visibilitychange', syncLoop);
  syncLoop();

  return { renderer, scene, camera };
}
