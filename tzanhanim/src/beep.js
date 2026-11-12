import { createPad } from '../../draft/src/water.js';
import { tone } from '../../pilot-path/shared/fx.js';
import { schedule, createRunner, GAME_DISTANCE, TIME_SCALE, fmt } from './beep-model.js';

// The beep test on the parade ground: two lines of cones, everyone runs between them to the beeps. Press Space (or
// the button) for every stride; the top speed falls as you tire. Two missed lines in a row and you are out; you can
// also stop by yourself. The accounts: 20 m, minimum 6:30, the test stops at 8:00.

const LINE_A = -GAME_DISTANCE / 2;
const LINE_B = GAME_DISTANCE / 2;
const Z = 26;
const MIN_REAL = 6.5 * 60;
const MAX_REAL = 8 * 60;

export async function beepTest(game) {
  const { player, ui, people } = game;
  const pad = createPad(game);
  const sched = schedule(MAX_REAL);
  const runner = createRunner();

  // The others: every one has their own limit (the game's own spread: most stop between 6:00 and 8:00).
  const field = [...people.teammates, ...people.others.slice(0, 10)];
  const limits = field.map((p) => (p.info?.trait === 'quitter' ? 300 : Math.max(300, Math.min(MAX_REAL, 300 + (p.fitness - 0.86) * 900 + Math.random() * 60))));
  field.forEach((p, i) => {
    p.group.visible = true;
    p.carry(null);
    p.stop('stand');
    p.speed = 4;
    p.place(LINE_A, Z - 1.4 - i * 0.9, -Math.PI / 2);
  });
  const out = new Set();

  player.teleport(LINE_A, Z, -Math.PI / 2);
  player.positionLocked = true;
  player.pitch = -0.05;
  game.hud.setDrill('מבחן ביפ · 20 מ׳', 'רווח (או הכפתור) לכל צעד. להגיע לקו לפני הצפצוף');
  await game.drills.countdown('הצפצוף הראשון…');
  game.hud.setDrill(null);

  let gameT = 0;
  let i = 0;
  let dir = 1; // 1: A→B, -1: B→A
  let misses = 0;
  let stopped = false;
  let last = { real: 0, level: 1, shuttle: 0 };
  const busy = () => {};
  busy.silent = true;
  game.onAction = busy;
  pad.show('מבחן ביפ', { kick: 'צעד', act: 'לעצור' }, { mouse: 'act' });
  const off = pad.on((input) => {
    if (input === 'kick') runner.tap();
    if (input === 'act') stopped = true;
  });
  tone(880, 0.25, { volume: 0.18 });
  try {
    await game.waitUntil((dt) => {
      if (ui.modalOpen) return false;
      gameT += dt;
      const beat = sched[i];
      const startGame = i ? sched[i - 1].end / TIME_SCALE : 0;
      const endGame = beat.end / TIME_SCALE;
      const reached = runner.pos >= GAME_DISTANCE;
      runner.step(dt, reached);
      // The beep.
      if (gameT >= endGame) {
        if (runner.pos < GAME_DISTANCE) {
          misses++;
          ui.toast(misses >= 2 ? 'שוב לא הגעת לקו. יוצא מהמבחן.' : 'לא הגעת לקו בזמן. אזהרה אחת.', 1600);
          if (misses >= 2) return true;
        } else {
          misses = 0;
          last = { real: beat.end, level: beat.level, shuttle: beat.shuttle };
        }
        i++;
        if (i >= sched.length) return true;
        const levelUp = sched[i].level !== beat.level;
        tone(levelUp ? 1180 : 880, 0.18, { volume: 0.16 });
        if (levelUp) {
          tone(1180, 0.18, { volume: 0.16, at: 0.22 });
          ui.announce(`שלב ${sched[i].level}`, fmt(beat.end));
        }
        runner.pos = 0;
        dir = -dir;
      }
      if (stopped) return true;
      // Where you are, facing where you run.
      player.x = dir > 0 ? LINE_A + runner.pos : LINE_B - runner.pos;
      player.z = Z;
      player.yaw = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      player.bob += dt * runner.v * 3.2;
      // The others run with the beeps until their limit.
      const real = gameT * TIME_SCALE;
      const k = Math.min(1, ((gameT - startGame) / Math.max(0.01, endGame - startGame)) * 1.12);
      field.forEach((p, n) => {
        if (out.has(p)) return;
        if (real >= limits[n]) {
          out.add(p);
          p.walkTo([{ x: p.position.x, z: Z + 4 + (n % 4) }], { pose: 'hands-on-knees', speed: 1.4 });
          return;
        }
        const x = dir > 0 ? LINE_A + k * GAME_DISTANCE : LINE_B - k * GAME_DISTANCE;
        p.group.position.x = x;
        p.group.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (p.pose !== 'walk') p.setPose(k < 1 ? 'walk' : 'stand');
        if (k >= 1 && p.pose === 'walk') p.setPose('stand');
      });
      const left = Math.max(0, endGame - gameT) / Math.max(0.01, endGame - startGame);
      pad.meters([
        ['מהירות', runner.v / 7.3],
        ['כוח', runner.stamina, runner.stamina < 0.3 ? 'low' : ''],
        ['עד הצפצוף', left, left < 0.25 && !reached ? 'low' : reached ? 'ready' : ''],
      ]);
      pad.hint(`שלב ${beat.level}:${beat.shuttle} · ${fmt(real)} · מינימום 6:30 · נשארו ${field.length - out.size} רצים${misses ? ' · אזהרה אחת' : ''}`);
      return false;
    });
  } finally {
    off();
    pad.hide();
    game.onAction = null;
    player.positionLocked = false;
    field.forEach((p) => {
      if (!out.has(p)) p.walkTo([{ x: p.position.x, z: Z + 5 }], { pose: 'hands-on-knees', speed: 1.4 });
    });
  }
  const passed = last.real >= MIN_REAL;
  const result = { real: last.real, level: last.level, shuttle: last.shuttle, passed, stopped, bonus: Math.max(0, Math.floor((last.real - MIN_REAL) / 30)) };
  game.drills.stats.beep = result;
  return result;
}

export { fmt };
