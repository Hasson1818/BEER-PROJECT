import * as THREE from 'three';
import { mergeStatic } from '../../shared/engine/merge.js';
import { canvasTexture, redraw, makePoster, makeSign } from '../../shared/engine/textures.js';

// The candidate's bedroom. Used for the test at home and for the video call with the psychologist.
// Units are meters. The room is x -3 .. 3, z -3.5 .. 3.5; the window is in the north wall (z = -3.5),
// the door in the south wall (z = +3.5), the desk stands under the window.

export const ROOM = { x1: -3, x2: 3, z1: -3.5, z2: 3.5, height: 2.8 };

export const HOME_SPOTS = {
  spawn: { x: -1.0, z: 2.4 },
  phone: { x: -2.35, z: 0.9 },
  window: { x: 0.0, z: -3.3 },
  desk: { x: 1.55, z: -2.75 },
  chair: { x: 1.55, z: -1.95 },
  door: { x: 0, z: 3.3 },
  drawer: { x: 2.4, z: -2.0 },
  water: { x: 2.4, z: 1.55 },
};

function woodTexture(base, dark, repeatX, repeatY) {
  const tex = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const planks = 8;
    for (let i = 0; i < planks; i++) {
      const x = (i / planks) * w;
      ctx.fillStyle = `rgba(${40 + (i * 37) % 40}, ${25 + (i * 23) % 25}, 10, ${0.08 + (i % 3) * 0.04})`;
      ctx.fillRect(x, 0, w / planks, h);
      ctx.strokeStyle = dark;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.globalAlpha = 0.1;
      for (let k = 0; k < 14; k++) {
        const y = Math.random() * h;
        ctx.beginPath();
        ctx.moveTo(x + 4, y);
        ctx.bezierCurveTo(x + 20, y + 30, x + 40, y - 20, x + w / planks - 4, y + 10);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Skyline seen through the window: stars and a lit city at night, or a bright day. */
function drawOutside(ctx, w, h, mode) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  if (mode === 'night') {
    sky.addColorStop(0, '#050914');
    sky.addColorStop(0.7, '#1c2744');
    sky.addColorStop(1, '#3a3452');
  } else {
    sky.addColorStop(0, '#4d8fd6');
    sky.addColorStop(0.8, '#bcd8ec');
    sky.addColorStop(1, '#e8eef0');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  if (mode === 'night') {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 60; i++) {
      ctx.globalAlpha = Math.random() * 0.8;
      ctx.fillRect(Math.random() * w, Math.random() * h * 0.5, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (const [x, y, r] of [[0.2, 0.25, 50], [0.55, 0.15, 70], [0.8, 0.3, 45]]) {
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(x * w + i * r * 0.5, y * h + Math.sin(i) * 8, r, r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // Buildings.
  let x = -20;
  while (x < w) {
    const bw = 50 + Math.random() * 70;
    const bh = h * (0.22 + Math.random() * 0.34);
    ctx.fillStyle = mode === 'night' ? '#0b1020' : '#8a98a8';
    ctx.fillRect(x, h - bh, bw, bh);
    for (let wy = h - bh + 10; wy < h - 12; wy += 16) {
      for (let wx = x + 7; wx < x + bw - 9; wx += 13) {
        if (mode === 'night') {
          if (Math.random() < 0.38) {
            ctx.fillStyle = Math.random() < 0.8 ? '#ffd88a' : '#9ad0ff';
            ctx.fillRect(wx, wy, 6, 9);
          }
        } else if (Math.random() < 0.5) {
          ctx.fillStyle = 'rgba(40,60,90,0.45)';
          ctx.fillRect(wx, wy, 6, 9);
        }
      }
    }
    x += bw + 3;
  }
}

export function buildHomeRoom(scene, { outside = 'night' } = {}) {
  const colliders = [];
  const blockers = [];
  const updaters = [];
  const { x1, x2, z1, z2, height: H } = ROOM;

  const M = {
    wall: new THREE.MeshStandardMaterial({ color: '#d9d4c8', roughness: 0.95 }),
    wallAccent: new THREE.MeshStandardMaterial({ color: '#41546f', roughness: 0.95 }),
    floor: new THREE.MeshStandardMaterial({ map: woodTexture('#b88a56', '#6b4a28', 3, 3), roughness: 0.55 }),
    rug: new THREE.MeshStandardMaterial({ color: '#46618a', roughness: 1 }),
    rugEdge: new THREE.MeshStandardMaterial({ color: '#d8c9a2', roughness: 1 }),
    ceiling: new THREE.MeshBasicMaterial({ color: '#e6e0d4' }),
    trim: new THREE.MeshStandardMaterial({ color: '#f3f1ea', roughness: 0.7 }),
    wood: new THREE.MeshStandardMaterial({ color: '#9a7249', roughness: 0.6 }),
    darkWood: new THREE.MeshStandardMaterial({ color: '#5a3d24', roughness: 0.7 }),
    white: new THREE.MeshStandardMaterial({ color: '#f1efe8', roughness: 0.7 }),
    blanket: new THREE.MeshStandardMaterial({ color: '#2f5d8a', roughness: 1 }),
    pillow: new THREE.MeshStandardMaterial({ color: '#e7ebf0', roughness: 1 }),
    metal: new THREE.MeshStandardMaterial({ color: '#9aa0a6', metalness: 0.6, roughness: 0.4 }),
    black: new THREE.MeshStandardMaterial({ color: '#16181c', roughness: 0.5 }),
    glass: new THREE.MeshStandardMaterial({ color: '#cfe8f2', transparent: true, opacity: 0.18, roughness: 0.1, depthWrite: false }),
    curtain: new THREE.MeshStandardMaterial({ color: '#c9c0a8', roughness: 1, side: THREE.DoubleSide }),
    chair: new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.7 }),
    book: [
      new THREE.MeshStandardMaterial({ color: '#7a2f2f' }),
      new THREE.MeshStandardMaterial({ color: '#2f5a7a' }),
      new THREE.MeshStandardMaterial({ color: '#4a6a3a' }),
      new THREE.MeshStandardMaterial({ color: '#c9a64a' }),
      new THREE.MeshStandardMaterial({ color: '#6a4a7a' }),
    ],
    plane: new THREE.MeshStandardMaterial({ color: '#8c98a6', metalness: 0.4, roughness: 0.5 }),
    planeDark: new THREE.MeshStandardMaterial({ color: '#3d4652', metalness: 0.3, roughness: 0.6 }),
    lampShade: new THREE.MeshStandardMaterial({ color: '#f3d9a0', emissive: '#f0b050', emissiveIntensity: 0.9, roughness: 0.8 }),
    light: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff1d0', emissiveIntensity: 1.3 }),
  };

  function box(x, y, z, sx, sy, sz, material, { collide = false, block = false } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    if (collide) colliders.push({ minX: x - sx / 2, maxX: x + sx / 2, minZ: z - sz / 2, maxZ: z + sz / 2 });
    if (block) blockers.push(mesh);
    return mesh;
  }

  // ---------- Shell ----------

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.001, 0);
  scene.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), M.ceiling);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, H, 0);
  scene.add(ceiling);

  const t = 0.12;
  // North wall (window), south wall (door), side walls. Window opening 2.0 wide, y 0.95 .. 2.15.
  const winW = 2.0;
  box(x1 / 2 - winW / 4, H / 2, z1, (x2 - x1 - winW) / 2, H, t, M.wall, { collide: true, block: true });
  box(x2 / 2 + winW / 4, H / 2, z1, (x2 - x1 - winW) / 2, H, t, M.wall, { collide: true, block: true });
  box(0, 0.475, z1, winW, 0.95, t, M.wall, { collide: true, block: true });
  box(0, (H + 2.15) / 2, z1, winW, H - 2.15, t, M.wall, { collide: true, block: true });
  box(0, H / 2, z2, x2 - x1, H, t, M.wallAccent, { collide: true, block: true });
  box(x1, H / 2, 0, t, H, z2 - z1, M.wall, { collide: true, block: true });
  box(x2, H / 2, 0, t, H, z2 - z1, M.wall, { collide: true, block: true });
  // Skirting boards.
  for (const [x, z, sx, sz] of [[0, z1 + 0.07, x2 - x1, 0.03], [0, z2 - 0.07, x2 - x1, 0.03], [x1 + 0.07, 0, 0.03, z2 - z1], [x2 - 0.07, 0, 0.03, z2 - z1]]) box(x, 0.06, z, sx, 0.12, sz, M.trim);

  // The window: frame, outside picture, glass, curtains.
  const outsideTexture = canvasTexture(1024, 512, (ctx, w, h) => drawOutside(ctx, w, h, outside));
  const outsideMesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: outsideTexture, toneMapped: false, fog: false }));
  outsideMesh.position.set(0, 3.0, z1 - 9);
  scene.add(outsideMesh);
  box(0, 1.55, z1, winW + 0.1, 0.05, 0.2, M.trim);
  box(0, 0.93, z1, winW + 0.2, 0.05, 0.28, M.trim);
  box(0, 2.17, z1, winW + 0.1, 0.05, 0.2, M.trim);
  box(-winW / 2, 1.55, z1, 0.05, 1.2, 0.2, M.trim);
  box(winW / 2, 1.55, z1, 0.05, 1.2, 0.2, M.trim);
  box(0, 1.55, z1, 0.04, 1.2, 0.12, M.trim);
  box(0, 1.55, z1 + 0.04, winW, 1.2, 0.02, M.glass);
  const curtainL = box(-winW / 2 - 0.35, 1.55, z1 + 0.18, 0.55, 1.9, 0.07, M.curtain);
  const curtainR = box(winW / 2 + 0.35, 1.55, z1 + 0.18, 0.55, 1.9, 0.07, M.curtain);
  box(0, 2.55, z1 + 0.18, winW + 1.6, 0.03, 0.03, M.metal);
  let curtainTarget = 0;
  let curtainNow = 0;
  updaters.push((time, dt = 0.016) => {
    curtainNow += (curtainTarget - curtainNow) * Math.min(1, dt * 2.2);
    curtainL.position.x = -winW / 2 - 0.35 + curtainNow * 0.8;
    curtainR.position.x = winW / 2 + 0.35 - curtainNow * 0.8;
    curtainL.scale.x = 1 + curtainNow * 0.9;
    curtainR.scale.x = 1 + curtainNow * 0.9;
    curtainL.rotation.z = Math.sin(time * 0.6) * 0.012;
    curtainR.rotation.z = Math.sin(time * 0.6 + 1) * 0.012;
  });

  // Door in the south wall.
  box(0, 1.0, z2 - 0.07, 0.95, 2.0, 0.06, M.wood, { block: true });
  box(0.38, 1.0, z2 - 0.12, 0.05, 0.05, 0.08, M.metal);
  box(0, 2.03, z2 - 0.07, 1.08, 0.08, 0.12, M.trim);
  box(-0.5, 1.0, z2 - 0.07, 0.08, 2.0, 0.12, M.trim);
  box(0.5, 1.0, z2 - 0.07, 0.08, 2.0, 0.12, M.trim);

  // Rug.
  const rugEdge = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.9), M.rugEdge);
  rugEdge.rotation.x = -Math.PI / 2;
  rugEdge.position.set(0.3, 0.004, 0.9);
  scene.add(rugEdge);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.7), M.rug);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.3, 0.006, 0.9);
  scene.add(rug);

  // ---------- Bed and bedside table (phone) ----------

  box(-2.25, 0.2, -0.6, 1.5, 0.4, 2.2, M.darkWood, { collide: true, block: true });
  box(-2.25, 0.46, -0.55, 1.4, 0.16, 2.05, M.pillow);
  box(-2.25, 0.57, -0.15, 1.38, 0.1, 1.2, M.blanket);
  box(-2.25, 0.62, -1.38, 0.9, 0.12, 0.34, M.pillow);
  box(-2.25, 0.55, -1.74, 1.5, 0.9, 0.08, M.darkWood);
  box(-2.7, 0.3, 1.0, 0.5, 0.6, 0.5, M.wood, { collide: true, block: true });
  box(-2.7, 0.62, 1.0, 0.5, 0.04, 0.5, M.darkWood);
  const phone = box(-2.62, 0.66, 0.95, 0.07, 0.012, 0.15, M.black);
  phone.rotation.y = 0.5;
  const phoneScreenTexture = canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#0a1426';
    ctx.fillRect(0, 0, w, h);
  });
  const phoneScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.13), new THREE.MeshBasicMaterial({ map: phoneScreenTexture, toneMapped: false }));
  phoneScreen.rotation.x = -Math.PI / 2;
  phoneScreen.rotation.z = -0.5;
  phoneScreen.position.set(-2.62, 0.673, 0.95);
  scene.add(phoneScreen);
  // Bedside lamp.
  box(-2.78, 0.7, 1.15, 0.12, 0.04, 0.12, M.metal);
  box(-2.78, 0.82, 1.15, 0.025, 0.24, 0.025, M.metal);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.2, 14, 1, true), M.lampShade);
  shade.material.side = THREE.DoubleSide;
  shade.position.set(-2.78, 1.0, 1.15);
  scene.add(shade);
  const bedLamp = new THREE.PointLight('#ffc27a', 3.2, 5, 1.6);
  bedLamp.position.set(-2.6, 1.05, 1.1);
  scene.add(bedLamp);

  // ---------- Desk, laptop and chair ----------

  const deskTop = box(1.55, 0.74, -2.85, 1.9, 0.045, 0.8, M.wood);
  deskTop.castShadow = false;
  box(0.7, 0.37, -2.85, 0.06, 0.72, 0.75, M.darkWood, { collide: false });
  box(2.4, 0.37, -2.85, 0.06, 0.72, 0.75, M.darkWood, { collide: false });
  colliders.push({ minX: 0.6, maxX: 2.5, minZ: -3.3, maxZ: -2.45 });
  // Drawers on the right.
  box(2.2, 0.35, -2.85, 0.4, 0.68, 0.74, M.darkWood);
  box(2.2, 0.55, -2.47, 0.3, 0.02, 0.02, M.metal);
  box(2.2, 0.28, -2.47, 0.3, 0.02, 0.02, M.metal);
  // Laptop: base, hinge, lid with a live screen.
  box(1.45, 0.775, -2.85, 0.4, 0.015, 0.28, M.metal);
  const lid = new THREE.Group();
  lid.position.set(1.45, 0.78, -2.99);
  lid.rotation.x = -0.28;
  scene.add(lid);
  const lidShell = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.27, 0.012), M.metal);
  lidShell.position.set(0, 0.135, 0);
  lid.add(lidShell);
  const screenTexture = canvasTexture(640, 400, (ctx, w, h) => drawLaptopIdle(ctx, w, h, 0));
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.37, 0.235), new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false }));
  screenMesh.position.set(0, 0.135, 0.0075);
  screenMesh.userData.dynamic = true;
  lid.add(screenMesh);
  let screenState = 'idle';
  const setScreen = (state) => {
    screenState = state;
    redraw(screenTexture, (ctx, w, h) => drawLaptopIdle(ctx, w, h, state === 'on' ? 1 : state === 'call' ? 2 : 0));
  };
  const laptopGlow = new THREE.PointLight('#8ab8ff', 0.8, 2.2, 1.8);
  laptopGlow.position.set(1.45, 1.0, -2.55);
  scene.add(laptopGlow);
  // Mouse, notebook, bottle, headphones, cup of pens, model plane.
  box(1.85, 0.768, -2.7, 0.06, 0.02, 0.1, M.black);
  box(1.05, 0.765, -2.7, 0.2, 0.012, 0.28, M.white);
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 12), new THREE.MeshStandardMaterial({ color: '#8fc6e8', transparent: true, opacity: 0.65 }));
  bottle.position.set(0.85, 0.87, -2.95);
  scene.add(bottle);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 10), M.darkWood);
  cup.position.set(0.8, 0.8, -2.55);
  scene.add(cup);
  const deskPlane = makeModelPlane(M, 0.22);
  deskPlane.position.set(2.0, 0.84, -3.05);
  deskPlane.rotation.y = -0.6;
  scene.add(deskPlane);
  // Desk lamp.
  box(0.78, 0.77, -3.1, 0.12, 0.03, 0.12, M.black);
  const lampArm = box(0.78, 1.0, -3.1, 0.02, 0.45, 0.02, M.black);
  lampArm.rotation.z = 0.15;
  const lampHead = box(0.72, 1.22, -3.0, 0.2, 0.05, 0.14, M.lampShade);
  lampHead.rotation.z = -0.3;
  const deskLamp = new THREE.PointLight('#ffd9a0', 2.4, 4, 1.7);
  deskLamp.position.set(0.8, 1.15, -2.9);
  scene.add(deskLamp);
  // Chair (swivel) in front of the desk.
  const chair = new THREE.Group();
  chair.position.set(1.55, 0, -1.95);
  chair.rotation.y = Math.PI;
  scene.add(chair);
  const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.5), M.chair);
  seatMesh.position.y = 0.47;
  const backMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.06), M.chair);
  backMesh.position.set(0, 0.8, -0.24);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8), M.metal);
  pole.position.y = 0.24;
  chair.add(seatMesh, backMesh, pole);
  for (let i = 0; i < 5; i++) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.3), M.metal);
    leg.geometry.translate(0, 0, 0.15);
    leg.position.y = 0.05;
    leg.rotation.y = (i / 5) * Math.PI * 2;
    chair.add(leg);
  }

  // ---------- Shelf, wardrobe, posters ----------

  // Shelf on the east wall with books and model planes.
  box(x2 - 0.2, 1.55, 0.3, 0.3, 0.04, 1.9, M.wood);
  box(x2 - 0.2, 1.9, 0.3, 0.3, 0.04, 1.9, M.wood);
  box(x2 - 0.2, 1.2, 0.3, 0.3, 0.04, 1.9, M.wood);
  for (let i = 0; i < 9; i++) {
    const book = box(x2 - 0.2, 1.64, -0.55 + i * 0.1, 0.22, 0.2 + (i % 3) * 0.03, 0.07, M.book[i % M.book.length]);
    book.position.y = 1.56 + book.geometry.parameters.height / 2;
  }
  [[0.55, 0.9], [0.95, 0.9], [1.1, 0.4]].forEach(([z, s], i) => {
    const p = makeModelPlane(M, 0.18 * s);
    p.position.set(x2 - 0.2, 1.94 + 0.03, z - 0.4);
    p.rotation.y = Math.PI / 2 + i * 0.4;
    scene.add(p);
  });
  const dreamPlane = makeModelPlane(M, 0.3);
  dreamPlane.position.set(x2 - 0.2, 1.24, 0.3);
  dreamPlane.rotation.y = Math.PI / 2;
  scene.add(dreamPlane);
  // A small table with a water bottle (you take it before the test).
  box(2.6, 0.3, 1.55, 0.5, 0.6, 0.5, M.wood, { collide: true, block: true });
  const tableBottle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.24, 12), new THREE.MeshStandardMaterial({ color: '#8fc6e8', transparent: true, opacity: 0.7 }));
  tableBottle.position.set(2.6, 0.72, 1.55);
  scene.add(tableBottle);
  // Wardrobe.
  box(2.55, 1.1, 2.55, 0.9, 2.2, 0.55, M.wood, { collide: true, block: true });
  box(2.55, 1.1, 2.26, 0.02, 2.0, 0.02, M.darkWood);
  // Posters and a clock.
  const posterA = makePoster('חלום', ['כנפי טיס', 'עוד לא ויתרתי'], { width: 0.7, height: 0.95, color: '#1f3b73' });
  posterA.position.set(x1 + 0.08, 1.55, -1.2);
  posterA.rotation.y = Math.PI / 2;
  scene.add(posterA);
  const posterB = makePoster('F-35', ['אדיר', 'חיל האוויר'], { width: 0.9, height: 0.6, color: '#2f3a20' });
  posterB.position.set(x1 + 0.08, 1.55, 0.2);
  posterB.rotation.y = Math.PI / 2;
  scene.add(posterB);
  const clockFace = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#f3f1ea';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.sin(a) * 46, h / 2 - Math.cos(a) * 46);
      ctx.lineTo(w / 2 + Math.sin(a) * 54, h / 2 - Math.cos(a) * 54);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2);
    ctx.lineTo(w / 2 + 20, h / 2 + 10);
    ctx.moveTo(w / 2, h / 2);
    ctx.lineTo(w / 2 - 6, h / 2 - 34);
    ctx.stroke();
  });
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), new THREE.MeshBasicMaterial({ map: clockFace }));
  clock.position.set(0.1, 2.2, z2 - 0.11);
  clock.rotation.y = Math.PI;
  scene.add(clock);
  const signBoard = makeSign(['ירפ״א', 'עוד שבועיים'], { width: 0.7, height: 0.25, bg: '#2f3a20' });
  signBoard.position.set(-1.0, 1.9, z2 - 0.11);
  signBoard.rotation.y = Math.PI;
  scene.add(signBoard);

  // Ceiling light.
  box(0, H - 0.04, 0.2, 0.7, 0.05, 0.3, M.light);
  const ceilingLight = new THREE.PointLight('#fff1d6', 5.5, 9, 1.4);
  ceilingLight.position.set(0, H - 0.3, 0.2);
  scene.add(ceilingLight);

  mergeStatic(scene, blockers);

  return {
    colliders,
    blockers,
    floodlights: { setPower() {} },
    seat: { x: 1.55, z: -1.95, yaw: 0 },
    setScreen,
    get screenState() {
      return screenState;
    },
    phoneScreenTexture,
    lights: { ceiling: ceilingLight, bed: bedLamp, desk: deskLamp, laptop: laptopGlow },
    setOutside(mode) {
      redraw(outsideTexture, (ctx, w, h) => drawOutside(ctx, w, h, mode));
    },
    /** The things you do to get the room ready: close the window, put the phone away, take the water. */
    prep(id) {
      if (id === 'window') curtainTarget = 1;
      if (id === 'drawer') {
        phone.visible = false;
        phoneScreen.visible = false;
      }
      if (id === 'water') tableBottle.visible = false;
    },
    resetPrep() {
      curtainTarget = 0;
      phone.visible = true;
      phoneScreen.visible = true;
      tableBottle.visible = true;
    },
    update(time, dt) {
      for (const fn of updaters) fn(time, dt);
      laptopGlow.intensity = (screenState === 'idle' ? 0.5 : 1.1) + Math.sin(time * 9) * 0.02;
    },
  };
}

function drawLaptopIdle(ctx, w, h, mode) {
  // 0: a quiet lock screen, 1: the exam portal's blue page, 2: video call grid.
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, mode === 2 ? '#10161f' : '#16305c');
  g.addColorStop(1, mode === 2 ? '#1a2434' : '#0c1a33');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.textAlign = 'center';
  if (mode === 0) {
    ctx.font = '700 70px Heebo, sans-serif';
    ctx.fillText('21:15', w / 2, h / 2);
    ctx.font = '500 24px Heebo, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('יום שלישי', w / 2, h / 2 + 40);
  } else if (mode === 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(40, 40, w - 80, 36);
    ctx.fillStyle = '#4ea1ff';
    ctx.fillRect(40, 110, 220, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '700 34px Heebo, sans-serif';
    ctx.fillText('בוחן מקוון · חיל האוויר', w / 2, 220);
  } else {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i === 0 ? '#2f4a6a' : '#233046';
      ctx.fillRect(30 + (i % 2) * 300, 40 + Math.floor(i / 2) * 170, 280, 150);
    }
  }
}

/** A small jet made of boxes, for shelves and desks. `size` is the wingspan in meters. */
export function makeModelPlane(M, size = 0.2) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(size * 0.16, size * 0.1, size * 1.1), M.plane);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(size * 0.08, size * 0.35, 8), M.plane);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = size * 0.7;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(size, size * 0.015, size * 0.38), M.plane);
  wing.position.z = -size * 0.08;
  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(size * 0.42, size * 0.012, size * 0.18), M.plane);
  tailWing.position.z = -size * 0.48;
  const fin = new THREE.Mesh(new THREE.BoxGeometry(size * 0.012, size * 0.2, size * 0.2), M.planeDark);
  fin.position.set(0, size * 0.12, -size * 0.45);
  g.add(body, nose, wing, tailWing, fin);
  return g;
}
