import { SPOTS } from '../../shared/yarpa-world.js';
import { seatMates, hideMates } from '../../shared/yarpa-people.js';
import { FACTS, INSTRUCTOR_LINES, WAIT_LINES, RESULT } from './content.js';
import { GUARD_LINES, CLERK_LINES } from '../../yarpa-a/src/content.js';
import { runForms } from './forms.js';
import { runEyeTest } from './eyes.js';
import { runSimulator } from '../../shared/flight/sim.js';
import { answerPhone } from '../../shared/panels.js';
import { fx } from '../../shared/fx.js';
import { chime } from '../../../shared/engine/audio.js';
import { saveResult, saveAnswers } from '../../shared/progress.js';
import { unlock } from '../../../shared/achievements.js';

export const STEPS = ['arrive', 'sim', 'forms', 'eyes', 'wait', 'verdict'];

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

function wait(game, seconds, minutesPerSecond = 0) {
  let left = seconds;
  return game.waitUntil((dt) => {
    left -= dt;
    if (minutesPerSecond) game.addMinutes(dt * minutesPerSecond);
    return left <= 0;
  });
}

// ---------- Arriving ----------

async function arrive(game) {
  const { ui, player, people, sky, state, world } = game;
  sky.setTime('day');
  game.setClock('יום ירפ״א ב׳', 7 * 60 + 5);
  state.number = state.number ?? 200 + Math.floor(Math.random() * 90);
  player.teleport(SPOTS.busStop.x + 2, SPOTS.busStop.z - 2, -0.25);
  await ui.fadeIn();
  await ui.fact(FACTS.what.title, FACTS.what.points);

  const guard = people.staff.guard1;
  await goTalk(game, guard, 'guard1', 'גש לשער הבסיס', 'בפעם השנייה בתל השומר');
  await talkScene(game, guard, async () => {
    await ui.talk(guard.name, GUARD_LINES.first);
    await ui.talk('אני', 'הנה.', ['[מגיש תעודה וזימון]']);
    await ui.talk(guard.name, 'רשמתי. ירפ״א ב׳, אותו בניין. תכנס.');
  });
  await walkTo(game, SPOTS.door, 'היכנס לבניין', 'אותו אולם, אותו שלט', 3);
  const clerk = people.staff.clerk1;
  await goTalk(game, clerk, 'clerk1', 'גש לעמדת הרישום', 'תעודה וזימון');
  await talkScene(game, clerk, async () => {
    await ui.talk(clerk.name, CLERK_LINES[0].replace('ירפ״א א׳', 'ירפ״א ב׳'));
    await ui.talk(clerk.name, `זה המספר שלך: ${state.number}. היום סימולטור, שאלונים ובדיקת עיניים. שב באולם ותחכה לקריאה.`);
  });
  ui.setObjective('שב באולם וחכה לקריאה', 'שוב ממתינים');
  await game.waitUntil(() => Boolean(player.seat));
  world.setBoard('ממתינים לקריאה', `מספר ${state.number}`);
  await wait(game, 12, 1.6);
  chime();
  world.setBoard('נקראים לסימולטור', `מועמד ${state.number}`);
  ui.announce('קוראים לסימולטור', 'חדר סימולטור ב׳, הדלת השנייה מימין');
  player.standUp(false);
  game.save('arrive');
}

// ---------- The second simulator ----------

async function sim(game) {
  const { ui, player, people, world, state } = game;
  game.setClock('יום ירפ״א ב׳', 8 * 60 + 20);
  await walkTo(game, SPOTS.simB.door, 'לך לסימולטור ב׳', 'במסדרון, הדלת השנייה מימין', 2.6);
  const instructor = people.staff.instructorB;
  await walkTo(game, { x: 8.5, z: -26 }, 'היכנס לחדר', 'חשוך, מסך גדול', 2.6);
  await talkScene(game, instructor, async () => {
    for (const line of INSTRUCTOR_LINES.intro) await ui.talk(instructor.name, line);
  });
  await ui.fact(FACTS.sim.title, FACTS.sim.points);

  ui.setObjective('שב בכיסא הטייס', 'סטיק ביד ימין, מצערת ביד שמאל');
  game.setTarget({ x: SPOTS.simB.chair.x, y: 1.9, z: SPOTS.simB.chair.z });
  await game.waitInteract('simchairB');
  game.setTarget(null);
  const seat = world.simSeats.B;
  player.sit({ x: seat.x, z: seat.z, exit: { x: seat.x - 1.2, z: seat.z } }, seat.yaw);
  seat.setScreen('ready');
  await game.wait(900);
  const result = await runSimulator(game, { kind: 'sim2', fx });
  state.sim = { passed: result.passed, score: result.score, levels: result.levels.map((l) => [l.title, l.score]) };
  player.standUp(false);
  player.teleport(SPOTS.simB.chair.x - 2.5, SPOTS.simB.chair.z, Math.PI / 2 + Math.PI);
  await talkScene(game, instructor, async () => {
    await ui.talk(instructor.name, result.passed ? INSTRUCTOR_LINES.pass : INSTRUCTOR_LINES.fail);
  });
  if (!result.passed) state.failedAt = 'sim';
  game.save('sim');
}

// ---------- The questionnaires ----------

async function forms(game) {
  const { ui, player, people, world, state } = game;
  if (state.failedAt) return;
  game.setClock('יום ירפ״א ב׳', 10 * 60 + 15);
  await walkTo(game, SPOTS.forms.door, 'לך לחדר השאלונים', 'הדלת השנייה משמאל', 2.6);
  const seats = world.formSeats;
  const mine = seats[6];
  seatMates(people.labMates, seats, mine);
  const proctor = people.staff.formsProctor;
  await walkTo(game, SPOTS.forms.center, 'היכנס לחדר', 'שקט, שאלונים', 3);
  await talkScene(game, proctor, async () => {
    await ui.talk(proctor.name, 'שלושה שאלונים. ענו בכנות ובקצב. אין תשובה נכונה, ואף אחד לא רואה אתכם עכשיו.');
    await ui.talk(proctor.name, 'אל תשאירו ריקים. מי שלא עונה בזמן עובר הלאה.');
  });
  await ui.fact(FACTS.forms.title, FACTS.forms.points);
  ui.setObjective('שב בעמדה שלך', 'העמדה המסומנת');
  game.setTarget(() => ({ x: mine.x, y: 1.6, z: mine.z }));
  await game.waitInteract('formseat');
  game.setTarget(null);
  player.sit({ x: mine.x, z: mine.z, exit: { x: mine.x, z: mine.z + 0.9 } }, 0);
  const result = await runForms(game, { number: state.number });
  state.forms = result;
  saveAnswers({ form: result.form, sentences: result.sentences, personality: result.scores, formsAt: Date.now() });
  player.standUp(false);
  hideMates(people.labMates);
  game.save('forms');
}

// ---------- Eyes ----------

async function eyes(game) {
  const { ui, people, state } = game;
  if (state.failedAt) return;
  game.setClock('יום ירפ״א ב׳', 12 * 60 + 5);
  const nurse = people.staff.nurse;
  await goTalk(game, nurse, 'nurse', 'גש לבדיקת העיניים', 'בקצה המסדרון');
  await talkScene(game, nurse, async () => {
    await ui.talk(nurse.name, 'שלום. תשב כאן ותסתיר עין אחת. אחרי זה אטפטף טיפות. זה לא כואב, רק יטשטש לכמה שעות.');
  });
  await ui.fact(FACTS.eyes.title, FACTS.eyes.points);
  const result = await runEyeTest(game);
  state.eyes = result.score;
  document.body.classList.add('dilated');
  game.save('eyes');
}

// ---------- The wait ----------

async function waitStep(game) {
  const { ui, player, people, world, state } = game;
  if (state.failedAt) {
    document.body.classList.remove('dilated');
    return;
  }
  game.setClock('יום ירפ״א ב׳', 12 * 60 + 40);
  world.setBoard('המתנה לתוצאות', 'אפשר לשבת או להסתובב');
  ui.setObjective('המתן בקצה המסדרון', 'העיניים מטושטשות, הסימולטור כבר מאחוריך');
  game.setTarget(groundTarget(SPOTS.endWait));
  await game.waitZone(near(SPOTS.endWait, 2.4));
  game.setTarget(null);
  const buddy = people.hall.find((p) => !p.seat && p.pose === 'stand') ?? people.hall[0];
  buddy.group.visible = true;
  buddy.place(SPOTS.endWait.x + 1.3, SPOTS.endWait.z + 1.5, Math.PI * 0.8).setPose('lean');
  await talkScene(game, buddy, async () => {
    for (const line of WAIT_LINES.slice(0, 2)) await ui.talk(buddy.name, line);
    await ui.talk('אני', 'מה אתה אומר?', ['"נחכה ביחד. ככה זה נראה פחות ארוך."', '"אני לא רוצה לדבר על זה עכשיו."', '"הסימולטור היה קשה, אבל המשכתי עד הסוף."']);
  });
  await wait(game, 8, 2.5);
  document.body.classList.remove('dilated');
  chime();
  ui.announce('התוצאות מוכנות', 'מגיעות בטלפון');
  game.save('wait');
}

// ---------- The answer ----------

async function verdict(game) {
  const { ui, state } = game;
  const failedSim = state.failedAt === 'sim';
  const passed = !failedSim && state.sim?.passed;
  const text = passed ? RESULT.pass : failedSim ? RESULT.failSim : RESULT.failForms;
  const pct = (v) => (v === undefined || v === null ? '-' : `${Math.round(v * 100)}%`);
  const scores = state.forms?.scores;
  const lines = [
    ...(state.sim ? state.sim.levels.map(([t, s]) => [t, pct(s)]) : []),
    ...(scores ? [['עקביות בין ההיגדים', pct(scores.consistency)], ['שקט בלחץ (לפי ההיגדים)', pct(scores.calm)]] : []),
  ];
  const choice = await answerPhone(ui, {
    from: text.from,
    time: passed ? 'בערב, אחרי היום' : 'אחר הצהריים',
    headline: text.headline,
    detail: text.detail,
    lines,
    note: 'במציאות הציון הסופי ידוע רק אחרי כל השלבים, ואין פרסום של רף. המשחק מציג פירוט רק כדי שיהיה אפשר להשתפר.',
    buttons: [
      { id: 'next', label: passed ? 'לפסיכולוג' : 'לפסיכולוג (המשך בכל זאת)' },
      { id: 'again', label: 'לנסות שוב', secondary: true },
      { id: 'hub', label: 'חזרה למסלול', secondary: true },
    ],
  });
  saveResult('yarpa-b', { passed, sim: state.sim?.score ?? null, consistency: scores?.consistency ?? null, score: Math.round(((state.sim?.score ?? 0) * 0.7 + (scores?.consistency ?? 0) * 0.3) * 100) / 100 });
  if (!failedSim) unlock('pilot-yarpa-b-done');
  if (state.sim?.passed) unlock('pilot-sim-2');
  game.clearSave();
  await ui.fact(FACTS.end.title, FACTS.end.points);
  if (choice === 'next') window.location.href = '../psychologist/?new=1';
  else if (choice === 'again') window.location.href = './?new=1';
  else window.location.href = '../';
}

export const HANDLERS = { arrive, sim, forms, eyes, wait: waitStep, verdict };
