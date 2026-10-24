// Full-screen overlays on top of the 3D view: the laptop screen, the video call, the simulator room.
// While one is open the player can't move (it holds the same "modal" as dialogues and panels).

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(text, className = 'pp-btn') {
  const b = el('button', className, text);
  b.type = 'button';
  return b;
}

/**
 * Opens a full-screen overlay. `build(root, close, helpers)` fills it; call `close(value)` to remove it.
 * Resolves with the value passed to close(). `helpers.onClose(fn)` registers cleanup (listeners, timers).
 */
export function showScreen(game, className, build) {
  const release = game.ui.holdModal();
  const root = el('div', `pp-screen ${className ?? ''}`);
  document.body.append(root);
  game.renderPaused = true; // no need to draw the 3D room behind a full-screen overlay
  return new Promise((resolve) => {
    const cleanups = [];
    const close = (value) => {
      for (const fn of cleanups) fn();
      root.remove();
      game.renderPaused = document.querySelectorAll('.pp-screen').length > 0;
      release();
      resolve(value);
    };
    build(root, close, { onClose: (fn) => cleanups.push(fn) });
  });
}

/** A browser-looking window with a title bar; returns { window, body }. */
export function browserWindow(root, url) {
  const win = el('div', 'pp-window');
  const chrome = el('div', 'pp-chrome');
  const dots = el('div', 'pp-dots');
  dots.append(el('i'), el('i'), el('i'));
  chrome.append(dots, el('div', 'pp-url', url));
  const body = el('div', 'pp-body');
  win.append(chrome, body);
  root.append(win);
  return { window: win, body };
}

/** Shows a list of lines one by one on an element, with a typing feel (fx.key is optional). */
export function typeInto(target, text, { speed = 22, fx } = {}) {
  return new Promise((resolve) => {
    let i = 0;
    target.textContent = '';
    const timer = setInterval(() => {
      i++;
      target.textContent = text.slice(0, i);
      if (i % 2 === 0) fx?.key?.();
      if (i >= text.length) {
        clearInterval(timer);
        resolve();
      }
    }, speed);
  });
}

/** A "דף הסבר" before a task: title, bullet points, keys, and a start button. Resolves to 'start' or 'practice'. */
export function introCard(parent, { eyebrow, title, lines = [], keys = [], practice = true, startLabel = 'התחל', note, extra }) {
  return new Promise((resolve) => {
    const card = el('div', 'pp-intro');
    card.append(el('p', 'pp-eyebrow', eyebrow ?? ''), el('h2', 'pp-title', title));
    const list = el('ul', 'pp-list');
    for (const line of lines) list.append(el('li', '', line));
    card.append(list);
    if (keys.length) {
      const row = el('div', 'pp-keys');
      for (const k of keys) {
        const item = el('div', 'pp-key-item');
        const caps = el('span', 'pp-caps');
        for (const cap of k.keys) caps.append(el('kbd', 'pp-kbd', cap));
        item.append(caps, el('span', '', k.text));
        row.append(item);
      }
      card.append(row);
    }
    if (extra) card.append(extra);
    if (note) card.append(el('p', 'pp-note', note));
    const actions = el('div', 'pp-actions');
    if (practice) {
      const p = button('תרגול קצר', 'pp-btn secondary');
      p.addEventListener('click', () => {
        card.remove();
        resolve('practice');
      });
      actions.append(p);
    }
    const go = button(startLabel);
    go.addEventListener('click', () => {
      card.remove();
      resolve('start');
    });
    actions.append(go);
    card.append(actions);
    parent.append(card);
    go.focus();
  });
}

const STYLE_ID = 'pp-screens-style';
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .pp-intro { animation: pp-fade .35s ease both; max-width: 760px; margin: 0 auto; }
    .pp-keys { display: grid; gap: 8px; margin: 10px 0 4px; }
    .pp-key-item { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 10px; background: rgba(255,255,255,.05); }
    .pp-caps { display: flex; gap: 5px; min-width: 120px; }
    .pp-note { margin: 12px 0 0; font-size: .85rem; color: var(--pp-muted); }
    .pp-note b { color: var(--pp-warn); }
  `;
  document.head.append(style);
}
