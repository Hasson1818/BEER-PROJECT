import { HOME_SPOTS } from '../../pilot-path/shared/home-room.js';
import { smsPanel, answerPhone } from '../../pilot-path/shared/panels.js';
import { fx } from '../../pilot-path/shared/fx.js';
import { loadResults, saveResults } from '../../shared/save.js';
import { unlock } from '../../shared/achievements.js';
import { FACTS, SMS_INVITE, PREP_ITEMS, TRACKS, INTERVIEW, SECURITY, INTERVIEWER, INTERESTS } from './content.js';
import { runTests, LANG } from './tests.js';
import { questionnaire, roomScene } from './screens.js';

// מיון כלל חמ״ן:
//   invite (an SMS four days before, who is invited) → morning (get the room ready) → tests (online: the explanation,
//   then the timed sections) → questionnaire (the ~300 statements, here 16, then background and interests) →
//   waiting (no "you passed", just the next invitation, or the SMS for those who didn't) → interview (in person,
//   "מתקן רמות", floor 6) → security (the security investigation) → results (about three months later).

export const STEPS = ['invite', 'morning', 'tests', 'questionnaire', 'waiting', 'interview', 'security', 'results'];

const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
const groundTarget = (spot, y = 1.5) => ({ x: spot.x, y, z: spot.z });

async function sitAtDesk(game, label = 'שב/י ליד המחשב') {
  const { ui, player } = game;
  ui.setObjective(label, 'הכיסא מול השולחן');
  game.setTarget(groundTarget(HOME_SPOTS.chair, 1.2));
  await game.waitInteract('chair');
  game.setTarget(null);
  player.sit({ x: HOME_SPOTS.chair.x, z: HOME_SPOTS.chair.z, exit: { x: HOME_SPOTS.chair.x - 0.7, z: HOME_SPOTS.chair.z + 0.3 } }, 0);
  game.setTarget(groundTarget({ x: 1.45, z: -2.85 }, 1.15));
  ui.setObjective('פתח/י את המחשב');
  await game.waitInteract('laptop');
  game.setTarget(null);
  fx.boot();
  game.world.setScreen('on');
}

async function phone(game, objective) {
  const { ui } = game;
  ui.setObjective('הטלפון רטט', objective);
  game.setTarget(groundTarget(HOME_SPOTS.phone, 1.35));
  fx.notify();
  await game.waitInteract('phone');
  game.setTarget(null);
}

/** The general score of the test day: every section but the invented language. */
function general(state) {
  const r = state.tests ?? {};
  return mean(['pairs', 'series', 'building', 'analogy'].filter((k) => k in r).map((k) => r[k]));
}

/** Which track the game sends you to, by what interests you and how you did. The rule is the game's own. */
function trackFor(state) {
  const g = general(state);
  const lang = state.tests?.language ?? 0;
  switch (state.interest) {
    case 'tech':
      return state.background?.cs && g >= 0.6 ? 'sigint' : 'enigma';
    case 'language':
      if (state.background?.arabic) return 'arabic';
      return lang >= 0.5 ? 'ofek' : 'etrog';
    case 'visual':
      return 'visual';
    default:
      return 'etrog';
  }
}

// ---------- The evening four days before ----------

async function invite(game) {
  const { ui, player, sky, world, state } = game;
  sky.setTime('night');
  world.setOutside('night');
  game.setClock('יום ה׳ · בבית', 17 * 60 + 40);
  player.teleport(HOME_SPOTS.spawn.x, HOME_SPOTS.spawn.z, 0.5);
  await ui.fadeIn();
  await phone(game, 'הוא על שידת המיטה');
  await smsPanel(ui, SMS_INVITE);
  await ui.fact(FACTS.invite.title, FACTS.invite.points);
  const tzav = loadResults('tzav-rishon');
  const who = await ui.talk('אני', 'רגע. אני בכלל עומד/ת בתנאים?', ['אני בת', 'אני בן, בפרופיל לא קרבי', 'אני בן, בפרופיל קרבי']);
  state.who = ['f', 'm', 'mc'][who];
  if (state.who === 'mc') {
    await ui.talk('אני', 'לפי הדף הרשמי, כלל חמ״ן לא פתוח לבנים שמיועדים ללחימה. במציאות לא הייתי מקבל/ת את הזימון.');
    await ui.talk('אני', '(במשחק אפשר להמשיך, כדי לראות איך המיון נראה.)');
  }
  if (tzav?.dapar != null && tzav.dapar < 60) ui.toast(`הדפ״ר שלך מהצו הראשון: ${tzav.dapar}. הסף הרשמי: 60–70. במשחק ממשיכים בכל זאת.`, 4200);
  game.save('invite');
  await ui.interlude('יום ב׳. השעון מצלצל ב־08:30…', 2200);
}

// ---------- The morning: get the room ready ----------

async function morning(game) {
  const { ui, player, sky, world, state } = game;
  sky.setTime('day');
  world.setOutside('day');
  world.resetPrep?.();
  game.setClock('יום ב׳ · מיון כלל חמ״ן', 9 * 60 + 5);
  player.teleport(HOME_SPOTS.spawn.x, HOME_SPOTS.spawn.z, 0.5);
  await ui.fadeIn();
  await ui.talk('אני', 'עוד 25 דקות. הקישור הגיע בבוקר. צריך חדר שקט ומצלמה פתוחה.');
  const done = new Set();
  const spots = { window: HOME_SPOTS.window, drawer: HOME_SPOTS.drawer, water: HOME_SPOTS.water, paper: { x: 1.05, z: -2.7 } };
  const refresh = () => {
    const left = PREP_ITEMS.filter((p) => !done.has(p.id));
    ui.setObjective(`להכין את החדר (${done.size}/${PREP_ITEMS.length})`, left.map((p) => p.objective).join(' · ') || 'אפשר לשבת ליד המחשב');
    game.setTarget(() => (left[0] ? groundTarget(spots[left[0].id], 1.4) : null));
  };
  refresh();
  const ready = Promise.all(
    PREP_ITEMS.map((item) =>
      game.waitInteract(item.id).then(() => {
        done.add(item.id);
        ui.toast(item.line);
        fx.click();
        if (item.id !== 'paper') world.prep(item.id);
        refresh();
      }),
    ),
  );
  await Promise.race([ready, game.waitInteract('chair-early')]);
  for (const key of ['chair-early', ...PREP_ITEMS.map((p) => p.id)]) game.pending.delete(key);
  state.prepared = done.size;
  if (done.size < PREP_ITEMS.length) ui.toast('ישבת לפני שהחדר מוכן', 2000);
  game.setClock(undefined, 9 * 60 + 28);
  await sitAtDesk(game, 'שב/י ליד המחשב, 09:30');
  game.save('morning');
}

// ---------- The online tests ----------

async function tests(game) {
  const { ui, state } = game;
  game.setClock(undefined, 9 * 60 + 30);
  ui.setObjective('המבחנים המקוונים', 'חלק הסברה, ואחריו חמישה פרקים');
  await ui.fact(FACTS.online.title, FACTS.online.points);
  await ui.fact(FACTS.tests.title, FACTS.tests.points);
  const r = await runTests(game, { withLanguage: true });
  state.tests = Object.fromEntries(Object.entries(r.results).map(([k, v]) => [k, v.score]));
  state.practiced = r.practiced;
  if ((state.tests.language ?? 0) >= 0.8) unlock('haman-language');
  game.setClock(undefined, 11 * 60 + 40);
  game.save('tests');
}

// ---------- The personality questionnaire ----------

async function questionnaireStep(game) {
  const { ui, state, player, world } = game;
  ui.setObjective('השאלון האישי', 'היגד אחרי היגד, כ־9 שניות לכל אחד');
  await ui.fact(FACTS.questionnaire.title, FACTS.questionnaire.points);
  const q = await questionnaire(game);
  Object.assign(state, { consistency: q.consistency, skipped: q.skipped, lie: q.lie, puzzles: q.puzzles, background: q.background, interest: q.interest });
  world.setScreen('idle');
  player.standUp(false);
  game.setClock(undefined, 12 * 60 + 25);
  await ui.talk('אני', 'זהו? נגמר. אין ציון, אין כלום. לא יודע/ת אם הלך טוב או רע.');
  game.save('questionnaire');
}

// ---------- A week later ----------

async function waiting(game) {
  const { ui, state, sky, world } = game;
  await ui.interlude('שבוע אחר כך…', 1800);
  sky.setTime('day');
  world.setOutside('day');
  game.setClock('יום ב׳ · שבוע אחרי', 16 * 60 + 5);
  const g = general(state);
  const lang = state.tests?.language ?? 0;
  // The game's own pass line.
  state.passed = g >= 0.45 || (state.interest === 'language' && lang >= 0.6);
  await phone(game, 'הודעה חדשה');
  if (!state.passed) {
    await smsPanel(ui, { from: 'חיל המודיעין · מיונים', time: 'יום ב׳ · 16:05', text: ['שלום, תודה על השתתפותך במיון כלל חמ״ן.', 'לצערנו לא נמצאת מתאים/ה להמשך המיון.', 'השיבוץ שלך ימשיך לפי שאלון ההעדפות.'] });
    await ui.fact(FACTS.after.title, FACTS.after.points);
    game.save('security');
    game.jumpTo?.('results');
    return;
  }
  state.track = trackFor(state);
  await smsPanel(ui, { from: 'מתגייסים · הודעות וזימונים', time: 'יום ב׳ · 16:05', text: ['זימון לריאיון מקצועי במסגרת מיוני חמ״ן.', 'יום ד׳, 10:00. מתקן רמות, תל אביב, קומה 6.', 'יש להביא תעודה מזהה וגיליון ציונים.'] });
  await ui.talk('אני', 'אז… עברתי? לא כתוב. רק זימון.');
  await ui.fact(FACTS.after.title, FACTS.after.points);
  game.save('waiting');
}

// ---------- The interview at "מתקן רמות" ----------

async function interview(game) {
  const { ui, state } = game;
  await ui.fact(FACTS.interview.title, FACTS.interview.points);
  await ui.interlude('יום ד׳. רכבת לתל אביב, ואז אוטובוס…', 2000);
  const track = TRACKS[state.track ?? trackFor(state)];
  const interest = INTERESTS.find((i) => i.id === state.interest);
  const result = await roomScene(game, { place: 'מתקן רמות · כניסה · 09:40', who: { name: 'שומר', title: 'בכניסה', icon: '💂' } }, async (api) => {
    await api.say('בוקר טוב. תעודה? לאן?');
    await api.ask('…', ['ריאיון מקצועי, מיוני חמ״ן. קומה 6.'], 'אני');
    await api.say('מעלית משמאל. טלפונים נשארים בתיק, כבויים.');
    api.setScene('קומה 6 · מסדרון המתנה · 09:55', { name: 'מועמדת', title: 'מחכה גם היא', icon: '🧑‍🎓' });
    await api.say('גם את/ה לריאיון? אני כבר פעם שנייה פה. בפעם הראשונה עשיתי פה מבחנים, בקומה 3.');
    const c = await api.ask('…', ['מה שאלו אותך בפעם הקודמת?', '(לא לדבר. לחזור על הגיליון בראש)'], 'אני');
    if (c === 0) await api.say('כמו ראיון עבודה. על עצמך, תחביבים, חברים. ובסוף שאלו כמה אני רוצה את התפקיד. אל תמציא/י, הם קולטים.');
    api.setScene('קומה 6 · חדר ריאיון · 10:05', { ...INTERVIEWER, icon: '👩‍💼' });
    await api.say(`היי, אני ${INTERVIEWER.name}. זה ריאיון קצר, לא מבחן. אני רק רוצה להכיר אותך. מה שנדבר נשאר בחדר.`);
    const scores = [];
    for (const item of INTERVIEW) {
      if (item.consistency && (state.puzzles ?? 2) < 2) continue;
      const k = await api.ask(item.q, item.choices.map((x) => x.text));
      scores.push(item.choices[k].score);
      if (item.consistency && item.choices[k].score < 0.5) await api.say('בסדר. טוב שאמרת. אני רושמת.');
    }
    if (state.interest === 'language') {
      await api.say('עוד דבר קטן, כי ביקשת שפות: תרגם/י לי את זה, לפי דף החוקים מהמבחן.');
      const [subj, obj] = LANG.nouns;
      const verb = LANG.verbs[0];
      const right = `${verb.w}ת או${subj.w} ${obj.w}`;
      const k = await api.ask(`"הילדים ראו את הכלב". איך אומרים?`, [right, `${verb.w} או${subj.w} ${obj.w}`, `${verb.w}ת ${obj.w} או${subj.w}`]);
      scores.push(k === 0 ? 1 : 0.3);
    }
    await api.say(`עכשיו קצת על התפקיד. אני מראיינת ל${track.name}. ${track.lines[0]}`);
    const m = await api.ask('מ־1 עד 5: כמה היית רוצה את התפקיד הזה?', ['1', '2', '3', '4', '5']);
    const motivation = m + 1;
    const score = mean(scores) * 0.85 + (motivation / 5) * 0.15;
    if (score >= 0.4 && score < 0.6) await api.say('תודה. אני אהיה כנה: את/ה כרגע בהמתנה. נחזור אלייך.');
    else await api.say('תודה רבה. השלב הבא הוא תחקיר ביטחוני. ממתינים כאן במסדרון.');
    return { score, motivation };
  });
  state.interview = result.score;
  state.motivation = result.motivation;
  state.interestFamily = interest?.family;
  game.save('interview');
}

// ---------- The security investigation ----------

async function security(game) {
  const { ui, state } = game;
  await ui.fact(FACTS.security.title, FACTS.security.points);
  const honest = await roomScene(game, { place: 'קומה 6 · חדר קטן · 11:10', who: { name: 'רז', title: 'מתחקר ביטחוני', icon: '🕵️' } }, async (api) => {
    await api.say('אני שואל כמה שאלות. אין פה תשובה נכונה, יש תשובה אמיתית. בסדר?');
    let ok = 0;
    for (const item of SECURITY) {
      await api.say(`(${item.truth})`, 'מה שאת/ה יודע/ת');
      const k = await api.ask(item.q, item.choices.map((c) => c.text));
      if (item.choices[k].honest) ok++;
      await api.say('אוקיי. רשמתי.');
    }
    await api.say('זהו. את התשובה לא תקבל/י ממני. זה לוקח זמן, לפעמים חודשים.');
    return ok;
  });
  state.honest = honest;
  game.save('security');
}

// ---------- The answer, about three months later ----------

async function results(game) {
  const { ui, state, sky, world, player } = game;
  if (state.passed) await ui.interlude('כשלושה חודשים אחר כך…', 2000);
  sky.setTime('day');
  world.setOutside('day');
  player.teleport(HOME_SPOTS.spawn.x, HOME_SPOTS.spawn.z, 0.5);
  game.setClock(state.passed ? 'בבית · שלושה חודשים אחרי' : 'בבית · שבוע אחרי', state.passed ? 13 * 60 + 15 : 16 * 60 + 20);
  const trackId = state.track ?? trackFor(state);
  const track = TRACKS[trackId];
  const allHonest = (state.honest ?? 0) >= SECURITY.length;
  let headline;
  let detail = [];
  let placed = false;
  if (!state.passed) {
    headline = 'לא נמצאת מתאים/ה להמשך מיון כלל חמ״ן';
    detail = ['השיבוץ ממשיך לפי שאלון ההעדפות וליתר המיונים שקיבלת.', 'אפשר לנסות שוב במשחק, ולתרגל קודם את הפרקים.'];
  } else if (!allHonest) {
    headline = 'לא עברת את התחקיר הביטחוני';
    detail = ['במשחק: התחקיר מצא דבר שהסתרת. לא התשובה עצמה פסלה אותך, אלא ההסתרה.', 'זה כלל של המשחק. במציאות לא מפרסמים לפי מה מחליטים.'];
  } else if ((state.interview ?? 0) < 0.4) {
    headline = `לא נמצאת מתאים/ה ל${track.name}`;
    detail = ['הריאיון לא הלך טוב. השיבוץ ממשיך לפי שאלון ההעדפות.', 'טיפ מהעדויות: לענות בכנות ובפירוט, עם דוגמאות.'];
  } else {
    placed = true;
    headline = `שובצת: ${track.name}`;
    detail = [...track.lines, `מקור הנתונים על המסלול: ${track.src}.`];
    if ((state.interview ?? 0) < 0.6) detail.unshift('אחרי שהיית "בהמתנה", התקשרו ואמרו שנמצא לך מקום (כמו בעדות מ־2025).');
  }
  const testsLine = Object.entries(state.tests ?? {})
    .map(([k, v]) => `${{ pairs: 'זוגות', series: 'סדרות', building: 'מסקנות', analogy: 'אנלוגיות', language: 'שפה' }[k] ?? k} ${Math.round(v * 100)}%`)
    .join(' · ');
  const lines = [
    ['מבחנים', testsLine || '—'],
    ['עקביות בשאלון', `${Math.round((state.consistency ?? 0) * 100)}%${state.lie ? ' · "תמיד אומר/ת אמת": מסכים/ה מאוד' : ''}`],
    ['תחום', state.interestFamily ?? INTERESTS.find((i) => i.id === state.interest)?.family ?? '—'],
    ...(state.passed ? [['ריאיון', `${Math.round((state.interview ?? 0) * 100)}% · רצון ${state.motivation ?? '—'}/5`], ['תחקיר', `${state.honest ?? 0} מתוך ${SECURITY.length} תשובות אמת`]] : []),
  ];
  saveResults('klal-haman', { outcome: headline, track: placed ? trackId : null, tests: state.tests });
  unlock('haman-done');
  if (placed) unlock('haman-placed');
  if (allHonest && (state.consistency ?? 0) >= 0.8) unlock('haman-honest');
  game.save('results');
  const choice = await answerPhone(ui, {
    from: placed ? 'חיל המודיעין · שיבוץ' : 'צה״ל · מיונים',
    time: state.passed ? 'שלושה חודשים אחרי · 13:15' : 'שבוע אחרי · 16:20',
    headline,
    detail,
    lines,
    note: 'הציונים, סף המעבר וכלל השיבוץ (לפי התחום שבחרת והביצועים) הם של המשחק.',
    buttons: [
      { id: 'calc', label: 'למחשבון צה״ל' },
      { id: 'again', label: 'לנסות שוב', secondary: true },
      { id: 'menu', label: 'לתפריט הראשי', secondary: true },
    ],
  });
  await ui.fact(FACTS.change.title, FACTS.change.points);
  if (choice === 'again') {
    unlock('persistence');
    window.location.href = './?new=1';
  } else if (choice === 'calc') window.location.href = '../calculator/';
  else window.location.href = '../main-screen/';
}

export const HANDLERS = { invite, morning, tests, questionnaire: questionnaireStep, waiting, interview, security, results };
