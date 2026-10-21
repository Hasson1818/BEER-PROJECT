import '../../shared/engine/game.css';
import '../../shared/engine/field.css';
import './style.css';
import * as THREE from 'three';
import { buildWorld, SPOTS } from './world.js';
import { createSky } from '../../shared/engine/sky.js';
import { createPeople, pace } from './team.js';
import { runFlow, STEPS } from './flow.js';
import { readPoster } from './minigames.js';
import { UNIT_BY_ID } from './content.js';
import { Crowd } from '../../shared/engine/people.js';
import { enableCloseUps } from '../../shared/engine/detail.js';
import { Player } from '../../shared/engine/player.js';
import { Interactions } from '../../shared/engine/interactions.js';
import { createUI } from '../../shared/engine/ui.js';
import { loadSave, writeSave, clearSave } from '../../shared/save.js';

async function loadFonts() {
  const fonts = ['400 32px Heebo', '500 32px Heebo', '700 32px Heebo', '800 32px Heebo', '32px "Secular One"'];
  try {
    await Promise.race([Promise.all(fonts.map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 3500))]);
  } catch {
    // Fall back to system fonts.
  }
}

const $ = (id) => document.getElementById(id);

async function start() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('new')) clearSave();
  const save = params.has('new') ? null : loadSave();
  const resuming = save?.stage === 'interview-week';
  const devStep = import.meta.env.DEV ? params.get('step') : null;
  if (window.location.search) window.history.replaceState(null, '', window.location.pathname);

  await loadFonts();

  // ---------- Renderer & scene ----------

  const canvas = $('game');
  const touchDevice = window.matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, touchDevice ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 700);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const horizontal = THREE.MathUtils.degToRad(75);
    camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(horizontal / 2) / camera.aspect)), 70, 95);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const world = buildWorld(scene);
  const sky = createSky(scene, world.floodlights);
  sky.setTime('day');
  scene.fog.far = 220;
  const crowd = new Crowd(scene);
  enableCloseUps(crowd);
  const player = new Player(camera, canvas, world, crowd);
  const interactions = new Interactions(camera, world);
  const people = createPeople(crowd, world);
  pace(people.pacers[0], { x: -7, z: 7 }, { x: 8, z: 8.5 });
  pace(people.pacers[1], { x: 9, z: 9.5 }, { x: -9, z: 6.5 });

  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshBasicMaterial({ color: '#f2c94c', toneMapped: false, fog: false }));
  marker.scale.y = 1.5;
  marker.visible = false;
  scene.add(marker);

  // ---------- UI ----------

  const overlay = $('click-to-play');
  let started = false;
  let lockFailed = false;
  let lockFromOverlay = false;
  const ui = createUI({
    onModalChange(open) {
      document.body.classList.toggle('modal-open', open);
      player.enabled = !open;
      if (open) player.unlock();
      else player.lock();
      updateOverlay();
    },
  });
  const hud = {
    setNumber(number) {
      $('tab-number').textContent = number;
      $('tab').hidden = false;
    },
  };

  function updateOverlay() {
    overlay.hidden = !started || player.touch || lockFailed || player.locked || ui.modalOpen;
  }
  document.addEventListener('pointerlockchange', updateOverlay);
  document.addEventListener('pointerlockerror', () => {
    if (lockFromOverlay) {
      lockFailed = true;
      player.dragLook = true;
      ui.toast('אפשר להסתכל מסביב בגרירה עם העכבר');
    }
    lockFromOverlay = false;
    updateOverlay();
  });
  overlay.addEventListener('click', (event) => {
    if (event.target.closest('a')) return;
    lockFromOverlay = true;
    player.lock();
  });
  $('touch-controls').hidden = !player.touch;

  // ---------- Game state ----------

  const state = { step: 'home', ...(save?.state ?? {}) };
  const pending = new Map();
  const tickers = new Set();
  let target = null;

  const game = {
    scene,
    ui,
    hud,
    player,
    people,
    world,
    sky,
    crowd,
    state,
    setClock(label, minutes) {
      $('day').textContent = label;
      ui.setClock(minutes);
    },
    setTarget(next) {
      target = next;
    },
    waitInteract(id) {
      return new Promise((resolve) => pending.set(id, resolve));
    },
    waitUntil(fn) {
      return new Promise((resolve) => {
        const ticker = (dt) => {
          if (fn(dt)) {
            tickers.delete(ticker);
            resolve();
          }
        };
        tickers.add(ticker);
      });
    },
    waitZone(test) {
      return game.waitUntil(() => test(player));
    },
    save(step) {
      writeSave({ stage: 'interview-week', stageName: 'שבוע ראיונות', step, state: { ...state } });
    },
  };
  if (state.number) hud.setNumber(state.number);

  // ---------- Interactions ----------

  function handle(id, person, fallback) {
    const resolve = pending.get(id);
    if (resolve) {
      pending.delete(id);
      resolve();
      return;
    }
    const line = typeof fallback === 'function' ? fallback() : fallback;
    if (!line) return;
    const release = ui.holdModal();
    player.faceTowards(person.position.x, person.position.z, person.position.y + 1.5);
    ui.talk(person.name, line).finally(release);
  }
  const staffLines = {
    clerk1: () => `מספר ${state.number ?? '…'}, תמתין באולם. קוראים לפי המספר.`,
    clerk2: 'הרישום ליד חברתי. מי שרשום, שיחכה באולם.',
    announcer: 'שימו לב למסך. מי שלא נמצא כשקוראים לו נחשב כמי שוויתר.',
    guard1: 'הבניין הגדול. הרישום בכניסה.',
    guard2: 'תודה. תתקדם.',
    dad: 'תיזהר, תהיה בסדר. אני פה.',
  };
  for (const [id, person] of Object.entries(people.staff)) {
    interactions.add({
      id,
      object: person.hitbox,
      label: `לפנות ל${person.name.replace(/^ה/, '')}`,
      priority: () => pending.has(id),
      onInteract: () => handle(id, person, staffLines[id]),
    });
  }
  const chatter = ['(חושב על הראיון)', 'אני מקווה שלא ישאלו אותי על גיבוש הטיס…', 'בסוף נפלתי בבד״ח. מי חשב.', 'המספר שלי עוד לא ירד.'];
  for (const person of people.hall) {
    interactions.add({
      id: 'hall',
      object: person.hitbox,
      label: `לדבר עם ${person.name}`,
      enabled: () => !person.walking && person.group.visible,
      onInteract: () => handle('hall', person, () => person.line ?? chatter[Math.floor(Math.random() * chatter.length)]),
    });
  }

  // Chairs in the waiting hall.
  const seatHit = new THREE.MeshBasicMaterial({ visible: false });
  const seatGeo = new THREE.BoxGeometry(0.5, 0.9, 0.5);
  for (const seat of world.seatList) {
    const hit = new THREE.Mesh(seatGeo, seatHit);
    hit.position.set(seat.x, 0.45, seat.z);
    scene.add(hit);
    interactions.add({
      id: 'seat',
      object: hit,
      label: 'לשבת',
      range: 2.4,
      enabled: () => !seat.taken && !player.seat && !ui.modalOpen,
      onInteract: () => {
        player.sit({ ...seat, exit: { x: seat.x, z: seat.z + 0.8 } }, 0);
        seat.taken = true;
        player.onStandUp = () => {
          seat.taken = false;
        };
      },
    });
  }

  // Posters of the units, the vending machine and the laptop at home.
  for (const poster of world.posterSpots) {
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 1.0), seatHit);
    hit.position.set(poster.x + 0.3, 1.8, poster.z);
    scene.add(hit);
    interactions.add({
      id: 'poster',
      object: hit,
      label: `לקרוא על ${poster.title}`,
      range: 3.2,
      onInteract: async () => {
        const unit = UNIT_BY_ID[poster.id === 'recon' ? 'golani' : poster.id];
        const release = ui.holdModal();
        await readPoster(ui, poster.id === 'recon' ? { ...unit, name: 'סיירות חי״ר (גולני, גבעתי, נח״ל, כפיר)' } : unit);
        release();
      },
    });
  }
  const vendingHit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 1.0), seatHit);
  vendingHit.position.set(SPOTS.vending.x, 1.1, SPOTS.vending.z);
  scene.add(vendingHit);
  interactions.add({
    id: 'vending',
    object: vendingHit,
    label: 'לקנות משהו לשתות',
    range: 3,
    onInteract: () => {
      if (pending.has('vending')) {
        pending.get('vending')();
        pending.delete('vending');
      } else ui.toast('בקבוק מים קר. 8 שקלים. תודה.');
    },
  });
  const laptopHit = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 0.8), seatHit);
  laptopHit.position.set(SPOTS.desk.x, 1.0, SPOTS.desk.z);
  scene.add(laptopHit);
  interactions.add({
    id: 'laptop',
    object: laptopHit,
    label: 'לפתוח את המחשב',
    range: 3,
    priority: () => pending.has('laptop'),
    onInteract: () => handle('laptop', { position: new THREE.Vector3(), name: '' }, null),
  });

  // ---------- Input ----------

  function tryInteract() {
    if (ui.modalOpen || !player.enabled) return;
    interactions.trigger();
  }
  document.addEventListener('keydown', (event) => {
    if (event.code === 'KeyE' && !event.repeat) tryInteract();
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0 && player.locked) tryInteract();
  });
  $('action-button').addEventListener('click', tryInteract);
  $('prompt').addEventListener('click', tryInteract);
  const fullscreenButton = $('fullscreen-button');
  fullscreenButton.hidden = !document.fullscreenEnabled;
  fullscreenButton.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        await document.documentElement.requestFullscreen();
        await screen.orientation?.lock?.('landscape').catch(() => {});
      }
    } catch {
      ui.toast('הדפדפן הזה לא תומך במסך מלא');
    }
  });

  // ---------- Loop ----------

  let last = performance.now();
  let elapsed = 0;
  function frame(now) {
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
    last = Math.max(last, now);
    elapsed += dt;

    player.update(dt);
    crowd.update(dt, camera);
    world.update(elapsed);
    sky.update(camera);
    for (const ticker of [...tickers]) ticker(dt);

    const item = interactions.update(player);
    ui.setPrompt(ui.modalOpen ? null : item ? interactions.label() : null);

    const t = typeof target === 'function' ? target() : target;
    marker.visible = Boolean(t) && !ui.modalOpen;
    if (t) {
      marker.position.set(t.x, (t.y ?? 2.4) + Math.sin(elapsed * 3) * 0.1, t.z);
      marker.rotation.y = elapsed * 2;
    }
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(frame);
  function advance(seconds) {
    for (let i = 0; i < seconds * 20; i++) frame(last + 50);
  }

  // ---------- Start ----------

  $('fade').classList.add('on');
  $('loading').classList.add('done');
  $('hud').hidden = false;
  started = true;

  let startStep = 'home';
  if (devStep && STEPS.includes(devStep)) startStep = devStep;
  else if (resuming) {
    const index = STEPS.indexOf(save.step);
    startStep = STEPS[Math.min(index + 1, STEPS.length - 1)];
  }
  if (startStep !== 'home' && !state.form) {
    // Jumping in the middle (resume or testing): fill in what the earlier parts would have set.
    state.form = { hobby: 0, training: 0, weakness: 0, parents: 0 };
    state.ranking = ['paratroopers', 'golani', 'yahalom', 'nahal', 'lotar'];
    state.interviews = state.ranking.slice(0, 3);
  }
  if (resuming && startStep !== 'home') ui.toast('ממשיכים מאיפה שעצרת');

  if (import.meta.env.DEV) window.__interview = { game, player, people, advance, renderer, pending, crowd, target: () => (typeof target === 'function' ? target() : target) };

  await runFlow(game, startStep);
}

start().catch((error) => {
  console.error(error);
  $('loading').classList.remove('done');
  $('loading').querySelector('p').textContent = 'משהו השתבש בטעינה. נסו לרענן את הדף.';
});
