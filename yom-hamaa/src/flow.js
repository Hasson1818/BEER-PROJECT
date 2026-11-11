import { HOME_SPOTS } from '../../pilot-path/shared/home-room.js';
import { smsPanel } from '../../pilot-path/shared/panels.js';
import { fx } from '../../pilot-path/shared/fx.js';
import { FACTS, SMS_INVITE, PREP_ITEMS, ENVIRONMENTS, QUESTIONNAIRE, SIMS } from './content.js';
import { runTests, MODULES } from './tests.js';
import { zoomSession } from './zoom.js';
import { MEMBERS, addEnv, intro, groupTask, teachTask, simTasks } from './stations.js';
import { confirmInvite, scoresPage, appealForm, questionnaire, openedPage } from './portal.js';
import { loadResults, saveResults } from '../../shared/save.js';
import { unlock } from '../../shared/achievements.js';

// יום המא״ה and the preferences questionnaire, from home:
//   invite (evening, SMS + confirm on the site) → morning (get the room ready) → tests (computer) →
//   zoom (introductions, group task, instruction, two role plays) → scores (two weeks later, appeal once) →
//   questionnaire (August) → what opened for you, with links to the next stages.

export const STEPS = ['invite', 'morning', 'tests', 'zoom', 'scores', 'questionnaire', 'opened'];

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mean = (list) => (list?.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
const groundTarget = (spot, y = 1.5) => ({ x: spot.x, y, z: spot.z });

/** Your data from the צו ראשון stage (or a typical combat profile if you haven't played it). */
function tzav() {
  const r = loadResults('tzav-rishon');
  return { profile: r?.profile ?? 82, dapar: r?.dapar ?? 60, played: Boolean(r) };
}

async function sitAtDesk(game, label = 'שב ליד המחשב') {
  const { ui, player } = game;
  ui.setObjective(label, 'הכיסא מול השולחן');
  game.setTarget(groundTarget(HOME_SPOTS.chair, 1.2));
  await game.waitInteract('chair');
  game.setTarget(null);
  player.sit({ x: HOME_SPOTS.chair.x, z: HOME_SPOTS.chair.z, exit: { x: HOME_SPOTS.chair.x - 0.7, z: HOME_SPOTS.chair.z + 0.3 } }, 0);
  game.setTarget(groundTarget({ x: 1.45, z: -2.85 }, 1.15));
  ui.setObjective('פתח את המחשב');
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

// ---------- The evening before ----------

async function invite(game) {
  const { ui, player, sky, world, state } = game;
  sky.setTime('night');
  world.setOutside('night');
  game.setClock('יום א׳ · בבית', 18 * 60 + 5);
  player.teleport(HOME_SPOTS.spawn.x, HOME_SPOTS.spawn.z, 0.5);
  await ui.fadeIn();
  state.env = {};
  await phone(game, 'הוא על שידת המיטה');
  await smsPanel(ui, SMS_INVITE);
  await ui.fact(FACTS.what.title, FACTS.what.points);
  await sitAtDesk(game, 'לאשר הגעה באזור האישי');
  const answer = await confirmInvite(game);
  state.moved = answer === 'move';
  if (state.moved) {
    ui.toast('הזמנת מועד אחר. (במשחק ממשיכים באותו יום, כדי לא לחכות)', 3200);
    addEnv(state.env, { frame: 0.8 });
  } else addEnv(state.env, { frame: 1 });
  game.world.setScreen('idle');
  player.standUp(false);
  await ui.fact(FACTS.tech.title, FACTS.tech.points);
  game.save('invite');
  await ui.interlude('יום ג׳. השעון מצלצל ב־07:00…', 2400);
}

// ---------- The morning: get the room ready ----------

async function morning(game) {
  const { ui, player, sky, world, state } = game;
  state.env ??= {};
  sky.setTime('day');
  world.setOutside('day');
  world.resetPrep?.();
  game.setClock('יום ג׳ · יום המא״ה', 7 * 60 + 35);
  player.teleport(HOME_SPOTS.spawn.x, HOME_SPOTS.spawn.z, 0.5);
  await ui.fadeIn();
  await ui.talk('אני', 'עוד חצי שעה. בקבוצת הוואטסאפ כבר יש הודעה: "קישור לזום יישלח ב־07:55. מצלמות פתוחות."');
  const done = new Set();
  const refresh = () => {
    const left = PREP_ITEMS.filter((p) => !done.has(p.id));
    ui.setObjective(`להכין את החדר (${done.size}/${PREP_ITEMS.length})`, left.map((p) => p.objective).join(' · '));
    const spots = { window: HOME_SPOTS.window, drawer: HOME_SPOTS.drawer, water: HOME_SPOTS.water, paper: { x: 1.05, z: -2.7 } };
    game.setTarget(() => (left[0] ? groundTarget(spots[left[0].id], 1.4) : null));
  };
  refresh();
  // You can sit down before everything is ready; what you skipped counts a little.
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
  addEnv(state.env, { frame: 0.5 + 0.5 * (done.size / PREP_ITEMS.length), effort: 0.6 + 0.4 * (done.size / PREP_ITEMS.length) });
  if (done.size === PREP_ITEMS.length) unlock('maa-ready');
  game.setClock(undefined, 7 * 60 + 52);
  if (done.size < PREP_ITEMS.length) ui.toast('ישבת לפני שהחדר מוכן', 2000);
  await sitAtDesk(game, 'שב ליד המחשב, 07:55');
  game.save('morning');
}

// ---------- The computer tests ----------

async function tests(game) {
  const { ui, state } = game;
  state.env ??= {};
  game.setClock(undefined, 8 * 60);
  ui.setObjective('המבחנים הממוחשבים', 'ארבעה פרקים');
  await ui.fact(FACTS.tests.title, FACTS.tests.points);
  const r = await runTests(game);
  state.tests = Object.fromEntries(Object.entries(r.results).map(([k, v]) => [k, v.score]));
  for (const [id, res] of Object.entries(r.results)) {
    addEnv(state.env, { [id]: res.score });
    addEnv(state.env, { effort: res.answered / res.total });
  }
  if (r.practiced) addEnv(state.env, { effort: 1 });
  game.setClock(undefined, 10 * 60 + 5);
  game.save('tests');
}

// ---------- The Zoom ----------

async function zoom(game) {
  const { ui, state } = game;
  state.env ??= {};
  if (!state.myName) {
    const names = ['אורי', 'דניאל', 'נועם'];
    const k = await ui.talk('זום', 'לפני שנכנסים: איזה שם יופיע אצלך בזום? (במשחק אין לך שם, אז בוחרים כאן)', names);
    state.myName = names[k];
  }
  ui.setObjective('תחנות הזום', 'סבב היכרות, משימה קבוצתית, הדרכה, סימולציות');
  await ui.fact(FACTS.group.title, FACTS.group.points);
  game.world.setScreen('call');
  fx.zoomJoin?.();
  await zoomSession(game, { title: 'יום המא״ה · קבוצה 4 · מכון המיון', members: MEMBERS(state.myName) }, async (api) => {
    await intro(api, state.env);
    await groupTask(api, state.env, state);
    await api.card((card, done) => {
      card.innerHTML = '<h2>הפסקה</h2><p>לפי העדויות יש הפסקות של 20–30 דקות בין התחנות. אוכלים, שותים, קמים מהכיסא.</p>';
      setTimeout(() => done(), 1800);
    });
    await teachTask(api, state.env, state);
    await simTasks(api, state.env);
  });
  await ui.fact(FACTS.teach.title, FACTS.teach.points);
  await ui.fact(FACTS.sims.title, FACTS.sims.points);
  game.world.setScreen('idle');
  game.player.standUp(false);
  if (!state.missedTurn) unlock('maa-turn');
  game.save('zoom');
}

// ---------- The scores (and the appeal) ----------

/** The game's own conversion of what you did into 1..5. Attention comes from the צו ראשון (prep sites, 2024). */
function toScores(env) {
  const scores = {};
  for (const e of ENVIRONMENTS) {
    if (e.id === 'attention') continue;
    const m = mean(env[e.id]) ?? 0.55;
    scores[e.id] = Math.max(1, Math.min(5, Math.round(1 + m * 4.2 - 0.2)));
  }
  const attention = mean(env.attention);
  scores.attention = attention === null ? 3 : Math.max(1, Math.min(5, Math.round(1 + attention * 4)));
  return scores;
}

async function retake(game, envs) {
  const { state } = game;
  const env = {};
  const testIds = envs.filter((id) => MODULES.some((m) => m.id === id));
  if (testIds.length) {
    const r = await runTests(game, { only: testIds });
    for (const [id, res] of Object.entries(r.results)) addEnv(env, { [id]: res.score });
  }
  if (envs.some((id) => !testIds.includes(id))) {
    await zoomSession(game, { title: 'יום המא״ה · השלמה אחרי ערעור', members: MEMBERS(state.myName) }, async (api) => {
      api.layout(['assessor', 'me']);
      await api.say('assessor', 'שלום. היום נעשה שוב את מה שביקשת בערעור: סימולציה אחת.', { voice: true });
      const sim = SIMS[0];
      api.chat('מאבחנת', sim.title);
      for (const line of sim.lines) {
        await api.say('assessor', line.say, { voice: true, hold: 200 });
        const k = await api.choose(line.choices.map((c) => c.text));
        addEnv(env, line.choices[k].env);
        // Command and teaching are scored from the same answers here (the game's shortcut).
        addEnv(env, { command: line.choices[k].env.care ?? 0.5, teach: line.choices[k].env.maturity ?? 0.5, team: line.choices[k].env.care ?? 0.5 });
      }
    });
  }
  return toScores(env);
}

async function scores(game) {
  const { ui, player, sky, world, state } = game;
  await ui.interlude('כעבור כשבועיים…', 2200);
  sky.setTime('afternoon');
  world.setOutside('day');
  game.setClock('שבועיים אחרי', 17 * 60 + 20);
  player.teleport(HOME_SPOTS.spawn.x, HOME_SPOTS.spawn.z, 0.5);
  state.scores = toScores(state.env ?? {});
  await phone(game, 'הודעה מהאזור האישי');
  await smsPanel(ui, { from: 'מתגייסים', time: 'יום ד׳ · 17:20', text: 'ציוני יום המא״ה עלו לאזור האישי.' });
  await sitAtDesk(game, 'לראות את הציונים');
  const note = tzav().played ? 'קשב: לפי אתרי הכנה נמדד מ־2024 בצו הראשון. כאן הוא מבוסס על התור בצ׳אט.' : 'קשב: לפי אתרי הכנה נמדד מ־2024 בצו הראשון. ההמרה מתשובות לציונים במשחק היא של המשחק.';
  const choice = await scoresPage(game, { scores: state.scores, canAppeal: true, note });
  await ui.fact(FACTS.scores.title, FACTS.scores.points);
  if (choice === 'appeal') {
    await ui.fact(FACTS.appeal.title, FACTS.appeal.points);
    const form = await appealForm(game, { scores: state.scores });
    if (form) {
      state.appeal = form;
      await ui.interlude('עד 14 יום לתשובה…', 2200);
      if (form.quality >= 0.5) {
        await smsPanel(ui, { from: 'מתגייסים', time: '12 ימים אחר כך', text: 'הערעור שלך אושר. תזומן להשלמת הסביבות שביקשת. הציון הגבוה מבין השניים יישמר.' });
        const again = await retake(game, form.envs);
        for (const id of form.envs) state.scores[id] = Math.max(state.scores[id], again[id] ?? 0);
        unlock('maa-appeal');
      } else {
        await smsPanel(ui, { from: 'מתגייסים', time: '13 ימים אחר כך', text: 'הערעור שלך נבחן ולא אושר. הציונים נשארים כפי שהם.' });
      }
      await scoresPage(game, { scores: state.scores, canAppeal: false, note: 'אחרי הערעור. אין ערעור נוסף בתהליך הזה.' });
    }
  }
  if (Object.values(state.scores).some((s) => s === 5)) unlock('maa-five');
  game.world.setScreen('idle');
  player.standUp(false);
  game.save('scores');
}

// ---------- The questionnaire ----------

async function questionnaireStep(game) {
  const { ui, player, state } = game;
  await ui.interlude('אוגוסט. השאלון נפתח באזור האישי.', 2200);
  game.setClock('אוגוסט', 20 * 60 + 10);
  player.teleport(HOME_SPOTS.spawn.x, HOME_SPOTS.spawn.z, 0.5);
  await ui.fact(FACTS.questionnaire.title, FACTS.questionnaire.points);
  await sitAtDesk(game, 'למלא את שאלון ההעדפות');
  const data = tzav();
  state.answers = await questionnaire(game, data);
  game.world.setScreen('idle');
  player.standUp(false);
  game.save('questionnaire');
}

// ---------- What opened ----------

async function opened(game) {
  const { ui, state } = game;
  const data = tzav();
  const a = state.answers ?? { general: {}, units: {} };
  const g = a.general;
  const items = [];
  const fight = g.fight ?? 3;
  if (fight >= 3 && data.profile >= 82 && data.dapar >= 50 && (a.units.sayarot ?? 0) >= 3) {
    items.push(['זימון ליום סיירות', 'רשמי: פרופיל 82 ודפ״ר 50 ומעלה מזמנים אוטומטית. היום הוא צומת של כל מסלולי העילית.', '../yom-sayarot/?new=1', 'ליום הסיירות']);
  }
  if (data.dapar >= 60) items.push(['מסלול טיס: בוחן מקוון', 'לפי הודעת צה״ל (2025) מי שעומד בתנאים מוזמן אוטומטית. לפי אתר הכנה: דפ״ר 60 ופרופיל מתאים.', '../pilot-path/', 'למסלול לטיס']);
  if (fight >= 3 && (g.prescreen ?? 0) >= 3 && (a.units.tzanhanim ?? 0) >= 3 && data.profile >= 82) items.push(['גיבוש צנחנים', 'חטיבה התנדבותית, ולכן יש לה גיבוש לפני הגיוס. לפי תחקיר משתתף (01/2025) הוא יום אחד עם מבחן בִּיפ, ספרינטים ואלונקה. השלב הזה עוד לא במשחק.', null]);
  const field = Object.entries(a.units)
    .filter(([id, n]) => !['sayarot', 'tzanhanim'].includes(id) && n >= 4)
    .map(([id]) => QUESTIONNAIRE.units.find((u) => u.id === id).name);
  if (fight >= 3) items.push(['יחידות השדה', `${field.length ? `דירגת גבוה: ${field.join(', ')}. ` : ''}השיבוץ נקבע לפי צורכי הצבא, הנתונים וההעדפות (רשמי). לפי הנוסח של 2024, עד 45 יום לפני הגיוס.`, null]);
  else items.push(['לא סימנת רצון ללחימה', 'השיבוץ יהיה לפי עולמות התוכן ולפי צורכי הצבא. ממחזור אוגוסט 2026 מי שלא מיועד ללחימה מקבל שיבוץ קבוע כבר בי״א (רשמי, דצמבר 2025).', null]);
  await ui.fact(FACTS.placement.title, FACTS.placement.points);
  saveResults('yom-hamaa', { scores: state.scores, fight, units: a.units });
  unlock('maa-done');
  const choice = await openedPage(game, {
    items,
    note: 'מה נפתח נקבע במשחק לפי הספים שפורסמו ליום סיירות ולטיס. הספים לשאר התפקידים והמשקלות של השיבוץ לא פורסמו.',
  });
  game.clearSave();
  if (choice === 'again') window.location.href = './?new=1';
  else if (choice === 'menu') window.location.href = '../main-screen/';
  else window.location.href = choice;
}

export const HANDLERS = { invite, morning, tests, zoom, scores, questionnaire: questionnaireStep, opened };
