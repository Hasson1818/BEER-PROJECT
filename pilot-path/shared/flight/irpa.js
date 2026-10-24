import { showScreen, el, button } from '../screens.js';
import { engine } from '../fx.js';
import { createControls } from './input.js';

// The first simulator of ירפ״א א׳, as candidates and prep sites describe it: a flat blue screen, two target circles,
// a small enemy plane that moves on the screen only in relation to your own movement, a throttle that sets your
// acceleration (so you keep sliding after you let go), limited ammunition and a minimum hit rate.
// A reconstruction: the real exercises and their numbers are not published (see pilot-path/README.md).

const LIME = '#cfff2a';
const BLUE = '#1c30a6';
const OUTER = 20; // degrees at the outer circle
const MID = 11;
const CENTER = 5; // the thin circle: "the center of the target"

/**
 * One exercise = a spec. All numbers are ours.
 *  start: range (m) and the enemy's offset (degrees) at the start
 *  zone: range band the enemy must be in; center: must also be inside the thin circle
 *  hold: seconds in a row; fire: { hits, ammo, minPct } if you have to shoot
 *  drift: the enemy's own movement (deg/s); limit: seconds; vector: arrow when it leaves the screen
 */
export const EXERCISES = [
  {
    id: 'approach',
    title: 'התקרבות',
    limit: 90,
    start: { range: 1000, az: 0, el: 0 },
    zone: [430, 500],
    center: false,
    hold: 5,
    drift: 0,
    brief: [
      'מטוס האויב טס לפניך במרחק קבוע של קילומטר. הוא יזוז על המסך רק לפי התנועה של המטוס שלך.',
      'עליך להתקרב אליו ולהישאר במרחק של חצי קילומטר (430 עד 500 מטר) חמש שניות רצופות.',
      'המצערת קובעת תאוצה, לא מהירות: גם אחרי שתחזיר אותה לאפס המטוס ימשיך להתקדם, וכדי לעצור צריך לדחוף אותה אחורה.',
    ],
  },
  {
    id: 'approach-hold',
    title: 'התקרבות ועצירה מדויקת',
    limit: 90,
    start: { range: 1000, az: 0, el: 0 },
    zone: [455, 500],
    center: false,
    hold: 7,
    drift: 0,
    brief: ['אותה משימה, ברצועה צרה יותר (455 עד 500 מטר) ושבע שניות. כאן האינרציה של המטוס תתחיל לעבוד נגדך.'],
  },
  {
    id: 'center',
    title: 'מיקוד',
    limit: 90,
    start: { range: 700, az: 9, el: -6 },
    zone: [300, 700],
    center: true,
    hold: 5,
    drift: 0,
    brief: [
      'עכשיו האויב לא ישר לפניך. הזז את הסטיק כדי להביא אותו אל מרכז המטרה, העיגול הדק שבאמצע.',
      'כשתטה ימינה האויב יזוז שמאלה על המסך. זה יכול לבלבל, כי לפעמים נדמה שאתה מטיס את המטוס שבתמונה. אתה לא.',
      'עליך להחזיק אותו במרכז חמש שניות רצופות, בטווח של 300 עד 700 מטר.',
    ],
  },
  {
    id: 'range-center',
    title: 'טווח ומרכז',
    limit: 90,
    start: { range: 1000, az: -10, el: 5 },
    zone: [200, 500],
    center: true,
    hold: 5,
    drift: 0,
    brief: ['הכול ביחד: להתקרב לטווח הירי (200 עד 500 מטר) ולהחזיק את האויב במרכז המטרה חמש שניות רצופות.'],
  },
  {
    id: 'fire',
    title: 'ירי',
    limit: 90,
    start: { range: 1000, az: -6, el: 4 },
    zone: [200, 500],
    center: true,
    hold: 5,
    fire: { hits: 20, ammo: 100, minPct: 80 },
    drift: 0,
    brief: [
      'עליך לירות במטוס האויב ולשם כך עליו להיות במרכז המטרה במשך חמש שניות לפחות. טווח הירי הוא 200 עד 500 מטר. אחוז הפגיעה המינימלי הוא 80%. לרשותך 100 פגזים ו־90 שניות.',
      'התחמושת נדרכת רק אחרי שהנעילה הושלמה. אם האויב יוצא מהמרכז, צריך לנעול מחדש.',
    ],
  },
  {
    id: 'fire-moving',
    title: 'ירי מול אויב שנע',
    limit: 75,
    start: { range: 1000, az: 8, el: -5 },
    zone: [200, 500],
    center: true,
    hold: 5,
    fire: { hits: 20, ammo: 100, minPct: 80 },
    drift: 2.2,
    brief: ['האויב מתחיל לנוע בעצמו, והתנועה שלו מצטרפת לתנועה שלך. זה מקשה על הנעילה. אם הוא ייצא מהמסך יופיע חץ שמצביע לכיוונו.'],
  },
  {
    id: 'fire-hard',
    title: 'ירי מתקדם',
    limit: 70,
    start: { range: 1000, az: -12, el: 7 },
    zone: [200, 500],
    center: true,
    hold: 7,
    fire: { hits: 20, ammo: 80, minPct: 80 },
    drift: 3.6,
    brief: ['נעילה של שבע שניות, 80 פגזים ואויב שזז יותר. אין הרבה מקום לטעויות.'],
  },
  {
    id: 'exam',
    title: 'מבחן ממיין',
    limit: 60,
    start: { range: 1000, az: 10, el: -8 },
    zone: [200, 500],
    center: true,
    hold: 8,
    fire: { hits: 20, ammo: 60, minPct: 80 },
    drift: 4.6,
    brief: ['המבחן האחרון: שמונה שניות נעילה, 60 פגזים, 60 שניות. לפי אתרי הכנה, רוב המועמדים לא מצליחים בניסיון הראשון, וחשוב שלא להתייאש.'],
  },
];

const SHORT_IDS = ['approach', 'center', 'fire', 'exam'];

/** Resolves to { passed, score, levels: [{ id, title, score, attempts }] }. */
export function runIrpaSimulator(game, { fx, short = false } = {}) {
  return showScreen(game, 'ir-screen', (root, close, helpers) => {
    injectStyle();
    start(root, close, helpers, { fx, short });
  });
}

function start(root, close, helpers, { fx, short }) {
  const stage = el('div', 'ir-stage');
  const canvas = el('canvas', 'ir-canvas');
  const cards = el('div', 'ir-cards');
  stage.append(canvas, cards);
  root.append(stage);
  const ctx = canvas.getContext('2d');
  const exercises = short ? EXERCISES.filter((e) => SHORT_IDS.includes(e.id)) : EXERCISES;

  const controls = createControls(stage, {
    showButtons: true,
    buttons: [
      { id: 'fire', label: 'אש', keys: ['Space'], hold: true },
      { id: 'more', label: 'מצערת קדימה', keys: [], hold: true, className: 'def' },
      { id: 'less', label: 'מצערת אחורה', keys: [], hold: true, className: 'warn' },
    ],
  });
  const sound = engine();

  let w = 0;
  let h = 0;
  let dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = stage.clientWidth;
    h = stage.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();

  // ---------- The state of one attempt ----------
  let spec = null;
  let s = null;
  let running = false;
  let time = 0;
  let message = null;

  function reset(sp) {
    spec = sp;
    s = {
      range: sp.start.range,
      az: sp.start.az,
      el: sp.start.el,
      speed: 0, // closing speed, m/s (+ = getting closer)
      lever: 0, // the throttle lever (-1..1): sets acceleration
      wx: 0,
      wy: 0,
      t: 0,
      left: sp.limit,
      lock: 0,
      armed: false,
      ammo: sp.fire?.ammo ?? 0,
      shots: 0,
      hits: 0,
      shellTimer: 0,
      driftPhase: [Math.random() * 6, Math.random() * 6, Math.random() * 6, Math.random() * 6],
      best: 0,
      done: null,
      lastTick: Math.ceil(sp.limit),
    };
  }

  function say(text, color = LIME, ms = 2200) {
    message = { text, color, until: time + ms / 1000 };
  }

  function step(dt) {
    time += dt;
    const input = controls.poll(dt);
    if (!running || !s || s.done) return;
    s.t += dt;
    s.left -= dt;

    // The lever stays where you leave it (W/S or the buttons move it); it sets the acceleration.
    const held = controls.state.held;
    const push = input.throttleInput + (held.more ? 1 : 0) - (held.less ? 1 : 0);
    s.lever = Math.max(-1, Math.min(1, s.lever + Math.max(-1, Math.min(1, push)) * dt * 0.9));
    s.speed += (s.lever * 26 - 0.035 * s.speed) * dt;
    s.speed = Math.max(-60, Math.min(100, s.speed));
    s.range -= s.speed * dt;
    if (s.range > 1100) {
      s.range = 1100;
      s.speed = Math.min(s.speed, 0);
    }
    if (s.range < 40) {
      s.done = { ok: false, reason: 'התנגשת במטוס האויב' };
      fx?.explosion?.();
      return;
    }

    // Our own turning, with inertia. The enemy moves the opposite way on the screen.
    s.wx += (input.stick.x * 26 - s.wx) * Math.min(1, dt * 3);
    s.wy += (input.stick.y * 26 - s.wy) * Math.min(1, dt * 3);
    const A = spec.drift;
    const dx = A ? A * (Math.sin(s.t * 0.7 + s.driftPhase[0]) + 0.6 * Math.sin(s.t * 1.9 + s.driftPhase[1])) : 0;
    const dy = A ? A * 0.8 * (Math.sin(s.t * 0.55 + s.driftPhase[2]) + 0.6 * Math.sin(s.t * 1.6 + s.driftPhase[3])) : 0;
    s.az += (-s.wx + dx) * dt;
    s.el += (-s.wy + dy) * dt;
    s.az = Math.max(-80, Math.min(80, s.az));
    s.el = Math.max(-80, Math.min(80, s.el));

    // Lock-on: in the band, and in the center if needed, for `hold` seconds in a row.
    const off = Math.hypot(s.az, s.el);
    const inBand = s.range >= spec.zone[0] && s.range <= spec.zone[1];
    const centered = off <= CENTER;
    const ok = inBand && (!spec.center || centered);
    if (ok) s.lock += dt;
    else {
      s.lock = 0;
      if (s.armed) {
        s.armed = false;
        say('הנעילה אבדה. צריך לנעול מחדש', '#ffb0b0');
      }
    }
    s.best = Math.max(s.best, Math.min(1, s.lock / spec.hold));
    if (ok && s.lock >= spec.hold && !s.armed) {
      s.armed = true;
      fx?.ok?.();
      if (spec.fire) say('נעילה! אפשר לירות', LIME, 2500);
    }
    if (!spec.fire && ok && s.lock >= spec.hold) {
      s.done = { ok: true };
      return;
    }

    // Shooting.
    if (spec.fire && held.fire) {
      if (s.armed && s.ammo > 0) {
        s.shellTimer -= dt;
        while (s.shellTimer <= 0 && s.ammo > 0) {
          s.shellTimer += 0.12;
          s.ammo--;
          s.shots++;
          const p = Math.max(0.15, 1 - off / CENTER) * (s.range < 320 ? 1 : 0.94);
          if (Math.random() < 0.55 + 0.45 * p) s.hits++;
        }
        if (Math.floor(time * 3) !== Math.floor((time - dt) * 3)) fx?.gun?.();
      } else if (!s.armed && Math.floor(time * 2) !== Math.floor((time - dt) * 2)) {
        say('אי אפשר לירות לפני נעילה', '#ffb0b0', 1200);
      }
    }
    if (spec.fire) {
      const pct = s.shots ? s.hits / s.shots : 1;
      if (s.hits >= spec.fire.hits) {
        s.done = pct * 100 >= spec.fire.minPct ? { ok: true } : { ok: false, reason: `אחוז הפגיעה היה ${Math.round(pct * 100)}%, ונדרש לפחות ${spec.fire.minPct}%` };
        return;
      }
      if (s.ammo <= 0) {
        s.done = { ok: false, reason: 'נגמרה התחמושת' };
        return;
      }
    }

    const sec = Math.ceil(s.left);
    if (sec <= 10 && sec !== s.lastTick) {
      s.lastTick = sec;
      fx?.tick?.();
    }
    if (s.left <= 0) s.done = { ok: false, reason: 'נגמר הזמן' };
    sound.set(0.15 + Math.abs(s.lever) * 0.5, Math.min(1, Math.abs(s.speed) / 100));
  }

  // ---------- Drawing ----------
  function txt(text, x, y, { size = 15, align = 'center', color = LIME, weight = 500 } = {}) {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px Heebo, Arial, sans-serif`;
    ctx.textAlign = align;
    ctx.direction = 'rtl';
    ctx.fillText(text, x, y);
  }

  function wrap(text, x, y, width, lineH, size) {
    ctx.font = `600 ${size}px Heebo, Arial, sans-serif`;
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = LIME;
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > width && line) {
        ctx.fillText(line, x, yy);
        line = word;
        yy += lineH;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, yy);
  }

  function box(x, y, bw, bh, label, value, { fill = null } = {}) {
    ctx.strokeStyle = LIME;
    ctx.lineWidth = 2;
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh);
    }
    ctx.strokeRect(x - bw / 2, y - bh / 2, bw, bh);
    txt(value, x, y + bh * 0.2, { size: Math.min(22, bh * 0.62), color: LIME, weight: 600 });
    txt(label, x, y + bh / 2 + 18, { size: 15 });
  }

  function plane(x, y, scale, bank) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(bank);
    ctx.scale(scale, scale);
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.6 / Math.max(scale, 0.5);
    ctx.beginPath();
    // A little delta-wing plane seen from behind and slightly above.
    ctx.moveTo(0, -6);
    ctx.lineTo(7, 10);
    ctx.lineTo(34, 16);
    ctx.lineTo(8, 4);
    ctx.lineTo(4, 14);
    ctx.lineTo(0, 11);
    ctx.lineTo(-4, 14);
    ctx.lineTo(-8, 4);
    ctx.lineTo(-34, 16);
    ctx.lineTo(-7, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(0, 11);
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = BLUE;
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h * 0.5;
    const unit = Math.min(h * 0.52, w * 0.34) / OUTER; // pixels per degree
    // The target circles.
    ctx.strokeStyle = LIME;
    ctx.lineWidth = 2;
    for (const r of [OUTER, MID]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * unit, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(207,255,42,0.65)';
    ctx.beginPath();
    ctx.arc(cx, cy, CENTER * unit, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(207,255,42,0.8)';
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy);
    ctx.lineTo(cx + 14, cy);
    ctx.moveTo(cx, cy - 14);
    ctx.lineTo(cx, cy + 14);
    ctx.stroke();

    if (s) {
      // The lock arc fills while you hold the enemy in the center.
      if (s.lock > 0) {
        ctx.strokeStyle = s.armed ? '#ffffff' : LIME;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(cx, cy, (CENTER + 1.3) * unit, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, s.lock / spec.hold));
        ctx.stroke();
      }
      // The enemy: at (az, el), smaller the farther it is.
      const ex = cx + s.az * unit;
      const ey = cy - s.el * unit;
      const onScreen = ex > 60 && ex < w - 60 && ey > 60 && ey < h - 60;
      const scale = Math.max(0.35, Math.min(3, 520 / Math.max(100, s.range)));
      if (onScreen) {
        plane(ex, ey, scale, Math.max(-0.5, Math.min(0.5, (s.wx - 0) * 0.01)));
      } else {
        // Only a vector toward it, and the range.
        const a = Math.atan2(ey - cy, ex - cx);
        const rr = Math.min(w, h) * 0.38;
        ctx.save();
        ctx.translate(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        ctx.rotate(a);
        ctx.fillStyle = LIME;
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-10, -12);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-10, 12);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        txt(`${Math.round(s.range)} מ׳`, cx + Math.cos(a) * (rr - 44), cy + Math.sin(a) * (rr - 44) + 5, { size: 14 });
      }
    }

    // Left: closing speed (-100..100).
    const lx = w * 0.075;
    const top = h * 0.27;
    const bottom = h * 0.71;
    const mapV = (v) => bottom - ((v + 100) / 200) * (bottom - top);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = LIME;
    ctx.font = '500 11px ui-monospace, Menlo, monospace';
    for (let v = -100; v <= 100; v += 10) {
      const y = mapV(v);
      ctx.beginPath();
      ctx.moveTo(lx - 18, y);
      ctx.lineTo(lx + (v === 0 ? 30 : 20), y);
      ctx.stroke();
      ctx.fillStyle = LIME;
      ctx.textAlign = 'left';
      ctx.direction = 'ltr';
      ctx.fillText(String(v), lx + 28, y + 4);
    }
    if (s) {
      const y0 = mapV(0);
      const y1 = mapV(s.speed);
      ctx.fillStyle = '#2ed42e';
      ctx.fillRect(lx - 14, Math.min(y0, y1), 28, Math.abs(y1 - y0));
    }
    txt('מד מהירות', lx, bottom + 28, { size: 15 });

    // Right: range (0..1100).
    const rx = w * 0.9;
    const mapR = (v) => bottom - (v / 1100) * (bottom - top - 12);
    for (let v = 0; v <= 1100; v += 100) {
      const y = mapR(v);
      ctx.beginPath();
      ctx.moveTo(rx - 22, y);
      ctx.lineTo(rx - (v === 1100 ? 0 : 8), y);
      ctx.stroke();
      ctx.fillStyle = LIME;
      ctx.textAlign = 'right';
      ctx.direction = 'ltr';
      ctx.fillText(String(v), rx - 28, y + 4);
    }
    if (s) {
      ctx.fillStyle = '#d6d460';
      ctx.fillRect(rx - 22, mapR(s.range), 22, bottom - mapR(s.range));
      // The band you must hold.
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      const yb1 = mapR(spec.zone[1]);
      const yb0 = mapR(spec.zone[0]);
      ctx.strokeRect(rx - 26, yb1, 30, yb0 - yb1);
    }
    txt('מרחק מהמטוס', rx, bottom + 28, { size: 15 });

    // Bottom row.
    box(w * 0.14, h * 0.8, 62, 30, 'מצערת', s ? s.lever.toFixed(2) : '0.00');
    box(w * 0.86, h * 0.8, 62, 30, 'זווית', s ? `${(Math.atan2(s.az, Math.max(1e-6, s.el)) * 57.2958 + 180).toFixed(1)}` : '0.0');
    const pct = s?.shots ? Math.round((s.hits / s.shots) * 100) : 0;
    box(w * 0.5, h * 0.9, 86, 30, 'אחוזי פגיעה', `${pct}%`);
    // Ammo bar.
    const ax = w * 0.3;
    const ay = h * 0.855;
    ctx.strokeStyle = LIME;
    ctx.lineWidth = 2;
    ctx.strokeRect(ax - 45, ay - 14, 90, 28);
    const ammoMax = spec?.fire?.ammo ?? 100;
    ctx.fillStyle = '#ffa42e';
    ctx.fillRect(ax - 45, ay - 14, (90 * (s?.ammo ?? 0)) / ammoMax, 28);
    txt('0', ax - 58, ay + 6, { size: 14, align: 'right' });
    txt(String(ammoMax), ax + 58, ay + 6, { size: 14, align: 'left' });
    txt('תחמושת', ax, ay + 34, { size: 15 });
    // Status box next to the angle.
    ctx.strokeRect(w * 0.7 - 36, h * 0.8 - 15, 72, 30);
    if (s) txt(s.armed ? 'נעול' : s.lock > 0 ? `${s.lock.toFixed(1)}` : '', w * 0.7, h * 0.8 + 6, { size: 17, weight: 700, color: s.armed ? '#ffffff' : LIME });

    // Timer and the instruction.
    const secs = s ? Math.max(0, Math.ceil(s.left)) : 0;
    ctx.strokeStyle = LIME;
    ctx.strokeRect(cx - 24, h * 0.05, 48, 34);
    txt(String(secs), cx, h * 0.05 + 25, { size: 24, weight: 700, color: secs <= 10 ? '#ffd0d0' : LIME });
    if (spec) wrap(spec.brief[0], w * 0.975, h * 0.05 + 12, w * 0.34, 20, Math.max(13, Math.min(17, w / 56)));
    if (message && message.until > time) txt(message.text, cx, h * 0.13, { size: 20, weight: 700, color: message.color });
  }

  // ---------- The loop ----------
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
  helpers.onClose(() => {
    cancelAnimationFrame(raf);
    sound.stop();
    controls.dispose();
    observer.disconnect();
  });

  // For tests (dev only): run N seconds without waiting.
  const results = [];
  if (import.meta.env.DEV) {
    root.__irpa = {
      advance(seconds) {
        for (let i = 0; i < seconds * 30; i++) step(1 / 30);
        draw();
      },
      get s() {
        return s;
      },
      get spec() {
        return spec;
      },
      controls,
      results,
      exercises,
    };
  }

  // ---------- Cards and the order of the exercises ----------
  function showCard(build) {
    cards.innerHTML = '';
    const card = el('div', 'ir-card');
    cards.append(card);
    cards.classList.add('on');
    return new Promise((resolve) => build(card, (v) => {
      cards.classList.remove('on');
      cards.innerHTML = '';
      resolve(v);
    }));
  }

  const brief = (sp, index, attempt) =>
    showCard((card, done) => {
      card.append(el('p', 'pp-eyebrow', `סימולטור ראשון · תרגיל ${index + 1} מתוך ${exercises.length}${attempt > 1 ? ` · ניסיון ${attempt}` : ''}`), el('h2', 'pp-title', sp.title));
      const list = el('ul', 'pp-list');
      for (const line of sp.brief) list.append(el('li', '', line));
      card.append(list);
      const keys = el('div', 'pp-keys');
      const items = [
        { keys: ['↑', '↓', '←', '→'], text: 'סטיק: מזיז את האויב על המסך בכיוון ההפוך (או העכבר)' },
        { keys: ['W', 'S'], text: 'מצערת: דוחפים קדימה או אחורה, והיא נשארת במקום' },
        ...(sp.fire ? [{ keys: ['Space'], text: 'אש (אחרי נעילה)' }] : []),
      ];
      for (const k of items) {
        const row = el('div', 'pp-key-item');
        const caps = el('span', 'pp-caps');
        for (const cap of k.keys) caps.append(el('kbd', 'pp-kbd', cap));
        row.append(caps, el('span', '', k.text));
        keys.append(row);
      }
      card.append(keys);
      if (attempt === 1) card.append(el('p', 'pp-note', 'לפי אתרי הכנה אפשר לחזור על התרגיל כמה פעמים. המשחק נותן עד שלושה ניסיונות.'));
      const go = button('מתחילים');
      const row = el('div', 'pp-actions');
      row.append(go);
      card.append(row);
      go.focus();
      go.addEventListener('click', () => (fx?.click?.(), done()));
    });

  const resultCard = (sp, res, attempt, canRetry) =>
    showCard((card, done) => {
      card.append(el('p', 'pp-eyebrow', res.ok ? 'הצלחה' : 'לא הצלחת'), el('h2', 'pp-title', res.ok ? 'סיימת את התרגיל' : res.reason));
      if (!res.ok) card.append(el('p', 'pp-sub', canRetry ? 'אפשר לנסות שוב. כל כישלון כזה חלק מהסימולטור.' : 'נגמרו הניסיונות. ממשיכים לתרגיל הבא.'));
      const row = el('div', 'pp-actions');
      if (!res.ok && canRetry) {
        const again = button('לנסות שוב');
        again.addEventListener('click', () => (fx?.click?.(), done('retry')));
        row.append(again);
      }
      const next = button(res.ok || !canRetry ? 'המשך' : 'לדלג', res.ok || !canRetry ? 'pp-btn' : 'pp-btn secondary');
      next.addEventListener('click', () => (fx?.click?.(), done('next')));
      row.append(next);
      card.append(row);
      row.firstChild.focus();
    });

  (async () => {
    reset(exercises[0]);
    const levels = [];
    for (let i = 0; i < exercises.length; i++) {
      const sp = exercises[i];
      let attempt = 0;
      let outcome = null;
      let progress = 0;
      for (;;) {
        attempt++;
        reset(sp);
        running = false;
        await brief(sp, i, attempt);
        reset(sp);
        running = true;
        await new Promise((resolve) => {
          const t = setInterval(() => {
            if (s.done) {
              clearInterval(t);
              resolve();
            }
          }, 60);
        });
        running = false;
        outcome = s.done;
        progress = Math.max(progress, s.best);
        if (outcome.ok) fx?.done?.();
        else fx?.fail?.();
        const choice = await resultCard(sp, outcome, attempt, attempt < 3);
        if (outcome.ok || choice !== 'retry') break;
      }
      const score = outcome.ok ? [1, 0.8, 0.6][attempt - 1] : 0.15 * progress;
      levels.push({ id: sp.id, title: sp.title, score, attempts: attempt });
      results.push(levels[levels.length - 1]);
    }
    const mean = levels.reduce((a, l) => a + l.score, 0) / levels.length;
    const out = { passed: mean >= 0.5, score: mean, levels };
    await showCard((card, done) => {
      card.append(el('p', 'pp-eyebrow', 'סיום הסימולטור'), el('h2', 'pp-title', 'סיימת את הסימולטור'));
      const list = el('ul', 'ir-results');
      for (const l of levels) {
        const li = el('li');
        li.append(el('span', '', `${l.title}${l.attempts > 1 ? ` (${l.attempts} ניסיונות)` : ''}`));
        const bar = el('div', 'pp-bar');
        const fill = el('i');
        fill.style.width = `${Math.round(l.score * 100)}%`;
        bar.append(fill);
        li.append(bar, el('b', '', `${Math.round(l.score * 100)}%`));
        list.append(li);
      }
      card.append(list);
      const go = button('המשך');
      const row = el('div', 'pp-actions');
      row.append(go);
      card.append(row);
      go.focus();
      go.addEventListener('click', () => (fx?.click?.(), done()));
    });
    close(out);
  })();
}

const STYLE_ID = 'ir-style';
function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .ir-screen { padding: 0; background: #0a1450; }
    .ir-stage { position: relative; width: 100%; height: 100%; overflow: hidden; touch-action: none; user-select: none; }
    .ir-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .ir-cards { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; padding: 16px; background: rgba(4,8,40,.7); backdrop-filter: blur(3px); z-index: 8; }
    .ir-cards.on { display: flex; }
    .ir-card { width: min(680px, 100%); max-height: 100%; overflow: auto; padding: 22px 26px; border-radius: 18px; background: rgba(14,24,70,.96); color: var(--pp-text); box-shadow: inset 0 0 0 1px rgba(207,255,42,.35), 0 30px 80px rgba(0,0,0,.6); }
    .ir-results { display: grid; gap: 8px; margin: 12px 0 4px; padding: 0; list-style: none; }
    .ir-results li { display: grid; grid-template-columns: 1fr 120px 44px; align-items: center; gap: 10px; }
    .ir-stage .fl-buttons { left: 18px; right: auto; bottom: 14px; justify-content: flex-start; max-width: 50%; }
  `;
  document.head.append(style);
}
