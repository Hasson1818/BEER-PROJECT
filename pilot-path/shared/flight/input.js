// Controls of the simulators: keyboard (arrows + W/S), the mouse as a stick, and on-screen controls for phones.
//
//   stick.x  right = roll right      stick.y  up = nose up (can be flipped: `invert`)
//   throttle  W / S, Shift / Ctrl, mouse wheel, or the slider on a phone
//   buttons   a list of { id, label, keys: [codes], hold?: true, onPress? }: held ones show up in `state.held[id]`,
//             the others call onPress once. They are also drawn as big buttons (always on phones, optionally on desktop).

const INVERT_KEY = 'beer-project-flight-invert';

const STYLE_ID = 'fl-controls-style';
function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .fl-touch { position: absolute; inset: auto 0 0 0; height: 42%; pointer-events: none; z-index: 5; }
    .fl-touch > * { pointer-events: auto; position: absolute; }
    .fl-pad { left: 18px; bottom: 22px; width: 130px; height: 130px; border-radius: 50%; background: rgba(125,255,176,.08); box-shadow: inset 0 0 0 2px rgba(125,255,176,.4); touch-action: none; }
    .fl-pad i { position: absolute; left: 50%; top: 50%; width: 52px; height: 52px; margin: -26px; border-radius: 50%; background: rgba(125,255,176,.5); }
    .fl-throttle { right: 16px; bottom: 22px; width: 54px; height: 150px; border-radius: 30px; background: rgba(125,255,176,.08); box-shadow: inset 0 0 0 2px rgba(125,255,176,.4); --v: 0; touch-action: none; }
    .fl-throttle b { position: absolute; left: 6px; right: 6px; top: calc(50% - var(--v) * 45%); height: 18px; margin-top: -9px; border-radius: 9px; background: rgba(125,255,176,.7); }
    .fl-throttle span { position: absolute; top: -18px; left: 0; right: 0; text-align: center; font: 700 .65rem 'Heebo', sans-serif; color: #bfe6cf; }
    .fl-buttons { right: 84px; bottom: 22px; display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; max-width: 60%; }
    .fl-buttons button { display: grid; gap: 1px; justify-items: center; min-width: 78px; min-height: 46px; padding: 4px 14px; border-radius: 14px; background: rgba(255,200,87,.9); color: #2b2203; font: 800 .9rem 'Heebo', sans-serif; cursor: pointer; touch-action: none; box-shadow: 0 4px 14px rgba(0,0,0,.35); }
    .fl-buttons button kbd { font: 700 .62rem ui-monospace, Menlo, monospace; opacity: .7; }
    .fl-buttons button:active { transform: translateY(1px) scale(.97); filter: brightness(.9); }
    .fl-buttons button.def { background: rgba(78,161,255,.92); color: #04142c; }
    .fl-buttons button.warn { background: rgba(255,107,107,.92); color: #2b0404; }
    .fl-buttons button:disabled { opacity: .4; cursor: not-allowed; }
  `;
  document.head.append(style);
}

export const DEFAULT_BUTTONS = [{ id: 'fire', label: 'אש', keys: ['Space'], hold: true }];

export function createControls(root, { buttons = DEFAULT_BUTTONS, showButtons = false, renderButtons = true } = {}) {
  const stick = { x: 0, y: 0 };
  const keys = new Set();
  let invert = false;
  try {
    invert = localStorage.getItem(INVERT_KEY) === '1';
  } catch {
    // Storage can be blocked.
  }
  const mouse = { x: 0, y: 0, active: false };
  const touch = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const held = {};
  const heldPointer = {};
  const state = { stick, throttleInput: 0, held, invert, touch: window.matchMedia('(pointer: coarse)').matches, fire: false };
  let throttleSlider = 0; // -1..1 from the slider, held while the thumb is on it
  let wheel = 0;

  const byCode = new Map();
  for (const b of buttons) for (const code of b.keys ?? []) byCode.set(code, b);

  const press = (b) => b.onPress?.();

  const onKeyDown = (event) => {
    const b = byCode.get(event.code);
    if (b && !b.hold && !event.repeat) press(b);
    if (event.repeat) {
      if (event.code === 'Space') event.preventDefault();
      return;
    }
    keys.add(event.code);
    if (event.code === 'KeyI') setInvert(!state.invert);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  };
  const onKeyUp = (event) => keys.delete(event.code);
  const onBlur = () => keys.clear();
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  const rect = () => root.getBoundingClientRect();
  const onMove = (event) => {
    if (event.pointerType === 'touch') return;
    const r = rect();
    mouse.x = (event.clientX - (r.left + r.width / 2)) / (r.width * 0.32);
    mouse.y = -(event.clientY - (r.top + r.height / 2)) / (r.height * 0.32);
    mouse.active = true;
  };
  const onDown = (event) => {
    if (event.pointerType === 'touch') return;
    if (event.button === 0 && !event.target.closest('button, a')) heldPointer.fire = true;
  };
  const onUp = (event) => {
    if (event.pointerType !== 'touch' && event.button === 0) heldPointer.fire = false;
  };
  const onWheel = (event) => {
    wheel += Math.sign(-event.deltaY) * 0.5;
    event.preventDefault();
  };
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  root.addEventListener('wheel', onWheel, { passive: false });

  // ---------- On-screen controls ----------

  let ui = null;
  if (state.touch || showButtons) {
    injectStyle();
    ui = document.createElement('div');
    ui.className = 'fl-touch';
    const pad = state.touch ? '<div class="fl-pad" aria-label="הגה"><i></i></div><div class="fl-throttle" aria-label="מצערת"><b></b><span>מצערת</span></div>' : '';
    ui.innerHTML = `${pad}<div class="fl-buttons"></div>`;
    root.append(ui);
    const box = ui.querySelector('.fl-buttons');
    for (const b of renderButtons ? buttons : []) {
      const node = document.createElement('button');
      node.type = 'button';
      node.dataset.act = b.id;
      node.className = b.className ?? '';
      node.innerHTML = `<span>${b.label}</span>${b.keys?.[0] ? `<kbd>${keyName(b.keys[0])}</kbd>` : ''}`;
      if (b.hold) {
        node.addEventListener('pointerdown', () => (heldPointer[b.id] = true));
        node.addEventListener('pointerup', () => (heldPointer[b.id] = false));
        node.addEventListener('pointerleave', () => (heldPointer[b.id] = false));
      } else node.addEventListener('click', () => press(b));
      box.append(node);
    }
    if (state.touch) {
      const padEl = ui.querySelector('.fl-pad');
      const knob = padEl.querySelector('i');
      padEl.addEventListener('pointerdown', (e) => {
        touch.id = e.pointerId;
        padEl.setPointerCapture(e.pointerId);
        const r = padEl.getBoundingClientRect();
        touch.ox = r.left + r.width / 2;
        touch.oy = r.top + r.height / 2;
      });
      padEl.addEventListener('pointermove', (e) => {
        if (e.pointerId !== touch.id) return;
        const r = padEl.getBoundingClientRect();
        touch.x = Math.max(-1, Math.min(1, (e.clientX - touch.ox) / (r.width / 2)));
        touch.y = Math.max(-1, Math.min(1, -(e.clientY - touch.oy) / (r.height / 2)));
        knob.style.transform = `translate(${touch.x * 30}px, ${-touch.y * 30}px)`;
      });
      const release = (e) => {
        if (e.pointerId !== touch.id) return;
        touch.id = null;
        touch.x = touch.y = 0;
        knob.style.transform = '';
      };
      padEl.addEventListener('pointerup', release);
      padEl.addEventListener('pointercancel', release);
      const slider = ui.querySelector('.fl-throttle');
      const setSlider = (e) => {
        const r = slider.getBoundingClientRect();
        throttleSlider = Math.max(-1, Math.min(1, ((r.top + r.height / 2 - e.clientY) / (r.height / 2)) * 1.4));
        slider.style.setProperty('--v', String(throttleSlider));
      };
      slider.addEventListener('pointerdown', (e) => {
        slider.setPointerCapture(e.pointerId);
        setSlider(e);
      });
      slider.addEventListener('pointermove', (e) => {
        if (e.buttons || e.pressure) setSlider(e);
      });
      const releaseSlider = () => {
        throttleSlider = 0;
        slider.style.setProperty('--v', '0');
      };
      slider.addEventListener('pointerup', releaseSlider);
      slider.addEventListener('pointercancel', releaseSlider);
    }
  }

  function keyName(code) {
    return code.replace('Key', '').replace('Digit', '').replace('Space', 'Space').replace('Enter', '↵');
  }

  function setInvert(value) {
    state.invert = value;
    try {
      localStorage.setItem(INVERT_KEY, value ? '1' : '0');
    } catch {
      // Storage can be blocked.
    }
  }

  /** Call once per frame: fills stick / throttleInput / held from whatever the player is using. */
  function poll(dt) {
    let x = 0;
    let y = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1;
    if (keys.has('ArrowUp')) y += 1;
    if (keys.has('ArrowDown')) y -= 1;
    const keyed = x !== 0 || y !== 0;
    if (!keyed) {
      if (touch.id !== null || touch.x || touch.y) {
        x = touch.x;
        y = touch.y;
      } else if (mouse.active) {
        const dead = 0.09;
        const shape = (v) => (Math.abs(v) < dead ? 0 : Math.sign(v) * Math.min(1, ((Math.abs(v) - dead) / (1 - dead)) ** 1.35));
        x = shape(mouse.x);
        y = shape(mouse.y);
      }
    }
    // Smooth keyboard steps so a tap is a nudge and holding is full deflection.
    const k = keyed ? Math.min(1, dt * 7) : 1;
    stick.x += (x - stick.x) * k;
    stick.y += (y * (state.invert ? -1 : 1) - stick.y) * k;
    let t = throttleSlider;
    if (keys.has('KeyW') || keys.has('ShiftLeft') || keys.has('ShiftRight')) t += 1;
    if (keys.has('KeyS') || keys.has('ControlLeft') || keys.has('ControlRight')) t -= 1;
    t += wheel;
    wheel = 0;
    state.throttleInput = Math.max(-1, Math.min(1, t));
    for (const b of buttons) {
      if (!b.hold) continue;
      held[b.id] = (b.keys ?? []).some((c) => keys.has(c)) || Boolean(heldPointer[b.id]);
    }
    state.fire = Boolean(held.fire);
    return state;
  }

  function dispose() {
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    root.removeEventListener('wheel', onWheel);
    ui?.remove();
  }

  return { state, poll, dispose, setInvert, keys };
}
