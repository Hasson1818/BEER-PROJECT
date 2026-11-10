import { SPOTS, DUNE, height } from '../../yom-sayarot/src/world.js';
import { gather, campLife } from '../../yom-sayarot/src/team.js';
import { mapTask } from '../../shared/engine/map-task.js';
import { loadResults, saveResults } from '../../shared/save.js';
import { unlock } from '../../shared/achievements.js';
import { reshuffle } from './team.js';
import { FACTS, INTERVIEW, MAP_PLACES, BOAT, OUTCOMES } from './content.js';
import { bagCheck, articleStudy, articleTest, weaponDrill, knotLesson, knotTest, lecture, sociometric, preferenceForm, cutParade, resultsCard } from './minigames.js';

// Day 1 intake + evening acts → day 2 → the cut on day 3 → night wake-up → day 4 → day 5 results.
export const STEPS = ['arrive', 'evening1', 'morning2', 'noon2', 'evening2', 'cut', 'day3', 'night3', 'day4', 'results'];

// The game's own shortening: a few laps instead of 10–15 (labelled in the drill box).
const LAPS = { short: 3, long: 4 };

const above = (person, extra = 2.3) => () => ({ x: person.position.x, y: person.position.y + extra, z: person.position.z });
const groundTarget = (spot, extra = 2.2) => ({ x: spot.x, y: height(spot.x, spot.z) + extra, z: spot.z });
const near = (spot, r) => (p) => Math.hypot(p.x - spot.x, p.z - spot.z) < r;

async function talkScene(game, person, fn) {
  const release = game.ui.holdModal();
  game.player.faceTowards(person.position.x, person.position.z, person.position.y + 1.55);
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

/** Staff and squad at the start line of the dune. */
function toDune(game, staffPerson) {
  staffPerson.group.visible = true;
  staffPerson.place(-2, DUNE.startZ + 3, Math.PI).setPose('clipboard');
  gather(game.people.teammates.filter((p) => !p.info.out), 0, DUNE.startZ + 2, 0);
  game.player.teleport(-2, 6, 0.2);
}

/** Score a lap drill against the best in the squad: 1 = level with the leader. */
function relative(result) {
  if (!result) return 0.5;
  return Math.min(1, result.laps / Math.max(1, result.best));
}

function note(state, key, value) {
  state.marks ??= {};
  state.marks[key] = value;
}

// ---------- Day 1 ----------

async function arrive(game) {
  const { ui, people, state, sky, player } = game;
  sky.setTime('day');
  game.setClock(1, 11 * 60);
  campLife(people.others);
  gather(people.teammates, SPOTS.arrival.x - 6, SPOTS.arrival.z + 2, -Math.PI / 2);
  player.teleport(SPOTS.arrival.x, SPOTS.arrival.z, Math.PI / 2 + 0.4);
  ui.setObjective('קרא את הזימון');
  await ui.fadeIn();
  const sayarot = loadResults('yom-sayarot');
  await ui.fact(FACTS.before.title, [
    sayarot?.outcome?.includes('היחידה') ? 'קיבלת זימון לגיבוש "היחידה" ביום הסיירות.' : 'במציאות מגיעים לכאן רק עם זימון מיום הסיירות. במשחק אפשר לשחק את השלב גם בלעדיו.',
    ...FACTS.before.points,
  ]);
  await bagCheck(ui);
  await ui.interlude('11:00 · תחנת רכבת יבנה. אוטובוס לדיונות. חותמים על טופס רפואי ומכבים טלפונים.', 2800);

  const medic = people.staff.medic;
  await goTalk(game, medic, 'medic', 'גש לחובש', 'קליטה: דופק, חום ומספר אישי');
  await talkScene(game, medic, async () => {
    await ui.talk(medic.name, 'יד בבקשה. דופק... חום... תקין.');
    await ui.talk(medic.name, `המספר האישי שלך הוא ${state.bib}. מעכשיו זה השם שלך. לך לאפסנאות.`);
    game.hud.setBib(state.bib);
  });
  await ui.interlude('אפסנאות: קיטבג, פלג אוהל, מוטות, מדים, ווסט, שתי מימיות, את חפירה ונשק.', 2600);

  const rasar = people.staff.rasar;
  await goTalk(game, rasar, 'rasar', 'גש לרס״ר', 'חלוקה לחוליות ובניית אוהלים');
  await talkScene(game, rasar, async () => {
    await ui.talk(rasar.name, 'חוליה 3, אליי! אוהל סיירים בזוגות. יש לכם שלוש דקות. בשתיקה!');
    const partner = people.teammates.find((p) => p.info.trait === 'steady');
    const choice = await ui.talk('אני', `${partner.name} לידך מחזיק יתד ולא יודע מה לעשות.`, [
      'מראה לו בידיים בלי לדבר, ומתחילים מהמוטות',
      'לוחש לו מה לעשות',
      'בונה לבד מהר, שיסתדר',
    ]);
    state.tentChoice = [1, 0.4, 0.3][choice];
    if (choice === 1) state.silenceBroken = true;
    await ui.talk(rasar.name, choice === 1 ? 'מי דיבר?! כל החוליה, עשר שכיבות סמיכה.' : 'זמן! לא עמדתם בזה. לא נורא, ככה זה. קדימה.');
  });
  await ui.fact(FACTS.intake.title, FACTS.intake.points);
  await ui.talk(game.people.staff.guy.name, 'זה המאמר שלכם. תקראו עכשיו. לא אגיד מתי המבחן.');
  await articleStudy(ui, 45);
  game.addMinutes(240);
  game.save('arrive');
}

async function evening1(game) {
  const { ui, sky, drills, state } = game;
  const guy = game.people.staff.guy;
  sky.setTime('dusk');
  game.setClock(1, 17 * 60 + 15);
  toDune(game, guy);
  await talkScene(game, guy, async () => {
    await ui.talk(guy.name, 'ערב טוב. אני אלעד, ואני ועוד חמישה מגבשים איתכם עד הסוף. פה לא אומרים לכם כמה זמן זה. הראשון שמגיע למספר הסבבים עוצר את כולם.');
  });
  await ui.fact(FACTS.acts.title, FACTS.acts.points);

  await talkScene(game, guy, () => ui.talk(guy.name, 'מקצה ראשון: זחילות משולבות. זוחלים עד הסרט, שק, עולים לקונוס, מחזירים שק, ספרינט לקו. מספר וסבב אחרי כל סבב.'));
  const combined = await drills.lapDrill('combined', 140, guy.name, { stopAt: LAPS.short, title: 'זחילות משולבות' });
  ui.announce(`${combined.laps} סבבים`, `הראשון בחוליה: ${combined.best}`);

  // Someone inflates his lap count.
  const cheater = game.people.teammates.find((p) => p.info.trait === 'cheater');
  if (cheater) {
    await talkScene(game, guy, async () => {
      await ui.talk(cheater.name, `${guy.name}, סבב ${combined.best}!`);
      const choice = await ui.talk('אני', `ראית את ${cheater.name} מקצר את הזחילה. הוא עשה פחות. מה אתה עושה?`, [
        'אחרי המקצה אומר לו בשקט שיתקן',
        'לא אומר כלום, זה לא העסק שלי',
        'צועק למגבש שהוא מרמה',
      ]);
      state.cheatReaction = [1, 0.4, 0.5][choice];
      if (choice === 0) await ui.talk(cheater.name, '...טוב. סבב אחד פחות. תודה.');
    });
  }

  await talkScene(game, guy, () => ui.talk(guy.name, 'מירוץ פילים. קיטבג בשתי הידיים, עד הקונוס וחזרה.'));
  const kitbag = await drills.lapDrill('kitbag', 120, guy.name, { stopAt: LAPS.short });
  ui.announce(`מירוץ פילים: ${kitbag.laps}`, `הראשון: ${kitbag.best}`);

  await talkScene(game, guy, () => ui.talk(guy.name, 'אלונקה סוציומטרית. ספרינט לקונוס וחזרה. ארבעת הראשונים לוקחים את האלונקה לסבב הבא.'));
  await drills.stretcherDrill(2, guy.name);

  await ui.interlude('21:30 · ישיבה בחול ליד האוהלים. המגבש מחלק דפים.', 1800);
  await talkScene(game, guy, () => ui.talk(guy.name, 'מבחן על המאמר. עכשיו.'));
  state.article = await articleTest(ui);
  ui.announce(`מאמר: ${Math.round(state.article * 100)}%`);
  await ui.interlude('23:15 · כיבוי אורות. רוב החוליה נרדמת בנעליים.', 2200);
  game.save('evening1');
}

// ---------- Day 2 ----------

async function morning2(game) {
  const { ui, sky, drills, state, people } = game;
  const guy = people.staff.guy;
  sky.setTime('dawn');
  game.setClock(2, 4 * 60);
  await ui.interlude('04:00 · השכמה! ווסט, מימיות, לדיונה. אין זמן לקפל.', 2400);
  toDune(game, guy);
  await talkScene(game, guy, () => ui.talk(guy.name, 'צוקון. שק של 20 קילו על הגב, עד הקונוס למעלה וחזרה. מספר וסבב אחרי כל אחד.'));
  const tz = await drills.lapDrill('tzukon', 160, guy.name, { stopAt: LAPS.long });
  ui.announce(`צוקון: ${tz.laps} סבבים`, `הראשון: ${tz.best}`);
  await ui.fact(FACTS.tzukon.title, FACTS.tzukon.points);

  // Map of Israel in the sand.
  const knot = people.staff.knot;
  knot.place(SPOTS.map.x + 4.2, SPOTS.map.z, -Math.PI / 2).setPose('clipboard');
  gather(people.teammates.filter((p) => !p.info.out).slice(0, 6), SPOTS.map.x, SPOTS.map.z - 6, Math.PI);
  game.player.teleport(SPOTS.map.x + 1, SPOTS.map.z - 7, Math.PI);
  game.setClock(2, 7 * 60 + 30);
  await talkScene(game, guy, () => ui.talk(guy.name, 'מפה של ארץ ישראל בחול, בדרך הכי יצירתית שאתם יכולים. כל אחד מסמן מקומות.'));
  state.map = await mapTask(ui, MAP_PLACES, { eyebrow: 'גיבוש · מפה בחול', title: 'סמן את המקומות על המפה' });

  // The 669 knot, shown once.
  await talkScene(game, knot, () => ui.talk(knot.name, 'אני מ־669. אראה לכם קשר פעם אחת. רק פעם אחת.'));
  await knotLesson(ui, 10);
  await ui.interlude('עשר דקות של סדרי הגעה על הדיונה...', 1600);
  state.knot = await knotTest(ui);
  await talkScene(game, knot, () => ui.talk(knot.name, state.knot >= 0.8 ? 'יפה. זכרת.' : 'לא בדיוק. אבל ראיתי שניסית.'));

  // M16, three times.
  await talkScene(game, guy, () => ui.talk(guy.name, 'פירוק M16. פעם ראשונה לאט, אני מסביר. אחר כך על זמן. אחר כך תחת לחץ.'));
  const slow = await weaponDrill(ui, 'm16', 'slow');
  const timed = await weaponDrill(ui, 'm16', 'timed');
  await ui.interlude('ספרינט עד הקונוס! עשר שכיבות סמיכה! עכשיו לנשק!', 1600);
  const pressure = await weaponDrill(ui, 'm16', 'pressure');
  state.weapon = [slow, timed, pressure];
  await ui.fact(FACTS.thinking.title, FACTS.thinking.points);
  game.save('morning2');
}

async function noon2(game) {
  const { ui, sky, drills, state, people } = game;
  const guy = people.staff.guy;
  const rasar = people.staff.rasar;
  sky.setTime('day');
  game.setClock(2, 12 * 60 + 30);
  game.player.teleport(SPOTS.camp.x + 6, SPOTS.camp.z - 6, Math.PI);
  await ui.interlude('12:30 · חמגשית. המגבשים הולכים. יש כשעתיים.', 2000);
  const choice = await ui.talk(rasar.name, 'יש לכם הפסקה. אני לא רוצה לראות אף אחד מסתובב סתם. מה אתה עושה?', [
    'אוכל הרבה, שותה ושוכב בצל',
    'קורא שוב את המאמר',
    'עוזר לרס״ר לסדר שקים',
  ]);
  state.noon = choice;
  if (choice === 0) drills.rest(40);
  await ui.fact(FACTS.noon.title, FACTS.noon.points);

  // The pit, with a change in the middle and a question about litres.
  game.setClock(2, 15 * 60);
  guy.place(SPOTS.dig.x - 1.5, SPOTS.dig.z + 3.2, Math.PI).setPose('clipboard');
  game.player.teleport(SPOTS.dig.x - 3, SPOTS.dig.z + 7, Math.PI + 0.2);
  await talkScene(game, guy, () => ui.talk(guy.name, `${state.bib}, בור מטר על מטר. מתחילים.`));
  await drills.digDrill(60, guy.name, () =>
    talkScene(game, guy, async () => {
      const c = await ui.talk(guy.name, 'עצור. שינוי: עכשיו תעלה באורך שני מטר. ממשיכים.', ['קיבלתי, ממשיך', 'אבל כמעט גמרתי!', 'למה? זה לא הוגן']);
      state.digReaction = [1, 0.5, 0.1][c];
    }),
  );
  const knot = people.staff.knot;
  const litres = await ui.talk(knot.name, 'שאלה: כמה ליטרים ייכנסו בבור של מטר על מטר על מטר?', ['1,000', '100', '10,000']);
  state.litres = litres === 0;
  await ui.talk(knot.name, litres === 0 ? 'נכון. מטר מעוקב הוא אלף ליטר.' : 'לא. מטר מעוקב הוא אלף ליטר. תזכור.');

  // Group dilemma.
  game.setClock(2, 17 * 60);
  const leader = people.teammates.find((p) => p.info.trait === 'leader');
  const loud = people.teammates.find((p) => p.info.trait === 'loud');
  await talkScene(game, guy, async () => {
    await ui.talk(guy.name, BOAT.intro);
    if (loud) await ui.talk(loud.name, 'פשוט נזרוק את הסבא. נגמר. אין על מה לדבר.');
    if (leader) await ui.talk(leader.name, 'רגע. בואו נחליט קודם לפי מה מחליטים, ואז נבחר.');
    const c = await ui.talk('אני', 'מה אתה עושה בדיון?', [
      `תומך ב${leader?.name ?? 'הצעה'} ומציע קריטריון: מי יכול לעזור לאחרים לשרוד`,
      'מתעקש על הפתרון שלי עד שכולם מסכימים',
      'שותק ומחכה שיגמר',
    ]);
    state.dilemma = [1, 0.4, 0.2][c];
    await ui.talk(guy.name, 'זמן. אני לא אגיד לכם מה נכון. רשמתי מי דיבר ואיך.');
  });
  game.save('noon2');
}

async function evening2(game) {
  const { ui, sky, state, people, player } = game;
  const guy = people.staff.guy;
  sky.setTime('night');
  game.setClock(2, 20 * 60 + 30);
  await ui.fact(FACTS.evening.title, FACTS.evening.points);
  state.socio1 = await sociometric(ui, people.teammates, 1);

  const circle = SPOTS.circle;
  guy.place(circle.x, circle.z - 2, 0).setPose('stand');
  player.teleport(circle.x + 5, circle.z + 5, Math.PI / 4);
  ui.setObjective('גש לראיון', 'שלוש עד חמש דקות מול המגבשים');
  game.setTarget(groundTarget(circle));
  await game.waitZone(near(circle, 4));
  game.setTarget(null);
  let score = 0;
  await talkScene(game, guy, async () => {
    for (const item of INTERVIEW.slice(0, 3)) {
      const c = await ui.talk(guy.name, item.q, item.choices);
      score += item.scores[c];
    }
    await ui.talk(guy.name, 'תודה. לך לישון.');
  });
  state.interview1 = score / 6;

  // The low point. The game offers a way out; the procedure is fictional.
  await ui.interlude('23:00 · שק שינה, חול בכל מקום. הרגליים רועדות.', 2000);
  const c = await ui.talk('אני', 'מחר בבוקר הניפויים. אתה גמור. מישהו מהחוליה אומר שאפשר פשוט ללכת לרס״ר ולחתום.', [
    'נושם, אוכל עוד קרקר עם גבינה, ונרדם',
    'הולך לרס״ר לחתום על ויתור',
  ]);
  if (c === 1) {
    await ui.fact(FACTS.quit.title, FACTS.quit.points);
    state.quit = true;
    game.save('evening2');
    game.jumpTo('results');
    return;
  }
  game.save('evening2');
}

// ---------- Day 3: the cut ----------

function physical(state, stats) {
  const drills = ['combined', 'kitbag', 'tzukon', 'sprint'].map((k) => stats[k]).filter(Boolean);
  const rel = drills.length ? drills.reduce((a, d) => a + relative(d), 0) / drills.length : 0.6;
  const stretcher = (stats.stretcher ?? []).reduce((a, r) => a + (r.rank <= 4 ? 1 : r.rank <= 6 ? 0.75 : 0.5) * (0.4 + 0.6 * r.held), 0) / Math.max(1, stats.stretcher?.length ?? 1);
  const dig = Math.min(1, (stats.dig?.perSecond ?? 0.5) / 1.6);
  return Math.max(0, Math.min(1, 0.6 * rel + 0.25 * (stats.stretcher ? stretcher : 0.6) + 0.15 * dig - 0.03 * (stats.stops ?? 0)));
}

function reliability(state, stats) {
  const lapDrills = ['combined', 'kitbag', 'tzukon', 'sprint'].map((k) => stats[k]).filter(Boolean);
  const reports = lapDrills.reduce((a, d) => a + d.reports, 0);
  const counted = reports ? lapDrills.reduce((a, d) => a + d.correct, 0) / reports : 0.7;
  const wire = state.wire === undefined ? 0.7 : state.wire;
  return 0.45 * counted + 0.3 * wire + 0.25 * (state.cheatReaction ?? 0.6) - (state.silenceBroken ? 0.05 : 0);
}

function thinking(state) {
  const w = (state.weapon ?? []).concat(state.weapon2 ?? []);
  const weapon = w.length ? w.reduce((a, r) => a + (r.done ? Math.max(0.3, 1 - r.errors * 0.15) : 0.2), 0) / w.length : 0.5;
  return (0.25 * (state.article ?? 0.5) + 0.2 * (state.map ?? 0.5) + 0.2 * (state.knot ?? 0.5) + 0.25 * weapon + 0.1 * (state.litres ? 1 : 0.3));
}

function social(state) {
  const parts = [state.socio1, state.socio2, state.dilemma, state.tentChoice, state.tower, state.party].filter((v) => v !== undefined);
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0.5;
}

/** The game's own weights (no source gives them). */
function totalScore(state, stats) {
  const interview = [state.interview1, state.interview2, state.lecture].filter((v) => v !== undefined);
  const talk = interview.length ? interview.reduce((a, b) => a + b, 0) / interview.length : 0.5;
  return 0.3 * physical(state, stats) + 0.2 * reliability(state, stats) + 0.2 * thinking(state) + 0.2 * social(state) + 0.1 * talk;
}

const CUT_LINE = 0.5; // The game's own line.

async function cut(game) {
  const { ui, sky, state, people } = game;
  const stats = { ...(state.stats ?? {}), ...game.drills.stats };
  sky.setTime('dawn');
  game.setClock(3, 6 * 60);
  await ui.interlude('06:00 · כל המתגבשים יושבים בחי״ת על הדיונה. מפקד הגיבוש מחזיק דף.', 2600);
  const score = totalScore(state, stats);
  const stays = score >= CUT_LINE;
  state.cutScore = score;
  const numbers = new Set();
  while (numbers.size < 11) numbers.add(String(100 + Math.floor(Math.random() * 400)));
  const list = [...numbers];
  if (stays) list.splice(Math.floor(Math.random() * list.length), 1, state.bib);
  list.sort((a, b) => Number(a) - Number(b));
  await cutParade(ui, { bib: state.bib, stays, numbers: list });
  await ui.fact(FACTS.cut.title, FACTS.cut.points);
  if (!stays) {
    state.cut = true;
    game.save('cut');
    game.jumpTo('results');
    return;
  }
  unlock('matkal-cut');
  const left = reshuffle(people);
  state.afterCut = true;
  people.staff.guy.group.visible = false;
  ui.toast(`מהחוליה הקודמת לא ממשיכים: ${left.map((p) => p.name).join(', ')}`, 4200);
  game.save('cut');
}

async function day3(game) {
  const { ui, sky, drills, state, people } = game;
  const guy2 = people.staff.guy2;
  sky.setTime('day');
  game.setClock(3, 7 * 60 + 30);
  toDune(game, guy2);
  await talkScene(game, guy2, async () => {
    await ui.talk(guy2.name, 'בוקר. אני נועה, ואתם חוליה חדשה. מה שהיה עד עכשיו לא מעניין אותי. מתחילים מאפס.');
  });
  state.lecture = await lecture(ui, guy2.name);
  await ui.talk(guy2.name, 'תודה. הבא.');

  // Under the wire: report every touch.
  game.setClock(3, 10 * 60);
  await talkScene(game, guy2, () => ui.talk(guy2.name, 'זחילה בתעלה מתחת לחוט. על כל נגיעה מדווחים. חמש שכיבות סמיכה וחמש כפיפות בטן לכל נגיעה.'));
  await ui.interlude('זוחלים... החול נכנס לשרוולים...', 1400);
  const c = await ui.talk('אני', 'הרגשת שהגב שלך נגע בחוט. אף אחד לא אמר כלום.', ['עוצר וצועק: "נגעתי!"', 'ממשיך, אולי לא ראו']);
  if (c === 0) {
    state.wire = 1;
    await ui.interlude('חמש שכיבות סמיכה, חמש כפיפות בטן. חוזרים לתעלה.', 1400);
    await ui.talk(guy2.name, 'רשמתי.');
  } else {
    state.wire = 0;
    await ui.talk(guy2.name, `${state.bib}. ראיתי את החוט זז.`);
  }
  await ui.fact(FACTS.reliability.title, FACTS.reliability.points);

  game.setClock(3, 14 * 60);
  await talkScene(game, guy2, () => ui.talk(guy2.name, 'צוקון. אותו דבר כמו אתמול, רק עם החוליה החדשה.'));
  const tz = await drills.lapDrill('tzukon', 160, guy2.name, { stopAt: LAPS.long, title: 'צוקון · יום ג׳' });
  state.tzukon3 = relative(tz);
  ui.announce(`צוקון: ${tz.laps} סבבים`, `הראשון: ${tz.best}`);
  await ui.interlude('22:30 · כיבוי אורות.', 1600);
  game.save('day3');
}

async function night3(game) {
  const { ui, sky, drills, people } = game;
  const guy2 = people.staff.guy2;
  sky.setTime('night');
  game.setClock(3, 23 * 60);
  await ui.interlude('23:00 · עשרים וחמש דקות אחרי שנרדמת... שריקה! הקפצה! נעליים, ווסט, לדיונה!', 2600);
  toDune(game, guy2);
  await talkScene(game, guy2, () => ui.talk(guy2.name, 'סדרי הגעה. עד הקונוס וחזרה. מספר וסבב.'));
  await drills.lapDrill('sprint', 100, guy2.name, { stopAt: LAPS.short, title: 'הקפצה · סדרי הגעה' });
  await ui.interlude('חזרה לשקי השינה. אף אחד לא מדבר.', 1600);
  game.save('night3');
}

// ---------- Day 4 ----------

async function day4(game) {
  const { ui, sky, drills, state, people } = game;
  const guy2 = people.staff.guy2;
  sky.setTime('predawn');
  game.setClock(4, 4 * 60 + 30);
  await ui.interlude('04:30 · השכמה. מסע אלונקות לעבר הזריחה. לא חוזרים לישון.', 2400);
  toDune(game, guy2);
  await talkScene(game, guy2, () => ui.talk(guy2.name, 'אלונקה. מי שמגיע ראשון לוקח. אני רואה מי סוחב ומי רק רץ לידה.'));
  await drills.stretcherDrill(1, guy2.name);
  const hider = people.teammates.find((p) => p.info.trait === 'hider');
  if (hider) {
    const c = await ui.talk('אני', `${hider.name} רץ צמוד לאלונקה ולא מחזיק בכלל. כולם גמורים.`, [
      `מחליף מישהו שנחלש, ואומר ל${hider.name} "בוא, תיכנס גם"`,
      'מתעלם וממשיך לסחוב',
      `צועק על ${hider.name} מול המגבשת`,
    ]);
    state.stretcherCall = [1, 0.7, 0.4][c];
  }

  // The second weapon, under pressure, while the others answer trivia.
  sky.setTime('day');
  game.setClock(4, 8 * 60);
  await ui.fact(FACTS.day4.title, FACTS.day4.points);
  await talkScene(game, guy2, () => ui.talk(guy2.name, 'קלצ׳ניקוב. לא הסברתי לכם. ספרינט, עשר שכיבות סמיכה, ולנשק.'));
  state.weapon2 = [await weaponDrill(ui, 'ak', 'pressure')];
  if (state.weapon2[0].done && state.weapon2[0].errors === 0 && (state.weapon ?? []).every((r) => r.done && r.errors === 0)) unlock('matkal-weapon');

  // The tower: personal first, then together.
  game.setClock(4, 11 * 60);
  const t = await ui.talk(guy2.name, 'מגדל שקים. קודם כל אחד בונה מגדל משלו. אחרי חמש דקות: מגדל אחד של כל החוליה. מה אתה עושה כשעוברים לקבוצתי?', [
    'מפרק את המגדל שלי ומעביר את השקים לקבוצתי',
    'שומר על המגדל שלי, הוא הכי גבוה',
    'עומד בצד ומחכה שיגידו לי מה לעשות',
  ]);
  state.tower = [1, 0.2, 0.4][t];
  await drills.pyramid();
  ui.announce('המגדל עומד');

  // A "civilian" task (2025–2026 accounts).
  game.setClock(4, 13 * 60);
  const p = await ui.talk(guy2.name, 'משימה: תכננו מסיבת סיום של י״ב לשכבה של 300 תלמידים. עשר דקות. מה התפקיד שלך?', [
    'מציע לחלק לצוותים קטנים (תקציב, מקום, תוכנית) ולוקח את התקציב',
    'מחכה שמישהו יוביל',
    'מציג רעיון ענק ולא מקשיב לאחרים',
  ]);
  state.party = [1, 0.3, 0.4][p];

  // Last block, then "the physical part is over".
  game.setClock(4, 15 * 60 + 30);
  await talkScene(game, guy2, () => ui.talk(guy2.name, 'בלוק אחרון. צוקון, הראשון עוצר.'));
  const last = await drills.lapDrill('tzukon', 120, guy2.name, { stopAt: LAPS.short, title: 'צוקון · בלוק אחרון' });
  state.lastBlock = relative(last);
  whistleEnd(game);
  ui.announce('תם החלק הפיזי של הגיבוש', 'המגבשים מורידים משקפי שמש ומחייכים');
  await ui.talk(guy2.name, 'כל הכבוד לכולם. באמת. עכשיו עוד קצת ניירת.');

  state.socio2 = await sociometric(ui, people.teammates, 2);
  state.pref = await preferenceForm(ui);
  let score = 0;
  await talkScene(game, guy2, async () => {
    for (const item of INTERVIEW.slice(3)) {
      const c = await ui.talk(guy2.name, item.q, item.choices);
      score += item.scores[c];
    }
  });
  state.interview2 = score / 4;
  await ui.interlude('יום ה׳ · עבודות רס״ר, קיפול אוהלים, החזרת ציוד. ואז... ייבוש. שעות של המתנה.', 3000);
  game.save('day4');
}

function whistleEnd(game) {
  game.drills.resetBody?.();
  game.hud.setDrill(null, '');
}

// ---------- Day 5: results ----------

const LINES = { matkal: 0.74, shaldag: 0.66, draft: 0.5 }; // The game's own lines.

function outcomeFor(state, stats) {
  if (state.quit) return OUTCOMES.quit;
  if (state.cut) return OUTCOMES.cut;
  const total = totalScore(state, stats) + 0.05 * ((state.tzukon3 ?? 0.6) + (state.lastBlock ?? 0.6) + (state.stretcherCall ?? 0.6)) / 3 - 0.025;
  state.total = total;
  if (total >= LINES.matkal) return OUTCOMES.matkal;
  if (total >= LINES.shaldag) return OUTCOMES.shaldag;
  if (total >= LINES.draft) return state.pref === 'commando' ? OUTCOMES.commando : OUTCOMES.draft669;
  return OUTCOMES.interviews;
}

async function results(game) {
  const { ui, state, drills } = game;
  const stats = { ...(state.stats ?? {}), ...drills.stats };
  const outcome = outcomeFor(state, stats);
  if (!state.quit && !state.cut) game.setClock(5, 13 * 60);
  ui.setObjective('התוצאות', state.quit || state.cut ? 'בדרך הביתה' : 'יום ה׳ · אחרי עבודות הרס״ר');
  const pct = (v) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
  const lines = [];
  if (!state.quit) {
    lines.push(['פיזי (מיקום יחסי)', pct(physical(state, stats))]);
    lines.push(['אמינות (דיווחים, חוט)', pct(reliability(state, stats))]);
    lines.push(['ראש (מאמר, מפה, קשר, נשק)', pct(thinking(state))]);
    lines.push(['חוליה וסוציומטרי', pct(social(state))]);
    if (stats.tzukon) lines.push(['צוקון אחרון', `${stats.tzukon.laps} סבבים (הראשון ${stats.tzukon.best})`]);
    if (stats.stops) lines.push(['עצירות', `${stats.stops} פעמים צעקו עליך`]);
  }
  saveResults('gibbush-matkal', { outcome: outcome.title, total: state.total ?? 0 });
  if (!state.quit && !state.cut) {
    unlock('matkal-done');
    if (outcome === OUTCOMES.matkal || outcome === OUTCOMES.shaldag) unlock('matkal-unit');
    if (state.wire === 1 && (state.cheatReaction ?? 0) >= 1) unlock('matkal-honest');
  }
  game.save('results');
  await ui.interlude(state.quit || state.cut ? 'האוטובוס יוצא לתחנת הרכבת...' : 'יום ה׳ · 13:05. הטלפון חזר אליך. הוא רוטט...', 2200);
  const next = outcome === OUTCOMES.interviews ? { label: 'לשבוע ראיונות', href: '../interview-week/?new=1' } : null;
  const time = state.quit ? 'יום ב׳ · 23:40' : state.cut ? 'יום ג׳ · 06:30' : 'יום ה׳ · 13:05';
  const choice = await resultsCard(ui, { bib: state.bib, outcome, lines, next, time });
  await ui.fact(FACTS.end.title, FACTS.end.points);
  await ui.fact(FACTS.women.title, FACTS.women.points);
  if (choice === 'again') {
    unlock('persistence');
    window.location.href = './?new=1';
  } else if (choice === 'next' && next) window.location.href = next.href;
  else window.location.href = '../main-screen/';
}

const HANDLERS = { arrive, evening1, morning2, noon2, evening2, cut, day3, night3, day4, results };

function recover(game) {
  game.ui.releaseAll?.();
  game.player.positionLocked = false;
  game.player.autoRun = false;
  game.player.standUp?.(false);
  game.setTarget(null);
  game.onAction = null;
  game.hud.setDrill(null, '');
  game.drills.resetBody?.();
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
