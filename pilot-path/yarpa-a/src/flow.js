import { SPOTS } from '../../shared/yarpa-world.js';
import { seatMates, hideMates } from '../../shared/yarpa-people.js';
import { FACTS, GUARD_LINES, CLERK_LINES, HALL_CHATTER, PROCTOR_LINES, INSTRUCTOR_LINES, RESULT } from './content.js';
import { runLab } from './lab.js';
import { runSimulator } from '../../shared/flight/sim.js';
import { answerPhone } from '../../shared/panels.js';
import { fx } from '../../shared/fx.js';
import { chime } from '../../../shared/engine/audio.js';
import { saveResult } from '../../shared/progress.js';
import { unlock } from '../../../shared/achievements.js';

export const STEPS = ['arrive', 'checkin', 'tests', 'break', 'simulator', 'verdict'];

const TEST_LINE = 0.22; // Only in the game: the real cut-off was never published.

const above = (person, extra = 2.3) => () => ({ x: person.position.x, y: person.position.y + extra, z: person.position.z });
const groundTarget = (spot, y = 2.2) => ({ x: spot.x, y, z: spot.z });
const near = (spot, r) => (p) => Math.hypot(p.x - spot.x, p.z - spot.z) < r;

async function talkScene(game, person, fn) {
  const release = game.ui.holdModal();
  game.player.faceTowards(person.position.x, person.position.z, person.position.y + (person.pose.startsWith('sit') ? 1.0 : 1.55));
  game.setTarget(null);
  try {
    return await fn();
  } finally {
    release();
  }
}

async function goTalk(game, person, id, objective, sub = '') {
  game.ui.setObjective(objective, sub);
  game.setTarget(above(person));
  await game.waitInteract(id);
}

async function walkTo(game, spot, objective, sub = '', radius = 2.2) {
  game.ui.setObjective(objective, sub);
  game.setTarget(groundTarget(spot));
  await game.waitZone(near(spot, radius));
  game.setTarget(null);
}

/** Wait `seconds` of game time (the clock on the HUD moves along). */
function wait(game, seconds, minutesPerSecond = 0) {
  let left = seconds;
  return game.waitUntil((dt) => {
    left -= dt;
    if (minutesPerSecond) game.addMinutes?.(dt * minutesPerSecond);
    return left <= 0;
  });
}

// ---------- Arriving ----------

async function arrive(game) {
  const { ui, player, people, sky, state } = game;
  sky.setTime('dawn');
  game.setClock('יום ירפ״א', 6 * 60 + 50);
  state.number = state.number ?? 200 + Math.floor(Math.random() * 90);
  player.teleport(SPOTS.busStop.x + 2, SPOTS.busStop.z - 2, -0.25);
  await ui.fadeIn();
  await ui.fact(FACTS.what.title, FACTS.what.points);

  const guard = people.staff.guard1;
  await goTalk(game, guard, 'guard1', 'גש לשער הבסיס', 'תל השומר, מחנה דורי');
  await talkScene(game, guard, async () => {
    await ui.talk(guard.name, GUARD_LINES.first);
    await ui.talk('אני', 'הנה.', ['[מגיש תעודה וזימון]']);
    await ui.talk(guard.name, GUARD_LINES.show);
  });
  await walkTo(game, SPOTS.door, 'היכנס לבניין היחידה', 'השלט הכחול', 3);
  game.save('arrive');
}

async function checkin(game) {
  const { ui, player, people, state, world } = game;
  game.setClock('יום ירפ״א', 7 * 60 + 15);
  const clerk = people.staff.clerk1;
  await goTalk(game, clerk, 'clerk1', 'גש לעמדת הרישום', 'תעודה וזימון');
  await talkScene(game, clerk, async () => {
    await ui.talk(clerk.name, CLERK_LINES[0]);
    await ui.talk('אני', 'הנה, בבקשה.', ['[מגיש תעודה וזימון]']);
    await ui.talk(clerk.name, CLERK_LINES[1]);
    ui.toast(`מספר המועמד שלך: ${state.number}`, 3500);
    await ui.talk(clerk.name, CLERK_LINES[2]);
  });
  // Wait in the hall: take a seat, listen, talk to others if you want.
  ui.setObjective('שב באולם וחכה לקריאה', 'אפשר לדבר עם המועמדים');
  game.setTarget(null);
  await game.waitUntil(() => Boolean(player.seat));
  world.setBoard('ממתינים לקריאה', `מספר ${state.number}`);
  await wait(game, 14, 1.5);
  chime();
  world.setBoard('נקראים למעבדה', `מועמדים ${state.number - 6} עד ${state.number + 3}`);
  ui.announce('קוראים למספר שלך', 'מעבדת המבחנים, הדלת הראשונה בצד שמאל');
  player.standUp(false);
  game.save('checkin');
}

// ---------- Tests ----------

async function tests(game) {
  const { ui, player, people, world, state } = game;
  game.setClock('יום ירפ״א', 8 * 60);
  await walkTo(game, SPOTS.lab.door, 'לך למעבדת המבחנים', 'במסדרון, הדלת הראשונה משמאל', 2.6);

  // Your station is the one the proctor points at; the others are taken by candidates.
  const seats = world.labSeats;
  const mine = seats[5];
  seatMates(people.labMates, seats, mine);
  const proctor = people.staff.proctor;
  await walkTo(game, SPOTS.lab.center, 'היכנס למעבדה', 'שקט, יושבים לפי מספר', 3);
  await talkScene(game, proctor, async () => {
    await ui.talk(proctor.name, PROCTOR_LINES.welcome);
    await ui.talk(proctor.name, PROCTOR_LINES.rules);
  });
  await ui.fact(FACTS.tests.title, FACTS.tests.points);

  ui.setObjective('שב בעמדה שלך', 'העמדה המסומנת');
  game.setTarget(() => ({ x: mine.x, y: 1.6, z: mine.z }));
  await game.waitInteract('labseat');
  game.setTarget(null);
  player.sit({ x: mine.x, z: mine.z, exit: { x: mine.x, z: mine.z + 0.9 } }, 0);

  const result = await runLab(game, { number: state.number });
  state.tests = Object.fromEntries(Object.entries(result.tests).map(([k, v]) => [k, v.score]));
  state.testScore = result.score;
  player.standUp(false);
  hideMates(people.labMates);
  await talkScene(game, proctor, async () => {
    await ui.talk(proctor.name, PROCTOR_LINES.done);
  });
  game.save('tests');
}

// ---------- The break ----------

async function breakStep(game) {
  const { ui, people, world, state, player } = game;
  game.setClock('יום ירפ״א', 11 * 60 + 40);
  player.teleport(SPOTS.corridor.x, SPOTS.corridor.z + 1.5, 0);
  if (state.testScore < TEST_LINE) {
    state.failedAt = 'tests';
    await ui.talk('אני', 'אני יוצא מהחדר. לא בטוח איך היה לי.');
    return;
  }
  world.setBoard('שעת הפסקה', 'קחו מים ואכלו משהו');
  ui.setObjective('הפסקה בחוץ, אל האולם', 'קחו מים. הסימולטור אחרי זה');
  game.setTarget(groundTarget(SPOTS.vending));
  await game.waitInteract('vending');
  game.setTarget(null);
  ui.toast('בקבוק מים קר, ועוד כמה דקות של שקט.');
  fx.coin?.();
  const chatty = people.hall.find((p) => !p.seat && p.pose === 'stand');
  await wait(game, 8, 1.4);
  chime();
  world.setBoard('נקראים לסימולטור', `מועמד ${state.number}`);
  ui.announce('קוראים לסימולטור', 'הדלת הראשונה בצד ימין');
  void chatty;
  game.save('break');
}

// ---------- The simulator ----------

async function simulator(game) {
  const { ui, player, people, world, state } = game;
  if (state.failedAt) return;
  game.setClock('יום ירפ״א', 13 * 60 + 10);
  await walkTo(game, SPOTS.simA.door, 'לך לחדר הסימולטור', 'במסדרון, הדלת הראשונה מימין', 2.6);
  const instructor = people.staff.instructorA;
  await walkTo(game, { x: 8.5, z: -14 }, 'היכנס לחדר', 'חשוך וקריר', 2.6);
  await talkScene(game, instructor, async () => {
    for (const line of INSTRUCTOR_LINES.intro) await ui.talk(instructor.name, line);
  });
  await ui.fact(FACTS.sim.title, FACTS.sim.points);

  ui.setObjective('שב בכיסא הטייס', 'סטיק ביד ימין, מצערת ביד שמאל');
  game.setTarget({ x: SPOTS.simA.chair.x, y: 1.9, z: SPOTS.simA.chair.z });
  await game.waitInteract('simchair');
  game.setTarget(null);
  const seat = world.simSeats.A;
  player.sit({ x: seat.x, z: seat.z, exit: { x: seat.x - 1.2, z: seat.z } }, seat.yaw);
  seat.setScreen('ready');
  await game.wait(900);
  const sim = await runSimulator(game, { kind: 'sim1', fx });
  state.sim = { passed: sim.passed, score: sim.score, levels: sim.levels.map((l) => [l.title, l.score]) };
  player.standUp(false);
  player.teleport(SPOTS.simA.chair.x - 2.5, SPOTS.simA.chair.z, Math.PI / 2 + Math.PI);
  await talkScene(game, instructor, async () => {
    await ui.talk(instructor.name, sim.passed ? INSTRUCTOR_LINES.pass : INSTRUCTOR_LINES.fail);
  });
  game.save('simulator');
}

// ---------- The verdict ----------

async function verdict(game) {
  const { ui, state } = game;
  const failedTests = state.failedAt === 'tests';
  const passed = !failedTests && state.sim?.passed;
  const text = passed ? RESULT.pass : failedTests ? RESULT.failTests : RESULT.failSim;
  const t = state.tests ?? {};
  const pct = (v) => (v === undefined ? '-' : `${Math.round(v * 100)}%`);
  const lines = [
    ['חשיבה כמותית', pct(t.quant)],
    ['קובייה', pct(t.cube)],
    ['מטוס במרחב', pct(t.plane)],
    ...(state.sim ? state.sim.levels.map(([title, score]) => [title, pct(score)]) : []),
  ];
  const choice = await answerPhone(ui, {
    from: text.from,
    time: passed ? 'אחר הצהריים, בדרך הביתה' : 'אחר הצהריים',
    headline: text.headline,
    detail: text.detail,
    lines,
    note: 'במציאות לא מקבלים פירוט של ציונים או אחוזים, והרף לא פורסם. המשחק מציג אותם כדי שיהיה אפשר להשתפר.',
    buttons: [
      { id: 'next', label: passed ? 'לירפ״א ב׳' : 'לירפ״א ב׳ (המשך בכל זאת)' },
      { id: 'again', label: 'לנסות שוב', secondary: true },
      { id: 'hub', label: 'חזרה למסלול', secondary: true },
    ],
  });
  saveResult('yarpa-a', { passed, tests: state.tests ?? {}, sim: state.sim?.score ?? null, score: Math.round(((state.testScore ?? 0) * 0.4 + (state.sim?.score ?? 0) * 0.6) * 100) / 100 });
  if (!failedTests) unlock('pilot-yarpa-a-done');
  if (state.testScore >= 0.7) unlock('pilot-psychotech');
  if (state.sim?.passed) unlock('pilot-sim-1');
  game.clearSave();
  await ui.fact(FACTS.end.title, FACTS.end.points);
  if (choice === 'next') window.location.href = '../yarpa-b/?new=1';
  else if (choice === 'again') window.location.href = './?new=1';
  else window.location.href = '../';
}

export const HANDLERS = { arrive, checkin, tests, break: breakStep, simulator, verdict };
export { HALL_CHATTER };
