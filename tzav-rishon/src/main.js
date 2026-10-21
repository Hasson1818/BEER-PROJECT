import '../../shared/engine/game.css';
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Crowd } from '../../shared/engine/people.js';
import { enableCloseUps } from '../../shared/engine/detail.js';
import { Player } from '../../shared/engine/player.js';
import { Interactions } from '../../shared/engine/interactions.js';
import { createUI } from '../../shared/engine/ui.js';
import { createStaff, RoutingQueue, HallLife, nextNumber } from './life.js';
import { runFlow, idleLine, STEPS } from './flow.js';
import { CHATTER, STAFF_IDLE } from './content.js';
import { canvasTexture } from '../../shared/engine/textures.js';
import { loadSave, writeSave, clearSave } from '../../shared/save.js';
import { unlock } from '../../shared/achievements.js';

const START_CLOCK = 7 * 60 + 50;

async function loadFonts() {
  const fonts = ['400 32px Heebo', '500 32px Heebo', '700 32px Heebo', '800 32px Heebo', '32px "Secular One"'];
  try {
    await Promise.race([Promise.all(fonts.map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 3500))]);
  } catch {
    // Fall back to system fonts.
  }
}

async function start() {
  // ?new=1 starts over; otherwise continue from the save if there is one.
  // The parameter is removed right away so refreshing the page doesn't erase progress.
  const params = new URLSearchParams(window.location.search);
  if (params.has('new')) clearSave();
  const save = params.has('new') ? null : loadSave();
  const resuming = save?.stage === 'tzav-rishon';
  if (window.location.search) window.history.replaceState(null, '', window.location.pathname);

  await loadFonts();

  // ---------- Renderer & scene ----------

  const canvas = document.getElementById('game');
  const touchDevice = window.matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  // Phones have very dense screens; drawing fewer pixels keeps the frame rate up.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, touchDevice ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = canvasTexture(4, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#5f9fd6');
    g.addColorStop(0.6, '#a9cfea');
    g.addColorStop(1, '#e3eef3');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  scene.fog = new THREE.Fog('#d9e8f0', 45, 120);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 220);
  scene.add(new THREE.HemisphereLight('#ffffff', '#b9b2a2', 1.6));
  const sun = new THREE.DirectionalLight('#fff3e0', 1.5);
  sun.position.set(8, 14, 10);
  scene.add(sun);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // On a phone held upright the view would be a narrow slit, so widen it
    // to keep about 75° visible side to side (up to a limit).
    const horizontal = THREE.MathUtils.degToRad(75);
    const vertical = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(horizontal / 2) / camera.aspect));
    camera.fov = THREE.MathUtils.clamp(vertical, 70, 95);
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- World & people ----------

  const world = buildWorld(scene);
  const crowd = new Crowd(scene);
  enableCloseUps(crowd); // The detailed close-up characters load in the background.
  const player = new Player(camera, canvas, world, crowd);
  const interactions = new Interactions(camera, world);
  const staff = createStaff(world, crowd);
  const hall = new HallLife(world, crowd);
  const queue = new RoutingQueue(world, crowd, hall, staff);

  // Yellow marker floating over the current target.
  const marker = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.18),
    new THREE.MeshBasicMaterial({ color: '#f2c94c', toneMapped: false }),
  );
  marker.scale.y = 1.5;
  marker.visible = false;
  scene.add(marker);

  // ---------- UI ----------

  const isTouch = player.touch;
  const overlay = document.getElementById('click-to-play');
  let started = false;
  let lockFailed = false;

  const ui = createUI({
    onModalChange(open) {
      document.body.classList.toggle('modal-open', open);
      player.enabled = !open;
      if (open) player.unlock();
      else player.lock();
      updateOverlay();
    },
  });

  function updateOverlay() {
    overlay.hidden = !started || isTouch || lockFailed || player.locked || ui.modalOpen;
  }
  // If locking the mouse fails even after a direct click, fall back to drag-to-look.
  let lockFromOverlay = false;
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
  document.getElementById('touch-controls').hidden = !isTouch;

  // ---------- Game state ----------

  const state = {
    step: 'arrive',
    number: save?.number ?? nextNumber('A'),
    results: { ...(save?.results ?? {}) },
  };

  const pending = new Map();
  const tickers = new Set();
  let target = null;

  const game = {
    ui,
    player,
    world,
    crowd,
    staff,
    queue,
    hall,
    state,
    station: null,
    clock: save?.clock ?? START_CLOCK,

    addMinutes(minutes) {
      game.clock += minutes;
    },
    setTarget(next) {
      target = next;
    },
    waitInteract(id) {
      return new Promise((resolve) => pending.set(id, resolve));
    },
    waitAnyInteract(ids) {
      return new Promise((resolve) => {
        ids.forEach((id, index) =>
          pending.set(id, () => {
            ids.forEach((other) => pending.delete(other));
            resolve(index);
          }),
        );
      });
    },
    /** Resolves when fn(dt) returns true; fn runs every frame. */
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
    every(fn) {
      const ticker = (dt) => fn(dt);
      tickers.add(ticker);
      return () => tickers.delete(ticker);
    },
    save(step) {
      writeSave({
        stage: 'tzav-rishon',
        stageName: 'צו ראשון',
        step,
        number: state.number,
        clock: game.clock,
        results: state.results,
      });
    },
  };

  // ---------- Interactions ----------

  function handle(id, person, fallback) {
    const resolve = pending.get(id);
    if (resolve) {
      pending.delete(id);
      resolve();
      return;
    }
    const line = typeof fallback === 'function' ? fallback() : fallback;
    const release = ui.holdModal();
    if (person) player.faceTowards(person.position.x, person.position.z, person.pose.startsWith('sit') ? 1.15 : 1.55);
    ui.talk(person?.name ?? '', line).finally(release);
  }

  const registered = new Set();
  function addPerson(id, person, label, fallback) {
    registered.add(person);
    interactions.add({ id, object: person.hitbox, label, priority: () => pending.has(id), onInteract: () => handle(id, person, fallback) });
  }

  addPerson('guard', staff.guard, 'לדבר עם המאבטח', STAFF_IDLE.guard);
  staff.routingClerks.forEach((clerk, i) => {
    addPerson(`window-${i}`, clerk, `לגשת לעמדה ${i + 1}`, () => {
      if (i === 2) return 'העמדה הזו סגורה כרגע. תעמוד בתור לעמדות 1 ו־2.';
      const routingDone = STEPS.indexOf(state.step) > STEPS.indexOf('routing');
      if (routingDone) return game.station === 'checkout' ? 'אפשר לגשת אליי לסיום.' : 'בסוף היום תחזור אליי לסיום. עכשיו חכה במסך.';
      return queue.playerIndex >= 0 ? STAFF_IDLE.routingBusy : STAFF_IDLE.routing;
    });
  });
  addPerson('data', staff.dataClerk, 'לדבר עם פקידת אימות הנתונים', () => idleLine(game, 'data'));
  addPerson('proctor', staff.proctor, 'לדבר עם משגיח המבחנים', () => idleLine(game, 'proctor'));
  addPerson('measure', staff.measureMedic, 'לדבר עם החובשת', () => idleLine(game, 'measure'));
  addPerson('vision', staff.visionMedic, 'לדבר עם החובש', () => idleLine(game, 'vision'));
  addPerson('doctor', staff.doctor, 'לדבר עם הרופא', () => idleLine(game, 'doctor'));
  addPerson('interviewer', staff.interviewers.interview2, 'לדבר עם המאבחנת', () => idleLine(game, 'interviewer'));
  addPerson('busy-interviewer', staff.interviewers.interview1, 'לדבר עם המאבחנת', 'סליחה, אני באמצע ראיון. תחכה למספר שלך במסך.');
  addPerson('busy-interviewer', staff.interviewers.interview3, 'לדבר עם המאבחנת', 'סליחה, אני באמצע ראיון. תחכה למספר שלך במסך.');
  addPerson('busy-data', staff.dataClerk2, 'לדבר עם הפקידה', 'אני עם מלש״ב אחר כרגע. הפקידה לידי תקבל אותך.');

  // The computer at station 5.
  const station5 = world.daparStations.find((s) => s.number === 5);
  const stationBox = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 1.1), new THREE.MeshBasicMaterial({ visible: false }));
  stationBox.position.set(station5.x - 0.35, 0.7, station5.z);
  scene.add(stationBox);
  interactions.add({
    id: 'dapar-seat',
    object: stationBox,
    label: 'לשבת בעמדה 5',
    enabled: () => pending.has('dapar-seat'),
    onInteract: () => handle('dapar-seat', null, ''),
  });

  // Chairs in the waiting hall.
  for (const row of world.seatRows) {
    interactions.add({
      id: 'seat',
      object: row.hitbox,
      // For the touch fallback: the nearest free chair, not the middle of the row.
      position: () => {
        const free = row.seats.filter((s) => !s.taken);
        if (!free.length) return { x: Infinity, z: Infinity };
        return free.reduce((a, b) => (Math.abs(a.x - player.x) < Math.abs(b.x - player.x) ? a : b));
      },
      label: 'לשבת',
      enabled: () => !player.seat && row.seats.some((s) => !s.taken),
      onInteract: () => {
        const free = row.seats.filter((s) => !s.taken);
        free.sort((a, b) => Math.abs(a.x - player.x) - Math.abs(b.x - player.x));
        player.sit(free[0], 0);
        ui.toast('ישבת. כשיושבים, ההמתנה עוברת מהר יותר. זוז כדי לקום.');
      },
    });
  }

  // Everyone else can be chatted with; people created later get added as they appear.
  const staffPeople = new Set([...registered]);
  function registerCrowd() {
    for (const person of crowd.people) {
      if (registered.has(person) || staffPeople.has(person)) continue;
      registered.add(person);
      interactions.add({
        id: 'npc',
        object: person.hitbox,
        label: `לדבר עם ${person.name}`,
        enabled: () => !person.walking,
        onInteract: () => handle('npc', person, () => CHATTER[Math.floor(Math.random() * CHATTER.length)]),
      });
    }
  }
  registerCrowd();

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
  document.getElementById('action-button').addEventListener('click', tryInteract);
  // On touch screens the prompt itself ("לדבר עם...") can be tapped too.
  document.getElementById('prompt').addEventListener('click', tryInteract);

  const fullscreenButton = document.getElementById('fullscreen-button');
  fullscreenButton.hidden = !document.fullscreenEnabled;
  fullscreenButton.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
        // Android lets a fullscreen page lock to landscape; other browsers just ignore this.
        await screen.orientation?.lock?.('landscape').catch(() => {});
      }
    } catch {
      ui.toast('הדפדפן הזה לא תומך במסך מלא');
    }
  });

  // ---------- Loop ----------

  let last = performance.now();
  let elapsed = 0;
  let registerTimer = 0;
  const markerPos = new THREE.Vector3();

  function frame(now) {
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
    last = Math.max(last, now);
    elapsed += dt;

    player.update(dt);
    crowd.update(dt, camera);
    queue.update(dt, player);
    hall.update(dt, player);
    world.update(elapsed);
    for (const ticker of [...tickers]) ticker(dt);

    if (!ui.modalOpen) game.addMinutes(dt * 0.25);
    ui.setClock(game.clock);
    world.setClock(game.clock);

    registerTimer -= dt;
    if (registerTimer <= 0) {
      registerTimer = 1;
      registerCrowd();
    }

    const item = interactions.update(player);
    ui.setPrompt(item && !ui.modalOpen ? interactions.label() : null);

    const t = typeof target === 'function' ? target() : target;
    marker.visible = Boolean(t) && !ui.modalOpen;
    if (t) {
      markerPos.set(t.x, (t.y ?? 2.4) + Math.sin(elapsed * 3) * 0.08, t.z);
      marker.position.copy(markerPos);
      marker.rotation.y = elapsed * 2;
    }

    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(frame);

  // Dev helper: run the game for `seconds` even when the tab isn't drawing.
  function advance(seconds) {
    for (let i = 0; i < seconds * 20; i++) frame(last + 50);
  }

  // ---------- Start ----------

  document.getElementById('fade').classList.add('on');
  document.getElementById('loading').classList.add('done');
  document.getElementById('hud').hidden = false;
  started = true;
  unlock('first-steps');

  let startStep = 'arrive';
  if (resuming) {
    const index = STEPS.indexOf(save.step);
    startStep = save.step === 'results' ? 'results' : STEPS[Math.min(index + 1, STEPS.length - 1)];
    state.step = startStep;
    world.openSecurity();
    queue.playerNeeded = false;
    if (index >= STEPS.indexOf('routing')) ui.showSticker(state.number);
    if (startStep === 'results') player.teleport(0, 6, Math.PI);
    else player.teleport(0, -13.4, 0);
    await ui.fadeIn();
    ui.toast('ממשיכים מאיפה שעצרת');
  }

  if (import.meta.env.DEV) window.__tzav = { game, player, world, queue, hall, staff, interactions, pending, advance, renderer };

  await runFlow(game, startStep);
}

start().catch((error) => {
  console.error(error);
  const loading = document.getElementById('loading');
  loading.classList.remove('done');
  loading.querySelector('p').textContent = 'משהו השתבש בטעינה. נסו לרענן את הדף.';
});
