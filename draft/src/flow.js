import { FACTS, HEALTH, DISCUSSION, INTERVIEW, UNITS, OUTCOMES } from './content.js';
import { SPOTS } from './world.js';
import { knots, stretcherDrill, sociometric, rankUnits, phoneMessage, incomingCall, choosePath } from './minigames.js';
import { placeOthers } from './team.js';
import { loadResults, saveResults } from '../../shared/save.js';
import { unlock } from '../../shared/achievements.js';

// The script of the stage. Two paths:
//   669:      home (draft result, phone call) → the pool day → result → (if not taken) the commando path
//   commando: home (draft result) → rank the units → about four weeks → placement → accept or give up
// The pool day's tasks are from prep sites only; their order and length here are the game's.

export const STEPS = ['home', 'arrive', 'swim', 'water', 'dive', 'ring', 'dry', 'rescue', 'talk', 'result669', 'commando', 'end'];

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const avg = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0.5);

function goTo(game, spot, label, { radius = 1.6 } = {}) {
  game.ui.setObjective(label);
  game.setTarget({ x: spot.x, z: spot.z, y: 2.2 });
  return game.waitZone((p) => Math.hypot(p.x - spot.x, p.z - spot.z) < radius).then(() => game.setTarget(null));
}

function talkTo(game, id, label) {
  const person = game.people.staff[id];
  game.ui.setObjective(label);
  game.setTarget(() => ({ x: person.position.x, z: person.position.z, y: person.position.y + 2.3 }));
  return game.waitInteract(id).then(() => {
    game.setTarget(null);
    game.player.faceTowards(person.position.x, person.position.z, person.position.y + 1.5);
  });
}

// ---------- Home: the draft result ----------

function pathFromGibbush() {
  const outcome = loadResults('gibbush-matkal')?.outcome ?? '';
  if (outcome.includes('669')) return '669';
  if (outcome.includes('קומנדו')) return 'commando';
  return null;
}

async function home(game) {
  const { ui, state, player, sky } = game;
  sky.setTime('day');
  game.atHome(true);
  player.teleport(SPOTS.home.x - 0.4, SPOTS.home.z + 0.6, -Math.PI / 2);
  game.setDay('שבוע אחרי הגיבוש');
  game.setClock(15 * 60 + 40);
  await ui.fadeIn();
  ui.setObjective('בבית', 'מחכים לתשובה מהגיבוש');
  if (!state.path) state.path = pathFromGibbush() ?? (await choosePath(ui));
  state.fromGibbush = Boolean(pathFromGibbush());

  const is669 = state.path === '669';
  await phoneMessage(ui, {
    time: 'יום ה׳ · 15:40',
    text: 'שלום, תוצאת הדראפט שלך: ',
    strong: is669 ? 'מאותר ל־669' : 'חטיבת הקומנדו',
    detail: is669 ? 'ניצור איתך קשר בימים הקרובים לגבי יום מיון נוסף.' : 'השיבוץ ליחידה בתוך החטיבה יימסר בהמשך.',
    note: 'הנוסח של ההודעה הוא של המשחק. אין עדות בגוף ראשון על קבלת התשובה של הדראפט.',
  });
  await ui.fact(FACTS.draft.title, FACTS.draft.points);
  if (!is669) {
    game.save('home');
    game.jumpTo('commando');
    return;
  }

  // About two days later: the phone call.
  await ui.interlude('יומיים אחר כך...', 1800);
  game.setDay('יומיים אחרי הדראפט');
  game.setClock(11 * 60 + 5);
  await incomingCall(ui, { time: 'יום א׳ · 11:05', caller: 'צה״ל · מיונים' });
  const clerk = game.staff('clerk');
  await ui.conversation([
    [clerk, `שלום, מדברת מהמיונים. אתה מאותר ל־669, והיחידה מזמינה אותך ליום מיון בבריכה, ביום רביעי בבוקר.`],
    [clerk, 'זה יום אחד, כמה שעות. תקבל הודעה עם הכתובת והשעה.'],
  ]);
  const q = await ui.talk(clerk, 'יש לך שאלות?', ['מה צריך להביא?', 'מה עושים שם?', 'אין, תודה']);
  if (q === 0) await ui.talk(clerk, 'בגד ים, מגבת, כפכפים ותעודה מזהה. (את הרשימה כתב המשחק: באף מקור לא נמצאה רשימת ציוד.)');
  if (q === 1) await ui.talk(clerk, 'את זה תראה שם. (במציאות, לפי אתרי הכנה: שחייה, דריכת מים, צלילה, קשרים ומשימות צוות.)');
  await ui.fact(FACTS.invite.title, FACTS.invite.points);
  game.save('home');
}

// ---------- The pool day ----------

async function arrive(game) {
  const { ui, state, player, people } = game;
  game.atHome(false);
  await ui.interlude('יום ד׳ · 07:45 · בסיס צבאי, ליד הבריכה', 2400);
  game.setDay('יום הבריכה');
  game.setClock(7 * 60 + 45);
  placeOthers(people.others, 'gate');
  player.teleport(SPOTS.gate.x, SPOTS.gate.z + 4.5, Math.PI);
  await ui.fadeIn();

  await talkTo(game, 'clerk', 'לגשת לשולחן הקליטה');
  const clerk = game.staff('clerk');
  await ui.talk(clerk, 'תעודה מזהה. תודה. לפני שנכנסים, שאלון בריאות קצר.');
  const answer = await ui.talk(clerk, HEALTH.q, HEALTH.choices);
  state.health = answer;
  state.earProblem = answer !== 0;
  if (answer === 0) {
    await talkTo(game, 'medic', 'לגשת לחובשת');
    await ui.conversation([
      [game.staff('medic'), 'בוא נסתכל... אין אודם, אין הפרשה. אתה יכול להיכנס.'],
      [game.staff('medic'), 'אם בעומק זה כואב, עולים. אף אחד לא מוריד נקודות על זה.'],
    ]);
  } else if (answer === 2) {
    await ui.talk(clerk, 'שאלתי על בריאות, לא על שחייה. חתום כאן.');
  }
  game.hud.setBib(state.bib);
  ui.toast(`מספר ${state.bib}, בטוש על הכתף (במשחק)`, 2600);

  await goTo(game, SPOTS.lockers, 'למלתחות, להחליף לבגד ים');
  await ui.interlude('מחליפים לבגד ים...', 1400);
  player.teleport(SPOTS.lockers.x + 2, SPOTS.lockers.z - 3, Math.PI);
  people.group.forEach((p, i) => p.walkTo([{ x: SPOTS.briefing.x - 3 + (i % 5) * 1.3, z: SPOTS.briefing.z + 1.3 + Math.floor(i / 5) * 1.1 }], { pose: 'stand', facing: Math.PI }));
  placeOthers(people.others, 'benches');

  await goTo(game, SPOTS.briefing, 'לשפת הבריכה, לתדריך', { radius: 2.4 });
  const head = game.staff('head');
  player.faceTowards(people.staff.head.position.x, people.staff.head.position.z, 1.6);
  await ui.conversation([
    [head, 'בוקר טוב. אני רועי, ומולכם עוז. אנחנו מ־669.'],
    [head, 'היום הוא יום אחד. מים, קשרים, משימה קבוצתית ושיחה בסוף. אף אחד לא מצפה שתהיו שחיינים אולימפיים.'],
    [head, 'המציל שם כל הזמן. מי שמרגיש לא טוב מרים יד, ויוצא. זה לא כישלון, זה שיקול דעת.'],
  ]);
  game.save('arrive');
}

async function swim(game) {
  const { ui, water, state } = game;
  ui.setObjective('מבחן שחייה', 'מסלול 3');
  game.setClock(8 * 60 + 20);
  const r = await water.swimTest();
  state.swim = r;
  water.leave(SPOTS.edgeEast);
  game.world.setLaneRopes(false);
  ui.toast(`סיימת במקום ${r.place} מתוך 6 · ${Math.round(r.time)} שנ׳ (במשחק)`, 3200);
  await ui.fact(FACTS.swim.title, FACTS.swim.points);
  game.save('swim');
}

async function waterStep(game) {
  const { ui, water, state } = game;
  ui.setObjective('דריכת מים', 'מרפקים מעל המים');
  game.setClock(9 * 60);
  state.tread = await water.tread();
  const pick = await ui.talk('אני', 'נועם נתלה על הקיר כשעוז הסתכל לצד השני. עכשיו הוא חוזר למעגל כאילו כלום.', [
    'להגיד לו בשקט: "אחי, תחזור למים. כולנו סובלים"',
    'לדווח לעוז',
    'לא להתעסק עם זה',
  ]);
  state.cheatReaction = [1, 0.7, 0.3][pick];
  await ui.fact(FACTS.tread.title, FACTS.tread.points);
  game.save('water');
}

async function dive(game) {
  const { ui, water, state } = game;
  ui.setObjective('צלילה למשקולות', 'ארבע צלחות על המוט בקרקעית');
  game.setClock(9 * 60 + 40);
  await ui.talk(game.staff('second'), 'בקרקעית יש מוט עם ארבע צלחות. מפרקים אותן. כמה צלילות שצריך, אבל עולים לפני שהאוויר נגמר. לא לפני, לא אחרי.');
  state.dive = await water.dive({ earProblem: state.earProblem && state.health === 1 });
  ui.toast(`${state.dive.plates} מתוך 4 צלחות · ${state.dive.dives} צלילות`, 2600);
  await ui.fact(FACTS.dive.title, FACTS.dive.points);
  game.save('dive');
}

async function ring(game) {
  const { ui, water, state, people } = game;
  ui.setObjective('טבעת הלחץ', 'כולם במעגל, ידיים על הכתפיים');
  game.setClock(10 * 60 + 15);
  await ui.talk(game.staff('head'), 'מעגל. כל אחד שם ידיים על הכתפיים של מי שלידו. לא משחררים עד שאני אומר.');
  const panicky = people.group.find((p) => p.info.trait === 'panic');
  let event = null;
  state.ring = await water.ring({
    onEvent: () => {
      panicky.setPose('tread-high');
      event = ui
        .talk(panicky.name, '(נושם מהר, הידיים שלו מחליקות לך מהכתף) "אני לא... אני לא מרגיש את הרגליים..."', [
          'להחזיק אותו חזק יותר ולדבר איתו בשקט: "נושמים יחד. ארבע פנימה, ארבע החוצה"',
          'לקרוא לעוז',
          'להוריד ממנו את היד ולהתרכז בעצמך',
        ])
        .then((i) => {
          state.ringChoice = [1, 0.7, 0.1][i];
          panicky.setPose('ring');
          if (i === 0) ui.toast('שחר נרגע. עמרי מהצד השני מחזיק אותו גם', 2600);
          if (i === 1) ui.toast('עוז מתקרב בשקט ושם יד על הגב של שחר', 2600);
          if (i === 2) ui.toast('המעגל נפתח לרגע. שחר משתעל ונתפס בעמרי', 2600);
        });
    },
  });
  await event;
  game.water.leave(SPOTS.edgeEast);
  if (state.ring.maxPulse < 150 && state.ringChoice >= 1) unlock('draft-ring');
  await ui.fact(FACTS.ring.title, FACTS.ring.points);
  await ui.interlude('הפסקה. מגבת, מים, כריך. עוד שתי משימות.', 2000);
  game.save('ring');
}

async function dry(game) {
  const { ui, state, player } = game;
  game.setClock(11 * 60);
  player.teleport(SPOTS.table.x - 2.2, SPOTS.table.z + 2.5, Math.PI);
  await talkTo(game, 'second', 'לשולחן הקשרים, ליד עוז');
  await ui.fact(FACTS.dry.title, FACTS.dry.points);
  state.knots = await knots(ui);
  state.stretcher = await stretcherDrill(ui);
  ui.toast(`קשרים ${Math.round(state.knots * 100)}% · אלונקה ${Math.round(state.stretcher * 100)}% (במשחק)`, 2600);
  game.save('dry');
}

async function rescue(game) {
  const { ui, state, water } = game;
  ui.setObjective('חילוץ קבוצתי', 'שלושה "נפגעים", שתי סירות, חבלים');
  game.setClock(11 * 60 + 40);
  const head = game.staff('head');
  await ui.talk(head, 'שלושה "נפגעים" בקצה הצפוני. צריך להביא אותם לקצה הדרומי. יש שתי סירות גומי וחבלים. שלוש דקות תכנון, ואז מתחילים.');
  const plan = await ui.talk('אני', 'כולם מדברים בבת אחת. אלון כבר צועק תוכנית.', [
    'להציע תוכנית קצרה ולשאול מה כולם חושבים: סירה אחת עושה שני סבבים, מושכים מהקצה',
    'לחכות שמישהו אחר יחליט',
    'לצעוק יותר חזק מאלון ולחלק פקודות',
  ]);
  const aside = await ui.talk('אני', 'ליאם עומד בצד ולא נוגע בחבל.', ['לתת לו את הקצה של החבל ולהגיד "אתה איתי"', 'לעשות את החלק שלו בעצמך', 'להגיד לרועי שליאם לא עושה כלום']);
  state.plan = [1, 0.45, 0.3][plan];
  state.aside = [1, 0.6, 0.3][aside];
  state.rescue = await water.rescue({ teamwork: (state.plan + state.aside) / 2 });
  ui.toast(`החילוץ נגמר ב־${Math.round(state.rescue.time)} שנ׳ (במשחק)`, 2600);
  await ui.fact(FACTS.rescue.title, FACTS.rescue.points);
  game.save('rescue');
}

async function talk(game) {
  const { ui, state, people, player } = game;
  game.setClock(12 * 60 + 30);
  player.teleport(SPOTS.briefing.x, SPOTS.briefing.z - 0.5, Math.PI);
  people.group.forEach((p, i) => {
    const a = (i / people.group.length) * Math.PI - Math.PI;
    p.place(SPOTS.briefing.x + Math.cos(a) * 2.4, SPOTS.briefing.z + 2 + Math.sin(a) * -1.2, 0).setPose('sit-ground');
  });
  ui.setObjective('דיון קבוצתי', 'כולם יושבים על הדק');
  const d = await ui.talk(game.staff('head'), DISCUSSION.q, DISCUSSION.choices);
  state.discussion = DISCUSSION.scores[d];
  state.socio = await sociometric(ui, people.group);
  await talkTo(game, 'psych', 'לשיחה אישית, בצל ליד הספסלים');
  const psych = game.staff('psych');
  await ui.talk(psych, 'שיחה קצרה. אין תשובות נכונות, רק כנות.');
  let score = 0;
  for (const item of INTERVIEW) score += item.scores[await ui.talk(psych, item.q, item.choices)];
  state.interview = score / INTERVIEW.length;
  await ui.fact(FACTS.talk.title, FACTS.talk.points);
  game.save('talk');
}

// ---------- Scores (the game's own weights and lines: no source gives any) ----------

function scores(state) {
  const swim = state.swim ? clamp(0.55 * (1 - (state.swim.place - 1) / 5) + 0.45 * state.swim.technique) : 0.5;
  const physical = 0.4 * swim + 0.3 * (state.tread?.score ?? 0.5) + 0.3 * (state.dive?.score ?? 0.5);
  const calm = 0.6 * (state.ring?.score ?? 0.5) + 0.4 * (state.ringChoice ?? 0.5);
  const tech = avg([state.knots ?? 0.5, state.stretcher ?? 0.5]);
  const team = avg([state.rescue?.pulls ?? 0.5, state.plan ?? 0.5, state.aside ?? 0.5, state.socio ?? 0.5, state.discussion ?? 0.5, state.cheatReaction ?? 0.5]);
  const talk = state.interview ?? 0.5;
  const total = 0.3 * physical + 0.2 * calm + 0.15 * tech + 0.25 * team + 0.1 * talk + (state.health === 0 ? 0.02 : 0);
  return { swim, physical, calm, tech, team, talk, total };
}

const PASS_669 = 0.62;
const PLACE_LINE = 0.38; // Below this the game sends you to interview week instead of the commando brigade.

async function result669(game) {
  const { ui, state } = game;
  const s = scores(state);
  state.total669 = s.total;
  await ui.interlude('שלושה ימים אחר כך...', 1800);
  game.atHome(true);
  game.player.teleport(SPOTS.home.x - 0.4, SPOTS.home.z + 0.6, -Math.PI / 2);
  game.setDay('שלושה ימים אחרי יום הבריכה');
  game.setClock(13 * 60 + 10);
  const passed = s.total >= PASS_669;
  const outcome = passed ? OUTCOMES.passed669 : s.total < PLACE_LINE ? OUTCOMES.interviews : OUTCOMES.failed669;
  const pct = (v) => `${Math.round(clamp(v) * 100)}%`;
  await phoneMessage(ui, {
    time: 'יום א׳ · 13:10',
    text: 'שלום, תוצאות יום המיון של 669: ',
    strong: outcome.title,
    detail: outcome.detail,
    lines: [
      ['מים (שחייה, דריכה, צלילה)', pct(s.physical)],
      ['רוגע (טבעת הלחץ)', pct(s.calm)],
      ['ידיים (קשרים, אלונקה)', pct(s.tech)],
      ['קבוצה (חילוץ, דיון, סוציומטרי)', pct(s.team)],
      ['שיחה', pct(s.talk)],
    ],
    note: `במציאות לא מקבלים פירוט. המשקלות והסף (${Math.round(PASS_669 * 100)}%) הם החלטה של המשחק.`,
  });
  await ui.fact(FACTS.after669.title, FACTS.after669.points);
  if (passed) {
    state.outcome = 'passed669';
    unlock('draft-669');
    if (state.health === 0 && state.cheatReaction === 1) unlock('draft-honest');
    game.save('result669');
    game.jumpTo('end');
  } else if (outcome === OUTCOMES.interviews) {
    state.outcome = 'interviews';
    game.save('result669');
    game.jumpTo('end');
  } else {
    state.fromPool = true;
    game.save('result669');
  }
}

// ---------- The commando path ----------

/** The game's own placement: your first choice gets likelier the better you did; army needs do the rest. */
function placement(order, score) {
  const r = Math.random();
  const first = clamp(0.4 + 0.45 * score, 0.4, 0.88);
  if (r < first) return order[0];
  return Math.random() < 0.75 ? order[1] : order[2];
}

async function commando(game) {
  const { ui, state } = game;
  game.atHome(true);
  if (state.fromPool) ui.toast('ההעדפות שלך עוברות לחטיבת הקומנדו', 2400);
  ui.setObjective('דירוג היחידות', 'מגלן, אגוז, דובדבן');
  if (!state.order) state.order = await rankUnits(ui);
  await ui.fact(FACTS.commando.title, FACTS.commando.points);
  await ui.interlude('כארבעה שבועות אחר כך... (לפי אתר הכנה אחד, לא אומת)', 2600);
  game.setDay('כחודש אחרי הגיבוש');
  game.setClock(17 * 60 + 25);
  const matkalTotal = loadResults('gibbush-matkal')?.total;
  const score = state.total669 ?? (typeof matkalTotal === 'number' ? matkalTotal : 0.6);
  const id = state.unit ?? placement(state.order, score);
  state.unit = id;
  const unit = UNITS.find((u) => u.id === id);
  const choice = await phoneMessage(ui, {
    time: 'יום ב׳ · 17:25',
    text: 'שלום, שובצת בחטיבת הקומנדו, ליחידת ',
    strong: unit.name,
    detail: `${unit.base}. אפשר לוותר על השיבוץ תוך 7 ימים (רשמי).`,
    note: `${state.order[0] === id ? 'זו ההעדפה הראשונה שלך.' : `זו לא ההעדפה הראשונה שלך (${UNITS.find((u) => u.id === state.order[0]).name}).`} איך מחליטים בין היחידות לא פורסם: במשחק, ככל שהלך לך טוב יותר, הסיכוי לקבל את הראשונה גבוה יותר, וצורכי הצבא קובעים את השאר.`,
    buttons: [
      ['לאשר את השיבוץ', 'accept'],
      ['לוותר (עד 7 ימים)', 'waive', true],
    ],
  });
  if (choice === 'waive') {
    const sure = await ui.talk('אני', 'לוותר על השיבוץ? אף מקור לא מסביר מה קורה אחרי ויתור.', ['כן, לוותר', 'לא, לאשר בכל זאת']);
    if (sure === 0) {
      state.outcome = 'waived';
      game.save('commando');
      return;
    }
  }
  state.outcome = 'commando';
  unlock('draft-commando');
  game.save('commando');
}

// ---------- The end ----------

async function end(game) {
  const { ui, state } = game;
  const outcome = OUTCOMES[state.outcome] ?? OUTCOMES.commando;
  const unit = UNITS.find((u) => u.id === state.unit);
  const title = state.outcome === 'commando' && unit ? `${outcome.title}: ${unit.name}` : outcome.title;
  saveResults('draft', { outcome: title, path: state.path, total: state.total669 ?? null });
  unlock('draft-done');
  const next = state.outcome === 'interviews' || state.outcome === 'waived' ? { label: 'לשבוע ראיונות', href: '../interview-week/?new=1' } : null;
  const detail =
    state.outcome === 'commando' && unit
      ? `${unit.text} ${unit.base}. רשמי: האימון המתקדם במתקן אדם. לפי ynet (יולי 2025), ביקשו מלוחמי הקומנדו לחתום על שנת קבע מלאה.`
      : outcome.detail;
  const buttons = [];
  if (next) buttons.push([next.label, 'next']);
  buttons.push(['לנסות שוב', 'again', true], ['לתפריט הראשי', 'menu', true]);
  const choice = await phoneMessage(ui, { time: 'סוף השלב', from: 'הדראפט · 669 / קומנדו', text: 'איפה נגמר המסלול שלך: ', strong: title, detail, buttons });
  await ui.fact(FACTS.women.title, FACTS.women.points);
  if (choice === 'again') {
    unlock('persistence');
    window.location.href = state.path ? `./?new=1&path=${state.path}` : './?new=1';
  } else if (choice === 'next' && next) window.location.href = next.href;
  else window.location.href = '../main-screen/';
}

const HANDLERS = { home, arrive, swim, water: waterStep, dive, ring, dry, rescue, talk, result669, commando, end };

function recover(game) {
  game.ui.releaseAll?.();
  game.player.positionLocked = false;
  game.player.eyeOverride = null;
  game.setTarget(null);
  game.onAction = null;
  document.getElementById('water').hidden = true;
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
  }
}

