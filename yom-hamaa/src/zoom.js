import * as THREE from 'three';
import { showScreen, el, button } from '../../pilot-path/shared/screens.js';
import { fx, speak } from '../../pilot-path/shared/fx.js';
import { Crowd, Person, randomLook } from '../../shared/engine/people.js';
import { enableCloseUps } from '../../shared/engine/detail.js';
import { canvasTexture } from '../../shared/engine/textures.js';

// A Zoom gallery: every participant sits in their own room, drawn live in 3D with the same characters as the
// rest of the game. One renderer draws all the squares (scissor), the names and the "speaking" frames are HTML.
// The script of the day runs inside: say(), choose(), chat(), share() and a 1-on-1 layout for the simulations.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const WALLS = ['#d8d2c4', '#c9d6df', '#e3d5c5', '#cfd9c5', '#d9c9d6', '#c5cbd9', '#e0dccb', '#bfc9c2'];

function makeRooms(canvas, members) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setScissorTest(true);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b0e14');
  scene.add(new THREE.HemisphereLight('#fff6e6', '#6d6252', 1.15));
  const key = new THREE.DirectionalLight('#fff0d4', 2.0);
  key.position.set(-2, 3, 4);
  scene.add(key);
  const crowd = new Crowd(scene);
  const center = new THREE.PerspectiveCamera(30, 1, 0.1, 40);
  center.position.set(0, 1.2, 3);

  const rooms = members.map((m, i) => {
    const x = (i - (members.length - 1) / 2) * 3.2;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.6), new THREE.MeshStandardMaterial({ color: WALLS[i % WALLS.length], roughness: 1 }));
    wall.position.set(x, 1.3, -0.9);
    scene.add(wall);
    // Something on the wall behind them: a picture, a shelf or a window.
    const kind = i % 3;
    if (kind === 0) {
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.4), new THREE.MeshStandardMaterial({ map: canvasTexture(128, 96, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, `hsl(${(i * 67) % 360}, 45%, 55%)`);
        g.addColorStop(1, `hsl(${(i * 67 + 120) % 360}, 45%, 35%)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }) }));
      pic.position.set(x + 0.5, 1.6, -0.88);
      scene.add(pic);
    } else if (kind === 1) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.2), new THREE.MeshStandardMaterial({ color: '#7a5a3a' }));
      shelf.position.set(x - 0.45, 1.55, -0.8);
      scene.add(shelf);
      for (let b = 0; b < 6; b++) {
        const book = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2 + (b % 3) * 0.04, 0.16), new THREE.MeshStandardMaterial({ color: ['#7a2f2f', '#2f5a7a', '#4a6a3a', '#c9a64a'][b % 4] }));
        book.position.set(x - 0.8 + b * 0.09, 1.68, -0.8);
        scene.add(book);
      }
    } else {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.8), new THREE.MeshBasicMaterial({ color: '#eef6ff', toneMapped: false }));
      win.position.set(x + 0.55, 1.55, -0.88);
      scene.add(win);
    }
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.08), new THREE.MeshStandardMaterial({ color: '#25282d', roughness: 0.7 }));
    chair.position.set(x, 0.9, -0.42);
    scene.add(chair);
    let person = null;
    if (!m.cameraOff) {
      person = crowd.add(new Person(randomLook({ shortSleeves: true, ...(m.look ?? {}) }), m.name));
      person.place(x, -0.05, 0, 0);
      person.setPose(m.pose ?? 'sit');
    }
    const camera = new THREE.PerspectiveCamera(30, 4 / 3, 0.1, 20);
    camera.position.set(x + (Math.random() - 0.5) * 0.12, 1.15, 1.6);
    camera.lookAt(x, 1.02, 0);
    return { ...m, person, camera, x };
  });
  enableCloseUps(crowd);

  let t = 0;
  return {
    rooms,
    /** `tiles`: [{ room, rect }] in CSS pixels relative to the canvas. */
    render(dt, tiles) {
      t += dt;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) renderer.setSize(w, h, false);
      for (const r of rooms) r.person?.update(dt);
      crowd.update(dt, center);
      renderer.setScissor(0, 0, w, h);
      renderer.setViewport(0, 0, w, h);
      renderer.clear();
      for (const { room, rect } of tiles) {
        if (!room.person) continue;
        const y = h - rect.y - rect.h;
        renderer.setViewport(rect.x, y, rect.w, rect.h);
        renderer.setScissor(rect.x, y, rect.w, rect.h);
        room.camera.aspect = rect.w / rect.h;
        room.camera.fov = room.camera.aspect < 1 ? 40 : 28;
        room.camera.updateProjectionMatrix();
        room.camera.position.y = 1.15 + Math.sin(t * 0.6 + room.x) * 0.004;
        renderer.render(scene, room.camera);
      }
    },
    dispose() {
      renderer.dispose();
    },
  };
}

/**
 * Opens the call and runs `script(api)` inside it. Resolves with what the script returns.
 * members: [{ id, name, look?, cameraOff?, role? }]; the one with id 'me' is you.
 */
export function zoomSession(game, { title, members }, script) {
  return showScreen(game, 'zg-screen', async (root, close, helpers) => {
    const win = el('div', 'zg-window');
    const bar = el('div', 'zg-bar');
    bar.innerHTML = `<span>🔒</span><b></b><span class="zg-time">00:00</span><span class="zg-rec">● מוקלט? לא ידוע</span>`;
    bar.querySelector('b').textContent = title;
    const main = el('div', 'zg-main');
    const stage = el('div', 'zg-stage');
    const canvas = el('canvas', 'zg-canvas');
    const grid = el('div', 'zg-grid');
    const share = el('div', 'zg-share');
    share.hidden = true;
    stage.append(canvas, grid, share);
    const side = el('div', 'zg-chat');
    side.append(el('p', 'zg-chat-title', 'צ׳אט'));
    const chatLog = el('div', 'zg-chat-log');
    side.append(chatLog);
    main.append(stage, side);
    const caption = el('p', 'zg-caption', '');
    const choices = el('div', 'zg-choices');
    win.append(bar, main, caption, choices);
    root.append(win);

    const rooms = makeRooms(canvas, members);
    helpers.onClose(() => rooms.dispose());
    const tileFor = new Map();
    for (const room of rooms.rooms) {
      const tile = el('div', `zg-tile${room.cameraOff ? ' off' : ''}`);
      if (room.cameraOff) tile.append(el('div', 'zg-initial', room.name.slice(0, 1)));
      tile.append(el('span', 'zg-name', room.id === 'me' ? `${room.name} (אני)` : room.name));
      tile.dataset.id = room.id;
      grid.append(tile);
      tileFor.set(room.id, { tile, room });
    }
    let visible = rooms.rooms.map((r) => r.id);
    const layout = (ids) => {
      visible = ids;
      for (const [id, { tile }] of tileFor) tile.hidden = !ids.includes(id);
      grid.classList.toggle('duo', ids.length <= 2);
    };
    layout(visible);

    let alive = true;
    helpers.onClose(() => (alive = false));
    let last = performance.now();
    const loop = (now) => {
      if (!alive) return;
      requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const base = canvas.getBoundingClientRect();
      const tiles = [];
      if (share.hidden) {
        for (const id of visible) {
          const { tile, room } = tileFor.get(id);
          const r = tile.getBoundingClientRect();
          tiles.push({ room, rect: { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height } });
        }
      }
      rooms.render(dt, tiles);
    };
    requestAnimationFrame(loop);
    const clockEl = bar.querySelector('.zg-time');
    const started = performance.now();
    const clockTimer = setInterval(() => {
      const s = Math.floor((performance.now() - started) / 1000);
      clockEl.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }, 500);
    helpers.onClose(() => clearInterval(clockTimer));

    const api = {
      rooms: rooms.rooms,
      layout,
      /** One line, typed out, with the speaker's square lit and their character talking. */
      async say(id, text, { voice = false, hold = 500 } = {}) {
        const entry = tileFor.get(id);
        const name = entry?.room.name ?? id;
        entry?.tile.classList.add('speaking');
        entry?.room.person?.setPose('sit-talk');
        if (voice) speak(text, { rate: 1, pitch: 1.1 });
        // In development a test bot can set window.__maaFast to skip the reading time.
        const fast = import.meta.env.DEV && window.__maaFast ? 0.08 : 1;
        const ms = Math.max(900, text.length * 38) * fast;
        const start = performance.now();
        await new Promise((resolve) => {
          const tick = () => {
            const k = Math.min(1, (performance.now() - start) / ms);
            caption.innerHTML = '';
            caption.append(el('b', '', `${name}: `), text.slice(0, Math.ceil(text.length * k)));
            if (k >= 1) resolve();
            // A timer, not requestAnimationFrame: that one stops when the tab is in the background.
            else setTimeout(tick, 30);
          };
          tick();
        });
        entry?.tile.classList.remove('speaking');
        entry?.room.person?.setPose(entry.room.pose ?? 'sit');
        await wait(hold * fast);
      },
      /** Your answer: resolves to the index. */
      choose(options, prompt = '') {
        if (prompt) {
          caption.innerHTML = '';
          caption.append(el('i', '', prompt));
        }
        return new Promise((resolve) => {
          choices.innerHTML = '';
          const buttons = options.map((text, i) => {
            const b = button(`${i + 1}. ${text}`, 'zg-choice');
            b.addEventListener('click', () => {
              document.removeEventListener('keydown', onKey);
              choices.innerHTML = '';
              fx.click();
              const me = tileFor.get('me');
              me?.tile.classList.add('speaking');
              setTimeout(() => me?.tile.classList.remove('speaking'), 900);
              resolve(i);
            });
            choices.append(b);
            return b;
          });
          const onKey = (e) => {
            const n = Number(e.key);
            if (n >= 1 && n <= buttons.length) buttons[n - 1].click();
          };
          document.addEventListener('keydown', onKey);
        });
      },
      chat(from, text, { mine = false } = {}) {
        const line = el('p', `zg-msg${mine ? ' mine' : ''}`);
        line.append(el('b', '', from), el('span', '', text));
        chatLog.append(line);
        chatLog.scrollTop = chatLog.scrollHeight;
        fx.tick?.();
      },
      /** A button in the chat that has to be clicked within `seconds`; resolves to true if it was. */
      waitChatButton(label, seconds) {
        return new Promise((resolve) => {
          const b = button(label, 'zg-chat-btn');
          chatLog.append(b);
          chatLog.scrollTop = chatLog.scrollHeight;
          const timer = setTimeout(() => {
            b.disabled = true;
            resolve(false);
          }, seconds * 1000);
          b.addEventListener('click', () => {
            clearTimeout(timer);
            b.disabled = true;
            fx.click();
            resolve(true);
          });
        });
      },
      /** Share a slide (or anything) over the gallery; pass null to stop sharing. */
      share(node) {
        share.innerHTML = '';
        share.hidden = !node;
        if (node) share.append(node);
      },
      caption(text) {
        caption.textContent = text;
      },
      /** A card over the call (instructions, a short task); `build(card, done)`. */
      card(build) {
        return new Promise((resolve) => {
          const card = el('div', 'zg-card');
          stage.append(card);
          build(card, (value) => {
            card.remove();
            resolve(value);
          });
        });
      },
    };
    if (import.meta.env.DEV) root.__zoom = api;
    const result = await script(api);
    fx.zoomLeave?.();
    await wait(500);
    close(result);
  });
}

const STYLE_ID = 'zg-style';
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .zg-screen { background: #05080f; padding: clamp(6px, 1.2vw, 16px); }
    .zg-window { display: flex; flex-direction: column; width: min(1180px, 100%); height: min(760px, 100%); border-radius: 12px; overflow: hidden; background: #14181f; box-shadow: 0 30px 80px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.1); }
    .zg-bar { display: flex; align-items: center; gap: 10px; padding: 8px 14px; background: #1c2230; color: #dfe6f3; font-size: .85rem; }
    .zg-bar b { flex: 1; }
    .zg-time { font-family: ui-monospace, Menlo, monospace; color: #9fb0d3; }
    .zg-rec { color: #8fa0c4; font-size: .7rem; }
    .zg-main { position: relative; display: flex; flex: 1; min-height: 0; }
    .zg-stage { position: relative; flex: 1; min-width: 0; background: #0b0e14; }
    .zg-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .zg-grid { position: absolute; inset: 8px; display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: 1fr; gap: 8px; }
    .zg-grid.duo { grid-template-columns: repeat(2, 1fr); grid-template-rows: 1fr; }
    @media (max-width: 760px) { .zg-grid { grid-template-columns: repeat(2, 1fr); } }
    .zg-tile { position: relative; border-radius: 10px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); pointer-events: none; transition: box-shadow .15s; }
    .zg-tile.off { background: #1a2130; display: grid; place-items: center; }
    .zg-tile.speaking { box-shadow: inset 0 0 0 3px #34d58a; }
    .zg-initial { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 50%; background: #3b4a63; color: #fff; font-size: 1.8rem; font-weight: 800; }
    .zg-name { position: absolute; right: 8px; bottom: 6px; padding: 2px 8px; border-radius: 6px; background: rgba(0,0,0,.6); color: #fff; font-size: .75rem; font-weight: 700; }
    .zg-share { position: absolute; inset: 10px; display: grid; place-items: center; border-radius: 10px; background: #f6f3ea; color: #23281a; overflow: auto; }
    .zg-chat { display: flex; flex-direction: column; width: 220px; background: #10141c; border-inline-start: 1px solid rgba(255,255,255,.08); }
    @media (max-width: 760px) { .zg-chat { width: 150px; } }
    .zg-chat-title { margin: 0; padding: 8px 10px; color: #9fb0d3; font-weight: 800; font-size: .8rem; }
    .zg-chat-log { flex: 1; overflow: auto; padding: 0 10px 10px; display: grid; align-content: start; gap: 6px; }
    .zg-msg { margin: 0; padding: 6px 8px; border-radius: 8px; background: #1b2232; color: #e6ecf8; font-size: .8rem; display: grid; gap: 2px; }
    .zg-msg b { color: #9fd0ff; font-size: .72rem; }
    .zg-msg.mine { background: #1f3352; }
    .zg-chat-btn { padding: 8px; border: 0; border-radius: 8px; background: #2d8cff; color: #fff; font: 800 .85rem 'Heebo', sans-serif; cursor: pointer; }
    .zg-chat-btn:disabled { background: #3a4458; color: #9aa6bd; cursor: default; }
    .zg-caption { margin: 0; min-height: 3.2em; padding: 10px 18px; background: #10141c; color: #f1f5ff; font: 600 1rem/1.5 'Heebo', sans-serif; text-align: center; }
    .zg-caption b { color: #9fd0ff; }
    .zg-caption i { color: #f2c94c; font-style: normal; }
    .zg-choices { display: grid; gap: 8px; padding: 0 16px 14px; background: #10141c; }
    .zg-choices:empty { padding: 0; }
    .zg-choice { min-height: 44px; padding: 8px 14px; border-radius: 12px; border: 0; background: #1b2740; color: #e8eefc; font: 600 .95rem 'Heebo', sans-serif; text-align: right; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(160,190,255,.2); }
    .zg-choice:hover { background: #274066; box-shadow: inset 0 0 0 2px #4ea1ff; }
    .zg-card { position: absolute; inset: 14px; overflow: auto; padding: 18px 20px; border-radius: 12px; background: rgba(16,22,34,.97); color: #e8eefc; box-shadow: 0 0 0 1px rgba(160,190,255,.2); }
    .zg-card h2 { margin: 0 0 8px; font-size: 1.2rem; }
    .zg-card p { margin: 6px 0; }
    .zg-card .zg-list { display: grid; gap: 8px; margin: 12px 0; }
    .zg-card .zg-item { padding: 10px 12px; border-radius: 10px; border: 0; background: #1b2740; color: #e8eefc; font: 600 .95rem 'Heebo', sans-serif; text-align: right; cursor: pointer; }
    .zg-card .zg-item.done { background: #17895f; }
    .zg-card .zg-item.wrong { background: #8a2b2b; }
    .zg-slide { width: min(720px, 92%); padding: 28px 34px; border-radius: 10px; background: #fff; box-shadow: 0 10px 30px rgba(0,0,0,.25); }
    .zg-slide h3 { margin: 0 0 10px; color: #1f3b73; font-size: 1.5rem; }
    .zg-slide p { margin: 0; color: #444; }
    .zg-poster { width: min(620px, 92%); padding: 22px 26px; border: 6px solid #f2c94c; border-radius: 14px; background: #fffaf0; text-align: center; }
    .zg-poster h3 { margin: 0 0 8px; color: #a3271f; font-size: 1.6rem; }
    .zg-poster ul { margin: 8px 0 0; padding: 0; list-style: none; display: grid; gap: 4px; color: #2a2d1d; font-weight: 600; }
  `;
  document.head.append(style);
}
