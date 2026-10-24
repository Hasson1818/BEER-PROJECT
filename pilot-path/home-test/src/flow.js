import { HOME_SPOTS } from '../../shared/home-room.js';
import { FACTS, SMS_INVITE, PREP_ITEMS, MORNING_LINES, RESULT } from './content.js';
import { runExam } from './portal.js';
import { smsPanel, answerPhone } from '../../shared/panels.js';
import { fx } from '../../shared/fx.js';
import { saveResult, saveAnswers } from '../../shared/progress.js';
import { unlock } from '../../../shared/achievements.js';

export const STEPS = ['evening', 'morning', 'exam', 'wait', 'answer'];

const PASS_LINE = 0.3; // Only in the game: the real threshold was never published.

const groundTarget = (spot, y = 1.5) => ({ x: spot.x, y, z: spot.z });

async function evening(game) {
  const { ui, player, sky, world, state } = game;
  sky.setTime('night');
  world.setOutside('night');
  game.setClock('בבית', 21 * 60 + 15);
  player.teleport(HOME_SPOTS.spawn.x, HOME_SPOTS.spawn.z, 0.5);
  await ui.fadeIn();

  ui.setObjective('הטלפון רטט', 'הוא על שידת המיטה');
  game.setTarget(groundTarget(HOME_SPOTS.phone, 1.35));
  fx.notify();
  await game.waitInteract('phone');
  game.setTarget(null);
  await smsPanel(ui, SMS_INVITE);
  await ui.fact(FACTS.new.title, FACTS.new.points);
  await ui.fact(FACTS.format.title, FACTS.format.points);
  await ui.fact(FACTS.tips.title, FACTS.tips.points);
  state.prepared = [];
  game.save('evening');
  await ui.interlude('הלילה עובר, ואיכשהו נרדמים. למחרת בבוקר…', 2600);
}

async function morning(game) {
  const { ui, player, sky, world, state } = game;
  sky.setTime('day');
  world.setOutside('day');
  game.setClock('בבית', 8 * 60 + 20);
  player.teleport(HOME_SPOTS.spawn.x, HOME_SPOTS.spawn.z, 0.5);
  await ui.fadeIn();
  for (const line of MORNING_LINES) await ui.talk('אני', line);

  // Make the room ready: the three things the prep sites recommend. Free order.
  const done = new Set();
  const refresh = () => {
    const left = PREP_ITEMS.filter((p) => !done.has(p.id));
    ui.setObjective(`הכן את החדר (${done.size}/${PREP_ITEMS.length})`, left.map((p) => p.objective).join(' · '));
    game.setTarget(() => {
      const next = left[0];
      return next ? groundTarget(HOME_SPOTS[next.id === 'window' ? 'window' : next.id], 1.5) : null;
    });
  };
  refresh();
  await Promise.all(
    PREP_ITEMS.map((item) =>
      game.waitInteract(item.id).then(() => {
        done.add(item.id);
        ui.toast(item.line);
        fx.click();
        game.world.prep(item.id);
        refresh();
      }),
    ),
  );
  state.prepared = [...done];
  unlock('pilot-home-prep');

  ui.setObjective('שב ליד השולחן', 'הכיסא מול המחשב');
  game.setTarget(groundTarget(HOME_SPOTS.chair, 1.2));
  await game.waitInteract('chair');
  game.setTarget(null);
  player.sit({ x: HOME_SPOTS.chair.x, z: HOME_SPOTS.chair.z, exit: { x: HOME_SPOTS.chair.x - 0.7, z: HOME_SPOTS.chair.z + 0.3 } }, 0);
  game.setClock('בבית', 8 * 60 + 28);
  ui.setObjective('פתח את המחשב', 'הקישור כבר פעיל');
  game.setTarget(groundTarget({ x: 1.45, z: -2.85 }, 1.15));
  await game.waitInteract('laptop');
  game.setTarget(null);
  fx.boot();
  game.world.setScreen('on');
  game.save('morning');
}

async function exam(game) {
  const { ui, state } = game;
  game.setClock('בבית', 8 * 60 + 30);
  ui.setObjective('הבוחן המקוון', 'ארבע מטלות קצרות');
  const result = await runExam(game, { id: '316094527' });
  state.exam = result;
  game.world.setScreen('idle');
  game.player.standUp(false);
  game.save('exam');
}

async function wait(game) {
  const { ui, sky, world, player, state } = game;
  await ui.interlude('עברו כשבוע וחצי של המתנה…', 2800);
  sky.setTime('afternoon');
  world.setOutside('day');
  game.setClock('בבית', 18 * 60 + 40);
  player.teleport(HOME_SPOTS.spawn.x, HOME_SPOTS.spawn.z, 0.5);
  ui.setObjective('הטלפון רטט', 'הודעה מחיל האוויר');
  game.setTarget(groundTarget(HOME_SPOTS.phone, 1.35));
  fx.notify();
  await game.waitInteract('phone');
  game.setTarget(null);
  state.passed = state.exam.score >= PASS_LINE;
  game.save('wait');
}

async function answer(game) {
  const { ui, state } = game;
  const passed = state.passed;
  const text = passed ? RESULT.pass : RESULT.fail;
  const tasks = state.exam.tasks;
  const lines = [
    ['דלי ומים', tasks.bucket?.summary ?? '-'],
    ['חיצים וריבועים', tasks.arrows?.summary ?? '-'],
    ['סמלים בשישה מקשים', tasks.symbols6?.summary ?? '-'],
    ['מיון מהיר', tasks.sort2?.summary ?? '-'],
  ];
  const choice = await answerPhone(ui, {
    from: text.from,
    time: 'כשבועיים אחרי הבוחן · 18:40',
    headline: text.headline,
    detail: text.detail,
    lines,
    note: 'במציאות לא מקבלים פירוט. אין פרסום של הציון, של הרף או של אחוזי המעבר, והמשחק לא ממציא אותם.',
    buttons: [
      { id: 'next', label: passed ? 'לירפ״א א׳' : 'לירפ״א א׳ (המשך בכל זאת)' },
      { id: 'again', label: 'לנסות שוב', secondary: true },
      { id: 'hub', label: 'חזרה למסלול', secondary: true },
    ],
  });
  saveResult('home-test', { passed, score: Math.round(state.exam.score * 100) / 100, tasks: Object.fromEntries(Object.entries(tasks).map(([k, v]) => [k, v.score])) });
  saveAnswers({ prepared: state.prepared?.length ?? 0 });
  if (passed) {
    unlock('pilot-home-done');
    if ((tasks.bucket?.score ?? 0) >= 0.8) unlock('pilot-bucket');
    if (state.exam.score >= 0.85) unlock('pilot-home-sharp');
  }
  game.clearSave();
  await ui.fact(FACTS.end.title, FACTS.end.points);
  if (choice === 'next') window.location.href = '../yarpa-a/?new=1';
  else if (choice === 'again') window.location.href = './?new=1';
  else window.location.href = '../';
}

export const HANDLERS = { evening, morning, exam, wait, answer };
