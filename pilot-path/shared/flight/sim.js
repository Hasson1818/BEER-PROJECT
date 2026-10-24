import * as THREE from 'three';
import { showScreen, el, button, introCard } from '../screens.js';
import { engine, speak } from '../fx.js';
import { Plane, KT } from './plane.js';
import { createFlightWorld, makeJet } from './world.js';
import { createHud } from './hud.js';
import { createControls } from './input.js';
import { buildLevels } from './levels.js';

// The flight simulator room: a cockpit view on a screen, a stick and a throttle. It runs a list of levels
// (see levels.js) and resolves with how you did. The same engine serves both simulators of the pilot path.

const STYLE_ID = 'fl-style';

/**
 * runSimulator(game, { kind: 'sim1' | 'sim2', fx, startLevel? }) -> Promise<{ passed, score, levels: [{ id, title, score, note }] }>
 */
export function runSimulator(game, { kind, fx, startLevel = 0 }) {
  return showScreen(game, 'fl-screen', (root, close, helpers) => {
    injectStyle();
    start(game, root, close, helpers, { kind, fx, startLevel });
  });
}

function start(game, root, close, helpers, { kind, fx, startLevel }) {
  // ---------- DOM ----------
  const stage = el('div', 'fl-stage');
  const canvas3d = el('canvas', 'fl-3d');
  const canvasHud = el('canvas', 'fl-hud');
  const frame = el('div', 'fl-frame');
  frame.innerHTML = '<i class="fl-rail l"></i><i class="fl-rail r"></i><i class="fl-glare"></i><div class="fl-dash"><span class="fl-lamp g"></span><span class="fl-lamp a"></span><span class="fl-lamp r"></span></div>';
  const top = el('div', 'fl-top');
  const title = el('strong', 'fl-title');
  const dots = el('div', 'fl-dots');
  const clock = el('span', 'fl-clock');
  const invertBtn = button('הפוך ציר אנכי (I)', 'fl-mini');
  top.append(title, dots, clock, invertBtn);
  const cards = el('div', 'fl-cards');
  const subtitle = el('div', 'fl-subtitle');
  const overlay = el('div', 'fl-overlay');
  stage.append(canvas3d, canvasHud, frame, top, subtitle, overlay, cards);
  root.append(stage);

  // ---------- 3D ----------
  const renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, 1, 1, 32000);
  const levels = buildLevels(kind);
  const world = createFlightWorld(scene, { mountains: kind === 'sim2' ? 1 : 0, time: kind === 'sim2' ? 'afternoon' : 'day' });
  const hud = createHud(canvasHud);
  const plane = new Plane({ position: new THREE.Vector3(0, 1800, 0), speed: 125 });
  const controls = createControls(stage, { onAck: () => ctx.onAck?.(), onBomb: () => ctx.dropBomb() });
  invertBtn.addEventListener('click', () => {
    controls.setInvert(!controls.state.invert);
    invertBtn.classList.toggle('on', controls.state.invert);
  });
  invertBtn.classList.toggle('on', controls.state.invert);
  const sound = engine();

  // ---------- Things the levels use ----------
  const results = [];
  const bombs = [];
  const tracers = [];
  let enemy = null;
  let time = 0;
  let paused = true;
  let current = null;
  let message = null;
  let shake = 0;
  let hitsThisFrame = 0;
  let lastGun = 0;

  const ctx = {
    kind,
    plane,
    world,
    scene,
    camera,
    fx,
    input: controls.state,
    get enemy() {
      return enemy;
    },
    get time() {
      return time;
    },
    levelTime: 0,
    bombsLeft: 0,
    onAck: null,
    onBombHit: null,
    frameExtras: {},
    height: world.height,
    /** Place the plane (heading in degrees, alt in meters above sea, speed in knots). */
    place({ x = 0, z = 0, alt = 1800, heading = 0, speedKt = 240, throttle = null, assist = 0.7 } = {}) {
      plane.position.set(x, alt, z);
      plane.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -THREE.MathUtils.degToRad(heading));
      plane.speed = speedKt / KT;
      plane.throttle = throttle ?? THREE.MathUtils.clamp((plane.speed - plane.minSpeed) / (plane.maxSpeed - plane.minSpeed), 0, 1);
      plane.assist = assist;
      plane.rollRate = plane.pitchRate = 0;
    },
    spawnEnemy(options) {
      this.removeEnemy();
      enemy = createEnemy(scene, options);
      return enemy;
    },
    removeEnemy() {
      if (enemy) scene.remove(enemy.mesh);
      enemy = null;
    },
    say(text, { radio = false, ms = 3800, color } = {}) {
      message = { text, until: time + ms / 1000, color };
      subtitle.textContent = text;
      subtitle.classList.add('on');
      clearTimeout(subtitle._t);
      subtitle._t = setTimeout(() => subtitle.classList.remove('on'), ms);
      if (radio) {
        fx?.radio?.(Math.min(2.6, 0.5 + text.length * 0.045));
        speak(text, { rate: 1.05 });
      }
    },
    /** Show an element on top of the view for `ms` (e.g. the map you may peek at). `init(node)` can draw into it. */
    overlay(node, ms, init) {
      overlay.innerHTML = '';
      init?.(node);
      overlay.append(node);
      overlay.classList.add('on');
      clearTimeout(overlay._t);
      overlay._t = setTimeout(() => {
        overlay.classList.remove('on');
        overlay.innerHTML = '';
      }, ms);
    },
    flash(text, color) {
      message = { text, until: time + 1.6, color };
    },
    shake(amount) {
      shake = Math.max(shake, amount);
    },
    dropBomb() {
      if (ctx.bombsLeft <= 0 || paused) return;
      ctx.bombsLeft--;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), new THREE.MeshStandardMaterial({ color: '#222a30' }));
      mesh.scale.z = 2.4;
      mesh.position.copy(plane.position).add(new THREE.Vector3(0, -3, 0));
      scene.add(mesh);
      bombs.push({ mesh, velocity: plane.velocity.clone(), age: 0 });
      fx?.gearThump?.();
    },
    /** Launch a missile from a ground spot. */
    launchMissile(from) {
      const origin = new THREE.Vector3(from.x, world.height(from.x, from.z) + 30, from.z);
      const m = world.addMissile(origin, plane);
      m.velocity.copy(plane.position).sub(origin).normalize().multiplyScalar(m.speed);
      fx?.missile?.();
      return m;
    },
    puff: (...a) => world.puff(...a),
    crash(reason = 'התרסקת') {
      if (ctx.crashed) return;
      ctx.crashed = reason;
      world.puff(plane.position, { size: 120, life: 1.8, color: '#ffb25a', opacity: 0.9 });
      world.puff(plane.position, { size: 220, life: 3, color: '#444', opacity: 0.8 });
      fx?.explosion?.();
      ctx.shake(1);
    },
    crashed: null,
  };

  // ---------- Frame ----------
  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1.2 ? 84 : 72;
    camera.updateProjectionMatrix();
    hud.resize();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  resize();

  const tmpUp = new THREE.Vector3();
  const tmpF = new THREE.Vector3();
  const toEnemy = new THREE.Vector3();

  function step(dt) {
    time += dt;
    const input = controls.poll(dt);
    if (!paused) {
      ctx.levelTime += dt;
      plane.update(dt, input.stick, input.throttleInput);
    } else {
      plane.update(dt, { x: 0, y: 0 }, 0);
    }
    const ground = world.height(plane.position.x, plane.position.z);
    const agl = plane.position.y - ground;
    ctx.agl = agl;
    if (!paused && agl < 14 && !ctx.crashed) ctx.crash('התרסקת אל האדמה');
    if (ctx.crashed) plane.speed = Math.max(0, plane.speed - 60 * dt);

    if (enemy) {
      enemy.update(dt, ctx);
      toEnemy.copy(enemy.mesh.position).sub(plane.position);
      enemy.range = toEnemy.length();
      plane.forwardVector(tmpF);
      enemy.offAxis = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(tmpF.dot(toEnemy.clone().normalize()), -1, 1)));
    }

    // Guns: continuous fire when the key is held.
    hitsThisFrame = 0;
    if (input.fire && !paused && ctx.gunsOn !== false) {
      if (time - lastGun > 0.32) {
        lastGun = time;
        fx?.gun?.();
        ctx.shake(0.18);
      }
      addTracer();
      if (enemy && !enemy.destroyed && enemy.range < 1300) {
        const cone = Math.atan2(26, Math.max(120, enemy.range));
        if (THREE.MathUtils.degToRad(enemy.offAxis) < cone) {
          enemy.hitCharge = (enemy.hitCharge ?? 0) + dt * 9;
          while (enemy.hitCharge >= 1) {
            enemy.hitCharge -= 1;
            hitsThisFrame++;
            ctx.onGunHit?.(enemy);
            world.puff(enemy.mesh.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 16)), { size: 22, life: 0.5, color: '#ffd9a0' });
          }
          if (hitsThisFrame && Math.random() < 0.3) fx?.hit?.();
        }
      }
    }
    for (let i = tracers.length - 1; i >= 0; i--) {
      tracers[i].age += dt;
      tracers[i].mesh.material.opacity = Math.max(0, 1 - tracers[i].age / 0.12);
      if (tracers[i].age > 0.12) {
        scene.remove(tracers[i].mesh);
        tracers[i].mesh.geometry.dispose();
        tracers.splice(i, 1);
      }
    }

    // Bombs.
    for (let i = bombs.length - 1; i >= 0; i--) {
      const b = bombs[i];
      b.age += dt;
      b.velocity.y -= 9.81 * dt;
      b.mesh.position.addScaledVector(b.velocity, dt);
      b.mesh.lookAt(b.mesh.position.clone().add(b.velocity));
      const gy = world.height(b.mesh.position.x, b.mesh.position.z);
      if (b.mesh.position.y <= gy + 1) {
        world.puff(new THREE.Vector3(b.mesh.position.x, gy + 8, b.mesh.position.z), { size: 70, life: 1.4, color: '#ffb25a', opacity: 0.9 });
        world.puff(new THREE.Vector3(b.mesh.position.x, gy + 20, b.mesh.position.z), { size: 110, life: 2.4, color: '#555', opacity: 0.7 });
        fx?.explosion?.();
        ctx.shake(0.3);
        ctx.onBombHit?.(b.mesh.position);
        scene.remove(b.mesh);
        bombs.splice(i, 1);
      }
    }

    // Missiles.
    for (const m of world.missiles) {
      if (m.dead) continue;
      m.life += dt;
      const want = plane.position.clone().sub(m.group.position);
      const dist = want.length();
      want.normalize();
      const cur = m.velocity.clone().normalize();
      const angle = Math.acos(THREE.MathUtils.clamp(cur.dot(want), -1, 1));
      const turn = Math.min(angle, 0.62 * dt * (m.life < 1.2 ? 0.4 : 1));
      if (angle > 1e-4) cur.lerp(want, turn / angle).normalize();
      m.velocity.copy(cur).multiplyScalar(m.speed);
      m.group.position.addScaledVector(m.velocity, dt);
      m.group.lookAt(m.group.position.clone().add(m.velocity));
      if (Math.floor(m.life * 20) !== Math.floor((m.life - dt) * 20)) world.puff(m.group.position, { size: 18, life: 1.6, color: '#ffffff', opacity: 0.55 });
      m.distance = dist;
      if (dist < 32 && !ctx.crashed) {
        m.dead = true;
        scene.remove(m.group);
        world.puff(m.group.position, { size: 90, life: 1.2, color: '#ffb25a', opacity: 0.9 });
        fx?.explosion?.();
        ctx.shake(0.9);
        ctx.onMissileHit?.(m);
      } else if (m.life > 16 || (m.life > 3 && dist > 2600) || m.group.position.y < world.height(m.group.position.x, m.group.position.z)) {
        m.dead = true;
        scene.remove(m.group);
        ctx.onMissileGone?.(m, dist);
      } else if (m.life > 2.2 && dist < 220 && m.prevDist !== undefined && dist > m.prevDist) {
        // It passed by: evaded.
        m.dead = true;
        scene.remove(m.group);
        ctx.onMissileGone?.(m, dist);
      }
      m.prevDist = dist;
    }

    if (current && !paused && !ctx.finished) current.update(ctx, dt);

    // Camera and sound.
    plane.upVector(tmpUp);
    camera.position.copy(plane.position).addScaledVector(tmpUp, 1.1);
    camera.quaternion.copy(plane.quaternion);
    shake = Math.max(0, shake - dt * 1.4);
    const s = shake * 0.8 + Math.max(0, plane.gLoad - 3) * 0.03;
    if (s > 0.001) camera.position.add(new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s));
    world.update(dt, camera, time);
    sound.set(plane.throttle, Math.min(1, plane.speed / 280));
  }

  function addTracer() {
    const from = plane.position.clone().addScaledVector(plane.forwardVector(new THREE.Vector3()), 20).add(plane.upVector(new THREE.Vector3()).multiplyScalar(-2));
    const to = from.clone().addScaledVector(plane.forwardVector(new THREE.Vector3()), 1800);
    const g = new THREE.BufferGeometry().setFromPoints([from, to]);
    const mesh = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#ffe9a0', transparent: true, opacity: 1, toneMapped: false, fog: false }));
    scene.add(mesh);
    tracers.push({ mesh, age: 0 });
  }

  function draw() {
    renderer.render(scene, camera);
    const f = {
      plane,
      camera,
      time,
      throttle: plane.throttle,
      warnings: {
        lowAlt: !paused && !ctx.crashed && ctx.agl < 220 && plane.velocity.y < 6 && ctx.agl < 200,
        stall: plane.stall && !paused,
        missile: world.missiles.find((m) => !m.dead)?.group.position ?? null,
      },
      message: message && message.until > time ? { text: message.text, color: message.color } : null,
      ...(current?.hud ? current.hud(ctx) : {}),
      ...ctx.frameExtras,
    };
    if (enemy && !enemy.destroyed && f.enemy === undefined && !current?.hideEnemyMark) {
      f.enemy = { position: enemy.mesh.position, range: enemy.range };
    }
    hud.draw(f);
    clock.textContent = paused ? '' : `${Math.max(0, Math.ceil((current?.limit ?? 0) - ctx.levelTime))} שנ׳`;
  }

  let last = performance.now();
  let raf = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    step(dt);
    draw();
  }
  raf = requestAnimationFrame(loop);

  // For tests: run N seconds of simulation without waiting for real time.
  if (import.meta.env.DEV) {
    root.__sim = {
      ctx,
      plane,
      advance(seconds) {
        for (let i = 0; i < seconds * 30; i++) step(1 / 30);
        draw();
      },
      get level() {
        return current;
      },
      levels,
      controls,
    };
  }

  // ---------- Running the levels ----------
  function setDots(index) {
    dots.innerHTML = '';
    levels.forEach((l, i) => {
      const d = el('i', i < index ? 'done' : i === index ? 'on' : '');
      d.title = l.title;
      dots.append(d);
    });
  }

  async function brief(level, index) {
    paused = true;
    cards.innerHTML = '';
    const holder = el('div', 'fl-card');
    cards.append(holder);
    cards.classList.add('on');
    await introCard(holder, {
      eyebrow: `${kind === 'sim1' ? 'סימולטור ראשון' : 'סימולטור שני'} · שלב ${index + 1} מתוך ${levels.length}`,
      title: level.title,
      lines: level.brief,
      keys: level.keys ?? [],
      practice: false,
      startLabel: 'מתחילים',
      note: level.note,
      extra: level.briefExtra?.(),
    });
    cards.classList.remove('on');
    cards.innerHTML = '';
  }

  async function summary(res) {
    paused = true;
    cards.innerHTML = '';
    const holder = el('div', 'fl-card');
    cards.append(holder);
    cards.classList.add('on');
    const card = el('div', 'pp-intro');
    card.append(el('p', 'pp-eyebrow', 'סיום הסימולטור'), el('h2', 'pp-title', res.passed ? 'סיימת את הסימולטור' : 'הסימולטור הסתיים'));
    const list = el('ul', 'fl-results');
    for (const r of res.levels) {
      const li = el('li');
      li.append(el('span', '', r.title));
      const bar = el('div', 'pp-bar');
      const fill = el('i');
      fill.style.width = `${Math.round(r.score * 100)}%`;
      bar.append(fill);
      li.append(bar, el('b', '', `${Math.round(r.score * 100)}%`));
      list.append(li);
    }
    card.append(list);
    const go = button('המשך');
    const row = el('div', 'pp-actions');
    row.append(go);
    card.append(row);
    holder.append(card);
    go.focus();
    await new Promise((resolve) => go.addEventListener('click', () => (fx?.click?.(), resolve())));
    cards.classList.remove('on');
    cards.innerHTML = '';
  }

  (async () => {
    for (let i = startLevel; i < levels.length; i++) {
      const level = levels[i];
      current = null;
      ctx.crashed = null;
      ctx.onAck = null;
      ctx.onBombHit = ctx.onGunHit = ctx.onMissileHit = ctx.onMissileGone = null;
      ctx.frameExtras = {};
      ctx.gunsOn = true;
      ctx.bombsLeft = 0;
      world.clearDynamic();
      ctx.removeEnemy();
      title.textContent = level.title;
      setDots(i);
      level.setup(ctx);
      for (let k = 0; k < 12; k++) step(1 / 30); // settle the view behind the card
      await brief(level, i);
      ctx.levelTime = 0;
      current = level;
      paused = false;
      level.begin?.(ctx);
      ctx.finished = false;
      const outcome = await new Promise((resolve) => {
        ctx.finish = (o) => {
          if (ctx.finished) return;
          ctx.finished = true;
          resolve(o);
        };
      });
      paused = true;
      const score = THREE.MathUtils.clamp(level.score(ctx, outcome), 0, 1);
      results.push({ id: level.id, title: level.title, score, note: outcome?.note ?? '' });
      current = null;
      if (outcome?.sound === 'done') fx?.done?.();
      await new Promise((r) => setTimeout(r, 650));
    }
    const mean = results.reduce((a, r) => a + r.score, 0) / results.length;
    const out = { passed: mean >= 0.5, score: mean, levels: results };
    await summary(out);
    cancelAnimationFrame(raf);
    sound.stop();
    controls.dispose();
    resizeObserver.disconnect();
    renderer.dispose();
    close(out);
  })();

  helpers.onClose(() => {
    cancelAnimationFrame(raf);
    sound.stop();
    controls.dispose();
    resizeObserver.disconnect();
  });
}

// ---------- The other aircraft ----------

/**
 * A scripted aircraft. `script(t, e)` may set e.targetHeading (deg), e.targetPitch (deg), e.targetSpeed (m/s),
 * and e.evade. Position, bank and flames follow smoothly.
 */
function createEnemy(scene, { position, heading = 0, speed = 120, color = '#8d97a3', accent = '#b3322a', script = null, scale = 2.4 } = {}) {
  const mesh = makeJet({ body: color, accent, scale });
  mesh.position.copy(position);
  scene.add(mesh);
  const e = {
    mesh,
    heading: THREE.MathUtils.degToRad(heading),
    pitch: 0,
    bank: 0,
    speed,
    targetHeading: heading,
    targetPitch: 0,
    targetSpeed: speed,
    t: 0,
    range: 0,
    offAxis: 0,
    destroyed: false,
    script,
    update(dt, ctx) {
      this.t += dt;
      if (this.destroyed) {
        this.mesh.position.y -= 60 * dt;
        this.mesh.rotation.z += dt * 3;
        if (this.t - this.destroyedAt < 3 && Math.random() < 0.5) ctx.world.puff(this.mesh.position, { size: 36, life: 1.4, color: '#333', opacity: 0.7 });
        return;
      }
      this.script?.(this.t, this, ctx);
      const target = THREE.MathUtils.degToRad(this.targetHeading);
      let diff = ((target - this.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const turnRate = THREE.MathUtils.clamp(diff * 1.2, -0.38, 0.38);
      this.heading += turnRate * dt;
      this.bank += (THREE.MathUtils.clamp(turnRate * 2.6, -0.9, 0.9) - this.bank) * Math.min(1, dt * 3);
      this.pitch += (THREE.MathUtils.degToRad(this.targetPitch) - this.pitch) * Math.min(1, dt * 1.4);
      this.speed += (this.targetSpeed - this.speed) * Math.min(1, dt * 0.6);
      const dir = new THREE.Vector3(Math.sin(this.heading) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.heading) * Math.cos(this.pitch));
      this.mesh.position.addScaledVector(dir, this.speed * dt);
      this.mesh.quaternion.setFromEuler(new THREE.Euler(this.pitch, -this.heading, 0, 'YXZ'));
      this.mesh.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, -1), this.bank));
      this.puffTimer = (this.puffTimer ?? 0) - dt;
      if (this.puffTimer <= 0) {
        this.puffTimer = 0.07;
        const tail = this.mesh.position.clone().addScaledVector(dir, -22);
        ctx.world.puff(tail, { size: 14, life: 2.6, color: '#ffffff', opacity: 0.4 });
      }
      const flame = this.mesh.getObjectByName('flame');
      if (flame) flame.scale.z = 0.8 + Math.sin(this.t * 40) * 0.2 + (this.speed / 160) * 0.4;
      const ground = ctx.height(this.mesh.position.x, this.mesh.position.z);
      if (this.mesh.position.y < ground + 160) this.targetPitch = Math.max(this.targetPitch, 12);
    },
    explode(ctx) {
      this.destroyed = true;
      this.destroyedAt = this.t;
      ctx.world.puff(this.mesh.position, { size: 140, life: 1.6, color: '#ffb25a', opacity: 0.95 });
      ctx.fx?.explosion?.();
    },
  };
  return e;
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .fl-screen { padding: 0; background: #05080f; }
    .fl-stage { position: relative; width: 100%; height: 100%; overflow: hidden; touch-action: none; user-select: none; }
    .fl-3d, .fl-hud { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .fl-hud { pointer-events: none; }
    .fl-frame { position: absolute; inset: 0; pointer-events: none; }
    .fl-rail { position: absolute; top: 0; bottom: 0; width: 7%; background: linear-gradient(90deg, rgba(5,8,14,.96), rgba(5,8,14,0)); }
    .fl-rail.l { left: 0; }
    .fl-rail.r { right: 0; transform: scaleX(-1); }
    .fl-glare { position: absolute; left: 0; right: 0; bottom: 0; height: 15%; background: linear-gradient(0deg, rgba(5,8,14,.97) 0, rgba(5,8,14,.85) 55%, rgba(5,8,14,0) 100%); }
    .fl-dash { position: absolute; left: 50%; bottom: 10px; display: flex; gap: 12px; transform: translateX(-50%); }
    .fl-lamp { width: 9px; height: 9px; border-radius: 50%; background: #1c2a22; box-shadow: 0 0 0 1px #000; }
    .fl-lamp.g { background: #34d58a; box-shadow: 0 0 8px #34d58a; }
    .fl-lamp.a { background: #5a4410; }
    .fl-lamp.r { background: #4a1414; }
    .fl-top { position: absolute; top: 10px; left: 14px; right: 14px; display: flex; align-items: center; gap: 14px; color: #bfe6cf; font: 700 .9rem 'Heebo', sans-serif; pointer-events: none; }
    .fl-top .fl-mini { pointer-events: auto; margin-inline-start: auto; padding: 4px 12px; border-radius: 999px; background: rgba(10,26,18,.7); color: #bfe6cf; font: 700 .75rem 'Heebo', sans-serif; box-shadow: inset 0 0 0 1px rgba(125,255,176,.35); cursor: pointer; }
    .fl-top .fl-mini.on { background: #2a6a4a; }
    .fl-dots { display: flex; gap: 6px; }
    .fl-dots i { width: 9px; height: 9px; border-radius: 50%; background: rgba(255,255,255,.2); }
    .fl-dots i.on { background: #ffc857; box-shadow: 0 0 8px #ffc857; }
    .fl-dots i.done { background: #34d58a; }
    .fl-clock { font-family: ui-monospace, Menlo, monospace; color: #7dffb0; }
    .fl-subtitle { position: absolute; left: 50%; bottom: 22%; max-width: min(720px, 86%); transform: translate(-50%, 10px); padding: 8px 18px; border-radius: 10px; background: rgba(5,18,12,.82); color: #d6ffe6; font: 700 1.05rem 'Heebo', sans-serif; text-align: center; opacity: 0; transition: opacity .25s, transform .25s; pointer-events: none; box-shadow: inset 0 0 0 1px rgba(125,255,176,.4); }
    .fl-subtitle.on { opacity: 1; transform: translate(-50%, 0); }
    .fl-overlay { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(4,8,16,.7); pointer-events: none; }
    .fl-overlay.on { display: flex; }
    .fl-cards { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; padding: 16px; background: rgba(4,8,16,.62); backdrop-filter: blur(3px); }
    .fl-cards.on { display: flex; }
    .fl-card { width: min(680px, 100%); max-height: 100%; overflow: auto; padding: 22px 26px; border-radius: 18px; background: rgba(14,24,44,.94); color: var(--pp-text); box-shadow: inset 0 0 0 1px var(--pp-line), 0 30px 80px rgba(0,0,0,.6); }
    .fl-results { display: grid; gap: 8px; margin: 12px 0 4px; padding: 0; list-style: none; }
    .fl-results li { display: grid; grid-template-columns: 1fr 120px 44px; align-items: center; gap: 10px; }
    .fl-touch { position: absolute; inset: auto 0 0 0; height: 40%; pointer-events: none; }
    .fl-touch > * { pointer-events: auto; position: absolute; }
    .fl-pad { left: 18px; bottom: 22px; width: 130px; height: 130px; border-radius: 50%; background: rgba(125,255,176,.08); box-shadow: inset 0 0 0 2px rgba(125,255,176,.4); }
    .fl-pad i { position: absolute; left: 50%; top: 50%; width: 52px; height: 52px; margin: -26px; border-radius: 50%; background: rgba(125,255,176,.5); }
    .fl-throttle { right: 16px; bottom: 22px; width: 54px; height: 150px; border-radius: 30px; background: rgba(125,255,176,.08); box-shadow: inset 0 0 0 2px rgba(125,255,176,.4); --v: 0; }
    .fl-throttle b { position: absolute; left: 6px; right: 6px; top: calc(50% - var(--v) * 45%); height: 18px; margin-top: -9px; border-radius: 9px; background: rgba(125,255,176,.7); }
    .fl-throttle span { position: absolute; top: -18px; left: 0; right: 0; text-align: center; font: 700 .65rem 'Heebo', sans-serif; color: #bfe6cf; }
    .fl-buttons { right: 84px; bottom: 22px; display: grid; gap: 8px; }
    .fl-buttons button { min-width: 74px; min-height: 40px; border-radius: 999px; background: rgba(255,200,87,.85); color: #2b2203; font: 800 .9rem 'Heebo', sans-serif; }
  `;
  document.head.append(style);
}
