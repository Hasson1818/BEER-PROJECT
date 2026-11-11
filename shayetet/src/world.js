import * as THREE from 'three';
import { buildWorld as buildBeach, height as beachHeight, DUNE, SPOTS as BEACH, SEA, SUB } from '../../naval/src/world.js';
import { tileTexture, makeSign } from '../../shared/engine/textures.js';

// The Shayetet gibbush site: the same Atlit beach as the naval stage (the accounts 2023–2026 all describe Atlit),
// plus a pool on the east side of the base for day 4. The pool is 4 m deep: the accounts describe rings picked up
// from 3.5–4 m. Where the pool is and what it looks like is the game's own.

export { DUNE, SEA, SUB };

export const POOL = { cx: 52, cz: 10, halfX: 6.25, halfZ: 12.5, water: -0.12, bottom: -4 };

export const SPOTS = {
  ...BEACH,
  pool: { x: POOL.cx, z: POOL.cz },
  poolDeck: { x: POOL.cx - POOL.halfX - 2, z: POOL.cz },
  buoy: { x: -24, z: -110 },
  ropes: { x: -10, z: -78 },
};

export const inPool = (x, z) => Math.abs(x - POOL.cx) < POOL.halfX && Math.abs(z - POOL.cz) < POOL.halfZ;

/** The ground: the pool floor, or the beach. */
export function height(x, z) {
  return inPool(x, z) ? POOL.bottom : beachHeight(x, z);
}

/** Where people stand "in" the water (pool or sea): feet low enough that the head stays out. */
export function waterGround(x, z) {
  if (inPool(x, z)) return POOL.water - 1.42;
  const h = beachHeight(x, z);
  if (z < -54 && h < SEA.level - 1.25) return SEA.level - 1.42;
  return height(x, z);
}

/**
 * The sand mesh is a grid of 2 m squares; around the pool it has to drop under the deck too, or its slope would
 * show inside the pool. The deck covers this ring, and people walk on `height` (the exact pool edge).
 */
function meshHeight(x, z) {
  const near = Math.abs(x - POOL.cx) < POOL.halfX + 2.6 && Math.abs(z - POOL.cz) < POOL.halfZ + 2.6;
  return near ? POOL.bottom : beachHeight(x, z);
}

export function buildWorld(scene) {
  return buildBeach(scene, {
    checkinSign: ['קליטה', 'גיבוש שייטת 13'],
    groundHeight: meshHeight,
    extra: (scene2, { box, colliders, updaters }) => {
      const { cx, cz, halfX: hx, halfZ: hz } = POOL;
      const depth = -POOL.bottom;
      const tile = new THREE.MeshStandardMaterial({ map: tileTexture('#8fd0e6', '#6fb6cf', 40, 10), roughness: 0.4 });
      const floorTile = new THREE.MeshStandardMaterial({ map: tileTexture('#9ad8ec', '#7cc2da', 50, 100), roughness: 0.4 });
      const deck = new THREE.MeshStandardMaterial({ map: tileTexture('#e9e4d8', '#d2cbbb', 20, 30), roughness: 0.9 });
      const line = new THREE.MeshStandardMaterial({ color: '#1d3f8a' });
      const add = (mesh, x, y, z) => {
        mesh.position.set(x, y, z);
        scene2.add(mesh);
        return mesh;
      };
      // Deck around the pool (a slab a little above the sand).
      const DX = 4;
      for (const [x, z, sx, sz] of [
        [cx - hx - DX / 2, cz, DX, hz * 2 + DX * 2],
        [cx + hx + DX / 2, cz, DX, hz * 2 + DX * 2],
        [cx, cz - hz - DX / 2, hx * 2, DX],
        [cx, cz + hz + DX / 2, hx * 2, DX],
      ]) box(x, z, sx, 0.06, sz, deck, { y: 0.0 });
      const floor = add(new THREE.Mesh(new THREE.PlaneGeometry(hx * 2, hz * 2), floorTile), cx, POOL.bottom, cz);
      floor.rotation.x = -Math.PI / 2;
      const side = new THREE.PlaneGeometry(hz * 2, depth);
      const end = new THREE.PlaneGeometry(hx * 2, depth);
      const w1 = add(new THREE.Mesh(side, tile), cx - hx, POOL.bottom / 2, cz);
      w1.rotation.y = Math.PI / 2;
      const w2 = add(new THREE.Mesh(side, tile), cx + hx, POOL.bottom / 2, cz);
      w2.rotation.y = -Math.PI / 2;
      add(new THREE.Mesh(end, tile), cx, POOL.bottom / 2, cz - hz);
      const w4 = add(new THREE.Mesh(end, tile), cx, POOL.bottom / 2, cz + hz);
      w4.rotation.y = Math.PI;
      for (const x of [-3, 0, 3]) box(cx + x, cz, 0.25, 0.01, hz * 2 - 4, line, { y: POOL.bottom });
      colliders.push({ minX: cx - hx - 0.05, maxX: cx + hx + 0.05, minZ: cz - hz - 0.05, maxZ: cz - hz });
      colliders.push({ minX: cx - hx - 0.05, maxX: cx + hx + 0.05, minZ: cz + hz, maxZ: cz + hz + 0.05 });
      colliders.push({ minX: cx - hx - 0.05, maxX: cx - hx, minZ: cz - hz, maxZ: cz + hz });
      colliders.push({ minX: cx + hx, maxX: cx + hx + 0.05, minZ: cz - hz, maxZ: cz + hz });
      const sign = makeSign(['בריכה', 'עומק 4 מ׳'], { width: 2, height: 0.55, bg: '#1d3f8a' });
      sign.rotation.y = -Math.PI / 2;
      add(sign, cx - hx - DX + 0.1, 1.6, cz);
      // Water.
      const uniforms = { time: { value: 0 } };
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(hx * 2, hz * 2),
        new THREE.ShaderMaterial({
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
          uniforms,
          vertexShader: /* glsl */ `varying vec2 vPos; void main() { vPos = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
          fragmentShader: /* glsl */ `
            uniform float time; varying vec2 vPos;
            void main() {
              float w = sin(vPos.x * 1.7 + time * 1.3) * cos(vPos.y * 1.3 - time * 1.1);
              float c = pow(abs(sin(vPos.x * 2.3 + w + time) * sin(vPos.y * 2.1 - w * 0.7 + time * 0.8)), 6.0);
              vec3 col = mix(vec3(0.05, 0.43, 0.6), vec3(0.37, 0.8, 0.9), 0.45 + 0.15 * w) + vec3(c) * 0.35;
              float front = gl_FrontFacing ? 1.0 : 0.0;
              gl_FragColor = vec4(mix(col * 0.55, col, front), mix(0.9, 0.62, front));
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }`,
        }),
      );
      water.rotation.x = -Math.PI / 2;
      water.userData.dynamic = true;
      water.renderOrder = 2;
      add(water, cx, POOL.water, cz);
      updaters.push((t) => {
        uniforms.time.value = t;
      });
      // Rings and a weight on the bottom (they disappear when picked up), a buoy far out at sea, the float ropes.
      const ringMat = new THREE.MeshStandardMaterial({ color: '#ff8a2a', roughness: 0.6 });
      const rings = [];
      for (let i = 0; i < 5; i++) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 16), ringMat);
        r.rotation.x = Math.PI / 2;
        r.userData.dynamic = true;
        add(r, cx - 2 + (i % 3) * 2, POOL.bottom + 0.05, cz - 6 + Math.floor(i / 3) * 3);
        rings.push(r);
      }
      const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 10), new THREE.MeshStandardMaterial({ color: '#ffb300', roughness: 0.5 }));
      buoy.userData.dynamic = true;
      add(buoy, SPOTS.buoy.x, SEA.level + 0.2, SPOTS.buoy.z);
      updaters.push((t) => {
        buoy.position.y = SEA.level + 0.2 + Math.sin(t * 1.2) * 0.12;
      });
      const ropeMat = new THREE.MeshStandardMaterial({ color: '#e9c46a', roughness: 0.9 });
      const floatLines = [];
      for (let i = 0; i < 4; i++) {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 16, 6), ropeMat);
        rope.rotation.z = Math.PI / 2;
        rope.userData.dynamic = true;
        add(rope, SPOTS.ropes.x, SEA.level + 0.02, SPOTS.ropes.z - i * 2.2);
        floatLines.push(rope);
      }
      return { rings, buoy, floatLines, poolWater: water };
    },
  });
}
