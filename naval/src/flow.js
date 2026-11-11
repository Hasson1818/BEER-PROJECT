import { FACTS, BOOKLET, HYDRAULICS, BOAT_TASK, RAFT_TASK, LAND_STATIONS, DARK_ROOM, INTERVIEW, CIRCUIT, TRACKS, OUTCOMES } from './content.js';
import { SPOTS, SEA, SUB } from './world.js';
import { midCut } from './team.js';
import { quiz, bookletStudy, hydraulicsVideo, raftEndurance, tugOfWar, drawingTest, interceptSim, writingParts, sociometric } from './minigames.js';
import { weaponDrill, cutParade, lecture, resultsCard } from '../../gibbush-matkal/src/minigames.js';
import { runTests } from '../../yom-hamaa/src/tests.js';
import { loadResults, saveResults } from '../../shared/save.js';
import { unlock } from '../../shared/achievements.js';

// The naval gibbush (חובלים and submarines together, as in the 2024–2026 accounts), condensed:
//   home (the online screening) → day 1 (run, booklet, beach, hydraulics) → day 2 (04:00, boats, the closed raft,
//   test) → day 3 (cut, command stations, dark room, tug, pits, weapon, lecture, sociometric) → day 4 (interview,
//   "מסדר דמעות", Haifa) → day 5 (Sa'ar 6 and committee, or the submarine tour) → results.

export const STEPS = ['home', 'arrive', 'day1', 'day2', 'day3', 'day4', 'day5', 'results'];

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const avg = (list) => {
  const v = list.filter((x) => typeof x === 'number');
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0.5;
};
const push = (state, key, value) => (state[key] ??= []).push(value);
/** The stretcher drill returns one entry per round: carrying the stretcher counts most. */
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
async function choices(game, speaker, items) {
  const scores = [];
  for (const m of items) {
    const k = await game.ui.talk(speaker, m.q, m.choices.map((c) => c.text));
    scores.push(m.choices[k]);
  }
  return scores;
}

// ---------- Home: invitation and the online screening ----------

async function home(game) {
  const { ui, state } = game;
  game.setDay('בבית');
  game.setClock(18 * 60 + 30);
  ui.setObjective('בבית', 'הזמנה למיון של ענף ים');
  const fromSayarot = (loadResults('yom-sayarot')?.outcome ?? '').includes('חובלים');
  if (fromSayarot) state.via = 'sayarot';
  else {
    const k = await ui.talk('המשחק', 'איך הגעת למיון של ענף ים? (במשחק אפשר להתחיל מכל אחד)', ['ביום סיירות קיבלתי "המשך חובלים / צוללות"', 'פניתי ישירות דרך "אתר צד/ים"']);
    state.via = k === 0 ? 'sayarot' : 'direct';
  }
  await game.phone({ time: 'יום ב׳ · 18:30', from: 'צה״ל · מיונים', text: 'שלום, זומנת למיון מקוון של ענף ים (חובלים / צוללות). הקישור פעיל במשך היום. מהבית, ממחשב.' });
  await ui.fact(FACTS.path.title, FACTS.path.points);
  await ui.fact(FACTS.online.title, FACTS.online.points);
  const tests = await runTests(game, { only: ['tech', 'spatial'] });
  const writing = await writingParts(ui);
  state.online = avg([tests.results.tech?.score, tests.results.spatial?.score, writing]);
  push(state, 'knowledge', avg([tests.results.tech?.score, tests.results.spatial?.score]));
  push(state, 'calm', writing);
  await ui.interlude('כעבור כשבועיים…', 1800);
  await game.phone({ time: 'יום ה׳ · 16:10', from: 'צה״ל · מיונים', text: 'עברת את המיון המקוון. זומנת לגיבוש חובלים / צוללות: יום א׳, 07:30, תחנת הרכבת עתלית. חמישה ימים.' });
  game.save('home');
}

// ---------- Day 1 ----------

async function arrive(game) {
  const { ui, state, people, player, sky } = game;
  await ui.interlude('יום א׳ · 07:40 · רכבת לעתלית, ואוטובוס לבסיס', 2400);
  sky.setTime('day');
  game.setDay('יום א׳');
  game.setClock(8 * 60 + 10);
  player.teleport(SPOTS.arrival.x, SPOTS.arrival.z, Math.PI);
  people.squad.forEach((p, i) => p.place(SPOTS.arrival.x - 4 + (i % 5) * 1.2, SPOTS.arrival.z - 3 - Math.floor(i / 5), Math.PI));
  await ui.fadeIn();
  await talkTo(game, 'head', 'לקליטה', 'שולחן הקליטה מתחת לרשת');
  await ui.talk(game.staff('head'), `שם, תעודה מזהה. ${state.bib}, זה המספר שלך לחמישה ימים. לחובשת.`);
  game.hud.setBib(state.bib);
  await talkTo(game, 'medic', 'לחובשת');
  await ui.talk(game.staff('medic'), 'חום: 37.1. בסדר. (לפי עדות אחת, 37.5 שלחו הביתה.) שתה, ואם משהו כואב, תבוא.');
  people.squad.forEach((p, i) => p.walkTo([{ x: SPOTS.briefing.x - 4 + (i % 5) * 1.8, z: SPOTS.briefing.z + 2 + Math.floor(i / 5) * 1.4 }], { pose: 'stand', facing: Math.PI }));
  await goTo(game, SPOTS.briefing, 'לרחבת התדריך', 'מול הדיונה');
  await ui.conversation([
    [game.staff('guy'), 'שלום. אני עומר, חובל. איתי רס״ן אסף מהצוללות, וצוערים מהקורס. כולם רואים הכול וכותבים הכול.'],
    [game.staff('guy'), 'הגיבוש הזה הוא לא רק ריצה. יש פנקס, יש מבחנים, ויש פיקוד. אנחנו מסתכלים איך אתם חושבים כשקשה.'],
  ]);
  await ui.fact(FACTS.arrive.title, FACTS.arrive.points);
  game.save('arrive');
}

async function day1(game) {
  const { ui, state, drills, sky } = game;
  game.setClock(10 * 60);
  ui.setObjective('ריצת סינון', 'כ־1 ק״מ על חול (לפי העדויות מ־11/2025)');
  const run = await drills.thresholdRun({ title: 'ריצת סינון', total: 1000, limit: 270 });
  state.run = run;
  push(state, 'physical', run.passed ? clamp(1 - (run.time - 200) / 140) : 0.1);
  if (!run.passed) {
    state.outcome = 'run';
    game.save('day1');
    game.jumpTo('results');
    return;
  }
  ui.toast(`עברת: ${Math.floor(run.time / 60)}:${String(Math.round(run.time % 60)).padStart(2, '0')}`, 2600);
  await ui.interlude('ציוד ופנקס. יש לכם 50 שניות. (במציאות עד הערב.)', 1600);
  await bookletStudy(ui, 50);
  // Beach crawls and a dip in the sea.
  sky.setTime('afternoon');
  game.setClock(14 * 60 + 30);
  const laps = await drills.lapDrill('combined', 70, game.staff('guy'), { stopAt: 3, title: 'זחילות על החול' });
  push(state, 'physical', clamp(laps.laps / Math.max(1, laps.best)));
  await goTo(game, { x: SPOTS.beach.x, z: -58.5 }, 'טבילה בים', 'רוצים עד המים, נכנסים עד המותניים');
  game.splash();
  ui.toast('קר. המדים כבדים מהמים. חוזרים!', 2400);
  await ui.fact(FACTS.sea.title, FACTS.sea.points);
  // A team puzzle.
  const puzzle = await ui.talk(game.staff('cadet'), 'פאזל של מפה ימית, 40 חלקים, לכל המחלקה. אף אחד לא אמר מי מוביל.', [
    'מציע לחלק: כל זוג לוקח אזור (קווי חוף, ים, מקרא), ומישהו אחד מרכיב',
    'מתחיל להרכיב לבד מהר',
    'מחכה שמישהו יחליט',
  ]);
  push(state, 'team', [1, 0.4, 0.3][puzzle]);
  push(state, 'command', [0.9, 0.3, 0.2][puzzle]);
  sky.setTime('dusk');
  game.setClock(20 * 60 + 15);
  await hydraulicsVideo(ui);
  game.save('day1');
}

// ---------- Day 2 ----------

async function day2(game) {
  const { ui, state, drills, sky, world, player } = game;
  await ui.interlude('יום ב׳ · 04:00 · השכמה. טבילה בים במדים, ומסע בחוף.', 2400);
  sky.setTime('predawn');
  game.setDay('יום ב׳');
  game.setClock(4 * 60 + 30);
  player.teleport(SPOTS.briefing.x, SPOTS.briefing.z, Math.PI);
  await ui.fadeIn();
  ui.toast('לפי עדות מ־11/2025: אלונקה עם 7 ווסטים, כ־100 ק״ג. כאן: ספרינטים עם אלונקה', 3200);
  const stretcher = await drills.stretcherDrill(2, game.staff('guy'));
  push(state, 'physical', stretcherScore(stretcher));
  // Rubber boats.
  sky.setTime('dawn');
  game.setClock(7 * 60);
  await ui.fact(FACTS.boats.title, FACTS.boats.points);
  await goTo(game, SPOTS.boats, 'לסירות הגומי', 'על החוף, מתחת לדיונה');
  await ui.talk(game.staff('guy'), BOAT_TASK.brief);
  world.boats.forEach((b, i) => {
    b.userData.afloat = true;
    b.position.set(SPOTS.boats.x - 4 + i * 4, SEA.level + 0.18, -66 - i * 1.5);
  });
  game.splash();
  const boat = await choices(game, game.staff('guy'), BOAT_TASK.moments);
  for (const c of boat) {
    if (c.command !== undefined) push(state, 'command', c.command);
    if (c.calm !== undefined) push(state, 'calm', c.calm);
    if (c.team !== undefined) push(state, 'team', c.team);
    if (c.maturity !== undefined) push(state, 'maturity', c.maturity);
  }
  if (boat.every((c) => (c.command ?? 1) >= 1)) unlock('naval-command');
  // The closed raft.
  await ui.fact(FACTS.raft.title, FACTS.raft.points);
  await ui.interlude('שוחים לרפסודה הסגורה. נכנסים פנימה, על הברכיים, מול הדופן.', 2000);
  const raft = await raftEndurance(ui);
  state.raft = raft;
  push(state, 'calm', raft.score);
  if (!raft.vomited) unlock('naval-raft');
  const r = await ui.talk(game.staff('cadet'), RAFT_TASK.q, RAFT_TASK.choices);
  push(state, 'knowledge', r === RAFT_TASK.answer ? 1 : 0.3);
  ui.toast(RAFT_TASK.note, 5000);
  world.boats.forEach((b, i) => {
    b.userData.afloat = false;
    b.position.set(SPOTS.boats.x - 4 + i * 4, game.terrainHeight(SPOTS.boats.x, SPOTS.boats.z) + 0.25, SPOTS.boats.z);
  });
  // A test on the booklet.
  sky.setTime('day');
  game.setClock(12 * 60);
  push(state, 'knowledge', await quiz(ui, { eyebrow: 'מבחן על הפנקס', questions: BOOKLET.tests[0], seconds: 40 }));
  // The sociometric stretcher sprint.
  game.setClock(16 * 60);
  const socio = await drills.stretcherDrill(1, game.staff('guy'));
  push(state, 'physical', stretcherScore(socio));
  game.save('day2');
}

// ---------- Day 3 ----------

async function day3(game) {
  const { ui, state, drills, sky, people, player } = game;
  await ui.interlude('יום ג׳ · 06:00 · כולם בחי״ת. מקריאים מספרים.', 2200);
  sky.setTime('dawn');
  game.setDay('יום ג׳');
  game.setClock(6 * 60 + 10);
  player.teleport(SPOTS.circle.x, SPOTS.circle.z - 3, Math.PI);
  await ui.fadeIn();
  const so = score(state).total;
  const stays = so >= 0.45;
  const numbers = new Set();
  while (numbers.size < 11) numbers.add(String(100 + Math.floor(Math.random() * 400)));
  const list = [...numbers];
  if (stays) list.splice(Math.floor(Math.random() * list.length), 1, state.bib);
  list.sort((a, b) => Number(a) - Number(b));
  await cutParade(ui, { bib: state.bib, stays, numbers: list });
  await ui.fact(FACTS.day3.title, FACTS.day3.points);
  if (!stays) {
    state.outcome = 'cut';
    game.save('day3');
    game.jumpTo('results');
    return;
  }
  const left = midCut(people);
  ui.toast(`מהמחלקה לא ממשיכים: ${left.map((p) => p.name).join(', ')}`, 3600);
  // Land command stations.
  sky.setTime('day');
  game.setClock(8 * 60);
  const land = await choices(game, game.staff('cadet'), LAND_STATIONS);
  for (const c of land) {
    push(state, 'command', c.command);
    if (c.team !== undefined) push(state, 'team', c.team);
  }
  // The dark room.
  await goTo(game, SPOTS.dark, 'לקונטיינר', 'החדר החשוך');
  await ui.interlude('נכנסים. הדלת נסגרת. חושך מוחלט.', 1600);
  const dark = await choices(game, 'בחושך', [{ q: DARK_ROOM.intro + ' ' + DARK_ROOM.moments[0].q, choices: DARK_ROOM.moments[0].choices }]);
  push(state, 'command', dark[0].command);
  push(state, 'team', dark[0].team);
  // Tug-of-war, pits, weapon.
  game.setClock(11 * 60);
  const tug = await tugOfWar(ui);
  push(state, 'team', tug.score);
  ui.toast(tug.won ? 'המחלקה שלכם ניצחה' : 'הפסדתם במשיכה. הסגל כותב מי משך עד הסוף', 2600);
  const dig = await drills.digDrill(35, game.staff('guy'));
  push(state, 'physical', clamp((dig?.perSecond ?? 0.5) / 1.6));
  ui.toast(`${game.staff('cadet')}: "כמה רגליים יש לעכביש? מה בירת אוסטרליה? פרק כבר!"`, 3200);
  const weapon = await weaponDrill(ui, 'm16', 'pressure');
  push(state, 'knowledge', weapon.done ? clamp(1 - weapon.errors * 0.15) : 0.25);
  // A personal lecture and the second test (with the hydraulics video).
  game.setClock(15 * 60);
  push(state, 'interview', await lecture(ui, game.staff('guy')));
  push(state, 'knowledge', await quiz(ui, { eyebrow: 'מבחן על הפנקס ועל הסרטון', questions: [...BOOKLET.tests[1], ...HYDRAULICS.questions], seconds: 50 }));
  sky.setTime('dusk');
  game.setClock(20 * 60);
  push(state, 'team', await sociometric(ui, people.teammates));
  game.save('day3');
}

// ---------- Day 4: interview, the split, Haifa ----------

function score(state) {
  const physical = avg(state.physical ?? []);
  const command = avg(state.command ?? []);
  const knowledge = avg(state.knowledge ?? []);
  const calm = avg(state.calm ?? []);
  const team = avg(state.team ?? []);
  const interview = avg([...(state.interview ?? []), ...(state.maturity ?? [])]);
  // The game's own weights: no source publishes any.
  const total = 0.15 * physical + 0.25 * command + 0.2 * knowledge + 0.15 * calm + 0.15 * team + 0.1 * interview;
  return { physical, command, knowledge, calm, team, interview, total };
}

async function day4(game) {
  const { ui, state, drills, sky, player } = game;
  await ui.interlude('לילה. 20 דקות אחרי כיבוי אורות: "כולם בחוץ! סדר הגעה!"', 2200);
  sky.setTime('night');
  game.setDay('יום ד׳');
  game.setClock(0 * 60 + 25);
  player.teleport(SPOTS.briefing.x, SPOTS.briefing.z, Math.PI);
  await ui.fadeIn();
  const night = await drills.lapDrill('sprint', 30, game.staff('guy'), { stopAt: 2, title: 'השכמה: סדרי הגעה' });
  push(state, 'physical', clamp(night.laps / Math.max(1, night.best)));
  await ui.interlude('בוקר. ניקיונות, ואז ראיון של כחמש דקות.', 1800);
  sky.setTime('day');
  game.setClock(9 * 60);
  player.teleport(SPOTS.committee.x, SPOTS.committee.z - 5, 0);
  await ui.fadeIn();
  for (const item of INTERVIEW) push(state, 'interview', item.scores[await ui.talk(game.staff('head'), item.q, item.choices)]);
  // The split.
  await ui.interlude('12:00 · מסדר. שלוש קבוצות: חובלים, צוללות, הביתה.', 2200);
  const s = score(state);
  state.split = s.total >= 0.66 ? (s.command >= s.calm ? 'hovel' : 'sub') : s.total >= 0.56 ? 'sub' : 'home';
  const label = { hovel: 'קבוצת החובלים: לאוטובוס לחיפה', sub: 'קבוצת הצוללות', home: 'הביתה' }[state.split];
  await ui.talk(game.staff('head'), `${state.bib}: ${label}.`);
  await ui.fact(FACTS.split.title, FACTS.split.points);
  if (state.split === 'home') {
    state.outcome = 'home';
    game.save('day4');
    game.jumpTo('results');
    return;
  }
  if (state.split === 'hovel') {
    await ui.interlude('בית הספר הימי, חיפה. פסיכולוגית ומבחני מגמה.', 2200);
    await ui.fact(FACTS.haifa.title, FACTS.haifa.points);
    const p1 = await ui.talk(game.staff('psych'), 'מה תעשה ביום שבו הצוות שלך לא סומך עליך?', ['אשאל אותם ישר מה קרה, ואקשיב לפני שאתגונן', 'אתעלם ואמשיך לפקד', 'אבקש להחליף צוות']);
    push(state, 'interview', [1, 0.3, 0.2][p1]);
    state.tracks = { electronics: await interceptSim(ui), circuit: (await quiz(ui, { eyebrow: 'מבחן מגמה · אלקטרוניקה', questions: [CIRCUIT] })) };
    state.tracks.mechanics = await drawingTest(ui);
  }
  game.save('day4');
}

// ---------- Day 5 ----------

async function day5(game) {
  const { ui, state, player, sky, people, world } = game;
  game.setDay('יום ה׳');
  sky.setTime('day');
  if (state.split === 'sub') {
    await ui.fact(FACTS.sub.title, FACTS.sub.points);
    await ui.interlude('בסיס חיל הים בחיפה. קודם פסיכולוג, ואז סיור בצוללת.', 2200);
    const p = await ui.talk(game.staff('psych'), 'בצוללת אתם חודשים בתוך צינור, בלי שמש, עם אותם אנשים. מה הכי מפחיד אותך בזה?', [
      'שיהיה מתח עם מישהו ולא יהיה לאן ללכת. הייתי מדבר איתו מוקדם, לפני שזה גדל',
      'כלום לא מפחיד אותי',
      'שאני אשתגע. אבל אני לא אגיד',
    ]);
    state.psych = [1, 0.3, 0.1][p];
    game.setClock(11 * 60);
    player.teleport(SUB.x, 14.5, Math.PI);
    await ui.fadeIn();
    const guide = people.staff.subGuide;
    guide.place(SUB.x, 12.5, 0);
    await ui.talk(guide.name, 'ברוכים הבאים. כאן ישנים: שלוש קומות, ולפעמים חולקים מיטה במשמרות. ממשיכים קדימה. ראש, יש סף.');
    guide.walkTo([{ x: SUB.x, z: 1 }], { pose: 'stand', facing: Math.PI });
    await goTo(game, { x: SUB.x, z: 1.5 }, 'לחדר הבקרה', 'דרך הפתח העגול', 1.6);
    await ui.talk(guide.name, 'חדר הבקרה. הפריסקופ, עמדות הניווט והסונר. בצוללת כל אחד יודע לעשות גם את העבודה של מי שלידו.');
    guide.walkTo([{ x: SUB.x, z: -9.5 }], { pose: 'stand', facing: Math.PI });
    await goTo(game, { x: SUB.x, z: -9 }, 'לחדר הטורפדות', 'בחזית', 1.6);
    await ui.talk(guide.name, 'זה החלק הקדמי. בסיור אמיתי זה כשעה וחצי, ובזמן הזה הסגל מחליט. בהצלחה.');
    await ui.interlude('יוצאים מהצוללת. מסדר. מקריאים מספרים.', 2000);
    const s = score(state);
    state.passed = 0.4 * s.calm + 0.3 * s.team + 0.3 * state.psych >= 0.6;
  } else {
    await ui.interlude('יום ה׳ · סיור על הסער 6, ואז ועדה, אחד־אחד.', 2200);
    game.setClock(9 * 60);
    player.teleport(SPOTS.pier.x, -61, Math.PI);
    await ui.fadeIn();
    await goTo(game, { x: SPOTS.pier.x, z: -86 }, 'ללכת לאורך המזח', 'אל הספינה', 2);
    player.faceTowards(SPOTS.ship.x, SPOTS.ship.z, 4);
    await ui.conversation([
      [game.staff('cadet'), 'זה סער 6. על הגשר עומד קצין שייט, למטה קציני המכונה, ובמערכות הלחימה האלקטרוניקאים. שלוש המגמות של הקורס.'],
      [game.staff('cadet'), 'בעוד שנתיים וחצי, אם תעבור, תעמוד על גשר כזה כסגן.'],
    ]);
    await ui.fact(FACTS.committee.title, FACTS.committee.points);
    game.setClock(13 * 60);
    player.teleport(SPOTS.committee.x, SPOTS.committee.z - 2.5, 0);
    await ui.fadeIn();
    const want = await ui.talk(game.staff('committee'), 'איזו מגמה אתה מעדיף?', Object.values(TRACKS).map((t) => `${t.name}: ${t.text}`));
    const ids = Object.keys(TRACKS);
    const s = score(state);
    const t = state.tracks ?? {};
    const fit = { sail: s.command, electronics: avg([t.electronics, t.circuit]), mechanics: t.mechanics ?? 0.5 };
    state.passed = s.total + 0.1 * avg(Object.values(fit)) >= 0.7;
    state.track = fit[ids[want]] >= 0.6 ? ids[want] : ids.reduce((a, b) => (fit[a] >= fit[b] ? a : b));
  }
  game.save('day5');
}

// ---------- Results ----------

async function results(game) {
  const { ui, state } = game;
  const s = score(state);
  let outcome = OUTCOMES[state.outcome] ?? null;
  if (!outcome) {
    if (state.split === 'sub') outcome = state.passed ? OUTCOMES.sub : OUTCOMES.notSub;
    else {
      const track = TRACKS[state.track ?? 'sail'];
      outcome = state.passed ? { title: `${OUTCOMES.hovel.title} · מגמת ${track.name}`, detail: `${track.text} הצעד הבא (רשמי): תחקיר ביטחוני ובדיקות במכון לרפואה ימית, וחתימה על 5 שנות קבע.` } : OUTCOMES.notHovel;
    }
  }
  const pct = (v) => `${Math.round(clamp(v) * 100)}%`;
  const lines = [
    ['פיזי', pct(s.physical)],
    ['פיקוד (סירות, תחנות, חדר חשוך)', pct(s.command)],
    ['ידע (פנקס, סרטון, מבחנים)', pct(s.knowledge)],
    ['רוגע (רפסודה, ים)', pct(s.calm)],
    ['צוות וסוציומטרי', pct(s.team)],
  ];
  saveResults('naval', { outcome: outcome.title, split: state.split ?? null, total: s.total });
  unlock('naval-done');
  if (state.passed && state.split === 'hovel') unlock('naval-hovel');
  if (state.passed && state.split === 'sub') unlock('naval-sub');
  game.save('results');
  const failed = !state.passed;
  const next = failed ? { label: 'לשבוע ראיונות', href: '../interview-week/?new=1' } : null;
  const time = state.outcome === 'run' ? 'יום א׳ · 11:30' : state.outcome === 'cut' ? 'יום ג׳ · 06:20' : state.outcome === 'home' ? 'יום ד׳ · 12:10' : 'יום ה׳ · 15:00';
  const choice = await resultsCard(ui, { bib: state.bib, outcome, lines, next, time });
  await ui.fact(FACTS.after.title, FACTS.after.points);
  await ui.fact(FACTS.women.title, FACTS.women.points);
  if (choice === 'again') {
    unlock('persistence');
    window.location.href = './?new=1';
  } else if (choice === 'next' && next) window.location.href = next.href;
  else window.location.href = '../main-screen/';
}

export const HANDLERS = { home, arrive, day1, day2, day3, day4, day5, results };

function recover(game) {
  game.ui.releaseAll?.();
  game.player.positionLocked = false;
  game.player.autoRun = false;
  game.player.standUp?.(false);
  game.setTarget(null);
  game.onAction = null;
  game.hud.setDrill(null, '');
  game.drills.resetBody?.();
  document.querySelectorAll('.pp-screen').forEach((e) => e.remove());
}

export async function runFlow(game, startStep = 'home') {
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
