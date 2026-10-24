import { HOME_SPOTS } from '../../shared/home-room.js';
import { FACTS, MAIL, RESULT } from './content.js';
import { runCall } from './call.js';
import { smsPanel, answerPhone, noticeCard } from '../../shared/panels.js';
import { fx } from '../../shared/fx.js';
import { saveResult, getAnswers } from '../../shared/progress.js';
import { unlock } from '../../../shared/achievements.js';
import { PREP_ITEMS } from '../../home-test/src/content.js';

export const STEPS = ['mail', 'prep', 'call', 'result'];

const groundTarget = (spot, y = 1.5) => ({ x: spot.x, y, z: spot.z });

async function mail(game) {
  const { ui, player, sky, world } = game;
  sky.setTime('night');
  world.setOutside('night');
  game.setClock('לפני הראיון', 17 * 60 + 20);
  player.teleport(HOME_SPOTS.spawn.x, HOME_SPOTS.spawn.z, 0.5);
  await ui.fadeIn();
  ui.setObjective('הטלפון רטט', 'מייל מחיל האוויר');
  game.setTarget(groundTarget(HOME_SPOTS.phone, 1.35));
  fx.notify();
  await game.waitInteract('phone');
  game.setTarget(null);
  await smsPanel(ui, { ...MAIL, label: 'אמלא ואחזיר' });
  await ui.fact(FACTS.what.title, FACTS.what.points);
  await ui.fact(FACTS.honest.title, FACTS.honest.points);
  game.save('mail');
  await ui.interlude('הערב עובר. למחרת בבוקר…', 2400);
}

async function prep(game) {
  const { ui, player, sky, world, state } = game;
  sky.setTime('day');
  world.setOutside('day');
  world.resetPrep?.();
  game.setClock('יום הראיון', 8 * 60 + 15);
  player.teleport(HOME_SPOTS.spawn.x, HOME_SPOTS.spawn.z, 0.5);
  await ui.fadeIn();
  await ui.talk('אני', 'שמונה ורבע. הראיון בשמונה וארבעים וחמש. אין סיבה להילחץ.');
  const done = new Set();
  const refresh = () => {
    const left = PREP_ITEMS.filter((p) => !done.has(p.id));
    ui.setObjective(`הכן את החדר (${done.size}/${PREP_ITEMS.length})`, left.map((p) => p.objective).join(' · '));
    game.setTarget(() => (left[0] ? groundTarget(HOME_SPOTS[left[0].id], 1.5) : null));
  };
  refresh();
  await Promise.all(
    PREP_ITEMS.map((item) =>
      game.waitInteract(item.id).then(() => {
        done.add(item.id);
        ui.toast(item.line);
        fx.click();
        world.prep(item.id);
        refresh();
      }),
    ),
  );
  state.prepared = [...done];
  ui.setObjective('שב ליד השולחן', 'הראיון בזום, מהמחשב בלבד');
  game.setTarget(groundTarget(HOME_SPOTS.chair, 1.2));
  await game.waitInteract('chair');
  game.setTarget(null);
  player.sit({ x: HOME_SPOTS.chair.x, z: HOME_SPOTS.chair.z, exit: { x: HOME_SPOTS.chair.x - 0.7, z: HOME_SPOTS.chair.z + 0.3 } }, 0);
  ui.setObjective('פתח את המחשב והצטרף', 'הקישור שקיבלת');
  game.setTarget(groundTarget({ x: 1.45, z: -2.85 }, 1.15));
  await game.waitInteract('laptop');
  game.setTarget(null);
  fx.boot();
  world.setScreen('call');
  await noticeCard(ui, {
    eyebrow: 'לפני שמצטרפים',
    title: 'בדיקה טכנית',
    lines: ['חיבור לאינטרנט: יציב', 'מיקרופון: עובד', 'מצלמה: עובדת (לפי אתרי הכנה, הראיון בזום ומהמחשב בלבד)', 'חדר שקט, בלי הפרעות'],
    label: 'מצטרף לשיחה',
  });
  game.save('prep');
}

async function call(game) {
  const { state } = game;
  game.setClock('יום הראיון', 8 * 60 + 45);
  const result = await runCall(game, { answers: getAnswers() });
  state.call = result;
  game.world.setScreen('idle');
  game.player.standUp(false);
  game.save('call');
}

async function resultStep(game) {
  const { ui, sky, world, player, state } = game;
  await ui.interlude('אחר הצהריים. הטלפון מצלצל…', 2400);
  sky.setTime('afternoon');
  world.setOutside('day');
  game.setClock('אחר הצהריים', 16 * 60 + 40);
  player.teleport(HOME_SPOTS.spawn.x, HOME_SPOTS.spawn.z, 0.5);
  ui.setObjective('הטלפון מצלצל', 'חיל האוויר');
  game.setTarget(groundTarget(HOME_SPOTS.phone, 1.35));
  fx.ring();
  await game.waitInteract('phone');
  game.setTarget(null);

  const s = state.call.scores;
  const total = 0.4 * s.honesty + 0.2 * s.motivation + 0.25 * s.resilience + 0.15 * s.team;
  const passed = total >= 0.5;
  const pct = (v) => `${Math.round(v * 100)}%`;
  const text = passed ? RESULT.pass : RESULT.fail;
  const lines = [
    ['עקביות עם השאלון', pct(s.consistency)],
    ['כנות', pct(s.honesty)],
    ['מוטיבציה', pct(s.motivation)],
    ['התמודדות עם קושי', pct(s.resilience)],
    ['עבודת צוות', pct(s.team)],
  ];
  if (state.call.mismatches.length) lines.push(['נושאים שענית בהם אחרת מהשאלון', String(state.call.mismatches.length)]);
  const choice = await answerPhone(ui, {
    from: text.from,
    time: 'אחר הצהריים · שיחת טלפון',
    headline: text.headline,
    detail: text.detail,
    lines,
    note: 'במציאות אין פירוט כזה, ולא ידוע משקל הראיון בציון הסופי. לא נמצא נתון רשמי על אחוז הנפסלים בשלב הזה.',
    buttons: passed
      ? [
          { id: 'next', label: 'לגיבוש טייס' },
          { id: 'hub', label: 'חזרה למסלול', secondary: true },
        ]
      : [
          { id: 'again', label: 'לנסות שוב (רק במשחק)' },
          { id: 'hub', label: 'חזרה למסלול', secondary: true },
        ],
  });
  saveResult('psychologist', { passed, score: Math.round(total * 100) / 100, scores: s });
  unlock('pilot-psych-done');
  if (s.honesty >= 0.85 && state.call.flags.length === 0) unlock('pilot-psych-honest');
  if (s.consistency >= 0.85) unlock('pilot-consistent');
  game.clearSave();
  await ui.fact(FACTS.end.title, FACTS.end.points);
  if (choice === 'next') window.location.href = '../../gibbush-tayis/?new=1';
  else if (choice === 'again') window.location.href = './?new=1';
  else window.location.href = '../';
}

export const HANDLERS = { mail, prep, call, result: resultStep };
