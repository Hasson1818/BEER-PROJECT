import { createPad, sfx } from '../../draft/src/water.js';
import { POOL, SEA, SPOTS, waterGround } from './world.js';

// The water part of the Shayetet gibbush (from the accounts 2023–2026): a 400 m swim to a buoy and back, floating
// on ropes with a blacked-out mask and a snorkel, the pool set (breath-hold swim, rings from 4 m with and without
// a blacked-out mask, a weight held up with the legs only, mask clearing), climbing into a boat from the water,
// and the "בריכת לחץ". Each task is a ticker, so the dev hook can drive it; the HUD is the one from the 669 pool day.

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const EYE = 1.54; // above waterGround: just over the water

export function createWater(game) {
  const { player, ui, people, world } = game;
  const pad = createPad(game);

  function enterAt(x, z, yaw = 0) {
    player.teleport(x, z, yaw);
    player.eyeOverride = EYE;
    sfx.splash();
  }
  function leave(spot, yaw = Math.PI) {
    player.positionLocked = false;
    player.eyeOverride = null;
    player.teleport(spot.x, spot.z, yaw);
    document.body.classList.remove('blind');
  }
  async function task(title, buttons, run, options) {
    // Clicks must not talk to people during a water task; `silent` keeps the "פעולה" prompt off the screen.
    const busy = () => {};
    busy.silent = true;
    game.onAction = busy;
    pad.show(title, buttons, options);
    try {
      return await run();
    } finally {
      pad.hide();
      game.onAction = null;
      player.positionLocked = false;
    }
  }

  // ---------- 400 m to the buoy and back ----------

  async function seaSwim() {
    const startZ = -57.5;
    const x = SPOTS.buoy.x;
    const turnZ = SPOTS.buoy.z + 1.5;
    const scale = 200 / Math.abs(turnZ - startZ); // game meters → real meters (200 out, 200 back)
    const swimmers = people.teammates.filter((p) => !p.info.out).slice(0, 6);
    swimmers.forEach((p, i) => p.place(x - 4 + i * 1.6, startZ - 1, Math.PI).setPose('tread'));
    enterAt(x, startZ - 1, 0);
    player.positionLocked = true;
    sfx.whistle();
    const npcTimes = swimmers.map((p) => {
      const pace = 0.5 + p.fitness * 0.32; // m/s in the game's scale
      p.walkTo([{ x: p.position.x, z: turnZ }, { x: p.position.x, z: startZ - 0.5 }], { moving: 'swim', speed: pace, pose: 'tread' });
      return (2 * Math.abs(turnZ - startZ)) / pace;
    });
    let z = startZ - 1;
    let dir = -1;
    let v = 0;
    let air = 1;
    let last = null;
    let good = 0;
    let bad = 0;
    let chokes = 0;
    let time = 0;
    let stall = 0;
    await task('שחייה · 400 מ׳ עד המצוף וחזרה', { left: 'יד שמאל', right: 'יד ימין', kick: 'נשימה' }, () => {
      const off = pad.on((input) => {
        if (stall > 0) return;
        if (input === 'kick') {
          air = Math.min(1, air + 0.55);
          v *= 0.85;
          sfx.breath();
          return;
        }
        if (input !== 'left' && input !== 'right') return;
        if (input === last) {
          bad++;
          v += 0.08;
        } else {
          good++;
          v += 0.36;
        }
        last = input;
        sfx.stroke();
      });
      return game
        .waitUntil((dt) => {
          if (ui.modalOpen) return false;
          time += dt;
          if (time > 300) return true; // The game's own limit.
          if (stall > 0) {
            stall -= dt;
            v = 0;
          }
          air -= dt * (0.12 + v * 0.05);
          if (air <= 0) {
            chokes++;
            stall = 1.4;
            air = 0.7;
            sfx.cough();
            ui.toast('בלעת מים מהגל. נשימה כל 2–3 תנועות', 2200);
          }
          // Waves push you back a little.
          v = Math.min(1.5, Math.max(0, v - dt * (0.5 + v * 0.5)));
          z += dir * v * dt - dir * Math.max(0, Math.sin(time * 0.9)) * 0.08 * dt;
          if (dir < 0 && z <= turnZ) {
            dir = 1;
            v *= 0.4;
            ui.toast('המצוף. סיבוב, וחזרה לחוף', 1800);
          }
          player.x = x;
          player.z = z;
          player.yaw = dir < 0 ? 0 : Math.PI;
          player.pitch = -0.05;
          player.eyeOverride = EYE + Math.sin(time * 1.6) * 0.06;
          const meters = Math.round((dir < 0 ? startZ - z : 2 * (startZ - turnZ) - (startZ - z)) * scale);
          pad.meters([
            ['מהירות', v / 1.5],
            ['אוויר', air, air < 0.25 ? 'low' : ''],
          ]);
          pad.hint(`${Math.max(0, Math.min(400, meters))} מ׳ מתוך 400 · ימין־שמאל לסירוגין, נשימה לפני שנגמר האוויר`);
          return dir > 0 && z >= startZ - 0.6;
        })
        .finally(off);
    });
    const real = time * scale;
    const place = 1 + npcTimes.filter((t) => t < time).length;
    swimmers.forEach((p) => p.stop('stand'));
    leave({ x, z: -54 });
    return { time: real, place, technique: clamp(good / Math.max(1, good + bad) - chokes * 0.08), score: clamp(0.55 * (1 - (place - 1) / swimmers.length) + 0.45 * (good / Math.max(1, good + bad))) };
  }

  // ---------- Floating on the ropes, blacked-out mask and snorkel ----------

  async function blindFloat({ seconds = 45, title = 'ציפה על החבלים · מסכה מושחרת ושנורקל', crowded = false } = {}) {
    const c = crowded ? { x: POOL.cx, z: POOL.cz } : SPOTS.ropes;
    const mates = people.teammates.filter((p) => !p.info.out);
    mates.forEach((p, i) => {
      const a = (i / mates.length) * Math.PI * 2;
      const r = crowded ? 1.1 : 2.5;
      p.place(c.x + Math.cos(a) * r, c.z + Math.sin(a) * r * (crowded ? 1 : 0.4), a).setPose(crowded ? 'ring' : 'tread');
    });
    enterAt(c.x, c.z + (crowded ? 1.1 : 0.6), Math.PI);
    player.positionLocked = true;
    document.body.classList.add('blind');
    let pulse = 90;
    let cycle = 0;
    let water = 0; // water in the snorkel
    let good = 0;
    let presses = 0;
    let time = 0;
    let swallowed = 0;
    let maxPulse = 90;
    await task(title, { kick: 'נשימה דרך השנורקל', act: 'לנשוף (לנקות שנורקל)' }, () => {
      const off = pad.on((input) => {
        if (input === 'kick') {
          presses++;
          if (water > 0.5) {
            swallowed++;
            pulse = Math.min(190, pulse + 14);
            sfx.cough();
            ui.toast('שאפת מים. קודם לנשוף ולנקות את השנורקל', 1800);
          } else if (cycle > 0.78) {
            good++;
            pulse = Math.max(70, pulse - 9);
            sfx.breath();
          } else pulse = Math.min(190, pulse + 5);
          cycle = 0;
        }
        if (input === 'act' && water > 0) {
          water = 0;
          sfx.bubbles();
        }
      });
      return game
        .waitUntil((dt) => {
          if (ui.modalOpen) return false;
          time += dt;
          cycle = Math.min(1, cycle + dt / 4);
          pulse = Math.min(190, pulse + dt * (1.8 + time / 50) * (crowded ? 1.3 : 1));
          // Now and then a wave fills the snorkel.
          if (water === 0 && Math.random() < dt * 0.12) {
            water = 1;
            sfx.splash();
          }
          maxPulse = Math.max(maxPulse, pulse);
          player.eyeOverride = EYE - 0.1 + Math.sin(time * 1.3) * 0.05;
          pad.meters([
            ['דופק', (pulse - 60) / 130, pulse > 150 ? 'low' : ''],
            ['נשימה', cycle, cycle > 0.78 ? 'ready' : '', [0.78, 1]],
            ['מים בשנורקל', water, water ? 'low' : ''],
          ]);
          pad.hint(crowded ? `צפופים בתוך ריבוע חבלים, בלי לדבר · במציאות 10–15 דקות` : `במציאות 20–30 דקות · כאן ${Math.max(0, Math.ceil(seconds - time))} שנ׳ · אתה לא רואה כלום`);
          return time >= seconds;
        })
        .finally(off);
    });
    document.body.classList.remove('blind');
    mates.forEach((p) => p.setPose('stand'));
    return { score: clamp(1 - (maxPulse - 110) / 80) * 0.6 + clamp(good / Math.max(6, presses)) * 0.4 - swallowed * 0.05, maxPulse, swallowed };
  }

  // ---------- The pool: rings from 4 m (with and without a blacked-out mask) ----------

  async function rings({ blind = false, count = 2, limit = 60 } = {}) {
    const startX = POOL.cx - 2;
    const startZ = POOL.cz - 3;
    enterAt(startX, startZ, Math.PI);
    player.positionLocked = true;
    if (blind) document.body.classList.add('blind');
    const left = world.rings.filter((r) => r.visible).slice(0, count);
    let state = 'top';
    let depth = 0;
    let breath = 1;
    let got = 0;
    let feel = 0;
    let time = 0;
    let forced = 0;
    const bottomEye = POOL.bottom + 0.5 - (POOL.water - 1.42);
    await task(blind ? 'טבעות מ־4 מ׳ · מסכה מושחרת' : 'טבעות מ־4 מ׳', { kick: 'לצלול / לעלות', act: blind ? 'למשש את הקרקעית' : 'לתפוס טבעת' }, () => {
      const off = pad.on((input) => {
        if (input === 'kick') {
          if (state === 'top' && breath > 0.35) {
            state = 'down';
            sfx.splash();
          } else if (state !== 'top') state = 'up';
        }
        if (input === 'act' && state === 'bottom') {
          // Seeing: one grab per ring. Blind: feel around until you find it.
          feel += blind ? 0.34 : 1;
          if (feel >= 1 && left[got]) {
            feel = 0;
            left[got].visible = false;
            got++;
            ui.toast(`טבעת ${got} מתוך ${left.length}`, 1200);
            state = 'up';
          }
        }
      });
      return game
        .waitUntil((dt) => {
          if (ui.modalOpen) return false;
          time += dt;
          if (state === 'down') {
            depth = Math.min(1, depth + dt / 1.8);
            breath -= dt * 0.08;
            if (depth > 0.5 && Math.random() < dt * 0.6) ui.toast('לחץ באוזניים. השוואת לחץ: לסגור את האף ולנשוף בעדינות', 1600);
            if (depth >= 1) state = 'bottom';
          } else if (state === 'bottom') {
            breath -= dt * 0.1;
            if (Math.random() < dt) sfx.bubbles();
          } else if (state === 'up') {
            depth = Math.max(0, depth - dt / 1.3);
            breath -= dt * 0.05;
            if (depth <= 0) {
              state = 'top';
              sfx.breath();
            }
          } else breath = Math.min(1, breath + dt * 0.3);
          if (breath <= 0 && state !== 'top') {
            forced++;
            breath = 0.05;
            state = 'up';
            sfx.cough();
          }
          player.eyeOverride = EYE + (bottomEye - EYE) * depth;
          player.pitch = -0.4 - depth * 0.6;
          pad.meters([
            ['אוויר', breath, breath < 0.25 ? 'low' : ''],
            ['טבעות', got / left.length],
          ]);
          pad.hint(`${{ top: 'למעלה', down: 'צולל', bottom: 'בקרקעית', up: 'עולה' }[state]} · ${got} מתוך ${left.length} · נשאר ${Math.max(0, Math.ceil(limit - time))} שנ׳`);
          return got >= left.length || time >= limit;
        })
        .finally(off);
    });
    document.body.classList.remove('blind');
    player.pitch = 0;
    return clamp(got / left.length - forced * 0.2);
  }

  // ---------- Breath-hold swim: as far as you can on one breath ----------

  async function breathHold() {
    const z0 = POOL.cz + POOL.halfZ - 1;
    enterAt(POOL.cx + 3, z0, 0);
    player.positionLocked = true;
    let dist = 0;
    let air = 1;
    let v = 0;
    let last = null;
    let under = false;
    let time = 0;
    await task('שחייה בעצירת נשימה', { left: 'יד שמאל', right: 'יד ימין', kick: 'לצלול / לעלות' }, () => {
      const off = pad.on((input) => {
        if (input === 'kick') {
          if (!under) {
            under = true;
            sfx.splash();
          } else under = false;
          return;
        }
        if (!under || input === last) return;
        last = input;
        v += 0.35;
        sfx.stroke();
      });
      return game
        .waitUntil((dt) => {
          if (ui.modalOpen) return false;
          time += dt;
          if (under) {
            air -= dt * (0.06 + v * 0.03);
            v = Math.max(0, v - dt * 0.6);
            dist += v * dt;
          }
          player.z = z0 - dist;
          player.eyeOverride = under ? EYE - 1.1 : EYE;
          pad.meters([
            ['אוויר', air, air < 0.25 ? 'low' : ''],
            ['מרחק', dist / 22],
          ]);
          pad.hint(under ? `${Math.round(dist)} מ׳ · יד ימין, יד שמאל. לעלות לפני שהאוויר נגמר` : 'לחץ "לצלול" כשאתה מוכן. נשימה אחת בלבד');
          if (under && air <= 0) {
            sfx.cough();
            ui.toast('האוויר נגמר. המגבש רושם את המרחק עד המקום שעלית', 2400);
            return true;
          }
          return (!under && dist > 0.5) || dist >= 22 || time > 60;
        })
        .finally(off);
    });
    return clamp(dist / 20);
  }

  // ---------- A weight above the water, legs only ----------

  async function weightHold(seconds = 30) {
    enterAt(POOL.cx, POOL.cz + 4, Math.PI);
    player.positionLocked = true;
    let h = 0.7;
    let time = 0;
    let inZone = 0;
    let kicks = [];
    let strength = 1;
    let dropped = 0;
    await task('משקולת מעל המים · רק רגליים', { kick: 'בעיטה' }, () => {
      const off = pad.on((input) => {
        if (input !== 'kick') return;
        kicks = kicks.filter((k) => time - k < 1);
        kicks.push(time);
        if (kicks.length > 4) strength = Math.max(0.35, strength - 0.06);
        h = Math.min(1, h + 0.085 * strength);
      });
      return game
        .waitUntil((dt) => {
          if (ui.modalOpen) return false;
          time += dt;
          strength = Math.min(1, strength + dt * 0.04);
          h = Math.max(0, h - 0.26 * dt);
          if (h > 0.35 && h < 0.85) inZone += dt;
          if (h < 0.12) {
            dropped++;
            h = 0.45;
            sfx.cough();
            ui.toast('המשקולת נגעה במים. המגבש: "עוד פעם וזה נרשם."', 2000);
          }
          player.eyeOverride = EYE - 0.5 + h * 0.62;
          pad.meters([
            ['גובה', h, h < 0.25 ? 'low' : '', [0.35, 0.85]],
            ['כוח ברגליים', strength, strength < 0.5 ? 'low' : ''],
          ]);
          pad.hint(`עוד ${Math.max(0, Math.ceil(seconds - time))} שנ׳ · בעיטות רגועות. הידיים מחזיקות את המשקולת`);
          return time >= seconds;
        })
        .finally(off);
    });
    return clamp(inZone / seconds - dropped * 0.1 + 0.1);
  }

  // ---------- Climbing into the boat from the water ("צוקון סירות") ----------

  async function boatClimb(seconds = 40) {
    const [a, b] = world.boats;
    a.userData.afloat = true;
    b.userData.afloat = true;
    a.position.set(-14, SEA.level + 0.18, -64);
    b.position.set(-6, SEA.level + 0.18, -64);
    a.rotation.y = Math.PI / 2;
    b.rotation.y = Math.PI / 2;
    enterAt(-10, -64, -Math.PI / 2);
    player.positionLocked = true;
    let rounds = 0;
    let phase = 'swim'; // swim to the next boat, then climb
    let target = b;
    let progress = 0;
    let climb = 0;
    let last = null;
    let time = 0;
    await task('צוקון סירות · שוחים לסירה, עולים, קופצים, לסירה השנייה', { left: 'יד שמאל', right: 'יד ימין', act: 'לעלות' }, () => {
      const off = pad.on((input) => {
        if (phase === 'swim' && (input === 'left' || input === 'right') && input !== last) {
          last = input;
          progress += 0.12;
          sfx.stroke();
        }
        if (phase === 'climb' && input === 'act') {
          climb += 0.2;
          if (climb >= 1) {
            rounds++;
            climb = 0;
            progress = 0;
            phase = 'swim';
            sfx.splash();
            target = target === a ? b : a;
            ui.toast(`סבב ${rounds}`, 900);
          }
        }
      });
      return game
        .waitUntil((dt) => {
          if (ui.modalOpen) return false;
          time += dt;
          climb = Math.max(0, climb - dt * 0.35); // You slide back if you stop.
          if (phase === 'swim' && progress >= 1) phase = 'climb';
          const from = target === b ? -13 : -7;
          const to = target === b ? -7 : -13;
          player.x = from + (to - from) * Math.min(1, progress);
          player.z = -64;
          player.yaw = to > from ? -Math.PI / 2 : Math.PI / 2;
          player.eyeOverride = phase === 'climb' ? EYE + climb * 0.9 : EYE;
          pad.meters([[phase === 'swim' ? 'שחייה לסירה' : 'עלייה לסירה', phase === 'swim' ? progress : climb]]);
          pad.hint(`${rounds} סבבים · ${phase === 'swim' ? 'ימין־שמאל עד הסירה' : 'לחיצות מהירות: ידיים על הצינור, רגל למעלה'} · נשאר ${Math.max(0, Math.ceil(seconds - time))} שנ׳`);
          return time >= seconds;
        })
        .finally(off);
    });
    a.userData.afloat = false;
    b.userData.afloat = false;
    leave({ x: -10, z: -54 });
    return { rounds, score: clamp(rounds / 5) };
  }

  return { seaSwim, blindFloat, rings, breathHold, weightHold, boatClimb, leave, enterAt };
}

/** Ground for people and the player in this stage: the water level in the pool and the sea. */
export const shayetetGround = waterGround;
