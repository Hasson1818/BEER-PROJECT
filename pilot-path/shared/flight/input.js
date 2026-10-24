// Controls of the simulator: keyboard (arrows + W/S), the mouse as a stick, and on-screen controls for phones.
//
//   stick.x  right = roll right      stick.y  up = nose up (can be flipped: `invert`)
//   throttle  W / S, Shift / Ctrl, mouse wheel, or the slider on a phone
//   fire      Space or the left mouse button      bomb  X      acknowledge  Enter or B

const INVERT_KEY = 'beer-project-flight-invert';

export function createControls(root, { onAck, onBomb } = {}) {
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
  const state = { stick, throttleInput: 0, fire: false, invert, touch: window.matchMedia('(pointer: coarse)').matches };
  let firePointer = false;
  let fireTouch = false;
  let throttleSlider = 0; // -1..1 from the slider, held while the thumb is on it
  let wheel = 0;

  const onKeyDown = (event) => {
    if (event.repeat && event.code !== 'Space') return;
    keys.add(event.code);
    if (event.code === 'Enter' || event.code === 'KeyB') onAck?.();
    if (event.code === 'KeyX') onBomb?.();
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
    if (event.button === 0 && !event.target.closest('button, a')) firePointer = true;
  };
  const onUp = (event) => {
    if (event.pointerType !== 'touch' && event.button === 0) firePointer = false;
  };
  const onWheel = (event) => {
    wheel += Math.sign(-event.deltaY) * 0.5;
    event.preventDefault();
  };
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  root.addEventListener('wheel', onWheel, { passive: false });

  // ---------- On-screen controls for phones ----------

  let touchUi = null;
  if (state.touch) {
    touchUi = document.createElement('div');
    touchUi.className = 'fl-touch';
    touchUi.innerHTML = `
      <div class="fl-pad" aria-label="הגה"><i></i></div>
      <div class="fl-throttle" aria-label="מצערת"><b></b><span>מצערת</span></div>
      <div class="fl-buttons"><button type="button" data-act="fire">אש</button><button type="button" data-act="ack">אישור</button><button type="button" data-act="bomb">פצצה</button></div>`;
    root.append(touchUi);
    const pad = touchUi.querySelector('.fl-pad');
    const knob = pad.querySelector('i');
    pad.addEventListener('pointerdown', (e) => {
      touch.id = e.pointerId;
      pad.setPointerCapture(e.pointerId);
      const r = pad.getBoundingClientRect();
      touch.ox = r.left + r.width / 2;
      touch.oy = r.top + r.height / 2;
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId !== touch.id) return;
      const r = pad.getBoundingClientRect();
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
    pad.addEventListener('pointerup', release);
    pad.addEventListener('pointercancel', release);
    const slider = touchUi.querySelector('.fl-throttle');
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
    touchUi.querySelector('[data-act="fire"]').addEventListener('pointerdown', () => (fireTouch = true));
    touchUi.querySelector('[data-act="fire"]').addEventListener('pointerup', () => (fireTouch = false));
    touchUi.querySelector('[data-act="ack"]').addEventListener('click', () => onAck?.());
    touchUi.querySelector('[data-act="bomb"]').addEventListener('click', () => onBomb?.());
  }

  function setInvert(value) {
    state.invert = value;
    try {
      localStorage.setItem(INVERT_KEY, value ? '1' : '0');
    } catch {
      // Storage can be blocked.
    }
  }

  /** Call once per frame: fills stick / throttleInput / fire from whatever the player is using. */
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
    state.fire = keys.has('Space') || firePointer || fireTouch;
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
    touchUi?.remove();
  }

  return { state, poll, dispose, setInvert, keys };
}
