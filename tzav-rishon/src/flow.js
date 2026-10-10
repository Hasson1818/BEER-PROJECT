import { ROOMS } from './world.js';
import { inHall, stationLabel } from './life.js';
import { chime, beep } from '../../shared/engine/audio.js';
import { FACTS, DATA_DIALOGUE, MEDICAL_QUESTIONS, INTERVIEW, STAFF_IDLE } from './content.js';
import { bagCheck, daparTest, measurements, visionTest, resultsPhone, learnMore } from './minigames.js';
import { saveResults } from '../../shared/save.js';

export const STEPS = ['arrive', 'routing', 'data', 'dapar', 'medical', 'interview', 'checkout', 'results'];

const ROOM_BOUNDS = {
  data: { minX: -26, maxX: -14, minZ: -19, maxZ: -12 },
  dapar: { minX: -26, maxX: -14, minZ: -30, maxZ: -19 },
  measure: { minX: 14, maxX: 26, minZ: -18, maxZ: -12 },
  vision: { minX: 14, maxX: 26, minZ: -24, maxZ: -18 },
  doctor: { minX: 14, maxX: 26, minZ: -30, maxZ: -24 },
  interview2: { minX: -4.7, maxX: 4.7, minZ: -38, maxZ: -30 },
};

const inside = (bounds) => (p) => p.x > bounds.minX && p.x < bounds.maxX && p.z > bounds.minZ && p.z < bounds.maxZ;
const above = (person, height = 2.25) => () => ({ x: person.position.x, y: height + person.body.position.y, z: person.position.z });

/** Talk to a staff member: keeps the dialogue open across several lines. */
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

/** Walk into a room, then talk to `person` (interaction id `id`). */
async function goToRoom(game, roomKey, person, id, objective) {
  const { ui } = game;
  const room = ROOMS[roomKey];
  const isInside = inside(ROOM_BOUNDS[roomKey]);
  if (!isInside(game.player)) {
    ui.setObjective(`גש ל${room.name} (${room.room})`, 'עקוב אחרי הסימן הצהוב');
    game.setTarget({ x: room.door.x, y: 2.6, z: room.door.z });
    await game.waitZone(isInside);
  }
  ui.setObjective(objective);
  game.setTarget(above(person));
  await game.waitInteract(id);
}

/** Sit in the waiting hall until your number shows up on the screens. */
async function waitForCall(game, roomKey, seconds) {
  const { ui, hall, player, state } = game;
  const room = ROOMS[roomKey];
  ui.setObjective('חכה באולם ההמתנה עד שהמספר שלך יופיע במסך', 'אפשר לשבת על כיסא, ככה הזמן עובר מהר יותר');
  game.setTarget({ x: 0, y: 2.6, z: -20 });
  game.station = null;
  let progress = 0;
  await game.waitUntil((dt) => {
    if (!inHall(player)) {
      ui.setObjectiveSub('חזור לאולם ההמתנה');
      return false;
    }
    progress += dt * (player.seat ? 4 : 1);
    game.addMinutes(dt * (player.seat ? 2.5 : 0.6));
    const ahead = Math.max(0, Math.ceil((1 - progress / seconds) * 4));
    hall.setPlayerWaiting(state.number, ahead);
    ui.setObjectiveSub(
      ahead > 0 ? `לפניך עוד ${ahead} מספרים במסך${player.seat ? '' : ' · אפשר לשבת על כיסא'}` : 'עוד רגע…',
    );
    return progress >= seconds;
  });
  hall.setPlayerWaiting(null);
  hall.highlight = state.number;
  hall.pushCalled(state.number, stationLabel(room));
  game.station = roomKey;
  chime();
  ui.announce(`מספר ${state.number}`, `נא לגשת ל${room.name} · ${room.room}`);
}

// ---------- Steps ----------

async function arrive(game) {
  const { ui, player, staff, world } = game;
  player.teleport(0, 8.5, 0);
  ui.setObjective('ארוז את התיק לצו ראשון');
  await ui.fadeIn();
  await bagCheck(ui);
  await ui.fact(FACTS.before.title, FACTS.before.points);

  ui.setObjective('היכנס ללשכת הגיוס', 'בכניסה יש בידוק ביטחוני');
  game.setTarget(above(staff.guard));
  await game.waitInteract('guard');
  await scene(game, staff.guard, async () => {
    await ui.talk('מאבטח', 'בוקר טוב! באת לצו ראשון?');
    await ui.talk('אני', 'כן, יש לי צו להיום ב־08:00.');
    const choice = await ui.talk('מאבטח', 'יופי. תפתח את התיק בבקשה, ותניח את הטלפון והמפתחות בסלסלה.', [
      'פותח את התיק ומניח את הטלפון בסלסלה',
      'יש לי רק מים וכריך, צריך גם את הטלפון?',
    ]);
    await ui.talk('מאבטח', choice === 0 ? 'תודה. עכשיו תעבור בשער.' : 'כן, גם את הטלפון. תודה. עכשיו תעבור בשער.');
  });

  world.openSecurity();
  ui.setObjective('עבור בשער הבידוק');
  game.setTarget({ x: 0, y: 2.7, z: -3 });
  await game.waitZone((p) => p.z < -3.4);
  beep();
  ui.toast('עברת את הבידוק. לקחת את הטלפון בחזרה.');
  game.addMinutes(5);
}

async function routing(game) {
  const { ui, queue, staff, state } = game;
  queue.playerNeeded = true;
  ui.setObjective('עמוד בסוף התור לעמדת הניתוב', 'בניתוב מציגים תעודה מזהה ומקבלים מדבקה');
  game.setTarget(() => (queue.playerIndex >= 0 ? null : { ...queue.endOfLine, y: 2.3 }));
  queue.onPlayerLeft = () => ui.toast('יצאת מהתור! עכשיו צריך לעמוד שוב בסוף.');

  const called = new Promise((resolve) => {
    queue.onPlayerCalled = resolve;
  });
  const stopTracking = game.every(() => {
    const index = queue.playerIndex;
    if (index > 0) ui.setObjectiveSub(`לפניך בתור: ${index} ${index === 1 ? 'אדם' : 'אנשים'}`);
    else if (index < 0) ui.setObjectiveSub('התור מתחיל בשלט "סוף התור"');
  });
  const windowIndex = await called;
  stopTracking();

  const clerk = staff.routingClerks[windowIndex];
  ui.announce('הבא בתור!', `עמדה ${windowIndex + 1} פנויה`);
  ui.setObjective(`גש לעמדה ${windowIndex + 1}`);
  game.setTarget(above(clerk, 2.0));
  await game.waitInteract(`window-${windowIndex}`);

  await scene(game, clerk, async () => {
    await ui.talk(clerk.name, 'בוקר טוב! תעודת זהות והצו, בבקשה.');
    await ui.talk('אני', 'הנה.', ['[מגיש תעודת זהות והצו]']);
    beep();
    await ui.talk(clerk.name, 'תודה… רגע, סורקת. יש. מילאת את "צו ברשת" ואת השאלון הרפואי, אז הכול מוכן.');
    ui.showSticker(state.number);
    await ui.talk(clerk.name, `זו המדבקה שלך עם הברקוד. תדביק אותה על החולצה, היא תלווה אותך כל היום. המספר שלך: ${state.number}.`);
    const ask = await ui.talk(clerk.name, 'עכשיו שב באולם ההמתנה ותסתכל על המסכים. כשהמספר שלך יופיע, לך לתחנה שכתובה לידו.', [
      'באיזה סדר הולכים בין התחנות?',
      'תודה רבה!',
    ]);
    if (ask === 0) {
      await ui.talk(clerk.name, 'זה משתנה לפי העומס, כדי שתחכה כמה שפחות. פשוט תסתכל על המסך. בסוף היום חוזרים אליי לסיום.');
    }
  });
  queue.playerServed();
  queue.onPlayerCalled = null;
  queue.onPlayerLeft = null;
  game.addMinutes(10);
  await ui.fact(FACTS.routing.title, FACTS.routing.points);
  game.save('routing');
}

async function data(game) {
  const { ui, staff, state } = game;
  await waitForCall(game, 'data', 20);
  await goToRoom(game, 'data', staff.dataClerk, 'data', 'שב מול פקידת אימות הנתונים');
  const d = DATA_DIALOGUE;
  await scene(game, staff.dataClerk, async () => {
    staff.dataClerk.setPose('sit-talk');
    await ui.talk(staff.dataClerk.name, d.intro);
    for (const key of ['address', 'family', 'education', 'hebrew']) {
      const part = d[key];
      const choice = await ui.talk(staff.dataClerk.name, part.question, part.choices);
      if (key === 'education') state.results.education = part.scores[choice];
      await ui.talk(staff.dataClerk.name, part.replies[choice]);
    }
    await ui.talk(staff.dataClerk.name, d.outro);
    staff.dataClerk.setPose('sit-type');
  });
  game.addMinutes(15);
  game.hall.highlight = null;
  await ui.fact(FACTS.data.title, FACTS.data.points);
  game.save('data');
}

async function dapar(game) {
  const { ui, staff, state, player, world } = game;
  await waitForCall(game, 'dapar', 22);
  await goToRoom(game, 'dapar', staff.proctor, 'proctor', 'דבר עם משגיח המבחנים');
  const name = staff.proctor.name;
  await scene(game, staff.proctor, async () => {
    await ui.talk(name, 'שלום! הגעת למבחן הממוחשב. לפני שמתחילים: את הטלפון שמים בלוקר, ומחשבון אסור.');
    await ui.talk(name, 'מקבלים דף טיוטה אחד ומחזירים אותו בסוף. אם צריך שירותים, אפשר לבקש הפסקה בין פרקים.');
    const choice = await ui.talk(name, 'המבחן אדפטיבי: כשעונים נכון, השאלות נהיות קשות יותר. שאלות?', [
      'אפשר להשאיר את הטלפון בכיס על שקט?',
      'הכול ברור, הטלפון בלוקר',
    ]);
    await ui.talk(name, choice === 0 ? 'לא, רק בלוקר. ככה זה לכולם.' : 'מעולה.');
    await ui.talk(name, 'אתה בעמדה 5. בהצלחה!');
  });

  const station = world.daparStations.find((s) => s.number === 5);
  ui.setObjective('שב בעמדה 5 והתחל את המבחן');
  game.setTarget({ x: station.x - 0.8, y: 1.9, z: station.z });
  await game.waitInteract('dapar-seat');
  game.setTarget(null);
  player.sit({ x: station.x, z: station.z, taken: false, exit: { x: station.x + 0.6, z: station.z } }, Math.PI / 2);
  player.pitch = -0.25;

  const result = await daparTest(ui, 5);
  const ratio = result.correct / result.total;
  state.results.dapar = Math.min(90, Math.max(10, Math.round(ratio * 8) * 10 + 10));
  state.results.attention = result.attention;
  player.standUp(false);
  await ui.interlude('כשעה אחר כך…', 2000);
  game.addMinutes(55);
  await scene(game, staff.proctor, async () => {
    await ui.talk(name, 'סיימת? תחזיר לי את דף הטיוטה ותיקח את הטלפון מהלוקר. אפשר לחזור לאולם ההמתנה.');
  });
  game.hall.highlight = null;
  await ui.fact(FACTS.dapar.title, FACTS.dapar.points);
  game.save('dapar');
}

async function medical(game) {
  const { ui, staff, state } = game;
  await waitForCall(game, 'measure', 20);

  await goToRoom(game, 'measure', staff.measureMedic, 'measure', 'דבר עם החובשת');
  const medic = staff.measureMedic;
  await scene(game, medic, async () => {
    await ui.talk(medic.name, 'היי! בבדיקות הרפואיות עוברים שלושה חדרים: מדידות, ראייה ורופא. יש לך את השאלון הרפואי החתום ואת בדיקת השתן?');
    const choice = await ui.talk(medic.name, 'תן לי אותם בבקשה.', ['הנה השאלון והבדיקה', 'השאלון פה, את בדיקת השתן שכחתי…']);
    if (choice === 1) {
      await ui.talk(medic.name, 'לא נורא. תיקח כוס, תמסור דגימה בשירותים ותשאיר אותה בחלון. נשלח למעבדה.');
      game.addMinutes(8);
    } else {
      await ui.talk(medic.name, 'מצוין, זה עובר לרופא.');
    }
    await ui.talk(medic.name, 'עכשיו נמדוד. תוריד נעליים ותעלה על המשקל, גב לסרגל.');
    state.results.measurements = await measurements(ui);
  });
  game.addMinutes(10);

  await goToRoom(game, 'vision', staff.visionMedic, 'vision', 'דבר עם החובש בבדיקת הראייה');
  await scene(game, staff.visionMedic, async () => {
    await ui.talk(staff.visionMedic.name, 'שלום! תעמוד על הקו הצהוב ותסתכל על הלוח. אם יש לך משקפיים, תרכיב אותם. אחר כך נבדוק עיוורון צבעים.');
    state.results.vision = await visionTest(ui);
  });
  game.addMinutes(10);

  await goToRoom(game, 'doctor', staff.doctor, 'doctor', 'שב מול רופא הוועדה');
  const doc = staff.doctor;
  await scene(game, doc, async () => {
    doc.setPose('sit-talk');
    const choice = await ui.talk(doc.name, MEDICAL_QUESTIONS.intro, MEDICAL_QUESTIONS.choices);
    await ui.talk(doc.name, MEDICAL_QUESTIONS.replies[choice]);
    await ui.talk(doc.name, MEDICAL_QUESTIONS.exam);
    await ui.interlude('הרופא מאזין ללב ולריאות ובודק גב, ברכיים ומפרקים…', 2400);
    if (choice === 3) {
      state.results.profile = 'זמני';
      await ui.talk(doc.name, 'סיימנו. בינתיים נרשם לך פרופיל זמני. כשתוצאות תפקודי הריאות יגיעו, הפרופיל ייקבע סופית.');
    } else {
      state.results.profile = 97;
      await ui.talk(doc.name, 'סיימנו. הפרופיל שלך הוא 97, הגבוה ביותר. אם פעם תחשוב שהפרופיל לא נכון, אפשר להגיש ערעור.');
    }
    doc.setPose('sit-type');
  });
  game.addMinutes(25);
  game.hall.highlight = null;
  await ui.fact(FACTS.medical.title, FACTS.medical.points);
  game.save('medical');
}

async function interview(game) {
  const { ui, staff, state, player, world } = game;
  await waitForCall(game, 'interview2', 24);
  const interviewer = staff.interviewers.interview2;
  await goToRoom(game, 'interview2', interviewer, 'interviewer', 'שב מול המאבחנת');

  const chair = world.spots.interview2.chair;
  player.sit({ x: chair.x, z: chair.z, taken: false, exit: { x: chair.x + 0.9, z: chair.z + 0.4 } }, 0);
  player.pitch = -0.08;
  let score = 0;
  let max = 0;
  let min = 0;
  await scene(game, interviewer, async () => {
    interviewer.setPose('sit-talk');
    await ui.talk(interviewer.name, INTERVIEW.intro, ['מוכן!']);
    const reactions = ['אוקיי.', 'הבנתי.', 'מעניין, תודה.', 'יופי.'];
    for (const question of INTERVIEW.questions) {
      const choice = await ui.talk(interviewer.name, question.q, question.choices);
      score += question.scores[choice];
      max += Math.max(...question.scores);
      min += Math.min(...question.scores);
      await ui.talk(interviewer.name, reactions[Math.floor(Math.random() * reactions.length)]);
    }
    await ui.talk(interviewer.name, INTERVIEW.outro);
    interviewer.setPose('sit');
  });
  state.results.interview = (score - min) / (max - min);
  player.standUp(false);
  await ui.interlude('הראיון נמשך כחצי שעה…', 2000);
  game.addMinutes(30);
  game.hall.highlight = null;
  await ui.fact(FACTS.interview.title, FACTS.interview.points);
  game.save('interview');
}

async function checkout(game) {
  const { ui, staff } = game;
  game.station = 'checkout';
  ui.setObjective('חזור לעמדת הניתוב כדי לסיים', 'שם מוודאים שעברת את כל התחנות');
  game.setTarget(above(staff.routingClerks[0], 2.0));
  const index = await game.waitAnyInteract(['window-0', 'window-1']);
  const clerk = staff.routingClerks[index];
  await scene(game, clerk, async () => {
    await ui.talk(clerk.name, 'היי! סיימת את כל התחנות? אני סורקת לך את המדבקה.');
    beep();
    await ui.talk(clerk.name, 'יש! אימות נתונים, מבחן ממוחשב, בדיקות רפואיות וראיון. הכול עבר. סיימת להיום!');
    await ui.talk(clerk.name, 'בעוד כשבועיים התוצאות יגיעו לאזור האישי באתר מתגייסים. אפשר ללכת הביתה. בהצלחה!');
  });
  game.addMinutes(5);
  ui.setObjective('צא מהלשכה', 'סיימת את הצו הראשון!');
  game.setTarget({ x: 0, y: 2.6, z: 1.5 });
  await game.waitZone((p) => p.z > 1.2);
  game.setTarget(null);
  game.save('checkout');
}

async function results(game) {
  const { ui, state } = game;
  const r = state.results;
  const d = ((r.dapar ?? 50) - 10) / 80;
  const k = 0.5 * d + 0.17 * (r.education ?? 0.7) + 0.33 * (r.interview ?? 0.6);
  r.kaba = Math.round(41 + k * 15);
  r.hebrew = r.hebrew ?? 8;
  r.profile = r.profile ?? 97;
  game.save('results');
  saveResults('tzav-rishon', r);
  await ui.interlude('שבועיים אחר כך…', 2200);
  const shown = { profile: r.profile, dapar: r.dapar ?? '—', kaba: r.kaba, hebrew: r.hebrew };
  await resultsPhone(ui, shown);
  await ui.fact(FACTS.end.title, FACTS.end.points);
  const choice = await learnMore(ui, shown);
  if (choice === 'again') window.location.href = './?new=1';
  else if (choice === 'next') window.location.href = '../yom-sayarot/?new=1';
  else window.location.href = '../main-screen/';
}

const HANDLERS = { arrive, routing, data, dapar, medical, interview, checkout, results };

export async function runFlow(game, startStep = 'arrive') {
  for (let i = STEPS.indexOf(startStep); i < STEPS.length; i++) {
    game.state.step = STEPS[i];
    await HANDLERS[STEPS[i]](game);
  }
}

/** Default lines for staff when it isn't their turn. */
export function idleLine(game, id) {
  const station = game.station;
  const map = {
    data: 'data',
    proctor: 'dapar',
    'dapar-seat': 'dapar',
    measure: 'measure',
    vision: 'measure',
    doctor: 'measure',
    interviewer: 'interview2',
  };
  const doneSteps = STEPS.slice(0, STEPS.indexOf(game.state.step));
  const finished = {
    data: doneSteps.includes('data'),
    dapar: doneSteps.includes('dapar'),
    measure: doneSteps.includes('medical'),
    interview2: doneSteps.includes('interview'),
  }[map[id]];
  if (finished) return STAFF_IDLE.done;
  if (station !== map[id]) return STAFF_IDLE.notYet;
  return 'כן? איך אפשר לעזור?';
}
