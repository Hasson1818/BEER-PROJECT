import * as THREE from 'three';
import { createSky } from '../../../shared/engine/sky.js';

// What the simulator shows: terrain, sky, clouds, the other aircraft, rings, targets, missiles.
// The ground is a procedural height field (the same function the flight code uses to detect a crash).

// ---------- Terrain height ----------

function hash(ix, iz) {
  let h = ix * 374761393 + iz * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  h ^= h >>> 16;
  return ((h >>> 0) % 10000) / 10000;
}

function noise2(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz);
  const b = hash(ix + 1, iz);
  const c = hash(ix, iz + 1);
  const d = hash(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

function fbm(x, z, octaves = 5) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x * f, z * f) * amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum; // roughly 0 .. 1
}

/** `mountains` 0..1 raises ridges in the middle of the map (used by the second simulator). */
export function makeTerrain(mountains = 0) {
  return (x, z) => {
    const base = fbm(x / 2600, z / 2600, 5);
    let h = 40 + base * 320;
    if (mountains > 0) {
      const ridge = 1 - Math.abs(fbm(x / 1700 + 11, z / 1700 + 5, 4) * 2 - 1);
      const mask = THREE.MathUtils.smoothstep(fbm(x / 5200 + 3, z / 5200 + 9, 3), 0.38, 0.62);
      h += Math.pow(ridge, 2.2) * 2300 * mountains * mask;
    }
    return h;
  };
}

function sandTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#9a8c68';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    const v = 120 + Math.random() * 70;
    ctx.fillStyle = `rgba(${v + 20}, ${v + 8}, ${v - 20}, ${0.08 + Math.random() * 0.18})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1 + Math.random() * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Something that looks like aerial photography: fields, scrub, wadis and a few roads, in washed-out colors. */
function aerialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#a89c80';
  ctx.fillRect(0, 0, 1024, 1024);
  const palette = ['#9b8f72', '#b3a487', '#8d8a64', '#7c8456', '#a09a70', '#bfae8c', '#8a7d62', '#6f7a4e', '#b8aa86', '#c4b695'];
  for (let i = 0; i < 520; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const w = 20 + Math.random() * 120;
    const h = 14 + Math.random() * 90;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.floor(Math.random() * 4) * 0.12 + (i % 3 === 0 ? 0.6 : 0));
    ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
    ctx.globalAlpha = 0.5 + Math.random() * 0.4;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // Dry riverbeds: dark meandering lines.
  ctx.strokeStyle = 'rgba(70,58,44,0.45)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 7; k++) {
    ctx.beginPath();
    let x = Math.random() * 1024;
    let y = 0;
    ctx.moveTo(x, y);
    while (y < 1024) {
      x += (Math.random() - 0.5) * 40;
      y += 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Roads: thin pale lines.
  ctx.strokeStyle = 'rgba(224,214,190,0.8)';
  ctx.lineWidth = 3;
  for (let k = 0; k < 5; k++) {
    ctx.beginPath();
    ctx.moveTo(0, Math.random() * 1024);
    ctx.bezierCurveTo(300, Math.random() * 1024, 700, Math.random() * 1024, 1024, Math.random() * 1024);
    ctx.stroke();
  }
  for (let i = 0; i < 9000; i++) {
    const v = 110 + Math.random() * 90;
    ctx.fillStyle = `rgba(${v + 20}, ${v + 8}, ${v - 20}, ${0.05 + Math.random() * 0.15})`;
    ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- Models ----------

/** A jet seen from behind and from the side. 1 unit ~ 1 m; `scale` makes it easier to see at range. */
export function makeJet({ body = '#8d97a3', accent = '#b3322a', scale = 2.4 } = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: body, metalness: 0.45, roughness: 0.45 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b313a', metalness: 0.3, roughness: 0.6 });
  const mark = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.6 });

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 12, 12), paint);
  fuselage.rotation.x = Math.PI / 2;
  g.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 4.5, 12), paint);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -8.2;
  g.add(nose);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 8), new THREE.MeshStandardMaterial({ color: '#17324a', metalness: 0.6, roughness: 0.15 }));
  canopy.scale.set(0.8, 0.8, 2.4);
  canopy.position.set(0, 0.8, -2.4);
  g.add(canopy);

  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(7.6, 3.8);
  wingShape.lineTo(7.6, 5.4);
  wingShape.lineTo(0, 5.2);
  wingShape.closePath();
  for (const side of [1, -1]) {
    const wing = new THREE.Mesh(new THREE.ExtrudeGeometry(wingShape, { depth: 0.16, bevelEnabled: false }), paint);
    wing.rotation.x = Math.PI / 2;
    wing.scale.x = side;
    wing.position.set(0, -0.2, -1.8);
    g.add(wing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 1.6), paint);
    tail.position.set(side * 2.2, 0, 5.2);
    tail.rotation.z = side * 0.06;
    g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.4, 2.2), mark);
    fin.position.set(side * 1.2, 1.3, 5.0);
    fin.rotation.z = -side * 0.2;
    g.add(fin);
  }
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 1.2, 12), dark);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.z = 6.4;
  g.add(nozzle);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3.2, 10), new THREE.MeshBasicMaterial({ color: '#ffb25a', transparent: true, opacity: 0.85 }));
  flame.rotation.x = -Math.PI / 2;
  flame.position.z = 8.2;
  flame.name = 'flame';
  g.add(flame);
  g.scale.setScalar(scale);
  return g;
}

function ring(radius = 130, color = '#4cd29a') {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, toneMapped: false, fog: false });
  const torus = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.045, 8, 48), mat);
  g.add(torus);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.86, radius * 0.012, 6, 48), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.55, toneMapped: false, fog: false }));
  g.add(inner);
  g.userData.mat = mat;
  return g;
}

// ---------- The world ----------

export function createFlightWorld(scene, { mountains = 0, time = 'afternoon', aerial = false } = {}) {
  const sky = createSky(scene, { setPower() {} });
  sky.setTime(time);
  scene.fog.far = 16000;
  scene.fog.near = 2500;
  const height = makeTerrain(mountains);

  // Terrain mesh.
  const SIZE = 22000;
  const SEG = 180;
  const geometry = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geometry.rotateX(-Math.PI / 2);
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color('#b9a46f');
  const scrub = new THREE.Color('#7f8b4c');
  const rock = new THREE.Color('#7a746c');
  const snow = new THREE.Color('#e7e6e0');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = height(x, z);
    pos.setY(i, h);
    const t = h / 500;
    c.copy(sand).lerp(scrub, THREE.MathUtils.smoothstep(t, 0.15, 0.7));
    if (h > 700) c.lerp(rock, THREE.MathUtils.smoothstep(h, 700, 1500));
    if (h > 2100) c.lerp(snow, THREE.MathUtils.smoothstep(h, 2100, 2500));
    c.multiplyScalar(0.9 + hash(i, 7) * 0.2);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const tex = aerial ? aerialTexture() : sandTexture();
  if (aerial) tex.repeat.set(SIZE / 2600, SIZE / 2600);
  else tex.repeat.set(SIZE / 90, SIZE / 90);
  const terrain = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, map: tex }));
  scene.add(terrain);

  // Clouds.
  const cloudMap = cloudTexture();
  const clouds = [];
  for (let i = 0; i < 46; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudMap, transparent: true, opacity: 0.7, depthWrite: false, fog: false }));
    const s = 700 + Math.random() * 1400;
    sprite.scale.set(s, s * 0.45, 1);
    sprite.position.set((Math.random() - 0.5) * 18000, 3300 + Math.random() * 900, (Math.random() - 0.5) * 18000);
    scene.add(sprite);
    clouds.push(sprite);
  }

  // Things the missions place.
  const rings = [];
  const targets = [];
  const missiles = [];
  const puffs = [];
  const puffGeo = new THREE.SphereGeometry(1, 6, 5);

  function addRing(x, y, z, { radius = 130, normal = null } = {}) {
    const r = ring(radius);
    r.position.set(x, y, z);
    if (normal) r.lookAt(r.position.clone().add(normal));
    scene.add(r);
    rings.push(r);
    return r;
  }

  function addTarget(x, z, { civilian = false } = {}) {
    const g = new THREE.Group();
    const y = height(x, z);
    if (civilian) {
      const house = new THREE.Mesh(new THREE.BoxGeometry(22, 12, 22), new THREE.MeshLambertMaterial({ color: '#f2efe6' }));
      house.position.y = 6;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(18, 8, 4), new THREE.MeshLambertMaterial({ color: '#3a6fb0' }));
      roof.position.y = 16;
      roof.rotation.y = Math.PI / 4;
      g.add(house, roof);
    } else {
      const truck = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 30), new THREE.MeshLambertMaterial({ color: '#5a603a' }));
      truck.position.y = 4;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 8), new THREE.MeshLambertMaterial({ color: '#4a4f30' }));
      cab.position.set(0, 4, -14);
      g.add(truck, cab);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3b30', toneMapped: false, fog: false }));
      beacon.position.y = 26;
      beacon.name = 'beacon';
      g.add(beacon);
    }
    g.position.set(x, y, z);
    scene.add(g);
    const t = { group: g, x, z, y, civilian, destroyed: false };
    targets.push(t);
    return t;
  }

  function addMissile(from, to) {
    const m = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 14, 8), new THREE.MeshStandardMaterial({ color: '#d9d4c8', metalness: 0.3 }));
    body.rotation.x = Math.PI / 2;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(1.2, 4, 8), new THREE.MeshStandardMaterial({ color: '#b3322a' }));
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = -9;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(1.5, 8, 8), new THREE.MeshBasicMaterial({ color: '#ffb25a', toneMapped: false }));
    flame.rotation.x = -Math.PI / 2;
    flame.position.z = 10;
    m.add(body, tip, flame);
    m.scale.setScalar(2);
    m.position.copy(from);
    scene.add(m);
    const missile = { group: m, velocity: new THREE.Vector3(), speed: 150, life: 0, dead: false, target: to };
    missiles.push(missile);
    return missile;
  }

  function puff(position, { size = 12, life = 1.2, color = '#ffffff', opacity = 0.7 } = {}) {
    const mesh = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, fog: false }));
    mesh.position.copy(position);
    mesh.scale.setScalar(size * 0.4);
    scene.add(mesh);
    puffs.push({ mesh, age: 0, life, size, opacity });
  }

  function clearDynamic() {
    for (const r of rings) scene.remove(r);
    for (const t of targets) scene.remove(t.group);
    for (const m of missiles) scene.remove(m.group);
    for (const p of puffs) scene.remove(p.mesh);
    rings.length = targets.length = missiles.length = puffs.length = 0;
  }

  function update(dt, camera, time) {
    sky.update(camera);
    for (const cloud of clouds) {
      cloud.position.x += 4 * dt;
      if (cloud.position.x > 9500) cloud.position.x = -9500;
    }
    rings.forEach((r, i) => {
      r.rotation.z += dt * 0.4;
      r.userData.mat.opacity = r.userData.active ? 0.95 : 0.35;
      r.scale.setScalar(r.userData.active ? 1 + Math.sin(time * 4) * 0.025 : 1);
    });
    for (const t of targets) {
      const beacon = t.group.getObjectByName('beacon');
      if (beacon) beacon.visible = !t.destroyed && Math.sin(time * 6) > -0.3;
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.age += dt;
      const k = p.age / p.life;
      p.mesh.scale.setScalar(p.size * (0.4 + k));
      p.mesh.material.opacity = Math.max(0, p.opacity * (1 - k));
      if (k >= 1) {
        scene.remove(p.mesh);
        p.mesh.material.dispose();
        puffs.splice(i, 1);
      }
    }
  }

  return { sky, height, terrain, rings, targets, missiles, addRing, addTarget, addMissile, puff, clearDynamic, update };
}
