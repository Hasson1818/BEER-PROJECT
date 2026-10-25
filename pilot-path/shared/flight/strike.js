import * as THREE from 'three';
import { showScreen, el, button } from '../screens.js';
import { engine, speak, tone, noise } from '../fx.js';
import { Plane, KT } from './plane.js';
import { createFlightWorld, makeJet } from './world.js';
import { createControls } from './input.js';
import { chooseScheme } from './scheme.js';
import { buildMissions, findRegion, POINTS, scaleD, FRUITS } from './strike-levels.js';
import { makeFeatures, drawNavMap, addFeaturesToWorld, distToSegment, LEGEND, legendIcon } from './navmap.js';

// The second simulator of ירפ״א ב׳ (navigation and shooting): a cockpit view over aerial-looking terrain, a heading
// tape, a mini-map with three circles (1, 2, 3 km), air and ground threats with alarms and defenses, targets worth
// different points, a limited number of missiles, and 20 training missions followed by 30 tests.
// Much of this follows what a candidate described; the public sources confirm only the outline (see README).

const GREEN = '#7dff9a';
const RED = '#ff4d4d';
const CYAN = '#4ee3ff';
const ORANGE = '#ffa229';
const LIME = '#7bf15a';
const TARGET_COLOR = { cone: CYAN, square: ORANGE, circle: LIME };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Aiming: the sight is moved with keys (Q/E/R/F) inside this box, in degrees from the nose. Lock needs the target inside
// the sight for LOCK_T seconds. The hit chance is best near 1 km and falls on both sides: our numbers, not published.
const RET_X = 16;
const RET_Y = 11;
const RET_RATE = 22;
const LOCK_T = 1.2;
const LOCK_ANGLE = 2.4;
const hitChance = (d) => clamp(d < 1000 ? 0.95 - (1000 - d) * 0.0004 : 0.95 - (d - 1000) * 0.00022, 0.12, 0.95);
const clamp = THREE.MathUtils.clamp;
const rad = THREE.MathUtils.degToRad;

/** Resolves to { passed, score, levels: [{ id, title, score, phase, points }], points } */
export function runStrikeSimulator(game, { fx, short = false } = {}) {
  if (import.meta.env.DEV && window.__strikeShort !== undefined) short = window.__strikeShort;
  return showScreen(game, 'st-screen', (root, close, helpers) => {
    injectStyle();
    start(root, close, helpers, { fx, short });
  });
}

function start(root, close, helpers, { fx, short }) {
  // ---------- DOM ----------
  const stage = el('div', 'st-stage');
  const canvas3d = el('canvas', 'st-3d');
  const hudCanvas = el('canvas', 'st-hud');
  const top = el('div', 'st-top');
  const titleEl = el('strong', 'st-title');
  const dots = el('div', 'st-dots');
  top.append(titleEl, dots);
  const subtitle = el('div', 'st-subtitle');
  const flash = el('div', 'st-flash');
  const overlay = el('div', 'st-overlay');
  const cards = el('div', 'st-cards');
  const bar = el('div', 'st-bar');
  bar.innerHTML = `
    <button class="st-def air" data-act="air" type="button"><span>הגנה אווירית</span><b>6</b><kbd>1</kbd><i></i></button>
    <button class="st-def gnd" data-act="ground" type="button"><span>הגנה קרקעית</span><b>6</b><kbd>2</kbd><i></i></button>
    <div class="st-radio"><button class="st-rb" data-act="radioA" type="button"><span>קיבלתי קריאה</span><kbd>Z</kbd></button><button class="st-rb" data-act="radioB" type="button"><span>שמעתי הוראה</span><kbd>X</kbd></button></div>
    <div class="st-ret" aria-label="כוונת"><button data-ret="retU" type="button" aria-label="כוונת למעלה"><kbd>R</kbd>▲</button><button data-ret="retL" type="button" aria-label="כוונת שמאלה"><kbd>Q</kbd>◀</button><button data-ret="retD" type="button" aria-label="כוונת למטה"><kbd>F</kbd>▼</button><button data-ret="retR" type="button" aria-label="כוונת ימינה"><kbd>E</kbd>▶</button></div>
    <button class="st-fire" data-act="missile" type="button"><span>שיגור טיל</span><b>13</b><kbd>Space</kbd></button>
    <div class="st-thr"><span>מצערת</span><div><i></i></div></div>`;
  stage.append(canvas3d, hudCanvas, flash, top, subtitle, overlay, bar, cards);
  root.append(stage);
  const q = (sel) => bar.querySelector(sel);

  // ---------- 3D ----------
  const renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 1, 32000);
  const world = createFlightWorld(scene, { mountains: 1, aerial: true, time: 'afternoon' });
  const region = findRegion(world.height);
  const plane = new Plane({ position: V(region.start.x, region.baseAlt, region.start.z), speed: 140, assist: 0.6 });
  const ret = { x: 0, y: 0 }; // the sight, in degrees from the nose
  const hud = hudCanvas.getContext('2d');
  const sound = engine();

  // ---------- Controls ----------
  const act = {
    air: () => useDefense('air'),
    ground: () => useDefense('ground'),
    missile: () => fireMissile(),
    radioA: () => radioPress('a'),
    radioB: () => radioPress('b'),
  };
  const controls = createControls(stage, {
    renderButtons: false,
    buttons: [
      { id: 'missile', label: 'שיגור טיל', keys: ['Space', 'Enter'], onPress: () => act.missile() },
      { id: 'radioA', label: 'קיבלתי קריאה', keys: ['KeyZ'], onPress: () => act.radioA() },
      { id: 'radioB', label: 'שמעתי הוראה', keys: ['KeyX'], onPress: () => act.radioB() },
      { id: 'retL', label: 'כוונת שמאלה', keys: ['KeyQ'], hold: true },
      { id: 'retR', label: 'כוונת ימינה', keys: ['KeyE'], hold: true },
      { id: 'retU', label: 'כוונת למעלה', keys: ['KeyR'], hold: true },
      { id: 'retD', label: 'כוונת למטה', keys: ['KeyF'], hold: true },
      { id: 'air', label: 'הגנה אווירית', keys: ['Digit1', 'Numpad1'], onPress: () => act.air() },
      { id: 'ground', label: 'הגנה קרקעית', keys: ['Digit2', 'Numpad2'], onPress: () => act.ground() },
    ],
  });
  for (const b of bar.querySelectorAll('button[data-act]')) b.addEventListener('click', () => act[b.dataset.act]());
  for (const b of bar.querySelectorAll('button[data-ret]')) {
    const id = b.dataset.ret;
    b.addEventListener('pointerdown', () => controls.holdPointer(id, true));
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => controls.holdPointer(id, false));
  }

  // ---------- The mission being flown ----------
  let M = null; // the mission state
  let time = 0;
  let paused = true;
  let shake = 0;
  let message = null;
  const missileList = [];

  function newMission(spec) {
    const m = {
      spec,
      region,
      objectives: [],
      planes: [],
      sites: [],
      vehicles: [],
      targets: [],
      decoys: [],
      radioList: [],
      callsign: FRUITS[Math.floor(Math.random() * FRUITS.length)],
      features: null,
      offTime: 0,
      offNow: false,
      radioWrong: 0,
      limit: 90,
      missiles: 0,
      defense: { air: 6, ground: 6 },
      t: 0,
      hits: 0,
      misfires: 0,
      decoyHits: 0,
      defenseUses: 0,
      wastedDefense: 0,
      points: 0,
      destroyed: 0,
      finished: null,
      lock: { target: null, t: 0 },
      def: { air: 0, ground: 0 },
      health: 3,
      alarm: null,
      alarmT: 0,
      radioNow: null,
      radioOk: 0,
      radioMiss: 0,
      // ---- the builder API the missions use ----
      hold(o) {
        this.objectives.push({ type: 'hold', ...o, t: 0, done: false });
      },
      nav(points, opts = {}) {
        const pts = points.map((p) => ({ ...region.at(scaleD(p.d), p.off), alt: region.baseAlt + 150 }));
        this.objectives.push({ type: 'nav', points: pts, route: [region.start, ...pts], i: 0, done: false, ...opts });
      },
      destroy(o) {
        this.objectives.push({ type: 'destroy', ...o, done: false });
      },
      target(kind, d, off) {
        const p = region.at(scaleD(d), off);
        this.targets.push({ kind, x: p.x, z: p.z, destroyed: false });
      },
      decoy(d, off) {
        const p = region.at(scaleD(d), off);
        this.decoys.push({ x: p.x, z: p.z, destroyed: false });
      },
      site(d, off) {
        const p = region.at(scaleD(d), off);
        this.sites.push({ x: p.x, z: p.z, fireT: 2.5, alive: true });
      },
      vehicle(d, off, { heading = 90 } = {}) {
        const p = region.at(scaleD(d), off);
        this.vehicles.push({ x: p.x, z: p.z, heading: rad(region.heading + heading), speed: 7, fireT: 2.5, alive: true });
      },
      air(o) {
        const p = region.at(scaleD(o.d), o.off ?? 0);
        this.planes.push({ x: p.x, z: p.z, y: region.baseAlt + 100 + (o.dy ?? 0), heading: rad(region.heading + 180), speed: 140, fireT: 3, mode: 'chase' });
      },
      radio(list) {
        this.radioList = list.map((r) => ({ ...r, done: false, started: false }));
      },
    };
    spec.make(m);
    if (!spec.absLimit) m.limit = Math.round(m.limit * 1.75); // the routes are longer than the numbers written in the mission
    // The map features (rail, road, stream...) around the first navigation route.
    const nav = m.objectives.find((o) => o.type === 'nav');
    if (nav) {
      let seed = 7;
      for (const ch of String(spec.id ?? spec.title)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
      m.features = makeFeatures(nav.route, seed);
    }
    for (const r of m.radioList) {
      if (r.kind === 'other') r.fruit = FRUITS.filter((f) => f !== m.callsign)[Math.floor(Math.random() * (FRUITS.length - 1))];
    }
    return m;
  }

  // Entities (meshes) for the current mission.
  const meshes = [];
  function addMesh(mesh) {
    scene.add(mesh);
    meshes.push(mesh);
    return mesh;
  }
  function clearMission() {
    for (const m of meshes) scene.remove(m);
    meshes.length = 0;
    world.clearDynamic();
    missileList.length = 0;
  }

  function build(m) {
    const h = world.height;
    for (const t of m.targets) {
      const y = h(t.x, t.z);
      let mesh;
      const mat = new THREE.MeshStandardMaterial({ color: TARGET_COLOR[t.kind], emissive: TARGET_COLOR[t.kind], emissiveIntensity: 0.55, roughness: 0.4 });
      if (t.kind === 'cone') mesh = new THREE.Mesh(new THREE.ConeGeometry(34, 90, 16), mat);
      else if (t.kind === 'square') mesh = new THREE.Mesh(new THREE.BoxGeometry(64, 64, 64), mat);
      else mesh = new THREE.Mesh(new THREE.SphereGeometry(38, 18, 14), mat);
      mesh.position.set(t.x, y + (t.kind === 'cone' ? 45 : t.kind === 'square' ? 32 : 38), t.z);
      t.y = mesh.position.y;
      t.mesh = addMesh(mesh);
    }
    for (const d of m.decoys) {
      const y = h(d.x, d.z);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(30, 36, 40, 14), new THREE.MeshStandardMaterial({ color: '#9aa0a8', roughness: 0.7 }));
      mesh.position.set(d.x, y + 20, d.z);
      d.y = mesh.position.y;
      d.mesh = addMesh(mesh);
    }
    for (const s of m.sites) {
      const y = h(s.x, s.z);
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(60, 26, 60), new THREE.MeshStandardMaterial({ color: '#6c3b34', roughness: 0.8 }));
      base.position.y = 13;
      const launcher = new THREE.Mesh(new THREE.BoxGeometry(14, 14, 60), new THREE.MeshStandardMaterial({ color: '#c0392b' }));
      launcher.position.set(0, 34, 0);
      launcher.rotation.x = -0.5;
      g.add(base, launcher);
      g.position.set(s.x, y, s.z);
      s.y = y + 20;
      s.mesh = addMesh(g);
    }
    for (const v of m.vehicles) {
      const y = h(v.x, v.z);
      const g = new THREE.Group();
      const bed = new THREE.Mesh(new THREE.BoxGeometry(22, 14, 54), new THREE.MeshStandardMaterial({ color: '#5a3a30' }));
      bed.position.y = 12;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(22, 18, 18), new THREE.MeshStandardMaterial({ color: '#8a2f2a' }));
      cab.position.set(0, 14, -34);
      const rocket = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 46), new THREE.MeshStandardMaterial({ color: '#c0392b' }));
      rocket.position.set(0, 26, 4);
      rocket.rotation.x = -0.3;
      g.add(bed, cab, rocket);
      g.position.set(v.x, y, v.z);
      v.y = y + 16;
      v.mesh = addMesh(g);
    }
    for (const a of m.planes) {
      const mesh = makeJet({ body: '#a33a2f', accent: '#ffcc00', scale: 3 });
      mesh.position.set(a.x, a.y, a.z);
      a.mesh = addMesh(mesh);
    }
    if (m.features) addFeaturesToWorld(m.features, h, addMesh);
    for (const o of m.objectives) {
      if (o.type === 'nav') {
        o.rings = o.points.map((p) => {
          const ring = world.addRing(p.x, p.alt, p.z, { radius: 230 });
          const next = new THREE.Vector3(p.x, p.alt, p.z);
          ring.userData.active = false;
          ring.visible = false;
          ring.userData.pos = next;
          return ring;
        });
      }
    }
  }

  // ---------- Things the player does ----------
  function useDefense(kind) {
    if (paused || !M || M.finished) return;
    const d = M.defense;
    if (d[kind] <= 0) {
      say('נגמרו ההגנות מהסוג הזה', '#ffb0b0', 1400);
      fx?.bad?.();
      return;
    }
    if (M.def[kind] > 0) return;
    d[kind]--;
    M.def[kind] = kind === 'air' ? 15 : 10;
    M.defenseUses++;
    // Wasted if nothing could shoot at us now or soon.
    const threats = threatInfo(M);
    if ((kind === 'air' && threats.airMin > 3200) || (kind === 'ground' && threats.groundMin > 1500)) M.wastedDefense++;
    fx?.coin?.();
    say(kind === 'air' ? 'הגנה אווירית פעילה: 15 שניות' : 'הגנה קרקעית פעילה: 10 שניות', CYAN, 1400);
  }

  function fireMissile() {
    if (paused || !M || M.finished) return;
    if (M.missiles <= 0) {
      say('נגמרו הטילים', '#ffb0b0', 1400);
      fx?.bad?.();
      return;
    }
    const L = M.lock;
    if (!L.target || L.t < LOCK_T) {
      say('אין נעילה: העבר את הכוונת על מטרה והחזק', '#ffb0b0', 1400);
      fx?.bad?.();
      return;
    }
    M.missiles--;
    fx?.gearThump?.();
    const m = world.addMissile(plane.position.clone().add(V(0, -4, 0)), L.target);
    m.velocity.copy(reticleDir(V(0, 0, 0))).multiplyScalar(260);
    m.speed = 420;
    m.homing = L.target;
    m.chance = L.chance ?? 0.5;
    m.willHit = Math.random() < m.chance;
    missileList.push(m);
    say('טיל שוגר', GREEN, 1000);
  }

  /** The direction the sight points at: the nose turned by the sight's offset. */
  const eulerTmp = new THREE.Euler(0, 0, 0, 'YXZ');
  function reticleDir(out) {
    eulerTmp.set(rad(ret.y), -rad(ret.x), 0, 'YXZ');
    return out.set(0, 0, -1).applyEuler(eulerTmp).applyQuaternion(plane.quaternion);
  }

  function say(text, color = GREEN, ms = 2600) {
    message = { text, color, until: time + ms / 1000 };
  }

  // The radio: a short line in the headphones, shown as a subtitle.
  function radioSay(text) {
    subtitle.textContent = text;
    subtitle.classList.add('on');
    clearTimeout(subtitle._t);
    subtitle._t = setTimeout(() => subtitle.classList.remove('on'), 4600);
    fx?.radio?.(1.2);
    speak(text, { rate: 1.05 });
  }

  // ---------- The radio ----------
  // Fruit call signs. Only the acknowledgement counts, nothing has to be flown: your own name alone = "received the
  // call"; your name and an instruction = both buttons; another fruit = press nothing.
  function radioFail(text) {
    M.radioMiss++;
    say(text, '#ffb0b0', 1800);
    fx?.bad?.();
  }
  function radioPress(which) {
    if (paused || !M || M.finished) return;
    fx?.click?.();
    const rn = M.radioNow;
    if (!rn || rn.done) {
      if (M.t - (M.radioEnd ?? -99) > 2.5) radioFail('לחצת בלי שקראו לך');
      return;
    }
    if (rn.kind === 'other') {
      rn.done = true;
      M.radioNow = null;
      M.radioEnd = M.t;
      radioFail(`הקריאה הייתה ל${rn.fruit}, לא אליך`);
    } else if (rn.kind === 'call') {
      if (which === 'a') {
        rn.done = true;
        M.radioNow = null;
        M.radioEnd = M.t;
        M.radioOk++;
        fx?.ok?.();
        say('✓ קלט', GREEN, 900);
      } else radioFail('בקריאה בלבד אין הוראה');
    } else {
      rn[which] = true;
      if (rn.a && rn.b) {
        rn.done = true;
        M.radioNow = null;
        M.radioEnd = M.t;
        M.radioOk++;
        fx?.ok?.();
        say('✓ קלט והוראה', GREEN, 900);
      } else say(which === 'a' ? 'קריאה התקבלה. מחכה לאישור ההוראה' : 'הוראה התקבלה. מחכה לאישור הקריאה', CYAN, 1200);
    }
  }

  // ---------- Threat bookkeeping ----------
  const flatDist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
  function threatInfo(m) {
    let airMin = Infinity;
    let groundMin = Infinity;
    for (const a of m.planes) airMin = Math.min(airMin, flatDist(a.x, a.z, plane.position.x, plane.position.z));
    for (const s of m.sites) if (s.alive) groundMin = Math.min(groundMin, flatDist(s.x, s.z, plane.position.x, plane.position.z));
    for (const v of m.vehicles) if (v.alive) groundMin = Math.min(groundMin, flatDist(v.x, v.z, plane.position.x, plane.position.z));
    return { airMin, groundMin };
  }

  // Two alarm sounds: a loud steady beep (air enemy within 3 km), and a different danger tone (within 2 km for
  // the air; within 2 km for the ground, starting to fire at 1 km).
  function alarms(dt) {
    if (!M) return;
    // Off the navigation axis: a harsher, louder, more annoying sound than the threat alarms.
    const navObj = M.objectives.find((o) => o.type === 'nav' && !o.done && o.corridor);
    M.offNow = Boolean(navObj?.off);
    M.offT = (M.offT ?? 0) - dt;
    if (M.offNow) {
      M.offTime += dt;
      if (M.offT <= 0) {
        M.offT = 0.2;
        M.offFlip = !M.offFlip;
        tone(M.offFlip ? 310 : 520, 0.19, { type: 'square', volume: 0.24 });
        tone(M.offFlip ? 620 : 233, 0.19, { type: 'sawtooth', volume: 0.1 });
      }
    }
    const { airMin, groundMin } = threatInfo(M);
    let kind = null;
    if (airMin < 2000 || groundMin < 2000) kind = 'danger';
    else if (airMin < 3000) kind = 'far';
    M.alarm = kind;
    M.alarmT -= dt;
    if (kind && !M.offNow && M.alarmT <= 0) {
      if (kind === 'far') {
        M.alarmT = 0.17;
        tone(1650, 0.11, { type: 'square', volume: 0.1 });
      } else {
        M.alarmT = 0.34;
        tone(M.alarmFlip ? 760 : 1010, 0.16, { type: 'sawtooth', volume: 0.09, slide: M.alarmFlip ? 700 : 930 });
        M.alarmFlip = !M.alarmFlip;
      }
    }
  }

  function hitPlayer(by) {
    M.hits++;
    M.health--;
    shake = Math.max(shake, 0.7);
    flash.classList.remove('on');
    void flash.offsetWidth;
    flash.classList.add('on');
    fx?.hit?.();
    noise(0.3, { freq: 600, q: 0.6, volume: 0.2, filter: 'lowpass' });
    say(by === 'air' ? 'נפגעת ממטוס אויב!' : 'נפגעת מטיל קרקעי!', '#ff8080', 1800);
    if (M.health <= 0) finishMission({ ok: false, reason: 'המטוס שלך הופל' });
  }

  function enemyFire(dt) {
    const px = plane.position.x;
    const pz = plane.position.z;
    for (const a of M.planes) {
      const d = flatDist(a.x, a.z, px, pz);
      if (d < 2000) {
        a.fireT -= dt;
        if (a.fireT <= 0) {
          a.fireT = 3.2;
          if (M.def.air > 0) {
            say('ההגנה האווירית חסמה ירי', CYAN, 1200);
            fx?.click?.();
          } else hitPlayer('air');
        }
      }
    }
    for (const s of [...M.sites, ...M.vehicles]) {
      if (!s.alive) continue;
      const d = flatDist(s.x, s.z, px, pz);
      if (d < 1000) {
        s.fireT -= dt;
        if (s.fireT <= 0) {
          s.fireT = 3.4;
          if (M.def.ground > 0) {
            say('ההגנה הקרקעית חסמה טיל', CYAN, 1200);
            fx?.click?.();
          } else hitPlayer('ground');
        }
      }
    }
  }

  function moveEnemies(dt) {
    for (const a of M.planes) {
      const dx = plane.position.x - a.x;
      const dz = plane.position.z - a.z;
      const d = Math.hypot(dx, dz);
      const want = a.mode === 'away' ? Math.atan2(-dx, dz) + Math.PI : Math.atan2(dx, -dz); // heading 0 = -z
      if (d < 650) a.mode = 'away';
      if (d > 4200) a.mode = 'chase';
      let diff = ((want - a.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      a.heading += clamp(diff, -0.45 * dt, 0.45 * dt) + Math.sin(time * 0.8 + a.x) * 0.03 * dt;
      a.x += Math.sin(a.heading) * a.speed * dt;
      a.z += -Math.cos(a.heading) * a.speed * dt;
      a.y += clamp(plane.position.y - a.y, -20 * dt, 20 * dt);
      const ground = world.height(a.x, a.z);
      a.y = Math.max(a.y, ground + 150);
      a.mesh.position.set(a.x, a.y, a.z);
      a.mesh.quaternion.setFromEuler(new THREE.Euler(0, -a.heading, 0, 'YXZ'));
      if (Math.floor(time * 12) !== Math.floor((time - dt) * 12)) world.puff(a.mesh.position.clone().add(V(-Math.sin(a.heading) * 40, 0, Math.cos(a.heading) * 40)), { size: 14, life: 2.4, color: '#ffffff', opacity: 0.35 });
    }
    for (const v of M.vehicles) {
      if (!v.alive) continue;
      v.x += Math.sin(v.heading) * v.speed * dt;
      v.z += -Math.cos(v.heading) * v.speed * dt;
      const y = world.height(v.x, v.z);
      v.mesh.position.set(v.x, y, v.z);
      v.mesh.rotation.y = -v.heading;
      v.y = y + 16;
    }
  }

  // ---------- Objectives ----------
  function updateObjectives(dt) {
    let allDone = true;
    for (const o of M.objectives) {
      if (o.done) continue;
      if (o.type === 'hold') {
        const kt = plane.speed * KT;
        const okSpeed = !o.speed || (kt >= o.speed[0] && kt <= o.speed[1]);
        const okAlt = !o.alt || (plane.position.y >= o.alt[0] && plane.position.y <= o.alt[1]);
        if (okSpeed && okAlt) o.t += dt;
        else o.t = 0;
        if (o.t >= o.seconds) {
          o.done = true;
          fx?.ok?.();
          say('✓ הושלם', GREEN, 1200);
        }
      } else if (o.type === 'nav') {
        const p = o.points[o.i];
        const d = Math.hypot(plane.position.x - p.x, plane.position.z - p.z);
        if (o.corridor) {
          const from = o.i === 0 ? o.route[0] : o.points[o.i - 1];
          o.off = distToSegment(plane.position.x, plane.position.z, from, p) > o.corridor;
        }
        o.rings.forEach((r, k) => {
          const near = d < (o.memory ? 700 : 1500) && k === o.i;
          r.visible = k === o.i && (!o.hideRings || near);
          r.userData.active = k === o.i;
        });
        if (d < 260) {
          fx?.ok?.();
          o.rings[o.i].visible = false;
          o.i++;
          say(o.i < o.points.length ? `✓ נקודה ${o.i} מתוך ${o.points.length}` : '✓ ניווט הושלם', GREEN, 1500);
          if (o.i >= o.points.length) o.done = true;
        }
      } else if (o.type === 'destroy') {
        const gain = o.points ? M.points >= o.points : M.destroyed >= (o.count ?? 1);
        if (gain) o.done = true;
      }
      if (!o.done) allDone = false;
    }
    // Radio calls.
    for (const r of M.radioList) {
      if (!r.started && M.t >= r.at) {
        r.started = true;
        r.left = r.kind === 'order' ? 11 : r.kind === 'call' ? 8 : 6.5;
        M.radioNow = r;
        const who = r.kind === 'other' ? r.fruit : M.callsign;
        const withOrder = r.kind === 'order' || (r.kind === 'other' && r.instruction && r.at % 2 === 0);
        radioSay(withOrder ? `${who}, ${r.instruction ?? 'שמור על הציר'}.` : `${who}.`);
      }
    }
    const rn = M.radioNow;
    if (rn && !rn.done) {
      rn.left -= dt;
      if (rn.left <= 0) {
        rn.done = true;
        M.radioNow = null;
        M.radioEnd = M.t;
        if (rn.kind === 'other') M.radioOk++; // you correctly did nothing
        else radioFail(rn.kind === 'call' ? 'לא אישרת את הקריאה' : 'לא אישרת את הקריאה וההוראה');
      }
    }
    if (allDone && M.objectives.length && M.radioList.every((r) => r.done || !r.started)) finishMission({ ok: true });
  }

  // ---------- Lock-on and missiles ----------
  function updateLock(dt) {
    const L = M.lock;
    const f = reticleDir(V(0, 0, 0));
    let best = null;
    let bestAng = rad(LOCK_ANGLE);
    for (const t of M.targets) {
      if (t.destroyed) continue;
      const to = V(t.x - plane.position.x, t.y - plane.position.y, t.z - plane.position.z);
      const d = to.length();
      if (d > 5200 || d < 150) continue;
      const ang = Math.acos(clamp(f.dot(to.clone().normalize()), -1, 1));
      if (ang < bestAng) {
        bestAng = ang;
        best = t;
      }
    }
    for (const dcy of M.decoys) {
      if (dcy.destroyed) continue;
      const to = V(dcy.x - plane.position.x, dcy.y - plane.position.y, dcy.z - plane.position.z);
      const d = to.length();
      if (d > 5200 || d < 150) continue;
      const ang = Math.acos(clamp(f.dot(to.clone().normalize()), -1, 1));
      if (ang < bestAng) {
        bestAng = ang;
        best = dcy;
      }
    }
    if (best && best === L.target) L.t += dt;
    else {
      L.target = best;
      L.t = 0;
    }
    if (best) L.chance = hitChance(Math.hypot(best.x - plane.position.x, best.y - plane.position.y, best.z - plane.position.z));
    if (best && L.t >= LOCK_T && !L.beeped) {
      L.beeped = true;
      fx?.lock?.(1);
      tone(1800, 0.12, { volume: 0.07 });
    }
    if (!best || L.t < LOCK_T) L.beeped = false;
  }

  function updateMissiles(dt) {
    for (const m of [...missileList]) {
      if (m.dead) {
        missileList.splice(missileList.indexOf(m), 1);
        continue;
      }
      m.life += dt;
      const tgt = m.homing;
      const goal = V(tgt.x, tgt.y, tgt.z);
      const want = goal.clone().sub(m.group.position);
      const dist = want.length();
      want.normalize();
      const cur = m.velocity.clone().normalize();
      const ang = Math.acos(clamp(cur.dot(want), -1, 1));
      if (ang > 1e-4) cur.lerp(want, Math.min(1, (1.6 * dt) / ang)).normalize();
      m.velocity.copy(cur).multiplyScalar(m.speed);
      m.group.position.addScaledVector(m.velocity, dt);
      m.group.lookAt(m.group.position.clone().add(m.velocity));
      if (Math.floor(m.life * 25) !== Math.floor((m.life - dt) * 25)) world.puff(m.group.position, { size: 22, life: 1.6, color: '#ffffff', opacity: 0.6 });
      if (dist < 55) {
        m.dead = true;
        scene.remove(m.group);
        world.puff(m.group.position, { size: 120, life: 1.4, color: '#ffb25a', opacity: 0.95 });
        world.puff(m.group.position.clone().add(V(0, 30, 0)), { size: 200, life: 2.6, color: '#444', opacity: 0.7 });
        fx?.explosion?.();
        shake = Math.max(shake, 0.25);
        if (!m.willHit) {
          M.misfires++;
          say(`הטיל החטיא (סיכוי ${Math.round(m.chance * 100)}%)`, '#ffb0b0', 2000);
          fx?.bad?.();
        } else if (M.decoys.includes(tgt)) {
          tgt.destroyed = true;
          tgt.mesh.visible = false;
          M.decoyHits++;
          say('פגעת במטרת דמה! הורדת ניקוד', '#ff8080', 2200);
          fx?.fail?.();
        } else {
          tgt.destroyed = true;
          tgt.mesh.visible = false;
          M.destroyed++;
          M.points += POINTS[tgt.kind];
          say(`✓ מטרה הושמדה (+${POINTS[tgt.kind]})`, GREEN, 1600);
          fx?.ok?.();
        }
      } else if (m.life > 14) {
        m.dead = true;
        scene.remove(m.group);
        M.misfires++;
      }
    }
  }

  // ---------- Finishing and scoring ----------
  function finishMission(res) {
    if (!M || M.finished) return;
    M.finished = res;
    if (ctxFinish) ctxFinish();
  }
  let ctxFinish = null;

  function scoreMission() {
    const objs = M.objectives;
    const done = objs.filter((o) => o.done).length;
    let frac = objs.length ? done / objs.length : 1;
    // Partial credit inside the objectives.
    if (done < objs.length) {
      const partial = objs
        .filter((o) => !o.done)
        .map((o) => (o.type === 'nav' ? o.i / o.points.length : o.type === 'hold' ? o.t / o.seconds : o.points ? Math.min(1, M.points / o.points) : Math.min(1, M.destroyed / (o.count ?? 1))));
      frac = (done + partial.reduce((a, b) => a + b, 0) * 0.7) / objs.length;
    }
    let score = frac * (M.finished?.ok ? 1 : 0.85);
    score -= M.hits * 0.1 + M.misfires * 0.04 + M.decoyHits * 0.2 + M.wastedDefense * 0.03 + M.radioMiss * 0.06 + Math.min(0.3, M.offTime * 0.012);
    if (M.finished && M.finished.ok === false && M.finished.reason === 'המטוס שלך הופל') score *= 0.6;
    return clamp(score, 0, 1);
  }

  // ---------- The frame ----------
  const tmpUp = V(0, 1, 0);
  function step(dt) {
    time += dt;
    const input = controls.poll(dt);
    if (paused || !M || M.finished) {
      plane.update(dt, { x: 0, y: 0 }, 0);
    } else {
      M.t += dt;
      const hd = controls.state.held;
      ret.x = clamp(ret.x + ((hd.retR ? 1 : 0) - (hd.retL ? 1 : 0)) * RET_RATE * dt, -RET_X, RET_X);
      ret.y = clamp(ret.y + ((hd.retU ? 1 : 0) - (hd.retD ? 1 : 0)) * RET_RATE * dt, -RET_Y, RET_Y);
      plane.update(dt, input.stick, input.throttleInput);
      const ground = world.height(plane.position.x, plane.position.z);
      if (plane.position.y - ground < 14) {
        world.puff(plane.position, { size: 130, life: 1.8, color: '#ffb25a', opacity: 0.9 });
        fx?.explosion?.();
        finishMission({ ok: false, reason: 'התרסקת אל האדמה' });
      }
      M.def.air = Math.max(0, M.def.air - dt);
      M.def.ground = Math.max(0, M.def.ground - dt);
      moveEnemies(dt);
      enemyFire(dt);
      alarms(dt);
      updateLock(dt);
      updateMissiles(dt);
      updateObjectives(dt);
      if (M.t >= M.limit && !M.finished) finishMission({ ok: false, reason: 'נגמר הזמן' });
    }
    plane.upVector(tmpUp);
    camera.position.copy(plane.position).addScaledVector(tmpUp, 1.1);
    camera.quaternion.copy(plane.quaternion);
    shake = Math.max(0, shake - dt * 1.5);
    if (shake > 0.001) camera.position.add(V((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake));
    world.update(dt, camera, time);
    for (const s of M ? M.targets : []) if (s.mesh && !s.destroyed) s.mesh.rotation.y += dt * 0.8;
    sound.set(plane.throttle, Math.min(1, plane.speed / 240));
    updateBar();
  }

  function updateBar() {
    const d = M?.defense ?? { air: 6, ground: 6 };
    q('.st-def.air b').textContent = String(d.air);
    q('.st-def.gnd b').textContent = String(d.ground);
    q('.st-fire b').textContent = String(M?.missiles ?? 0);
    q('.st-def.air').classList.toggle('on', (M?.def.air ?? 0) > 0);
    q('.st-def.gnd').classList.toggle('on', (M?.def.ground ?? 0) > 0);
    q('.st-def.air i').style.width = `${((M?.def.air ?? 0) / 15) * 100}%`;
    q('.st-def.gnd i').style.width = `${((M?.def.ground ?? 0) / 10) * 100}%`;
    q('.st-thr i').style.height = `${plane.throttle * 100}%`;
  }

  // ---------- HUD drawing ----------
  let w = 0;
  let h = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = stage.clientWidth;
    h = stage.clientHeight;
    renderer.setSize(w, h, false);
    hudCanvas.width = Math.round(w * dpr);
    hudCanvas.height = Math.round(h * dpr);
    hud.setTransform(dpr, 0, 0, dpr, 0, 0);
    camera.aspect = w / h;
    camera.fov = w / h < 1.2 ? 84 : 70;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();

  const proj = V(0, 0, 0);
  function toScreen(p) {
    proj.copy(p).project(camera);
    return { x: ((proj.x + 1) / 2) * w, y: ((1 - proj.y) / 2) * h, behind: proj.z > 1 };
  }

  function glow(color, blur = 6) {
    hud.strokeStyle = color;
    hud.fillStyle = color;
    hud.shadowColor = color;
    hud.shadowBlur = blur;
  }

  function headingTape() {
    const cx = w / 2;
    const width = Math.min(460, w * 0.6);
    const heading = plane.heading;
    hud.save();
    hud.fillStyle = 'rgba(14,34,84,0.92)';
    hud.beginPath();
    hud.roundRect(cx - width / 2, 10, width, 38, 4);
    hud.fill();
    hud.clip();
    hud.fillStyle = '#fff';
    hud.strokeStyle = '#fff';
    hud.font = '700 15px ui-monospace, Menlo, monospace';
    hud.textAlign = 'center';
    hud.lineWidth = 1.5;
    const per = width / 80; // 80 degrees across
    for (let d = -45; d <= 45; d += 5) {
      const deg = Math.round(heading / 5) * 5 + d;
      const x = cx + (deg - heading) * per;
      const n = ((deg % 360) + 360) % 360;
      hud.beginPath();
      hud.moveTo(x, 36);
      hud.lineTo(x, n % 10 === 0 ? 28 : 32);
      hud.stroke();
      if (n % 10 === 0) hud.fillText(String(n === 0 ? 0 : n), x, 25);
    }
    hud.restore();
    hud.strokeStyle = '#fff';
    hud.lineWidth = 2;
    hud.beginPath();
    hud.moveTo(cx, 10);
    hud.lineTo(cx, 40);
    hud.stroke();
  }

  function centerGlyphs() {
    const cx = w / 2;
    const cy = h * 0.46;
    // Two vertical bars and a few slanted pitch lines, like the cockpit overlay candidates describe.
    hud.save();
    glow(GREEN, 4);
    hud.lineWidth = 2;
    const half = Math.min(80, w * 0.09);
    const up = Math.min(h * 0.28, 170);
    hud.beginPath();
    hud.moveTo(cx - half, cy - up);
    hud.lineTo(cx - half, cy + up * 0.6);
    hud.moveTo(cx + half, cy - up);
    hud.lineTo(cx + half, cy + up * 0.6);
    hud.stroke();
    // Pitch lines inside the bars, moving with pitch.
    const pitch = plane.pitch;
    for (let a = -30; a <= 30; a += 10) {
      const y = cy - (a - pitch) * (up / 28);
      if (Math.abs(y - cy) > up * 0.95) continue;
      hud.beginPath();
      hud.moveTo(cx - half + 8, y);
      hud.lineTo(cx - 14, y);
      hud.moveTo(cx + 14, y);
      hud.lineTo(cx + half - 8, y);
      hud.stroke();
    }
    // The flight marker.
    hud.beginPath();
    hud.moveTo(cx, cy - 10);
    hud.lineTo(cx - 9, cy + 8);
    hud.lineTo(cx + 9, cy + 8);
    hud.closePath();
    hud.fill();
    // Speed (left) and altitude (right).
    hud.font = '800 22px ui-monospace, Menlo, monospace';
    hud.textAlign = 'right';
    hud.fillText(String(Math.round(plane.speed * KT)), cx - half - 14, cy - 16);
    hud.textAlign = 'left';
    hud.fillText(String(Math.round(plane.position.y)), cx + half + 14, cy - 16);
    hud.font = '600 11px Heebo, sans-serif';
    hud.textAlign = 'right';
    hud.fillText('מהירות', cx - half - 14, cy + 2);
    hud.textAlign = 'left';
    hud.fillText('גובה', cx + half + 14, cy + 2);
    hud.restore();
    reticle();
  }

  /** The sight: moved with Q/E/R/F; yellow and solid when locked, with the hit chance. */
  const sightPos = V(0, 0, 0);
  function reticle() {
    reticleDir(sightPos).multiplyScalar(1500).add(camera.position);
    const p = toScreen(sightPos);
    if (p.behind) return;
    const L = M?.lock;
    const locked = Boolean(L?.target && L.t >= LOCK_T);
    const color = locked ? '#ffe45c' : L?.target ? '#ffffff' : 'rgba(255,255,255,0.85)';
    hud.save();
    hud.lineWidth = 2.5;
    hud.strokeStyle = color;
    hud.fillStyle = color;
    hud.shadowColor = '#000';
    hud.shadowBlur = 4;
    hud.beginPath();
    hud.arc(p.x, p.y, 24, 0, Math.PI * 2);
    hud.stroke();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      hud.beginPath();
      hud.moveTo(p.x + dx * 24, p.y + dy * 24);
      hud.lineTo(p.x + dx * 36, p.y + dy * 36);
      hud.stroke();
    }
    hud.beginPath();
    hud.arc(p.x, p.y, 2, 0, Math.PI * 2);
    hud.fill();
    if (L?.target && !locked) {
      hud.strokeStyle = '#ffe45c';
      hud.lineWidth = 4;
      hud.beginPath();
      hud.arc(p.x, p.y, 31, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, L.t / LOCK_T));
      hud.stroke();
    }
    if (L?.target) {
      hud.font = '800 15px ui-monospace, Menlo, monospace';
      hud.textAlign = 'center';
      hud.fillStyle = locked ? '#ffe45c' : '#ffffff';
      hud.fillText(`${locked ? 'נעול · ' : ''}פגיעה ${Math.round((L.chance ?? 0) * 100)}%`, p.x, p.y + 56);
    }
    hud.restore();
  }

  function marker(pos, kind, label, extra = {}) {
    const p = toScreen(pos);
    if (p.behind || p.x < 20 || p.x > w - 20 || p.y < 70 || p.y > h - 70) return;
    hud.save();
    const color = extra.color ?? TARGET_COLOR[kind] ?? RED;
    hud.fillStyle = color;
    hud.strokeStyle = color;
    hud.shadowColor = color;
    hud.shadowBlur = 8;
    hud.lineWidth = 2;
    hud.beginPath();
    if (kind === 'cone') {
      hud.moveTo(p.x, p.y - 9);
      hud.lineTo(p.x - 8, p.y + 7);
      hud.lineTo(p.x + 8, p.y + 7);
      hud.closePath();
      hud.fill();
    } else if (kind === 'square') hud.fillRect(p.x - 7, p.y - 7, 14, 14);
    else if (kind === 'circle') {
      hud.arc(p.x, p.y, 7, 0, Math.PI * 2);
      hud.fill();
    } else if (kind === 'decoy') {
      hud.arc(p.x, p.y, 6, 0, Math.PI * 2);
      hud.stroke();
    } else {
      hud.strokeRect(p.x - 10, p.y - 10, 20, 20);
    }
    if (label) {
      hud.font = '800 15px ui-monospace, Menlo, monospace';
      hud.textAlign = 'right';
      hud.fillStyle = '#7dff9a';
      hud.fillText(label, p.x - 14, p.y + 5);
    }
    if (extra.lock) {
      const L = M.lock;
      hud.strokeStyle = L.t >= LOCK_T ? '#ffe45c' : '#fff';
      hud.beginPath();
      hud.arc(p.x, p.y, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, L.t / LOCK_T));
      hud.stroke();
    }
    hud.restore();
  }

  function minimap() {
    const size = Math.min(210, w * 0.32, h * 0.3);
    const cx = w - size / 2 - 12;
    const cy = h - size / 2 - 70;
    const R = size / 2;
    hud.save();
    hud.fillStyle = 'rgba(222,214,196,0.9)';
    hud.fillRect(cx - R, cy - R, size, size);
    hud.strokeStyle = 'rgba(40,40,40,0.55)';
    hud.lineWidth = 1.5;
    for (const k of [1, 2, 3]) {
      hud.beginPath();
      hud.arc(cx, cy, (R * k) / 3.2, 0, Math.PI * 2);
      hud.stroke();
    }
    hud.beginPath();
    hud.rect(cx - R, cy - R, size, size);
    hud.clip();
    const scale = R / 3200; // meters to pixels
    const hdg = rad(plane.heading);
    const rel = (x, z) => {
      const dx = x - plane.position.x;
      const dz = z - plane.position.z;
      const fwd = dx * Math.sin(hdg) + dz * -Math.cos(hdg);
      const right = dx * Math.cos(hdg) + dz * Math.sin(hdg);
      return { x: cx + right * scale, y: cy - fwd * scale };
    };
    const tri = (x, y, angle, len, wid, color) => {
      hud.save();
      hud.translate(x, y);
      hud.rotate(angle);
      hud.fillStyle = color;
      hud.beginPath();
      hud.moveTo(0, -len);
      hud.lineTo(-wid, len * 0.7);
      hud.lineTo(wid, len * 0.7);
      hud.closePath();
      hud.fill();
      hud.restore();
    };
    if (M) {
      for (const t of M.targets) {
        if (t.destroyed) continue;
        const p = rel(t.x, t.z);
        if (t.kind === 'cone') tri(p.x, p.y, 0, 7, 6, CYAN);
        else if (t.kind === 'square') {
          hud.fillStyle = ORANGE;
          hud.fillRect(p.x - 5, p.y - 5, 10, 10);
        } else {
          hud.fillStyle = LIME;
          hud.beginPath();
          hud.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
          hud.fill();
        }
      }
      for (const d of M.decoys) {
        if (d.destroyed) continue;
        const p = rel(d.x, d.z);
        hud.strokeStyle = '#555';
        hud.beginPath();
        hud.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
        hud.stroke();
      }
      for (const s of M.sites) {
        if (!s.alive) continue;
        const p = rel(s.x, s.z);
        hud.fillStyle = RED;
        hud.fillRect(p.x - 5, p.y - 5, 10, 10);
      }
      for (const v of M.vehicles) {
        if (!v.alive) continue;
        const p = rel(v.x, v.z);
        tri(p.x, p.y, v.heading - hdg, 6, 4.5, RED);
      }
      for (const a of M.planes) {
        const p = rel(a.x, a.z);
        tri(p.x, p.y, a.heading - hdg, 11, 3.6, RED);
      }
      for (const o of M.objectives) {
        if (o.type === 'nav' && !o.done && !o.memory) {
          const p = o.points[o.i];
          const pt = rel(p.x, p.z);
          hud.strokeStyle = '#1c7a38';
          hud.lineWidth = 2;
          hud.beginPath();
          hud.moveTo(cx, cy);
          hud.lineTo(pt.x, pt.y);
          for (let k = o.i + 1; k < o.points.length; k++) {
            const q = rel(o.points[k].x, o.points[k].z);
            hud.lineTo(q.x, q.y);
          }
          hud.stroke();
          hud.beginPath();
          hud.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
          hud.stroke();
        }
      }
    }
    // Us, in the middle, pointing up.
    tri(cx, cy, 0, 9, 6.5, '#6a6a6a');
    hud.restore();
    hud.save();
    hud.strokeStyle = 'rgba(30,30,30,0.7)';
    hud.lineWidth = 2;
    hud.strokeRect(cx - R, cy - R, size, size);
    hud.restore();
  }

  function drawHud() {
    hud.clearRect(0, 0, w, h);
    headingTape();
    centerGlyphs();
    minimap();
    if (M) {
      const pp = plane.position;
      for (const t of M.targets) {
        if (t.destroyed) continue;
        const d = Math.hypot(t.x - pp.x, t.z - pp.z);
        if (d > 9000) continue;
        marker(V(t.x, t.y + 30, t.z), t.kind, d < 7000 ? String(Math.round(d)) : '', { lock: M.lock.target === t });
      }
      for (const dcy of M.decoys) {
        if (dcy.destroyed) continue;
        const d = Math.hypot(dcy.x - pp.x, dcy.z - pp.z);
        if (d > 5200) continue;
        marker(V(dcy.x, dcy.y + 30, dcy.z), 'decoy', '', { color: '#ccc', lock: M.lock.target === dcy });
      }
      for (const s of [...M.sites, ...M.vehicles]) {
        if (!s.alive) continue;
        if (Math.hypot(s.x - pp.x, s.z - pp.z) < 3200) marker(V(s.x, s.y + 40, s.z), 'enemy', '', { color: RED });
      }
      for (const a of M.planes) marker(V(a.x, a.y, a.z), 'enemy', '', { color: RED });
      // Timer and objective line.
      const left = Math.max(0, Math.ceil(M.limit - M.t));
      hud.save();
      hud.font = '800 20px ui-monospace, Menlo, monospace';
      hud.textAlign = 'left';
      hud.fillStyle = left <= 10 ? '#ff9a9a' : '#fff';
      hud.shadowColor = '#000';
      hud.shadowBlur = 5;
      hud.fillText(`${left}`, 16, h - 88);
      if (M.radioList.length) {
        hud.font = '800 14px Heebo, sans-serif';
        hud.fillStyle = '#ffe45c';
        hud.fillText(`סימן הקריאה שלך: ${M.callsign}`, 16, h - 112);
      }
      hud.textAlign = 'center';
      hud.font = '700 15px Heebo, sans-serif';
      hud.fillStyle = '#e8ffe0';
      const line = objectiveLine();
      if (line) hud.fillText(line, w / 2, 70);
      hud.restore();
      // Health pips.
      for (let i = 0; i < 3; i++) {
        hud.fillStyle = i < M.health ? '#7dff9a' : 'rgba(255,255,255,0.25)';
        hud.fillRect(w - 20 - i * 18, 18, 12, 12);
      }
    }
    if (message && message.until > time) {
      hud.save();
      hud.font = '800 20px Heebo, sans-serif';
      hud.textAlign = 'center';
      hud.fillStyle = message.color;
      hud.shadowColor = '#000';
      hud.shadowBlur = 8;
      hud.fillText(message.text, w / 2, h * 0.3);
      hud.restore();
    }
    // Off the navigation axis.
    if (M?.offNow && Math.floor(time * 5) % 2 === 0) {
      hud.save();
      hud.font = '800 26px Heebo, sans-serif';
      hud.textAlign = 'center';
      hud.fillStyle = '#ff3b3b';
      hud.shadowColor = '#000';
      hud.shadowBlur = 8;
      hud.fillText('סטייה מהציר! חזור לציר הניווט', w / 2, 134);
      hud.restore();
    }
    // Alarm banner.
    if (M?.alarm && Math.floor(time * 4) % 2 === 0) {
      hud.save();
      hud.font = '800 17px Heebo, sans-serif';
      hud.textAlign = 'center';
      hud.fillStyle = M.alarm === 'danger' ? '#ff6b6b' : '#ffc857';
      hud.shadowColor = '#000';
      hud.shadowBlur = 6;
      hud.fillText(M.alarm === 'danger' ? 'סכנה: איום בטווח ירי' : 'אויב בטווח שלושה קילומטר', w / 2, 100);
      hud.restore();
    }
  }

  function objectiveLine() {
    for (const o of M.objectives) {
      if (o.done) continue;
      if (o.type === 'hold') {
        const parts = [];
        if (o.speed) parts.push(`מהירות ${o.speed[0]}–${o.speed[1]}`);
        if (o.alt) parts.push(`גובה ${Math.round(o.alt[0])}–${Math.round(o.alt[1])}`);
        return `${parts.join(' · ')} · ${o.t.toFixed(0)}/${o.seconds} שנ׳`;
      }
      if (o.type === 'nav') return `נקודה ${o.i + 1} מתוך ${o.points.length}`;
      if (o.type === 'destroy') return o.points ? `ניקוד ${M.points}/${o.points}` : `מטרות ${M.destroyed}/${o.count ?? 1}`;
    }
    return '';
  }

  let last = performance.now();
  let raf = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    step(dt);
    renderer.render(scene, camera);
    drawHud();
  }
  raf = requestAnimationFrame(loop);
  helpers.onClose(() => {
    cancelAnimationFrame(raf);
    sound.stop();
    controls.dispose();
    observer.disconnect();
  });

  const results = [];
  if (import.meta.env.DEV) {
    root.__strike = {
      advance(seconds) {
        for (let i = 0; i < seconds * 30; i++) step(1 / 30);
        renderer.render(scene, camera);
        drawHud();
      },
      get M() {
        return M;
      },
      plane,
      world,
      controls,
      results,
      region,
      act,
      get missions() {
        return missions;
      },
    };
  }

  // ---------- Cards and the order of the missions ----------
  function showCard(buildFn) {
    cards.innerHTML = '';
    const card = el('div', 'st-card');
    cards.append(card);
    cards.classList.add('on');
    return new Promise((resolve) =>
      buildFn(card, (v) => {
        cards.classList.remove('on');
        cards.innerHTML = '';
        resolve(v);
      }),
    );
  }

  let missions = [];

  async function chooseLength() {
    return showCard((card, done) => {
      card.append(el('p', 'pp-eyebrow', 'סימולטור שני'), el('h2', 'pp-title', 'הסימולטור של ירפ״א ב׳'));
      const list = el('ul', 'pp-list');
      for (const line of [
        'לפי אתרי הכנה: 20 שלבי הדרכה, שבכל אחד לומדים משהו שמשלבים בהמשך, ואחריהם 30 מבחנים שהקושי בהם עולה. המטרה היא לעייף, אבל חייבים להמשיך.',
        'לפי מועמד שעבר: מיני־מפה עם שלושה עיגולים (קילומטר, שניים, שלושה), אויבים ומטרות בצבעים וצורות שונים, ביפים בטווחים, הגנה אווירית והגנה קרקעית, וכמה עשרות טילים. המשחק שחזר את התיאור הזה, והמספרים שלו הם שלנו.',
        'במציאות הכול נמשך כשלוש שעות. הגרסה המלאה כאן נמשכת כארבעים דקות, והמקוצרת כעשר.',
      ]) list.append(el('li', '', line));
      card.append(list);
      const row = el('div', 'pp-actions');
      const full = button('הגרסה המלאה (20 הדרכה ו־30 מבחנים)');
      const shortB = button('מקוצרת (7 הדרכה ו־8 מבחנים)', 'pp-btn secondary');
      full.addEventListener('click', () => (fx?.click?.(), done(false)));
      shortB.addEventListener('click', () => (fx?.click?.(), done(true)));
      row.append(shortB, full);
      card.append(row);
      full.focus();
    });
  }

  function briefCard(spec, index, attempt, total) {
    return showCard((card, done) => {
      const phase = spec.phase === 'training' ? 'הדרכה' : 'מבחן';
      card.append(el('p', 'pp-eyebrow', `${phase} · ${index + 1} מתוך ${total}${attempt > 1 ? ` · ניסיון ${attempt}` : ''}`), el('h2', 'pp-title', spec.title));
      if (spec.teaches) card.append(el('p', 'pp-sub', `נלמד: ${spec.teaches}`));
      const list = el('ul', 'pp-list');
      for (const line of spec.brief) list.append(el('li', '', line));
      card.append(list);
      if (M.radioList.length) card.append(el('p', 'pp-sub', `סימן הקריאה שלך בקשר: ${M.callsign}`));
      const keys = el('div', 'pp-keys');
      for (const k of [
        controls.state.scheme === 'keys' && !controls.state.touch
          ? { keys: ['↑', '↓', '←', '→'], text: 'סטיק: עלייה וירידה, גלגול' }
          : { keys: ['עכבר'], text: 'סטיק: עלייה וירידה, גלגול' },
        { keys: ['W', 'S'], text: 'מצערת: יותר או פחות מהירות' },
        { keys: ['Space'], text: 'שיגור טיל (אחרי נעילה)' },
        { keys: ['1', '2'], text: 'הגנה אווירית, הגנה קרקעית' },
        { keys: ['Q', 'E', 'R', 'F'], text: 'כוונת: שמאלה, ימינה, למעלה, למטה (לא זזה עם המטוס)' },
        { keys: ['Z', 'X'], text: 'קשר: קיבלתי קריאה, שמעתי הוראה' },
      ]) {
        const row = el('div', 'pp-key-item');
        const caps = el('span', 'pp-caps');
        for (const cap of k.keys) caps.append(el('kbd', 'pp-kbd', cap));
        row.append(caps, el('span', '', k.text));
        keys.append(row);
      }
      card.append(keys);
      const go = button('מתחילים');
      const row = el('div', 'pp-actions');
      row.append(go);
      card.append(row);
      go.focus();
      go.addEventListener('click', () => (fx?.click?.(), done()));
    });
  }

  function resultCard(spec, res, score, canRetry) {
    return showCard((card, done) => {
      card.append(el('p', 'pp-eyebrow', res.ok ? 'הצלחה' : 'לא הושלם'), el('h2', 'pp-title', res.ok ? 'סיימת את המשימה' : res.reason));
      const bits = [];
      if (M.points) bits.push(`ניקוד מטרות: ${M.points}`);
      if (M.hits) bits.push(`פגיעות בך: ${M.hits}`);
      if (M.decoyHits) bits.push(`פגיעות במטרות דמה: ${M.decoyHits}`);
      if (M.wastedDefense) bits.push(`הגנות שהופעלו בלי צורך: ${M.wastedDefense}`);
      if (M.radioMiss) bits.push(`טעויות בקשר: ${M.radioMiss}`);
      if (M.offTime > 1) bits.push(`זמן מחוץ לציר: ${Math.round(M.offTime)} שנ׳`);
      if (M.misfires) bits.push(`טילים שהחטיאו: ${M.misfires}`);
      if (bits.length) card.append(el('p', 'pp-sub', bits.join(' · ')));
      card.append(el('p', 'pp-sub', `ציון למשימה: ${Math.round(score * 100)}%`));
      const row = el('div', 'pp-actions');
      if (!res.ok && canRetry) {
        const again = button('לנסות שוב');
        again.addEventListener('click', () => (fx?.click?.(), done('retry')));
        row.append(again);
      }
      const next = button('המשך', !res.ok && canRetry ? 'pp-btn secondary' : 'pp-btn');
      next.addEventListener('click', () => (fx?.click?.(), done('next')));
      row.append(next);
      card.append(row);
      row.firstChild.focus();
    });
  }

  (async () => {
    await chooseScheme(showCard, controls, fx);
    const chosenShort = import.meta.env.DEV && window.__strikeShort !== undefined ? window.__strikeShort : await chooseLength();
    short = chosenShort;
    missions = buildMissions({ short });
    const levels = [];
    for (let i = import.meta.env.DEV ? (window.__strikeFrom ?? 0) : 0; i < missions.length; i++) {
      const spec = missions[i];
      titleEl.textContent = spec.title;
      dots.innerHTML = '';
      const dot = el('span', 'st-phase', spec.phase === 'training' ? `הדרכה ${i + 1 - (missions.filter((m, k) => k < i && m.phase === 'test').length)}` : 'מבחן');
      dots.append(dot);
      let attempt = 0;
      let score = 0;
      let res = null;
      for (;;) {
        attempt++;
        paused = true;
        clearMission();
        M = newMission(spec);
        plane.position.set(M.region.start.x, M.region.baseAlt, M.region.start.z);
        ret.x = 0;
        ret.y = 0;
        plane.quaternion.setFromAxisAngle(V(0, 1, 0), -rad(M.region.heading));
        plane.speed = 140;
        plane.throttle = 0.45;
        plane.assist = spec.phase === 'training' ? 0.7 : 0.4;
        plane.rollRate = plane.pitchRate = 0;
        build(M);
        for (let k = 0; k < 15; k++) step(1 / 30);
        await briefCard(spec, i, attempt, missions.length);
        // The map for a few seconds, like the real thing (up to 15 s), in the harder tests.
        const mapObj = M.objectives.find((o) => o.type === 'nav' && o.map);
        if (mapObj) await mapPreview(mapObj.map);
        paused = false;
        await new Promise((resolve) => {
          ctxFinish = resolve;
        });
        paused = true;
        res = M.finished;
        score = scoreMission();
        if (res.ok) fx?.done?.();
        else fx?.fail?.();
        const canRetry = spec.phase === 'training' && attempt < 2;
        const choice = await resultCard(spec, res, score, canRetry);
        if (res.ok || choice !== 'retry') break;
      }
      levels.push({ id: spec.id, title: spec.title, phase: spec.phase, score, points: M.points, attempts: attempt });
      results.push(levels[levels.length - 1]);
      await new Promise((r) => setTimeout(r, 300));
    }
    const tests = levels.filter((l) => l.phase === 'test');
    const mean = (list) => (list.length ? list.reduce((a, l) => a + l.score, 0) / list.length : 0);
    const total = 0.25 * mean(levels.filter((l) => l.phase === 'training')) + 0.75 * mean(tests);
    const out = { passed: total >= 0.45, score: total, levels, points: levels.reduce((a, l) => a + l.points, 0) };
    await showCard((card, done) => {
      card.append(el('p', 'pp-eyebrow', 'סיום הסימולטור'), el('h2', 'pp-title', 'סיימת את הסימולטור'));
      card.append(el('p', 'pp-sub', `ציון משוקלל: ${Math.round(total * 100)}% · ניקוד מטרות כולל: ${out.points}`));
      const go = button('המשך');
      const row = el('div', 'pp-actions');
      row.append(go);
      card.append(row);
      go.focus();
      go.addEventListener('click', () => (fx?.click?.(), done()));
    });
    close(out);
  })();

  /**
   * The map: 'learn' = with a legend and no time limit (training); 'memory' = up to 15 seconds, then it is gone and
   * you fly the route you memorized.
   */
  function mapPreview(mode) {
    return showCard((card, done) => {
      const nav = M.objectives.find((o) => o.type === 'nav');
      const learn = mode === 'learn';
      card.append(el('p', 'pp-eyebrow', learn ? 'לימוד ניווט' : 'ניווט מהזיכרון'), el('h2', 'pp-title', learn ? 'המפה, הסמלים וציר הניווט' : 'שנן את הציר'));
      card.append(
        el(
          'p',
          'pp-sub',
          learn
            ? 'הקו הירוק הוא ציר הניווט, והמספרים הם סדר הנקודות. כל סמל שבמפה נראה גם בנוף, ולכן הם עוזרים לזהות איפה אתה. ככה זה נראה: מפה סכמטית שלנו, כי הסמלים האמיתיים לא פורסמו.'
            : 'לפי אתרי הכנה, המפה מוצגת עד 15 שניות ואז נעלמת. מנווטים מהזיכרון, וסטייה מהציר מפעילה צליל חזק.',
        ),
      );
      const wrap = el('div', 'st-mapwrap');
      const c = document.createElement('canvas');
      c.className = 'st-map';
      wrap.append(c);
      const toMap = drawNavMap(c, { route: nav.route, features: M.features ?? [] });
      const g = c.getContext('2d');
      g.save();
      for (const t of M.targets) {
        const q = toMap(t);
        g.fillStyle = TARGET_COLOR[t.kind];
        g.strokeStyle = '#222';
        g.lineWidth = 1.5;
        if (t.kind === 'square') {
          g.fillRect(q.x - 6, q.y - 6, 12, 12);
          g.strokeRect(q.x - 6, q.y - 6, 12, 12);
        } else {
          g.beginPath();
          if (t.kind === 'cone') {
            g.moveTo(q.x, q.y - 8);
            g.lineTo(q.x - 7, q.y + 6);
            g.lineTo(q.x + 7, q.y + 6);
            g.closePath();
          } else g.arc(q.x, q.y, 6, 0, Math.PI * 2);
          g.fill();
          g.stroke();
        }
      }
      for (const e of [...M.sites, ...M.vehicles]) {
        const q = toMap(e);
        g.fillStyle = RED;
        g.fillRect(q.x - 5, q.y - 5, 10, 10);
      }
      for (const a of M.planes) {
        const q = toMap(a);
        g.fillStyle = RED;
        g.beginPath();
        g.moveTo(q.x, q.y - 9);
        g.lineTo(q.x - 4, q.y + 7);
        g.lineTo(q.x + 4, q.y + 7);
        g.fill();
      }
      g.restore();
      card.append(wrap);
      if (learn) {
        const legend = el('div', 'st-legend');
        for (const item of LEGEND) {
          const row = el('div', 'st-legend-row');
          row.append(legendIcon(item.id), el('span', '', `${item.label} · ${item.note}`));
          legend.append(row);
        }
        card.append(legend);
      }
      const left = el('p', 'pp-note', '');
      const bar = el('div', 'st-count');
      const fill = el('i');
      bar.append(fill);
      if (!learn) card.append(bar, left);
      const go = button(learn ? 'הבנתי, ממשיכים' : 'זכרתי');
      const row = el('div', 'pp-actions');
      row.append(go);
      card.append(row);
      go.focus();
      let timer = 0;
      if (!learn) {
        let n = 15;
        const tick = () => {
          left.textContent = `המפה תיעלם בעוד ${n} שניות`;
          fill.style.width = `${(n / 15) * 100}%`;
        };
        tick();
        timer = setInterval(() => {
          n--;
          tick();
          if (n <= 0) go.click();
        }, 1000);
      }
      go.addEventListener('click', () => {
        clearInterval(timer);
        fx?.click?.();
        done();
      });
    });
  }
}

function injectStyle() {
  if (document.getElementById('st-style')) return;
  const style = document.createElement('style');
  style.id = 'st-style';
  style.textContent = `
    .st-screen { padding: 0; background: #05080f; }
    .st-stage { position: relative; width: 100%; height: 100%; overflow: hidden; touch-action: none; user-select: none; }
    .st-3d, .st-hud { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .st-hud { pointer-events: none; }
    .st-flash { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle, transparent 40%, rgba(255,40,40,.55)); opacity: 0; }
    .st-flash.on { animation: st-flash .6s ease-out; }
    @keyframes st-flash { 0% { opacity: 1; } 100% { opacity: 0; } }
    .st-top { position: absolute; top: 10px; left: 14px; display: flex; align-items: center; gap: 12px; color: #e8ffe0; font: 700 .85rem 'Heebo', sans-serif; text-shadow: 0 1px 4px #000; pointer-events: none; }
    .st-phase { padding: 2px 10px; border-radius: 999px; background: rgba(0,0,0,.45); }
    .st-subtitle { position: absolute; left: 50%; bottom: 150px; max-width: min(720px, 86%); transform: translate(-50%, 10px); padding: 8px 18px; border-radius: 10px; background: rgba(5,18,12,.84); color: #d6ffe6; font: 700 1.05rem 'Heebo', sans-serif; text-align: center; opacity: 0; transition: opacity .25s, transform .25s; pointer-events: none; box-shadow: inset 0 0 0 1px rgba(125,255,176,.4); }
    .st-subtitle.on { opacity: 1; transform: translate(-50%, 0); }
    .st-bar { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: stretch; gap: 10px; padding: 8px 12px 8px 66px; background: #cfcfcf; color: #b3262a; font: 700 .95rem 'Heebo', sans-serif; box-shadow: 0 -4px 18px rgba(0,0,0,.4); z-index: 6; }
    .st-bar button { position: relative; display: flex; align-items: center; gap: 8px; min-height: 48px; padding: 4px 12px; border: 0; border-radius: 6px; background: transparent; color: #b3262a; font: inherit; cursor: pointer; overflow: hidden; }
    .st-bar button:hover { background: rgba(255,255,255,.55); }
    .st-bar button b { min-width: 46px; padding: 3px 8px; border-radius: 4px; background: #fff; color: #222; font: 800 1.15rem ui-monospace, Menlo, monospace; text-align: center; box-shadow: inset 0 0 0 1px #888; }
    .st-bar button kbd { font: 700 .65rem ui-monospace, Menlo, monospace; padding: 1px 6px; border-radius: 4px; background: rgba(0,0,0,.12); color: #333; }
    .st-bar .st-def i { position: absolute; left: 0; bottom: 0; height: 4px; width: 0; background: #1f7ae0; transition: width .2s linear; }
    .st-bar .st-def.on { background: rgba(78,161,255,.4); }
    .st-bar .st-fire { margin-inline-start: auto; background: #b3262a; color: #fff; }
    .st-bar .st-fire b { color: #b3262a; }
    .st-bar .st-fire kbd { background: rgba(255,255,255,.25); color: #fff; }
    .st-thr { display: flex; align-items: center; gap: 8px; }
    .st-thr div { position: relative; width: 18px; height: 40px; background: #fff; border-radius: 3px; box-shadow: inset 0 0 0 1px #888; overflow: hidden; }
    .st-thr i { position: absolute; left: 0; right: 0; bottom: 0; background: #e27c1c; }
    .st-overlay { position: absolute; inset: 0; display: none; }
    .st-cards { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; padding: 16px; background: rgba(4,8,16,.7); backdrop-filter: blur(3px); z-index: 9; }
    .st-cards.on { display: flex; }
    .st-card { width: min(700px, 100%); max-height: 100%; overflow: auto; padding: 22px 26px; border-radius: 18px; background: rgba(14,24,44,.96); color: var(--pp-text); box-shadow: inset 0 0 0 1px var(--pp-line), 0 30px 80px rgba(0,0,0,.6); }
    .st-map { display: block; width: min(100%, 460px); max-height: 52vh; aspect-ratio: 1 / 1; margin: 10px auto; border-radius: 10px; box-shadow: 0 0 0 3px #0a1120; }
    .st-legend { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 4px 14px; margin: 8px 0; font: 600 .85rem 'Heebo', sans-serif; }
    .st-legend-row { display: flex; align-items: center; gap: 10px; }
    .st-count { height: 6px; border-radius: 3px; background: rgba(255,255,255,.15); overflow: hidden; }
    .st-count i { display: block; height: 100%; background: #ffe45c; transition: width 1s linear; }
    .st-radio { display: flex; gap: 6px; }
    .st-bar .st-rb { background: rgba(255,255,255,.65); box-shadow: inset 0 0 0 1px #888; }
    .st-bar .st-rb:active { background: #ffe45c; }
    .st-ret { display: grid; grid-template-columns: repeat(3, 34px); grid-template-rows: repeat(2, 26px); gap: 3px; align-self: center; direction: ltr; }
    .st-ret button { min-height: 0; padding: 0; justify-content: center; gap: 2px; background: rgba(255,255,255,.65); box-shadow: inset 0 0 0 1px #888; font-size: .7rem; }
    .st-ret button kbd { font-size: .55rem; padding: 0 3px; }
    .st-ret [data-ret=retU] { grid-column: 2; grid-row: 1; }
    .st-ret [data-ret=retL] { grid-column: 1; grid-row: 2; }
    .st-ret [data-ret=retD] { grid-column: 2; grid-row: 2; }
    .st-ret [data-ret=retR] { grid-column: 3; grid-row: 2; }
    .st-ret button:active { background: #ffe45c; }
    .st-stage .fl-pad, .st-stage .fl-throttle { bottom: 70px; }
    @media (max-width: 720px) { .st-bar { flex-wrap: wrap; } .st-bar button { min-height: 44px; } }
  `;
  document.head.append(style);
}
