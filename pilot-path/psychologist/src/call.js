import * as THREE from 'three';
import { showScreen, el, button } from '../../shared/screens.js';
import { fx, speak } from '../../shared/fx.js';
import { Crowd, Person, randomLook } from '../../../shared/engine/people.js';
import { enableCloseUps } from '../../../shared/engine/detail.js';
import { canvasTexture } from '../../../shared/engine/textures.js';
import { drawIsraeliFlag } from '../../../shared/flag.js';
import { TALK, PSYCH_LINES, MISMATCH_OPTIONS, QUESTIONS_FOR_HER } from './content.js';
import { FORM_QUESTIONS } from '../../yarpa-b/src/content.js';

// The video call with the psychologist: a Zoom-like window, a live 3D psychologist in her office (the same
// close-up characters as the rest of the game), a small view of yourself, captions and your answers.
// Resolves to { scores: { honesty, motivation, resilience, team, consistency }, mismatches, flags, transcript }.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0.5);

/** The office behind her, and the person herself. Returns { render(dt), setPose, dispose }. */
function createOffice(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#b9b3a4');
  const camera = new THREE.PerspectiveCamera(30, 16 / 10, 0.1, 30);
  camera.position.set(0, 1.18, 2.15);
  camera.lookAt(0, 1.1, 0);

  const hemi = new THREE.HemisphereLight('#fff6e6', '#6d6252', 1.1);
  const key = new THREE.DirectionalLight('#fff0d4', 2.2);
  key.position.set(-2, 3, 3);
  const fill = new THREE.PointLight('#9ec4ff', 6, 8, 1.6);
  fill.position.set(2, 1.6, 2);
  scene.add(hemi, key, fill);

  // Wall, shelf with books, plant, window light and a flag.
  const wallTex = canvasTexture(512, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#d6d1c3');
    g.addColorStop(1, '#bdb6a5');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1 }));
  wall.position.set(0, 1.8, -1.6);
  scene.add(wall);
  const woodM = new THREE.MeshStandardMaterial({ color: '#6b4a2b', roughness: 0.7 });
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.05, 0.3), woodM);
  shelf.position.set(-1.0, 1.55, -1.45);
  scene.add(shelf);
  const shelf2 = shelf.clone();
  shelf2.position.y = 1.1;
  scene.add(shelf2);
  const colors = ['#7a2f2f', '#2f5a7a', '#4a6a3a', '#c9a64a', '#6a4a7a', '#d8d2c4', '#2b3140'];
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 12; i++) {
      const h = 0.2 + Math.random() * 0.12;
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.07, h, 0.2), new THREE.MeshStandardMaterial({ color: colors[(i + row * 3) % colors.length], roughness: 0.8 }));
      book.position.set(-1.65 + i * 0.1, (row ? 1.1 : 1.55) + 0.025 + h / 2, -1.45);
      scene.add(book);
    }
  }
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.28, 12), new THREE.MeshStandardMaterial({ color: '#b66a45', roughness: 0.8 }));
  pot.position.set(1.25, 0.14, -1.2);
  scene.add(pot);
  const leafM = new THREE.MeshStandardMaterial({ color: '#4c7a3a', roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.7), leafM);
    leaf.geometry.translate(0, 0.35, 0);
    leaf.position.set(1.25, 0.28, -1.2);
    leaf.rotation.set(0.25, (i / 9) * Math.PI * 2, 0.5 + (i % 3) * 0.12, 'YXZ');
    scene.add(leaf);
  }
  const windowGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.4), new THREE.MeshBasicMaterial({ color: '#f4f8ff', toneMapped: false }));
  windowGlow.position.set(1.65, 1.5, -1.55);
  scene.add(windowGlow);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.45), new THREE.MeshStandardMaterial({ map: canvasTexture(330, 240, drawIsraeliFlag) }));
  flag.position.set(0.55, 1.75, -1.55);
  scene.add(flag);
  // Desk edge in front of her and a chair behind.
  const desk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.8), woodM);
  desk.position.set(0, 0.74, 0.55);
  scene.add(desk);
  const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.08), new THREE.MeshStandardMaterial({ color: '#25282d', roughness: 0.7 }));
  chairBack.position.set(0, 0.95, -0.38);
  scene.add(chairBack);

  const crowd = new Crowd(scene);
  const person = new Person(randomLook({ shirt: '#6f8196', pants: '#3d4a5c', skin: '#d9a98a', longHair: true, hair: '#3b2a20', scale: 1.0, shortSleeves: true }), 'פסיכולוגית');
  person.place(0, 0.05, 0);
  person.setPose('sit-talk');
  crowd.add(person);
  enableCloseUps(crowd);

  function resize() {
    const w = canvas.clientWidth || 640;
    const h = canvas.clientHeight || 400;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1.2 ? 42 : 30;
    camera.updateProjectionMatrix();
  }
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  let t = 0;
  return {
    person,
    render(dt) {
      t += dt;
      // A very light camera drift, like a laptop on a desk.
      camera.position.x = Math.sin(t * 0.5) * 0.01;
      camera.position.y = 1.18 + Math.sin(t * 0.7) * 0.004;
      person.update?.(dt);
      crowd.update(dt, camera);
      renderer.render(scene, camera);
    },
    dispose() {
      observer.disconnect();
      renderer.dispose();
    },
  };
}

/** Typed caption + the psychologist's body language while she speaks. */
async function say(ui, office, lines, { hold = 700 } = {}) {
  for (const line of Array.isArray(lines) ? lines : [lines]) {
    office.person.setPose('sit-talk');
    ui.caption.textContent = '';
    ui.who.classList.add('speaking');
    speak(line, { rate: 0.98, pitch: 1.12 });
    const ms = Math.max(1100, line.length * 45);
    const start = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        const k = Math.min(1, (performance.now() - start) / ms);
        ui.caption.textContent = line.slice(0, Math.ceil(line.length * k));
        if (k >= 1) resolve();
        else requestAnimationFrame(tick);
      };
      tick();
    });
    ui.who.classList.remove('speaking');
    await wait(hold);
  }
}

async function take(office, ui, text = '…') {
  office.person.setPose('sit-type');
  ui.caption.textContent = text;
  for (let i = 0; i < 6; i++) {
    fx.key();
    await wait(110 + Math.random() * 90);
  }
  await wait(250);
}

function choose(ui, options, { cols = 1 } = {}) {
  return new Promise((resolve) => {
    ui.choices.innerHTML = '';
    ui.choices.classList.toggle('two', cols === 2);
    const order = options.map((text, index) => ({ text, index }));
    order.forEach(({ text, index }, i) => {
      const b = button(`${i + 1}. ${text}`, 'zm-choice');
      b.addEventListener('click', () => {
        document.removeEventListener('keydown', onKey);
        ui.choices.innerHTML = '';
        fx.click();
        resolve(index);
      });
      ui.choices.append(b);
    });
    const onKey = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= order.length) ui.choices.children[n - 1].click();
    };
    document.addEventListener('keydown', onKey);
  });
}

/** `answers` = the personal answers saved in ירפ״א ב׳ ({ form: {why, family, ...} }). */
export function runCall(game, { answers = {}, name = 'מועמד' } = {}) {
  const form = { why: 1, family: 1, lead: 1, strength: 0, weakness: 0, failure: 0, ...(answers.form ?? {}) };
  return showScreen(game, 'zm-screen', async (root, close, helpers) => {
    const win = el('div', 'zm-window');
    const bar = el('div', 'zm-bar');
    bar.innerHTML = '<span class="zm-lock">🔒</span><b>פגישה · חיל האוויר · ראיון</b><span class="zm-time">00:00</span><span class="zm-leave" title="בזמן אמת יוצאים בסוף השיחה">●</span>';
    const stage = el('div', 'zm-stage');
    const main = el('div', 'zm-main');
    const canvas = el('canvas', 'zm-cam');
    const who = el('div', 'zm-who');
    who.innerHTML = '<i></i><span>פסיכולוגית · חיל האוויר</span>';
    main.append(canvas, who);
    const self = el('div', 'zm-self');
    self.innerHTML = `<div class="zm-avatar"><i class="head"></i><i class="body"></i></div><span>${name} (אני)</span>`;
    const waiting = el('div', 'zm-waiting');
    waiting.innerHTML = `<div class="zm-spin"></div><p>${PSYCH_LINES.wait}</p><small>אתה בחדר ההמתנה. אפשר לבדוק מיקרופון ומצלמה.</small>`;
    stage.append(main, self, waiting);
    const caption = el('p', 'zm-caption', '');
    const choices = el('div', 'zm-choices');
    win.append(bar, stage, caption, choices);
    root.append(win);

    const ui = { caption, choices, who };
    const office = createOffice(canvas);
    helpers.onClose(() => office.dispose());
    let last = performance.now();
    let alive = true;
    helpers.onClose(() => (alive = false));
    const loop = (now) => {
      if (!alive) return;
      requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      office.render(dt);
    };
    requestAnimationFrame(loop);
    const clockEl = bar.querySelector('.zm-time');
    const started = performance.now();
    const clockTimer = setInterval(() => {
      const s = Math.floor((performance.now() - started) / 1000);
      clockEl.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }, 500);
    helpers.onClose(() => clearInterval(clockTimer));
    if (import.meta.env.DEV) root.__call = { office, ui };

    // Waiting room, then she lets you in.
    await wait(2600);
    waiting.classList.add('gone');
    fx.zoomJoin();
    await wait(700);
    await say(ui, office, PSYCH_LINES.hello);

    // Questions. We compare with the personal form of the day before.
    const scores = { motivation: [], resilience: [], team: [] };
    const checks = [];
    const mismatches = [];
    const flags = [];
    const transcript = [];
    for (const item of TALK) {
      await say(ui, office, item.q, { hold: 300 });
      const pick = await choose(ui, item.options, { cols: item.options.length > 3 ? 2 : 1 });
      transcript.push([item.q, item.options[pick]]);
      if (item.motivation) scores.motivation.push(item.motivation[pick]);
      if (item.resilience) scores.resilience.push(item.resilience[pick]);
      if (item.team) scores.team.push(item.team[pick]);
      if (item.flag?.[pick]) flags.push(item.id);
      await take(office, ui, PSYCH_LINES.note[Math.floor(Math.random() * PSYCH_LINES.note.length)]);
      if (item.form) {
        const written = form[item.form];
        const consistent = pick === written;
        checks.push(consistent ? 1 : 0);
        if (!consistent) {
          const said = FORM_QUESTIONS.find((q) => q.key === item.form).options[written];
          mismatches.push({ id: item.id, written: said, now: item.options[pick] });
          await say(ui, office, PSYCH_LINES.mismatch(`"${said}"`), { hold: 300 });
          const k = await choose(ui, MISMATCH_OPTIONS.map((o) => o.text));
          checks[checks.length - 1] = MISMATCH_OPTIONS[k].honesty;
          transcript.push(['(הבדל מהשאלון)', MISMATCH_OPTIONS[k].text]);
          await take(office, ui, 'מבין.');
        }
      }
    }
    await say(ui, office, PSYCH_LINES.closing[0], { hold: 300 });
    const ask = await choose(ui, QUESTIONS_FOR_HER.options);
    if (ask === 0) await say(ui, office, 'תקבל תשובה בטלפון בימים הקרובים. זה כל מה שאני יכולה להגיד.', { hold: 500 });
    await say(ui, office, PSYCH_LINES.closing[1]);
    fx.zoomLeave();
    await wait(800);

    const consistency = checks.length ? mean(checks) : 0.6;
    const penalty = flags.length * 0.25;
    close({
      scores: {
        consistency,
        honesty: clamp(consistency - penalty),
        motivation: mean(scores.motivation),
        resilience: clamp(mean(scores.resilience) - penalty * 0.4),
        team: mean(scores.team),
      },
      mismatches,
      flags,
      transcript,
    });
  });
}

const STYLE_ID = 'zm-style';
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .zm-screen { background: #05080f; padding: clamp(6px, 1.4vw, 18px); }
    .zm-window { display: flex; flex-direction: column; width: min(1040px, 100%); height: min(720px, 100%); border-radius: 12px; overflow: hidden; background: #14181f; box-shadow: 0 30px 80px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.1); }
    .zm-bar { display: flex; align-items: center; gap: 10px; padding: 8px 14px; background: #1c2230; color: #dfe6f3; font-size: .85rem; }
    .zm-bar b { flex: 1; font-weight: 700; }
    .zm-time { font-family: ui-monospace, Menlo, monospace; color: #9fb0d3; }
    .zm-leave { color: #ff6b6b; font-size: .7rem; }
    .zm-stage { position: relative; flex: 1; min-height: 0; background: #0b0e14; }
    .zm-main { position: absolute; inset: 0; }
    .zm-cam { width: 100%; height: 100%; display: block; object-fit: cover; }
    .zm-who { position: absolute; left: 12px; bottom: 12px; display: flex; align-items: center; gap: 8px; padding: 4px 12px; border-radius: 8px; background: rgba(0,0,0,.55); color: #fff; font-weight: 700; font-size: .85rem; }
    .zm-who i { width: 9px; height: 9px; border-radius: 50%; background: #4a5568; }
    .zm-who.speaking i { background: #34d58a; box-shadow: 0 0 8px #34d58a; }
    .zm-self { position: absolute; right: 12px; bottom: 12px; width: clamp(110px, 20%, 190px); aspect-ratio: 4 / 3; border-radius: 10px; overflow: hidden; background: linear-gradient(160deg, #2a3446, #161b25); box-shadow: 0 0 0 2px rgba(255,255,255,.18), 0 8px 24px rgba(0,0,0,.5); }
    .zm-self span { position: absolute; left: 6px; bottom: 4px; padding: 1px 7px; border-radius: 6px; background: rgba(0,0,0,.55); color: #fff; font-size: .68rem; font-weight: 700; }
    .zm-avatar { position: absolute; inset: 0; }
    .zm-avatar .head { position: absolute; left: 50%; top: 22%; width: 34%; aspect-ratio: 1; margin-left: -17%; border-radius: 50%; background: #c99a7a; }
    .zm-avatar .body { position: absolute; left: 50%; top: 62%; width: 62%; height: 60%; margin-left: -31%; border-radius: 50% 50% 0 0; background: #46618a; }
    .zm-waiting { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 10px; background: #0b0e14; color: #dfe6f3; text-align: center; transition: opacity .5s; z-index: 2; }
    .zm-waiting.gone { opacity: 0; pointer-events: none; }
    .zm-waiting p { margin: 0; font-weight: 800; font-size: 1.2rem; }
    .zm-waiting small { color: #8fa0c4; }
    .zm-spin { width: 38px; height: 38px; border-radius: 50%; border: 4px solid rgba(255,255,255,.14); border-top-color: #4ea1ff; animation: zm-spin 1s linear infinite; }
    @keyframes zm-spin { to { transform: rotate(360deg); } }
    .zm-caption { margin: 0; min-height: 3.4em; padding: 10px 18px; background: #10141c; color: #f1f5ff; font: 700 1.05rem/1.5 'Heebo', sans-serif; text-align: center; }
    .zm-choices { display: grid; gap: 8px; padding: 0 16px 14px; background: #10141c; min-height: 0; }
    .zm-choices.two { grid-template-columns: repeat(2, 1fr); }
    .zm-choices:empty { padding: 0; }
    .zm-choice { min-height: 44px; padding: 8px 14px; border-radius: 12px; background: #1b2740; color: #e8eefc; font: 600 .95rem 'Heebo', sans-serif; text-align: right; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(160,190,255,.2); transition: background .15s; }
    .zm-choice:hover { background: #274066; box-shadow: inset 0 0 0 2px #4ea1ff; }
    @media (max-width: 640px) { .zm-choices.two { grid-template-columns: 1fr; } .zm-window { height: 100%; } }
  `;
  document.head.append(style);
}
