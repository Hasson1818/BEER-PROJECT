import '../../shared/engine/game.css';
import '../../shared/engine/field.css';
import './style.css';
import * as THREE from 'three';
import { buildWorld, height } from './world.js';
import { createSky } from '../../shared/engine/sky.js';
import { createPeople } from './team.js';
import { createDrills } from './drills.js';
import { runFlow, STEPS } from './flow.js';
import { Crowd, Person } from '../../shared/engine/people.js';
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

/** Stage-specific HUD: day, shirt number, stamina bar, what you carry, drill info. */
function createHud() {
  return {
    setBib(number) {
      $('bib-number').textContent = number;
      $('bib').hidden = false;
    },
    setDay(day) {
      $('day').textContent = `יום ${day}`;
    },
    setStamina(value) {
      $('stamina').hidden = false;
      $('stamina-fill').style.transform = `scaleX(${Math.max(0, value) / 100})`;
      $('stamina').classList.toggle('low', value < 20);
      document.body.classList.toggle('exhausted', value < 15);
    },
    hideStamina() {
      $('stamina').hidden = true;
      document.body.classList.remove('exhausted');
    },
    setCarry(item) {
      const labels = { sandbag: 'שק חול על הכתפיים', jerrycan: 'ג׳ריקן 20 ליטר' };
      $('carry').hidden = !item;
      $('carry').textContent = labels[item] ?? '';
    },
    /** What the drill box shows now, so a countdown can put it back. */
    getDrill() {
      return $('drill').hidden || $('drill').classList.contains('countdown') ? null : { title: $('drill-title').textContent, info: $('drill-info').textContent };
    },
    setDrill(title, info = '') {
      const box = $('drill');
      if (!title && !info) {
        box.hidden = true;
        return;
      }
      box.hidden = false;
      box.classList.toggle('countdown', !title);
      $('drill-title').textContent = title ?? '';
      $('drill-info').textContent = info;
    },
  };
}

async function start() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('new')) clearSave();
  const save = params.has('new') ? null : loadSave();
  const resuming = save?.stage === 'yom-sayarot';
  if (window.location.search) window.history.replaceState(null, '', window.location.pathname);

  await loadFonts();

  // ---------- Renderer & scene ----------

  const canvas = $('game');
  const touchDevice = window.matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, touchDevice ? 1.5 : 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 900);

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
  Person.ground = height;
  const crowd = new Crowd(scene);
  const player = new Player(camera, canvas, world, crowd);
  player.ground = height;
  const interactions = new Interactions(camera, world);
  const people = createPeople(crowd);

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
  const hud = createHud();

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

  const state = {
    step: 'arrive',
    bib: save?.state?.bib ?? String(100 + Math.floor(Math.random() * 180)),
    ...(save?.state ?? {}),
  };
  const pending = new Map();
  const tickers = new Set();
  let target = null;
  let clock = { day: 1, minutes: 12 * 60 };

  const game = {
    scene,
    ui,
    hud,
    player,
    people,
    world,
    sky,
    state,
    onAction: null,
    setClock(day, minutes) {
      clock = { day, minutes };
      hud.setDay(day);
      ui.setClock(minutes);
    },
    addMinutes(m) {
      clock.minutes += m;
      ui.setClock(clock.minutes);
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
      writeSave({
        stage: 'yom-sayarot',
        stageName: 'יום סיירות',
        step,
        state: { ...state, stats: { ...(state.stats ?? {}), ...game.drills.stats } },
      });
    },
  };
  game.drills = createDrills(game);
  Object.assign(game.drills.stats, state.stats ?? {});
  if (state.bib && save) hud.setBib(state.bib);

  // ---------- Interactions ----------

  const chatter = [
    'הרגליים שלי גמורות…',
    'שמעתי שבאוקטובר התשובות מגיעות בסמס.',
    'תזכור את מספר הסיבוב. שאלו אותי ולא זכרתי.',
    'שתה מים, באמת.',
    'אני רק רוצה לעבור את הצוקון.',
    'המגבש שלנו לא מחייך בכלל.',
  ];
  function handle(id, person, fallback) {
    const resolve = pending.get(id);
    if (resolve) {
      pending.delete(id);
      resolve();
      return;
    }
    const line = typeof fallback === 'function' ? fallback() : fallback;
    const release = ui.holdModal();
    player.faceTowards(person.position.x, person.position.z, person.position.y + 1.5);
    ui.talk(person.name, line).finally(release);
  }
  const staffLines = {
    clerk: 'קיבלת מספר? אל תאבד אותו.',
    medic: 'אם משהו כואב, תבוא אליי. אל תתבייש.',
    head: 'לא עכשיו. תתרכז במה שאומרים לך.',
    guy: `${state.bib}, תחזור לצוות.`,
  };
  for (const [id, person] of Object.entries(people.staff)) {
    if (id === 'others') continue;
    interactions.add({
      id,
      object: person.hitbox,
      label: `לדבר עם ${person.name}`,
      priority: () => pending.has(id),
      onInteract: () => handle(id, person, staffLines[id]),
    });
  }
  for (const person of [...people.teammates, ...people.others, ...people.staff.others]) {
    const isStaff = people.staff.others.includes(person);
    interactions.add({
      id: 'npc',
      object: person.hitbox,
      label: `לדבר עם ${person.name}`,
      enabled: () => !person.walking && !game.onAction,
      onInteract: () => handle('npc', person, () => (isStaff ? 'תחזור לצוות שלך.' : chatter[Math.floor(Math.random() * chatter.length)])),
    });
  }

  // ---------- Input ----------

  function tryInteract() {
    if (ui.modalOpen || !player.enabled) return;
    if (game.onAction) game.onAction();
    else interactions.trigger();
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

    const item = !game.onAction ? interactions.update(player) : null;
    const actionLabel = game.onAction ? 'פעולה' : null;
    ui.setPrompt(ui.modalOpen ? null : item ? interactions.label() : actionLabel);

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

  let startStep = 'arrive';
  if (resuming) {
    const index = STEPS.indexOf(save.step);
    startStep = STEPS[Math.min(index + 1, STEPS.length - 1)];
    state.step = startStep;
    if (startStep !== 'arrive') {
      sky.setTime('day');
      player.teleport(0, 20, Math.PI);
      await ui.fadeIn();
      ui.toast('ממשיכים מאיפה שעצרת');
    }
  }

  if (import.meta.env.DEV) window.__sayarot = { game, player, people, advance, renderer, pending };

  await runFlow(game, startStep);
}

start().catch((error) => {
  console.error(error);
  $('loading').classList.remove('done');
  $('loading').querySelector('p').textContent = 'משהו השתבש בטעינה. נסו לרענן את הדף.';
});
