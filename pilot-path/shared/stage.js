import '../../shared/engine/game.css';
import '../../shared/engine/field.css';
import './pilot.css';
import * as THREE from 'three';
import { createSky } from '../../shared/engine/sky.js';
import { Crowd } from '../../shared/engine/people.js';
import { enableCloseUps } from '../../shared/engine/detail.js';
import { mountMuteButton } from '../../shared/engine/sound.js';
import { Player } from '../../shared/engine/player.js';
import { Interactions } from '../../shared/engine/interactions.js';
import { createUI } from '../../shared/engine/ui.js';
import { unlock } from '../../shared/achievements.js';
import { loadPartSave, writePartSave, clearPartSave } from './progress.js';

const $ = (id) => document.getElementById(id);

async function loadFonts() {
  const fonts = ['400 32px Heebo', '500 32px Heebo', '700 32px Heebo', '800 32px Heebo', '32px "Secular One"'];
  try {
    await Promise.race([Promise.all(fonts.map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 3500))]);
  } catch {
    // Fall back to system fonts.
  }
}

const HITBOX_MATERIAL = new THREE.MeshBasicMaterial({ visible: false });

/**
 * The common part of every first-person stage in המסלול לטיס: renderer, camera, player, sky, UI, the
 * interaction prompt, touch controls, the frame loop, and the helpers the stage scripts use
 * (waitInteract, waitZone, hitboxes, a saved step so a refresh doesn't restart the part).
 *
 * options: { id, name, buildWorld(scene) -> world, createPeople?(crowd, world) -> people, time?, fogFar?, onFrame?(dt, elapsed, game) }
 */
export async function createStage(options) {
  const { id, name } = options;
  const params = new URLSearchParams(window.location.search);
  const fresh = params.has('new');
  if (fresh) clearPartSave(id);
  const save = fresh ? null : loadPartSave(id);
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

  const world = options.buildWorld(scene);
  const sky = createSky(scene, world.floodlights ?? { setPower() {} });
  sky.setTime(options.time ?? 'day');
  if (options.fogFar && scene.fog) scene.fog.far = options.fogFar;
  const crowd = new Crowd(scene);
  enableCloseUps(crowd);
  const player = new Player(camera, canvas, world, crowd);
  const interactions = new Interactions(camera, world);
  const people = options.createPeople ? options.createPeople(crowd, world) : {};

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

  // ---------- Game helpers ----------

  const state = { ...(save?.state ?? {}) };
  const pending = new Map();
  const tickers = new Set();
  const frameHooks = [];
  let target = null;
  let elapsed = 0;
  let minutes = 0;

  const game = {
    id,
    name,
    scene,
    camera,
    renderer,
    canvas,
    ui,
    player,
    people,
    world,
    sky,
    crowd,
    interactions,
    state,
    pending,
    frameHooks,
    renderPaused: false,
    get elapsed() {
      return elapsed;
    },
    hud: {
      setLabel(text) {
        $('day').textContent = text;
      },
    },
    setClock(label, m) {
      if (label !== undefined) $('day').textContent = label;
      if (m !== undefined) {
        minutes = m;
        ui.setClock(minutes);
      }
    },
    addMinutes(m) {
      minutes += m;
      ui.setClock(minutes);
    },
    setTarget(next) {
      target = next;
    },
    getTarget: () => (typeof target === 'function' ? target() : target),
    waitInteract(key) {
      return new Promise((resolve) => pending.set(key, resolve));
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
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    save(step) {
      writePartSave(id, step, { ...state });
    },
    clearSave() {
      clearPartSave(id);
    },
    /** Invisible box the crosshair can hit: for furniture, screens, machines. */
    hitbox(x, y, z, sx, sy, sz, item) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), HITBOX_MATERIAL);
      mesh.position.set(x, y, z);
      scene.add(mesh);
      return interactions.add({ ...item, object: mesh });
    },
    /** Resolves what the story is waiting for on `key` (a thing in the world); false if it isn't waiting. */
    trigger(key) {
      const resolve = pending.get(key);
      if (!resolve) return false;
      pending.delete(key);
      resolve();
      return true;
    },
    /** What happens when the player uses `key`: the story is waiting for it, or `fallback` says a line. */
    handle(key, person, fallback) {
      const resolve = pending.get(key);
      if (resolve) {
        pending.delete(key);
        resolve();
        return;
      }
      const line = typeof fallback === 'function' ? fallback() : fallback;
      if (!line || !person) return;
      const release = ui.holdModal();
      player.faceTowards(person.position.x, person.position.z, person.position.y + 1.5);
      ui.talk(person.name, line).finally(release);
    },
    /** Let people be talked to: `lines[key]` is a string or a function. */
    makeTalkable(list, lines = {}) {
      for (const [key, person] of Object.entries(list)) {
        interactions.add({
          id: key,
          object: person.hitbox,
          label: `לפנות ל${person.name.replace(/^ה/, '')}`,
          priority: () => pending.has(key),
          onInteract: () => game.handle(key, person, lines[key]),
        });
      }
    },
    /** Sit on a chair in the world; `seat` = { x, z, yaw }. */
    sitAt(seat, facing) {
      player.sit({ ...seat, exit: seat.exit ?? { x: seat.x, z: seat.z + 0.9 } }, facing);
    },
  };

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
  mountMuteButton();

  // ---------- Loop ----------

  let last = performance.now();
  function frame(now) {
    const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
    last = Math.max(last, now);
    elapsed += dt;

    player.update(dt);
    crowd.update(dt, camera);
    world.update?.(elapsed, dt);
    sky.update(camera);
    options.onFrame?.(dt, elapsed, game);
    for (const hook of frameHooks) hook(dt, elapsed);
    for (const ticker of [...tickers]) ticker(dt);

    const item = interactions.update(player);
    ui.setPrompt(ui.modalOpen ? null : item ? interactions.label() : null);

    const t = typeof target === 'function' ? target() : target;
    marker.visible = Boolean(t) && !ui.modalOpen;
    if (t) {
      marker.position.set(t.x, (t.y ?? 2.4) + Math.sin(elapsed * 3) * 0.1, t.z);
      marker.rotation.y = elapsed * 2;
    }
    if (!game.renderPaused) renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(frame);
  game.advance = (seconds) => {
    for (let i = 0; i < seconds * 20; i++) frame(last + 50);
  };

  // ---------- Start ----------

  game.begin = () => {
    $('fade').classList.add('on');
    $('loading').classList.add('done');
    $('hud').hidden = false;
    started = true;
    unlock('first-steps');
    updateOverlay();
  };
  game.resume = { save, devStep };
  if (import.meta.env.DEV) window.__stage = game;
  return game;
}

/** Show an error on the loading card when the stage fails to start. */
export function failToLoad(error) {
  console.error(error);
  const loading = $('loading');
  loading.classList.remove('done');
  loading.querySelector('p').textContent = 'משהו השתבש בטעינה. נסו לרענן את הדף.';
}

/** Run the steps of a part one after another; a broken step doesn't end the run. */
export async function runSteps(game, handlers, order, startStep) {
  let i = Math.max(0, order.indexOf(startStep));
  game.jumpTo = (step) => {
    i = order.indexOf(step) - 1;
  };
  for (; i < order.length; i++) {
    const step = order[i];
    game.state.step = step;
    try {
      await handlers[step](game);
    } catch (error) {
      console.error(`step "${step}" failed`, error);
      game.ui.releaseAll?.();
      game.player.standUp?.(false);
      game.setTarget(null);
      document.querySelectorAll('.pp-screen').forEach((el) => el.remove());
      game.ui.toast('משהו השתבש בחלק הזה, ממשיכים הלאה', 3000);
      game.save(step);
    }
  }
}

/** The step to start from: a dev-time `?step=`, the saved one (the next after it), or the first. */
export function pickStart(game, order) {
  const { save, devStep } = game.resume;
  if (devStep && order.includes(devStep)) return devStep;
  if (save) {
    const index = order.indexOf(save.step);
    if (index >= 0) {
      game.ui.toast('ממשיכים מאיפה שעצרת');
      return order[Math.min(index + 1, order.length - 1)];
    }
  }
  return order[0];
}
