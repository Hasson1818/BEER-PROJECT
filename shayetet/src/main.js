import '../../shared/engine/game.css';
import '../../shared/engine/field.css';
import '../../yom-sayarot/src/style.css';
import '../../draft/src/style.css';
import './style.css';
import * as THREE from 'three';
import { buildWorld, height, waterGround, inPool, DUNE, SPOTS, SEA, POOL, SUB } from './world.js';
import { createWater } from './water.js';
import { createSky } from '../../shared/engine/sky.js';
import { createPeople, dayThreeCut } from './team.js';
import { createDrills } from '../../yom-sayarot/src/drills.js';
import { runFlow, STEPS } from './flow.js';
import { Crowd, Person } from '../../shared/engine/people.js';
import { enableCloseUps } from '../../shared/engine/detail.js';
import { smsPanel } from '../../pilot-path/shared/panels.js';
import { noise } from '../../pilot-path/shared/fx.js';
import { STAFF } from './content.js';
import { loop, mountMuteButton, preload } from '../../shared/engine/sound.js';
import { Player } from '../../shared/engine/player.js';
import { Interactions } from '../../shared/engine/interactions.js';
import { createUI } from '../../shared/engine/ui.js';
import { loadSave, writeSave, clearSave } from '../../shared/save.js';
import { unlock } from '../../shared/achievements.js';

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
    setDay(text) {
      $('day').textContent = text;
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
      const labels = { sandbag: 'שק חול על הגב', jerrycan: 'ג׳ריקן', kitbag: 'קיטבג בשתי הידיים' };
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
  const resuming = save?.stage === 'shayetet';
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
  Person.ground = waterGround;
  const crowd = new Crowd(scene);
  enableCloseUps(crowd); // The detailed close-up characters load in the background.
  const player = new Player(camera, canvas, world, crowd);
  player.ground = waterGround;
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
    bib: save?.state?.bib ?? String(100 + Math.floor(Math.random() * 400)),
    ...(save?.state ?? {}),
  };
  const pending = new Map();
  const tickers = new Set();
  let target = null;

  const game = {
    scene,
    ui,
    canvas,
    renderPaused: false,
    terrain: { DUNE, SPOTS, height },
    terrainHeight: height,
    staff: (id) => STAFF[id],
    setDay: (text) => hud.setDay(text),
    phone: (sms) => smsPanel(ui, sms),
    splash() {
      noise(0.6, { filter: 'lowpass', freq: 1400, sweep: 300, volume: 0.16 });
      noise(0.3, { filter: 'bandpass', freq: 700, q: 0.7, volume: 0.08, at: 0.2 });
    },
    hud,
    player,
    people,
    world,
    sky,
    state,
    onAction: null,
    setClock(minutes) {
      ui.setClock(minutes);
    },
    setTarget(next) {
      target = next;
    },
    waitInteract(id) {
      return new Promise((resolve) => pending.set(id, resolve));
    },
    waitUntil(fn) {
      return new Promise((resolve, reject) => {
        const ticker = (dt) => {
          try {
            if (!fn(dt)) return;
            tickers.delete(ticker);
            resolve();
          } catch (error) {
            tickers.delete(ticker);
            reject(error);
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
        stage: 'shayetet',
        stageName: 'גיבוש שייטת 13',
        step,
        state: { ...state, stats: { ...(state.stats ?? {}), ...game.drills.stats } },
      });
    },
  };
  game.drills = createDrills(game);
  Object.assign(game.drills.stats, state.stats ?? {});
  if (state.bib && save) hud.setBib(state.bib);
  game.water = createWater(game);
  // After the cut on day 3 the squad is smaller; a resumed game has to remove them again.
  if (resuming && ['day3', 'day4', 'day5', 'results'].includes(save.step)) dayThreeCut(people);

  // ---------- Interactions ----------

  const chatter = [
    'המים בבוקר היו קפואים. ואמרו שמחר עוד יותר.',
    'שמעתי שבבריכה צוללים לארבעה מטר עם מסכה מושחרת.',
    'אל תמלא את השק עד חצי. רואים הכול.',
    'יש לי כבר אזהרה אחת. אני לא נוגע בכלום.',
    'שמונה וחצי לאלפיים מטר על חול. זה לא צחוק.',
    'בציפה עם המסכה פשוט סופרים נשימות.',
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
    medic: 'אוזניים? סינוסים? תבוא אליי לפני הבריכה.',
    head: 'לא עכשיו. תתרכז במה שאומרים לך.',
    guy: `${state.bib}, תחזור לחוליה.`,
    pool: 'משווים לחץ כל מטר. לא מחכים שיכאב.',
    psych: 'נדבר אם יגיע התור.',
  };
  for (const [id, person] of Object.entries(people.staff)) {
    if (id === 'others') continue;
    interactions.add({
      id,
      object: person.hitbox,
      label: `לדבר עם ${person.name}`,
      priority: () => pending.has(id),
      enabled: () => person.group.visible,
      onInteract: () => handle(id, person, staffLines[id]),
    });
  }
  for (const person of [...people.squad, ...people.others, ...people.staff.others]) {
    const isStaff = people.staff.others.includes(person);
    interactions.add({
      id: 'npc',
      object: person.hitbox,
      label: `לדבר עם ${person.name}`,
      enabled: () => person.group.visible && !person.walking && !game.onAction,
      onInteract: () => handle('npc', person, () => (isStaff ? 'תחזור לחוליה שלך.' : chatter[Math.floor(Math.random() * chatter.length)])),
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

  // ---------- Sound: ambience, steps, breathing ----------

  mountMuteButton();
  const sounds = {
    wind: loop('wind'),
    crickets: loop('crickets'),
    murmur: loop('murmur'),
    room: loop('roomtone'),
    steps: loop('steps'),
    crawl: loop('crawl'),
    breath: loop('breath'),
  };
  let wasUnder = false;
  let fogSaved = null;
  function updateAudio(dt) {
    const night = sky.time === 'night' || sky.time === 'predawn';
    const inside = false;
    // Under the water (pool or sea): a blue tint and a short fog.
    const level = inPool(player.x, player.z) ? POOL.water : SEA.level;
    const under = camera.position.y < level - 0.02 && (inPool(player.x, player.z) || player.z < -55);
    if (under !== wasUnder) {
      wasUnder = under;
      document.body.classList.toggle('underwater', under);
      if (under) {
        fogSaved = { color: scene.fog.color.clone(), near: scene.fog.near, far: scene.fog.far };
        scene.fog.color.set('#0e6a8f');
        scene.fog.near = 0.5;
        scene.fog.far = 14;
      } else if (fogSaved) {
        scene.fog.color.copy(fogSaved.color);
        scene.fog.near = fogSaved.near;
        scene.fog.far = fogSaved.far;
      }
    }
    sounds.wind.setVolume(inside ? 0.06 : night ? 0.45 : 0.85);
    sounds.crickets.setVolume(!inside && night ? 1 : sky.time === 'dusk' && !inside ? 0.5 : 0);
    sounds.murmur.setVolume(inside ? 0.5 : 0);
    sounds.room.setVolume(inside ? 1 : 0);
    const speed = dt > 0 ? player.movedThisFrame / dt : 0;
    const moving = speed > 0.3 && !player.seat && !player.positionLocked && !ui.modalOpen;
    const crawling = player.eyeOverride === 0.5;
    sounds.steps.setVolume(moving && !crawling && !inside ? Math.min(1, 0.55 + speed / 8) : 0, 0.2);
    sounds.steps.setRate(THREE.MathUtils.clamp(speed / 2.6, 0.85, 1.7));
    sounds.crawl.setVolume(moving && crawling ? 1 : 0, 0.2);
    const stamina = game.drills.stamina ?? 100;
    sounds.breath.setVolume(stamina < 30 ? Math.min(1, ((30 - stamina) / 30) * 1.2) : 0, 0.8);
  }

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
    updateAudio(dt);
    for (const ticker of [...tickers]) ticker(dt);

    const item = !game.onAction ? interactions.update(player) : null;
    const actionLabel = game.onAction && !game.onAction.silent ? 'פעולה' : null;
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
  unlock('first-steps');

  let startStep = 'arrive';
  const devStep = import.meta.env.DEV && STEPS.includes(params.get('step')) ? params.get('step') : null;
  if (devStep) {
    startStep = devStep;
    if (devStep !== 'arrive') {
      sky.setTime('day');
      player.teleport(0, 20, Math.PI);
      await ui.fadeIn();
    }
  } else if (resuming) {
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

  preload(['whistle', 'sms', 'achievement', 'dig1', 'dig2']);
  if (import.meta.env.DEV) window.__shayetet = { game, player, people, advance, renderer, pending, target: () => (typeof target === 'function' ? target() : target) };

  await runFlow(game, startStep);
}

start().catch((error) => {
  console.error(error);
  $('loading').classList.remove('done');
  $('loading').querySelector('p').textContent = 'משהו השתבש בטעינה. נסו לרענן את הדף.';
});
