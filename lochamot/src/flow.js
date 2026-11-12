import { ROOMS } from '../../tzav-rishon/src/world.js';
import { inHall, stationLabel } from '../../tzav-rishon/src/life.js';
import { chime, beep } from '../../shared/engine/audio.js';
import { smsPanel, answerPhone } from '../../pilot-path/shared/panels.js';
import { loadResults, saveResults } from '../../shared/save.js';
import { unlock } from '../../shared/achievements.js';
import { FACTS, TALKS, ROUTES, SKIP_REASON } from './content.js';
import { bmiCheck, rankForm } from './minigames.js';

// The women's combat screening day at the recruitment office: arrive → a briefing on the screens → BMI → talks with
// women fighters at the stations → the digital form → the answers weeks and months later.
export const STEPS = ['arrive', 'briefing', 'bmi', 'talks', 'form', 'results'];

const ROOM_BOUNDS = {
  data: { minX: -26, maxX: -14, minZ: -19, maxZ: -12 },
  dapar: { minX: -26, maxX: -14, minZ: -30, maxZ: -19 },
  measure: { minX: 14, maxX: 26, minZ: -18, maxZ: -12 },
  interview1: { minX: -14, maxX: -4.7, minZ: -38, maxZ: -30 },
  interview2: { minX: -4.7, maxX: 4.7, minZ: -38, maxZ: -30 },
  interview3: { minX: 4.7, maxX: 14, minZ: -38, maxZ: -30 },
};

const inside = (bounds) => (p) => p.x > bounds.minX && p.x < bounds.maxX && p.z > bounds.minZ && p.z < bounds.maxZ;
const above = (person, height = 2.25) => () => ({ x: person.position.x, y: height + person.body.position.y, z: person.position.z });

async function scene(game, person, fn) {
  const release = game.ui.holdModal();
  game.player.faceTowards(person.position.x, person.position.z, person.pose.startsWith('sit') ? 1.15 : 1.55);
  game.setTarget(null);
  try {
    return await fn();
  } finally {
    release();
  }
}

async function goToRoom(game, roomKey, person, id, objective) {
  const { ui } = game;
  const room = ROOMS[roomKey];
  const isInside = inside(ROOM_BOUNDS[roomKey]);
  if (!isInside(game.player)) {
    ui.setObjective(`גשי ל${room.room}`, 'עקבי אחרי הסימן הצהוב');
    game.setTarget({ x: room.door.x, y: 2.6, z: room.door.z });
    await game.waitZone(isInside);
  }
  ui.setObjective(objective);
  game.setTarget(above(person));
  await game.waitInteract(id);
}

/** Wait in the hall until your number is on the screens. */
async function waitForCall(game, roomKey, seconds, label) {
  const { ui, hall, player, state } = game;
  ui.setObjective('חכי באולם עד שהמספר שלך יופיע במסך', 'אפשר לשבת על כיסא, ככה הזמן עובר מהר יותר');
  game.setTarget({ x: 0, y: 2.6, z: -20 });
  let progress = 0;
  await game.waitUntil((dt) => {
    if (!inHall(player)) {
      ui.setObjectiveSub('חזרי לאולם ההמתנה');
      return false;
    }
    progress += dt * (player.seat ? 4 : 1);
    game.addMinutes(dt * (player.seat ? 2.5 : 0.6));
    const ahead = Math.max(0, Math.ceil((1 - progress / seconds) * 4));
    hall.setPlayerWaiting(state.number, ahead);
    ui.setObjectiveSub(ahead > 0 ? `לפנייך עוד ${ahead} מספרים במסך` : 'עוד רגע…');
    return progress >= seconds;
  });
  hall.setPlayerWaiting(null);
  hall.highlight = state.number;
  hall.pushCalled(state.number, roomKey ? stationLabel(ROOMS[roomKey]) : label);
  chime();
  ui.announce(`מספר ${state.number}`, roomKey ? `נא לגשת ל${ROOMS[roomKey].room}` : label);
}

/** Your profile from the צו ראשון stage (or a typical one). */
function profileOf() {
  const r = loadResults('tzav-rishon');
  return { profile: r?.profile ?? 82, played: Boolean(r) };
}

// ---------- Steps ----------

async function arrive(game) {
  const { ui, player, staff, world, state } = game;
  player.teleport(0, 8.5, 0);
  ui.setObjective('יום מיון לוחמות', 'תל השומר, 08:00');
  await ui.fadeIn();
  await ui.fact(FACTS.before.title, FACTS.before.points);
  const clothes = await ui.talk('אני', 'בבוקר, מול הארון. מה לובשים ליום מיון לוחמות?', ['טייץ, נעלי ריצה ובקבוק גדול. בטח יש ריצה', 'בגדים רגילים ונוחים, ובקבוק מים']);
  state.clothes = clothes;
  await ui.fact(FACTS.clothes.title, FACTS.clothes.points);
  if (clothes === 0) ui.toast('לא נורא. היום אף אחת לא רצה.', 2600);

  ui.setObjective('היכנסי ללשכת הגיוס', 'בכניסה יש בידוק ביטחוני');
  game.setTarget(above(staff.guard));
  await game.waitInteract('guard');
  await scene(game, staff.guard, async () => {
    await ui.talk('מאבטח', 'בוקר טוב. יום מיון לוחמות? תיק פתוח, טלפון בסלסלה.');
    await ui.talk('אני', 'הנה.', ['[מניחה את הטלפון בסלסלה]']);
  });
  world.openSecurity();
  ui.setObjective('עברי בשער הבידוק');
  game.setTarget({ x: 0, y: 2.7, z: -3 });
  await game.waitZone((p) => p.z < -3.4);
  beep();

  const clerk = staff.routingClerks[0];
  ui.setObjective('גשי לעמדה 1', 'ניתוב: תעודה מזהה ומדבקה');
  game.setTarget(above(clerk, 2.0));
  await game.waitInteract('window-0');
  await scene(game, clerk, async () => {
    await ui.talk(clerk.name, 'בוקר טוב! תעודת זהות בבקשה. יום מיון לוחמות, נכון?');
    beep();
    ui.showSticker(state.number);
    await ui.talk(clerk.name, `זו המדבקה שלך. המספר: ${state.number}. קודם תדריך באולם, ואחר כך המסך יקרא לך לתחנות.`);
  });
  game.queue.playerServed?.();
  game.addMinutes(15);
  game.save('arrive');
}

async function briefing(game) {
  const { ui } = game;
  ui.setObjective('תדריך באולם', 'שבי ותסתכלי על המסכים');
  game.setTarget({ x: 0, y: 2.6, z: -20 });
  await game.waitZone(inHall);
  game.setTarget(null);
  await ui.interlude('09:00 · על המסכים: מצגת על תפקידי הלוחמות. קצינה מדברת על זכויות וחובות.', 2600);
  await ui.fact(FACTS.briefing.title, FACTS.briefing.points);
  game.addMinutes(40);
  game.save('briefing');
}

async function bmi(game) {
  const { ui, staff, state } = game;
  await waitForCall(game, 'measure', 16);
  await goToRoom(game, 'measure', staff.measureMedic, 'measure', 'דברי עם החובשת');
  await scene(game, staff.measureMedic, () => ui.talk(staff.measureMedic.name, 'נעליים בצד, עלי על המשקל.'));
  state.body = await bmiCheck(ui);
  await ui.fact(FACTS.bmi.title, FACTS.bmi.points);
  game.hall.highlight = null;
  game.addMinutes(15);
  game.save('bmi');
}

async function talks(game) {
  const { ui, staff, state } = game;
  const people = { border: staff.interviewers.interview1, collection: staff.interviewers.interview2, rescue: staff.interviewers.interview3, elite: staff.dataClerk };
  for (const [key, person] of Object.entries(people)) person.name = TALKS[key].name;
  state.visited ??= [];
  await waitForCall(game, null, 10, 'שיחות עם לוחמות · חדרים 1–3 ודוכן היחידות');
  game.hall.highlight = null;
  for (;;) {
    const left = Object.keys(TALKS).filter((k) => !state.visited.includes(k));
    if (!left.length) break;
    ui.setObjective('שיחות עם לוחמות', `${state.visited.length} מתוך ${Object.keys(TALKS).length}${state.visited.length >= 2 ? ' · אפשר גם לסיים ולעבור לטופס' : ' · לפחות שתיים'}`);
    game.setTarget(null);
    const ids = left.map((k) => `talk-${k}`);
    if (state.visited.length >= 2) ids.push('proctor');
    const pick = await game.waitAnyInteract(ids);
    if (ids[pick] === 'proctor') break;
    const key = left[pick];
    const talk = TALKS[key];
    await scene(game, people[key], async () => {
      for (const line of talk.lines) await ui.talk(talk.name, line);
      const c = await ui.talk('אני', talk.question.q, talk.question.choices);
      await ui.talk(talk.name, talk.answers[c]);
    });
    state.visited.push(key);
    game.addMinutes(20);
    game.save('bmi');
  }
  if (state.visited.length === Object.keys(TALKS).length) unlock('lochamot-all');
  game.save('talks');
}

async function form(game) {
  const { ui, staff, state, player, world } = game;
  const { profile } = profileOf();
  state.profile = profile;
  ui.setObjective('לטופס ההעדפות', 'חדר המחשבים, עמדה 5');
  const station = world.daparStations.find((s) => s.number === 5);
  if (!inside(ROOM_BOUNDS.dapar)(player)) {
    game.setTarget({ x: ROOMS.dapar.door.x, y: 2.6, z: ROOMS.dapar.door.z });
    await game.waitZone(inside(ROOM_BOUNDS.dapar));
  }
  game.setTarget({ x: station.x - 0.8, y: 1.9, z: station.z });
  await game.waitInteract('dapar-seat');
  game.setTarget(null);
  player.sit({ x: station.x, z: station.z, taken: false, exit: { x: station.x + 0.6, z: station.z } }, Math.PI / 2);
  player.pitch = -0.25;
  state.ranking = await rankForm(ui, { profile, bmi: state.body?.bmi ?? 22 });
  player.standUp(false);
  await scene(game, staff.proctor, () => ui.talk(staff.proctor.name, 'נשלח. אפשר לשנות עד שבוע. בהצלחה!'));
  game.addMinutes(20);
  game.save('form');
}

// ---------- The answers ----------

/** Which route you get: the first one in your order that can be given now (the game's own rule). */
function placement(state) {
  const skipped = [];
  for (const id of state.ranking ?? []) {
    const route = ROUTES.find((r) => r.id === id);
    if (!route) continue;
    if (route.status === 'halted' || route.status === 'unknown') {
      skipped.push([route.name, SKIP_REASON[route.status]]);
      continue;
    }
    return { route, skipped };
  }
  return { route: ROUTES[0], skipped };
}

async function results(game) {
  const { ui, state, player } = game;
  player.teleport(0, 6, Math.PI);
  await ui.fact(FACTS.wait.title, FACTS.wait.points);
  await ui.interlude('שלושה שבועות אחר כך…', 1800);
  await smsPanel(ui, { from: 'צה״ל · מיונים', time: 'שלושה שבועות אחרי · 16:10', text: [`שלום, נמצאת מתאימה לשירות קרבי.`, 'השיבוץ יישלח בהמשך, לפי ההעדפות שמילאת.'] });
  await ui.interlude('כשלושה חודשים אחרי יום המיון…', 1800);
  const { route, skipped } = placement(state);
  const top = (state.ranking ?? []).slice(0, 3).includes(route.id);
  let headline = route.name;
  let detail = [];
  let next = null;
  if (route.status === 'field') {
    headline = `זימון ליום שדה · ${route.name}`;
    detail = ['ל־669, יהל״ם ומטכ״ל יש יום שדה לפני השיבוץ. לפי צה״ל (2023) הקריטריונים זהים לאלה של הבנים.', 'במשחק יום השדה הוא שלב יום הסיירות.'];
    next = { id: 'next', label: 'ליום השדה', href: '../yom-sayarot/?new=1&women=1' };
  } else if (route.status === 'oketz') {
    headline = 'חי״ר הגנת הגבולות, עם מסלול לעוקץ';
    detail = ['לפי אתרי הכנה ועדות מ־2021: לעוקץ נכנסים דרך הגבולות. מבחן כושר, ואז גיבוש של יומיים בטירונות: ספרינטים, שקים בעלייה, אלונקה, זחילות, הרצאה של חמש דקות, אוהל בארבע דקות וראיון.'];
  } else if (route.id === 'border') {
    detail = ['אחרי הגיוס: קורס מיון של שבועיים (לפי אתרי הכנה), ואז טירונות והכשרה בגדוד.'];
  } else {
    detail = ['הגיוס במחזור הבא: אוגוסט, נובמבר או מרץ.'];
  }
  if (!top) detail.push('זה לא באחת משלוש ההעדפות הראשונות שלך, כי הן לא היו זמינות.');
  const lines = [
    ['פרופיל', String(state.profile ?? 82)],
    ['BMI', String(state.body?.bmi ?? '—')],
    ['שיחות עם לוחמות', `${state.visited?.length ?? 0} מתוך 4`],
    ...skipped.map(([name, why]) => [name, why]),
  ];
  saveResults('lochamot', { outcome: headline, route: route.id });
  unlock('lochamot-done');
  if (route.status === 'field') unlock('lochamot-field');
  game.save('results');
  const buttons = [...(next ? [next] : []), { id: 'again', label: 'לנסות שוב', secondary: true }, { id: 'menu', label: 'לתפריט הראשי', secondary: true }];
  const choice = await answerPhone(ui, { from: 'צה״ל · שיבוץ', time: 'שלושה חודשים אחרי · 11:40', headline, detail, lines, note: 'הכלל שלפיו המשחק משבץ (ההעדפה הראשונה שזמינה) הוא של המשחק.', buttons });
  await ui.fact(FACTS.changes.title, FACTS.changes.points);
  await ui.fact(FACTS.women.title, FACTS.women.points);
  if (choice === 'again') {
    unlock('persistence');
    window.location.href = './?new=1';
  } else if (choice === 'next' && next) window.location.href = next.href;
  else window.location.href = '../main-screen/';
}

const HANDLERS = { arrive, briefing, bmi, talks, form, results };

export async function runFlow(game, startStep = 'arrive') {
  let i = STEPS.indexOf(startStep);
  for (; i < STEPS.length; i++) {
    const step = STEPS[i];
    game.state.step = step;
    try {
      await HANDLERS[step](game);
    } catch (error) {
      console.error(`step "${step}" failed`, error);
      game.ui.releaseAll?.();
      game.setTarget(null);
      game.player.standUp?.(false);
      game.ui.toast('משהו השתבש בחלק הזה, ממשיכים הלאה', 3000);
      game.save(step);
    }
  }
}
