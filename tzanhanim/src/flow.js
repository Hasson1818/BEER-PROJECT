import { FACTS, FORM, INTERVIEW, MAP12, DILEMMA, OUTCOMES } from './content.js';
import { SPOTS } from '../../yom-sayarot/src/world.js';
import { INTERVIEW_SPOT } from './team.js';
import { beepTest, fmt } from './beep.js';
import { personalForm, mapStudy, baseTargets, minefield } from './minigames.js';
import { quiz } from '../../naval/src/minigames.js';
import { resultsCard } from '../../gibbush-matkal/src/minigames.js';
import { loadResults, saveResults } from '../../shared/save.js';
import { unlock } from '../../shared/achievements.js';

// One day, as in the accounts 2021–2026 (the fullest: 29.01.2025):
//   morning (train, bus, forms, medic) → beep test → the long wait (a map to memorize) → the interview with two
//   reservists → the sand pit (sprints, map task, stretcher, minefield, dilemma, crawls with sandbags, a final
//   combined task) → the answer about two weeks later.

export const STEPS = ['arrive', 'beep', 'wait', 'interview', 'field', 'results'];

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const avg = (list) => {
  const v = (list ?? []).filter((x) => typeof x === 'number');
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0.5;
};
const push = (state, key, value) => (state[key] ??= []).push(value);
const stretcherScore = (rounds) => avg((rounds ?? []).map((r) => (r.role === 'stretcher' ? 0.6 + 0.4 * r.held : r.role === 'jerrycan' ? 0.5 : 0.3)));

function goTo(game, spot, label, sub = '', radius = 2.2) {
  game.ui.setObjective(label, sub);
  game.setTarget({ x: spot.x, z: spot.z, y: 2.3 });
  return game.waitZone((p) => Math.hypot(p.x - spot.x, p.z - spot.z) < radius).then(() => game.setTarget(null));
}
function talkTo(game, id, label, sub = '') {
  const person = game.people.staff[id];
  game.ui.setObjective(label, sub);
  game.setTarget(() => ({ x: person.position.x, z: person.position.z, y: person.position.y + 2.3 }));
  return game.waitInteract(id).then(() => {
    game.setTarget(null);
    game.player.faceTowards(person.position.x, person.position.z, person.position.y + 1.5);
  });
}

// ---------- Morning ----------

async function arrive(game) {
  const { ui, state, people, player, sky } = game;
  const fromMaa = loadResults('yom-hamaa');
  await ui.fact(FACTS.invite.title, FACTS.invite.points);
  if (fromMaa) ui.toast('דירגת את הצנחנים בשאלון ההעדפות. הזימון הגיע.', 2600);
  await ui.interlude('07:45 · תחנת הרכבת נתניה. שלוש חיילות מהחטיבה מחלקות מספרים.', 2600);
  sky.setTime('day');
  game.setDay('יום הגיבוש');
  game.setClock(10 * 60 + 15);
  player.teleport(SPOTS.arrival.x, SPOTS.arrival.z, Math.PI);
  people.squad.forEach((p, i) => p.place(SPOTS.arrival.x - 4 + (i % 5) * 1.2, SPOTS.arrival.z - 3 - Math.floor(i / 5), Math.PI));
  await ui.fadeIn();
  await talkTo(game, 'soldier', 'לשולחן הקליטה', 'בא״ח הצנחנים');
  await ui.talk(game.staff('soldier'), `בוקר טוב. מספר ${state.bib}, על החולצה. שלושה טפסים: הצהרת בריאות, טופס אישי ואישור. טלפון לשקית.`);
  game.hud.setBib(state.bib);
  const sleep = await ui.talk(game.staff('soldier'), 'ישנת הלילה שבע שעות?', ['כן, הלכתי לישון מוקדם', 'בערך חמש, הייתי לחוץ', 'לא, אבל אני מרגיש מצוין']);
  state.sleepHonest = sleep === 1 ? 1 : sleep === 0 ? 1 : 0.5;
  if (sleep === 1) ui.toast('רשמי (2024): בלי שבע שעות שינה שולחים הביתה. במשחק החיילת רושמת ומעבירה לחובש.', 3200);
  state.form = await personalForm(ui);
  await talkTo(game, 'medic', 'לבדיקה אצל החובש');
  await ui.talk(game.staff('medic'), 'דופק, לחץ דם. שתית? תשתה עוד. אם משהו כואב בביפ, עוצרים. אף אחד לא מתבייש.');
  await ui.fact(FACTS.arrive.title, FACTS.arrive.points);
  game.save('arrive');
}

// ---------- The beep test ----------

async function beep(game) {
  const { ui, state, player } = game;
  game.setClock(10 * 60 + 50);
  await ui.fact(FACTS.beep.title, FACTS.beep.points);
  await goTo(game, { x: -6, z: 26 }, 'לקו של מבחן הביפ', 'על המגרש, ליד המחנה', 3);
  const r = await beepTest(game);
  state.beep = r;
  ui.announce(`הגעת ל־${fmt(r.real)}`, `שלב ${r.level}:${r.shuttle}${r.passed ? ' · עברת את המינימום' : ''}`);
  if (!r.passed) {
    state.outcome = 'beep';
    game.save('beep');
    await ui.interlude('מי שלא הגיע ל־6:30 עולה לאוטובוס הביתה.', 2200);
    game.jumpTo('results');
    return;
  }
  unlock('tzanhanim-beep');
  if (r.real >= 8 * 60 - 1) unlock('tzanhanim-max');
  player.positionLocked = false;
  game.save('beep');
}

// ---------- The wait ----------

async function wait(game) {
  const { ui, state, player, people } = game;
  game.setClock(11 * 60 + 10);
  await ui.fact(FACTS.wait.title, FACTS.wait.points);
  player.teleport(SPOTS.circle.x, SPOTS.circle.z, Math.PI);
  people.squad.forEach((p, i) => p.place(SPOTS.circle.x - 4 + (i % 5) * 1.6, SPOTS.circle.z + 2 + Math.floor(i / 5) * 1.6, Math.PI).setPose('sit-ground'));
  await mapStudy(ui, 30);
  const k = await ui.talk('אני', 'עוד שלוש שעות. בצל. מה עושים?', ['חוזר על המפה בראש, שותה, נח', 'מדבר עם החבר׳ה על הביפ ועל מה שיקרה', 'נרדם על הדשא']);
  state.waitChoice = k;
  state.mapBonus = k === 0 ? 0.2 : 0;
  if (k === 2) ui.toast('המגבש מעיר אותך: "מספר, לשבת. כאן לא ישנים."', 2600);
  await ui.interlude('14:30 · מתחילים לקרוא לראיונות.', 2000);
  game.save('wait');
}

// ---------- The interview ----------

async function interview(game) {
  const { ui, state } = game;
  game.setClock(14 * 60 + 40);
  await goTo(game, INTERVIEW_SPOT, 'לראיון', 'שני אנשי מילואים מחכים', 2.4);
  await ui.fact(FACTS.interview.title, FACTS.interview.points);
  const names = [game.staff('int1'), game.staff('int2')];
  let mismatch = 0;
  for (const [n, item] of INTERVIEW.entries()) {
    const who = names[n % 2];
    if (item.form) {
      const form = FORM.find((f) => f.key === item.form);
      const k = await ui.talk(who, item.q, form.options);
      if (k !== state.form?.[item.form]) {
        mismatch++;
        const said = form.options[state.form?.[item.form] ?? 0];
        const f = await ui.talk(who, `רגע. בטופס כתבת "${said}".`, ['צודק, טעיתי. מה שכתבתי בטופס נכון', 'שיניתי את דעתי מאז הבוקר', '...']);
        push(state, 'interview', [0.6, 0.3, 0.1][f]);
      } else push(state, 'interview', 1);
    } else {
      const k = await ui.talk(who, item.q, item.choices);
      push(state, 'interview', item.scores[k]);
    }
  }
  state.mismatch = mismatch;
  if (mismatch === 0) unlock('tzanhanim-honest');
  await ui.talk(names[0], 'תודה. לך לצוות שלך. נתראה בשטח, אנחנו מסתכלים משם.');
  game.save('interview');
}

// ---------- The sand pit ----------

async function field(game) {
  const { ui, state, drills, sky, people } = game;
  await ui.interlude('16:00 · צוותים חדשים של 16. לכל צוות מגבש. לבור החול.', 2200);
  sky.setTime('afternoon');
  game.setClock(16 * 60 + 10);
  await ui.fact(FACTS.field.title, FACTS.field.points);
  people.squad.forEach((p) => p.setPose('stand'));
  const sprints = await drills.lapDrill('sprint', 45, game.staff('guy'), { stopAt: 4, title: 'ספרינטים · סדרי הגעה' });
  push(state, 'physical', clamp(sprints.laps / Math.max(1, sprints.best)));
  // The team map task, from the map handed out in the wait.
  const memory = await quiz(ui, { eyebrow: 'משימת מפה · מה זכרתם מהמפה?', questions: MAP12.questions });
  push(state, 'team', clamp(memory + (state.mapBonus ?? 0)));
  push(state, 'team', await baseTargets(ui));
  const stretcher = await drills.stretcherDrill(1, game.staff('guy'));
  push(state, 'physical', stretcherScore(stretcher));
  // The minefield.
  const lead = await ui.talk(game.staff('guy'), 'שדה מוקשים. שתי אלונקות, שני ג׳ריקנים. דורכים רק על השקים. אף אחד לא מונה מפקד.', [
    'מציע: אחד הולך ראשון ובודק, כולם עוקבים בדיוק אחריו, ואני סופר את הציוד',
    'מחכה שמישהו יחליט',
    'רץ ראשון בלי לדבר',
  ]);
  push(state, 'team', [1, 0.4, 0.3][lead]);
  const mines = await minefield(ui);
  push(state, 'team', mines.solved ? (mines.attempts === 1 ? 1 : 0.7) : 0.35);
  // The dilemma.
  await ui.fact(FACTS.dilemma.title, FACTS.dilemma.points);
  const d1 = await ui.talk(game.staff('guy'), DILEMMA.setup, DILEMMA.open.map((c) => c.text));
  const d2 = await ui.talk(game.staff('guy'), DILEMMA.push, DILEMMA.hold.map((c) => c.text));
  const d3 = await ui.talk(game.staff('guy'), DILEMMA.rep.q, DILEMMA.rep.choices);
  push(state, 'team', (DILEMMA.open[d1].score + DILEMMA.hold[d2].score + DILEMMA.rep.scores[d3]) / 3);
  // Crawls with sandbags, then the final combined task.
  sky.setTime('dusk');
  game.setClock(18 * 60);
  const crawl = await drills.lapDrill('combined', 50, game.staff('guy'), { stopAt: 3, title: 'זחילות עם שקי חול' });
  push(state, 'physical', clamp(crawl.laps / Math.max(1, crawl.best)));
  const last = await drills.lapDrill('kitbag', 40, game.staff('guy'), { stopAt: 3, title: 'משימה משולבת · סבבי בונוס לראשונים' });
  push(state, 'physical', clamp(last.laps / Math.max(1, last.best)));
  game.setClock(19 * 60);
  await ui.interlude('19:00 · "תודה, סיימתם." אוטובוס לתחנה. התשובה בעוד כשבועיים.', 2400);
  game.save('field');
}

// ---------- The answer ----------

function score(state) {
  const beepS = state.beep ? clamp((state.beep.real - 330) / 150) : 0;
  const physical = avg(state.physical);
  const team = avg(state.team);
  const talk = avg(state.interview);
  // The game's own weights: no source publishes any.
  const total = 0.3 * beepS + 0.25 * physical + 0.2 * team + 0.25 * talk;
  return { beepS, physical, team, talk, total };
}

async function results(game) {
  const { ui, state } = game;
  const s = score(state);
  let outcome = OUTCOMES[state.outcome] ?? null;
  if (!outcome) outcome = s.total >= 0.78 ? OUTCOMES.flagged : s.total >= 0.6 ? OUTCOMES.passed : OUTCOMES.failed;
  const pct = (v) => `${Math.round(clamp(v) * 100)}%`;
  const lines = [
    ['ביפ', state.beep ? `${fmt(state.beep.real)} (שלב ${state.beep.level}:${state.beep.shuttle})` : '—'],
    ['שטח (ספרינטים, אלונקה, זחילות)', pct(s.physical)],
    ['צוות (מפה, מוקשים, דילמה)', pct(s.team)],
    ['ראיון', pct(s.talk)],
    ['סתירות מול הטופס', String(state.mismatch ?? 0)],
  ];
  saveResults('tzanhanim', { outcome: outcome.title, total: s.total, beep: state.beep?.real ?? 0 });
  unlock('tzanhanim-done');
  if (outcome === OUTCOMES.passed || outcome === OUTCOMES.flagged) unlock('tzanhanim-in');
  game.save('results');
  if (state.outcome !== 'beep') await ui.interlude('כשבועיים אחר כך…', 1800);
  const choice = await resultsCard(ui, { bib: state.bib, outcome, lines, next: null, time: state.outcome === 'beep' ? '11:20' : 'שבועיים אחרי · 17:30' });
  await ui.fact(FACTS.results.title, FACTS.results.points);
  await ui.fact(FACTS.women.title, FACTS.women.points);
  if (choice === 'again') {
    unlock('persistence');
    window.location.href = './?new=1';
  } else window.location.href = '../main-screen/';
}

export const HANDLERS = { arrive, beep, wait, interview, field, results };

function recover(game) {
  game.ui.releaseAll?.();
  game.player.positionLocked = false;
  game.player.autoRun = false;
  game.setTarget(null);
  game.onAction = null;
  game.hud.setDrill(null, '');
  game.drills.resetBody?.();
  const w = document.getElementById('water');
  if (w) w.hidden = true;
}

export async function runFlow(game, startStep = 'arrive') {
  let i = STEPS.indexOf(startStep);
  game.jumpTo = (step) => {
    i = STEPS.indexOf(step) - 1;
  };
  for (; i < STEPS.length; i++) {
    const step = STEPS[i];
    game.state.step = step;
    try {
      await HANDLERS[step](game);
    } catch (error) {
      console.error(`step "${step}" failed`, error);
      recover(game);
      game.ui.toast('משהו השתבש בחלק הזה, ממשיכים הלאה', 3000);
      game.save(step);
    }
    game.state.stats = { ...(game.state.stats ?? {}), ...game.drills.stats };
  }
}
