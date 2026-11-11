import '../../shared/engine/game.css';
import '../../shared/engine/field.css';
import '../../yom-sayarot/src/style.css';
import './style.css';
import * as THREE from 'three';
import { buildWorld, POOL, SPOTS, inPool } from './world.js';
import { createSky } from '../../shared/engine/sky.js';
import { createPeople } from './team.js';
import { createWater, poolGround } from './water.js';
import { STAFF } from './content.js';
import { runFlow, STEPS } from './flow.js';
import { Crowd, Person } from '../../shared/engine/people.js';
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

async function start() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('new')) clearSave();
  const save = params.has('new') ? null : loadSave();
  const resuming = save?.stage === 'draft';
  const pathParam = ['669', 'commando'].includes(params.get('path')) ? params.get('path') : null;
  const devStep = import.meta.env.DEV && STEPS.includes(params.get('step')) ? params.get('step') : null;
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
  Person.ground = poolGround;
  const crowd = new Crowd(scene);
  // No detailed close-up characters here: their model is built for clothes and boots, not swimwear.
  const player = new Player(camera, canvas, world, crowd);
  player.ground = poolGround;
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
  const hud = {
    setBib(number) {
      $('bib-number').textContent = number;
      $('bib').hidden = false;
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

  const state = {
    step: 'home',
    bib: save?.state?.bib ?? String(100 + Math.floor(Math.random() * 400)),
    ...(save?.state ?? {}),
  };
  if (pathParam) state.path = pathParam;
  const pending = new Map();
  const tickers = new Set();
  let target = null;
  let home = false;

  const game = {
    scene,
    canvas,
    ui,
    hud,
    player,
    people,
    world,
    sky,
    state,
    onAction: null,
    staff: (id) => STAFF[id],
    setDay(text) {
      $('day').textContent = text;
    },
    setClock(minutes) {
      ui.setClock(minutes);
    },
    /** Indoors at home (sound and light), or out at the pool. */
    atHome(value) {
      home = value;
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
      writeSave({ stage: 'draft', stageName: 'הדראפט · 669 / קומנדו', step, state: { ...state } });
    },
  };
  game.water = createWater(game);
  if (state.bib && save && state.health !== undefined) hud.setBib(state.bib);

  // ---------- Interactions ----------

  const chatter = [
    'אני שוחה טוב, אבל דריכה עם מרפקים למעלה? אף פעם לא ניסיתי.',
    'שמעתי שיש טבעת של עשרים דקות. עשרים!',
    'אמרו לי שמי שעבר את יום הבריכה של השייטת לא צריך לבוא לפה.',
    'המים קרים יותר ממה שחשבתי.',
    'הכי חשוב זה לנשום לאט. ככה אמר לי אח שלי.',
    'אני מתפלל שזה לא ייקח את כל היום.',
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
    head: 'תחכה לקבוצה שלך. עוד מעט מתחילים.',
    second: 'שאלות? תשאל את מה שאתה צריך כדי לעשות את המשימה, לא יותר.',
    lifeguard: 'אני רואה את כולם. מרגישים רע, מרימים יד.',
    medic: 'כאב באוזן, סחרחורת, כל דבר: תבוא אליי. לא מחכים.',
    psych: 'נדבר בסוף היום.',
    clerk: 'קליטה פה. תעודה מזהה ביד.',
  };
  for (const [id, person] of Object.entries(people.staff)) {
    interactions.add({
      id,
      object: person.hitbox,
      label: `לדבר עם ${person.name}`,
      priority: () => pending.has(id),
      enabled: () => person.group.visible && !home,
      onInteract: () => handle(id, person, staffLines[id]),
    });
  }
  for (const person of [...people.group, ...people.others]) {
    interactions.add({
      id: 'npc',
      object: person.hitbox,
      label: `לדבר עם ${person.name}`,
      enabled: () => person.group.visible && !person.walking && !game.onAction && !home,
      onInteract: () => handle('npc', person, () => chatter[Math.floor(Math.random() * chatter.length)]),
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

  // ---------- Sound and the view under water ----------

  mountMuteButton();
  const sounds = { wind: loop('wind'), murmur: loop('murmur'), room: loop('roomtone'), steps: loop('steps') };
  const fogAir = { color: new THREE.Color(), near: 40, far: 280 };
  let under = false;
  function updateWorldFeel(dt) {
    const speed = dt > 0 ? player.movedThisFrame / dt : 0;
    const inWater = inPool(player.x, player.z);
    sounds.wind.setVolume(home ? 0.04 : 0.35);
    sounds.murmur.setVolume(home ? 0 : 0.35);
    sounds.room.setVolume(home ? 0.8 : 0);
    sounds.steps.setVolume(speed > 0.3 && !inWater && !ui.modalOpen ? 0.6 : 0, 0.2);
    const nowUnder = inWater && camera.position.y < POOL.water - 0.02;
    if (nowUnder !== under) {
      under = nowUnder;
      document.body.classList.toggle('underwater', under);
      if (under) {
        fogAir.color.copy(scene.fog.color);
        fogAir.near = scene.fog.near;
        fogAir.far = scene.fog.far;
        scene.fog.color.set('#0e6a8f');
        scene.fog.near = 0.5;
        scene.fog.far = 16;
      } else {
        scene.fog.color.copy(fogAir.color);
        scene.fog.near = fogAir.near;
        scene.fog.far = fogAir.far;
      }
    }
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
    updateWorldFeel(dt);
    for (const ticker of [...tickers]) ticker(dt);

    const item = !game.onAction ? interactions.update(player) : null;
    ui.setPrompt(ui.modalOpen || game.onAction ? null : item ? interactions.label() : null);

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

  sky.setTime('day');
  $('fade').classList.add('on');
  $('loading').classList.add('done');
  $('hud').hidden = false;
  started = true;
  unlock('first-steps');

  let startStep = devStep ?? 'home';
  if (resuming && !devStep) {
    const index = STEPS.indexOf(save.step);
    startStep = STEPS[Math.min(index + 1, STEPS.length - 1)];
    // The commando path continues at "commando"; a finished pool day too.
    if (save.step === 'home' && state.path === 'commando') startStep = 'commando';
    state.step = startStep;
    if (startStep !== 'home') {
      if (['commando', 'end'].includes(startStep)) {
        game.atHome(true);
        player.teleport(SPOTS.home.x - 0.4, SPOTS.home.z + 0.6, -Math.PI / 2);
      } else player.teleport(SPOTS.briefing.x, SPOTS.briefing.z, Math.PI);
      await ui.fadeIn();
      ui.toast('ממשיכים מאיפה שעצרת');
    }
  }
  if (devStep && devStep !== 'home') {
    state.path ??= '669';
    if (['commando', 'end'].includes(devStep)) game.atHome(true);
    player.teleport(SPOTS.briefing.x, SPOTS.briefing.z, Math.PI);
    await ui.fadeIn();
  }

  if (STEPS.indexOf(startStep) > STEPS.indexOf('swim')) world.setLaneRopes(false);
  preload(['whistle', 'sms', 'achievement']);
  if (import.meta.env.DEV) window.__draft = { game, player, people, advance, renderer, pending, target: () => (typeof target === 'function' ? target() : target) };

  await runFlow(game, startStep);
}

start().catch((error) => {
  console.error(error);
  $('loading').classList.remove('done');
  $('loading').querySelector('p').textContent = 'משהו השתבש בטעינה. נסו לרענן את הדף.';
});
