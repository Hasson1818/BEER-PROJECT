import * as THREE from 'three';

// The navigation map of ירפ״א ב׳: a paper-style map with symbols (rail, road, path, stream, power line, town) and the
// navigation axis drawn on it. The same features are also placed in the 3D world, so what you learn on the map is
// what you see out of the cockpit. Which symbols the real map has, and how they look, is NOT published anywhere: the
// symbols and colors here are ours (standard map conventions), and the game says so.

export const LEGEND = [
  { id: 'route', label: 'ציר הניווט שלך', note: 'ממנו לא סוטים' },
  { id: 'wp', label: 'נקודת ציון', note: 'עוברים לפי המספרים' },
  { id: 'rail', label: 'מסילת ברזל', note: 'קו שחור עם פסים' },
  { id: 'road', label: 'כביש', note: 'קו כתום' },
  { id: 'path', label: 'שביל', note: 'קו חום מקווקו' },
  { id: 'river', label: 'נחל', note: 'קו כחול מתפתל' },
  { id: 'power', label: 'קו מתח', note: 'קו דק עם עמודים' },
  { id: 'town', label: 'יישוב', note: 'גושי בתים' },
];

const TOWN_NAMES = ['נווה שלום', 'כפר הדרים', 'מעלה ים', 'עין גדי', 'בית אורן', 'רמת חן', 'שדה בר', 'גבעת עוז', 'אשל הנשיא', 'תל נוף', 'מצפה גל', 'כרמי יוסף'];

function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

const lerp = (a, b, t) => a + (b - a) * t;

/** Points from a to b with a gentle sideways wander (for streams, paths, roads). */
function wander(a, b, rnd, amp, step = 380) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  const n = Math.max(2, Math.round(len / step));
  const phase = rnd() * 6;
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = Math.sin(t * Math.PI * 3.1 + phase) * amp + Math.sin(t * Math.PI * 7.3 + phase * 2) * amp * 0.3;
    const fade = Math.min(1, t * 6, (1 - t) * 6) || 0;
    out.push({ x: lerp(a.x, b.x, t) + nx * w * Math.max(fade, 0.25), z: lerp(a.z, b.z, t) + nz * w * Math.max(fade, 0.25) });
  }
  return out;
}

/** Features around a route: `route` = [{x, z}] with the start first. Deterministic for a seed. */
export function makeFeatures(route, seed = 1) {
  const rnd = rng(seed * 97 + 13);
  const legs = [];
  for (let i = 0; i + 1 < route.length; i++) {
    const a = route[i];
    const b = route[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    legs.push({ a, b, len, ux: (b.x - a.x) / len, uz: (b.z - a.z) / len });
  }
  const at = (leg, t, off = 0) => ({ x: leg.a.x + (leg.b.x - leg.a.x) * t - leg.uz * off, z: leg.a.z + (leg.b.z - leg.a.z) * t + leg.ux * off });
  const pick = (k) => legs[Math.floor(rnd() * 1000) % legs.length] ?? legs[k % legs.length];
  const features = [];
  const cross = (leg, t, angle, half, id, amp) => {
    const c = at(leg, t);
    const dir = Math.atan2(leg.uz, leg.ux) + angle;
    const dx = Math.cos(dir);
    const dz = Math.sin(dir);
    const a = { x: c.x - dx * half, z: c.z - dz * half };
    const b = { x: c.x + dx * half, z: c.z + dz * half };
    features.push({ type: id, pts: amp ? wander(a, b, rnd, amp) : wander(a, b, rnd, 120, 700) });
  };

  const longest = legs.reduce((m, l) => (l.len > m.len ? l : m), legs[0]);
  cross(longest, 0.3 + rnd() * 0.4, Math.PI / 2 + (rnd() - 0.5) * 0.7, 5200, 'river', 420);
  const second = legs[(legs.indexOf(longest) + 1) % legs.length];
  cross(second, 0.25 + rnd() * 0.5, Math.PI / 2 + (rnd() - 0.5) * 0.5, 6000, 'rail', 0);
  const third = legs[(legs.indexOf(longest) + legs.length - 1) % legs.length];
  cross(third, 0.35 + rnd() * 0.3, Math.PI / 2 + (rnd() - 0.5) * 0.9, 6000, 'power', 0);
  cross(pick(3), 0.5, (rnd() - 0.5) * 0.5, 4200, 'road', 260);
  // A road along part of the route, off to one side.
  const alongLeg = pick(5);
  const side = rnd() < 0.5 ? -1 : 1;
  features.push({ type: 'road', pts: wander(at(alongLeg, 0.05, side * 700), at(alongLeg, 0.95, side * 1000), rnd, 300) });
  // A path leaving a waypoint.
  const wp = route[1 + Math.floor(rnd() * (route.length - 1)) % (route.length - 1)];
  const pathDir = rnd() * Math.PI * 2;
  features.push({ type: 'path', pts: wander(wp, { x: wp.x + Math.cos(pathDir) * 3600, z: wp.z + Math.sin(pathDir) * 3600 }, rnd, 220, 300) });
  // Towns next to the waypoints.
  const names = [...TOWN_NAMES].sort(() => rnd() - 0.5);
  const nTowns = Math.min(3, Math.max(2, route.length - 1));
  for (let i = 0; i < nTowns; i++) {
    const base = route[1 + (i % (route.length - 1))];
    const ang = rnd() * Math.PI * 2;
    const dist = 900 + rnd() * 900;
    features.push({ type: 'town', x: base.x + Math.cos(ang) * dist, z: base.z + Math.sin(ang) * dist, name: names[i], seed: Math.floor(rnd() * 1e6) });
  }
  return features;
}

// ---------------------------------------------------------------- 2D map

const PAPER = '#ece6d2';
const INK = '#2b2b2b';

function iconFor(ctx, id, x, y, w) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const half = w / 2;
  if (id === 'route') {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-half, 0);
    ctx.lineTo(half, 0);
    ctx.stroke();
    ctx.strokeStyle = '#127a35';
    ctx.lineWidth = 4;
    ctx.stroke();
  } else if (id === 'wp') {
    ctx.fillStyle = '#127a35';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 11px Heebo, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('1', 0, 4);
  } else if (id === 'rail') {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-half, 0);
    ctx.lineTo(half, 0);
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
  } else if (id === 'road') {
    ctx.strokeStyle = '#7a4a10';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-half, 0);
    ctx.lineTo(half, 0);
    ctx.stroke();
    ctx.strokeStyle = '#f0a030';
    ctx.lineWidth = 4;
    ctx.stroke();
  } else if (id === 'path') {
    ctx.strokeStyle = '#7a5530';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.moveTo(-half, 0);
    ctx.lineTo(half, 0);
    ctx.stroke();
  } else if (id === 'river') {
    ctx.strokeStyle = '#2a82d8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-half, 3);
    ctx.bezierCurveTo(-half / 2, -9, 0, 9, half, -3);
    ctx.stroke();
  } else if (id === 'power') {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-half, 0);
    ctx.lineTo(half, 0);
    ctx.stroke();
    for (const px of [-half * 0.6, 0, half * 0.6]) {
      ctx.beginPath();
      ctx.moveTo(px - 3, -3);
      ctx.lineTo(px + 3, 3);
      ctx.moveTo(px + 3, -3);
      ctx.lineTo(px - 3, 3);
      ctx.stroke();
    }
  } else if (id === 'town') {
    ctx.fillStyle = '#c9a99a';
    ctx.strokeStyle = '#6b4a3c';
    ctx.lineWidth = 1;
    for (const [dx, dy, s] of [[-9, -5, 8], [0, -7, 9], [8, -2, 8], [-4, 4, 9], [6, 6, 7]]) {
      ctx.fillRect(dx - s / 2, dy - s / 2, s, s);
      ctx.strokeRect(dx - s / 2, dy - s / 2, s, s);
    }
  }
  ctx.restore();
}

/** Draws the legend icon of a symbol (used in the legend rows of the cards). */
export function legendIcon(id, size = 56) {
  const c = document.createElement('canvas');
  c.width = size * 2;
  c.height = 40;
  c.style.width = `${size}px`;
  c.style.height = '20px';
  const g = c.getContext('2d');
  g.scale(2, 2);
  iconFor(g, id, size / 2, 10, size - 8);
  return c;
}

function polyline(ctx, pts, map) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const q = map(p);
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  });
}

/**
 * Draws the map into `canvas`: features + route. Returns a function from a world point {x, z} to map pixels. `route` = [{x, z}] (start first), `features` from makeFeatures.
 * North is up (x east, z south).
 */
export function drawNavMap(canvas, { route, features, size = 520 }) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.aspectRatio = '1 / 1';
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = PAPER;
  g.fillRect(0, 0, size, size);

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of route) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const margin = 1700;
  minX -= margin;
  maxX += margin;
  minZ -= margin;
  maxZ += margin;
  const span = Math.max(maxX - minX, maxZ - minZ, 4000);
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const scale = (size - 20) / span;
  const map = (p) => ({ x: size / 2 + (p.x - cx) * scale, y: size / 2 + (p.z - cz) * scale });

  // Grid: one square = 2 km.
  g.strokeStyle = 'rgba(80,70,40,0.16)';
  g.lineWidth = 1;
  const grid = 2000;
  for (let x = Math.ceil((cx - span / 2) / grid) * grid; x < cx + span / 2; x += grid) {
    const q = map({ x, z: 0 });
    g.beginPath();
    g.moveTo(q.x, 0);
    g.lineTo(q.x, size);
    g.stroke();
  }
  for (let z = Math.ceil((cz - span / 2) / grid) * grid; z < cz + span / 2; z += grid) {
    const q = map({ x: 0, z });
    g.beginPath();
    g.moveTo(0, q.y);
    g.lineTo(size, q.y);
    g.stroke();
  }

  g.lineCap = 'round';
  g.lineJoin = 'round';
  const order = ['river', 'path', 'power', 'road', 'rail'];
  for (const type of order) {
    for (const f of features) {
      if (f.type !== type) continue;
      if (type === 'river') {
        g.strokeStyle = '#2a82d8';
        g.lineWidth = 5;
        polyline(g, f.pts, map);
        g.stroke();
      } else if (type === 'path') {
        g.strokeStyle = '#7a5530';
        g.lineWidth = 2.5;
        g.setLineDash([2, 5]);
        polyline(g, f.pts, map);
        g.stroke();
        g.setLineDash([]);
      } else if (type === 'power') {
        g.strokeStyle = INK;
        g.lineWidth = 1.2;
        polyline(g, f.pts, map);
        g.stroke();
        const a = f.pts[0];
        const b = f.pts[f.pts.length - 1];
        const n = Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 900);
        for (let i = 0; i <= n; i++) {
          const q = map({ x: lerp(a.x, b.x, i / n), z: lerp(a.z, b.z, i / n) });
          g.beginPath();
          g.moveTo(q.x - 3, q.y - 3);
          g.lineTo(q.x + 3, q.y + 3);
          g.moveTo(q.x + 3, q.y - 3);
          g.lineTo(q.x - 3, q.y + 3);
          g.stroke();
        }
      } else if (type === 'road') {
        g.strokeStyle = '#7a4a10';
        g.lineWidth = 6.5;
        polyline(g, f.pts, map);
        g.stroke();
        g.strokeStyle = '#f0a030';
        g.lineWidth = 4;
        polyline(g, f.pts, map);
        g.stroke();
      } else if (type === 'rail') {
        g.strokeStyle = INK;
        g.lineWidth = 3.5;
        polyline(g, f.pts, map);
        g.stroke();
        g.strokeStyle = '#fff';
        g.lineWidth = 2;
        g.setLineDash([6, 6]);
        polyline(g, f.pts, map);
        g.stroke();
        g.setLineDash([]);
      }
    }
  }
  for (const f of features) {
    if (f.type !== 'town') continue;
    const q = map(f);
    const r = rng(f.seed);
    g.fillStyle = '#c9a99a';
    g.strokeStyle = '#6b4a3c';
    g.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const s = 5 + r() * 6;
      const bx = q.x + (r() - 0.5) * 30;
      const by = q.y + (r() - 0.5) * 22;
      g.fillRect(bx - s / 2, by - s / 2, s, s);
      g.strokeRect(bx - s / 2, by - s / 2, s, s);
    }
    g.fillStyle = '#3a2a22';
    g.font = '700 11px Heebo, sans-serif';
    g.textAlign = 'center';
    g.fillText(f.name, q.x, q.y + 26);
  }

  // The navigation axis, with a white halo so it reads on any symbol.
  g.strokeStyle = '#ffffff';
  g.lineWidth = 8;
  polyline(g, route, map);
  g.stroke();
  g.strokeStyle = '#127a35';
  g.lineWidth = 4.5;
  polyline(g, route, map);
  g.stroke();
  // Leg labels.
  g.font = '700 11px ui-monospace, Menlo, monospace';
  g.textAlign = 'center';
  for (let i = 0; i + 1 < route.length; i++) {
    const a = route[i];
    const b = route[i + 1];
    const hdg = (Math.round((Math.atan2(b.x - a.x, -(b.z - a.z)) * 180) / Math.PI + 360) % 360).toString().padStart(3, '0');
    const km = (Math.hypot(b.x - a.x, b.z - a.z) / 1000).toFixed(1);
    const q = map({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
    const text = `${hdg}° · ${km} ק״מ`;
    const wText = g.measureText(text).width + 8;
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillRect(q.x - wText / 2, q.y - 20, wText, 15);
    g.fillStyle = '#0d5a26';
    g.fillText(text, q.x, q.y - 9);
  }
  route.forEach((p, i) => {
    const q = map(p);
    if (i === 0) {
      const n = route[1];
      const ang = Math.atan2(n.x - p.x, -(n.z - p.z));
      g.save();
      g.translate(q.x, q.y);
      g.rotate(ang);
      g.fillStyle = '#127a35';
      g.strokeStyle = '#fff';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -13);
      g.lineTo(-9, 9);
      g.lineTo(9, 9);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
      g.fillStyle = '#0d5a26';
      g.font = '800 12px Heebo, sans-serif';
      g.fillText('התחלה', q.x, q.y + 26);
    } else {
      g.fillStyle = '#127a35';
      g.strokeStyle = '#fff';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(q.x, q.y, 12, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = '#fff';
      g.font = '800 13px Heebo, sans-serif';
      g.fillText(String(i), q.x, q.y + 4.5);
    }
  });
  // North arrow and a scale bar.
  g.fillStyle = INK;
  g.strokeStyle = INK;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(size - 28, 46);
  g.lineTo(size - 28, 16);
  g.moveTo(size - 28, 14);
  g.lineTo(size - 34, 26);
  g.lineTo(size - 22, 26);
  g.closePath();
  g.fill();
  g.font = '800 12px Heebo, sans-serif';
  g.fillText('צפון', size - 28, 60);
  const bar = 2000 * scale;
  g.fillRect(14, size - 22, bar, 4);
  g.fillText('2 ק״מ', 14 + bar / 2, size - 28);
  g.strokeStyle = 'rgba(30,30,30,0.7)';
  g.lineWidth = 3;
  g.strokeRect(0, 0, size, size);
  return map;
}

// ---------------------------------------------------------------- 3D

/** A flat strip following the terrain; `width` meters. */
function ribbon(points, width, color, height, lift = 3, opacity = 1) {
  const dense = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 160));
    for (let k = 0; k < n; k++) dense.push({ x: lerp(a.x, b.x, k / n), z: lerp(a.z, b.z, k / n) });
  }
  dense.push(points[points.length - 1]);
  const pos = [];
  const idx = [];
  dense.forEach((p, i) => {
    const q = dense[Math.min(dense.length - 1, i + 1)];
    const o = dense[Math.max(0, i - 1)];
    const dx = q.x - o.x;
    const dz = q.z - o.z;
    const len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * (width / 2);
    const nz = (dx / len) * (width / 2);
    for (const s of [-1, 1]) {
      const x = p.x + nx * s;
      const z = p.z + nz * s;
      pos.push(x, height(x, z) + lift, z);
    }
    if (i > 0) {
      const v = i * 2;
      idx.push(v - 2, v - 1, v, v - 1, v + 1, v);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, transparent: opacity < 1, opacity });
  return new THREE.Mesh(geo, mat);
}

/** Puts the features into the 3D scene. `add(mesh)` registers each object so the mission can clear it later. */
export function addFeaturesToWorld(features, height, add) {
  for (const f of features) {
    if (f.type === 'river') {
      add(ribbon(f.pts, 70, '#3a86c8', height, 2));
    } else if (f.type === 'rail') {
      add(ribbon(f.pts, 20, '#2a2a2c', height, 3));
      add(ribbon(f.pts, 8, '#7d7466', height, 3.6));
    } else if (f.type === 'road') {
      add(ribbon(f.pts, 30, '#3d3b3a', height, 3));
      add(ribbon(f.pts, 4, '#d9cf9c', height, 3.7));
    } else if (f.type === 'path') {
      add(ribbon(f.pts, 12, '#8b6a43', height, 2.6));
    } else if (f.type === 'power') {
      const a = f.pts[0];
      const b = f.pts[f.pts.length - 1];
      const n = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / 450));
      const mat = new THREE.MeshLambertMaterial({ color: '#6c6c70' });
      const prev = [];
      for (let i = 0; i <= n; i++) {
        const x = lerp(a.x, b.x, i / n);
        const z = lerp(a.z, b.z, i / n);
        const pole = new THREE.Mesh(new THREE.BoxGeometry(5, 46, 5), mat);
        pole.position.set(x, height(x, z) + 23, z);
        add(pole);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(30, 3, 3), mat);
        arm.position.set(x, height(x, z) + 42, z);
        arm.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
        add(arm);
        prev.push({ x, z });
      }
      add(ribbon(prev, 2.5, '#222', (x, z) => height(x, z) + 40, 0));
    } else if (f.type === 'town') {
      const r = rng(f.seed);
      const g = new THREE.Group();
      const colors = ['#d8cdb8', '#c9b79a', '#e6ded0', '#b9a58a'];
      for (let i = 0; i < 16; i++) {
        const w = 28 + r() * 46;
        const d = 28 + r() * 46;
        const hgt = 14 + r() * 34;
        const box = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), new THREE.MeshLambertMaterial({ color: colors[Math.floor(r() * colors.length)] }));
        const bx = f.x + (r() - 0.5) * 520;
        const bz = f.z + (r() - 0.5) * 420;
        box.position.set(bx, height(bx, bz) + hgt / 2, bz);
        g.add(box);
      }
      add(g);
    }
  }
}

/** Distance from point p to the segment a-b in the ground plane. */
export function distToSegment(px, pz, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / l2));
  return Math.hypot(px - (a.x + dx * t), pz - (a.z + dz * t));
}
