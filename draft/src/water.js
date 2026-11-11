import * as THREE from 'three';
import { POOL, SPOTS, TREAD_Y, inPool } from './world.js';
import { noise, tone } from '../../pilot-path/shared/fx.js';
import { play } from '../../shared/engine/sound.js';

// Everything the player does in the water. Each task is a ticker (it runs per frame, so the dev hook
// `advance()` can drive it) with a small HUD of meters and on-screen buttons. Keys: A / D (or the mouse
// buttons) for strokes, Space to kick / breathe, E for the action.

const $ = (id) => document.getElementById(id);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/** Where people (and the player) stand: on the deck, or "in" the water with the head out. */
export const poolGround = (x, z) => (inPool(x, z) ? TREAD_Y : 0);

/** Eye height above `poolGround` while treading: just above the water. */
export const EYE_WATER = POOL.water - TREAD_Y + 0.12;

export const sfx = {
  stroke() {
    noise(0.16, { filter: 'bandpass', freq: 900 + Math.random() * 500, q: 0.8, volume: 0.08 });
  },
  splash() {
    noise(0.4, { filter: 'lowpass', freq: 1400, sweep: 300, volume: 0.14 });
  },
  breath() {
    noise(0.3, { filter: 'bandpass', freq: 600, q: 0.6, volume: 0.05, attack: 0.08 });
  },
  bubbles() {
    for (let i = 0; i < 4; i++) tone(350 + Math.random() * 300, 0.08, { at: i * 0.07, slide: 900, volume: 0.04 });
  },
  cough() {
    noise(0.14, { filter: 'bandpass', freq: 500, q: 2, volume: 0.16 });
    noise(0.14, { filter: 'bandpass', freq: 450, q: 2, volume: 0.13, at: 0.25 });
  },
  clank() {
    tone(1600, 0.12, { type: 'triangle', volume: 0.06 });
    tone(2300, 0.08, { type: 'triangle', volume: 0.04, at: 0.05 });
  },
  whistle() {
    play('whistle', { volume: 0.7 });
  },
};

/** The water HUD: a title, up to three meters, a hint line and touch buttons. */
function createPad(game) {
  const box = $('water');
  const handlers = new Set();
  const emit = (name) => {
    if (game.ui.modalOpen) return;
    for (const h of [...handlers]) h(name);
  };
  document.addEventListener('keydown', (event) => {
    if (box.hidden || event.repeat) return;
    const map = { KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'kick', KeyE: 'act' };
    const name = map[event.code];
    if (!name) return;
    event.preventDefault();
    emit(name);
  });
  game.canvas.addEventListener('mousedown', (event) => {
    if (box.hidden || !game.player.locked) return;
    if (event.button === 0) emit(box.dataset.mouse === 'act' ? 'act' : 'left');
    if (event.button === 2) emit('right');
  });
  game.canvas.addEventListener('contextmenu', (event) => {
    if (!box.hidden) event.preventDefault();
  });
  for (const b of box.querySelectorAll('[data-input]')) {
    b.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      emit(b.dataset.input);
    });
  }
  return {
    /** buttons: which inputs this task uses, with their labels, e.g. { left: 'יד שמאל', kick: 'נשימה' }. */
    show(title, buttons, { mouse = 'strokes' } = {}) {
      box.hidden = false;
      box.dataset.mouse = mouse;
      $('water-title').textContent = title;
      for (const b of box.querySelectorAll('[data-input]')) {
        const label = buttons[b.dataset.input];
        b.hidden = !label;
        if (label) b.querySelector('span').textContent = label;
      }
      this.meters([]);
      this.hint('');
    },
    /** [[label, value 0..1, className?], ...] */
    meters(list) {
      const host = $('water-meters');
      while (host.children.length < list.length) {
        const row = document.createElement('div');
        row.className = 'water-meter';
        row.innerHTML = '<span></span><div class="track"><div class="fill"></div><div class="zone"></div></div>';
        host.append(row);
      }
      [...host.children].forEach((row, i) => {
        const item = list[i];
        row.hidden = !item;
        if (!item) return;
        const [label, value, cls = '', zone = null] = item;
        if (row.firstChild.textContent !== label) row.firstChild.textContent = label;
        row.className = `water-meter ${cls}`;
        row.querySelector('.fill').style.transform = `scaleX(${clamp(value)})`;
        const z = row.querySelector('.zone');
        z.hidden = !zone;
        if (zone) {
          z.style.insetInlineStart = `${zone[0] * 100}%`;
          z.style.width = `${(zone[1] - zone[0]) * 100}%`;
        }
      });
    },
    hint(text) {
      if ($('water-hint').textContent !== text) $('water-hint').textContent = text;
    },
    on(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    hide() {
      box.hidden = true;
      handlers.clear();
    },
  };
}

export function createWater(game) {
  const { player, ui, people, world } = game;
  const pad = createPad(game);
  const stats = {};

  // ---------- Getting in and out ----------

  function enter(x, z, yaw) {
    player.teleport(x, z, yaw);
    player.eyeOverride = EYE_WATER;
    player.speedScale = 0.35;
    sfx.splash();
  }

  function leave(spot = SPOTS.edgeEast, yaw = -Math.PI / 2) {
    player.positionLocked = false;
    player.eyeOverride = null;
    player.speedScale = 1;
    player.teleport(spot.x, spot.z, yaw);
  }

  /** The common frame of a task: busy flag (so clicks don't talk to people), HUD, cleanup. */
  async function task(title, buttons, run, options) {
    game.onAction = () => {};
    pad.show(title, buttons, options);
    try {
      return await run();
    } finally {
      pad.hide();
      game.onAction = null;
      player.positionLocked = false;
    }
  }

  // ---------- 1. Swim test: two lengths front crawl, a short break, two lengths breaststroke ----------

  async function swimTest() {
    const lane = 2;
    const x = POOL.lanes[lane];
    const start = POOL.halfZ - 0.6;
    const swimmers = people.group.slice(0, 5);
    const lanes = [0, 1, 3, 4, 5];
    swimmers.forEach((p, i) => p.place(POOL.lanes[lanes[i]], start, Math.PI).setPose('tread'));
    enter(x, start, 0);
    player.positionLocked = true;

    await ui.talk(game.staff('head'), 'שתי בריכות חתירה, הפסקה קצרה, שתי בריכות חזה. מתחילים בשריקה. מי שצריך לעצור, עוצר בקיר, לא באמצע.');
    sfx.whistle();

    // NPCs: crawl there and back, a break, breaststroke there and back. Their finish time is known up front.
    const L = POOL.halfZ * 2 - 1.2;
    const npcTimes = swimmers.map((p) => (2 * L) / p.pace + 10 + (2 * L) / (p.pace * 0.78));
    swimmers.forEach((p) => {
      p.walkTo([{ x: p.position.x, z: -start }, { x: p.position.x, z: start }], {
        moving: 'swim',
        speed: p.pace,
        pose: 'tread',
        onArrive: () => {
          setTimeoutTicks(10, () =>
            p.walkTo([{ x: p.position.x, z: -start }, { x: p.position.x, z: start }], { moving: 'breast', speed: p.pace * 0.78, pose: 'tread' }),
          );
        },
      });
    });

    let z = start;
    let dir = -1;
    let lengths = 0;
    let v = 0;
    let air = 1;
    let last = null;
    let good = 0;
    let bad = 0;
    let chokes = 0;
    let stall = 0;
    let time = 0;
    let phase = 'crawl';
    let breakLeft = 0;
    let cycle = 0; // breaststroke rhythm 0..1
    const result = await task('מבחן שחייה · חתירה', { left: 'יד שמאל', right: 'יד ימין', kick: 'נשימה' }, () => {
      const off = pad.on((input) => {
        if (stall > 0 || breakLeft > 0) return;
        if (phase === 'crawl') {
          if (input === 'kick') {
            air = Math.min(1, air + 0.55);
            v *= 0.85;
            sfx.breath();
            return;
          }
          if (input !== 'left' && input !== 'right') return;
          if (input === last) {
            bad++;
            v += 0.12; // Same arm twice: you roll and lose the line.
          } else {
            good++;
            v += 0.42;
          }
          last = input;
          sfx.stroke();
        } else if (input === 'kick') {
          // Breaststroke: pull and kick when the circle closes; pressing in the glide wastes it.
          const inZone = cycle > 0.72;
          if (inZone) {
            good++;
            v += 0.95;
          } else {
            bad++;
            v += 0.2;
          }
          cycle = 0;
          sfx.stroke();
        }
      });
      return game
        .waitUntil((dt) => {
          if (ui.modalOpen) return false;
          time += dt;
          if (time > 240) {
            // The game's own limit: after four minutes the staff call you out of the water.
            ui.toast(`${game.staff('head')}: "מספיק, צא מהמים. נרשם."`, 2800);
            time = 999;
            return true;
          }
          player.yaw = dir < 0 ? 0 : Math.PI;
          player.pitch = -0.08;
          if (breakLeft > 0) {
            breakLeft -= dt;
            pad.hint(`הפסקה קצרה בקיר: ${Math.ceil(breakLeft)} שנ׳`);
            air = Math.min(1, air + dt * 0.5);
            if (breakLeft <= 0) {
              phase = 'breast';
              sfx.whistle();
              pad.show('מבחן שחייה · חזה', { kick: 'משיכה ובעיטה' });
            }
            return false;
          }
          if (stall > 0) {
            stall -= dt;
            v = 0;
          }
          if (phase === 'crawl') {
            air -= dt * (0.13 + v * 0.05);
            if (air <= 0) {
              // Out of air: you stop, cough, and lose time.
              chokes++;
              stall = 1.4;
              air = 0.7;
              sfx.cough();
              ui.toast('נגמר האוויר. נשימה כל 2–3 תנועות', 2400);
            }
            v = Math.max(0, v - dt * (0.55 + v * 0.55));
            v = Math.min(v, 1.9);
            pad.meters([
              ['מהירות', v / 1.9],
              ['אוויר', air, air < 0.25 ? 'low' : ''],
            ]);
            pad.hint(`בריכה ${lengths + 1} מתוך 2 · ימין־שמאל לסירוגין, נשימה לפני שהאוויר נגמר`);
          } else {
            cycle = Math.min(1, cycle + dt / 1.25);
            v = Math.max(0, v - dt * (0.32 + v * 0.35));
            v = Math.min(v, 1.6);
            pad.meters([
              ['מהירות', v / 1.6],
              ['קצב', cycle, cycle > 0.72 ? 'ready' : '', [0.72, 1]],
            ]);
            pad.hint(`בריכה ${lengths - 1} מתוך 2 · לחץ כשהקצב מגיע לאזור המסומן. גלישה היא חלק מהשחייה`);
          }
          z += dir * v * dt;
          player.bob += dt * v * 6;
          if ((dir < 0 && z <= -start) || (dir > 0 && z >= start)) {
            z = dir < 0 ? -start : start;
            dir = -dir;
            lengths++;
            v *= 0.4;
            sfx.splash();
            if (lengths === 2) breakLeft = 10;
            if (lengths === 4) return true;
          }
          player.x = x;
          player.z = z;
          return false;
        })
        .finally(off);
    });
    void result;
    const place = 1 + npcTimes.filter((t) => t < time).length;
    const technique = clamp(good / Math.max(1, good + bad) - chokes * 0.08);
    stats.swim = { time, place, technique, chokes };
    swimmers.forEach((p) => p.stop('tread'));
    return stats.swim;
  }

  // A tiny delay that counts frames, not wall time (so the dev hook can drive it).
  function setTimeoutTicks(seconds, fn) {
    let left = seconds;
    game.waitUntil((dt) => {
      left -= dt;
      if (left > 0) return false;
      fn();
      return true;
    });
  }

  // ---------- 2. Treading: elbows out of the water, then your turn at the stretcher ----------

  async function tread({ seconds = 50, stretcherFrom = 20, stretcherTo = 36 } = {}) {
    const c = SPOTS.circle;
    const ring = people.group;
    ring.forEach((p, i) => {
      const a = (i / (ring.length + 1)) * Math.PI * 2;
      p.place(c.x + Math.cos(a) * 2.6, c.z + Math.sin(a) * 2.6, -a - Math.PI / 2).setPose('tread-high');
    });
    enter(c.x, c.z + 2.6, 0);
    player.positionLocked = true;
    player.faceTowards(c.x, c.z);
    player.pitch = -0.1;
    // The stretcher floats in the middle; four people hold it up.
    const s = world.stretcher;
    s.position.set(c.x, POOL.water + 0.45, c.z);
    s.rotation.set(0, 0.6, 0);
    const holders = ring.slice(0, 4);
    holders.forEach((p, i) => p.place(c.x + (i < 2 ? -0.55 : 0.55), c.z + (i % 2 ? 0.7 : -0.7), i < 2 ? Math.PI / 2 : -Math.PI / 2).setPose('hold-up'));

    let h = 0.7;
    let time = 0;
    let inZone = 0;
    let swallowed = 0;
    let kicks = [];
    let strength = 1;
    let holding = false;
    let cheaterSeen = false;
    await task('דריכת מים · מרפקים מעל המים', { kick: 'בעיטה' }, () => {
      const off = pad.on((input) => {
        if (input !== 'kick') return;
        const now = time;
        kicks = kicks.filter((k) => now - k < 1);
        kicks.push(now);
        // Kicking in a panic (more than 4 a second) tires you out fast.
        if (kicks.length > 4) strength = Math.max(0.35, strength - 0.06);
        h = Math.min(1, h + 0.085 * strength);
      });
      return game
        .waitUntil((dt) => {
          if (ui.modalOpen) return false;
          time += dt;
          strength = Math.min(1, strength + dt * 0.04);
          const sink = holding ? 0.24 : 0.17;
          h = Math.max(0, h - sink * dt);
          if (h > 0.35 && h < 0.85) inZone += dt;
          if (h < 0.12) {
            swallowed++;
            h = 0.45;
            sfx.cough();
            ui.toast('בלעת מים. בעיטות רגועות ויציבות, לא מהירות', 2200);
          }
          // Your turn at the stretcher.
          if (!holding && time > stretcherFrom && time < stretcherTo) {
            holding = true;
            holders[3].setPose('tread-high');
            holders[3].place(c.x + 1.6, c.z + 1.2, -2.2);
            player.x = c.x + 0.55;
            player.z = c.z + 0.7;
            player.faceTowards(c.x - 0.6, c.z);
            player.pitch = 0.15;
            pad.show('אלונקה במים · מחזיקים מעל הראש', { kick: 'בעיטה' });
            ui.toast(`${game.staff('second')}: "${game.state.bib}, לאלונקה. ידיים למעלה."`, 2600);
          }
          if (holding && time >= stretcherTo) {
            holding = false;
            holders[3].place(c.x + 0.55, c.z + 0.7, -Math.PI / 2).setPose('hold-up');
            player.x = c.x;
            player.z = c.z + 2.6;
            player.faceTowards(c.x, c.z);
            player.pitch = -0.1;
            pad.show('דריכת מים · מרפקים מעל המים', { kick: 'בעיטה' });
          }
          // One of the group reaches for the wall when the staff look away (it matters later).
          if (!cheaterSeen && time > 30) {
            cheaterSeen = true;
            ui.toast('נועם שוחה לאט לקיר ונתלה עליו כשעוז מסתכל לצד השני', 3200);
          }
          player.eyeOverride = EYE_WATER - 0.5 + h * 0.62 + Math.sin(time * 3) * 0.03;
          pad.meters([
            ['גובה מעל המים', h, h < 0.25 ? 'low' : '', [0.35, 0.85]],
            ['כוח ברגליים', strength, strength < 0.5 ? 'low' : ''],
          ]);
          pad.hint(holding ? 'הידיים על האלונקה, רק הרגליים עובדות. שוקעים מהר יותר' : `עוד ${Math.ceil(seconds - time)} שנ׳ · בעיטה רגועה בכל פעם שהגובה יורד`);
          return time >= seconds;
        })
        .finally(off);
    });
    ring.forEach((p) => p.setPose('tread'));
    s.position.set(SPOTS.table.x, 0.8, SPOTS.table.z);
    s.rotation.set(0, 0, 0);
    stats.tread = { score: clamp(inZone / seconds - swallowed * 0.08 + 0.1), swallowed };
    player.eyeOverride = EYE_WATER;
    return stats.tread;
  }

  // ---------- 3. Diving for the weights ----------

  async function dive({ limit = 100, earProblem = false } = {}) {
    const w = SPOTS.weights;
    enter(w.x, w.z + 1.2, 0);
    player.positionLocked = true;
    player.faceTowards(w.x, w.z);
    world.plates.forEach((p) => {
      p.visible = true;
    });
    let state = 'top'; // top | down | bottom | up
    let depth = 0; // 0 at the surface, 1 at the bottom
    let breath = 1;
    let plate = 0;
    let turns = 0;
    let time = 0;
    let forced = 0;
    let dives = 0;
    let earHurt = false;
    const bottomEye = POOL.bottom + 0.55 - TREAD_Y;
    await task('צלילה · לפרק את המשקולות בקרקעית', { kick: 'לצלול / לעלות', act: 'לסובב' }, () => {
      const off = pad.on((input) => {
        if (input === 'kick') {
          if (state === 'top' && breath > 0.35) {
            state = 'down';
            dives++;
            sfx.splash();
          } else if (state === 'top') {
            ui.toast('קודם נשימה. לצלול בלי אוויר זה לחזור באמצע', 1800);
          } else if (state === 'bottom' || state === 'down') state = 'up';
        }
        if (input === 'act' && state === 'bottom') {
          turns++;
          sfx.clank();
          if (turns >= 10) {
            turns = 0;
            world.plates[plate].visible = false;
            plate++;
            ui.toast(`צלחת ${plate} מתוך 4 יצאה`, 1500);
          }
        }
      });
      return game
        .waitUntil((dt) => {
          if (ui.modalOpen) return false;
          time += dt;
          if (state === 'down') {
            depth = Math.min(1, depth + dt / 1.6);
            breath -= dt * 0.07;
            if (earProblem && depth > 0.6 && !earHurt) {
              earHurt = true;
              ui.toast('האוזן כואבת בעומק. זו האוזן שלא סיפרת עליה', 3000);
            }
            if (depth >= 1) state = 'bottom';
          } else if (state === 'bottom') {
            breath -= dt * (earHurt ? 0.14 : 0.1);
            if (Math.random() < dt * 0.8) sfx.bubbles();
          } else if (state === 'up') {
            depth = Math.max(0, depth - dt / 1.2);
            breath -= dt * 0.05;
            if (depth <= 0) {
              state = 'top';
              sfx.breath();
            }
          } else {
            breath = Math.min(1, breath + dt * 0.28);
          }
          if (breath <= 0 && state !== 'top') {
            // Out of breath at the bottom: you shoot up, and the staff notice.
            forced++;
            breath = 0.05;
            state = 'up';
            sfx.cough();
            ui.toast('האוויר נגמר וחזרת למעלה בבהלה. המציל קם מהכיסא', 2600);
          }
          player.eyeOverride = EYE_WATER + (bottomEye - EYE_WATER) * depth;
          player.pitch = -0.9 + depth * 0.5;
          const labels = { top: 'למעלה · נושם', down: 'צולל', bottom: 'בקרקעית', up: 'עולה' };
          pad.meters([
            ['אוויר', breath, breath < 0.25 ? 'low' : ''],
            ['הצלחת הנוכחית', turns / 10],
          ]);
          pad.hint(`${labels[state]} · ${plate} מתוך 4 צלחות · נשאר ${Math.max(0, Math.ceil(limit - time))} שנ׳`);
          return plate >= 4 || time >= limit;
        })
        .finally(off);
    });
    player.eyeOverride = EYE_WATER;
    player.pitch = 0;
    stats.dive = { score: clamp(plate / 4 - forced * 0.15 + (plate >= 4 ? Math.max(0, (limit - time) / limit) * 0.2 : 0)), plates: plate, forced, dives };
    return stats.dive;
  }

  // ---------- 4. The pressure ring ----------

  async function ring({ seconds = 60, onEvent } = {}) {
    const c = SPOTS.circle;
    const circle = people.group;
    const n = circle.length + 1;
    const R = 1.5;
    circle.forEach((p, i) => {
      const a = ((i + 1) / n) * Math.PI * 2;
      p.place(c.x + Math.sin(a) * R, c.z + Math.cos(a) * R, a + Math.PI).setPose('ring');
    });
    enter(c.x, c.z + R, 0);
    player.positionLocked = true;
    player.faceTowards(c.x, c.z);
    player.pitch = -0.12;

    let pulse = 95;
    let time = 0;
    let cycle = 0;
    let good = 0;
    let presses = 0;
    let event = false;
    let maxPulse = 95;
    await task('טבעת הלחץ · ידיים על הכתפיים', { kick: 'נשימה עמוקה' }, () => {
      const off = pad.on((input) => {
        if (input !== 'kick') return;
        presses++;
        // A slow breath at the top of the cycle calms you; gasping does the opposite.
        if (cycle > 0.78) {
          good++;
          pulse = Math.max(70, pulse - 9);
          sfx.breath();
        } else pulse = Math.min(190, pulse + 6);
        cycle = 0;
      });
      return game
        .waitUntil((dt) => {
          if (ui.modalOpen) return false;
          time += dt;
          cycle = Math.min(1, cycle + dt / 4);
          // Cold, tired legs and the weight of the people around you push the pulse up.
          pulse = Math.min(190, pulse + dt * (2.2 + time / 40));
          if (cycle >= 1) {
            pulse = Math.min(190, pulse + 3);
            cycle = 0.5;
          }
          maxPulse = Math.max(maxPulse, pulse);
          if (!event && time > seconds * 0.45) {
            event = true;
            onEvent?.();
          }
          player.eyeOverride = EYE_WATER + 0.06 + Math.sin(time * 1.4) * 0.04;
          pad.meters([
            ['דופק', (pulse - 60) / 130, pulse > 150 ? 'low' : ''],
            ['נשימה', cycle, cycle > 0.78 ? 'ready' : '', [0.78, 1]],
          ]);
          const minutes = Math.min(20, Math.round((time / seconds) * 20));
          pad.hint(`במציאות 15–20 דקות · במשחק דקה · עברו ${minutes} "דקות" · נשימה עמוקה כשהעיגול מתמלא`);
          return time >= seconds;
        })
        .finally(off);
    });
    circle.forEach((p) => p.setPose('tread'));
    stats.ring = { score: clamp(1 - (maxPulse - 110) / 80) * 0.6 + clamp(good / Math.max(6, presses)) * 0.4, maxPulse };
    return stats.ring;
  }

  // ---------- 5. Team rescue: three people across the pool with two boats and ropes ----------

  async function rescue({ teamwork = 0.6 } = {}) {
    const [boatA, boatB] = world.boats;
    const north = POOL.halfZ - 1.8;
    const south = -POOL.halfZ + 1.8;
    const laneA = 2.6;
    const laneB = -2.6;
    for (const [b, x] of [
      [boatA, laneA],
      [boatB, laneB],
    ]) {
      b.position.set(x, POOL.water + 0.12, north);
      b.rotation.set(0, 0, 0);
    }
    // Three "casualties" float at the north end; the team pulls them south.
    const casualties = people.others.slice(0, 3);
    casualties.forEach((p, i) => p.place(-1.5 + i * 1.5, north + 0.3, Math.PI).setPose('float-back'));
    const ropeA = world.makeRope();
    const ropeB = world.makeRope();
    const helpers = people.group.filter((p) => !['loud', 'hider'].includes(p.info.trait)).slice(0, 4);
    helpers.forEach((p, i) => p.place(i < 2 ? laneA - 0.6 + i * 1.2 : laneB - 0.6 + (i - 2) * 1.2, -POOL.halfZ - 1.2, 0).setPose('hold-up'));
    leave({ x: laneA, z: -POOL.halfZ - 1.2 }, 0);
    player.positionLocked = true;
    player.faceTowards(laneA, 0);

    // Trips: A takes casualties 1 and 3, B takes 2. An empty boat is pulled back by its tail rope (automatic).
    const trips = [
      { boat: boatA, x: laneA, who: casualties[0], player: true },
      { boat: boatB, x: laneB, who: casualties[1], player: false },
      { boat: boatA, x: laneA, who: casualties[2], player: true },
    ];
    let time = 0;
    let tripIndex = 0;
    let call = 0;
    let pulls = 0;
    let goodPulls = 0;
    let returning = null;
    const npcRate = 0.45 + teamwork * 0.5;
    await task('חילוץ · למשוך את הסירה בחבל', { act: 'משיכה' }, () => {
      const off = pad.on((input) => {
        if (input !== 'act') return;
        const trip = trips[tripIndex];
        if (!trip?.player || returning) return;
        pulls++;
        // Pull on the call ("הופ!") and the boat moves; pulling off the call jerks the rope.
        const onCall = call > 0.8 || call < 0.12;
        if (onCall) goodPulls++;
        trip.boat.position.z -= onCall ? 1.15 : 0.35;
        noise(0.12, { filter: 'bandpass', freq: 300, q: 1, volume: 0.06 });
      });
      return game
        .waitUntil((dt) => {
          if (ui.modalOpen) return false;
          time += dt;
          call = (call + dt / 1.1) % 1;
          const trip = trips[tripIndex];
          if (!trip) return true;
          // The casualty rides in the boat.
          trip.who.group.position.set(trip.boat.position.x, POOL.water - 1.2, trip.boat.position.z);
          if (!trip.player) trip.boat.position.z -= dt * npcRate * 1.6;
          const anchor = new THREE.Vector3(trip.x, 0.9, -POOL.halfZ - 0.9);
          (trip.boat === boatA ? ropeA : ropeB).set(anchor, trip.boat.position.clone().add(new THREE.Vector3(0, 0.25, -1.3)));
          if (trip.boat.position.z <= south) {
            trip.who.place(trip.x + 1, south + 0.4, 0).setPose('tread');
            sfx.splash();
            tripIndex++;
            returning = trip.boat;
            ui.toast(`${tripIndex} מתוך 3 הועברו`, 1400);
          }
          if (returning) {
            // Back to the north end on the tail rope.
            returning.position.z += dt * 6;
            if (returning.position.z >= north) {
              returning.position.z = north;
              returning = null;
            }
          }
          const next = trips[tripIndex];
          pad.meters(next?.player ? [['קריאת "הופ!"', call, call > 0.8 || call < 0.12 ? 'ready' : '', [0.8, 1]]] : [['הסירה השנייה', 1 - (next ? (next.boat.position.z - south) / (north - south) : 0)]]);
          pad.hint(next?.player ? 'למשוך ביחד עם הקריאה. משיכה לבד רק מטלטלת את הסירה' : 'החוליה השנייה מושכת. אתה מחכה בצד');
          return tripIndex >= trips.length && !returning;
        })
        .finally(off);
    }, { mouse: 'act' });
    ropeA.hide();
    ropeB.hide();
    helpers.forEach((p) => p.setPose('stand'));
    stats.rescue = { time, pulls: clamp(goodPulls / Math.max(1, pulls)) };
    return stats.rescue;
  }

  return { enter, leave, swimTest, tread, dive, ring, rescue, stats };
}
