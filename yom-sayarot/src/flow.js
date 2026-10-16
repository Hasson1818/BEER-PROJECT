import { SPOTS, DUNE, height } from './world.js';
import { gather, campLife } from './team.js';
import { FACTS, INTERVIEW, OUTCOMES, MAP_PLACES } from './content.js';
import { summons, bagCheck, preferences, medicCheck, sociometric, resultsSms } from './minigames.js';
import { mapTask } from '../../shared/engine/map-task.js';
import { formatTime } from './drills.js';
import { loadResults, saveResults } from '../../shared/save.js';

// Day 1 afternoon → night 1 → day 2 → night 2 → day 3 morning, results by SMS.
export const STEPS = ['arrive', 'run', 'night1', 'morning', 'dig', 'team', 'night2', 'home', 'results'];

const above = (person, extra = 2.3) => () => ({ x: person.position.x, y: person.position.y + extra, z: person.position.z });
const groundTarget = (spot, extra = 2.2) => ({ x: spot.x, y: height(spot.x, spot.z) + extra, z: spot.z });
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

/** Walk to someone and talk to them. */
async function goTalk(game, person, id, objective, sub = '') {
  game.ui.setObjective(objective, sub);
  game.setTarget(above(person));
  await game.waitInteract(id);
}

// ---------- Day 1 ----------

async function arrive(game) {
  const { ui, player, people, state, sky } = game;
  sky.setTime('afternoon');
  game.setClock(1, 12 * 60 + 30);
  campLife(people.others);
  gather(people.teammates, SPOTS.arrival.x - 6, SPOTS.arrival.z + 2, -Math.PI / 2);
  player.teleport(SPOTS.arrival.x, SPOTS.arrival.z, Math.PI / 2 + 0.4);
  ui.setObjective('קרא את הזימון');
  await ui.fadeIn();
  await summons(ui, loadResults('tzav-rishon'));
  await bagCheck(ui);
  await ui.fact(FACTS.before.title, FACTS.before.points);

  await goTalk(game, people.staff.clerk, 'clerk', 'גש לשולחן הקליטה', 'שם מקבלים מספר');
  await talkScene(game, people.staff.clerk, async () => {
    await ui.talk(people.staff.clerk.name, 'שלום! תעודה מזהה בבקשה.');
    await ui.talk('אני', 'הנה.', ['[מגיש תעודה מזהה]']);
    await ui.talk(people.staff.clerk.name, `המספר שלך הוא ${state.bib}. תכתוב אותו בטוש גדול על החולצה הלבנה, מקדימה ומאחורה. מעכשיו כולם יקראו לך רק במספר.`);
    game.hud.setBib(state.bib);
    await ui.talk(people.staff.clerk.name, 'עכשיו שאלון העדפות, ואחר כך לחובש בשולחן ליד.');
  });
  state.prefs = await preferences(ui);

  await goTalk(game, people.staff.medic, 'medic', 'גש לחובש', 'בדיקה קצרה לפני הריצה');
  await talkScene(game, people.staff.medic, async () => {
    await ui.talk(people.staff.medic.name, 'היי. הבאת טופס רפואי חתום? מעולה. אני רק מודד דופק ולחץ דם.');
    await medicCheck(ui);
    await ui.talk(people.staff.medic.name, 'הכול תקין. תשתה הרבה מים, יהיה חם עד הערב.');
  });
  game.addMinutes(60);
  game.save('arrive');
}

async function run(game) {
  const { ui, people, sky, drills, state } = game;
  sky.setTime('dusk');
  game.setClock(1, 17 * 60 + 45);
  campLife(people.others);
  const head = people.staff.head;
  head.place(SPOTS.runStart.x - 1, SPOTS.runStart.z - 4, -Math.PI / 2).setPose('arms-crossed');
  gather(people.teammates, SPOTS.runStart.x + 3, SPOTS.runStart.z + 3, -Math.PI / 2);

  await goTalk(game, head, 'head', 'גש לקו הזינוק של ריצת הסף', 'המגבש הראשי מחכה שם');
  await talkScene(game, head, async () => {
    await ui.talk(head.name, 'ערב טוב. מתחילים בריצת סף: 1,200 מטר. 600 עד הדגל הכתום, ו־600 חזרה.');
    await ui.talk(head.name, 'זה לא דירוג. מי שלא עומד בזמן מסיים כאן את היום. מי שעובר מתחלק לצוותים. שאלות? אין. לקו!');
  });

  let result = await drills.thresholdRun();
  while (!result.passed) {
    const choice = await ui.talk(head.name, `${formatTime(result.time)}. זה מעל הרף. במציאות היום שלך היה נגמר כאן.`, ['לנסות שוב (רק במשחק)', 'לסיים את היום']);
    if (choice === 1) {
      state.failedRun = true;
      game.save('home');
      game.jumpTo('results');
      return;
    }
    result = await drills.thresholdRun();
  }
  ui.announce(`עברת: ${formatTime(result.time)}`, 'עמדת ברף של ריצת הסף');
  await ui.fact(FACTS.run.title, FACTS.run.points);

  const guy = people.staff.guy;
  guy.place(SPOTS.briefing.x + 2, SPOTS.briefing.z, Math.PI).setPose('clipboard');
  gather(people.teammates, SPOTS.briefing.x - 1, SPOTS.briefing.z + 1.5, 0);
  await ui.interlude('חלוקה לצוותים…', 1600);
  game.player.teleport(SPOTS.briefing.x - 1.5, SPOTS.briefing.z + 4.5, Math.PI + 0.2);
  await talkScene(game, guy, async () => {
    await ui.talk(guy.name, `צוות 4, אליי! אני גיא, המגבש שלכם עד הסוף. ${state.bib}, אתה איתנו.`);
    await ui.talk(guy.name, 'כללים: לא עוצרים עד שאני אומר "עצור". אחרי כל סיבוב אומרים לי מספר ומספר סיבוב. מי שלא זוכר, זה גם נרשם.');
    await ui.talk(guy.name, 'עכשיו אוכלים ושותים. ב־21:00 על הדיונה, מתחת לפרוז׳קטורים.');
  });
  await ui.interlude('ארוחת ערב קרבית ליד האוהלים… 20:45', 2000);
  game.save('run');
}

async function night1(game) {
  const { ui, people, sky, drills } = game;
  sky.setTime('night');
  game.setClock(1, 21 * 60);
  const guy = people.staff.guy;
  guy.place(-2, DUNE.startZ + 3, Math.PI).setPose('clipboard');
  gather(people.teammates, 0, DUNE.startZ + 2, 0);
  game.player.teleport(0, 9, 0);

  await goTalk(game, guy, 'guy', 'גש לקו הזינוק של הדיונה', 'המקצה הראשון מתחיל ב־21:00');
  await talkScene(game, guy, async () => {
    await ui.talk(guy.name, 'מקצה משולב. זוחלים עד הסרט, לוקחים שק מהשורה, עולים איתו עד הקונוס למעלה ומקיפים אותו.');
    await ui.talk(guy.name, 'יורדים, מניחים את השק בשורה, וספרינט עד הקו. שם אומרים לי מספר וסיבוב. אני לא אגיד לכם כמה זמן זה. יאללה, לקו.');
  });
  const result = await drills.lapDrill('combined', 105, guy.name);
  ui.announce(`סיימת ${result.laps} סיבובים`, `בממוצע בצוות: ${result.average}`);
  await ui.fact(FACTS.night1.title, FACTS.night1.points);
  await ui.interlude('00:40 · שקי שינה בחול. ההקפצה ב־04:00…', 2600);
  game.save('night1');
}

// ---------- Day 2 ----------

async function morning(game) {
  const { ui, people, sky, drills } = game;
  sky.setTime('dawn');
  game.setClock(2, 4 * 60);
  await ui.interlude('04:00 · הקפצה! מקפלים שק שינה וצועדים לדיונה', 2400);
  game.setClock(2, 5 * 60 + 30);
  const guy = people.staff.guy;
  guy.place(-2, DUNE.startZ + 3, Math.PI).setPose('clipboard');
  gather(people.teammates, 0, DUNE.startZ + 2, 0);
  game.player.teleport(-2, 6, 0.2);
  await talkScene(game, guy, async () => {
    await ui.talk(guy.name, 'בוקר טוב צוות 4. צוקון: שק על השכמות, עולים, מקיפים קונוס, יורדים. שוב ושוב. מספר וסיבוב אחרי כל אחד.');
  });
  const tz = await drills.lapDrill('tzukon', 85, guy.name);
  ui.announce(`צוקון: ${tz.laps} סיבובים`, `בממוצע בצוות: ${tz.average}`);
  await ui.fact(FACTS.tzukon.title, FACTS.tzukon.points);

  sky.setTime('day');
  game.setClock(2, 7 * 60);
  await talkScene(game, guy, async () => {
    await ui.talk(guy.name, 'אלונקה סוציומטרית. ספרינט עד הקונוס וחזרה. ארבעת הראשונים מרימים את האלונקה, חמישי ושישי ג׳ריקנים, כל השאר עוד סיבוב.');
  });
  await drills.stretcherDrill(2, guy.name);
  await ui.fact(FACTS.stretcher.title, FACTS.stretcher.points);
  game.save('morning');
}

async function dig(game) {
  const { ui, people, sky, drills, state } = game;
  sky.setTime('day');
  game.setClock(2, 9 * 60 + 30);
  const guy = people.staff.guy;
  guy.place(SPOTS.dig.x - 1.5, SPOTS.dig.z + 3.2, Math.PI).setPose('clipboard');
  game.player.teleport(SPOTS.dig.x - 3, SPOTS.dig.z + 7, Math.PI + 0.2);
  await talkScene(game, guy, async () => {
    await ui.talk(guy.name, `${state.bib}, הריבוע הזה שלך. בור של מטר על מטר, עומק מטר. מתחילים כשאני אומר.`);
  });
  await drills.digDrill(70, guy.name, () =>
    talkScene(game, guy, async () => {
      const choice = await ui.talk(guy.name, 'עצור רגע. שינוי משימה: עכשיו תעלה באורך שני מטר ועומק חצי מטר. ממשיכים מאיפה שאתה.', [
        'קיבלתי, ממשיך',
        'אבל כמעט גמרתי את הבור!',
        'למה? זה לא הוגן',
      ]);
      state.digReaction = [1, 0.5, 0.1][choice];
      if (choice !== 0) await ui.talk(guy.name, 'רשמתי. תחפור.');
    }),
  );
  await ui.fact(FACTS.dig.title, FACTS.dig.points);
  await ui.interlude('הפסקת צהריים בצל, הכי חם ביום… 15:30', 2200);
  game.save('dig');
}

async function team(game) {
  const { ui, people, sky, drills, state } = game;
  sky.setTime('afternoon');
  game.setClock(2, 16 * 60);
  const guy = people.staff.guy;
  const leader = people.teammates.find((p) => p.info.trait === 'leader');
  const loud = people.teammates.find((p) => p.info.trait === 'loud');
  guy.place(SPOTS.map.x + 4.2, SPOTS.map.z, -Math.PI / 2).setPose('clipboard');
  gather(people.teammates.filter((p) => !p.info.out).slice(0, 6), SPOTS.map.x, SPOTS.map.z - 6, Math.PI);
  game.player.teleport(SPOTS.map.x + 1, SPOTS.map.z - 7, Math.PI);

  let teamwork = 0;
  await talkScene(game, guy, async () => {
    await ui.talk(guy.name, 'משימת צוות ראשונה: ציירו בחול מפה של ארץ ישראל, עם כמה שיותר מידע. יש לכם עשר דקות.');
    await ui.talk(leader.name, 'בואו נתחלק: שניים על הקו של החוף, שניים על הירדן, ושאר המקומות ביחד.');
    await ui.talk(loud.name, 'לא! אני מצייר הכול, אני יודע הכי טוב!');
    const choice = await ui.talk('אני', 'מה אתה עושה?', [
      `מסכים עם ${leader.name}, ואומר ל${loud.name} בשקט שיצטרף לחלוקה`,
      `נותן ל${loud.name} לעשות הכול לבד`,
      'מתחיל לצייר לבד בלי לדבר עם אף אחד',
    ]);
    teamwork += [1, 0.4, 0.1][choice];
  });
  state.map = await mapTask(ui, MAP_PLACES);

  await talkScene(game, guy, async () => {
    await ui.talk(guy.name, 'עכשיו פירמידה משקי חול. תחליטו מי בונה, מי ממלא, מי מאבטח ומי סוחב.');
    const choice = await ui.talk(leader.name, 'מי לוקח מה?', [
      'אני סוחב שקים מהערימה',
      'אני בונה, תביאו לי',
      'שמישהו אחר יחליט, לא משנה לי',
    ]);
    teamwork += [1, 0.7, 0.3][choice];
  });
  state.teamwork = teamwork / 2;
  await drills.pyramid();
  ui.announce('הפירמידה עומדת!', 'עבודת צוות');
  await ui.fact(FACTS.team.title, FACTS.team.points);
  game.save('team');
}

async function night2(game) {
  const { ui, people, sky, player, state } = game;
  sky.setTime('night');
  game.setClock(2, 21 * 60 + 30);
  const guy = people.staff.guy;
  const circle = SPOTS.circle;
  campLife(people.others);
  // Sit in a circle around the lantern.
  const seats = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    seats.push({ x: circle.x + Math.cos(a) * 2.6, z: circle.z + Math.sin(a) * 2.6, a });
  }
  people.teammates.forEach((p, i) => {
    const s = seats[(i + 2) % 9];
    if (i > 6) return;
    p.carry(null);
    p.place(s.x, s.z, Math.atan2(circle.x - s.x, circle.z - s.z)).setPose('sit-ground');
  });
  guy.place(seats[0].x, seats[0].z, Math.atan2(circle.x - seats[0].x, circle.z - seats[0].z)).setPose('sit-ground');
  player.teleport(circle.x + 6, circle.z + 6, Math.PI / 4);

  game.ui.setObjective('לך למעגל ליד הפנס', 'ראיון קצר עם המגבשים');
  game.setTarget(groundTarget(circle));
  await game.waitZone(near(circle, 4));
  game.setTarget(null);
  const mySeat = seats[1];
  player.sit({ x: mySeat.x, z: mySeat.z, taken: false, eye: 0.85, exit: { x: mySeat.x + 1.2, z: mySeat.z + 1.2 } }, 0);
  player.faceTowards(guy.position.x, guy.position.z, guy.position.y + 1);

  let score = 0;
  await talkScene(game, guy, async () => {
    await ui.talk(guy.name, 'יושבים במעגל. כל אחד עונה קצר. מתחילים מ' + state.bib + '.');
    for (const item of INTERVIEW) {
      const choice = await ui.talk(guy.name, item.q, item.choices);
      score += item.scores[choice];
    }
    await ui.talk(guy.name, 'תודה. עכשיו כל אחד ממלא שאלון סוציומטרי על הצוות.');
  });
  state.interview = score / 5;
  state.social = await sociometric(ui, people.teammates);
  player.standUp(false);
  await ui.fact(FACTS.night2.title, FACTS.night2.points);
  await ui.interlude('שינה אחרי חצות. הלילה השני בשטח…', 2400);
  game.save('night2');
}

// ---------- Day 3 ----------

async function home(game) {
  const { ui, people, sky, player } = game;
  sky.setTime('day');
  game.setClock(3, 7 * 60 + 30);
  campLife(people.others);
  gather(people.teammates, SPOTS.arrival.x - 6, SPOTS.arrival.z + 2, -Math.PI / 2, 'stand');
  player.teleport(-18, 36, Math.PI / 2);
  await ui.interlude('בוקר. מקפלים את שקי השינה, מחזירים ציוד', 2200);
  ui.setObjective('עלה על האוטובוס הביתה', 'התשובות יגיעו בהודעה עד הערב');
  game.setTarget(groundTarget({ x: 36.5, z: 47.5 }));
  await game.waitZone(near({ x: 36.5, z: 47.5 }, 3));
  game.setTarget(null);
  await ui.interlude('נסיעה הביתה… נרדמת באוטובוס', 2200);
  game.save('home');
}

function outcomeFor(state, stats) {
  if (state.failedRun) return { total: 0, outcome: OUTCOMES[OUTCOMES.length - 1] };
  const laps = ['combined', 'tzukon'].map((k) => stats[k]).filter(Boolean);
  const ratio = laps.length ? laps.reduce((a, d) => a + d.laps / Math.max(1, d.average), 0) / laps.length : 0.8;
  const effort = Math.min(1, Math.max(0, (ratio - 0.6) / 0.5));
  const reports = laps.reduce((a, d) => a + d.reports, 0);
  const memory = reports ? laps.reduce((a, d) => a + d.correct, 0) / reports : 0.5;
  const stretcher = (stats.stretcher ?? []).reduce((a, r) => a + (r.rank <= 4 ? 1 : r.rank <= 6 ? 0.75 : 0.5) * (0.4 + 0.6 * r.held), 0) / Math.max(1, stats.stretcher?.length ?? 1);
  const dig = Math.min(1, (stats.dig?.perSecond ?? 0.5) / 1.6) * 0.7 + (state.digReaction ?? 0.5) * 0.3;
  const teamScore = 0.5 * (state.teamwork ?? 0.5) + 0.5 * (state.map ?? 0.5);
  const social = ((state.interview ?? 0.5) + (state.social ?? 0.5)) / 2;
  const total = 0.3 * effort + 0.15 * memory + 0.15 * stretcher + 0.15 * dig + 0.15 * teamScore + 0.1 * social - 0.03 * stats.stops;
  return { total, outcome: OUTCOMES.find((o) => total >= o.min) };
}

async function results(game) {
  const { ui, state, drills } = game;
  const stats = { ...(state.stats ?? {}), ...drills.stats };
  const { total, outcome } = outcomeFor(state, stats);
  const lines = [];
  if (stats.run) lines.push(['ריצת סף', `${formatTime(stats.run.time)} ${stats.run.passed ? '✓' : '✗'}`]);
  if (stats.combined) lines.push(['מקצה משולב', `${stats.combined.laps} סיבובים (ממוצע ${stats.combined.average})`]);
  if (stats.tzukon) lines.push(['צוקון', `${stats.tzukon.laps} סיבובים (ממוצע ${stats.tzukon.average})`]);
  const reports = ['combined', 'tzukon'].map((k) => stats[k]).filter(Boolean);
  if (reports.length) lines.push(['דיווח מספר וסיבוב', `${reports.reduce((a, d) => a + d.correct, 0)} נכונים מתוך ${reports.reduce((a, d) => a + d.reports, 0)}`]);
  if (stats.stretcher) lines.push(['אלונקה', stats.stretcher.map((r) => `מקום ${r.rank}`).join(', ')]);
  if (stats.dig) lines.push(['חפירה', `${stats.dig.actions} חפירות`]);
  if (state.map !== undefined) lines.push(['מפה', `${Math.round(state.map * 100)}% דיוק`]);
  if (stats.stops) lines.push(['עצירות', `${stats.stops} פעמים המגבש צעק`]);
  saveResults('yom-sayarot', { outcome: outcome.title, total });
  game.save('results');
  await ui.interlude('יום 3 · אחר הצהריים. הטלפון רוטט…', 2200);
  const choice = await resultsSms(ui, { bib: state.bib, outcome, lines });
  await ui.fact(FACTS.end.title, FACTS.end.points);
  if (choice === 'again') window.location.href = './?new=1';
  else window.location.href = '../main-screen/';
}

const HANDLERS = { arrive, run, night1, morning, dig, team, night2, home, results };

export async function runFlow(game, startStep = 'arrive') {
  let i = STEPS.indexOf(startStep);
  game.jumpTo = (step) => {
    i = STEPS.indexOf(step) - 1;
  };
  for (; i < STEPS.length; i++) {
    game.state.step = STEPS[i];
    await HANDLERS[STEPS[i]](game);
    game.state.stats = { ...(game.state.stats ?? {}), ...game.drills.stats };
  }
}
