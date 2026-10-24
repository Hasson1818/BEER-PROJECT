// The four little keyboard tasks of "מבחנים בבית" (the online test the candidate takes on a laptop at home).
// NOTE: the official source (IDF article, 17.07.2025) only says the test measures quick thinking and memory.
// The task descriptions below come from prep sites, not from the army, so the game never presents them as official.
//
//   runHomeTask(id, container, { practice, fx, onProgress, touch }) -> Promise<{ score 0..1, summary, stats }>
//
// Each task draws inside `container` (canvas + a little DOM for the HUD / key caps), everything is dt based
// (simulated time), and everything it added is removed when the task ends.

import { tone, noise } from './fx.js';

// ---------------------------------------------------------------------------------------------------------
// Task definitions (what the caller shows on the intro screen)
// ---------------------------------------------------------------------------------------------------------

export const HOME_TASKS = [
  {
    id: 'bucket',
    title: 'דלי ומים',
    intro: [
      'מולכם דלי התלוי על חבל, וברז שממלא אותו במים.',
      'כל לחיצה על רווח מוסיפה מים – ועוד נקודות לדלי הנוכחי.',
      'אבל החבל חלש: בנקודה סודית, שונה בכל דלי, הוא נקרע. הדלי נופל וכל הנקודות שלו הולכות לאיבוד.',
      'בכל רגע אפשר לשמור את הדלי בלחיצה על Enter ולקחת את הנקודות.',
      'המטרה: לצבור כמה שיותר נקודות ב-10 דליים. למלא יותר מדי זה מסוכן, ולשמור מהר מדי מרוויח מעט.',
    ],
    keysHelp: [
      { keys: ['Space'], text: 'להוסיף מים לדלי' },
      { keys: ['Enter'], text: 'לשמור את הדלי ולקחת את הנקודות' },
    ],
    buckets: 10,
    practiceSeconds: 25,
    seconds: 60,
  },
  {
    id: 'arrows',
    title: 'חיצים וריבועים',
    intro: [
      'בכל פעם יופיעו על המסך חץ וריבוע – אחד בכל צד.',
      'לחצו על מקש החץ שמתאים לכיוון שאליו החץ מצביע.',
      'לא משנה באיזה צד של המסך החץ נמצא, ולא משנה איפה הריבוע. רק הכיוון של החץ קובע.',
      'צריך להיות מהיר, אבל גם מדויק.',
    ],
    keysHelp: [
      { keys: ['←', '↑', '↓', '→'], text: 'לפי הכיוון שאליו החץ מצביע' },
    ],
    trials: 30,
    practiceSeconds: 20,
    seconds: 50,
  },
  {
    id: 'symbols6',
    title: 'מיון סמלים בשישה מקשים',
    intro: [
      'בכל פעם יופיע סמל: ספרה, אות או צורה.',
      'לכל סמל מוקצה מקש אחד מתוך שישה, והמקשים מוצגים בטבלה בתחתית המסך.',
      'לחצו על המקש שמתאים לסמל. כדאי לזכור את הטבלה כדי שלא תצטרכו להסתכל עליה בכל פעם.',
      'נסו להיות מהירים ומדויקים.',
    ],
    keysHelp: [
      { keys: ['S', 'D', 'F', 'J', 'K', 'L'], text: 'כל מקש מתאים לסמל אחד בטבלה' },
    ],
    trials: 36,
    practiceSeconds: 25,
    seconds: 55,
  },
  {
    id: 'sort2',
    title: 'מיון מהיר בשני מקשים',
    intro: [
      'מספרים יופיעו מולכם בזה אחר זה, מהר.',
      'אם המספר זוגי לחצו F. אם הוא אי-זוגי לחצו J.',
      'המשימה נמשכת כ-45 שניות והקצב עולה קצת עם הזמן.',
      'חשוב לשמור על ריכוז לאורך כל הזמן: טעות או מספר שפספסתם מורידים מהציון.',
    ],
    keysHelp: [
      { keys: ['F'], text: 'מספר זוגי' },
      { keys: ['J'], text: 'מספר אי-זוגי' },
    ],
    practiceSeconds: 15,
    seconds: 45,
  },
];

export function runHomeTask(id, container, { practice = false, fx, onProgress, touch } = {}) {
  const def = HOME_TASKS.find((t) => t.id === id);
  const make = MAKERS[id];
  if (!def || !make) return Promise.reject(new Error(`Unknown home task: ${id}`));
  return new Promise((resolve) => {
    const sh = createShell(container, def, { practice: !!practice, fx, onProgress, touch }, resolve);
    sh.attach(make(sh, def, !!practice));
  });
}

// ---------------------------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------------------------

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, k) => a + (b - a) * k;
const rand = (a, b) => a + Math.random() * (b - a);
const easeOut = (k) => 1 - Math.pow(1 - clamp(k), 3);
const easeIn = (k) => Math.pow(clamp(k), 3);
const easeOutBack = (k) => {
  k = clamp(k);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
};
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const median = (arr) => {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const pct = (v) => `${Math.round(v * 100)}%`;
const ms = (s) => Math.round(s * 1000);

const FONT = "'Heebo', system-ui, sans-serif";
const FONT_HEAD = "'Secular One', 'Heebo', system-ui, sans-serif";

function rr(g, x, y, w, h, r) {
  w = Math.max(0, w);
  h = Math.max(0, h);
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function normKey(e) {
  const c = e.code || '';
  if (c.startsWith('Key')) return c.slice(3).toLowerCase(); // physical key: works on a Hebrew layout too
  if (c.startsWith('Digit')) return c.slice(5);
  if (e.key === ' ' || c === 'Space') return 'Space';
  if (e.key === 'Enter' || c === 'NumpadEnter') return 'Enter';
  if (e.key && e.key.startsWith('Arrow')) return e.key;
  if (!e.key) return c;
  return e.key.length === 1 ? e.key.toLowerCase() : e.key;
}

const isDev = () => {
  try {
    return !!(import.meta.env && import.meta.env.DEV);
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------------------------------------
// Styles (scoped, injected once)
// ---------------------------------------------------------------------------------------------------------

const STYLE = `
.pp-ht-root{position:relative;display:flex;flex-direction:column;width:100%;height:100%;min-height:240px;overflow:hidden;
  box-sizing:border-box;border-radius:12px;direction:rtl;color:var(--pp-text,#e8eefc);font-family:${FONT};
  background:radial-gradient(900px 520px at 50% 0%,#1b2e52 0%,var(--pp-bg,#0c1424) 72%);user-select:none;-webkit-user-select:none;
  touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.pp-ht-root *{box-sizing:border-box}
.pp-ht-hud{display:flex;align-items:center;gap:14px;flex:none;min-height:42px;padding:6px 14px;
  background:rgba(8,14,28,.62);border-bottom:1px solid var(--pp-line,rgba(160,190,255,.18))}
.pp-ht-name{margin-inline-end:auto;display:flex;align-items:center;gap:8px;font:400 .95rem ${FONT_HEAD};color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.pp-ht-badge{padding:2px 9px;border-radius:999px;background:rgba(255,200,87,.16);color:var(--pp-warn,#ffc857);font:800 .7rem ${FONT}}
.pp-ht-stat{display:flex;align-items:baseline;gap:6px;white-space:nowrap}
.pp-ht-sl{font-size:.72rem;color:var(--pp-muted,#9fb0d3)}
.pp-ht-sv{font:800 1rem ${FONT};font-variant-numeric:tabular-nums;color:#fff;min-width:1.2em;text-align:center}
.pp-ht-stat.bump .pp-ht-sv{animation:pp-ht-bump .35s ease}
.pp-ht-stage{position:relative;flex:1;min-height:0}
.pp-ht-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.pp-ht-toast{position:absolute;left:0;right:0;top:var(--pp-ht-toast-top,14%);text-align:center;pointer-events:none;opacity:0;
  font:400 clamp(1.2rem,3.4vw,1.9rem) ${FONT_HEAD};color:#fff;text-shadow:0 2px 14px rgba(0,0,0,.7)}
.pp-ht-toast.show{opacity:1;animation:pp-ht-pop .28s ease-out both}
.pp-ht-toast.good{color:var(--pp-good,#4cd29a)}
.pp-ht-toast.bad{color:var(--pp-bad,#ff6b6b)}
.pp-ht-toast.warn{color:var(--pp-warn,#ffc857)}
.pp-ht-bar{display:flex;flex:none;justify-content:center;align-items:flex-end;gap:8px;padding:7px 10px 9px;direction:ltr;
  background:rgba(8,14,28,.5);border-top:1px solid var(--pp-line,rgba(160,190,255,.18));min-height:20px}
.pp-ht-bar:empty{display:none}
.pp-ht-gap{width:clamp(10px,3vw,40px)}
.pp-ht-key{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-width:46px;height:50px;padding:0 10px;border-radius:10px;
  background:#0a1120;color:#fff;font:800 1.15rem ui-monospace,Menlo,Consolas,monospace;
  box-shadow:inset 0 -3px 0 rgba(255,255,255,.14),0 0 0 1px var(--pp-line,rgba(160,190,255,.18));
  transition:transform .08s,background .12s,box-shadow .12s}
.pp-ht-key small{font:700 .66rem ${FONT};color:var(--pp-muted,#9fb0d3);letter-spacing:.02em}
.pp-ht-key .pp-ht-kg{display:inline-flex;align-items:center;justify-content:center;line-height:1}
.pp-ht-key svg{width:24px;height:24px;display:block;fill:currentColor}
.pp-ht-key.wide{min-width:150px}
.pp-ht-key.arrow{font-size:1.6rem}
.pp-ht-key.sym{min-width:56px;height:64px}
.pp-ht-key.sym .pp-ht-kg{font:400 1.6rem ${FONT_HEAD};min-height:28px}
.pp-ht-key.sym svg{width:26px;height:26px}
.pp-ht-key.is-down{transform:translateY(2px);box-shadow:inset 0 -1px 0 rgba(255,255,255,.14),0 0 0 1px var(--pp-accent,#4ea1ff);background:#16294a}
.pp-ht-key.ok{background:#12503b;box-shadow:inset 0 -1px 0 rgba(255,255,255,.2),0 0 0 2px var(--pp-good,#4cd29a),0 0 16px rgba(76,210,154,.5)}
.pp-ht-key.bad{background:#5a1f26;box-shadow:inset 0 -1px 0 rgba(255,255,255,.2),0 0 0 2px var(--pp-bad,#ff6b6b),0 0 16px rgba(255,107,107,.5)}
.pp-ht-key.hint{box-shadow:inset 0 -3px 0 rgba(255,255,255,.14),0 0 0 2px var(--pp-warn,#ffc857),0 0 14px rgba(255,200,87,.45)}
.pp-ht-root.is-touch .pp-ht-key{min-width:clamp(48px,13vw,84px);height:clamp(60px,16vw,84px);cursor:pointer;font-size:1.5rem}
.pp-ht-root.is-touch .pp-ht-key.wide{min-width:clamp(130px,40vw,200px)}
.pp-ht-count{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;
  background:rgba(8,14,28,.45);font:400 clamp(4rem,16vw,8rem) ${FONT_HEAD};color:#fff;text-shadow:0 0 40px rgba(78,161,255,.8)}
.pp-ht-count[hidden],.pp-ht-done[hidden]{display:none}
.pp-ht-count span{display:block;animation:pp-ht-pop .45s ease-out both}
.pp-ht-done{position:absolute;inset:0;display:grid;place-items:center;background:rgba(8,14,28,.72);animation:pp-ht-fade .25s ease both}
.pp-ht-donebox{display:flex;flex-direction:column;align-items:center;gap:10px;font:400 1.6rem ${FONT_HEAD};color:#fff;animation:pp-ht-pop .4s ease-out both}
.pp-ht-donebox svg{width:76px;height:76px;fill:none;stroke:var(--pp-good,#4cd29a);stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round}
.pp-ht-donebox circle{stroke-dasharray:150;stroke-dashoffset:150;animation:pp-ht-draw .5s ease-out .05s forwards}
.pp-ht-donebox path{stroke-dasharray:40;stroke-dashoffset:40;animation:pp-ht-draw .35s ease-out .35s forwards}
@keyframes pp-ht-pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
@keyframes pp-ht-fade{from{opacity:0}to{opacity:1}}
@keyframes pp-ht-draw{to{stroke-dashoffset:0}}
@keyframes pp-ht-bump{40%{transform:scale(1.3);color:var(--pp-accent-2,#7cc4ff)}}
@media (max-width:520px){.pp-ht-hud{gap:9px;padding:5px 9px}.pp-ht-name{font-size:.8rem}.pp-ht-sl{font-size:.64rem}.pp-ht-key{min-width:40px;height:44px;padding:0 6px}.pp-ht-key.wide{min-width:100px}}
@media (prefers-reduced-motion:reduce){.pp-ht-toast.show,.pp-ht-count span,.pp-ht-donebox{animation:none}}
`;

let styleUsers = 0;
let styleEl = null;
function useStyle() {
  if (styleUsers++ === 0) {
    styleEl = document.createElement('style');
    styleEl.setAttribute('data-pp-ht', '');
    styleEl.textContent = STYLE;
    document.head.appendChild(styleEl);
  }
}
function releaseStyle() {
  if (--styleUsers <= 0) {
    styleUsers = 0;
    styleEl?.remove();
    styleEl = null;
  }
}

// ---------------------------------------------------------------------------------------------------------
// The shell: DOM, canvas, simulated clock, input, countdown, "done" animation, test hook
// ---------------------------------------------------------------------------------------------------------

function createShell(container, def, opts, resolve) {
  useStyle();
  const practice = opts.practice;
  const fx = opts.fx;
  const touch = opts.touch ?? (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const div = (cls, parent) => {
    const d = document.createElement('div');
    d.className = cls;
    if (parent) parent.appendChild(d);
    return d;
  };

  const root = div('pp-ht-root' + (touch ? ' is-touch' : ''));
  const hudEl = div('pp-ht-hud', root);
  const stage = div('pp-ht-stage', root);
  const bar = div('pp-ht-bar', root);
  const canvas = document.createElement('canvas');
  stage.appendChild(canvas);
  const toastEl = div('pp-ht-toast', stage);
  const countEl = div('pp-ht-count', stage);
  countEl.hidden = true;
  const doneEl = div('pp-ht-done', stage);
  doneEl.hidden = true;
  container.appendChild(root);

  const nameEl = div('pp-ht-name', hudEl);
  nameEl.textContent = def.title;
  if (practice) {
    const badge = document.createElement('span');
    badge.className = 'pp-ht-badge';
    badge.textContent = 'תרגול';
    nameEl.prepend(badge);
  }

  const g = canvas.getContext('2d');
  const cs = getComputedStyle(root);
  const css = (name, fb) => cs.getPropertyValue(name).trim() || fb;
  const colors = {
    bg: css('--pp-bg', '#0c1424'),
    panel: css('--pp-panel', '#182742'),
    line: css('--pp-line', 'rgba(160,190,255,0.18)'),
    text: css('--pp-text', '#e8eefc'),
    muted: css('--pp-muted', '#9fb0d3'),
    accent: css('--pp-accent', '#4ea1ff'),
    accent2: css('--pp-accent-2', '#7cc4ff'),
    good: css('--pp-good', '#4cd29a'),
    bad: css('--pp-bad', '#ff6b6b'),
    warn: css('--pp-warn', '#ffc857'),
  };

  const sh = {
    root, bar, g, colors, practice, touch, reduced, def,
    W: 300, H: 200, dpr: 1,
    t: 0, // simulated seconds since the shell started
    playT: 0, // simulated seconds since the countdown ended
    phase: 'countdown',
    get playing() {
      return this.phase === 'play';
    },
  };

  // ---- sound (all guarded: works with no fx at all) ----
  sh.snd = (name, ...args) => {
    try {
      if (fx && typeof fx[name] === 'function') fx[name](...args);
    } catch {
      /* sound is optional */
    }
  };
  sh.hasFx = !!fx;
  sh.tone = (...a) => {
    if (fx) {
      try {
        tone(...a);
      } catch {
        /* optional */
      }
    }
  };
  sh.noise = (...a) => {
    if (fx) {
      try {
        noise(...a);
      } catch {
        /* optional */
      }
    }
  };

  // ---- timers on the simulated clock ----
  let timers = [];
  sh.after = (delay, fn) => {
    timers.push({ at: sh.t + delay, fn });
  };

  // ---- HUD / keys / toast ----
  sh.stat = (label, value = '') => {
    const d = div('pp-ht-stat', hudEl);
    const l = document.createElement('span');
    l.className = 'pp-ht-sl';
    l.textContent = label;
    const v = document.createElement('b');
    v.className = 'pp-ht-sv';
    v.textContent = String(value);
    d.append(l, v);
    return (val, bump = false) => {
      const s = String(val);
      if (v.textContent !== s) {
        v.textContent = s;
        if (bump) {
          d.classList.remove('bump');
          void d.offsetWidth;
          d.classList.add('bump');
        }
      }
    };
  };

  const keyEls = {};
  let task = null;
  sh.addKey = (k, main, sub = '', cls = '') => {
    const b = div('pp-ht-key ' + cls, bar);
    b.dataset.key = k;
    const kg = document.createElement('span');
    kg.className = 'pp-ht-kg';
    kg.innerHTML = main; // trusted strings from this file only
    b.appendChild(kg);
    if (sub) {
      const s = document.createElement('small');
      s.textContent = sub;
      b.appendChild(s);
    }
    keyEls[k] = b;
    if (touch) {
      b.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        handleKey(k);
      });
    }
    return b;
  };
  sh.addGap = () => div('pp-ht-gap', bar);
  sh.flash = (k, cls, dur = 0.25) => {
    const el = keyEls[k];
    if (!el) return;
    el.classList.add(cls);
    sh.after(dur, () => el.classList.remove(cls));
  };

  let toastToken = 0;
  sh.toast = (text, kind = '', dur = 0.9) => {
    const token = ++toastToken;
    toastEl.className = 'pp-ht-toast';
    void toastEl.offsetWidth;
    toastEl.textContent = text;
    toastEl.className = `pp-ht-toast show ${kind}`;
    sh.after(dur, () => {
      if (token === toastToken) toastEl.className = 'pp-ht-toast';
    });
  };

  // ---- progress ----
  let lastProgress = -1;
  sh.progress = (f, info) => {
    f = clamp(f);
    if (Math.abs(f - lastProgress) < 0.004 && f < 1) return;
    lastProgress = f;
    try {
      opts.onProgress?.(f, info);
    } catch {
      /* caller's problem */
    }
  };

  // ---- canvas sizing ----
  function resize() {
    const w = Math.max(40, stage.clientWidth);
    const h = Math.max(40, stage.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (w === sh.W && h === sh.H && dpr === sh.dpr && canvas.width) return;
    sh.W = w;
    sh.H = h;
    sh.dpr = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    render();
  }
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null;
  ro?.observe(stage);
  window.addEventListener('resize', resize);

  function render() {
    if (!task) return;
    g.setTransform(sh.dpr, 0, 0, sh.dpr, 0, 0);
    g.clearRect(0, 0, sh.W, sh.H);
    g.textBaseline = 'alphabetic';
    g.textAlign = 'center';
    task.draw(g, sh.W, sh.H);
  }

  // ---- input ----
  function handleKey(k) {
    const el = keyEls[k];
    if (el && sh.phase !== 'done') {
      el.classList.add('is-down');
      sh.after(0.11, () => el.classList.remove('is-down'));
    }
    if (sh.phase === 'play' && task) task.onKey(k);
  }
  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || !task) return;
    const k = normKey(e);
    if (!task.keys.includes(k)) return;
    e.preventDefault();
    if (e.repeat) return;
    handleKey(k);
  }
  document.addEventListener('keydown', onKeyDown);

  // ---- phases ----
  let cdT = 0;
  let cdShown = 0;
  let doneT = 0;
  let result = null;
  let ended = false;

  sh.finish = (res) => {
    if (sh.phase === 'done' || ended) return;
    result = res;
    sh.phase = 'done';
    doneT = 0;
    sh.progress(1);
    const box = div('pp-ht-donebox');
    box.innerHTML =
      '<svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="23"/><path d="M15 27l8 8 14-16"/></svg>';
    const label = document.createElement('div');
    label.textContent = practice ? 'התרגול הסתיים' : 'סיום!';
    box.appendChild(label);
    doneEl.replaceChildren(box);
    doneEl.hidden = false;
    sh.snd('done');
  };

  function step(dt) {
    if (ended) return;
    sh.t += dt;
    if (timers.length) {
      const due = timers.filter((x) => x.at <= sh.t);
      if (due.length) {
        timers = timers.filter((x) => x.at > sh.t);
        for (const x of due) x.fn();
      }
    }
    if (sh.phase === 'countdown') {
      cdT += dt;
      const n = 3 - Math.floor(cdT / 0.5);
      if (cdT >= 1.5) {
        sh.phase = 'play';
        countEl.hidden = true;
        sh.snd('click');
      } else if (n !== cdShown) {
        cdShown = n;
        countEl.hidden = false;
        countEl.innerHTML = `<span>${n}</span>`;
        sh.snd('tick');
      }
    } else if (sh.phase === 'play') {
      sh.playT += dt;
    }
    task.update(dt);
    if (sh.phase === 'done') {
      doneT += dt;
      if (doneT >= 0.8) end();
    }
  }

  // ---- loop (rAF). Big gaps (throttled tabs) are replayed in <= 1/30 s steps so the logic stays dt based ----
  let raf = 0;
  let lastTs = null;
  function frame(ts) {
    if (ended) return;
    raf = requestAnimationFrame(frame);
    if (lastTs == null) lastTs = ts;
    let dt = clamp((ts - lastTs) / 1000, 0, 0.5);
    lastTs = ts;
    while (dt > 1e-6 && !ended) {
      const s = Math.min(dt, 1 / 30);
      step(s);
      dt -= s;
    }
    if (!ended) render();
  }

  function end() {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('resize', resize);
    ro?.disconnect();
    root.remove();
    try {
      delete container.__task;
    } catch {
      /* ignore */
    }
    releaseStyle();
    resolve(result);
  }

  sh.attach = (t) => {
    task = t;
    resize();
    render();
    sh.progress(0);
    raf = requestAnimationFrame(frame);
    if (isDev()) {
      container.__task = {
        advance(seconds = 1) {
          const n = Math.max(0, Math.round(seconds * 30));
          for (let i = 0; i < n && !ended; i++) step(1 / 30);
          if (!ended) render();
          return sh.t;
        },
        press(key) {
          if (ended) return false;
          handleKey(key);
          return true;
        },
        state() {
          return { phase: sh.phase, t: +sh.t.toFixed(3), playT: +sh.playT.toFixed(3), ended, ...(ended ? {} : task.state()) };
        },
      };
    }
  };

  return sh;
}

// ---------------------------------------------------------------------------------------------------------
// Shapes / symbols (symbols6)
// ---------------------------------------------------------------------------------------------------------

function starPts(n = 5, inner = 0.45) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner : 1;
    const a = (-Math.PI / 2) + (i * Math.PI) / n;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}
const SHAPES = {
  tri: [[0, -1], [0.95, 0.8], [-0.95, 0.8]],
  sq: [[-0.78, -0.78], [0.78, -0.78], [0.78, 0.78], [-0.78, 0.78]],
  diamond: [[0, -1], [0.85, 0], [0, 1], [-0.85, 0]],
  star: starPts(5, 0.42),
  hex: Array.from({ length: 6 }, (_, i) => [Math.cos((i * Math.PI) / 3), Math.sin((i * Math.PI) / 3)]),
  circle: null,
};

function shapeSvg(shape) {
  if (shape === 'circle') return '<svg viewBox="-1.1 -1.1 2.2 2.2"><circle r="0.9"/></svg>';
  const pts = SHAPES[shape].map((p) => p.join(',')).join(' ');
  return `<svg viewBox="-1.1 -1.1 2.2 2.2"><polygon points="${pts}"/></svg>`;
}

function drawGlyph(g, sym, x, y, size, fill) {
  g.fillStyle = fill;
  if (sym.kind === 'shape') {
    const r = size * 0.5;
    g.beginPath();
    if (sym.shape === 'circle') g.arc(x, y, r * 0.9, 0, Math.PI * 2);
    else SHAPES[sym.shape].forEach(([px, py], i) => (i ? g.lineTo(x + px * r, y + py * r) : g.moveTo(x + px * r, y + py * r)));
    g.closePath();
    g.fill();
  } else {
    g.font = `400 ${size * 1.05}px ${FONT_HEAD}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(sym.ch, x, y + size * 0.04);
    g.textBaseline = 'alphabetic';
  }
}

// ---------------------------------------------------------------------------------------------------------
// Generic "one stimulus at a time" engine for arrows + symbols6
// ---------------------------------------------------------------------------------------------------------

function trialTask(sh, cfg) {
  const { trials } = cfg;
  const N = trials.length;
  const results = [];
  let i = -1;
  let phase = 'wait'; // wait | fix | stim | fb
  let phT = 0;
  let fixDur = 0;
  let onset = 0;
  let fb = null;
  let streak = 0;
  let best = 0;
  let nCorrect = 0;
  let nDone = 0;

  const setTrial = sh.stat('שאלה', `0/${N}`);
  const setAcc = sh.stat('דיוק', '–');
  const setStreak = sh.stat('רצף', '0');
  cfg.buildBar(sh);

  function nextTrial() {
    i++;
    if (i >= N) return done();
    phase = 'fix';
    phT = 0;
    fixDur = cfg.fix();
    fb = null;
    setTrial(`${i + 1}/${N}`);
    sh.progress(i / N);
  }

  function record(kind, key, rt) {
    const tr = trials[i];
    const correct = kind === 'ok';
    results.push({ trial: tr, kind, key, rt, correct });
    nDone++;
    if (correct) {
      nCorrect++;
      streak++;
      best = Math.max(best, streak);
    } else streak = 0;
    setAcc(pct(nCorrect / nDone));
    setStreak(streak, correct && streak > 1);
    fb = { kind, rt };
    phase = 'fb';
    phT = 0;
    if (sh.practice) {
      const txt = cfg.feedbackText(tr, kind);
      sh.toast(txt, kind === 'ok' ? 'good' : kind === 'bad' ? 'bad' : 'warn', cfg.fbDur - 0.1);
    }
  }

  function done() {
    const res = cfg.score(results, nCorrect);
    sh.finish(res);
    phase = 'over';
  }

  return {
    keys: cfg.keys,
    update(dt) {
      if (phase === 'wait') {
        if (sh.playing) nextTrial();
        return;
      }
      if (phase === 'over') return;
      phT += dt;
      if (phase === 'fix' && phT >= fixDur) {
        phase = 'stim';
        phT = 0;
        onset = sh.t;
      } else if (phase === 'stim' && phT >= cfg.timeout) {
        sh.snd('bad');
        record('miss', null, null);
      } else if (phase === 'fb' && phT >= cfg.fbDur) {
        nextTrial();
      }
    },
    onKey(k) {
      if (phase !== 'stim' || !cfg.keys.includes(k)) return;
      const tr = trials[i];
      const rt = sh.t - onset;
      const ok = cfg.isCorrect(tr, k);
      if (ok) {
        sh.snd('ok');
        sh.flash(k, 'ok', 0.3);
      } else {
        sh.snd('bad');
        sh.flash(k, 'bad', 0.3);
        sh.flash(cfg.correctKey(tr), 'hint', 0.6);
      }
      record(ok ? 'ok' : 'bad', k, rt);
    },
    draw(g, W, H) {
      cfg.draw(g, W, H, {
        trial: trials[i],
        phase,
        age: phase === 'stim' ? sh.t - onset : phase === 'fb' ? sh.t - onset : 0,
        fb,
        fbT: phase === 'fb' ? phT : 0,
        t: sh.t,
        sh,
      });
    },
    state() {
      const tr = trials[i];
      return {
        task: cfg.id,
        trial: i + 1,
        total: N,
        trialPhase: phase,
        correct: nCorrect,
        streak,
        current: tr ? cfg.describe(tr) : null,
        correctKey: tr ? cfg.correctKey(tr) : null,
      };
    },
  };
}

function trialStats(results) {
  const ok = results.filter((r) => r.kind === 'ok');
  const bad = results.filter((r) => r.kind === 'bad').length;
  const miss = results.filter((r) => r.kind === 'miss').length;
  const rts = ok.map((r) => r.rt);
  return { n: results.length, correct: ok.length, wrong: bad, timeouts: miss, rts };
}

// ---------------------------------------------------------------------------------------------------------
// Task 2: arrows and squares
// ---------------------------------------------------------------------------------------------------------

const DIRS = {
  ArrowLeft: { angle: Math.PI, word: 'שמאלה' },
  ArrowRight: { angle: 0, word: 'ימינה' },
  ArrowUp: { angle: -Math.PI / 2, word: 'למעלה' },
  ArrowDown: { angle: Math.PI / 2, word: 'למטה' },
};
const DIR_GLYPH = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' };

function makeArrows(sh, def, practice) {
  const N = practice ? 4 : def.trials;
  // Mostly left/right (that is where the side of the screen conflicts with the direction), some up/down.
  const pool = ['ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
  const trials = [];
  let prev = null;
  for (let i = 0; i < N; i++) {
    let dir;
    do dir = practice ? ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowRight'][i] : pool[Math.floor(Math.random() * pool.length)];
    while (!practice && dir === prev && Math.random() < 0.6);
    prev = dir;
    // practice: first trial congruent, second incongruent, so the rule is clear.
    const arrowSide = practice ? ['right', 'right', 'left', 'left'][i] : Math.random() < 0.5 ? 'left' : 'right';
    trials.push({ dir, arrowSide, congruent: (dir === 'ArrowLeft' && arrowSide === 'left') || (dir === 'ArrowRight' && arrowSide === 'right') });
  }

  const keys = Object.keys(DIRS);
  const cfg = {
    id: 'arrows',
    trials,
    keys,
    timeout: practice ? 5 : 2.2,
    fbDur: practice ? 1.0 : 0.3,
    fix: () => (practice ? 0.8 : rand(0.45, 0.85)),
    isCorrect: (tr, k) => k === tr.dir,
    correctKey: (tr) => tr.dir,
    describe: (tr) => ({ dir: tr.dir, arrowSide: tr.arrowSide, squareSide: tr.arrowSide === 'left' ? 'right' : 'left', congruent: tr.congruent }),
    feedbackText: (tr, kind) =>
      kind === 'ok' ? 'נכון!' : kind === 'bad' ? `טעות – החץ הצביע ${DIRS[tr.dir].word}` : 'לא הספקתם – לחצו מהר יותר',
    buildBar(s) {
      s.addKey('ArrowLeft', '←', '', 'arrow');
      s.addKey('ArrowUp', '↑', '', 'arrow');
      s.addKey('ArrowDown', '↓', '', 'arrow');
      s.addKey('ArrowRight', '→', '', 'arrow');
      s.root.style.setProperty('--pp-ht-toast-top', '3%');
    },
    draw(g, W, H, c) {
      const col = sh.colors;
      // two side zones
      const zoneW = W * 0.4;
      const zoneH = H * 0.66;
      const zy = (H - zoneH) / 2;
      for (const side of ['left', 'right']) {
        const zx = side === 'left' ? W * 0.05 : W * 0.55;
        rr(g, zx, zy, zoneW, zoneH, 18);
        g.fillStyle = 'rgba(24,39,66,0.45)';
        g.fill();
        g.lineWidth = 1.5;
        g.setLineDash([6, 7]);
        g.strokeStyle = col.line;
        g.stroke();
        g.setLineDash([]);
      }
      // fixation cross
      const cx = W / 2;
      const cy = H / 2;
      g.strokeStyle = 'rgba(159,176,211,0.55)';
      g.lineWidth = 2.5;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(cx - 9, cy);
      g.lineTo(cx + 9, cy);
      g.moveTo(cx, cy - 9);
      g.lineTo(cx, cy + 9);
      g.stroke();

      const tr = c.trial;
      if (tr && (c.phase === 'stim' || c.phase === 'fb')) {
        const s = Math.min(H * 0.32, W * 0.16, 150);
        const age = c.age;
        const pop = easeOutBack(age / 0.14);
        const slide = 1 - easeOut(age / 0.17);
        const alpha = clamp(age / 0.05);
        const fbKind = c.fb?.kind;
        const fbk = c.fbT;
        const shake = fbKind && fbKind !== 'ok' ? Math.sin(fbk * 55) * 7 * Math.exp(-fbk * 7) : 0;
        const pulse = fbKind === 'ok' ? 1 + 0.1 * Math.sin(clamp(fbk / 0.22) * Math.PI) : 1;
        const sqSide = tr.arrowSide === 'left' ? 'right' : 'left';
        const posX = (side) => (side === 'left' ? W * 0.25 : W * 0.75);
        const outward = (side) => (side === 'left' ? -1 : 1);

        // the square (the distractor)
        {
          const x = posX(sqSide) + outward(sqSide) * -slide * W * 0.1 + shake * 0.4;
          g.save();
          g.globalAlpha = alpha * (fbKind ? 0.8 : 1);
          g.translate(x, cy);
          g.scale(pop, pop);
          const q = s * 0.9;
          rr(g, -q / 2, -q / 2, q, q, 14);
          const gr = g.createLinearGradient(0, -q / 2, 0, q / 2);
          gr.addColorStop(0, '#ffd77a');
          gr.addColorStop(1, '#f09a1b');
          g.fillStyle = gr;
          g.shadowColor = 'rgba(255,190,70,0.55)';
          g.shadowBlur = 22;
          g.fill();
          g.shadowBlur = 0;
          rr(g, -q / 2 + 6, -q / 2 + 6, q - 12, q * 0.28, 8);
          g.fillStyle = 'rgba(255,255,255,0.22)';
          g.fill();
          g.restore();
        }
        // the arrow (the one that counts)
        {
          const x = posX(tr.arrowSide) + outward(tr.arrowSide) * -slide * W * 0.1 + shake;
          g.save();
          g.globalAlpha = alpha;
          g.translate(x, cy);
          g.scale(pop * pulse, pop * pulse);
          g.rotate(DIRS[tr.dir].angle);
          const a = s * 1.1;
          g.beginPath();
          g.moveTo(-0.5 * a, -0.17 * a);
          g.lineTo(0.08 * a, -0.17 * a);
          g.lineTo(0.08 * a, -0.43 * a);
          g.lineTo(0.56 * a, 0);
          g.lineTo(0.08 * a, 0.43 * a);
          g.lineTo(0.08 * a, 0.17 * a);
          g.lineTo(-0.5 * a, 0.17 * a);
          g.closePath();
          const tint = fbKind === 'ok' ? [col.good, '#b9f5da'] : fbKind ? [col.bad, '#ffc4c4'] : [col.accent, '#ffffff'];
          const gr = g.createLinearGradient(-0.5 * a, 0, 0.56 * a, 0);
          gr.addColorStop(0, tint[0]);
          gr.addColorStop(1, tint[1]);
          g.fillStyle = gr;
          g.shadowColor = fbKind === 'ok' ? 'rgba(76,210,154,0.7)' : fbKind ? 'rgba(255,107,107,0.7)' : 'rgba(78,161,255,0.7)';
          g.shadowBlur = 24;
          g.fill();
          g.restore();
        }
        // reaction time, faint
        if (fbKind === 'ok' && !sh.practice) {
          g.font = `700 14px ${FONT}`;
          g.fillStyle = `rgba(159,176,211,${1 - fbk / cfg.fbDur})`;
          g.fillText(`${ms(c.fb.rt)} מ״ש`, cx, H * 0.9);
        }
      }
      // result flash around the whole stage
      if (c.phase === 'fb' && c.fb) {
        const k = 1 - c.fbT / cfg.fbDur;
        g.lineWidth = 4;
        g.strokeStyle = c.fb.kind === 'ok' ? `rgba(76,210,154,${0.7 * k})` : `rgba(255,107,107,${0.8 * k})`;
        rr(g, 3, 3, W - 6, H - 6, 14);
        g.stroke();
      }
      if (sh.practice && c.phase === 'fix' && c.trial) {
        g.font = `600 ${Math.max(13, Math.min(18, W / 48))}px ${FONT}`;
        g.fillStyle = col.muted;
        g.fillText('לחצו על מקש החץ לפי הכיוון שאליו החץ מצביע', cx, H * 0.95);
      }
    },
    score(results) {
      const st = trialStats(results);
      const acc = st.correct / Math.max(1, st.n);
      const med = median(st.rts);
      const speed = st.rts.length ? clamp((1.4 - med) / (1.4 - 0.5)) : 0;
      const congr = results.filter((r) => r.correct && r.trial.congruent).map((r) => r.rt);
      const incong = results.filter((r) => r.correct && r.trial.congruent === false && r.trial.dir !== 'ArrowUp' && r.trial.dir !== 'ArrowDown').map((r) => r.rt);
      return {
        score: clamp(0.6 * acc + 0.4 * speed),
        summary: `${st.correct} מתוך ${st.n} נכון · זמן תגובה חציוני ${ms(med)} מ״ש`,
        stats: {
          trials: st.n,
          correct: st.correct,
          wrong: st.wrong,
          timeouts: st.timeouts,
          accuracy: acc,
          medianRtMs: ms(med),
          meanRtMs: ms(mean(st.rts)),
          speedTerm: speed,
          congruentRtMs: ms(mean(congr)),
          incongruentRtMs: ms(mean(incong)),
        },
      };
    },
  };
  return trialTask(sh, cfg);
}

// ---------------------------------------------------------------------------------------------------------
// Task 3: six symbols, six keys
// ---------------------------------------------------------------------------------------------------------

const SYM_KEYS = ['s', 'd', 'f', 'j', 'k', 'l'];

function makeSymbols6(sh, def, practice) {
  const N = practice ? 4 : def.trials;
  const digits = shuffle(['2', '3', '4', '5', '7', '8', '9']).slice(0, 2);
  const letters = shuffle(['A', 'B', 'M', 'R', 'K', 'T', 'Z']).slice(0, 2);
  const shapes = shuffle(['tri', 'sq', 'circle', 'diamond', 'star', 'hex']).slice(0, 2);
  const symbols = shuffle([
    ...digits.map((ch) => ({ kind: 'digit', ch })),
    ...letters.map((ch) => ({ kind: 'letter', ch })),
    ...shapes.map((shape) => ({ kind: 'shape', shape })),
  ]).map((s, idx) => ({ ...s, id: idx, key: SYM_KEYS[idx] }));

  // Each symbol the same number of times, never twice in a row.
  const order = [];
  const reps = Math.ceil(N / 6);
  let bag = shuffle(Array.from({ length: reps * 6 }, (_, i) => i % 6));
  for (let tries = 0; tries < 50; tries++) {
    if (bag.every((v, i) => i === 0 || v !== bag[i - 1])) break;
    bag = shuffle(bag);
  }
  for (let i = 0; i < N; i++) order.push(bag[i]);
  const trials = order.map((id) => ({ sym: symbols[id] }));

  const cfg = {
    id: 'symbols6',
    trials,
    keys: SYM_KEYS,
    timeout: practice ? 8 : 4,
    fbDur: practice ? 1.0 : 0.3,
    fix: () => (practice ? 0.7 : rand(0.3, 0.55)),
    isCorrect: (tr, k) => k === tr.sym.key,
    correctKey: (tr) => tr.sym.key,
    describe: (tr) => ({ symbol: tr.sym.shape || tr.sym.ch, key: tr.sym.key }),
    feedbackText: (tr, kind) => (kind === 'ok' ? 'נכון!' : kind === 'bad' ? `טעות – המקש הנכון הוא ${tr.sym.key.toUpperCase()}` : 'לא הספקתם – לחצו מהר יותר'),
    buildBar(s) {
      s.root.style.setProperty('--pp-ht-toast-top', '4%');
      symbols.forEach((sym, idx) => {
        if (idx === 3) s.addGap();
        const inner = sym.kind === 'shape' ? shapeSvg(sym.shape) : sym.ch;
        s.addKey(sym.key, inner, sym.key.toUpperCase(), 'sym');
      });
    },
    draw(g, W, H, c) {
      const col = sh.colors;
      const cx = W / 2;
      const cy = H / 2;
      const size = Math.min(H * 0.62, W * 0.34, 230);
      // card
      const glow = c.phase === 'fb' && c.fb ? (c.fb.kind === 'ok' ? col.good : col.bad) : col.accent;
      g.save();
      g.translate(cx, cy);
      const stimOn = c.trial && (c.phase === 'stim' || c.phase === 'fb');
      const pop = stimOn ? easeOutBack(c.age / 0.14) : 1;
      const fbk = c.fbT;
      const shake = c.phase === 'fb' && c.fb && c.fb.kind !== 'ok' ? Math.sin(fbk * 55) * 8 * Math.exp(-fbk * 7) : 0;
      g.translate(shake, 0);
      g.scale(stimOn ? pop : 1, stimOn ? pop : 1);
      rr(g, -size / 2, -size / 2, size, size, 26);
      const gr = g.createLinearGradient(0, -size / 2, 0, size / 2);
      gr.addColorStop(0, '#1f3358');
      gr.addColorStop(1, '#122040');
      g.fillStyle = gr;
      g.shadowColor = stimOn ? glow : 'rgba(0,0,0,0)';
      g.shadowBlur = stimOn ? 26 : 0;
      g.fill();
      g.shadowBlur = 0;
      g.lineWidth = 2.5;
      g.strokeStyle = stimOn ? glow : col.line;
      g.stroke();
      if (stimOn) {
        const a = clamp(c.age / 0.05);
        g.globalAlpha = a;
        drawGlyph(g, c.trial.sym, 0, 0, size * 0.52, c.phase === 'fb' && c.fb?.kind === 'ok' ? '#d4ffec' : '#ffffff');
      } else {
        g.font = `400 ${size * 0.4}px ${FONT_HEAD}`;
        g.fillStyle = 'rgba(159,176,211,0.35)';
        g.textBaseline = 'middle';
        g.fillText('+', 0, 0);
      }
      g.restore();

      if (c.phase === 'fb' && c.fb?.kind === 'ok' && !sh.practice) {
        g.font = `700 14px ${FONT}`;
        g.fillStyle = `rgba(159,176,211,${1 - c.fbT / cfg.fbDur})`;
        g.fillText(`${ms(c.fb.rt)} מ״ש`, cx, cy + size / 2 + 24);
      }
      if (sh.practice && (c.phase === 'fix' || c.phase === 'stim') && c.trial) {
        g.font = `600 ${Math.max(13, Math.min(18, W / 48))}px ${FONT}`;
        g.fillStyle = col.muted;
        g.fillText('לחצו על המקש שמתאים לסמל, לפי הטבלה למטה', cx, H * 0.95);
      }
    },
    score(results) {
      const st = trialStats(results);
      const acc = st.correct / Math.max(1, st.n);
      const med = median(st.rts);
      const speed = st.rts.length ? clamp((1.8 - med) / (1.8 - 0.55)) : 0;
      return {
        score: clamp(0.6 * acc + 0.4 * speed),
        summary: `${st.correct} מתוך ${st.n} נכון · זמן תגובה חציוני ${ms(med)} מ״ש`,
        stats: {
          trials: st.n,
          correct: st.correct,
          wrong: st.wrong,
          timeouts: st.timeouts,
          accuracy: acc,
          medianRtMs: ms(med),
          meanRtMs: ms(mean(st.rts)),
          speedTerm: speed,
          mapping: symbols.map((s) => ({ key: s.key.toUpperCase(), symbol: s.shape || s.ch })),
        },
      };
    },
  };
  return trialTask(sh, cfg);
}

// ---------------------------------------------------------------------------------------------------------
// Task 4: fast two-key sorting (even / odd) for ~45 s
// ---------------------------------------------------------------------------------------------------------

function makeSort2(sh, def, practice) {
  const T = practice ? def.practiceSeconds : def.seconds;
  const windowAt = (pt) => (practice ? 1.8 : lerp(1.3, 0.78, clamp(pt / T)));
  const maxItems = practice ? 8 : 9999;
  const col = sh.colors;

  const setLeft = sh.stat('זמן', Math.ceil(T));
  const setAcc = sh.stat('דיוק', '–');
  const setCount = sh.stat('מספרים', '0');
  sh.addKey('f', 'F', 'זוגי', 'wide');
  sh.addKey('j', 'J', 'אי־זוגי', 'wide');

  let item = null; // { n, even, onset, win, outcome, rt, respAt }
  let started = false;
  let over = false;
  let count = 0;
  let nCorrect = 0;
  let nWrong = 0;
  let nMiss = 0;
  let streakSame = 0;
  let lastEven = null;
  let lastN = -1;
  const rts = [];
  const ringFlash = { color: null, t: 99 };

  function spawn(at) {
    let even;
    if (lastEven !== null && streakSame >= 3) even = !lastEven;
    else even = Math.random() < 0.5;
    streakSame = even === lastEven ? streakSame + 1 : 1;
    lastEven = even;
    let n;
    do {
      n = 11 + Math.floor(Math.random() * 88);
      if ((n % 2 === 0) !== even) n += n > 50 ? -1 : 1;
    } while (n === lastN);
    lastN = n;
    item = { n, even, onset: at, win: windowAt(at), outcome: null, rt: null, respAt: 0 };
    count++;
    setCount(count);
  }

  function resolve(outcome, rt) {
    item.outcome = outcome;
    item.rt = rt;
    item.respAt = sh.playT;
    ringFlash.color = outcome === 'ok' ? col.good : col.bad;
    ringFlash.t = 0;
    if (outcome === 'ok') {
      nCorrect++;
      rts.push(rt);
    } else if (outcome === 'bad') nWrong++;
    else nMiss++;
    setAcc(pct(nCorrect / Math.max(1, nCorrect + nWrong + nMiss)));
    if (sh.practice) sh.toast(outcome === 'ok' ? 'נכון!' : outcome === 'bad' ? 'טעות' : 'לא הספקתם', outcome === 'ok' ? 'good' : outcome === 'bad' ? 'bad' : 'warn', 0.6);
  }

  function finishUp() {
    over = true;
    const n = nCorrect + nWrong + nMiss;
    const score = clamp((nCorrect - 0.5 * nMiss) / Math.max(1, n));
    sh.finish({
      score,
      summary: `${nCorrect} נכון, ${nWrong === 1 ? 'טעות אחת' : `${nWrong} טעויות`}, ${nMiss === 1 ? 'אחד שלא הספקתם' : `${nMiss} שלא הספקתם`} · דיוק ${pct(nCorrect / Math.max(1, n))}`,
      stats: {
        items: n,
        correct: nCorrect,
        wrong: nWrong,
        misses: nMiss,
        accuracy: nCorrect / Math.max(1, n),
        medianRtMs: ms(median(rts)),
        meanRtMs: ms(mean(rts)),
      },
    });
  }

  return {
    keys: ['f', 'j'],
    update(dt) {
      ringFlash.t += dt;
      if (!sh.playing || over) return;
      const pt = sh.playT;
      setLeft(Math.max(0, Math.ceil(T - pt)));
      sh.progress(pt / T);
      if (!started) {
        started = true;
        spawn(pt);
        return;
      }
      if (item && pt - item.onset >= item.win) {
        if (!item.outcome) {
          sh.snd('bad');
          resolve('miss', null);
        }
        const nextAt = item.onset + item.win;
        if (nextAt >= T || count >= maxItems) {
          item = null;
          finishUp();
          return;
        }
        spawn(nextAt);
        // a long frame can skip over more than one window: keep catching up
        while (item && pt - item.onset >= item.win) {
          resolve('miss', null);
          const n2 = item.onset + item.win;
          if (n2 >= T || count >= maxItems) {
            item = null;
            finishUp();
            return;
          }
          spawn(n2);
        }
      }
    },
    onKey(k) {
      if (over || !item || item.outcome) return;
      if (k !== 'f' && k !== 'j') return;
      const rt = sh.playT - item.onset;
      const ok = (k === 'f') === item.even;
      sh.snd(ok ? 'ok' : 'bad');
      sh.flash(k, ok ? 'ok' : 'bad', 0.25);
      if (!ok) sh.flash(item.even ? 'f' : 'j', 'hint', 0.45);
      resolve(ok ? 'ok' : 'bad', rt);
    },
    draw(g, W, H) {
      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(W * 0.3, H * 0.4);
      const frac = clamp(sh.playT / T);
      // ring: total progress
      g.lineWidth = Math.max(8, R * 0.09);
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(159,176,211,0.15)';
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      g.stroke();
      if (frac > 0.002) {
        const gr = g.createLinearGradient(cx - R, cy, cx + R, cy);
        gr.addColorStop(0, col.accent);
        gr.addColorStop(1, col.accent2);
        g.strokeStyle = gr;
        g.beginPath();
        g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        g.stroke();
      }
      // flash on the answer
      if (ringFlash.color && ringFlash.t < 0.35) {
        g.globalAlpha = 1 - ringFlash.t / 0.35;
        g.lineWidth = Math.max(5, R * 0.05);
        g.strokeStyle = ringFlash.color;
        g.beginPath();
        g.arc(cx, cy, R - R * 0.12, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
      }
      // the number
      if (item) {
        const age = sh.playT - item.onset;
        const shownUntil = item.outcome ? item.respAt - item.onset + 0.18 : item.win - 0.1;
        if (age < shownUntil) {
          const pop = easeOutBack(age / 0.1);
          const a = clamp(age / 0.04);
          g.save();
          g.translate(cx, cy);
          g.scale(0.7 + 0.3 * pop, 0.7 + 0.3 * pop);
          g.globalAlpha = a;
          g.font = `400 ${R * 0.95}px ${FONT_HEAD}`;
          g.textBaseline = 'middle';
          g.fillStyle = item.outcome === 'ok' ? col.good : item.outcome ? col.bad : '#ffffff';
          g.fillText(String(item.n), 0, R * 0.04);
          g.restore();
          // time left for this number
          if (!item.outcome) {
            const left = clamp(1 - age / item.win);
            const bw = R * 0.9;
            const by = cy + R * 0.62;
            rr(g, cx - bw / 2, by, bw, 6, 3);
            g.fillStyle = 'rgba(255,255,255,0.1)';
            g.fill();
            rr(g, cx - bw / 2, by, Math.max(6, bw * left), 6, 3);
            g.fillStyle = left < 0.3 ? col.warn : col.accent2;
            g.fill();
          }
        }
      } else if (!sh.playing) {
        g.font = `600 ${Math.max(14, R * 0.18)}px ${FONT}`;
        g.fillStyle = col.muted;
        g.fillText('F = זוגי · J = אי־זוגי', cx, cy + R * 0.05);
      }
      g.textBaseline = 'alphabetic';
    },
    state() {
      return {
        task: 'sort2',
        item: item ? { n: item.n, even: item.even, answered: !!item.outcome } : null,
        correctKey: item ? (item.even ? 'f' : 'j') : null,
        count,
        correct: nCorrect,
        wrong: nWrong,
        misses: nMiss,
      };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------
// Task 1: bucket and water (a Balloon-Analogue-Risk-Task style game, drawn as a rope + bucket + tap)
// ---------------------------------------------------------------------------------------------------------

const SW = 900; // scene size (logical units)
const SHH = 470;
const FLOOR = 436;
const PIV = { x: 460, y: 22 };
const BH = 150; // bucket body height
const HT = 78; // half width at the rim
const HB = 58; // half width at the bottom
const RIM_Y = 56; // rim centre, below the rope ring
const RIM_RY = 13;
const L0 = 96; // rope length (pivot to ring) when empty
const TAP = { x: 423, y: 124 }; // nozzle
const PTS_PER_POUR = 5;
const CAP = 20; // pours that fill the bucket visually
const TARGET_AVG = 24; // average banked per bucket that earns a full score
const CRATE = { x: 770, y: 366 };

const hwAt = (y) => lerp(HT, HB, clamp((y - RIM_Y) / BH));

function makeBucket(sh, def, practice) {
  const g = sh.g;
  const col = sh.colors;
  const NB = practice ? 3 : def.buckets;
  const LIMIT = practice ? def.practiceSeconds : def.seconds;
  // Hidden break points: spread over 1..20 (stratified so ten buckets are a fair sample), shuffled.
  const breaks = practice ? [8, 15, 6] : shuffle(Array.from({ length: NB }, (_, i) => Math.round(((i + 0.5) * 20) / NB + rand(-0.9, 0.9))).map((v) => clamp(Math.round(v), 1, 20)));

  const setNo = sh.stat('דלי', `1/${NB}`);
  const setScore = sh.stat('שמרתם', '0');
  const setCur = sh.stat('בדלי', '0');
  const setTime = sh.stat('זמן', Math.ceil(LIMIT));
  sh.addKey('Space', '▼', 'מזגו · רווח', 'wide');
  sh.addKey('Enter', '✓', 'שמרו · Enter', 'wide');

  // state
  let idx = 0;
  let phase = 'idle'; // idle | strain | snap | bank | enter
  let phT = 0;
  let pumps = 0;
  let B = breaks[0];
  let hint = rand(0.4, 1);
  let level = 0;
  let slosh = 0;
  let sway = 0;
  let swayV = 0;
  let stretch = 0;
  let stretchV = 0;
  let tension = 0;
  let hoist = 0;
  let activeT = 0;
  let pourT = 0;
  let pourAmt = 0;
  let valveAngle = 0;
  let creakT = 0;
  let dripT = 1.1;
  let shake = 0;
  let fallY = 0;
  let fallV = 0;
  let spin = 0;
  let spinV = 0;
  let tilt = 0;
  let tiltDir = 1;
  let landed = false;
  let bounced = false;
  let puddle = 0;
  let puddleA = 0;
  let glow = 0;
  let snapInfo = null;
  let banked = 0; // shown in the HUD (grows as coins arrive)
  let bankedTotal = 0; // real total
  let nBanked = 0;
  let nSnapped = 0;
  let timedOut = false;
  let crateAmt = 0;
  let cratePulse = 0;
  const outcomes = [];
  const particles = [];
  const coins = [];
  const floaters = [];
  const bubbles = [];
  const fibers = Array.from({ length: 10 }, () => ({ y: rand(0.3, 0.55), dx: rand(-1, 1), len: rand(3, 8), rot: rand(-0.7, 0.7) }));

  // Wide screens show the whole workshop; portrait phones crop to the middle and pull the crate / tag closer.
  let crateX = CRATE.x;
  let tagX = 630;
  function applyLayout() {
    const W = sh.W;
    const H = sh.H;
    const narrow = W / H < 1.3;
    const vw = narrow ? 540 : SW;
    const cx = narrow ? 465 : SW / 2;
    crateX = narrow ? 640 : CRATE.x;
    tagX = narrow ? 612 : 630;
    const u = Math.min(W / vw, H / SHH);
    return { u, ox: W / 2 - cx * u, oy: (H - SHH * u) / 2 };
  }

  const ropeLen = () => L0 + stretch;
  const ringY = () => PIV.y + ropeLen() + hoist + fallY;
  const surfLocal = () => RIM_Y + BH - 5 - level * (BH - 22);

  function startBucket() {
    pumps = 0;
    B = breaks[idx];
    hint = rand(0.4, 1);
    level = 0;
    slosh = 0;
    tension = 0;
    stretch = 0;
    stretchV = 0;
    fallY = 0;
    fallV = 0;
    spin = 0;
    tilt = 0;
    landed = false;
    bounced = false;
    snapInfo = null;
    glow = 0;
    bubbles.length = 0;
    setCur(0);
    setNo(`${idx + 1}/${NB}`);
  }

  function spawnDrop(x, y, vx, vy, r = 2.5, land = false) {
    particles.push({ kind: 'drop', x, y, vx, vy, r, life: 2, land });
  }

  function pour() {
    pumps++;
    slosh = Math.min(slosh + 1.2, 3);
    swayV += rand(-0.35, 0.35);
    stretchV += 55;
    pourT = 0.3;
    pourAmt++;
    sh.snd('pour', 0.24);
    sh.after(0.1, () => sh.snd('drip'));
    sh.after(0.2, () => sh.snd('drip'));
    for (let k = 0; k < 3; k++) spawnDrop(TAP.x + rand(-3, 3), TAP.y, rand(-14, 14), rand(60, 140), rand(1.8, 3), true);
    for (let k = 0; k < 4; k++) bubbles.push({ x: rand(-HB + 12, HB - 12), y: RIM_Y + BH - 12, r: rand(1.5, 3.5), vy: rand(25, 55), ph: rand(0, 6) });
    if (pumps >= B) {
      phase = 'strain';
      phT = 0;
      sh.snd('bad');
      sh.tone(150, 0.22, { type: 'sawtooth', volume: 0.07, slide: 320 });
      sh.noise(0.2, { freq: 1800, q: 1.4, volume: 0.1 });
      return;
    }
    setCur(pumps * PTS_PER_POUR);
    if (tension > 0.4) creak(0.5 + tension * 0.5);
  }

  function creak(strength = 1) {
    if (!sh.hasFx) return;
    sh.tone(110 + Math.random() * 60, 0.22, { type: 'sawtooth', volume: 0.035 * strength, slide: 70 + Math.random() * 50 });
    sh.noise(0.16, { freq: 700 + Math.random() * 300, q: 3, volume: 0.04 * strength });
  }

  function bankIt() {
    if (pumps <= 0) {
      floaters.push({ text: 'קודם תמלאו קצת', x: 460, y: 190, vy: -20, life: 1, max: 1, color: col.warn, size: 22 });
      return;
    }
    const pts = pumps * PTS_PER_POUR;
    bankedTotal += pts;
    nBanked++;
    outcomes.push({ bucket: idx + 1, pumps, points: pts, outcome: 'banked', breakAt: B });
    phase = 'bank';
    phT = 0;
    glow = 1;
    setCur(0);
    sh.snd('ok');
    const n = Math.min(10, Math.max(3, Math.ceil(pumps / 1.5)));
    const each = pts / n;
    const ry = ringY() + RIM_Y;
    for (let k = 0; k < n; k++) {
      coins.push({ x: 460 + rand(-30, 30), y: ry + rand(-10, 10), sx: 460 + rand(-30, 30), sy: ry, t: -k * 0.055, dur: 0.75, value: each, rise: rand(70, 130) });
    }
    floaters.push({ text: `+${pts}`, x: 460, y: ry - 20, vy: -45, life: 1.2, max: 1.2, color: col.good, size: 40 });
    if (sh.practice) sh.toast(`נכון! שמרתם ${pts} נקודות`, 'good', 1.1);
  }

  function startSnap() {
    phase = 'snap';
    phT = 0;
    const lost = (pumps - 1) * PTS_PER_POUR; // the pour that broke the rope never counted
    nSnapped++;
    outcomes.push({ bucket: idx + 1, pumps: pumps, points: 0, lost: Math.max(0, lost), outcome: 'snapped', breakAt: B });
    const L = ropeLen();
    snapInfo = { f: 0.42, lost: Math.max(0, lost), L, theta: sway, tipSeed: rand(0, 6) };
    fallV = -60;
    spinV = rand(-1.2, 1.2);
    shake = Math.max(shake, 7);
    sh.snd('crash'); // crack of the rope and the fall
    sh.noise(0.1, { freq: 3600, q: 1.2, volume: 0.22 });
    setCur(0);
    for (let k = 0; k < 10; k++) {
      particles.push({ kind: 'fibre', x: PIV.x + Math.sin(sway) * L * 0.42, y: PIV.y + Math.cos(sway) * L * 0.42, vx: rand(-90, 90), vy: rand(-120, 20), r: rand(2, 5), life: 0.9, rot: rand(0, 6), vr: rand(-8, 8) });
    }
    if (sh.practice) sh.toast('טעות – הדלי נפל והנקודות אבדו', 'bad', 1.4);
    else floaters.push({ text: 'החבל נקרע!', x: 460, y: 78, vy: -8, life: 1.5, max: 1.5, color: col.bad, size: 38 });
  }

  function land() {
    landed = true;
    shake = 17;
    tiltDir = Math.random() < 0.5 ? -1 : 1;
    sh.snd('splash');
    const n = 22 + Math.round(level * 50);
    const baseY = FLOOR - 6;
    for (let k = 0; k < n; k++) {
      const a = rand(-Math.PI * 0.95, -Math.PI * 0.05);
      const sp = rand(120, 430);
      particles.push({ kind: 'drop', x: 460 + rand(-50, 50), y: baseY - 20, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(2, 5), life: 1.6, land: false, floor: true });
    }
    for (let k = 0; k < 9; k++) {
      particles.push({ kind: 'wood', x: 460 + rand(-60, 60), y: baseY - 10, vx: rand(-220, 220), vy: rand(-340, -120), r: rand(3, 7), life: 1.3, rot: rand(0, 6), vr: rand(-12, 12) });
    }
    puddle = 1;
    puddleA = 0.75;
    if (snapInfo?.lost > 0) floaters.push({ text: `-${snapInfo.lost}`, x: 460, y: FLOOR - 70, vy: -50, life: 1.5, max: 1.5, color: col.bad, size: 38 });
  }

  function nextBucket() {
    idx++;
    if (idx >= NB) return finishUp();
    startBucket();
    phase = 'enter';
    phT = 0;
    hoist = -440;
  }

  function finishUp(timeUp = false) {
    timedOut = timeUp;
    const played = nBanked + nSnapped;
    const avg = bankedTotal / Math.max(1, played);
    const score = clamp(avg / TARGET_AVG);
    const bankedOnes = outcomes.filter((o) => o.outcome === 'banked');
    const avgPumpsBanked = mean(bankedOnes.map((o) => o.pumps));
    const avgPumpsAll = mean(outcomes.map((o) => o.pumps));
    let style = '';
    if (played > 0) {
      if (nBanked === 0) style = 'נועזים מדי';
      else if (avgPumpsBanked < 5) style = 'זהירים מאוד';
      else if (avgPumpsBanked < 7) style = 'זהירים';
      else if (avgPumpsBanked <= 13) style = 'מאוזנים';
      else style = 'נועזים';
    }
    sh.finish({
      score,
      summary:
        played === 0
          ? 'לא הספקתם לשמור אף דלי'
          : `${nBanked === 1 ? 'דלי אחד נשמר' : `${nBanked} דליים נשמרו`}, ${nSnapped === 0 ? 'אף חבל לא נקרע' : nSnapped === 1 ? 'חבל אחד נקרע' : `${nSnapped} חבלים נקרעו`} · ממוצע ${Math.round(avg)} נקודות לדלי · סגנון: ${style}`,
      stats: {
        buckets: played,
        banked: nBanked,
        snapped: nSnapped,
        totalPoints: bankedTotal,
        avgPoints: avg,
        avgPumpsBanked,
        avgPumpsAll,
        timedOut,
        activeSeconds: +activeT.toFixed(1),
        style,
        outcomes,
      },
    });
    phase = 'over';
  }

  function tensionTarget() {
    if (phase === 'strain') return 1;
    const a = (0.35 * pumps) / CAP;
    const b = 0.6 * hint * clamp((pumps - (B - 5)) / 5);
    return clamp(a + b);
  }

  function update(dt) {
    applyLayout();
    const t = sh.t;
    // ---- ambient motion that always runs ----
    slosh *= Math.exp(-1.15 * dt);
    level += ((Math.min(pumps, CAP) / CAP - level) * (1 - Math.exp(-7 * dt)));
    if (phase === 'snap' || phase === 'over') {
      // level handled in the snap branch
    }
    swayV += (-26 * sway - 1.6 * swayV) * dt;
    sway += swayV * dt;
    sway += Math.sin(t * 1.3) * 0.00025;
    const stretchT = 12 * level + 9 * tension;
    stretchV += (-90 * (stretch - stretchT) - 9 * stretchV) * dt;
    stretch += stretchV * dt;
    tension += (tensionTarget() - tension) * (1 - Math.exp(-6 * dt));
    pourT = Math.max(0, pourT - dt);
    if (pourT > 0) valveAngle += dt * 9;
    glow = Math.max(0, glow - dt * 2.2);
    shake = Math.max(0, shake * Math.exp(-6 * dt) - dt * 0.5);
    cratePulse = Math.max(0, cratePulse - dt * 3);
    puddleA = Math.max(0, puddleA - dt * (phase === 'snap' ? 0.05 : 0.5));

    // bubbles
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.y -= b.vy * dt;
      b.x += Math.sin(t * 4 + b.ph) * 8 * dt;
      if (b.y < surfLocal() + 4) bubbles.splice(i, 1);
    }

    // stream splashes
    if (pourT > 0 && Math.random() < dt * 40) {
      spawnDrop(TAP.x + rand(-4, 4), ringY() + surfLocal() - 2, rand(-50, 50), rand(-110, -50), rand(1.2, 2.2));
    }

    // ---- phases ----
    const playing = sh.playing;
    if (phase === 'idle') {
      if (playing) {
        activeT += dt;
        setTime(Math.max(0, Math.ceil(LIMIT - activeT)));
        sh.progress(Math.max((nBanked + nSnapped) / NB, activeT / LIMIT));
        if (activeT >= LIMIT) {
          sh.toast('הזמן נגמר', 'warn', 1);
          if (pumps > 0) outcomes.push({ bucket: idx + 1, pumps, points: 0, outcome: 'time', breakAt: B });
          return finishUp(true);
        }
        creakT -= dt;
        if (tension > 0.45 && creakT <= 0) {
          creak(tension);
          creakT = rand(0.7, 1.4);
        }
        dripT -= dt;
        if (dripT <= 0) {
          dripT = rand(1.1, 2);
          spawnDrop(TAP.x, TAP.y, 0, 20, 2.4, true);
        }
      }
    } else if (phase === 'strain') {
      phT += dt;
      shake = Math.max(shake, 2.5);
      if (phT >= 0.24) startSnap();
    } else if (phase === 'snap') {
      phT += dt;
      fallV += 2100 * dt;
      fallY += fallV * dt;
      spin += spinV * dt;
      const base = PIV.y + snapInfo.L;
      const maxFall = FLOOR - (base + RIM_Y + BH);
      if (!landed) {
        if (fallY >= maxFall) {
          fallY = maxFall;
          land();
          fallV = -fallV * 0.2;
          spinV = 0;
        }
      } else {
        if (fallY >= maxFall && fallV > 0) {
          fallY = maxFall;
          fallV = 0;
        }
        pumps = 0; // spilled
        level *= Math.exp(-5 * dt);
        tilt += (tiltDir * 0.55 - tilt) * (1 - Math.exp(-9 * dt));
        spin += (0 - spin) * (1 - Math.exp(-8 * dt));
        puddle = Math.min(1.6, puddle + dt * 1.6);
      }
      if (phT >= 1.15) {
        if (idx + 1 >= NB) finishUp();
        else nextBucket();
      }
    } else if (phase === 'bank') {
      phT += dt;
      hoist = -easeIn(phT / 0.45) * 460;
      if (phT >= 0.45) {
        hoist = -460;
        if (idx + 1 >= NB) {
          // let the coins finish flying
          if (!coins.length) finishUp();
        } else nextBucket();
      }
    } else if (phase === 'enter') {
      phT += dt;
      hoist = -(1 - easeOutBack(phT / 0.5)) * 440;
      if (phT >= 0.5) {
        hoist = 0;
        phase = 'idle';
      }
    }

    // ---- particles ----
    const surfW = ringY() + surfLocal();
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.vy += (p.kind === 'fibre' ? 200 : 950) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.rot !== undefined) p.rot += p.vr * dt;
      if (p.land && phase !== 'snap' && p.vy > 0 && p.y >= surfW && Math.abs(p.x - 460) < HT) {
        // droplet hits the water: ripple + tiny sound
        slosh = Math.min(slosh + 0.18, 3);
        if (Math.random() < 0.5) sh.snd('drip');
        for (let k = 0; k < 2; k++) spawnDrop(p.x, surfW - 1, rand(-35, 35), rand(-90, -40), rand(1, 1.8));
        particles.splice(i, 1);
        continue;
      }
      if (p.floor && p.y > FLOOR - 4 && p.vy > 0) {
        p.y = FLOOR - 4;
        p.vy *= -0.25;
        p.vx *= 0.6;
        if (Math.abs(p.vy) < 20) p.life = Math.min(p.life, 0.2);
      }
      if (p.life <= 0 || p.y > SHH + 40 || (p.kind === 'drop' && !p.floor && p.y > FLOOR)) particles.splice(i, 1);
    }

    // ---- coins ----
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.t += dt;
      if (c.t < 0) continue;
      const k = clamp(c.t / c.dur);
      const e = easeIn(k) * 0.5 + k * 0.5;
      c.x = lerp(c.sx, crateX + 40, e);
      c.y = lerp(c.sy, CRATE.y + 10, e) - Math.sin(k * Math.PI) * c.rise;
      if (k >= 1) {
        coins.splice(i, 1);
        banked += c.value;
        crateAmt += c.value;
        setScore(Math.round(banked), true);
        cratePulse = 1;
        sh.snd('coin');
      }
    }
    if (phase === 'bank' && phT >= 0.45 && idx + 1 >= NB && !coins.length) finishUp();

    // ---- floaters ----
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.life -= dt;
      f.y += f.vy * dt;
      if (f.life <= 0) floaters.splice(i, 1);
    }
  }

  // -------------------------------------------------------------------------------------------------------
  // drawing
  // -------------------------------------------------------------------------------------------------------

  function drawWorld(W, H, u, ox, oy) {
    // wall
    const wall = g.createLinearGradient(0, 0, 0, H);
    wall.addColorStop(0, '#13213d');
    wall.addColorStop(1, '#0b1527');
    g.fillStyle = wall;
    g.fillRect(0, 0, W, H);
    // faint vertical panels
    g.strokeStyle = 'rgba(160,190,255,0.05)';
    g.lineWidth = 1;
    for (let x = ((ox % (90 * u)) + 90 * u) % (90 * u); x < W; x += 90 * u) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    g.save();
    g.translate(ox, oy);
    g.scale(u, u);
    const x0 = -ox / u - 10;
    const x1 = (W - ox) / u + 10;
    // floor
    const fy = FLOOR;
    const fl = g.createLinearGradient(0, fy, 0, SHH + 80);
    fl.addColorStop(0, '#1c2b49');
    fl.addColorStop(1, '#0a1222');
    g.fillStyle = fl;
    g.fillRect(x0, fy, x1 - x0, 400);
    g.fillStyle = 'rgba(160,190,255,0.14)';
    g.fillRect(x0, fy, x1 - x0, 2);
    g.strokeStyle = 'rgba(160,190,255,0.06)';
    for (let x = x0 - (x0 % 80); x < x1; x += 80) {
      g.beginPath();
      g.moveTo(x, fy + 2);
      g.lineTo(x - 40, SHH + 80);
      g.stroke();
    }
    // top beam
    const beam = g.createLinearGradient(0, 0, 0, 20);
    beam.addColorStop(0, '#46566f');
    beam.addColorStop(1, '#273449');
    g.fillStyle = beam;
    g.fillRect(x0, -60, x1 - x0, 80);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(x0, 19, x1 - x0, 2);
    g.fillStyle = '#1c2638';
    for (let x = x0 - (x0 % 70); x < x1; x += 70) {
      g.beginPath();
      g.arc(x, 8, 2.4, 0, 7);
      g.fill();
    }
    // pulley
    g.fillStyle = '#2f3b52';
    rr(g, PIV.x - 20, 14, 40, 18, 5);
    g.fill();
    g.beginPath();
    g.arc(PIV.x, 30, 14, 0, Math.PI * 2);
    const pg = g.createRadialGradient(PIV.x - 4, 26, 2, PIV.x, 30, 15);
    pg.addColorStop(0, '#b8c4d8');
    pg.addColorStop(1, '#4b5a74');
    g.fillStyle = pg;
    g.fill();
    g.beginPath();
    g.arc(PIV.x, 30, 4.5, 0, Math.PI * 2);
    g.fillStyle = '#1b2436';
    g.fill();

    // tap pipe
    const pipe = g.createLinearGradient(0, 84, 0, 106);
    pipe.addColorStop(0, '#9fb0c9');
    pipe.addColorStop(0.5, '#5e6f8c');
    pipe.addColorStop(1, '#34415a');
    g.fillStyle = pipe;
    g.fillRect(x0, 84, TAP.x + 12 - x0, 22);
    g.fillRect(TAP.x - 12, 84, 24, 36);
    g.fillStyle = '#3a4862';
    rr(g, TAP.x - 15, 116, 30, 10, 3);
    g.fill();
    g.fillStyle = '#7d8ea8';
    g.fillRect(TAP.x - 3, 124, 6, 4);
    for (const fxp of [280, 120]) {
      g.fillStyle = '#44536f';
      g.fillRect(fxp, 80, 12, 30);
    }
    // valve wheel
    g.save();
    g.translate(330, 76);
    g.rotate(valveAngle);
    g.strokeStyle = '#d95353';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(0, 0, 13, 0, Math.PI * 2);
    g.moveTo(-13, 0);
    g.lineTo(13, 0);
    g.moveTo(0, -13);
    g.lineTo(0, 13);
    g.stroke();
    g.restore();
    g.fillStyle = '#44536f';
    g.fillRect(327, 76, 6, 10);

    // puddle
    if (puddleA > 0.01) {
      g.save();
      g.globalAlpha = puddleA;
      g.translate(460, FLOOR + 6);
      g.scale(1, 0.16);
      const pdg = g.createRadialGradient(0, 0, 4, 0, 0, 150 * puddle);
      pdg.addColorStop(0, 'rgba(120,200,255,0.8)');
      pdg.addColorStop(1, 'rgba(60,140,230,0)');
      g.fillStyle = pdg;
      g.beginPath();
      g.arc(0, 0, 150 * puddle, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    // bank crate
    drawCrate();
    g.restore();
  }

  function drawCrate() {
    const k = 1 + cratePulse * 0.07;
    const cx = crateX + 40;
    g.save();
    g.translate(cx, FLOOR);
    g.scale(k, k);
    g.translate(-cx, -FLOOR);
    // shadow
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath();
    g.ellipse(cx, FLOOR + 3, 62, 8, 0, 0, Math.PI * 2);
    g.fill();
    // coins heaped inside
    const fill = clamp(crateAmt / 220);
    const bx = crateX;
    const by = CRATE.y;
    const body = g.createLinearGradient(0, by, 0, FLOOR);
    body.addColorStop(0, '#8a5a30');
    body.addColorStop(1, '#5a3a1c');
    g.fillStyle = body;
    rr(g, bx, by + 18, 80, 52, 6);
    g.fill();
    g.fillStyle = '#e8b83a';
    g.beginPath();
    g.ellipse(cx, by + 20, 34, 5 + fill * 9, 0, Math.PI, 0, true);
    g.fill();
    g.fillStyle = '#f7da7a';
    g.beginPath();
    g.ellipse(cx - 6, by + 17 - fill * 4, 12, 2.5, 0, 0, 7);
    g.fill();
    // metal straps
    g.fillStyle = 'rgba(190,205,225,0.8)';
    g.fillRect(bx + 10, by + 18, 7, 52);
    g.fillRect(bx + 63, by + 18, 7, 52);
    // lid (open, leaned back)
    g.fillStyle = '#6c4524';
    rr(g, bx - 2, by + 10, 84, 10, 4);
    g.fill();
    g.font = `400 15px ${FONT_HEAD}`;
    g.fillStyle = 'rgba(255,230,170,0.95)';
    g.textAlign = 'center';
    g.fillText('הבנק', cx, by + 48);
    g.restore();
  }

  function waveAt(x, ph, amp) {
    return amp * (3.2 * Math.sin(x * 0.05 + ph) + 1.3 * Math.sin(x * 0.1 - ph * 1.3)) + amp * 0.045 * x * Math.sin(ph * 0.7) + 0.6 * Math.sin(x * 0.08 + ph * 0.25);
  }

  function drawBucketBody(t) {
    const bottom = RIM_Y + BH;
    // bail
    g.strokeStyle = '#8c9bb3';
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, 2);
    g.lineTo(-HT + 3, RIM_Y);
    g.moveTo(0, 2);
    g.lineTo(HT - 3, RIM_Y);
    g.stroke();
    g.strokeStyle = '#c2cde0';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-1, 3);
    g.lineTo(-HT + 3, RIM_Y - 1);
    g.stroke();
    // ring
    g.beginPath();
    g.arc(0, 0, 7, 0, Math.PI * 2);
    g.lineWidth = 3.5;
    g.strokeStyle = '#b4c1d6';
    g.stroke();

    // inside back
    g.beginPath();
    g.ellipse(0, RIM_Y, HT, RIM_RY, 0, 0, Math.PI * 2);
    g.fillStyle = '#26170c';
    g.fill();
    const inner = new Path2D();
    inner.moveTo(-HT + 5, RIM_Y);
    inner.lineTo(HT - 5, RIM_Y);
    inner.lineTo(HB - 5, bottom - 4);
    inner.quadraticCurveTo(0, bottom + 8, -HB + 5, bottom - 4);
    inner.closePath();
    g.fillStyle = '#3a2615';
    g.fill(inner);

    // water
    const surf = surfLocal();
    if (level > 0.004 || slosh > 0.05) {
      g.save();
      g.clip(inner);
      const ph = t * 8;
      // back wave
      g.beginPath();
      g.moveTo(-HT - 6, bottom + 14);
      for (let x = -HT - 6; x <= HT + 6; x += 5) g.lineTo(x, surf - 3 + waveAt(x, ph + 1.4, slosh * 0.85));
      g.lineTo(HT + 6, bottom + 14);
      g.closePath();
      g.fillStyle = 'rgba(120,196,255,0.5)';
      g.fill();
      // front body
      g.beginPath();
      g.moveTo(-HT - 6, bottom + 14);
      for (let x = -HT - 6; x <= HT + 6; x += 5) g.lineTo(x, surf + waveAt(x, ph, slosh));
      g.lineTo(HT + 6, bottom + 14);
      g.closePath();
      const wg = g.createLinearGradient(0, surf - 8, 0, bottom);
      wg.addColorStop(0, 'rgba(150,222,255,0.92)');
      wg.addColorStop(0.35, 'rgba(66,160,240,0.92)');
      wg.addColorStop(1, 'rgba(22,80,185,0.96)');
      g.fillStyle = wg;
      g.fill();
      // glassy light band under the surface
      g.beginPath();
      for (let x = -HT - 6; x <= HT + 6; x += 5) {
        const y = surf + 7 + waveAt(x, ph, slosh);
        x === -HT - 6 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.strokeStyle = 'rgba(255,255,255,0.22)';
      g.lineWidth = 4;
      g.stroke();
      // surface line
      g.beginPath();
      for (let x = -HT - 6; x <= HT + 6; x += 5) {
        const y = surf + waveAt(x, ph, slosh);
        x === -HT - 6 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 2;
      g.stroke();
      // vertical highlight
      const hl = g.createLinearGradient(-HT, 0, -HT + 26, 0);
      hl.addColorStop(0, 'rgba(255,255,255,0.0)');
      hl.addColorStop(0.5, 'rgba(255,255,255,0.22)');
      hl.addColorStop(1, 'rgba(255,255,255,0.0)');
      g.fillStyle = hl;
      g.fillRect(-HT + 6, surf, 26, bottom - surf);
      // bubbles
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = 1;
      for (const b of bubbles) {
        g.beginPath();
        g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    }

    // staves, semi transparent so the water shows through
    const body = new Path2D();
    body.moveTo(-HT, RIM_Y);
    body.lineTo(HT, RIM_Y);
    body.lineTo(HB, bottom);
    body.quadraticCurveTo(0, bottom + 14, -HB, bottom);
    body.closePath();
    const wd = g.createLinearGradient(-HT, 0, HT, 0);
    wd.addColorStop(0, 'rgba(176,124,68,0.38)');
    wd.addColorStop(0.45, 'rgba(146,96,48,0.22)');
    wd.addColorStop(1, 'rgba(84,52,26,0.55)');
    g.fillStyle = wd;
    g.fill(body);
    g.strokeStyle = 'rgba(30,18,8,0.5)';
    g.lineWidth = 1.4;
    for (let i = 1; i < 7; i++) {
      const f = i / 7;
      g.beginPath();
      g.moveTo(lerp(-HT, HT, f), RIM_Y + 4);
      g.lineTo(lerp(-HB, HB, f), bottom + 2);
      g.stroke();
    }
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(222,170,110,0.65)';
    g.stroke(body);
    // glow when banked
    if (glow > 0.01) {
      g.fillStyle = `rgba(76,210,154,${glow * 0.4})`;
      g.fill(body);
    }
    // bands
    for (const f of [0.2, 0.78]) {
      const y = RIM_Y + BH * f;
      const y2 = y + 12;
      const w1 = hwAt(y) + 1.5;
      const w2 = hwAt(y2) + 1.5;
      g.beginPath();
      g.moveTo(-w1, y);
      g.lineTo(w1, y);
      g.lineTo(w2, y2);
      g.lineTo(-w2, y2);
      g.closePath();
      const bg = g.createLinearGradient(-w1, 0, w1, 0);
      bg.addColorStop(0, '#e1e8f3');
      bg.addColorStop(0.35, '#9aa8bf');
      bg.addColorStop(0.7, '#6b7a94');
      bg.addColorStop(1, '#3d4a63');
      g.fillStyle = bg;
      g.fill();
      g.strokeStyle = 'rgba(15,22,36,0.55)';
      g.lineWidth = 1;
      g.stroke();
      g.fillStyle = '#2a3447';
      for (const rx of [-0.7, -0.35, 0, 0.35, 0.7]) {
        g.beginPath();
        g.arc(rx * hwAt(y + 6), y + 6, 1.7, 0, Math.PI * 2);
        g.fill();
      }
    }
    // rim (front lip)
    g.lineWidth = 6;
    g.strokeStyle = '#c99660';
    g.beginPath();
    g.ellipse(0, RIM_Y, HT, RIM_RY, 0, 0, Math.PI);
    g.stroke();
    g.lineWidth = 2;
    g.strokeStyle = '#ecc99a';
    g.beginPath();
    g.ellipse(0, RIM_Y - 1.5, HT - 1, RIM_RY - 1, 0, 0.1, Math.PI - 0.1);
    g.stroke();
    g.lineWidth = 4;
    g.strokeStyle = '#8f5f33';
    g.beginPath();
    g.ellipse(0, RIM_Y, HT, RIM_RY, 0, Math.PI, Math.PI * 2);
    g.stroke();
  }

  function drawRope(t) {
    const L = Math.max(0, ropeLen() + hoist);
    if (L < 2) return;
    const wob = tension > 0.4 ? Math.sin(t * 70) * (tension - 0.4) * 2.6 : 0;
    const w = 7.5 - tension * 2.6;
    const r = Math.round(lerp(176, 218, tension));
    const gcol = Math.round(lerp(138, 112, tension));
    const b = Math.round(lerp(87, 82, tension));
    g.lineCap = 'butt';
    g.lineWidth = w;
    g.strokeStyle = `rgb(${r},${gcol},${b})`;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(wob, L);
    g.stroke();
    // twist pattern
    g.lineWidth = 1.6;
    g.strokeStyle = 'rgba(64,42,18,0.65)';
    g.beginPath();
    for (let y = 2; y < L; y += 6.5) {
      const x = (wob * y) / L;
      g.moveTo(x - w * 0.42, y);
      g.lineTo(x + w * 0.42, y + 3.6);
    }
    g.stroke();
    g.strokeStyle = 'rgba(255,235,200,0.35)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(-w * 0.2, 0);
    g.lineTo(-w * 0.2 + wob, L);
    g.stroke();
    // frayed fibres
    if (tension > 0.4) {
      const n = Math.round(((tension - 0.4) / 0.6) * fibers.length);
      g.strokeStyle = 'rgba(232,205,150,0.9)';
      g.lineWidth = 1.2;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const f = fibers[i];
        const y = L * f.y;
        const x = (wob * y) / L + f.dx * w * 0.5;
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(f.rot) * f.len * (f.dx < 0 ? -1 : 1), y + Math.sin(f.rot) * f.len - 1);
      }
      g.stroke();
    }
  }

  function drawHanging(t) {
    // intact rope + bucket, swaying from the pulley
    g.save();
    g.translate(PIV.x, PIV.y + 8);
    g.rotate(sway);
    // rope drawn from pivot; bucket at the end
    g.save();
    g.translate(0, -8);
    drawRope(t);
    g.restore();
    const L = Math.max(0, ropeLen() + hoist);
    g.translate(0, L - 8);
    drawBucketBody(t);
    g.restore();
  }

  function drawSnapped(t) {
    const s = snapInfo;
    const tau = phT;
    // upper rope piece, whipping
    {
      const L = s.L * s.f;
      g.save();
      g.translate(PIV.x, PIV.y);
      g.rotate(s.theta);
      g.lineCap = 'round';
      g.strokeStyle = 'rgb(214,150,100)';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, L);
      const tail = 46 * Math.exp(-tau * 3.2);
      const amp = 16 * Math.exp(-tau * 3);
      for (let k = 1; k <= 8; k++) {
        const kk = k / 8;
        g.lineTo(Math.sin(tau * 38 + kk * 5 + s.tipSeed) * amp * kk, L + tail * kk * (1 - tau * 0.6));
      }
      g.stroke();
      g.restore();
    }
    // bucket + a short piece of rope falling
    g.save();
    const baseY = PIV.y + s.L + fallY;
    g.translate(PIV.x + Math.sin(s.theta) * s.L, baseY);
    const cyL = RIM_Y + BH * 0.5;
    const bot = RIM_Y + BH;
    g.translate(0, bot);
    g.rotate(tilt + spin * 0.7);
    g.translate(0, -bot);
    // short rope
    g.strokeStyle = 'rgb(214,150,100)';
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(0, 0);
    const rl = s.L * (1 - s.f);
    for (let k = 1; k <= 10; k++) {
      const kk = k / 10;
      g.lineTo(Math.sin(tau * 14 + kk * 4) * 5 * kk * Math.min(1, tau * 2), -rl * kk * (landed ? 0.6 : 1) * 0.55);
    }
    g.stroke();
    void cyL;
    drawBucketBody(t);
    g.restore();
  }

  function drawStream(t) {
    if (pourT <= 0) return;
    const k = clamp(pourT / 0.3);
    const top = TAP.y + 2;
    const bot = ringY() + surfLocal() + 1;
    const w = 6.5 * Math.min(1, (1 - k) * 8 + 0.4);
    const x = TAP.x;
    g.save();
    g.globalAlpha = 0.5 + 0.5 * k;
    const sg = g.createLinearGradient(x - w, 0, x + w, 0);
    sg.addColorStop(0, 'rgba(150,222,255,0.25)');
    sg.addColorStop(0.35, 'rgba(210,240,255,0.95)');
    sg.addColorStop(1, 'rgba(90,170,250,0.55)');
    g.fillStyle = sg;
    g.beginPath();
    g.moveTo(x - w * 0.8, top);
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const y = lerp(top, bot, i / steps);
      g.lineTo(x - w * (0.8 + 0.2 * i / steps) + Math.sin(t * 30 + i) * 0.8, y);
    }
    for (let i = steps; i >= 0; i--) {
      const y = lerp(top, bot, i / steps);
      g.lineTo(x + w * (0.8 + 0.2 * i / steps) + Math.sin(t * 30 + i + 2) * 0.8, y);
    }
    g.closePath();
    g.fill();
    g.restore();
  }

  function drawFx(t) {
    // particles
    for (const p of particles) {
      if (p.kind === 'drop') {
        g.fillStyle = 'rgba(170,228,255,0.9)';
        g.beginPath();
        g.ellipse(p.x, p.y, p.r * 0.8, p.r * 1.15, 0, 0, Math.PI * 2);
        g.fill();
      } else if (p.kind === 'wood') {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.fillStyle = '#a97545';
        g.fillRect(-p.r, -p.r * 0.35, p.r * 2, p.r * 0.7);
        g.restore();
      } else if (p.kind === 'fibre') {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.strokeStyle = 'rgba(232,205,150,0.9)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(-p.r, 0);
        g.lineTo(p.r, 0);
        g.stroke();
        g.restore();
      }
    }
    // coins
    for (const c of coins) {
      if (c.t < 0) continue;
      const s = 1 + Math.sin(c.t * 18) * 0.12;
      g.save();
      g.translate(c.x, c.y);
      g.scale(Math.abs(Math.cos(c.t * 11)) * 0.7 + 0.3, 1);
      g.beginPath();
      g.arc(0, 0, 8 * s, 0, Math.PI * 2);
      g.fillStyle = '#f2c230';
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = '#b8860b';
      g.stroke();
      g.beginPath();
      g.arc(-2, -2, 3, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,248,200,0.8)';
      g.fill();
      g.restore();
    }
    // floaters
    for (const f of floaters) {
      const a = clamp(f.life / 0.5) * clamp((f.max - f.life) / 0.1);
      g.save();
      g.globalAlpha = a;
      g.font = `400 ${f.size}px ${FONT_HEAD}`;
      g.fillStyle = f.color;
      g.shadowColor = 'rgba(0,0,0,0.6)';
      g.shadowBlur = 8;
      g.textAlign = 'center';
      g.direction = /^[+\-\d]+$/.test(f.text) ? 'ltr' : 'rtl';
      g.fillText(f.text, f.x, f.y);
      g.restore();
    }
  }

  function drawTag() {
    // the points of the bucket currently hanging
    if (phase === 'snap' || phase === 'over') return;
    const pts = (phase === 'strain' ? Math.max(0, pumps - 1) : pumps) * PTS_PER_POUR;
    const a = phase === 'idle' || phase === 'strain' ? 1 : 0.3;
    g.save();
    g.globalAlpha = a;
    const x = tagX;
    const y = 190;
    rr(g, x - 52, y - 30, 104, 62, 14);
    g.fillStyle = 'rgba(14,24,46,0.78)';
    g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = tension > 0.7 ? 'rgba(255,107,107,0.8)' : 'rgba(160,190,255,0.3)';
    g.stroke();
    g.font = `700 12px ${FONT}`;
    g.fillStyle = col.muted;
    g.textAlign = 'center';
    g.fillText('נקודות בדלי', x, y - 11);
    g.font = `400 34px ${FONT_HEAD}`;
    g.fillStyle = '#ffffff';
    g.fillText(String(pts), x, y + 24);
    g.restore();
  }

  function draw(g2, W, H) {
    const t = sh.t;
    const { u, ox, oy } = applyLayout();
    const sk = sh.reduced ? shake * 0.3 : shake;
    g.save();
    if (sk > 0.05) g.translate((Math.random() - 0.5) * 2 * sk * u, (Math.random() - 0.5) * 2 * sk * u);
    drawWorld(W, H, u, ox, oy);
    g.save();
    g.translate(ox, oy);
    g.scale(u, u);
    if (phase !== 'snap' || !landed) drawStream(t);
    if (phase === 'snap' && snapInfo) drawSnapped(t);
    else if (phase !== 'over') drawHanging(t);
    drawTag();
    drawFx(t);
    g.restore();
    g.restore();

    // vignette so the scene feels like a lit workshop
    const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(4,8,18,0.45)');
    g.fillStyle = vg;
    g.fillRect(0, 0, W, H);
    if (sh.practice && sh.playing && phase === 'idle' && pumps < 2 && nBanked + nSnapped === 0) {
      g.font = `600 ${Math.max(13, Math.min(17, W / 50))}px ${FONT}`;
      g.fillStyle = col.muted;
      g.textAlign = 'center';
      g.fillText('רווח = למלא · Enter = לשמור את הדלי לפני שהחבל נקרע', W / 2, H - 12);
    }
  }

  return {
    keys: ['Space', 'Enter'],
    update,
    draw,
    onKey(k) {
      if (phase !== 'idle') return;
      if (k === 'Space') pour();
      else if (k === 'Enter') bankIt();
    },
    state() {
      return {
        task: 'bucket',
        bucketPhase: phase,
        bucket: idx + 1,
        buckets: NB,
        pumps,
        breakAt: B,
        points: pumps * PTS_PER_POUR,
        banked: bankedTotal,
        bankedShown: Math.round(banked),
        nBanked,
        nSnapped,
        tension: +tension.toFixed(2),
        level: +level.toFixed(2),
        activeT: +activeT.toFixed(2),
      };
    },
  };
}

const MAKERS = {
  bucket: makeBucket,
  arrows: makeArrows,
  symbols6: makeSymbols6,
  sort2: makeSort2,
};
