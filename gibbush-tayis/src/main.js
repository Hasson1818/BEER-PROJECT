import '../../shared/engine/game.css';
import '../../shared/engine/field.css';
import './style.css';
import * as THREE from 'three';
import { buildWorld, height, SPOTS } from './world.js';
import { createSky } from '../../shared/engine/sky.js';
import { createPeople } from './team.js';
import { createDrills } from './drills.js';
import { runFlow, STEPS } from './flow.js';
import { badachBook } from './minigames.js';
import { Crowd, Person } from '../../shared/engine/people.js';
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

/** Stage HUD: the day (there are no watches in the gibbush), your number, gear, stamina, grip. */
function createHud() {
  return {
    setDay(day, label) {
      $('day').textContent = `יום ${day}`;
      $('clock').textContent = label;
    },
    setNumber(number) {
      $('tab-number').textContent = number;
      $('tab').hidden = false;
    },
    setGear(show) {
      $('gear').hidden = !show;
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
    setGrip(value) {
      $('grip').hidden = value === null;
      if (value === null) return;
      $('grip-fill').style.transform = `scaleX(${Math.max(0, value) / 100})`;
      $('grip').classList.toggle('low', value < 25);
    },
    setCarry(item) {
      const labels = { sandbag: 'שק חול', kitbag: 'קיטבג וכל ציוד השינה' };
      $('carry').hidden = !labels[item];
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
  const resuming = save?.stage === 'gibbush-tayis';
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
  enableCloseUps(crowd); // The detailed close-up characters load in the background.
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

  const state = { step: 'arrive', ...(save?.state ?? {}) };
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
    state,
    onAction: null,
    badachDay: 1,
    setDay(day, label) {
      state.day = day;
      hud.setDay(day, label);
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
    /** A broken rule. `seen`: whether a מ״כ noticed (you never know). */
    violation(key, text, seen = Math.random() < 0.5) {
      (state.violations ??= []).push({ key, text, seen, reported: false });
    },
    /** "קוד 2": sit and study the בד״ח for a while. */
    async studyBreak(seconds, text) {
      const before = [$('objective-text').textContent, $('objective-sub').hidden ? '' : $('objective-sub').textContent];
      ui.setObjective(text, 'מקש B או 📘 פותחים את החוברת');
      let t = 0;
      await game.waitUntil((dt) => {
        t += dt;
        hud.setDrill('קוד 2 · לימוד בד״ח', `${Math.max(0, Math.ceil(seconds - t))}`);
        return t >= seconds;
      });
      hud.setDrill(null);
      ui.setObjective(...before);
    },
    save(step) {
      writeSave({
        stage: 'gibbush-tayis',
        stageName: 'גיבוש טייס',
        step,
        state: { ...state, stats: { ...(state.stats ?? {}), ...game.drills.stats } },
      });
    },
  };
  game.drills = createDrills(game);
  Object.assign(game.drills.stats, state.stats ?? {});

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
    mc: () => (state.silence ? `${state.number ?? 7}, לחזור לשורה.` : 'כן?'),
    mc2: 'לחזור לשורה.',
    sergeant: 'דיגום. בקבוק, קסדה, חוברת.',
    commander: 'בהצלחה.',
    platoon: '…',
    medic: 'אם משהו כואב, באים אליי. לא מתביישים.',
    doctor: 'הכול תקין?',
    quartermaster: 'מה חסר לך?',
  };
  for (const [id, person] of Object.entries(people.staff)) {
    interactions.add({
      id,
      object: person.hitbox,
      label: `לפנות ל${person.name.replace(/^ה/, '')}`, // "לחובש", not "להחובש".
      priority: () => pending.has(id),
      onInteract: () => handle(id, person, staffLines[id]),
    });
  }
  const whispers = ['(לוחש) כמה זמן עוד?', '(לוחש) אני מת מרעב…', '(לוחש) ראית מה המ״כ רשם?', '(לוחש) הידיים שלי גמורות מהמתלה.'];
  for (const person of [...people.classmates, ...people.others]) {
    interactions.add({
      id: 'npc',
      object: person.hitbox,
      label: `לדבר עם ${person.name}`,
      enabled: () => !person.walking && !game.onAction && person.group.visible,
      onInteract: () => {
        if (!state.silence) {
          handle('npc', person, 'נדבר אחר כך.');
          return;
        }
        handle('npc', person, () => whispers[Math.floor(Math.random() * whispers.length)]);
        game.violation('talk', `דיברתי עם ${person.name} בזמן דממה`);
        ui.toast('⚠ דיברת בזמן דממה. זה נרשם אצלך, ואפשר לדווח על זה למ״כ.', 3400);
      },
    });
  }

  // ---------- Input ----------

  // The בד״ח booklet opens from anywhere once you have it (key B or the 📘 button).
  function openBooklet() {
    if (ui.modalOpen || $('gear').hidden) return;
    badachBook(ui, game.badachDay);
  }

  function tryInteract() {
    if (ui.modalOpen || !player.enabled) return;
    if (game.onAction) game.onAction();
    else interactions.trigger();
  }
  document.addEventListener('keydown', (event) => {
    if (event.code === 'KeyE' && !event.repeat) tryInteract();
    if (event.code === 'KeyB' && !event.repeat) openBooklet();
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0 && player.locked) tryInteract();
  });
  $('action-button').addEventListener('click', tryInteract);
  $('prompt').addEventListener('click', tryInteract);
  $('booklet-button').addEventListener('click', openBooklet);
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
  if (devStep && STEPS.includes(devStep)) startStep = devStep;
  else if (resuming) {
    const index = STEPS.indexOf(save.step);
    startStep = STEPS[Math.min(index + 1, STEPS.length - 1)];
  }
  if (startStep !== 'arrive') {
    // Everything you get on day 1 is already yours.
    state.silence = true;
    hud.setNumber(7);
    hud.setGear(true);
    sky.setTime('day');
    player.teleport(SPOTS.form.x, SPOTS.form.z, Math.PI);
    await ui.fadeIn();
    if (resuming) ui.toast('ממשיכים מאיפה שעצרת');
  }

  if (import.meta.env.DEV) window.__gibbush = { game, player, people, advance, renderer, pending, crowd, target: () => (typeof target === 'function' ? target() : target) };

  await runFlow(game, startStep);
}

start().catch((error) => {
  console.error(error);
  $('loading').classList.remove('done');
  $('loading').querySelector('p').textContent = 'משהו השתבש בטעינה. נסו לרענן את הדף.';
});
