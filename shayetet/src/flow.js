import { FACTS, BOOKLET, DEBATE, BOAT_COMMAND, INTERVIEW, OUTCOMES } from './content.js';
import { SPOTS } from './world.js';
import { dayThreeCut } from './team.js';
import { quiz, sociometric } from '../../naval/src/minigames.js';
import { weaponDrill, cutParade, resultsCard } from '../../gibbush-matkal/src/minigames.js';
import { loadResults, saveResults } from '../../shared/save.js';
import { unlock } from '../../shared/achievements.js';

// The Shayetet gibbush, condensed from the 2025–2026 accounts:
//   day 1 (Atlit, weapons, the sea) → day 2 (04:00, 2,000 m, debate, sandbags, 400 m swim, beach sprints) →
//   day 3 (march, cut, floating blind) → day 4 (the pool set, boats) → day 5 (final march, pressure pool,
//   sociometric, booklet test, interviews) → the results days later.

export const STEPS = ['arrive', 'day1', 'day2', 'day3', 'day4', 'day5', 'results'];

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const avg = (list) => {
  const v = (list ?? []).filter((x) => typeof x === 'number');
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0.5;
};
const push = (state, key, value) => (state[key] ??= []).push(value);
const stretcherScore = (rounds) => avg((rounds ?? []).map((r) => (r.role === 'stretcher' ? 0.6 + 0.4 * r.held : r.role === 'jerrycan' ? 0.5 : 0.3)));

function goTo(game, spot, label, sub = '', radius = 2.2) {
  game.ui.setObjective(label, sub);
  game.setTarget({ x: spot.x, z: spot.z, y: game.terrainHeight(spot.x, spot.z) + 2.3 });
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

/** After every drill: two warnings are allowed (an account from 11/2024); the game counts the staff's shouts. */
function checkWarnings(game) {
  const { state, ui } = game;
  const stops = game.drills.stats.stops ?? 0;
  const warnings = Math.min(3, Math.floor(stops / 3));
  if (warnings > (state.warnings ?? 0)) {
    state.warnings = warnings;
    ui.toast(`אזהרה ${warnings}: "${state.bib}, נרשם בפנקס."`, 2600);
  }
}

function score(state) {
  const physical = avg(state.physical);
  const water = avg(state.water);
  const command = avg(state.command);
  const team = avg(state.team);
  const knowledge = avg(state.knowledge);
  const interview = avg(state.interview);
  // The game's own weights: no source publishes any.
  const total = 0.2 * physical + 0.3 * water + 0.15 * command + 0.15 * team + 0.1 * knowledge + 0.1 * interview - 0.04 * Math.max(0, (state.warnings ?? 0) - 1);
  return { physical, water, command, team, knowledge, interview, total };
}

// ---------- Day 1 ----------

async function arrive(game) {
  const { ui, state, people, player, sky } = game;
  const fromSayarot = (loadResults('yom-sayarot')?.outcome ?? '').includes('שייטת');
  if (fromSayarot) state.via = 'sayarot';
  else {
    const k = await ui.talk('המשחק', 'איך הגעת לגיבוש? (במשחק אפשר להתחיל מכל אחד)', ['מיום סיירות, עם התוצאה "שייטת"', 'מגדנ״ע צלילה, בקיץ של י״א']);
    state.via = k === 0 ? 'sayarot' : 'gadna';
  }
  await ui.fact(FACTS.path.title, FACTS.path.points);
  await ui.interlude('יום א׳ · 11:00 · תחנת הרכבת עתלית, ואוטובוס לבסיס על החוף', 2400);
  sky.setTime('day');
  game.setDay('יום א׳');
  game.setClock(11 * 60 + 40);
  player.teleport(SPOTS.arrival.x, SPOTS.arrival.z, Math.PI);
  people.squad.forEach((p, i) => p.place(SPOTS.arrival.x - 4 + (i % 5) * 1.2, SPOTS.arrival.z - 3 - Math.floor(i / 5), Math.PI));
  await ui.fadeIn();
  await talkTo(game, 'head', 'לקליטה');
  await ui.talk(game.staff('head'), `${state.bib}. זה המספר שלך. טלפון לשקית, שם ומספר עליה.`);
  game.hud.setBib(state.bib);
  await talkTo(game, 'medic', 'לחובש');
  await ui.talk(game.staff('medic'), 'אוזניים, סינוסים, משהו? בבריכה תצלול לארבעה מטר. אם כואב, אומרים.');
  people.squad.forEach((p, i) => p.walkTo([{ x: SPOTS.briefing.x - 4 + (i % 5) * 1.8, z: SPOTS.briefing.z + 2 + Math.floor(i / 5) * 1.4 }], { pose: 'stand', facing: Math.PI }));
  await goTo(game, SPOTS.briefing, 'לתדריך', 'מול הדיונה');
  await ui.conversation([
    [game.staff('guy'), 'אני נועם. חמישה ימים. ים, חול, בריכה. אף אחד לא מצפה שתהיו הכי מהירים.'],
    [game.staff('guy'), 'כל עבירה נרשמת בפנקס. יש לכם שתי אזהרות. אל תגיעו לשלישית.'],
  ]);
  await ui.fact(FACTS.arrive.title, FACTS.arrive.points);
  game.save('arrive');
}

async function day1(game) {
  const { ui, state, sky } = game;
  game.setClock(14 * 60);
  for (const kind of ['ak', 'm16']) {
    const r = await weaponDrill(ui, kind, 'timed');
    push(state, 'knowledge', r.done ? clamp(1 - r.errors * 0.15) : 0.2);
  }
  sky.setTime('afternoon');
  await goTo(game, { x: SPOTS.beach.x, z: -56 }, 'טבילה בים', 'עד המותניים, וחזרה', 2);
  game.splash();
  ui.toast('קר. המדים כבדים מהמים.', 2000);
  await ui.fact(FACTS.warnings.title, FACTS.warnings.points);
  sky.setTime('dusk');
  game.setClock(20 * 60);
  await ui.fact(BOOKLET.title, BOOKLET.pages.map(([t, x]) => `${t}: ${x}`));
  ui.toast('את הפנקס תקראו בכל הפסקה. ביום האחרון יש עליו מבחן.', 2600);
  game.save('day1');
}

// ---------- Day 2 ----------

async function day2(game) {
  const { ui, state, drills, sky, player, water } = game;
  await ui.interlude('יום ב׳ · 04:00 · שתי דקות להיות בחוץ. טבילה בים, לחם ואיזוטוני.', 2400);
  sky.setTime('predawn');
  game.setDay('יום ב׳');
  game.setClock(5 * 60 + 30);
  player.teleport(SPOTS.runStart.x - 2, SPOTS.runStart.z, Math.PI / 2);
  await ui.fadeIn();
  await ui.fact(FACTS.run.title, FACTS.run.points);
  sky.setTime('dawn');
  const run = await drills.thresholdRun({ title: 'ריצת 2,000 מ׳', total: 2000, limit: 510 });
  state.run = run;
  push(state, 'physical', run.passed ? clamp(1 - (run.time - 420) / 180) : 0.1);
  if (!run.passed) {
    state.outcome = 'run';
    game.save('day2');
    game.jumpTo('results');
    return;
  }
  ui.toast(`2,000 מ׳: ${Math.floor(run.time / 60)}:${String(Math.round(run.time % 60)).padStart(2, '0')}`, 2400);
  sky.setTime('day');
  game.setClock(9 * 60);
  const d = await ui.talk(game.staff('guy'), DEBATE.q, DEBATE.choices.map((c) => c.text));
  push(state, 'command', DEBATE.choices[d].score);
  // Sandbags: the team's ten bags (a dip in the sea before each fill, in the accounts).
  game.setClock(11 * 60);
  await ui.fact(FACTS.sea.title, FACTS.sea.points);
  const bags = await drills.pyramid();
  push(state, 'physical', clamp((bags?.carried ?? 3) / 5));
  checkWarnings(game);
  // 400 m to the buoy and back.
  game.setClock(14 * 60);
  const swim = await water.seaSwim();
  state.swim = swim;
  push(state, 'water', swim.score);
  ui.toast(`400 מ׳: מקום ${swim.place} בחוליה (במשחק)`, 2400);
  // Evening on the beach.
  sky.setTime('dusk');
  game.setClock(18 * 60);
  const sprints = await drills.lapDrill('sprint', 40, game.staff('guy'), { stopAt: 3, title: 'ספרינטים ים־יבשה' });
  push(state, 'physical', clamp(sprints.laps / Math.max(1, sprints.best)));
  const socio = await drills.stretcherDrill(1, game.staff('guy'));
  push(state, 'physical', stretcherScore(socio));
  checkWarnings(game);
  game.save('day2');
}

// ---------- Day 3 ----------

async function day3(game) {
  const { ui, state, drills, sky, player, people, water } = game;
  await ui.interlude('יום ג׳ · 04:30 · מסע ראשון: שני מקטעים, אלונקות, זחילות ביניהם.', 2400);
  sky.setTime('dawn');
  game.setDay('יום ג׳');
  game.setClock(5 * 60);
  player.teleport(SPOTS.briefing.x, SPOTS.briefing.z, Math.PI);
  await ui.fadeIn();
  const march = await drills.lapDrill('kitbag', 45, game.staff('guy'), { stopAt: 3, title: 'מסע · מקטע שני' });
  push(state, 'physical', clamp(march.laps / Math.max(1, march.best)));
  checkWarnings(game);
  await ui.interlude('09:00 · חדר האוכל. מקריאים שמות.', 2000);
  const stays = score(state).total >= 0.48;
  const numbers = new Set();
  while (numbers.size < 11) numbers.add(String(100 + Math.floor(Math.random() * 400)));
  const list = [...numbers];
  if (stays) list.splice(Math.floor(Math.random() * list.length), 1, state.bib);
  list.sort((a, b) => Number(a) - Number(b));
  await cutParade(ui, { bib: state.bib, stays, numbers: list });
  await ui.fact(FACTS.cut.title, FACTS.cut.points);
  if (!stays) {
    state.outcome = 'cut';
    game.save('day3');
    game.jumpTo('results');
    return;
  }
  unlock('shayetet-cut');
  const left = dayThreeCut(people);
  ui.toast(`מהחוליה לא ממשיכים: ${left.map((p) => p.name).join(', ')}. מתחלקים מחדש.`, 3600);
  sky.setTime('afternoon');
  game.setClock(15 * 60);
  const float = await water.blindFloat();
  push(state, 'water', float.score);
  water.leave({ x: SPOTS.ropes.x, z: -54 });
  game.save('day3');
}

// ---------- Day 4: the pool and the boats ----------

async function day4(game) {
  const { ui, state, sky, water, player } = game;
  await ui.interlude('יום ד׳ · בריכה.', 1800);
  sky.setTime('day');
  game.setDay('יום ד׳');
  game.setClock(8 * 60);
  player.teleport(SPOTS.poolDeck.x - 1, SPOTS.poolDeck.z, -Math.PI / 2);
  await ui.fadeIn();
  await ui.fact(FACTS.pool.title, FACTS.pool.points);
  await talkTo(game, 'pool', 'למדריך הצלילה');
  await ui.talk(game.staff('pool'), 'כל תרגיל פעם אחת. משווים לחץ בירידה. מי שמרגיש סחרחורת, עולה ומרים יד. זה לא כישלון.');
  push(state, 'water', await water.breathHold());
  push(state, 'water', await water.rings({ blind: false, count: 2 }));
  push(state, 'water', await water.rings({ blind: true, count: 2 }));
  push(state, 'water', await water.weightHold());
  ui.toast('קלצ׳ניקוב בקרקעית. מפרקים בנשימה אחת (על המסך: על זמן).', 2600);
  const ak = await weaponDrill(ui, 'ak', 'pressure');
  push(state, 'water', ak.done ? clamp(1 - ak.errors * 0.15) : 0.3);
  const mask = await ui.talk(game.staff('pool'), 'המסכה מתמלאת מים בעומק שני מטר. מה עושים?', [
    'לוחצים על החלק העליון של המסכה, מסתכלים קצת למעלה ונושפים מהאף עד שהמים יוצאים',
    'עולים מיד למעלה',
    'מורידים את המסכה',
  ]);
  push(state, 'water', [1, 0.4, 0.1][mask]);
  water.leave(SPOTS.poolDeck, -Math.PI / 2);
  // The afternoon on the beach: boats.
  sky.setTime('afternoon');
  game.setClock(14 * 60);
  const climb = await water.boatClimb();
  push(state, 'water', climb.score);
  ui.toast(`${climb.rounds} סבבים בצוקון סירות`, 2000);
  for (const m of BOAT_COMMAND) {
    const k = await ui.talk(game.staff('guy'), m.q, m.choices.map((c) => c.text));
    push(state, 'command', m.choices[k].command);
    if (m.choices[k].calm !== undefined) push(state, 'water', m.choices[k].calm);
  }
  game.save('day4');
}

// ---------- Day 5 ----------

async function day5(game) {
  const { ui, state, drills, sky, player, people, water } = game;
  await ui.interlude('יום ה׳ · 03:45 · מסע אחרון: ארבעה מקטעים, יבש ורטוב לסירוגין.', 2400);
  sky.setTime('predawn');
  game.setDay('יום ה׳');
  game.setClock(4 * 60);
  player.teleport(SPOTS.briefing.x, SPOTS.briefing.z, Math.PI);
  await ui.fadeIn();
  const march = await drills.lapDrill('kitbag', 45, game.staff('guy'), { stopAt: 3, title: 'מסע אחרון · מקטע רביעי' });
  push(state, 'physical', clamp(march.laps / Math.max(1, march.best)));
  ui.toast('"סיימתם." ...ואז: "עוד מקטע." (לפי העדויות, לפעמים יש סוף מזויף)', 3000);
  checkWarnings(game);
  await ui.fact(FACTS.last.title, FACTS.last.points);
  sky.setTime('day');
  game.setClock(9 * 60);
  await ui.interlude('משקפות מושחרות כבר מהמחנה. בלי לדבר. לבריכה.', 2000);
  const pressure = await water.blindFloat({ seconds: 35, title: 'בריכת לחץ · משקפות מושחרות, צפוף, בלי לדבר', crowded: true });
  push(state, 'water', pressure.score);
  water.leave(SPOTS.poolDeck, -Math.PI / 2);
  if (pressure.maxPulse < 150) unlock('shayetet-calm');
  game.setClock(12 * 60);
  push(state, 'team', await sociometric(ui, people.teammates));
  const pref = await ui.talk('שאלון העדפות', 'דרג: אם לא שייטת, לאן?', ['669', 'חטיבת הקומנדו', 'רק שייטת']);
  state.pref = ['669', 'commando', 'only'][pref];
  push(state, 'knowledge', await quiz(ui, { eyebrow: 'מבחן על פנקס הימאות', questions: BOOKLET.questions, seconds: 50 }));
  for (const item of INTERVIEW) push(state, 'interview', item.scores[await ui.talk(game.staff('head'), item.q, item.choices)]);
  if (Math.random() < 0.5) {
    const p = await ui.talk(game.staff('psych'), 'ספר לי על רגע בגיבוש שבו רצית להפסיק. מה עשית?', ['בציפה עם המסכה המושחרת. ספרתי נשימות והתרכזתי בחבל', 'לא היה רגע כזה', 'כמעט ויתרתי, אבל לא רציתי שיראו']);
    push(state, 'interview', [1, 0.3, 0.6][p]);
  } else ui.toast('פסיכולוג מוזכר רק בעדויות מ־2023–2024, ולא אצל כולם. אותך לא קראו.', 2600);
  await ui.interlude('עבודות רס״ר. הסגל עדיין מסתכל.', 1800);
  game.save('day5');
}

// ---------- Results ----------

async function results(game) {
  const { ui, state } = game;
  const s = score(state);
  let outcome = OUTCOMES[state.outcome] ?? null;
  let next = null;
  if (!outcome) {
    if (s.total >= 0.7) outcome = OUTCOMES.shayetet;
    else if (s.total >= 0.55 && state.pref !== 'only' && state.via !== 'gadna') {
      outcome = state.pref === 'commando' ? OUTCOMES.commando : OUTCOMES.draft669;
      next = { label: state.pref === 'commando' ? 'לשיבוץ בקומנדו' : 'ליום הבריכה של 669', href: `../draft/?new=1&path=${state.pref === 'commando' ? 'commando' : '669'}` };
    } else {
      outcome = OUTCOMES.interviews;
      next = { label: 'לשבוע ראיונות', href: '../interview-week/?new=1' };
    }
  }
  if (state.outcome === 'cut' || state.outcome === 'run') next = null;
  const pct = (v) => `${Math.round(clamp(v) * 100)}%`;
  const lines = [
    ['פיזי (ריצה, שקים, מסעות)', pct(s.physical)],
    ['מים (ים, בריכה, סירות)', pct(s.water)],
    ['פיקוד', pct(s.command)],
    ['צוות וסוציומטרי', pct(s.team)],
    ['ידע (נשק, פנקס)', pct(s.knowledge)],
    ['אזהרות', String(state.warnings ?? 0)],
  ];
  saveResults('shayetet', { outcome: outcome.title, total: s.total });
  unlock('shayetet-done');
  if (outcome === OUTCOMES.shayetet) unlock('shayetet-in');
  game.save('results');
  if (!state.outcome) await ui.interlude('כמה ימים אחר כך…', 1800);
  const time = state.outcome === 'run' ? 'יום ב׳ · 07:00' : state.outcome === 'cut' ? 'יום ג׳ · 09:10' : 'יום א׳ · 12:40';
  const choice = await resultsCard(ui, { bib: state.bib, outcome, lines, next, time });
  await ui.fact(FACTS.results.title, FACTS.results.points);
  await ui.fact(FACTS.women.title, FACTS.women.points);
  if (choice === 'again') {
    unlock('persistence');
    window.location.href = './?new=1';
  } else if (choice === 'next' && next) window.location.href = next.href;
  else window.location.href = '../main-screen/';
}

export const HANDLERS = { arrive, day1, day2, day3, day4, day5, results };

function recover(game) {
  game.ui.releaseAll?.();
  game.player.positionLocked = false;
  game.player.autoRun = false;
  game.player.eyeOverride = null;
  game.setTarget(null);
  game.onAction = null;
  game.hud.setDrill(null, '');
  game.drills.resetBody?.();
  document.getElementById('water').hidden = true;
  document.body.classList.remove('blind');
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
