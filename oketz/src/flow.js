import { SPOTS, DUNE, height } from '../../yom-sayarot/src/world.js';
import { gather } from '../../yom-sayarot/src/team.js';
import { saveResults } from '../../shared/save.js';
import { unlock } from '../../shared/achievements.js';
import { dropOut, setGender } from './team.js';
import { g, FACTS, PERSONALITY, STATIONS, LECTURE_NOTE, INTERVIEW, OUTCOMES } from './content.js';
import { weaponDrill, lecture, sociometric } from '../../gibbush-matkal/src/minigames.js';
import { quiz } from '../../naval/src/minigames.js';
import { minefield } from '../../tzanhanim/src/minigames.js';
import { answerPhone } from '../../pilot-path/shared/panels.js';

// Two routes. Men: Modi'in → cut run → three days at Mitkan Adam (03.2025 account, with 2020–2024 for detail).
// Women: basic training → Bar-Or grouping → about 42 hours at Mitkan Adam (08.2024 and 03.2021 accounts).
export const STEPS = ['choose', 'arrive', 'run', 'night1', 'day2', 'day3', 'results'];

const LAPS = { short: 3, long: 4 };
const groundTarget = (spot, extra = 2.2) => ({ x: spot.x, y: height(spot.x, spot.z) + extra, z: spot.z });
const near = (spot, r) => (p) => Math.hypot(p.x - spot.x, p.z - spot.z) < r;
const F = (state) => state.gender === 'f';

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

function toPit(game, staffPerson) {
  staffPerson.group.visible = true;
  staffPerson.place(-2, DUNE.startZ + 3, Math.PI).setPose('clipboard');
  gather(game.people.teammates.filter((p) => !p.info.out), 0, DUNE.startZ + 2, 0);
  game.player.teleport(-2, 6, 0.2);
  game.ui.setObjective('בבור החול', 'מקשיבים למגבש');
}

const relative = (r) => (r ? Math.min(1, r.laps / Math.max(1, r.best)) : 0.5);
const pick = async (game, speaker, text, choices, scores, key) => {
  const c = await game.ui.talk(speaker, text, choices);
  game.state[key] = scores[c];
  return c;
};

// ---------- Choose the route ----------

async function choose(game) {
  const { ui, state, sky, player } = game;
  sky.setTime('day');
  player.teleport(SPOTS.arrival.x, SPOTS.arrival.z, Math.PI / 2 + 0.4);
  await ui.fadeIn();
  await ui.fact(FACTS.unit.title, FACTS.unit.points);
  if (!state.gender) {
    const c = await ui.talk('', 'באיזה מסלול מגיעים לגיבוש עוקץ?', ['לוחם: גיבוש של שלושה ימים לפני הגיוס, במרץ', 'לוחמת: דרך גדוד גבול, גיבוש של יומיים בטירונות']);
    state.gender = c === 1 ? 'f' : 'm';
  }
  setGender(game.people, state.gender);
  await ui.fact(F(state) ? FACTS.routeF.title : FACTS.routeM.title, F(state) ? FACTS.routeF.points : FACTS.routeM.points);
  game.save('choose');
}

// ---------- Arrive ----------

async function arrive(game) {
  const { ui, state, people, player } = game;
  const medic = people.staff.medic;
  game.people.staff.rasar.group.visible = F(state);
  if (F(state)) {
    game.setClock(1, 3 * 60);
    game.setDay('טירונות · גדוד גבול');
    await ui.interlude('03:00 · השכמה בבסיס. אוטובוסים למתקן אדם. אף אחת לא מדברת.', 2600);
  } else {
    game.setClock(1, 8 * 60 + 30);
    game.setDay('מרץ · י״ב');
    await ui.interlude('08:30 · פארק ענבה, מודיעין. כ־200 מתגבשים עם תיקים גדולים.', 2600);
  }
  player.teleport(SPOTS.medic.x + 2, SPOTS.medic.z + 3, Math.PI);
  ui.setObjective('גש/י לחובש', 'רישום ומספר');
  game.setTarget(() => ({ x: medic.position.x, y: medic.position.y + 2.3, z: medic.position.z }));
  await game.waitInteract('medic');
  await talkScene(game, medic, async () => {
    await ui.talk(medic.name, `אישור רפואי? ${g(state, 'תודה', 'תודה')}. המספר: ${state.bib}.`);
    game.hud.setBib(state.bib);
  });
  game.save('arrive');
}

async function run(game) {
  const { ui, state, drills } = game;
  const f = F(state);
  await ui.fact(f ? FACTS.runF.title : FACTS.runM.title, f ? FACTS.runF.points : FACTS.runM.points);
  const total = f ? 3000 : 2000;
  const limit = f ? 20 * 60 + 20 : 10 * 60;
  const r = await drills.thresholdRun({ title: f ? 'בוחן בר־אור · ריצה' : 'ריצת ניפוי', total, limit });
  state.run = r;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  ui.announce(r.passed ? 'עברת' : 'מעל הסף', `${fmt(r.time)} · הסף ${fmt(limit)}`);
  await game.wait(1.4);
  if (!r.passed && !f) {
    await ui.interlude('מקריאים מספרים. המספר שלך לא מוקרא.', 2400);
    state.runFail = true;
    game.save('run');
    game.jumpTo('results');
    return;
  }
  if (!r.passed && f) ui.toast('בבר־אור זה לא ניפוי: מחלקים לקבוצות לפי הזמנים.', 3200);
  game.save('run');
}

// ---------- Night 1 ----------

async function night1(game) {
  const { ui, sky, drills, state, people } = game;
  const guy = people.staff.guy;
  const f = F(state);
  sky.setTime(f ? 'night' : 'dusk');
  game.setClock(1, f ? 23 * 60 + 50 : 18 * 60);
  if (f) {
    await ui.fact(FACTS.womenDays.title, FACTS.womenDays.points);
    await ui.interlude('ערב: לישון מוקדם. 02:00 · השכמה. שתי פרוסות לחם, ולבור.', 2600);
    toPit(game, guy);
    await talkScene(game, guy, () => ui.talk(guy.name, 'ג׳ריקנים. 30 מטר הלוך וחזור, מלאים. מספר וסבב אחרי כל אחד.'));
    const jr = await drills.lapDrill('kitbag', 120, guy.name, { stopAt: LAPS.short, title: 'ג׳ריקנים · 30 מ׳' });
    ui.announce(`${jr.laps} סבבים`, `הראשונה: ${jr.best}`);
    const tent = await ui.talk(guy.name, 'אוהל. שלוש דקות לתכנן, ארבע לבנות. מתחילות.', ['מציעה חלוקה: שתיים על היתדות, שתיים על המוטות, אחת סופרת זמן', 'מתחילה למתוח בד לבד', 'מחכה שמישהי תגיד מה לעשות']);
    state.tent = [1, 0.4, 0.3][tent];
    await ui.talk(guy.name, 'זמן. לא סיימתן. זה לא היה העניין.');
    await talkScene(game, guy, async () => {
      await ui.talk(guy.name, 'סירה עם מקום לשבע. אתן עשר. תחליטו מי נשארת בחוץ. פה אחד. חמש דקות.');
      await pick(game, 'אני', 'הדיון מתחמם. מה את עושה?', ['מציעה קודם לסכם לפי מה מחליטים, ואז כל אחת מדברת דקה', 'מתעקשת על ההצעה שלי', 'שותקת עד שזה נגמר'], [1, 0.4, 0.2], 'boat');
      await ui.talk(guy.name, 'זמן. אין פה אחד. רשמתי מי דיברה ואיך.');
    });
    await talkScene(game, guy, () => ui.talk(guy.name, 'אלונקה. ספרינט לקונוס וחזרה. היעד: 20 שניות. ארבע הראשונות לוקחות את האלונקה.'));
    await drills.stretcherDrill(2, guy.name);
    await pick(game, guy.name, 'רשת חבלים בין העמודים. כל אחת עוברת בלי לגעת. נגיעה = כולן שכיבות סמיכה.', ['עוברת לאט ומבקשת שיכוונו אותי', 'עוברת מהר, אולי לא יראו אם אגע', 'עוזרת להרים את הבאה בתור, ועוברת אחרונה'], [0.8, 0.2, 1], 'web');
    await talkScene(game, guy, () => ui.talk(guy.name, 'זחילה עם שק. גוררות אותו עד הקו וחוזרות. מספר וסבב.'));
    const cr = await drills.lapDrill('combined', 150, guy.name, { stopAt: LAPS.long, title: 'זחילה עם שק' });
    ui.announce(`${cr.laps} סבבים`, `הראשונה: ${cr.best}`);
  } else {
    await ui.interlude('אוטובוס למתקן אדם. שאלון אישיות על הברכיים.', 2200);
    let p = 0;
    for (const item of PERSONALITY) {
      const c = await ui.talk('שאלון', item.q, item.choices);
      p += item.scores[c];
    }
    state.personality = p / PERSONALITY.length;
    await ui.fact(FACTS.night.title, FACTS.night.points);
    sky.setTime('night');
    game.setClock(1, 21 * 60);
    toPit(game, guy);
    await ui.interlude('כושר דינמי. שכיבות סמיכה, כפיפות בטן, "עוד אחד!"', 1800);
    await talkScene(game, guy, () => ui.talk(guy.name, 'זחילות. הראשון ל־50 סבבים עוצר את כולם. סדרי הגעה.'));
    const cr = await drills.lapDrill('combined', 140, guy.name, { stopAt: LAPS.short, title: 'זחילות · "הראשון ל־50"' });
    ui.announce(`${cr.laps} סבבים`, 'אף אחד לא הגיע ל־50. בעדות מ־2020 הגיעו ל־6–8.');
    await talkScene(game, guy, () => ui.talk(guy.name, 'ספרינטים. אותו דבר.'));
    const sp = await drills.lapDrill('sprint', 100, guy.name, { stopAt: LAPS.short, title: 'ספרינטים' });
    ui.announce(`${sp.laps} סבבים`, `הראשון: ${sp.best}`);
    await talkScene(game, guy, () => ui.talk(guy.name, 'פירוק נשק. מהר.'));
    state.weapon = [await weaponDrill(ui, 'm16', 'timed')];
  }
  const c = await ui.talk('אני', g(state, '01:30 · החול בכל מקום. אחד מהצוות אומר שהוא הולך לבקש לצאת. "בוא איתי, אין טעם".', '05:00 · הידיים שרוטות מהשק. אחת אומרת שהיא הולכת לבקש לצאת. "בואי איתי".'), [g(state, 'לא. נשאר', 'לא. נשארת'), g(state, 'הולך איתו', 'הולכת איתה')]);
  if (c === 1) {
    await ui.fact('מי שפורש/ת', ['לפי העדויות פורשים לאורך כל הגיבוש: מכ־200 שהתחילו ב־2025 סיימו כ־90.', 'לא נמצא מקור שמתאר טקס פרישה.']);
    state.quit = true;
    game.jumpTo('results');
    game.save('night1');
    return;
  }
  const gone = dropOut(game.people, ['quitter']);
  if (gone.length) ui.toast(`${g(state, 'פרש', 'פרשה')}: ${gone.map((p) => p.name).join(', ')}`, 3000);
  game.save('night1');
}

// ---------- Day 2 ----------

async function day2(game) {
  const { ui, sky, drills, state, people, player } = game;
  const guy = people.staff.guy;
  const f = F(state);
  sky.setTime('dawn');
  if (f) {
    game.setClock(1, 6 * 60);
    await talkScene(game, guy, () => ui.talk(guy.name, 'ספרינט בחול ים. אחר כך הרצאה. שלוש דקות, מול כולן, עם הזריחה.'));
    const sp = await drills.lapDrill('sprint', 100, guy.name, { stopAt: LAPS.short, title: 'ספרינטים בחול ים' });
    ui.announce(`${sp.laps} סבבים`, `הראשונה: ${sp.best}`);
    state.lecture = await lecture(ui, guy.name);
    sky.setTime('day');
    game.setClock(1, 9 * 60);
    await talkScene(game, guy, () => ui.talk(guy.name, 'מרוץ M16. פירוק והרכבה, על זמן.'));
    state.weapon = [await weaponDrill(ui, 'm16', 'timed'), await weaponDrill(ui, 'm16', 'pressure')];
    state.socio = await sociometric(ui, people.teammates, 1);
    await interview(game);
    await ui.interlude('11:00 · אוטובוס בחזרה לבסיס. 42 שעות, כמו שכתבה מתגבשת מ־2023.', 2600);
    game.save('day2');
    game.jumpTo('results');
    return;
  }
  game.setClock(2, 6 * 60);
  toPit(game, guy);
  await ui.fact(FACTS.day2.title, FACTS.day2.points);
  await talkScene(game, guy, () => ui.talk(guy.name, 'אלונקה סוציומטרית. הארבעה הראשונים לוקחים. היעד: 25 שניות.'));
  await drills.stretcherDrill(2, guy.name);
  await pick(game, guy.name, 'אוהל ענק. לכל הצוות. יש לכם עשר דקות.', ['לוקח צד אחד ומסדר אותו עם שניים', 'מנסה לנהל את כולם', 'מחכה בצד'], [1, 0.5, 0.2], 'tent');
  sky.setTime('day');
  game.setClock(2, 9 * 60);
  const mine = await minefield(ui, { eyebrow: 'שדה מוקשים · להביא את הג׳ריקן (לפי העדות מ־03.2025)', note: 'הלוח של המשחק. בעדות לא מפורט איך נראה השדה.' });
  state.mines = mine.solved ? (mine.attempts === 1 ? 1 : 0.7) : 0.3;
  await talkScene(game, guy, () => ui.talk(guy.name, 'משולש של 63 שקים. כל הצוות. מתחילים.'));
  await drills.pyramid();
  ui.announce('המשולש עומד');
  await ui.interlude('הליכת חקלאי: שני ג׳ריקנים, עד הקונוס וחזרה. שוב.', 1800);
  game.setClock(2, 12 * 60);
  await ui.fact('הרצאה', [LECTURE_NOTE]);
  state.lecture = await lecture(ui, guy.name);
  game.setClock(2, 15 * 60);
  toPit(game, guy);
  await talkScene(game, guy, () => ui.talk(guy.name, 'בור. זחילות וספרינטים. בסוף הבלוק יהיו מספרים שלא ימשיכו.'));
  const pit = await drills.lapDrill('combined', 120, guy.name, { stopAt: LAPS.short, title: 'בור החול' });
  state.pit = relative(pit);
  const out = dropOut(people, ['loud', 'cheater']);
  if (out.length) ui.toast(`נופו מהצוות: ${out.map((p) => p.name).join(', ')}`, 3200);
  if (state.pit < 0.5 && Math.random() < 0.5) {
    state.cut = true;
    await ui.interlude(`המגבש מקריא מספרים. ${state.bib} ביניהם. "תודה, אתם יכולים ללכת."`, 2600);
    game.save('day2');
    game.jumpTo('results');
    return;
  }
  sky.setTime('dusk');
  game.setClock(2, 18 * 60);
  await pick(game, guy.name, 'עיניים מכוסות. חבל אחד. יוצרים אות A, ואז מסתדרים לפי גובה. בלי לראות.', ['מציע שכל אחד יגיד את הגובה שלו בקול', 'מחכה שיזיזו אותי', 'מרים קצת את הכיסוי'], [1, 0.5, 0], 'blind');
  const silent = await ui.talk(guy.name, 'מסדר שקט. אף מילה. ... מי דיבר עכשיו?', ['מרים יד: אני לחשתי משהו לבן הזוג', 'שותק, לא דיברתי', 'שותק, למרות שלחשתי']);
  state.silent = [1, 1, 0][silent];
  if (silent === 0) await ui.talk(guy.name, 'תודה. עשר שכיבות סמיכה, ותודה שאמרת.');
  game.save('day2');
}

// ---------- Day 3 (men) ----------

async function day3(game) {
  const { ui, sky, drills, state, people } = game;
  const guy = people.staff.guy;
  sky.setTime('dawn');
  game.setClock(3, 5 * 60 + 30);
  toPit(game, guy);
  await ui.fact(FACTS.day3.title, FACTS.day3.points);
  await talkScene(game, guy, () => ui.talk(guy.name, 'ספרינט, ובסוף הקו הרכבת נשק. מי שמסיים ראשון לוקח את הסבב.'));
  await drills.lapDrill('sprint', 80, guy.name, { stopAt: LAPS.short, title: 'ספרינט + הרכבה' });
  state.weapon = [...(state.weapon ?? []), await weaponDrill(ui, 'm16', 'pressure')];
  sky.setTime('day');
  game.setClock(3, 8 * 60);
  state.socio = await sociometric(ui, people.teammates, 1);
  state.stations = await quiz(ui, { eyebrow: 'תחנות חשיבה (של המשחק)', questions: STATIONS, seconds: 90 });
  ui.announce(`תחנות: ${Math.round(state.stations * 100)}%`);
  await interview(game);
  game.save('day3');
}

async function interview(game) {
  const { ui, state, people, player } = game;
  const guy = people.staff.guy;
  const circle = SPOTS.circle;
  guy.place(circle.x, circle.z - 2, 0).setPose('stand');
  player.teleport(circle.x + 5, circle.z + 5, Math.PI / 4);
  ui.setObjective(g(state, 'גש לראיון', 'גשי לראיון'), 'לפי העדות מ־2023 שואלים גם "למה עוקץ?"');
  game.setTarget(groundTarget(circle));
  await game.waitZone(near(circle, 4));
  game.setTarget(null);
  let s = 0;
  await talkScene(game, guy, async () => {
    for (const item of INTERVIEW) {
      const c = await ui.talk(guy.name, item.q(state), item.choices);
      s += item.scores[c];
    }
    if (!F(state)) {
      const c = await ui.talk(guy.name, 'ההורים תומכים בזה שאתה הולך לקרבי?', ['כן. דיברנו הרבה', 'לא כל כך, אבל זו ההחלטה שלי', 'לא שאלתי אותם']);
      s += [2, 1.5, 0.4][c];
    }
    await ui.talk(guy.name, g(state, 'תודה. אל תחכה לתשובה היום.', 'תודה. אל תחכי לתשובה היום.'));
  });
  state.interview = s / ((INTERVIEW.length + (F(state) ? 0 : 1)) * 2);
}

// ---------- Scores and results ----------

function scores(state, stats) {
  const laps = ['combined', 'sprint', 'kitbag', 'tzukon'].map((k) => stats[k]).filter(Boolean);
  const rel = laps.length ? laps.reduce((a, d) => a + relative(d), 0) / laps.length : 0.6;
  const stretcher = (stats.stretcher ?? []).reduce((a, r) => a + (r.rank <= 4 ? 1 : r.rank <= 6 ? 0.75 : 0.5) * (0.4 + 0.6 * r.held), 0) / Math.max(1, stats.stretcher?.length ?? 1);
  const physical = Math.max(0, Math.min(1, 0.65 * rel + 0.35 * (stats.stretcher ? stretcher : 0.6) - Math.min(0.3, 0.03 * (stats.stops ?? 0))));
  const teamParts = [state.socio, state.tent, state.boat, state.web, state.mines, state.blind, state.silent].filter((v) => v !== undefined);
  const team = teamParts.length ? teamParts.reduce((a, b) => a + b, 0) / teamParts.length : 0.5;
  const w = state.weapon ?? [];
  const weapon = w.length ? w.reduce((a, r) => a + (r.done ? Math.max(0.3, 1 - r.errors * 0.15) : 0.2), 0) / w.length : 0.5;
  const headParts = [weapon, state.lecture, state.stations, state.personality].filter((v) => v !== undefined);
  const head = headParts.reduce((a, b) => a + b, 0) / headParts.length;
  const talk = state.interview ?? 0.5;
  // The game's own weights.
  return { physical, team, head, talk, total: 0.35 * physical + 0.3 * team + 0.15 * head + 0.2 * talk };
}

const PASS_LINE = 0.68; // The game's own line.

async function results(game) {
  const { ui, state, drills, sky } = game;
  const f = F(state);
  const s = scores(state, { ...(state.stats ?? {}), ...drills.stats });
  let outcome;
  if (state.quit) outcome = OUTCOMES.quit;
  else if (state.runFail || state.cut) outcome = OUTCOMES.run;
  else outcome = s.total >= PASS_LINE ? (f ? OUTCOMES.passF : OUTCOMES.passM) : f ? OUTCOMES.failF : OUTCOMES.failM;
  const passed = outcome === OUTCOMES.passF || outcome === OUTCOMES.passM;
  const finished = !state.quit && !state.runFail && !state.cut;
  const pct = (v) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
  const lines = finished
    ? [['פיזי', pct(s.physical)], ['צוות וסוציומטרי', pct(s.team)], ['ראש (נשק, הרצאה, תחנות)', pct(s.head)], ['ראיון', pct(s.talk)]]
    : [];
  saveResults('oketz', { outcome: outcome.title, gender: state.gender, total: s.total });
  if (finished) unlock('oketz-done');
  if (passed) unlock('oketz-in');
  if (state.silent === 1 && finished) unlock('oketz-honest');
  game.save('results');
  sky.setTime('day');
  await ui.fact(FACTS.results.title, FACTS.results.points);
  if (finished) await ui.interlude('כשלושה שבועות אחר כך…', 1800);
  const next = !passed && finished && !f ? { id: 'next', label: 'לשבוע ראיונות', href: '../interview-week/?new=1' } : null;
  const buttons = [...(next ? [next] : []), { id: 'again', label: 'לנסות שוב', secondary: true }, { id: 'menu', label: 'לתפריט הראשי', secondary: true }];
  const choice = await answerPhone(ui, {
    from: 'צה״ל · מיונים',
    time: finished ? 'שלושה שבועות אחרי · 15:20' : 'באותו יום',
    headline: outcome.title,
    detail: [outcome.detail],
    lines,
    note: 'במציאות לא מקבלים פירוט. המשקלות והקו (68%) הם של המשחק.',
    buttons,
  });
  if (passed) {
    await ui.interlude('כשמונה חודשים אחרי הגיוס… טקס בבית הקברות של כלבי היחידה. אחר כך מכסים לכם את העיניים.', 3200);
    await ui.interlude('צעדים, נביחות, ריח של כלביה. מורידים את הכיסוי. מולך: מלינואה בלגית, בת שנה וחצי. היא מרחרחת לך את היד.', 3600);
    unlock('oketz-dog');
  }
  await ui.fact(FACTS.dogs.title, FACTS.dogs.points);
  await ui.fact(FACTS.war.title, FACTS.war.points);
  if (choice === 'again') {
    unlock('persistence');
    window.location.href = './?new=1';
  } else if (choice === 'next' && next) window.location.href = next.href;
  else window.location.href = '../main-screen/';
}

const HANDLERS = { choose, arrive, run, night1, day2, day3, results };

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

export async function runFlow(game, startStep = 'choose') {
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
