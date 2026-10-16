import * as THREE from 'three';
import { SPOTS, MARCH, RACK, HALL, height } from './world.js';
import { formation, sitRows, othersAt, headgear, active, line } from './team.js';
import {
  FACTS,
  DILEMMA_DAY1,
  WIKI_DEBATE,
  FRIEND_DILEMMA,
  AI_DEBATE,
  CROSSING,
  MAP_PLACES,
  OUTCOMES,
  QUIT_OUTCOME,
  RUN_FAIL_OUTCOME,
  MY_NUMBER,
  CLASS_NAME,
} from './content.js';
import {
  summons,
  busRide,
  medicStation,
  gearIssue,
  dressCheck,
  badachTest,
  badachDuel,
  einstein,
  attackPlan,
  scoutTent,
  checkers,
  bunker,
  sudoku,
  rescuePlan,
  traits,
  selfReport,
  sociometric,
  resultsPhone,
} from './minigames.js';
import { formatTime } from './drills.js';
import { mapTask } from '../../shared/engine/map-task.js';
import { loadResults, saveResults } from '../../shared/save.js';

// Five days, Sunday to Thursday, results on the following Sunday.
export const STEPS = ['arrive', 'intake', 'run', 'playground', 'crawls', 'day2', 'plan', 'night2', 'day3', 'night3', 'day4', 'night4', 'day5', 'results'];

const above = (person, extra = 2.3) => () => ({ x: person.position.x, y: person.position.y + extra, z: person.position.z });
const groundTarget = (spot, extra = 2.2) => ({ x: spot.x, y: height(spot.x, spot.z) + extra, z: spot.z });
const near = (spot, r) => (p) => Math.hypot(p.x - spot.x, p.z - spot.z) < r;
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

async function walkTo(game, spot, objective, sub = '', radius = 2.5) {
  game.ui.setObjective(objective, sub);
  game.setTarget(groundTarget(spot));
  await game.waitZone(near(spot, radius));
  game.setTarget(null);
}

/** Stand the class in a ח׳ with the מ״כ at the open side; puts the player in their slot. */
function standInFormation(game, spot, facing = 0, pose = 'stand') {
  const { people, player } = game;
  const f = formation(people, spot.x, spot.z, facing, pose);
  people.staff.mc.group.visible = true;
  people.staff.mc.stop('arms-crossed');
  people.staff.mc.place(f.mc.x, f.mc.z, f.mcFacing);
  people.staff.mc2.group.visible = true;
  people.staff.mc2.stop('clipboard');
  people.staff.mc2.place(f.mc.x + 1.4 * Math.cos(facing), f.mc.z - 1.4 * Math.sin(facing), f.mcFacing);
  player.teleport(f.mine.x, f.mine.z, 0);
  player.faceTowards(f.mc.x, f.mc.z, 1.5);
  return f;
}

const shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

/** Ask with scored options [{ text, score }] in random order; resolves to the chosen option. */
async function ask(game, speaker, question, options) {
  const order = shuffle(options);
  const choice = await game.ui.talk(speaker, question, order.map((o) => o.text));
  return order[choice];
}

/** A discussion: one question, choices scored for how you take part. */
async function discuss(game, speaker, topic, choices, key) {
  const { ui, state } = game;
  await ui.talk(speaker, topic);
  const { score } = await ask(game, 'אני', 'מה אתה אומר?', choices);
  (state.talks ??= {})[key] = score;
  return score;
}

async function selfReportScene(game) {
  const { ui, people, state } = game;
  const mc = people.staff.mc;
  const reported = await selfReport(ui, state.violations ?? [], mc.name);
  for (const v of reported) v.reported = true;
  const hidden = (state.violations ?? []).filter((v) => !v.reported && !v.asked);
  for (const v of state.violations ?? []) v.asked = true;
  state.reports = (state.reports ?? 0) + reported.length;
  if (reported.length) {
    await talkScene(game, mc, async () => {
      await ui.talk(mc.name, `${MY_NUMBER}. רשמתי. לשורה.`);
    });
  }
  // Some of what you hid was seen.
  const seen = hidden.filter((v) => v.seen);
  state.caught = (state.caught ?? 0) + seen.length;
  state.hidden = (state.hidden ?? 0) + hidden.length;
  if (seen.length) {
    await talkScene(game, mc, async () => {
      await ui.talk(mc.name, `${MY_NUMBER}, ראיתי אותך: ${seen[0].text}. לא ניגשת לדווח.`);
      await ui.talk('אני', '…', ['[שותק]']);
      await ui.talk(mc.name, 'רשמתי.');
    });
  }
}

async function badachMoment(game, procId, opts = {}) {
  const { ui, state } = game;
  const r = await badachTest(ui, procId, opts);
  (state.badach ??= []).push(r);
  return r;
}

// ---------- Day 1 (Sunday) ----------

async function arrive(game) {
  const { ui, sky, state } = game;
  sky.setTime('day');
  game.setDay(1, 'בוקר');
  ui.setObjective('בדרך לגיבוש טיס', 'תחנת הרכבת באופקים');
  game.player.teleport(SPOTS.hallStart.x, SPOTS.hallStart.z, Math.PI / 2);
  await ui.fadeIn();
  await summons(ui, loadResults('tzav-rishon'));
  await ui.fact(FACTS.before.title, FACTS.before.points);
  await ui.fadeOut();
  document.body.classList.add('on-bus');
  await ui.interlude('יום ראשון · תחנת הרכבת באופקים', 2200);
  await busRide(ui);
  game.badachDay = 1;
  game.hud.setGear(true);
  await ui.fact(FACTS.bus.title, FACTS.bus.points);
  state.silence = true;
  game.save('arrive');
}

async function intake(game) {
  const { ui, people, player, state, sky } = game;
  sky.setTime('day');
  game.setDay(1, 'צהריים');
  othersAt(people, 'hall');
  // Your class waits on the mats.
  sitRows(active(people), SPOTS.classMat.x, SPOTS.classMat.z + 3, Math.PI, 'sit-east', 8);
  player.teleport(HALL.x - HALL.w / 2 + 3, HALL.z, -Math.PI / 2);
  await ui.fadeOut();
  document.body.classList.remove('on-bus');
  await ui.interlude('חצרים · אולם הספורט', 1800);

  // Station 1: medic and doctor.
  await goTalk(game, people.staff.medic, 'medic', 'גש לחובש ולרופאה', 'בדיקה רפואית וחותמת');
  await talkScene(game, people.staff.medic, async () => {
    await ui.talk(people.staff.medic.name, 'טופס רפואי? יד ימין. אני מודד דופק וחום.');
    await medicStation(ui);
  });

  // Station 2: uniforms.
  await goTalk(game, people.staff.quartermaster, 'quartermaster', 'קח מדים', 'מכנסיים, חולצה, חגורה, כובע ומעיל');
  await talkScene(game, people.staff.quartermaster, async () => {
    await ui.talk(people.staff.quartermaster.name, 'מידה? קח. מתלבשים עכשיו, חולצה בתוך המכנסיים. את הבגדים שלך לשקית.');
  });
  await ui.interlude('מחליף למדי ב׳…', 1400);

  // Station 3: helmet and the iron rules.
  await goTalk(game, people.staff.sergeant, 'sergeant', 'קח קסדה', 'סמל הגיבוש מחלק');
  await talkScene(game, people.staff.sergeant, async () => {
    await ui.talk(people.staff.sergeant.name, 'קסדה. היא, הבקבוק והחוברת עליך כל הגיבוש, גם בשירותים. זה נקרא דיגום.');
  });

  // Class assignment.
  const mc = people.staff.mc;
  mc.place(SPOTS.classMat.x, SPOTS.classMat.z, Math.PI).setPose('arms-crossed');
  await goTalk(game, mc, 'mc', 'גש למ״כ של הכיתה', 'החלוקה לכיתות');
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, `${CLASS_NAME}. אתה מספר ${MY_NUMBER}. תכתוב את המספר על הכותפות.`);
    game.hud.setNumber(MY_NUMBER);
    const knows = await ui.talk(mc.name, 'אתה מכיר מישהו בכיתה הזאת? או מישהו מהסגל?', ['לא, אף אחד', 'כן, את אחד המתגבשים מהשכונה']);
    if (knows === 1) {
      await ui.talk(mc.name, 'תודה שאמרת. עובר לכיתה 5. אותו מספר.');
      state.movedClass = true;
    } else {
      await ui.talk(mc.name, 'טוב.');
    }
    await ui.talk(mc.name, 'הטלפון כבר אצלנו. את התיק האישי שמים במכולה בחוץ. מקבלים אותו ביום חמישי.');
  });

  // The opening talk.
  sitRows(active(people), SPOTS.stage.x - 7, SPOTS.stage.z - 3, Math.PI / 2, 'sit-east', 8);
  player.teleport(SPOTS.stage.x - 8.2, SPOTS.stage.z + 3.2, Math.PI / 2);
  player.sit({ x: SPOTS.stage.x - 8.2, z: SPOTS.stage.z + 3.2, taken: false, eye: 0.85, exit: { x: SPOTS.stage.x - 9, z: SPOTS.stage.z + 3.2 } }, -Math.PI / 2);
  const commander = people.staff.commander;
  await talkScene(game, commander, async () => {
    await ui.talk(commander.name, 'שלום לכולם. אתם בגיבוש טיס. השם המקצועי שלו הוא "מבחן מצב".');
    await ui.talk(commander.name, 'כללים: דממה. מדברים רק כשאומרים לכם. יושבים רק בישיבה מזרחית. בקבוק, קסדה וחוברת עליכם תמיד.');
    await ui.talk(commander.name, '"קוד 2": מתיישבים בצד ולומדים בד״ח. ומי שעבר על כלל, ניגש למ״כ ומספר. אנחנו צריכים אנשים שאפשר לסמוך על הדיווח שלהם.');
    await ui.talk(commander.name, 'המפקדים כאן לא יעודדו אתכם ולא יצעקו. הם רושמים. בהצלחה.');
  });
  player.standUp(false);
  await ui.fact(FACTS.intake.title, FACTS.intake.points);

  // Personal bag into the container.
  await walkTo(game, SPOTS.container, 'שים את התיק האישי במכולה', 'בחוץ, ליד האולם', 3);
  await ui.interlude('התיק במכולה. מתחממים לריצה…', 1600);
  game.save('intake');
}

async function run(game) {
  const { ui, people, drills, state, sky } = game;
  sky.setTime('afternoon');
  game.setDay(1, 'אחר הצהריים');
  othersAt(people, 'camp');
  headgear(people, 'helmet');
  const mc = people.staff.mc;
  ui.setObjective('ריצת ניפוי', '1,000 מטר. מי שלא עומד ברף, מסיים כאן');
  mc.place(SPOTS.runStart.x - 2, SPOTS.runStart.z - 4, -Math.PI / 2).setPose('arms-crossed');
  game.player.teleport(SPOTS.runStart.x + 2, SPOTS.runStart.z + 3, -Math.PI / 2);
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, 'ריצת ניפוי. 1,000 מטר: עד הקונוס הכתום וחזרה. מהר ככל האפשר.');
  });
  let result = await drills.screeningRun();
  while (!result.passed) {
    const choice = await ui.talk(mc.name, `${formatTime(result.time)}. מעל הרף. במציאות הגיבוש שלך נגמר כאן.`, ['לנסות שוב (רק במשחק)', 'לסיים את הגיבוש']);
    if (choice === 1) {
      state.failedRun = true;
      game.save('day5');
      game.jumpTo('results');
      return;
    }
    result = await drills.screeningRun();
  }
  ui.announce(`עברת: ${formatTime(result.time)}`, 'עמדת ברף של ריצת הניפוי');
  await ui.fact(FACTS.run.title, FACTS.run.points);

  // Equipment.
  const qm = people.staff.quartermaster;
  qm.place(SPOTS.gear.x, SPOTS.gear.z - 2.1, 0).setPose('clipboard');
  game.player.teleport(SPOTS.gear.x - 1, SPOTS.gear.z + 4, Math.PI);
  await goTalk(game, qm, 'quartermaster', 'קבל ציוד באפסנאות', 'קיטבג, תד״ל, שק״ש, מזרן');
  state.gear = await talkScene(game, qm, () => gearIssue(ui));
  game.save('run');
}

async function playground(game) {
  const { ui, people, drills, state, sky } = game;
  sky.setTime('afternoon');
  game.setDay(1, 'אחר הצהריים');
  othersAt(people, 'field');
  const mc = people.staff.mc;
  const f = standInFormation(game, { x: RACK.x + 7, z: RACK.z + 1 }, -Math.PI / 2);
  // First oral test, without warning.
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, `${MY_NUMBER}. בד״ח מכת חום.`);
  });
  const heat = await badachMoment(game, 'heat');
  if (heat.crashed) ui.toast('המ״כ רושם משהו ועובר לבא בתור.', 2400);

  // First discussion.
  sitRows(active(people), f.mine.x, f.mine.z, -Math.PI / 2, 'sit-east', 8);
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, 'דיון. יש לכם עשר דקות. אין תשובה נכונה. מותר לדבר.');
    await discuss(game, mc.name, DILEMMA_DAY1.topic, DILEMMA_DAY1.choices, 'dilemma1');
    const dominant = active(people).find((p) => p.info.trait === 'dominant');
    if (dominant) await ui.talk(dominant.name, 'אני חושב שזה ברור, ומי שחושב אחרת פשוט לא מבין את המצב…');
    await ui.talk(mc.name, 'זמן. דממה.');
  });
  await ui.fact(FACTS.debates.title, FACTS.debates.points);

  // The plum rack.
  game.player.teleport(RACK.x + 4, RACK.z + 2, -Math.PI / 2);
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, 'מתלה שזיפים. כל אחד מתחת למוט שלו. תלייה ממושכת, פנים פנימה. מי שנופל, יורד לשורה.');
  });
  await drills.plumRack(mc.name);
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, `מתלה קבוצתי. כל הזמן לפחות 9 תלויים. מותר לרדת לנוח, אבל אם יורדים מתחת ל־9, מתחילים מחדש.`);
  });
  const group = await drills.groupHang(45, 9);
  ui.announce(group.success ? 'עמדתם במשימה' : 'לא עמדתם במשימה', `התחלתם מחדש ${group.resets} פעמים`);
  await ui.fact(FACTS.rack.title, FACTS.rack.points);
  game.save('playground');
}

async function crawls(game) {
  const { ui, people, drills, sky, state } = game;
  sky.setTime('dusk');
  game.setDay(1, 'לפני השקיעה');
  othersAt(people, 'field');
  const mc = people.staff.mc;
  mc.place(SPOTS.crawlStart.x - 8, SPOTS.crawlStart.z + 2, Math.PI / 2).setPose('arms-crossed');
  line(active(people), SPOTS.crawlStart.x, SPOTS.crawlStart.z + 2, Math.PI);
  game.player.teleport(SPOTS.crawlStart.x - 1, SPOTS.crawlStart.z + 4, Math.PI);
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, 'זחילות. עד השקים וחזרה לקו. לא מרימים ישבן ולא נוגעים בזוחל שלידך. אחרי כל מקצה, שורה לפי סדר ההגעה.');
  });
  await drills.crawlHeats(4, { staffName: mc.name });
  await ui.fact(FACTS.crawl.title, FACTS.crawl.points);

  sky.setTime('night');
  game.setDay(1, 'לילה');
  othersAt(people, 'night');
  await ui.interlude('ארוחת ערב חמה: מגש עם בשר וקוסקוס. ואז לאוהל הכיתתי.', 2600);
  sitRows(active(people), SPOTS.tent.x, SPOTS.tent.z - 1.5, 0, 'sit-ground', 8);
  game.player.teleport(SPOTS.tent.x + 4, SPOTS.tent.z + 1.5, -Math.PI / 2);
  await ui.interlude('לילה 1 · ישנים בתחתונים ובגרביים על מיטות שטח. הלילה עובר בלי הקפצה.', 3000);
  game.save('crawls');
}

// ---------- Day 2 (Monday) ----------

async function day2(game) {
  const { ui, people, drills, sky, state } = game;
  sky.setTime('predawn');
  game.setDay(2, 'לפני הזריחה');
  othersAt(people, 'camp');
  game.player.teleport(SPOTS.tent.x, SPOTS.tent.z, Math.PI);
  await ui.interlude('שקט… ואז מגאפון: "הקפצה! דיגום מלא, ח׳ כיתתית!"', 2400);
  const dress = await dressCheck(ui, 9);
  if (dress.missing.length) {
    for (const item of dress.missing) game.violation('dress', `יצאתי להקפצה בלי: ${item}`, Math.random() < 0.6);
    ui.toast(`יצאת בלי: ${dress.missing.join(', ')}`, 3000);
  }
  state.dress = [...(state.dress ?? []), dress];
  headgear(people, 'helmet');
  standInFormation(game, SPOTS.form, 0);
  const mc = people.staff.mc;
  await drills.burningGround(12, mc.name);
  await ui.fact(FACTS.popup.title, FACTS.popup.points);

  // Self report.
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, 'מי שעבר על כלל מאז אתמול, ניגש אליי עכשיו.');
  });
  await selfReportScene(game);
  await ui.fact(FACTS.honesty.title, FACTS.honesty.points);

  sky.setTime('dawn');
  game.setDay(2, 'זריחה');
  await ui.interlude('ארוחת בוקר: ביצה קשה, לחם, יוגורט וריבה. ובכל דקה פנויה: בד״ח.', 2400);
  game.badachDay = 2;
  ui.toast('בחוברת נוספו שני נהלים: נזילת דלק ונטישה (מקש B / 📘)', 3200);

  // Group task in the playground.
  sky.setTime('day');
  game.setDay(2, 'בוקר');
  othersAt(people, 'field');
  standInFormation(game, { x: SPOTS.planks.x + 9, z: SPOTS.planks.z }, -Math.PI / 2);
  const leader = active(people).find((p) => p.info.trait === 'leader');
  let team = 0;
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, CROSSING.intro);
    if (leader) await ui.talk(leader.name, 'יש למישהו רעיון? בואו נשמע שניים־שלושה ונחליט.');
    const plan = await ask(game, 'אני', 'מה אתה מציע?', CROSSING.plans);
    team += plan.score;
    if (plan === CROSSING.plans[0]) await ui.talk(leader?.name ?? 'יואב', 'מעולה, הולכים על זה.');
    else await ui.talk(leader?.name ?? 'יואב', 'רגע, איתי, מה אתה חושב? …אוקיי, החבית באמצע ומסובבים את הקרש. הולכים על זה.');
    team += (await ask(game, 'אני', 'מה התפקיד שלך?', CROSSING.roles)).score;
  });
  await ui.interlude('הקרש מהמשטח לחבית… עוברים אחד־אחד… מסובבים… עוד אחד…', 2400);
  ui.announce(team > 1.6 ? 'כל הכיתה עברה!' : 'עברתם, עם שתי נגיעות בקרקע', 'המ״כ רושם');
  (state.talks ??= {}).crossing = team / 2;

  // Einstein riddle.
  sitRows(active(people), SPOTS.planks.x + 9, SPOTS.planks.z, -Math.PI / 2, 'sit-east', 8);
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, 'חידה. לכל אחד יש רמזים אחרים. שתי דקות וחצי. מותר לדבר.');
    const method = await ui.talk('אני', 'איך אתה מתחיל?', [
      'מציע שיטה: כל אחד אומר רמז, ואנחנו "מעמידים אנשים" על כל טייס, מטוס ובסיס',
      'צועק את הרמזים שלי שוב ושוב',
      'שותק ופותר לבד בראש',
    ]);
    (state.talks ??= {}).einsteinMethod = [1, 0.3, 0.5][method];
  });
  state.einstein = await einstein(game.ui);
  await ui.fact(FACTS.thinking.title, FACTS.thinking.points);
  game.save('day2');
}

async function plan(game) {
  const { ui, people, sky, state } = game;
  sky.setTime('day');
  game.setDay(2, 'צהריים');
  const mc = people.staff.mc;
  const mc2 = people.staff.mc2;
  othersAt(people, 'field');
  sitRows(active(people), SPOTS.logs.x + 4, SPOTS.logs.z + 8, Math.PI / 2, 'sit-read', 8);
  game.player.teleport(SPOTS.logs.x + 2, SPOTS.logs.z + 6, -Math.PI / 2);
  mc2.place(SPOTS.logs.x, SPOTS.logs.z + 6, Math.PI / 2).setPose('clipboard');
  await ui.interlude('ארוחת צהריים מקופסאות: טונה, תירס, חלבה ולחם. קוד 2 עד הקריאה הבאה.', 2400);
  await talkScene(game, mc2, async () => {
    await ui.talk(mc2.name, `${MY_NUMBER}, אליי. שני עמודים. יש לך זמן קצר לתכנן תקיפה, ואז אתה מציג לי.`);
  });
  state.attack = await attackPlan(ui);
  await talkScene(game, mc2, async () => {
    await ui.talk(mc2.name, 'רשמתי. תחזור לשורה.');
  });

  // Debate in two groups.
  const dominant = active(people).find((p) => p.info.trait === 'dominant');
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, WIKI_DEBATE.topic);
    let total = 0;
    for (const round of WIKI_DEBATE.rounds) {
      if (round === WIKI_DEBATE.rounds[1] && dominant) await ui.talk(dominant.name, 'מה פתאום אמינה?! כל אחד יכול לכתוב שם מה שהוא רוצה!');
      total += (await ask(game, 'אני', round.q, round.choices)).score;
    }
    (state.talks ??= {}).wiki = total / WIKI_DEBATE.rounds.length;
    await ui.talk(mc.name, 'מספיק. דממה.');
  });

  // Scout tent in pairs, as fast as possible.
  const partner = active(people).find((p) => p.info.trait === 'helper') ?? active(people)[0];
  line(active(people), SPOTS.night.x, SPOTS.night.z + 6, Math.PI);
  game.player.teleport(SPOTS.night.x + 1, SPOTS.night.z + 4, Math.PI);
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, `זוגות. ${MY_NUMBER} עם ${partner.info.number}. אוהל סיירים מהתד״ל. הזוג הראשון מנצח. עכשיו.`);
  });
  state.tentDay = await scoutTent(ui, partner.info.name, 40);
  await ui.fact(FACTS.tent.title, FACTS.tent.points);
  game.save('plan');
}

async function night2(game) {
  const { ui, people, drills, sky, state } = game;
  sky.setTime('night');
  game.setDay(2, 'לילה');
  othersAt(people, 'night');
  const mc = people.staff.mc;
  await ui.interlude('ארוחת ערב: אורז, קציצות ואפונה. כיבוי אורות…', 2400);
  await ui.interlude('חצי שעה אחר כך: "הקפצה! כל ציוד השינה עליכם!"', 2400);
  headgear(people, 'helmet');
  // A classmate whispers to you in the dark.
  const hider = active(people).find((p) => p.info.trait === 'hider');
  game.player.teleport(MARCH[0].x, MARCH[0].z + 4, Math.PI);
  if (hider) {
    const answer = await ui.talk(hider.name, '(לוחש) ששש… אתה יודע לאן הולכים?', ['לא עונה. דממה.', '(לוחש) אין לי מושג, אחי']);
    if (answer === 1) game.violation('talk', 'דיברתי עם חבר בזמן דממה', Math.random() < 0.5);
  }
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, 'טור. אחריי. אף אחד לא נשאר מאחור.');
  });
  await drills.nightMarch(mc.name);
  const partner = active(people).find((p) => p.info.trait === 'steady') ?? active(people)[0];
  state.tentNight = await scoutTent(ui, partner.info.name, 45);
  // A discussion in the dark before sleeping.
  sitRows(active(people), SPOTS.night.x, SPOTS.night.z + 1, Math.PI, 'sit-east', 8);
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, 'לפני שינה: דיון. מותר לדבר.');
    await ui.talk(mc.name, FRIEND_DILEMMA.topic);
    const first = await ask(game, 'אני', 'מה אתה אומר?', FRIEND_DILEMMA.first);
    await ui.talk(mc.name, FRIEND_DILEMMA.change);
    const second = await ask(game, 'אני', 'ועכשיו?', FRIEND_DILEMMA.second);
    (state.talks ??= {}).friend = (first.score + second.score) / 2;
    await ui.talk(mc.name, 'דממה. לישון.');
  });
  await ui.interlude('שינה באוהל סיירים, בזוגות, במדים ובלי נעליים…', 2600);
  await ui.interlude('הקפצה שנייה: מפרקים, חוזרים למאהל ומקימים מחדש. שינה עד הבוקר.', 2800);
  game.save('night2');
}

// ---------- Day 3 (Tuesday): the physical day ----------

async function day3(game) {
  const { ui, people, drills, sky, state } = game;
  sky.setTime('dawn');
  game.setDay(3, 'בוקר');
  othersAt(people, 'field');
  headgear(people, 'helmet');
  const mc = people.staff.mc;
  await ui.interlude('יום שלישי · "היום הפיזי". מקפלים, ארוחת בוקר, ויוצאים לגבעה.', 2400);
  game.badachDay = 3;

  // Walking tzukon.
  mc.place(SPOTS.fill.x + 6, SPOTS.fill.z + 1, -Math.PI / 2).setPose('arms-crossed');
  line(active(people), SPOTS.fill.x, SPOTS.fill.z + 2.5, Math.PI);
  game.player.teleport(SPOTS.fill.x + 2, SPOTS.fill.z + 5, Math.PI);
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, 'צוקון בהליכה. ממלאים שק, עולים לראש הגבעה, ושופכים לערימה האישית שלכם, עם המספר, או לערימה הכיתתית. רק הליכה.');
  });
  sky.setTime('day');
  const tz = await drills.tzukon(110, mc.name);
  ui.announce(`תרמת ${tz.total} שקים`, `${tz.mine} לערימה שלך · ${tz.shared} לכיתתית · מקום ${tz.rank} בכיתה`);
  await ui.fact(FACTS.tzukon.title, FACTS.tzukon.points);

  // Sociometric stretcher.
  game.player.teleport(SPOTS.sprintStart.x, SPOTS.sprintStart.z + 4, Math.PI);
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, 'אלונקה סוציומטרית. ספרינט עד הקונוס וחזרה. ארבעת הראשונים לוקחים את האלונקה לסיבוב.');
  });
  await drills.stretcherDrill(4, mc.name);
  await ui.fact(FACTS.stretcher.title, FACTS.stretcher.points);

  // Quitter.
  const quitter = active(people).find((p) => p.info.trait === 'quitter');
  if (quitter) {
    quitter.info.out = true;
    quitter.stop('sit-ground');
    quitter.place(SPOTS.sprintStart.x - 8, SPOTS.sprintStart.z + 6, 0);
    ui.toast(`${quitter.name} ניגש לחובש וחתם על ויתור.`, 3200);
  }

  // Human checkers.
  standInFormation(game, { x: SPOTS.board.x, z: SPOTS.board.z + 6 }, Math.PI);
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, 'דמקה אנושית. אתם הכלים, עם שק על הכתפיים. כיתה 4 מול כיתה 3.');
  });
  game.drills.stats.checkers = await checkers(ui);
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, `${MY_NUMBER}, אין מלכות. אתה יוצא מהמשחק, ואחד מכיתה 3 נכנס במקומך.`);
    const r = await ui.talk('אני', 'מה אתה עושה?', ['"קיבלתי." יוצא, ועוזר לכיתה מהצד כשמותר לדבר', '"אבל זה לא היה בחוקים!"', 'יוצא ומפסיק להתעניין במשחק']);
    (state.talks ??= {}).checkers = [1, 0.2, 0.3][r];
  });
  await ui.fact(FACTS.checkers.title, FACTS.checkers.points);

  // A new בד״ח with five minutes to learn, then a duel.
  ui.toast('דף בד״ח חדש: התחממות מנוע. חמש דקות ללמוד (מקש B / 📘)', 3600);
  sitRows(active(people), SPOTS.board.x + 2, SPOTS.board.z + 10, Math.PI, 'sit-read', 8);
  game.player.teleport(SPOTS.board.x - 2, SPOTS.board.z + 12, Math.PI);
  await game.studyBreak(45, 'קוד 2 · חמש דקות ללמוד את הבד״ח החדש');
  await badachMoment(game, 'overheat', { speaker: mc.name, title: 'בד״ח חדש' });
  const rival = active(people).find((p) => p.info.trait === 'smart') ?? active(people)[0];
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, `דו־קרב. ${MY_NUMBER} מול ${rival.info.number}. בד״ח נזילת דלק. שורה שורה, בתורות.`);
  });
  state.duel = await badachDuel(ui, 'fuel', rival.info.name);
  await ui.fact(FACTS.badach.title, FACTS.badach.points);

  // Class against class.
  sitRows(active(people), SPOTS.logs.x + 4, SPOTS.logs.z + 8, Math.PI / 2, 'sit-east', 8);
  game.player.teleport(SPOTS.logs.x + 2, SPOTS.logs.z + 6, -Math.PI / 2);
  await talkScene(game, mc, async () => {
    await discuss(game, mc.name, AI_DEBATE.topic, AI_DEBATE.choices, 'ai');
    await ui.talk(mc.name, 'עכשיו כל אחד לבד: יש מקום במקלט רק לשבעה.');
  });
  state.bunker = await bunker(ui);
  game.save('day3');
}

async function night3(game) {
  const { ui, people, drills, sky, state } = game;
  sky.setTime('night');
  game.setDay(3, 'לילה');
  othersAt(people, 'night');
  const mc = people.staff.mc;
  await ui.interlude('לחם וריבה, ושינה מוקדמת…', 2000);
  await ui.interlude('הקפצה! בריכת הזחילות, מתחת לפרוז׳קטורים.', 2200);
  headgear(people, 'helmet');
  line(active(people), SPOTS.crawlStart.x, SPOTS.crawlStart.z + 2, Math.PI);
  mc.place(SPOTS.crawlStart.x - 8, SPOTS.crawlStart.z + 2, Math.PI / 2).setPose('arms-crossed');
  game.player.teleport(SPOTS.crawlStart.x - 1, SPOTS.crawlStart.z + 4, Math.PI);
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, 'זחילות. עד שש עשרה. מי שצריך חובש או הפסקה, יגיד.');
  });
  await drills.crawlHeats(3, { staffName: mc.name, title: 'זחילות לילה' });
  // The question that decides a lot.
  await talkScene(game, mc, async () => {
    const choice = await ui.talk(mc.name, 'עוד שלושה עשר מקצים. מישהו רוצה חובש? הפסקה?', [
      'ממשיך',
      'אני צריך הפסקה',
      'אני רוצה לחתום על ויתור',
    ]);
    if (choice === 1) {
      state.tookBreak = true;
      await ui.talk(mc.name, 'שב בצד. רשמתי.');
    }
    if (choice === 2) {
      const sure = await ui.talk(mc.name, 'אתה בטוח? אחרי שחותמים אין חזרה.', ['כן, אני חותם', 'לא, אני ממשיך']);
      if (sure === 0) state.quit = true;
    }
  });
  if (state.quit) {
    game.save('day5');
    game.jumpTo('results');
    return;
  }
  if (!state.tookBreak) await drills.crawlHeats(2, { staffName: mc.name, title: 'זחילות לילה' });
  await ui.interlude(state.tookBreak ? 'יושב בצד ומסתכל על הכיתה זוחלת עד שש עשרה…' : '…ועוד אחד־עשר מקצים. הידיים שרוטות מהחול.', 2600);
  await ui.interlude('חזרה לאוהלים. שינה.', 1800);
  game.save('night3');
}

// ---------- Day 4 (Wednesday) ----------

async function day4(game) {
  const { ui, people, drills, sky, state } = game;
  sky.setTime('dawn');
  game.setDay(4, 'בוקר');
  othersAt(people, 'field');
  headgear(people, 'helmet');
  const mc = people.staff.mc;
  await ui.interlude('יום רביעי. השכמה מאוחרת יחסית, באור יום.', 2000);
  standInFormation(game, SPOTS.form, 0);
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, 'מי שעבר על כלל ועוד לא דיווח, זה הזמן.');
  });
  await selfReportScene(game);

  // Digging: personal pit and class pit, then under the fence.
  sky.setTime('day');
  game.setDay(4, 'בוקר');
  mc.place(SPOTS.dig.x - 1.5, SPOTS.dig.z + 3.6, Math.PI).setPose('clipboard');
  game.player.teleport(SPOTS.dig.x - 3, SPOTS.dig.z + 7, Math.PI);
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, `${MY_NUMBER}, הריבוע הזה שלך. הבור הכתום הוא של כל הכיתה. תחלקו את הכוח איך שאתם רוצים.`);
  });
  const dig = await drills.digDrill(55, mc.name);
  ui.announce(`חפרת ${dig.total} פעמים`, `${Math.round(dig.share * 100)}% מהן בבור הכיתתי`);
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, 'גדר. עוברים מתחתיה בלי לגעת. מי שנוגע מתחיל מחדש.');
  });
  await drills.fenceDig(mc.name);
  await ui.fact(FACTS.dig.title, FACTS.dig.points);

  // Sudoku while walking.
  sitRows(active(people), SPOTS.logs.x + 4, SPOTS.logs.z + 8, Math.PI / 2, 'sit-east', 8);
  game.player.teleport(SPOTS.logs.x + 2, SPOTS.logs.z + 6, -Math.PI / 2);
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, 'כל אחד מקבל דף סודוקו, בלי עט. הולכים במסלול ופותרים בראש. בסוף אומרים לי את הפתרון.');
  });
  state.sudoku = await sudoku(ui, 35);

  // Map of Israel in the sand.
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, 'מפת ישראל בחול. כל אחד לבד, שבע דקות: ערים, שדות תעופה, בסיסים.');
  });
  state.map = await mapTask(ui, MAP_PLACES, { eyebrow: 'משימה אישית · מפה בחול', title: 'סמן את המקומות על המפה', done: 'סיימתי' });

  // Rescue planning and five traits.
  state.rescue = await rescuePlan(ui);
  state.traits = await traits(ui);
  await ui.fact(FACTS.leadership.title, FACTS.leadership.points);
  game.save('day4');
}

async function night4(game) {
  const { ui, people, sky, state, player } = game;
  sky.setTime('night');
  game.setDay(4, 'לילה');
  othersAt(people, 'night');
  const mc = people.staff.mc;
  standInFormation(game, SPOTS.form, 0);
  await ui.interlude('ארוחת ערב חמה, ואחריה ח׳ כיתתית בחושך.', 2000);
  // The star: a steady point of light above the trees to the north.
  const star = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff6dc', toneMapped: false, fog: false }));
  star.position.set(SPOTS.form.x + 20, 75, SPOTS.form.z + 170);
  game.scene.add(star);
  mc.setPose('talk');
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, 'כולם להסתכל לשם. מעל העצים. נקודת האור.');
  });
  player.faceTowards(star.position.x, star.position.z, star.position.y);
  await new Promise((r) => setTimeout(r, 1800));
  await talkScene(game, mc, async () => {
    const answer = await ui.talk(mc.name, `${MY_NUMBER}. איזה מטוס זה?`, [
      'נקודת אור קבועה, בלי אורות מהבהבים. לדעתי זה כוכב',
      '"זה F-16."',
      '"זה מסוק."',
    ]);
    if (answer === 0) {
      const press = await ui.talk(mc.name, 'כוכב?! אתה מזלזל בידע. תסתכל שוב.', ['"הסתכלתי. זה מה שאני רואה: כוכב."', '"אה… אולי זה בעצם מטוס."']);
      state.star = press === 0 ? 1 : 0.5;
    } else {
      state.star = 0.3;
      await ui.talk(mc.name, 'רשמתי.');
    }
  });
  star.removeFromParent();
  mc.setPose('arms-crossed');
  await ui.fact(FACTS.star.title, FACTS.star.points);

  // Last pop-up: the final בד״ח test.
  await ui.interlude('שינה… הקפצה אחרונה. "דיגום! בד״ח!"', 2200);
  const dress = await dressCheck(ui, 8);
  if (dress.missing.length) for (const item of dress.missing) game.violation('dress', `יצאתי להקפצה בלי: ${item}`, Math.random() < 0.6);
  state.dress = [...(state.dress ?? []), dress];
  standInFormation(game, SPOTS.form, 0);
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, `${MY_NUMBER}. הבחינה האחרונה. שלושה נהלים ברצף.`);
  });
  for (const id of ['heat', 'fuel', 'eject']) await badachMoment(game, id, { speaker: mc.name, title: 'מבחן בד״ח אחרון' });
  await ui.interlude('חזרה לישון. הפעם עד הבוקר.', 1800);
  game.save('night4');
}

// ---------- Day 5 (Thursday) ----------

async function day5(game) {
  const { ui, people, sky, state, player } = game;
  sky.setTime('day');
  game.setDay(5, 'בוקר');
  othersAt(people, 'camp');
  headgear(people, 'hat');
  const mc = people.staff.mc;
  await ui.interlude('יום חמישי. בלי הקפצה: הסמל אומר "בוקר טוב", ועומדים בשקט בח׳.', 2600);
  await ui.interlude('מקפלים את האוהלים, מחזירים ציוד וחותמים. מקבלים את התיק מהמכולה.', 2600);
  sitRows(active(people), SPOTS.classMat.x, SPOTS.classMat.z + 3, Math.PI, 'sit-east', 8);
  player.teleport(SPOTS.classMat.x - 3, SPOTS.classMat.z, Math.PI / 2);
  mc.place(SPOTS.classMat.x - 1, SPOTS.classMat.z - 1.5, 0).setPose('arms-crossed');
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, 'לפני שמסיימים: מי שעבר על כלל ועוד לא סיפר, זה הרגע האחרון.');
  });
  await selfReportScene(game);
  state.social = await sociometric(ui, active(people).concat(people.classmates.filter((p) => p.info.out)));
  await ui.interlude('מקלחת ראשונה מאז יום ראשון. בגדים אזרחיים.', 2200);

  // Breaking distance: the staff take off their sunglasses.
  const mc2 = people.staff.mc2;
  for (const s of [mc, mc2]) {
    s.glasses && (s.glasses.visible = false);
    s.group.visible = true;
  }
  mc.place(SPOTS.classMat.x - 1, SPOTS.classMat.z - 1.5, 0).setPose('talk');
  mc2.place(SPOTS.classMat.x + 1, SPOTS.classMat.z - 1.5, 0).setPose('stand');
  await goTalk(game, mc, 'mc', 'גש למ״כים', 'שבירת דיסטנס');
  await talkScene(game, mc, async () => {
    await ui.talk(mc.name, 'אפשר לדבר. איך אתה מרגיש?');
    await ui.talk('אני', '…', ['שבור, אבל טוב', 'מוזר לדבר אחרי חמישה ימים']);
    await ui.talk(mc.name, 'אני עברתי את הגיבוש הזה לפני כמה שנים, באותה גבעה. מה שלא יהיה, תהיה גאה שסיימת.');
    await ui.talk(mc2.name, 'אני צוער בקורס. מה שראית פה זה בדיוק מה שמחכה בקורס: ללמוד מהר, להגיד את האמת, ולא לוותר.');
  });
  await ui.fact(FACTS.end.title, FACTS.end.points);
  await ui.interlude('אוטובוס לתחנה המרכזית בבאר שבע. מקבלים את הטלפונים בחזרה…', 2600);
  game.save('day5');
}

// ---------- Results ----------

function outcomeFor(state, stats) {
  if (state.failedRun) return { total: 0, outcome: RUN_FAIL_OUTCOME };
  if (state.quit) return { total: 0, outcome: QUIT_OUTCOME };
  const clamp = (v) => Math.max(0, Math.min(1, v));
  // Physical: crawl ranks, plum rack, tzukon, stretcher, digging.
  const crawlsList = stats.crawls ?? [];
  const crawl = crawlsList.length ? crawlsList.reduce((a, c) => a + clamp(1 - (c.average - 1) / 14), 0) / crawlsList.length : 0.5;
  const rack = (stats.rack ?? []).reduce((a, r) => a + clamp(r.fellBefore / 14), 0) / Math.max(1, stats.rack?.length ?? 0) || 0.5;
  const tz = stats.tzukon ? clamp(stats.tzukon.total / Math.max(1, stats.tzukon.average) - 0.4) : 0.5;
  const stretch = stats.stretcher?.length ? stats.stretcher.reduce((a, r) => a + (r.rank <= 4 ? 0.6 + 0.4 * r.held : 0.4), 0) / stats.stretcher.length : 0.5;
  const dig = stats.dig ? clamp(stats.dig.perSecond / 1.4) : 0.5;
  const physical = (crawl + rack + tz + stretch + dig) / 5 - (state.tookBreak ? 0.25 : 0);
  // Learning: בד״ח.
  const tests = state.badach ?? [];
  const learning = tests.length ? tests.reduce((a, t) => a + t.correct / t.total, 0) / tests.length : 0.4;
  // Thinking.
  const thinking =
    ((state.einstein?.score ?? 0.5) + (state.attack?.score ?? 0.5) + (state.sudoku?.score ?? 0.5) + (state.rescue?.score ?? 0.5) + (state.map ?? 0.5) + (stats.checkers?.solved ? 1 : 0.4)) / 6;
  // Team: discussions and group tasks, giving to the class.
  const talks = Object.values(state.talks ?? {});
  const talking = talks.length ? talks.reduce((a, b) => a + b, 0) / talks.length : 0.5;
  const giving = ((stats.tzukon ? clamp(stats.tzukon.shared / Math.max(1, stats.tzukon.total) * 1.6) : 0.5) + (stats.dig ? clamp(stats.dig.share * 1.8) : 0.5) + (stats.groupHang?.success ? 1 : 0.3)) / 3;
  const team = 0.6 * talking + 0.4 * giving;
  // Honesty and discipline.
  const violations = state.violations ?? [];
  const reported = violations.filter((v) => v.reported).length;
  // Everything the staff saw and you never reported, by the end.
  const hiddenSeen = violations.filter((v) => v.seen && !v.reported).length;
  const honesty = clamp(1 - 0.3 * hiddenSeen - 0.12 * (violations.length - reported) + 0.1 * reported) * 0.8 + 0.2 * (state.star ?? 0.5);
  const discipline = clamp(1 - 0.04 * (stats.stops ?? 0) - 0.06 * (stats.march?.warnings ?? 0) - 0.1 * (state.dress ?? []).filter((d) => d.missing.length).length);
  // Peers: how your class would rank you, from what they saw.
  const peers = clamp(0.35 * giving + 0.25 * talking + 0.2 * physical + 0.2 * honesty);
  const judgement = state.social ?? 0.5;
  // "Whoever is caught being dishonest in the gibbush is not suited for the course" (Air Force site).
  const total = 0.2 * physical + 0.15 * learning + 0.15 * thinking + 0.15 * team + 0.15 * honesty + 0.05 * discipline + 0.1 * peers + 0.05 * judgement - 0.12 * hiddenSeen;
  const outcome = OUTCOMES.find((o) => total >= o.min);
  const socialRank = Math.max(1, Math.min(16, Math.round(16 - peers * 15)));
  return { total, outcome, parts: { physical, learning, thinking, team, honesty, discipline, peers }, socialRank };
}

async function results(game) {
  const { ui, state, drills } = game;
  const stats = { ...(state.stats ?? {}), ...drills.stats };
  const { total, outcome, parts, socialRank } = outcomeFor(state, stats);
  const pct = (v) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;
  const lines = [];
  if (stats.run) lines.push(['ריצת ניפוי', `${formatTime(stats.run.time)} ${stats.run.passed ? '✓' : '✗'}`]);
  if (parts) {
    lines.push(['פיזי (זחילות, מתלה, צוקון, אלונקה, חפירה)', pct(parts.physical)]);
    lines.push(['בד״ח', pct(parts.learning)]);
    lines.push(['חשיבה (חידות, תכנון, סודוקו, מפה)', pct(parts.thinking)]);
    lines.push(['צוות ודיונים', pct(parts.team)]);
    lines.push(['אמינות ודיווח עצמי', pct(parts.honesty)]);
    lines.push(['משמעת (דיגום, דממה)', pct(parts.discipline)]);
  }
  const violations = state.violations ?? [];
  if (violations.length) lines.push(['עברת על כללים', `${violations.length} · דיווחת על ${violations.filter((v) => v.reported).length}`]);
  saveResults('gibbush-tayis', { outcome: outcome.title, total });
  game.save('results');
  await ui.interlude('יום ראשון שאחרי. 19:00 בדיוק. הטלפון רוטט…', 2400);
  const choice = await resultsPhone(ui, { outcome, lines, socialRank: parts ? socialRank : null });
  if (choice === 'again') window.location.href = './?new=1';
  else window.location.href = '../main-screen/';
}

// What the objective box says at the start of each part (a part can change it later).
const OBJECTIVES = {
  intake: ['קליטה באולם הספורט', 'חובש, מדים, קסדה וחלוקה לכיתות'],
  run: ['ריצת ניפוי', '1,000 מטר. מי שלא עומד ברף, מסיים כאן'],
  playground: ['מגרש המשחקים', 'בד״ח, דיון ומתלה שזיפים'],
  crawls: ['בריכת הזחילות', 'סדרי הגעה'],
  day2: ['יום שני', 'עובדים ביחד ולחוד'],
  plan: ['תכנון, דיון ואוהל סיירים', 'מותר לדבר רק כשהמ״כ אומר'],
  night2: ['מסע לילה', 'כל ציוד השינה עליך'],
  day3: ['היום הפיזי', 'צוקון, אלונקה, דמקה ובד״ח'],
  night3: ['הקפצה', 'זחילות בבריכת החול'],
  day4: ['יום רביעי', 'חפירה, סודוקו, מפה ותכנון'],
  night4: ['הלילה האחרון', 'ח׳ כיתתית בחושך'],
  day5: ['יום חמישי', 'מתקפלים'],
  results: ['התשובות', 'יום ראשון, 19:00'],
};

const HANDLERS = { arrive, intake, run, playground, crawls, day2, plan, night2, day3, night3, day4, night4, day5, results };

export async function runFlow(game, startStep = 'arrive') {
  let i = STEPS.indexOf(startStep);
  game.jumpTo = (step) => {
    i = STEPS.indexOf(step) - 1;
  };
  for (; i < STEPS.length; i++) {
    game.state.step = STEPS[i];
    if (OBJECTIVES[STEPS[i]]) game.ui.setObjective(...OBJECTIVES[STEPS[i]]);
    // On resume the בד״ח booklet should have what was handed out by then.
    game.badachDay = Math.max(game.badachDay ?? 1, { day2: 2, plan: 2, night2: 2, day3: 3, night3: 3, day4: 3, night4: 3, day5: 3, results: 3 }[STEPS[i]] ?? 1);
    await HANDLERS[STEPS[i]](game);
    game.state.stats = { ...(game.state.stats ?? {}), ...game.drills.stats };
  }
}
