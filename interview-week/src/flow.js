import { SPOTS, ROOMS } from './world.js';
import { seatPanel, releasePanel } from './team.js';
import {
  FACTS,
  UNITS,
  UNIT_BY_ID,
  QUESTIONS,
  INTERVIEW_ORDER,
  ECHO_PHRASES,
  MOMENTS,
  DAD_LINES,
  SMS_INVITE,
  FORM,
  NEXT_STEPS,
} from './content.js';
import { smsPanel, zoomPanel, rankingPanel, formPanel, bagCheck, schedulePanel, readPoster, resultsPhone, learnMenu } from './minigames.js';
import { makeSign } from '../../shared/engine/textures.js';
import { saveResults } from '../../shared/save.js';

// One interview day, with the Zoom, the survey and the answer around it.
export const STEPS = ['home', 'prepare', 'gate', 'register', 'wait', 'interviews', 'ranking', 'results'];

const OBJECTIVES = {
  home: ['בבית', 'מצגת הזום של היחידות'],
  prepare: ['יום הראיונות', 'בוקר, בדרך לתל השומר'],
  gate: ['בכניסה לבקו״ם', 'שער, שומרים ותעודה'],
  register: ['רישום', 'מקבלים מספר'],
  wait: ['אולם ההמתנה', 'ממתינים לקריאה לפי מספר'],
  interviews: ['הראיונות', 'ראיון לכל יחידה'],
  ranking: ['דירוג אישי', 'סוף היום'],
  results: ['התשובה', 'כמה שבועות אחרי'],
};

const above = (person, extra = 2.3) => () => ({ x: person.position.x, y: person.position.y + extra, z: person.position.z });
const groundTarget = (spot, extra = 2.2) => ({ x: spot.x, y: extra, z: spot.z });
const near = (spot, r) => (p) => Math.hypot(p.x - spot.x, p.z - spot.z) < r;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

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

/** Ask with scored options in random order; resolves to the chosen option. */
async function ask(game, speaker, question, options) {
  const order = shuffle(options);
  const choice = await game.ui.talk(speaker, question, order.map((o) => o[0]));
  return order[choice];
}

// ---------- At home, two weeks before ----------

async function home(game) {
  const { ui, player, people, sky, state } = game;
  sky.setTime('day');
  game.setClock('בבית', 21 * 60 + 15);
  player.teleport(-0.2, 119.2, Math.PI);
  await ui.fadeIn();
  await smsPanel(ui, { ...SMS_INVITE, time: 'לפני שבועיים · 21:15' });
  await ui.fact(FACTS.who.title, FACTS.who.points);

  const dad = people.staff.dad;
  await goTalk(game, dad, 'dad', 'דבר עם אבא', 'הוא עומד בדלת');
  await talkScene(game, dad, async () => {
    await ui.talk(dad.name, DAD_LINES.door);
    state.mood = await ui.talk('אני', 'מה אתה אומר?', ['"אני מאוכזב, אבל אני רוצה להמשיך ולהילחם."', '"אני לא יודע מה אני רוצה."', '"אני רוצה לעבוד על עצמי ולנסות שוב."']);
    await ui.talk(dad.name, 'מה שלא תחליט, תחליט לבד. המצגת הלילה בזום, אל תפספס.');
  });

  game.ui.setObjective('הצטרף למצגת הזום', 'המחשב על השולחן');
  game.setTarget({ x: SPOTS.desk.x, y: 1.9, z: SPOTS.desk.z });
  await game.waitInteract('laptop');
  game.setTarget(null);
  const heard = await zoomPanel(ui, UNITS);
  state.heard = heard;
  await ui.fact(FACTS.zoom.title, FACTS.zoom.points);

  state.form = await formPanel(ui);
  const ranking = await rankingPanel(ui, UNITS, {
    eyebrow: 'הסקר נשלח אחרי הזום · פתוח 48 שעות (לפי אתרי הכנה)',
    title: 'דרג את היחידות',
    intro: 'לפחות שלוש יחידות חובה (לפי העמוד הרשמי). לפי אתרי הכנה כדאי לדרג חמש ויותר. לפחות שלוש מהן יהפכו לראיונות.',
    min: 3,
    recommended: 5,
  });
  state.ranking = ranking;
  state.interviews = ranking.slice(0, 3);
  await ui.fact(FACTS.ranking.title, FACTS.ranking.points);
  await talkScene(game, dad, async () => {
    await ui.talk(dad.name, DAD_LINES.night);
  });
  game.save('home');
}

async function prepare(game) {
  const { ui, player, sky } = game;
  sky.setTime('day');
  game.setClock('יום הראיונות', 6 * 60 + 40);
  player.teleport(-0.2, 119.2, Math.PI);
  await ui.interlude('כמה שבועות אחרי · בוקר יום הראיונות', 2400);
  await bagCheck(ui);
  await ui.interlude('אוטובוס לתל השומר…', 2200);
  game.save('prepare');
}

async function gate(game) {
  const { ui, player, people } = game;
  game.setClock('יום הראיונות', 8 * 60 + 5);
  player.teleport(SPOTS.arrive.x, SPOTS.arrive.z, 0);
  await ui.fadeIn();
  await walkTo(game, SPOTS.gate, 'גש לשער של בקו״ם', 'שומר בכניסה', 3.2);
  const guard = people.staff.guard1;
  await goTalk(game, guard, 'guard1', 'הצג תעודה לשומר', 'פנה אליו');
  await talkScene(game, guard, async () => {
    await ui.talk(guard.name, 'בוקר טוב. תעודה מזהה ושם. אתה בא לשבוע ראיונות?');
    await ui.talk('אני', 'כן.', ['[מגיש תעודה מזהה]']);
    await ui.talk(guard.name, 'ברוך הבא. הבניין הגדול מולך. תירשם בשולחנות בכניסה, ואז תמתין באולם עד שיקראו לך.');
  });
  game.save('gate');
}

async function register(game) {
  const { ui, player, people, state } = game;
  game.setClock('יום הראיונות', 8 * 60 + 25);
  player.teleport(0, 30, 0);
  await walkTo(game, SPOTS.door, 'היכנס לבניין', 'הדלת הגדולה', 3);
  const clerk = people.staff.clerk1;
  state.number = state.number ?? 300 + Math.floor(Math.random() * 90);
  await goTalk(game, clerk, 'clerk1', 'גש לשולחן הרישום', 'כל אחד נרשם');
  await talkScene(game, clerk, async () => {
    await ui.talk(clerk.name, 'שלום. שם ותעודה? תודה. המספר שלך הוא ' + state.number + '. תשים לב למסך: קוראים לפי מספר.');
    await ui.talk(clerk.name, 'הראיונות היום עם היחידות שדירגת, בסדר אחר. מי שהקריאה שלו הגיעה, הולך לחדר שכתוב לו. אל תתרחק מהאולם.');
  });
  game.hud.setNumber(state.number);
  await schedulePanel(ui, { number: state.number, interviews: state.interviews });
  await ui.fact(FACTS.day.title, FACTS.day.points);
  game.save('register');
}

// ---------- Waiting ----------

function screenTick(game) {
  const { world, state, people } = game;
  const rooms = [1, 2, 3, 4, 5, 6];
  let n = 0;
  return (mine = false) => {
    const taken = shuffle(people.hall).slice(0, 5);
    const called = taken.map((p, i) => ({ number: String(p.number), station: `חדר ${rooms[(n + i) % rooms.length]}` }));
    n += 2;
    if (mine) called.unshift({ number: String(state.number), station: mine });
    const waiting = shuffle(people.hall).slice(0, 4).map((p) => String(p.number));
    world.setCalled(called, waiting, mine ? String(state.number) : null);
  };
}

async function moment(game, key, speaker = 'המתנה') {
  const { ui, state } = game;
  const m = MOMENTS[key];
  await ui.talk(speaker, m.intro);
  const choice = await ask(game, 'אני', 'מה אתה עושה?', m.choices);
  (state.manner ??= []).push(choice[1]);
  return choice[1];
}

async function wait(game) {
  const { ui, player, people, world, state } = game;
  const tick = screenTick(game);
  game.screen = tick;
  tick();
  game.setClock('יום הראיונות', 8 * 60 + 45);
  player.teleport(0, 16, Math.PI);
  await ui.talk('סמל הקליטה', 'תשבו, תשתו, תקראו ספר. הקריאה בסדר שלא יימסר מראש. מי שלא כאן כשקוראים לו, נחשב כמי שוויתר.');
  await ui.fact(FACTS.waiting.title, FACTS.waiting.points);

  ui.setObjective('שב וחכה', 'מקשים E על כיסא פנוי. אפשר גם לקרוא את לוח היחידות');
  const free = () => world.seatList.filter((s) => !s.taken);
  const target = () => {
    const seat = free().sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0];
    return seat ? { x: seat.x, y: 1.3, z: seat.z } : null;
  };
  game.setTarget(target);
  await game.waitUntil(() => player.seat);
  game.setTarget(null);

  // 1. Someone drops their papers.
  await ui.interlude('חצי שעה עוברת. אתה קורא את אותה פסקה בפעם החמישית…', 2000);
  game.setClock('יום הראיונות', 9 * 60 + 15);
  tick();
  const talker = people.talkers[0];
  talker.setPose('stand');
  await moment(game, 'dropped');

  // 2. A queue at the machine.
  ui.setObjective('קנה מים במכונה', 'אחד־עשר צעדים מהכיסאות');
  player.standUp(false);
  game.setTarget({ x: SPOTS.vending.x - 1.3, y: 2.3, z: SPOTS.vending.z });
  await game.waitZone(near(SPOTS.vending, 2.8));
  game.setTarget(null);
  await moment(game, 'cut');
  game.setClock('יום הראיונות', 9 * 60 + 50);

  // 3. Someone asks what you ranked first.
  const asker = people.talkers[1];
  await talkScene(game, asker, async () => {
    await ui.talk(asker.name, 'היי, אתה מגיבוש טיס, נכון? נפלתי באותו יום. אפשר לשאול משהו?');
    await moment(game, 'rank', asker.name);
  });
  state.manner = state.manner ?? [];
  game.save('wait');
}

// ---------- The interviews ----------

function setSign(world, room, unit) {
  const sign = world.doorSigns[room.id - 1];
  const fresh = makeSign([`חדר ${room.id}`, unit.name], { width: 0.9, height: 0.34, bg: '#1f3b73' });
  sign.material = fresh.material;
}

/** The numbers called on the screen, then the player's own. */
async function called(game, room, unit) {
  const { ui, people } = game;
  game.screen(`חדר ${room.id}`);
  const announcer = people.staff.announcer;
  ui.announce(`מספר ${game.state.number}`, `חדר ${room.id}`);
  await new Promise((r) => setTimeout(r, 900));
  await talkScene(game, announcer, async () => {
    await ui.talk(announcer.name, `מספר ${game.state.number}, חדר ${room.id}, ${unit.name}. בבקשה, בלי למהר.`);
  });
}

const FORM_ECHO = ['weakness', 'parents', 'hobby', 'training'];

/** Runs one interview and resolves to { impression, notes }. */
async function interview(game, unit, panel) {
  const { ui, state } = game;
  const scores = [];
  const notes = [];
  const lead = panel[0];
  const second = panel[1];
  const noted = async () => {
    lead.setPose('sit-type');
    second?.setPose('sit-talk');
    await new Promise((r) => setTimeout(r, 450));
    lead.setPose('sit-talk');
    second?.setPose('sit-type');
  };
  const word = (text) => text.replaceAll('{u}', unit.name);
  const ack = ['רשמתי.', 'מעניין.', 'המשך.', 'בסדר.', 'תודה.'];

  await ui.talk(lead.name, `שלום, תשב. אני מנהל את הראיון. ${panel.length > 1 ? 'לידי עוד אחד מהיחידה. ' : ''}יש לנו קצת זמן, ואני אשאל כמה שאלות. תענה בכנות.`);

  // The order: intro, why, flexible first; then a mix. Questions that match the form are checked against it.
  const rest = shuffle(INTERVIEW_ORDER.filter((k) => !['intro', 'why', 'flexible'].includes(k)));
  const sequence = ['intro', 'why', ...rest.slice(0, 4), 'flexible'];
  // One form question is asked again, in other words, near the end.
  const echoKey = pick(FORM_ECHO.filter((k) => !sequence.includes(k)).concat(sequence.filter((k) => FORM_ECHO.includes(k))));
  sequence.splice(sequence.length - 1, 0, `echo:${echoKey}`);

  for (const entry of sequence) {
    const isEcho = entry.startsWith('echo:');
    const key = isEcho ? entry.slice(5) : entry;
    const q = QUESTIONS[key];
    const text = isEcho ? ECHO_PHRASES[key] : word(q.q);
    const [answer, score, tags] = await ask(game, 'אני', text, q.options.map((o) => o)).then((o) => o);
    await noted();
    let value = score;
    let consistent = true;
    if (q.echo) {
      const tag = tags.find((t) => t.startsWith(`${q.echo.key}:`));
      const idx = Number(tag?.split(':')[1]);
      consistent = idx === state.form[q.echo.key];
      value = consistent ? 0.9 : 0.1;
      if (!consistent) notes.push(`${key}: לא תאם את הטופס`);
      if (!consistent) await ui.talk(lead.name, 'רגע. בטופס כתבת משהו אחר. זה שונה ממה שאמרת עכשיו.');
    } else if (tags.includes('inflated') || tags.includes('dishonest')) {
      notes.push(key + ': הגזמה');
    }
    scores.push(value);
    if (value < 0.3 && !tags.includes('dishonest') && consistent) await ui.talk(lead.name, 'אתה בטוח? תסביר.', ['[מנסה להסביר, אבל שוב לא ממש מצליח]']);
    else if (Math.random() < 0.35) await ui.talk(second?.name ?? lead.name, pick(ack));
  }
  await ui.talk(lead.name, 'זהו, זה כל מה ששאלתי. תודה שבאת. תמתין בחוץ.');
  const average = scores.reduce((a, b) => a + b, 0) / scores.length;
  // How you behaved while waiting also counts a little (the staff were watching).
  const manner = state.manner?.length ? state.manner.reduce((a, b) => a + b, 0) / state.manner.length : 0.6;
  const impression = clamp(average + (manner - 0.6) * 0.1 + (Math.random() - 0.5) * 0.04);
  return { impression, notes, average, manner };
}

async function interviews(game) {
  const { ui, player, people, world, state, crowd } = game;
  game.screen ??= screenTick(game);
  const rooms = shuffle(ROOMS);
  state.results ??= [];
  game.setClock('יום הראיונות', 10 * 60 + 20);
  const order = state.interviews;
  const startIndex = state.results.length;
  for (let i = startIndex; i < order.length; i++) {
    const unit = UNIT_BY_ID[order[i]];
    const room = rooms[i];
    setSign(world, room, unit);
    player.standUp(false);
    // Wait in the hall until called.
    if (i > 0) {
      player.teleport(0, 5, Math.PI);
      await ui.interlude('חוזרים לאולם ומחכים לקריאה הבאה…', 1800);
    }
    ui.setObjective('המתן לקריאה', 'מסך המספרים');
    await new Promise((r) => setTimeout(r, 600));
    await called(game, room, unit);
    ui.setObjective(`חדר ${room.id}: ${unit.name}`, 'דרך המסדרון שמאחורי הדלת הגדולה');
    game.setTarget(groundTarget({ x: 0, z: -14 }, 2.4));
    await game.waitZone(near({ x: 0, z: -14 }, 2.4));
    game.setTarget(groundTarget(room.door, 2.4));
    await game.waitZone(near(room.door, 1.6));
    game.setTarget(null);

    const panel = seatPanel(crowd, room, unit);
    await ui.fadeOut();
    player.sit({ x: room.chair.x, z: room.chair.z, taken: false, eye: 1.12, exit: { x: room.door.x + (room.side === 'west' ? 1.2 : -1.2), z: room.door.z } }, room.yaw);
    player.pitch = -0.04;
    await ui.fadeIn();
    const result = await interview(game, unit, panel);
    player.standUp(false);
    player.teleport(room.door.x + (room.side === 'west' ? 1.4 : -1.4), room.door.z, room.side === 'west' ? -Math.PI / 2 : Math.PI / 2);
    releasePanel(panel);
    state.results.push({ unit: unit.id, ...result });
    game.setClock('יום הראיונות', 10 * 60 + 20 + (i + 1) * 55);
    if (i === 0) await ui.fact(FACTS.questions.title, FACTS.questions.points);
    game.save('interviews');
  }
  game.save('interviews');
}

async function ranking(game) {
  const { ui, player, state } = game;
  player.teleport(0, 5, Math.PI);
  game.setClock('יום הראיונות', 13 * 60 + 10);
  const interviewed = state.results.map((r) => UNIT_BY_ID[r.unit]);
  await ui.talk('סמל הקליטה', 'לפני שהולכים הביתה, כל אחד מגיש דירוג אישי של היחידות שהתראיין אצלן. זה נלקח בחשבון בסיכום.');
  state.finalRank = await rankingPanel(ui, interviewed, {
    eyebrow: 'סוף היום · דירוג אישי',
    title: 'איפה היית רוצה להיות?',
    intro: 'דרג את היחידות שהתראיינת אצלן, מהמועדפת ביותר. אי אפשר לוותר אחרי שמתקבלים, אז דרג בכנות.',
    min: interviewed.length,
    recommended: interviewed.length,
    confirm: 'הגשה',
  });
  await ui.fact(FACTS.end.title, FACTS.end.points);
  game.save('ranking');
}

// ---------- The answer ----------

function placement(state) {
  const impressions = state.results.map((r) => {
    const unit = UNIT_BY_ID[r.unit];
    return { unit, value: r.impression, accepts: r.impression >= unit.accept };
  });
  const order = state.finalRank ?? state.results.map((r) => r.unit);
  const best = order.find((id) => impressions.find((i) => i.unit.id === id)?.accepts);
  return { impressions, accepted: best ? UNIT_BY_ID[best] : null };
}

async function results(game) {
  const { ui, state, player } = game;
  game.setClock('כמה שבועות אחרי', 18 * 60 + 40);
  player.teleport(-0.2, 119.2, Math.PI);
  await ui.interlude('כמה שבועות אחרי. הטלפון רוטט…', 2600);
  const { impressions, accepted } = placement(state);
  const avgManner = state.manner?.length ? state.manner.reduce((a, b) => a + b, 0) / state.manner.length : 0.6;
  const inconsistent = state.results.reduce((n, r) => n + r.notes.filter((t) => t.includes('הטופס')).length, 0);
  const lines = [
    ['ראיונות', `${state.results.length}: ${state.results.map((r) => UNIT_BY_ID[r.unit].name).join(', ')}`],
    ['התנהגות בהמתנה', `${Math.round(avgManner * 100)}%`],
    ['עקביות מול הטופס', inconsistent ? `${inconsistent} סתירות` : 'עקבי'],
  ];
  saveResults('interview-week', { accepted: accepted?.name ?? null });
  game.save('results');
  const topics = [
    { title: FACTS.steps.title, points: FACTS.steps.points },
    { title: FACTS.end.title, points: FACTS.end.points },
    { title: 'אם לא התקבלתי לאף יחידה', points: NEXT_STEPS.none },
  ];
  for (;;) {
    const choice = await resultsPhone(ui, { accepted, lines, impressions });
    if (choice === 'learn') {
      await learnMenu(ui, topics);
      continue;
    }
    if (choice === 'again') window.location.href = './?new=1';
    else window.location.href = '../main-screen/';
    return;
  }
}

const HANDLERS = { home, prepare, gate, register, wait, interviews, ranking, results };

export async function runFlow(game, startStep = 'home') {
  let i = STEPS.indexOf(startStep);
  game.jumpTo = (step) => {
    i = STEPS.indexOf(step) - 1;
  };
  for (; i < STEPS.length; i++) {
    game.state.step = STEPS[i];
    game.ui.setObjective(...OBJECTIVES[STEPS[i]]);
    await HANDLERS[STEPS[i]](game);
  }
}
