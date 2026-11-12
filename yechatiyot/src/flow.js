import { SPOTS, DUNE, height } from '../../yom-sayarot/src/world.js';
import { gather, campLife } from '../../yom-sayarot/src/team.js';
import { loadResults, saveResults } from '../../shared/save.js';
import { unlock } from '../../shared/achievements.js';
import { dropOut } from './team.js';
import { BRIGADES, FACTS, SHEETS, INTERVIEW, ATOM, OUTCOMES } from './content.js';
import { weaponDrill, lecture, sociometric } from '../../gibbush-matkal/src/minigames.js';
import { quiz } from '../../naval/src/minigames.js';
import { brigadePicker, studySheets, resultParade } from './minigames.js';

// Week 1 of basic training → the threshold run → night 1 (from 22:30) → day/night 2 → night 3 with the team tasks,
// sociometric and interviews → the parade. Built on the Paratroopers account of 08.2026, the others for detail.
export const STEPS = ['arrive', 'threshold', 'night1', 'day2', 'night2', 'night3', 'results'];

// The game's own shortening: a few laps instead of 30-minute blocks (labelled in the drill box).
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

function toPit(game, staffPerson) {
  staffPerson.group.visible = true;
  staffPerson.place(-2, DUNE.startZ + 3, Math.PI).setPose('clipboard');
  gather(game.people.teammates.filter((p) => !p.info.out), 0, DUNE.startZ + 2, 0);
  game.player.teleport(-2, 6, 0.2);
  game.ui.setObjective('בבור החול', `${game.people.teammates.filter((p) => !p.info.out).length + 1} בצוות · מקשיבים למגבש`);
}

function relative(result) {
  if (!result) return 0.5;
  return Math.min(1, result.laps / Math.max(1, result.best));
}

const brigadeOf = (state) => BRIGADES[state.brigade] ?? BRIGADES.tzanhanim;

/** The quit offer at a low point. Returns true when the player quits (then the flow jumps to the results). */
async function lowPoint(game, text, options) {
  const { ui, state } = game;
  const c = await ui.talk('אני', text, options);
  if (c !== options.length - 1) return false;
  await ui.fact(FACTS.quit.title, FACTS.quit.points);
  state.quit = true;
  game.jumpTo('results');
  return true;
}

// ---------- Week 1 ----------

async function arrive(game) {
  const { ui, people, state, sky, player } = game;
  sky.setTime('day');
  game.setClock(1, 13 * 60);
  campLife(people.others);
  gather(people.teammates, SPOTS.arrival.x - 6, SPOTS.arrival.z + 2, -Math.PI / 2);
  player.teleport(SPOTS.arrival.x, SPOTS.arrival.z, Math.PI / 2 + 0.4);
  await ui.fadeIn();
  if (!state.brigade) state.brigade = await brigadePicker(ui);
  const b = brigadeOf(state);
  game.setDay(`טירונות · שבוע 1 · ${b.name}`);
  await ui.fact(FACTS.before.title, FACTS.before.points);

  const tzanhanim = loadResults('tzanhanim');
  const rasar = people.staff.rasar;
  await goTalk(game, rasar, 'rasar', 'גש למ״כ', `${b.base} · היום השלישי בטירונות`);
  await talkScene(game, rasar, async () => {
    await ui.talk(rasar.name, `מחלקה, הקשבה. בעוד יומיים גיבוש יחט״יות ל${b.sayeret}. כל מי שרוצה, נרשם אצלי. לפני זה בוחן סף.`);
    if (state.brigade === 'tzanhanim' && tzanhanim?.outcome?.includes('סימון')) {
      await ui.talk(rasar.name, 'ראיתי שיש לך סימון מהגיבוש לפני הגיוס. פה זה פחות משנה. מתחילים מאפס.');
      state.flagged = true;
    }
    const c = await ui.talk('אני', 'נרשמים?', ['נרשם', 'לא הפעם, נשאר בפלוגה']);
    if (c === 1) {
      await ui.talk(rasar.name, 'בסדר גמור. גם בגדוד צריך לוחמים טובים.');
      state.skipped = true;
    }
  });
  if (state.skipped) {
    game.save('arrive');
    game.jumpTo('results');
    return;
  }
  if (state.flagged) unlock('yechatiyot-flagged');
  game.save('arrive');
}

async function threshold(game) {
  const { ui, state, drills } = game;
  const b = brigadeOf(state);
  game.setClock(1, 15 * 60);
  ui.setObjective('בוחן סף', `${b.run.total.toLocaleString('en-US')} מ׳`);
  await ui.fact('בוחן הסף', [b.run.label, 'במשחק המרחק מקוצר והזמן מחושב לפי המרחק האמיתי.']);
  const run = await drills.thresholdRun({ title: 'בוחן סף · ריצה', total: b.run.total, limit: b.run.limit });
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  state.run = run;
  ui.announce(run.passed ? 'עברת את בוחן הסף' : 'לא עברת את בוחן הסף', `${fmt(run.time)} · הסף במשחק ${fmt(b.run.limit)}`);
  await game.wait(1.5);
  if (!run.passed) {
    state.thresholdFail = true;
    game.save('threshold');
    game.jumpTo('results');
    return;
  }
  game.save('threshold');
}

// ---------- Night 1 (the 08.2026 account) ----------

async function night1(game) {
  const { ui, sky, drills, state, people, player } = game;
  const guy = people.staff.guy;
  sky.setTime('dusk');
  game.setClock(1, 17 * 60);
  await ui.interlude('17:00 · שולחים לישון. אף אחד לא נרדם.', 2000);
  sky.setTime('night');
  game.setClock(1, 22 * 60 + 30);
  await ui.interlude('22:30 · אורות! בדיקת ציוד, מספרי צוות. ההלם של הלילה הראשון.', 2600);
  await ui.fact(FACTS.start.title, FACTS.start.points);
  game.setClock(2, 30);
  const medic = people.staff.medic;
  player.teleport(SPOTS.medic.x + 2, SPOTS.medic.z + 3, Math.PI);
  await goTalk(game, medic, 'medic', 'קח כובע ממוספר', '00:30 · ליד החובש');
  await talkScene(game, medic, async () => {
    await ui.talk(medic.name, `הכובע שלך: ${state.bib}. מעכשיו זה השם שלך. מי שמרגיש משהו בא אליי, לא מחכה.`);
    game.hud.setBib(state.bib);
  });
  game.setClock(2, 60);
  await talkScene(game, guy, () => ui.talk(guy.name, 'שני דפים. טקסט ומפה. יהיה מבחן. לא אגיד מתי.'));
  await studySheets(ui, 40);

  game.setClock(2, 90);
  toPit(game, guy);
  await talkScene(game, guy, () => ui.talk(guy.name, 'סדרי הגעה. זחילה לאורך הבור, ומסתדרים בשורה לפי מי שהגיע. מספר וסבב אחרי כל אחד.'));
  await ui.fact(FACTS.order.title, FACTS.order.points);
  const crawl = await drills.lapDrill('combined', 140, guy.name, { stopAt: LAPS.short, title: 'סדרי הגעה · זחילה' });
  ui.announce(`${crawl.laps} סבבים`, `הראשון בצוות: ${crawl.best}`);
  const water = await ui.talk(guy.name, 'כולם: לשפוך את המים מהמימייה. להחזיק אותה הפוכה מעל הראש. עכשיו.', ['שופך הכל ומחזיק הפוכה', 'משאיר קצת בתחתית, אף אחד לא יבדוק']);
  state.water = water === 0 ? 1 : 0.2;
  if (water === 1) await ui.talk(guy.name, `${state.bib}. המימייה שלך מטפטפת לך על הכובע.`);

  game.setClock(2, 2 * 60 + 15);
  await talkScene(game, guy, () => ui.talk(guy.name, 'ספרינטים. אותו דבר. שורה לפי סדר הגעה.'));
  const sprint = await drills.lapDrill('sprint', 110, guy.name, { stopAt: LAPS.short, title: 'סדרי הגעה · ספרינט' });
  ui.announce(`${sprint.laps} סבבים`, `הראשון: ${sprint.best}`);
  const cheater = people.teammates.find((p) => p.info.trait === 'cheater');
  if (cheater) {
    const c = await ui.talk('אני', `בקו צפוף. ${cheater.name} נדחף לשורה לפניך, למרות שהגעת לפניו.`, [
      'זז הצידה מהר ומסתדר במקום הנכון שלי',
      'דוחף אותו בחזרה',
      'נשאר מאחוריו, לא שווה ריב',
    ]);
    state.line = [1, 0.3, 0.6][c];
  }

  game.setClock(2, 3 * 60);
  const a = await ui.talk(guy.name, 'כובעים על הפנים. מתפזרים בבור. בלי לראות, יוצרים את האות A. יש לכם שלוש דקות.', [
    'מתחיל לספור בקול ומציע שכל אחד יגיד איפה הוא',
    'מחכה שמישהו ימשוך אותי',
    'מוריד קצת את הכובע כדי לראות',
  ]);
  state.letterA = [1, 0.5, 0][a];
  if (a === 2) await ui.talk(guy.name, `${state.bib}. ראיתי. כובע על הפנים.`);
  else await ui.talk(guy.name, 'זמן. זה לא A, אבל ראיתי מי דיבר ומי סידר.');

  game.setClock(2, 4 * 60);
  await ui.fact(FACTS.march.title, FACTS.march.points);
  await talkScene(game, guy, () => ui.talk(guy.name, 'מסע. כשאני מרים יד יש לכם עשר שניות להגיע אליי. מי שלא, חוזרים על הקטע. ואף אחד לא עוזב את האלונקה.'));
  await drills.stretcherDrill(1, guy.name);
  const hider = people.teammates.find((p) => p.info.trait === 'hider');
  if (hider) {
    const c = await ui.talk('אני', `היד של המגבש למעלה. ${hider.name} רץ קדימה לבד ומשאיר את האלונקה עם ארבעה.`, [
      'נשאר על האלונקה ודוחף איתה קדימה',
      'רץ קדימה גם, להספיק בעשר שניות',
      `צועק על ${hider.name} שיחזור`,
    ]);
    state.march1 = [1, 0.2, 0.6][c];
  }
  if (await lowPoint(game, '05:30 · הרגליים לא שלך. שמעת שבצוות השכן כבר שישה פרשו. אומרים שמספיק להגיד למגבש.', ['נושם. הולך לאוהל לישון', 'אומר למגבש שאני פורש'])) {
    game.save('night1');
    return;
  }
  const gone = dropOut(people, ['quitter']);
  if (gone.length) ui.toast(`מהצוות פרשו הלילה: ${gone.map((p) => p.name).join(', ')}`, 3600);
  await ui.fact(FACTS.sleep.title, FACTS.sleep.points);
  await ui.interlude('06:00 · אוהל לבן. נרדמים לפני שהגב נוגע ברצפה.', 2400);
  game.save('night1');
}

// ---------- Day 2 ----------

async function day2(game) {
  const { ui, sky, state, people, player } = game;
  const guy = people.staff.guy;
  sky.setTime('day');
  game.setClock(2, 15 * 60);
  await ui.interlude('15:00 · קמים. מנות קרב ולחם, בעמידה.', 2000);
  const food = await ui.talk('אני', 'נשארו שתי פחיות טונה ופותחן אחד. חצי מהצוות עוד ישן.', ['פותח, מחלק לכולם ומעיר את מי שישן', 'אוכל מהר לפני שייגמר', 'מחכה שמישהו אחר יחלק']);
  state.food = [1, 0.1, 0.5][food];

  game.setClock(2, 16 * 60);
  toPit(game, guy);
  const loud = people.teammates.find((p) => p.info.trait === 'loud');
  await talkScene(game, guy, async () => {
    await ui.talk(guy.name, 'רואים את המכולה? מרימים אותה ומעבירים לקו. יש לכם שתי דקות.');
    if (loud) await ui.talk(loud.name, 'כולם, תקשיבו לי! אני מחליט!');
    const c = await ui.talk('אני', 'שתי דקות, אין סיכוי. כולם צועקים מי מוביל.', [
      'מציע שמי שהציע קודם יוביל, ונכנס להרים',
      'מתווכח עם גל מי צודק',
      'הולך לצד ומחכה',
    ]);
    state.lift = [1, 0.3, 0.1][c];
    await ui.talk(guy.name, 'זמן. לא הגעתם. לא משנה. ראיתי מה שהייתי צריך.');
  });

  game.setClock(2, 18 * 60);
  await talkScene(game, guy, () => ui.talk(guy.name, 'פירוק נשק. פעם אחת אני מראה, אחר כך על זמן.'));
  const slow = await weaponDrill(ui, 'm16', 'slow');
  let personal = 0;
  const timed = await weaponDrill(ui, 'm16', 'timed');
  await talkScene(game, guy, async () => {
    const c1 = await ui.talk(guy.name, 'תוך כדי שאתה מרכיב: מה מספר הטלפון שלך?', ['אומר אותו', 'מתבלבל ונעצר']);
    const c2 = await ui.talk(guy.name, 'עכשיו מהסוף להתחלה.', ['מנסה לאט, ספרה אחרי ספרה', 'אומר "אני לא יכול"']);
    personal = (c1 === 0 ? 0.5 : 0.2) + (c2 === 0 ? 0.5 : 0);
  });
  state.weapon = [slow, timed];
  state.underPressure = personal;
  sky.setTime('dusk');
  game.setClock(2, 21 * 60);
  player.teleport(SPOTS.camp.x + 6, SPOTS.camp.z - 6, Math.PI);
  await ui.interlude('21:00 · אוהל סיירים. יש שעתיים וחצי. או פחות.', 2200);
  game.save('day2');
}

// ---------- Night 2 ----------

async function night2(game) {
  const { ui, sky, drills, state, people } = game;
  const guy = people.staff.guy;
  sky.setTime('night');
  game.setClock(2, 23 * 60 + 40);
  await ui.interlude('23:40 · שריקה! נעליים, ווסט, לבור!', 2200);
  toPit(game, guy);
  await talkScene(game, guy, () => ui.talk(guy.name, 'זחילה. סדרי הגעה.'));
  const crawl = await drills.lapDrill('combined', 120, guy.name, { stopAt: LAPS.short, title: 'סדרי הגעה · זחילה' });
  ui.announce(`${crawl.laps} סבבים`, `הראשון: ${crawl.best}`);

  game.setClock(3, 30);
  await talkScene(game, guy, () => ui.talk(guy.name, 'אלונקה סוציומטרית. ספרינט לקונוס וחזרה. השישה הראשונים לוקחים את האלונקה לסבב הבא.'));
  await drills.stretcherDrill(2, guy.name);

  game.setClock(3, 90);
  await talkScene(game, guy, () => ui.talk(guy.name, 'צוקון. שק על הגב, עד הקונוס למעלה וחזרה. מספר וסבב.'));
  const tz1 = await drills.lapDrill('tzukon', 150, guy.name, { stopAt: LAPS.long, title: 'צוקון' });
  ui.announce(`צוקון: ${tz1.laps} סבבים`, `הראשון: ${tz1.best}`);
  await ui.fact(FACTS.tzukon.title, FACTS.tzukon.points);
  await talkScene(game, guy, () => ui.talk(guy.name, 'עוד פעם. אותו צוקון.'));
  if (await lowPoint(game, 'עוד פעם?! עכשיו? הראש אומר די. שניים מהצוות כבר יושבים בצד.', ['קם, לוקח את השק', 'יושב בצד ואומר שאני פורש'])) {
    game.save('night2');
    return;
  }
  const tz2 = await drills.lapDrill('tzukon', 150, guy.name, { stopAt: LAPS.long, title: 'צוקון · פעם שנייה' });
  state.tzukon2 = relative(tz2);
  ui.announce(`צוקון: ${tz2.laps} סבבים`, `הראשון: ${tz2.best}`);
  const gone = dropOut(people, ['loud']);
  if (gone.length) ui.toast(`פרש בצוקון השני: ${gone.map((p) => p.name).join(', ')}`, 3200);

  game.setClock(3, 3 * 60 + 30);
  await ui.interlude('הרצאות. כל אחד הכין שני נושאים.', 1600);
  state.lecture = await lecture(ui, guy.name);
  await talkScene(game, guy, () => ui.talk(guy.name, 'מבחן על הדפים מהלילה הראשון. עכשיו.'));
  state.sheets = await quiz(ui, { eyebrow: 'מבחן על הדפים', questions: SHEETS.questions, seconds: 60 });
  ui.announce(`הדפים: ${Math.round(state.sheets * 100)}%`);

  game.setClock(3, 4 * 60 + 30);
  await talkScene(game, guy, () => ui.talk(guy.name, 'מסע שני. אותם חוקים. יד למעלה, עשר שניות.'));
  await drills.stretcherDrill(1, guy.name);
  await ui.interlude('07:00 · שינה. עד הצהריים.', 2200);
  game.save('night2');
}

// ---------- Night 3: team tasks, sociometric, interviews ----------

async function night3(game) {
  const { ui, sky, drills, state, people, player } = game;
  const guy = people.staff.guy;
  const leader = people.teammates.find((p) => p.info.trait === 'leader');
  sky.setTime('dusk');
  game.setClock(3, 18 * 60);
  toPit(game, guy);
  await ui.fact(FACTS.team.title, FACTS.team.points);
  const knot = await ui.talk(guy.name, 'הידיים של כולם על החבל. לקשור קשר בלי שאף יד עוזבת. דקה וחצי.', [
    'מציע שקודם מדברים על התוכנית, ואז זזים יחד',
    'מתחיל למשוך לכיוון שנראה לי',
    'מחכה שמישהו יגיד מה לעשות',
  ]);
  state.knot = [1, 0.4, 0.4][knot];

  sky.setTime('night');
  game.setClock(3, 20 * 60);
  await talkScene(game, guy, async () => {
    await ui.talk(guy.name, ATOM.intro);
    if (leader) await ui.talk(leader.name, 'רגע. בואו נחליט קודם לפי מה בוחרים.');
    const c = await ui.talk('אני', 'מה אתה עושה בדיון?', ATOM.choices);
    state.atom = ATOM.scores[c];
    await ui.talk(guy.name, 'זמן. רשמתי מי דיבר ואיך.');
  });

  game.setClock(3, 21 * 60);
  await talkScene(game, guy, () => ui.talk(guy.name, 'כולם לקו של הבור! ספרינט! נראה מי נשבר.'));
  const last = await drills.lapDrill('sprint', 90, guy.name, { stopAt: LAPS.short, title: 'ספרינט · "נראה מי נשבר"' });
  state.lastBlock = relative(last);
  drills.resetBody?.();
  game.hud.setDrill(null, '');
  ui.announce('תם החלק הפיזי', 'חוזרים לאוהל');

  game.setClock(3, 22 * 60);
  await ui.fact(FACTS.end.title, FACTS.end.points);
  state.socio = await sociometric(ui, people.teammates, 1);
  const circle = SPOTS.circle;
  guy.place(circle.x, circle.z - 2, 0).setPose('stand');
  player.teleport(circle.x + 5, circle.z + 5, Math.PI / 4);
  ui.setObjective('גש לראיון', 'מול מגבש אחד');
  game.setTarget(groundTarget(circle));
  await game.waitZone(near(circle, 4));
  game.setTarget(null);
  let score = 0;
  await talkScene(game, guy, async () => {
    for (const item of INTERVIEW) {
      const c = await ui.talk(guy.name, item.q, item.choices);
      score += item.scores[c];
    }
    await ui.talk(guy.name, 'תודה. לך לישון.');
  });
  state.interview = score / (INTERVIEW.length * 2);
  game.save('night3');
}

// ---------- Scores ----------

function physical(state, stats) {
  const drills = ['combined', 'sprint', 'tzukon'].map((k) => stats[k]).filter(Boolean);
  const rel = drills.length ? drills.reduce((a, d) => a + relative(d), 0) / drills.length : 0.6;
  const stretcher = (stats.stretcher ?? []).reduce((a, r) => a + (r.rank <= 6 ? 1 : r.rank <= 8 ? 0.75 : 0.5) * (0.4 + 0.6 * r.held), 0) / Math.max(1, stats.stretcher?.length ?? 1);
  const extra = [state.tzukon2, state.lastBlock].filter((v) => v !== undefined);
  const later = extra.length ? extra.reduce((a, b) => a + b, 0) / extra.length : rel;
  return Math.max(0, Math.min(1, 0.45 * rel + 0.25 * (stats.stretcher ? stretcher : 0.6) + 0.3 * later - Math.min(0.3, 0.03 * (stats.stops ?? 0))));
}

function team(state) {
  const parts = [state.socio, state.water, state.line, state.letterA, state.march1, state.food, state.lift, state.knot, state.atom].filter((v) => v !== undefined);
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0.5;
}

function head(state) {
  const w = state.weapon ?? [];
  const weapon = w.length ? w.reduce((a, r) => a + (r.done ? Math.max(0.3, 1 - r.errors * 0.15) : 0.2), 0) / w.length : 0.5;
  return 0.35 * (state.sheets ?? 0.5) + 0.3 * weapon + 0.15 * (state.underPressure ?? 0.5) + 0.2 * (state.lecture ?? 0.5);
}

/** The game's own weights: no source gives them. */
function totalScore(state, stats) {
  return 0.35 * physical(state, stats) + 0.3 * team(state) + 0.15 * head(state) + 0.2 * (state.interview ?? 0.5);
}

const SAYERET_LINE = 0.66; // The game's own line.

function outcomeFor(state, stats) {
  const b = brigadeOf(state);
  if (state.skipped) return { ...OUTCOMES.battalion(b), title: 'נשארת בפלוגה', detail: `לא נרשמת לגיבוש. ממשיכים בטירונות וב${b.battalions}.` };
  if (state.thresholdFail) return OUTCOMES.threshold(b);
  if (state.quit) return OUTCOMES.quit(b);
  state.total = totalScore(state, stats);
  return state.total >= SAYERET_LINE ? OUTCOMES.sayeret(b) : OUTCOMES.battalion(b);
}

async function results(game) {
  const { ui, state, drills, sky } = game;
  const b = brigadeOf(state);
  const stats = { ...(state.stats ?? {}), ...drills.stats };
  const outcome = outcomeFor(state, stats);
  const finished = !state.skipped && !state.thresholdFail && !state.quit;
  const pct = (v) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
  const lines = [];
  if (finished) {
    lines.push(['פיזי (סדרי הגעה, אלונקה, צוקון)', pct(physical(state, stats))]);
    lines.push(['צוות וסוציומטרי', pct(team(state))]);
    lines.push(['ראש (דפים, נשק, הרצאה)', pct(head(state))]);
    lines.push(['ראיון', pct(state.interview ?? 0.5)]);
  }
  saveResults('yechatiyot', { outcome: outcome.title, brigade: state.brigade, total: state.total ?? 0 });
  if (finished) {
    unlock('yechatiyot-done');
    if (outcome.title === b.sayeret) unlock('yechatiyot-sayeret');
    if (state.water === 1 && (state.line ?? 1) >= 1) unlock('yechatiyot-honest');
  }
  game.save('results');
  sky.setTime('day');
  const time = finished ? (state.brigade === 'tzanhanim' ? 'ארבעה ימים אחרי' : 'למחרת בבוקר') : state.quit ? 'באותו בוקר, בפלוגה' : 'בפלוגה';
  if (finished) await ui.interlude(`${time} · כל המתגבשים במסדר. מפקד הגיבוש מחזיק דף.`, 2600);
  const readOut = [];
  if (finished) {
    const places = [b.sayeret, 'לגדוד', b.sayeret, 'לגדוד', 'לגדוד', b.sayeret, 'לגדוד', 'לגדוד'];
    const numbers = new Set();
    while (numbers.size < places.length) numbers.add(String(100 + Math.floor(Math.random() * 400)));
    [...numbers].sort((x, y) => Number(x) - Number(y)).forEach((n, i) => readOut.push([n, places[i]]));
    readOut.push([state.bib, outcome.title]);
    readOut.sort((x, y) => Number(x[0]) - Number(y[0]));
  }
  const choice = await resultParade(ui, { bib: state.bib ?? '—', outcome, lines, next: null, time, readOut });
  if (finished) await ui.fact(FACTS.changes.title, FACTS.changes.points);
  await ui.fact(FACTS.women.title, FACTS.women.points);
  if (choice === 'again') {
    unlock('persistence');
    window.location.href = './?new=1';
  } else window.location.href = '../main-screen/';
}

const HANDLERS = { arrive, threshold, night1, day2, night2, night3, results };

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
