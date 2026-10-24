import * as THREE from 'three';
import { KT } from './plane.js';

// The levels of the two simulators. Every level has: setup(ctx) (place things), begin(ctx) (after the briefing),
// update(ctx, dt) (call ctx.finish(outcome) when done), hud(ctx) (extras for the head-up display) and
// score(ctx, outcome) -> 0..1. The wording and the structure follow what prep sites describe (hold a speed,
// keep a distance from another aircraft, turn, intercept and fire; the second one adds a distraction load).
// None of the numbers are the real ones: the real tests are not published.

const rad = THREE.MathUtils.degToRad;
const clamp = THREE.MathUtils.clamp;

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const headingVec = (deg) => V(Math.sin(rad(deg)), 0, -Math.cos(rad(deg)));
const KEYS_FLY = [
  { keys: ['↑', '↓', '←', '→'], text: 'סטיק: עלייה / ירידה / גלגול (או העכבר)' },
  { keys: ['W', 'S'], text: 'מצערת: יותר / פחות מהירות' },
];
const KEY_FIRE = { keys: ['Space'], text: 'אש (או הכפתור השמאלי בעכבר)' };
const KEY_ACK = { keys: ['Enter'], text: 'אישור' };
const KEY_BOMB = { keys: ['X'], text: 'שחרור פצצה' };

/** Keep something true for a while, in a row; leaving the condition resets the count. */
class Streak {
  constructor(need) {
    this.need = need;
    this.t = 0;
    this.done = 0;
  }

  update(ok, dt) {
    if (ok) this.t += dt;
    else this.t = 0;
    if (this.t >= this.need) {
      this.t = 0;
      this.done++;
      return true;
    }
    return false;
  }
}

/** A straight stretch of low ground we can fly along (bombing and missile levels need to be able to go low). */
function findCorridor(ctx) {
  let best = null;
  for (let a = 0; a < 360; a += 15) {
    const dir = headingVec(a);
    let peak = 0;
    for (let d = 0; d <= 7500; d += 150) {
      peak = Math.max(peak, ctx.height(dir.x * d, dir.z * d));
    }
    if (!best || peak < best.peak) best = { heading: a, peak, dir };
  }
  return best;
}

function onGround(ctx, x, z, extra = 0) {
  return ctx.height(x, z) + extra;
}

// ---------- First simulator ----------

function speedLevel() {
  const bands = [[205, 235], [295, 325], [165, 195]];
  const need = 4;
  let st;
  return {
    id: 'speed',
    title: 'שליטה במהירות',
    limit: 80,
    brief: [
      'המהירות מוצגת בסרגל בצד שמאל של המסך. הפס הירוק הוא הטווח המבוקש.',
      'המצערת קובעת את המהירות. עלייה מאטה אותך וצלילה מאיצה אותך.',
      'שמור על המהירות בטווח ארבע שניות רצופות. תצטרך לעשות את זה שלוש פעמים, בטווחים שונים.',
    ],
    keys: [...KEYS_FLY],
    note: 'שלב הדרכה. לפי אתרי הכנה השלבים הראשונים בסימולטור לא ממיינים.',
    setup(ctx) {
      st = { i: 0, hold: new Streak(need), dev: 0, total: 0 };
      ctx.place({ alt: 1800, heading: 0, speedKt: 190, assist: 0.9 });
    },
    update(ctx, dt) {
      const band = bands[st.i];
      const kt = ctx.plane.speed * KT;
      const ok = kt >= band[0] && kt <= band[1];
      st.total += dt;
      if (st.hold.update(ok, dt)) {
        ctx.fx?.ok?.();
        st.i++;
        ctx.flash(st.i < bands.length ? '✓ יפה. הטווח הבא' : '✓ סיימת', '#7dffb0');
        if (st.i >= bands.length) ctx.finish({ sound: 'done' });
      }
      if (ctx.levelTime > this.limit) ctx.finish({ note: 'נגמר הזמן' });
      if (ctx.crashed) ctx.finish({ note: ctx.crashed });
    },
    hud(ctx) {
      const band = bands[Math.min(st.i, bands.length - 1)];
      return { speedBand: band, throttle: ctx.plane.throttle };
    },
    score: () => st.i / bands.length * 0.9 + clamp(1 - st.total / 80, 0, 1) * 0.1 * (st.i / bands.length),
  };
}

function altitudeLevel() {
  const targets = [
    { alt: 2300, heading: 40 },
    { alt: 1500, heading: 330 },
    { alt: 2000, heading: 90 },
  ];
  let st;
  return {
    id: 'course',
    title: 'גובה וכיוון',
    limit: 110,
    brief: [
      'עכשיו גם הכיוון. על המסך: גובה בצד ימין, מהירות בצד שמאל וצפן למעלה.',
      'החץ הצהוב בצפן הוא הכיוון המבוקש, והפס הירוק בסרגל הגובה הוא הגובה המבוקש.',
      'החזק גובה (±100 מטר) וכיוון (±10 מעלות) ארבע שניות. שלוש פעמים, בשלושה יעדים.',
    ],
    keys: [...KEYS_FLY],
    setup(ctx) {
      st = { i: 0, hold: new Streak(4), total: 0 };
      ctx.place({ alt: 1800, heading: 0, speedKt: 230, assist: 0.75 });
    },
    update(ctx, dt) {
      const t = targets[st.i];
      const altOk = Math.abs(ctx.plane.position.y - t.alt) < 100;
      const headOk = Math.abs(((ctx.plane.heading - t.heading + 540) % 360) - 180) < 10;
      st.total += dt;
      if (st.hold.update(altOk && headOk, dt)) {
        ctx.fx?.ok?.();
        st.i++;
        ctx.flash(st.i < targets.length ? '✓ יפה. היעד הבא' : '✓ סיימת', '#7dffb0');
        if (st.i >= targets.length) ctx.finish({ sound: 'done' });
      }
      if (ctx.levelTime > this.limit) ctx.finish({ note: 'נגמר הזמן' });
      if (ctx.crashed) ctx.finish({ note: ctx.crashed });
    },
    hud(ctx) {
      const t = targets[Math.min(st.i, targets.length - 1)];
      return { altBand: [t.alt - 100, t.alt + 100], headingBug: t.heading, throttle: ctx.plane.throttle };
    },
    score: () => st.i / targets.length * 0.9 + clamp(1 - st.total / 110, 0, 1) * 0.1 * (st.i / targets.length),
  };
}

/** Another aircraft ahead that speeds up, slows down and turns. */
function followScript(intensity = 1, vertical = 1) {
  return (t, e) => {
    const phase = Math.floor(t / 13);
    const turns = [0, 22, -18, 35, -28, 10, -35, 20];
    e.targetHeading = (e.baseHeading ?? 0) + turns[phase % turns.length] * intensity;
    e.targetSpeed = [120, 150, 105, 140, 98, 132][phase % 6];
    e.targetPitch = [0, 6, -5, 8, -7, 0][phase % 6] * vertical;
  };
}

function followLevel({ id, title, brief, graded, limit, intensity, vertical, success = 3, hold = 4, assist = 0.6, note }) {
  let st;
  const range = [500, 880];
  return {
    id,
    title,
    limit,
    brief,
    keys: [...KEYS_FLY],
    note,
    setup(ctx) {
      st = { streak: new Streak(hold), inCond: 0, total: 0, done: 0 };
      ctx.place({ alt: 1800, heading: 0, speedKt: 240, assist });
      const e = ctx.spawnEnemy({ position: V(0, 1800, -1250), heading: 0, speed: 125, script: followScript(intensity, vertical) });
      e.baseHeading = 0;
    },
    update(ctx, dt) {
      const e = ctx.enemy;
      const ok = e.range >= range[0] && e.range <= range[1] && e.offAxis < 15;
      st.total += dt;
      if (ok) st.inCond += dt;
      if (st.streak.update(ok, dt)) {
        st.done++;
        if (!graded) {
          ctx.fx?.ok?.();
          ctx.flash(st.done < success ? `✓ ${st.done}/${success}` : '✓ סיימת', '#7dffb0');
        }
        if (!graded && st.done >= success) ctx.finish({ sound: 'done' });
      }
      if (ctx.levelTime > this.limit) ctx.finish({ note: graded ? '' : 'נגמר הזמן' });
      if (ctx.crashed) ctx.finish({ note: ctx.crashed });
    },
    hud(ctx) {
      const e = ctx.enemy;
      const ok = e.range >= range[0] && e.range <= range[1];
      return {
        enemy: { position: e.mesh.position, range: e.range, color: ok ? '#7dffb0' : '#ffc857', label2: graded ? undefined : ok ? 'במרחק' : e.range > range[1] ? 'קרב' : 'התרחק' },
        throttle: ctx.plane.throttle,
      };
    },
    score: () => (graded ? clamp(st.inCond / (st.total * 0.7), 0, 1) : (st.done / success) * 0.8 + clamp(st.inCond / Math.max(1, st.total), 0, 1) * 0.2),
  };
}

function interceptLevel({ id, title, brief, graded, limit, need = 20, evasive = 0.6, note }) {
  let st;
  return {
    id,
    title,
    limit,
    brief,
    keys: [...KEYS_FLY, KEY_FIRE],
    note,
    setup(ctx) {
      st = { hits: 0, total: 0, killedAt: null };
      ctx.place({ alt: 1950, heading: 0, speedKt: 250, assist: 0.5 });
      const e = ctx.spawnEnemy({
        position: V(220, 1800, -1900),
        heading: 5,
        speed: 135,
        script(t, en) {
          const k = evasive;
          en.targetHeading = Math.sin(t * 0.33) * 42 * k + 5;
          en.targetPitch = Math.sin(t * 0.5 + 1) * 9 * k;
          en.targetSpeed = 128 + Math.sin(t * 0.21) * 20 * k;
        },
      });
      void e;
      ctx.onGunHit = (en) => {
        if (en.destroyed) return;
        st.hits++;
        if (st.hits >= need) {
          en.explode(ctx);
          st.killedAt = ctx.levelTime;
          ctx.flash('✓ פגיעה', '#7dffb0');
          setTimeout(() => ctx.finish({ sound: 'done' }), 900);
        }
      };
    },
    update(ctx, dt) {
      st.total += dt;
      if (ctx.levelTime > this.limit) ctx.finish({ note: 'נגמר הזמן' });
      if (ctx.crashed) ctx.finish({ note: ctx.crashed });
    },
    hud(ctx) {
      const e = ctx.enemy;
      const cone = Math.atan2(26, Math.max(120, e.range));
      const hot = e.range < 1300 && rad(e.offAxis) < cone;
      return {
        enemy: e.destroyed ? null : { position: e.mesh.position, range: e.range, color: hot ? '#ff6b6b' : '#ffc857', label2: `פגיעות ${st.hits}/${need}` },
        gunsight: { hot, angle: cone },
        throttle: ctx.plane.throttle,
      };
    },
    score: () => clamp(st.hits / need, 0, 1) * (st.killedAt ? 0.8 + 0.2 * clamp(1 - st.killedAt / 90, 0, 1) : 0.85),
  };
}

// ---------- Second simulator ----------

function drawMap(canvas, route, start) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#0e1a14';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(125,255,176,0.18)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo((i / 8) * w, 0);
    ctx.lineTo((i / 8) * w, h);
    ctx.moveTo(0, (i / 8) * h);
    ctx.lineTo(w, (i / 8) * h);
    ctx.stroke();
  }
  const all = [start, ...route];
  const half = 5200;
  const pt = (p) => [w / 2 + (p.x / half) * (w / 2), h / 2 + (p.z / half) * (h / 2)];
  ctx.strokeStyle = 'rgba(255,200,87,0.55)';
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  all.forEach((p, i) => {
    const [x, y] = pt(p);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
  route.forEach((p, i) => {
    const [x, y] = pt(p);
    ctx.fillStyle = '#ffc857';
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1405';
    ctx.font = '800 15px Heebo, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), x, y + 5);
  });
  const [sx, sy] = pt(start);
  ctx.fillStyle = '#7dffb0';
  ctx.beginPath();
  ctx.moveTo(sx, sy - 14);
  ctx.lineTo(sx - 10, sy + 10);
  ctx.lineTo(sx + 10, sy + 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#bfe6cf';
  ctx.font = '700 13px Heebo, sans-serif';
  ctx.fillText('התחלה', sx, sy + 28);
  ctx.fillStyle = '#7dffb0';
  ctx.fillText('צפון ↑', w - 44, 22);
}

function navigationLevel() {
  let st;
  let route;
  return {
    id: 'navigation',
    title: 'ניווט מהזיכרון',
    limit: 150,
    brief: [
      'תראה מפה לכמה רגעים: נקודת התחלה ושלוש נקודות ציון. אחרי זה המפה נעלמת.',
      'תצטרך לטוס אל הנקודות לפי הכיוון והמרחק שזכרת. עיגול הנקודה נראה רק כשאתה קרוב אליה.',
      'צפן בתצוגה: 0 צפון, 90 מזרח. אפשר להציץ שוב במפה (מקש M, עד שלוש פעמים), וזה מוריד מהניקוד.',
    ],
    keys: [...KEYS_FLY, { keys: ['M'], text: 'הצצה קצרה במפה' }],
    note: 'לפי אתרי הכנה הסימולטור השני כולל ניווט מהזיכרון בשטח הררי. הפרטים כאן שחזור בהשראתם.',
    setup(ctx) {
      const start = { x: 0, z: 0 };
      route = [
        { x: 2400, z: -2300 },
        { x: 600, z: -4300 },
        { x: -2600, z: -3200 },
      ];
      st = { i: 0, peeks: 0, total: 0, peekTimer: 0, rings: [] };
      ctx.place({ alt: 3150, heading: 40, speedKt: 250, assist: 0.55 });
      route.forEach((p, i) => {
        const ring = ctx.world.addRing(p.x, 3100, p.z, { radius: 260 });
        ring.visible = false;
        ring.userData.active = true;
        st.rings.push(ring);
      });
      this.mapCanvas = document.createElement('canvas');
      this.mapCanvas.width = 420;
      this.mapCanvas.height = 420;
      this.mapCanvas.style.cssText = 'width:min(100%,360px);display:block;margin:10px auto;border-radius:12px;box-shadow:inset 0 0 0 1px rgba(125,255,176,.4)';
      drawMap(this.mapCanvas, route, start);
    },
    briefExtra() {
      return this.mapCanvas;
    },
    begin(ctx) {
      ctx.onAck = null;
      const onKey = (e) => {
        if (e.code === 'KeyM' && st.peeks < 3 && !st.peekTimer) {
          st.peeks++;
          st.peekTimer = 3;
          ctx.overlay(this.mapCanvas.cloneNode(false), 3000, (c) => c.getContext('2d').drawImage(this.mapCanvas, 0, 0));
        }
      };
      document.addEventListener('keydown', onKey);
      st.cleanup = () => document.removeEventListener('keydown', onKey);
    },
    update(ctx, dt) {
      st.total += dt;
      st.peekTimer = Math.max(0, st.peekTimer - dt);
      const p = route[st.i];
      const ring = st.rings[st.i];
      const d = Math.hypot(ctx.plane.position.x - p.x, ctx.plane.position.z - p.z);
      ring.visible = d < 1400;
      if (d < 280 && Math.abs(ctx.plane.position.y - 3100) < 420) {
        ctx.fx?.ok?.();
        ring.visible = true;
        ring.userData.mat.color.set('#ffffff');
        st.i++;
        ctx.flash(st.i < route.length ? `✓ נקודה ${st.i} מתוך ${route.length}` : '✓ סיימת', '#7dffb0');
        if (st.i >= route.length) {
          st.cleanup?.();
          ctx.finish({ sound: 'done' });
        }
      }
      if (ctx.levelTime > this.limit) {
        st.cleanup?.();
        ctx.finish({ note: 'נגמר הזמן' });
      }
      if (ctx.crashed) {
        st.cleanup?.();
        ctx.finish({ note: ctx.crashed });
      }
    },
    hud(ctx) {
      return { throttle: ctx.plane.throttle };
    },
    score: (ctx) => clamp(st.i / route.length - st.peeks * 0.07, 0, 1) * (st.i >= route.length ? 1 - clamp(st.total / 150, 0, 0.25) : 0.9),
  };
}

function multitaskLevel() {
  let st;
  const range = [520, 900];
  return {
    id: 'multitask',
    title: 'ריבוי משימות',
    limit: 110,
    brief: [
      'שמור על מטוס האויב בטווח, כמו קודם. בינתיים יגיעו הסחות דעת.',
      'צפצוף בתא: לחץ Enter תוך שתי שניות. הודעת קשר: בצע את ההוראה (גובה או כיוון) בתוך 12 שניות.',
      'כשיש כמה דברים בבת אחת, מטפלים בהם אחד אחד ובשקט. לא לוותר על הטיסה.',
    ],
    keys: [...KEYS_FLY, KEY_ACK],
    note: 'לפי אתרי הכנה: בסימולטור השני יש צפצופים, נורות אזהרה והודעות בקשר. השחזור כאן הוא בהשראתם.',
    setup(ctx) {
      st = {
        total: 0,
        inCond: 0,
        beepAt: 6,
        beepOpen: 0,
        beeps: 0,
        beepHits: 0,
        falseAcks: 0,
        radioAt: 14,
        radio: null,
        radios: 0,
        radioDone: 0,
        radioIndex: 0,
      };
      ctx.place({ alt: 2000, heading: 0, speedKt: 240, assist: 0.55 });
      const e = ctx.spawnEnemy({ position: V(0, 2000, -1250), heading: 0, speed: 125, script: followScript(0.8, 0.8) });
      e.baseHeading = 0;
      ctx.onAck = () => {
        if (st.beepOpen > 0) {
          st.beepHits++;
          st.beepOpen = 0;
          ctx.fx?.click?.();
          ctx.frameExtras = {};
        } else st.falseAcks++;
      };
    },
    update(ctx, dt) {
      const e = ctx.enemy;
      st.total += dt;
      if (e.range >= range[0] && e.range <= range[1] && e.offAxis < 16) st.inCond += dt;
      // Beeps.
      if (st.beepOpen > 0) {
        st.beepOpen -= dt;
        if (st.beepOpen <= 0) {
          ctx.flash('צפצוף שלא אושר', '#ffc857');
          ctx.frameExtras = {};
        }
      } else if (ctx.levelTime >= st.beepAt) {
        st.beeps++;
        st.beepOpen = 2;
        st.beepAt = ctx.levelTime + 7 + Math.random() * 3;
        ctx.fx?.beep?.();
        ctx.flash('צפצוף! Enter', '#ffc857');
        ctx.frameExtras = { warnLamp: true };
      }
      // Radio calls: climb to an altitude, or turn to a heading.
      if (st.radio) {
        const r = st.radio;
        r.left -= dt;
        const altOk = r.alt !== undefined && Math.abs(ctx.plane.position.y - r.alt) < 130;
        const headOk = r.heading !== undefined && Math.abs(((ctx.plane.heading - r.heading + 540) % 360) - 180) < 12;
        if (altOk || headOk) {
          if (r.held === undefined) r.held = 0;
          r.held += dt;
          if (r.held > 1.5) {
            st.radioDone++;
            ctx.fx?.ok?.();
            ctx.say('קלט. תודה.', { radio: true, ms: 1800 });
            st.radio = null;
            ctx.frameExtras = {};
          }
        } else r.held = 0;
        if (st.radio && r.left <= 0) {
          ctx.flash('ההוראה לא בוצעה', '#ff6b6b');
          st.radio = null;
          ctx.frameExtras = {};
        }
      } else if (ctx.levelTime >= st.radioAt && st.radioIndex < 3) {
        const calls = [
          { text: 'כחול אחד, עלה לגובה 2500 מטר.', alt: 2500 },
          { text: 'כחול אחד, כוון לכיוון 070.', heading: 70 },
          { text: 'כחול אחד, רד לגובה 1700 מטר.', alt: 1700 },
        ];
        const call = calls[st.radioIndex++];
        st.radios++;
        st.radio = { ...call, left: 12 };
        st.radioAt = ctx.levelTime + 22;
        ctx.say(call.text, { radio: true, ms: 5200, color: '#d6ffe6' });
      }
      if (ctx.levelTime > this.limit) ctx.finish({ sound: 'done' });
      if (ctx.crashed) ctx.finish({ note: ctx.crashed });
    },
    hud(ctx) {
      const e = ctx.enemy;
      const r = st.radio;
      const out = {
        enemy: { position: e.mesh.position, range: e.range, color: e.range >= range[0] && e.range <= range[1] ? '#7dffb0' : '#ffc857' },
        throttle: ctx.plane.throttle,
      };
      if (r?.alt !== undefined) out.altBand = [r.alt - 130, r.alt + 130];
      if (r?.heading !== undefined) out.headingBug = r.heading;
      return out;
    },
    score: () => {
      const follow = clamp(st.inCond / (st.total * 0.7), 0, 1);
      const beep = st.beeps ? st.beepHits / st.beeps : 0.5;
      const radio = st.radios ? st.radioDone / st.radios : 0.5;
      return clamp(0.4 * follow + 0.3 * beep + 0.3 * radio - st.falseAcks * 0.03, 0, 1);
    },
  };
}

function bombingLevel() {
  let st;
  let corridor;
  return {
    id: 'bombing',
    title: 'הפצצה ומטרות אסורות',
    limit: 100,
    brief: [
      'טוס נמוך לאורך העמק. על הקרקע: משאיות עם משואה אדומה מהבהבת הן המטרות שלך.',
      'בתים לבנים עם גג כחול הם אזרחיים. הפצצה עליהם היא טעות חמורה שמורידה ניקוד.',
      'שחרר פצצה כשהמטרה מתחתיך (X). יש לך שש פצצות ושלוש מטרות.',
    ],
    keys: [...KEYS_FLY, KEY_BOMB],
    note: 'לפי אתרי הכנה: בסימולטור השני "מפציצים מטרות" ו"ירי למטרות אסורות מוריד ניקוד".',
    setup(ctx) {
      corridor = findCorridor(ctx);
      const d = corridor.dir;
      const side = V(-d.z, 0, d.x);
      const at = (dist, off = 0) => ({ x: d.x * dist + side.x * off, z: d.z * dist + side.z * off });
      const alt = Math.max(ctx.height(0, 0), 0) + 650;
      ctx.place({ x: 0, z: 0, alt: Math.max(alt, corridor.peak + 330), heading: corridor.heading, speedKt: 230, assist: 0.55 });
      st = { military: [], civil: [], destroyed: 0, civilHit: 0, bombsUsed: 0, total: 0 };
      for (const [dist, off] of [[2400, 30], [3800, -40], [5200, 25]]) {
        const p = at(dist, off);
        st.military.push(ctx.world.addTarget(p.x, p.z));
      }
      for (const [dist, off] of [[2900, 330], [4400, -310]]) {
        const p = at(dist, off);
        st.civil.push(ctx.world.addTarget(p.x, p.z, { civilian: true }));
      }
      ctx.bombsLeft = 6;
      ctx.onBombHit = (pos) => {
        st.bombsUsed++;
        for (const t of st.military) {
          if (!t.destroyed && Math.hypot(t.x - pos.x, t.z - pos.z) < 70) {
            t.destroyed = true;
            t.group.scale.y = 0.2;
            st.destroyed++;
            ctx.flash('✓ מטרה הושמדה', '#7dffb0');
            ctx.fx?.ok?.();
          }
        }
        for (const t of st.civil) {
          if (!t.destroyed && Math.hypot(t.x - pos.x, t.z - pos.z) < 70) {
            t.destroyed = true;
            t.group.scale.y = 0.2;
            st.civilHit++;
            ctx.flash('פגעת באזרחים!', '#ff6b6b');
            ctx.fx?.fail?.();
          }
        }
      };
    },
    update(ctx, dt) {
      st.total += dt;
      const p = ctx.plane.position;
      const f = ctx.plane.forwardVector(V(0, 0, 0));
      const passedAll = st.military.every((t) => t.destroyed || V(t.x - p.x, 0, t.z - p.z).dot(f) < -700);
      if (!st.ending && ((passedAll && ctx.levelTime > 20) || (ctx.bombsLeft <= 0 && st.bombsUsed >= 6))) {
        st.ending = true;
        setTimeout(() => ctx.finish({ sound: 'done' }), 1500);
      }
      if (ctx.levelTime > this.limit) ctx.finish({ note: 'נגמר הזמן' });
      if (ctx.crashed) ctx.finish({ note: ctx.crashed });
    },
    hud(ctx) {
      const p = ctx.plane.position;
      const marks = st.military
        .filter((t) => !t.destroyed && Math.hypot(t.x - p.x, t.z - p.z) < 3300)
        .map((t) => ({ position: V(t.x, t.y + 14, t.z), color: '#ff6b6b', size: 22, label: 'מטרה', label2: `${Math.round(Math.hypot(t.x - p.x, t.z - p.z))} מ׳` }));
      return { marks, throttle: ctx.plane.throttle, bombCount: ctx.bombsLeft };
    },
    score: () => clamp(st.destroyed / 3 - st.civilHit * 0.4, 0, 1) * 0.95 + (st.destroyed === 3 && st.civilHit === 0 ? 0.05 : 0),
  };
}

function missilesLevel() {
  let st;
  let corridor;
  return {
    id: 'missiles',
    title: 'התחמקות מטילים',
    limit: 78,
    brief: [
      'שלושה טילים ישוגרו אליך מהקרקע. כשנשמעת אזהרה ומופיע חץ אדום, הטיל בדרך.',
      'המתן עד שהוא קרוב ואז פנה בחדות, בניצב לכיוון שלו. טיל לא יכול להתהפך מהר כמוך.',
      'החלק הכי חשוב: להמשיך לטוס ברוגע בין הטילים, בלי להתרסק לתוך ההרים.',
    ],
    keys: [...KEYS_FLY],
    note: 'לפי אתרי הכנה: בסימולטור השני "התחמקות מטילים ושטח הררי". המהירויות כאן אינן אמיתיות.',
    setup(ctx) {
      corridor = findCorridor(ctx);
      const d = corridor.dir;
      const side = V(-d.z, 0, d.x);
      ctx.place({ x: 0, z: 0, alt: Math.max(ctx.height(0, 0), 0) + 600, heading: corridor.heading, speedKt: 240, assist: 0.5 });
      ctx.plane.position.y = Math.max(ctx.plane.position.y, corridor.peak + 320);
      st = { launches: [d, d, d], times: [8, 28, 48], fired: 0, evaded: 0, hits: 0, total: 0, side };
      ctx.onMissileHit = () => {
        st.hits++;
        ctx.flash('נפגעת!', '#ff6b6b');
        if (st.hits >= 2) ctx.crash('נפגעת משני טילים');
      };
      ctx.onMissileGone = () => {
        st.evaded++;
        ctx.flash('✓ התחמקת', '#7dffb0');
        ctx.fx?.ok?.();
      };
    },
    update(ctx, dt) {
      st.total += dt;
      if (st.fired < 3 && ctx.levelTime >= st.times[st.fired]) {
        const p = ctx.plane.position;
        const f = ctx.plane.forwardVector(V(0, 0, 0));
        f.y = 0;
        f.normalize();
        const sign = st.fired % 2 ? -1 : 1;
        const origin = { x: p.x + f.x * 2600 + st.side.x * 700 * sign, z: p.z + f.z * 2600 + st.side.z * 700 * sign };
        ctx.launchMissile(origin);
        ctx.say('שיגור! טיל בדרך.', { radio: true, ms: 2600, color: '#ffb0b0' });
        st.fired++;
      }
      const live = ctx.world.missiles.find((m) => !m.dead);
      if (live && live.distance < 1700 && Math.floor(ctx.levelTime * 4) % 3 === 0 && Math.floor(ctx.levelTime * 4) !== st.lastBeep) {
        st.lastBeep = Math.floor(ctx.levelTime * 4);
        ctx.fx?.missile?.();
      }
      if (st.fired >= 3 && !live && ctx.levelTime > st.times[2] + 6) ctx.finish({ sound: 'done' });
      if (ctx.levelTime > this.limit) ctx.finish({ note: '' });
      if (ctx.crashed) ctx.finish({ note: ctx.crashed });
    },
    hud(ctx) {
      return { throttle: ctx.plane.throttle };
    },
    score: () => clamp(st.evaded / 3 - st.hits * 0.2, 0, 1) * (st.fired >= 3 ? 1 : 0.6),
  };
}

// ---------- The lists ----------

export function buildLevels(kind) {
  if (kind === 'sim1') {
    return [
      speedLevel(),
      altitudeLevel(),
      followLevel({
        id: 'follow',
        title: 'מרחק ממטוס אחר',
        limit: 120,
        intensity: 0.7,
        vertical: 0.4,
        brief: [
          'לפניך מטוס אחר. המשימה: לשמור עליו במרחק מבוקש ולהחזיק אותו קרוב למרכז הכוונת.',
          'הסימון על המסך מראה את המרחק במטרים. הטווח הנכון: 500 עד 880 מטר. אם הוא מתרחק, תוסיף מהירות. אם אתה מתקרב מדי, תפחית.',
          'ארבע שניות בטווח הן הצלחה אחת. צריך שלוש הצלחות.',
        ],
        note: 'לפי אתרי הכנה: צריך להחזיק את המרחק הנדרש שלוש פעמים כדי לעבור שלב.',
      }),
      followLevel({
        id: 'follow-turns',
        title: 'פניות, עלייה וירידה',
        limit: 130,
        intensity: 1.1,
        vertical: 1,
        assist: 0.4,
        brief: [
          'הפעם המטוס מתחיל לפנות, לעלות ולרדת. נטה בעקבותיו תוך כדי שמירה על הטווח.',
          'פנייה = גלגול (כנף למטה) וגם משיכה אחורה. הסתכל על הסימון, לא על האופק.',
        ],
      }),
      interceptLevel({
        id: 'intercept-train',
        title: 'יירוט וירי',
        limit: 100,
        evasive: 0.45,
        need: 14,
        brief: [
          'הגיע הזמן לירות. מטוס אויב מתחמק לפניך.',
          'התקרב לפחות ל־1,300 מטר, הצב אותו בתוך העיגול ולחץ על ירי. העיגול הופך אדום כשהוא בטווח הפגיעה.',
        ],
      }),
      followLevel({
        id: 'exam-follow',
        title: 'בחינה: מרחק ופניות',
        graded: true,
        limit: 62,
        intensity: 1.15,
        vertical: 1,
        assist: 0.3,
        brief: [
          'מכאן זה בחינה. אין עצירות ואין הסברים באמצע.',
          'שמור על מטוס האויב בטווח (500 עד 880 מטר) ובעיגול הכוונת כל עוד תוכל. הניקוד הוא כמה מהזמן הצלחת.',
        ],
        note: 'לפי אתרי הכנה: אחרי שלבי ההדרכה יש חלק ממיין, שאחריו המדריך מודיע אם ממשיכים.',
      }),
      interceptLevel({
        id: 'exam-intercept',
        title: 'בחינה: יירוט',
        graded: true,
        limit: 60,
        evasive: 0.85,
        need: 20,
        brief: ['החלק האחרון: יירוט וירי תוך דקה. מטוס האויב ינסה להתחמק. פגיעות רצופות ישמידו אותו.'],
      }),
    ];
  }
  return [navigationLevel(), multitaskLevel(), bombingLevel(), missilesLevel()];
}
