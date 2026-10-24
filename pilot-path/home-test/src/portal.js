import { showScreen, browserWindow, el, button, introCard, typeInto } from '../../shared/screens.js';
import { fx } from '../../shared/fx.js';
import { HOME_TASKS, runHomeTask } from '../../shared/home-tasks.js';

// The test portal on the laptop: log in, check the computer, then four short tasks, each with
// instructions and an optional practice. No score is shown while you work, like the real thing.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function strip(current) {
  const row = el('div', 'ht-strip');
  HOME_TASKS.forEach((task, i) => {
    const item = el('div', `ht-step${i < current ? ' done' : i === current ? ' on' : ''}`);
    item.append(el('i', '', i < current ? '✓' : String(i + 1)), el('span', '', task.title));
    row.append(item);
  });
  return row;
}

async function loginPage(body, { id }) {
  body.innerHTML = '';
  const page = el('div', 'ht-login');
  page.append(el('div', 'ht-logo', '✈'), el('h1', 'pp-title', 'בוחן מקוון · מיון לקורס טיס'), el('p', 'pp-sub', 'חיל האוויר הישראלי'));
  const form = el('div', 'ht-form');
  const idField = el('label', 'ht-field');
  idField.append(el('span', '', 'תעודת זהות'));
  const idValue = el('output', 'ht-input');
  idField.append(idValue);
  const codeField = el('label', 'ht-field');
  codeField.append(el('span', '', 'קוד כניסה (מה־SMS)'));
  const codeValue = el('output', 'ht-input');
  codeField.append(codeValue);
  const go = button('כניסה לבוחן');
  go.disabled = true;
  form.append(idField, codeField, go);
  page.append(form, el('p', 'pp-note', 'מדפדפן Chrome או Edge בלבד. הקישור פעיל עד 20:00.'));
  body.append(page);
  await wait(500);
  await typeInto(idValue, id, { speed: 90, fx });
  await wait(250);
  await typeInto(codeValue, '584913', { speed: 110, fx });
  go.disabled = false;
  go.focus();
  await new Promise((resolve) => go.addEventListener('click', () => (fx.click(), resolve())));
}

async function checkPage(body) {
  body.innerHTML = '';
  const page = el('div', 'ht-check');
  page.append(el('p', 'pp-eyebrow', 'לפני שמתחילים'), el('h2', 'pp-title', 'בדיקת המחשב'));
  const list = el('ul', 'ht-checks');
  const items = ['דפדפן: Chrome (נתמך)', 'מקלדת ועכבר: זוהו', 'חיבור לאינטרנט: יציב', 'מסך: גודל מתאים'];
  const nodes = items.map((text) => {
    const li = el('li', 'ht-check-item');
    li.append(el('i', '', '…'), el('span', '', text));
    list.append(li);
    return li;
  });
  page.append(list, el('p', 'pp-note', 'אין צורך במצלמה או במיקרופון: זה לא מבחן בשיחת וידאו. (לפי אתרי הכנה)'));
  body.append(page);
  for (const li of nodes) {
    await wait(520);
    li.classList.add('ok');
    li.firstChild.textContent = '✓';
    fx.ok();
  }
  await wait(500);
  const next = button('הבא');
  const actions = el('div', 'pp-actions');
  actions.append(next);
  page.append(actions);
  next.focus();
  await new Promise((resolve) => next.addEventListener('click', () => (fx.click(), resolve())));
}

async function overviewPage(body) {
  body.innerHTML = '';
  const page = el('div', 'ht-over');
  page.append(el('p', 'pp-eyebrow', 'הוראות כלליות'), el('h2', 'pp-title', 'ארבע מטלות קצרות'));
  const list = el('ul', 'pp-list');
  for (const line of [
    'בבוחן ארבע מטלות. לפני כל מטלה יש הסבר ואפשרות לתרגל.',
    'המטלות בודקות זריזות מחשבה וזיכרון. תענו מהר, אבל בלי להיות פזיזים.',
    'לא תראו ציון בזמן הבוחן. הציון מצטבר לתהליך המיון.',
    'במציאות הבוחן נמשך כ־40 דקות. במשחק הוא מקוצר לכמה דקות.',
  ]) list.append(el('li', '', line));
  const start = button('מתחילים');
  page.append(list, el('div', 'pp-actions'));
  page.lastChild.append(start);
  body.append(page);
  start.focus();
  await new Promise((resolve) => start.addEventListener('click', () => (fx.click(), resolve())));
}

/** Runs one task: instructions, optional practice, then the scored round. Resolves to the task result. */
async function taskPage(body, task, index) {
  for (;;) {
    body.innerHTML = '';
    body.append(strip(index));
    const holder = el('div', 'ht-holder');
    body.append(holder);
    const choice = await introCard(holder, {
      eyebrow: `מטלה ${index + 1} מתוך ${HOME_TASKS.length}`,
      title: task.title,
      lines: task.intro,
      keys: task.keysHelp ?? [],
      note: 'במציאות יש הוראות מפורטות ותרגול. כאן הם מקוצרים.',
    });
    holder.innerHTML = '';
    const stage = el('div', 'ht-stage');
    holder.append(stage);
    if (choice === 'practice') {
      await runHomeTask(task.id, stage, { practice: true, fx });
      continue;
    }
    const result = await runHomeTask(task.id, stage, { practice: false, fx });
    fx.done();
    return result;
  }
}

/** The whole exam in one screen. Resolves to { tasks: {id: result}, score }. */
export function runExam(game, { id = '316 …' }) {
  return showScreen(game, 'ht-screen', async (root, close) => {
    const { body } = browserWindow(root, 'https://mitgaisim.idf.il/air-force-screening');
    const results = {};
    await loginPage(body, { id });
    await checkPage(body);
    await overviewPage(body);
    for (let i = 0; i < HOME_TASKS.length; i++) {
      const task = HOME_TASKS[i];
      results[task.id] = await taskPage(body, task, i);
    }
    body.innerHTML = '';
    const end = el('div', 'ht-end');
    end.append(el('div', 'ht-logo big', '✓'), el('h2', 'pp-title', 'הבוחן נשלח'), el('p', 'pp-sub', 'התשובה תישלח אליך ב־SMS בימים הקרובים. אפשר לסגור את החלון.'));
    body.append(end);
    fx.done();
    await wait(2200);
    const scores = Object.values(results).map((r) => r.score);
    close({ tasks: results, score: scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length) });
  });
}

const STYLE_ID = 'ht-portal-style';
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .ht-login, .ht-check, .ht-over, .ht-end { max-width: 560px; margin: 4vh auto 0; text-align: center; animation: pp-fade .4s ease both; }
    .ht-check, .ht-over { text-align: right; }
    .ht-logo { display: grid; place-items: center; width: 74px; height: 74px; margin: 0 auto 10px; border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #5da6ff, #1d4f9e); font-size: 2rem; color: #fff; box-shadow: 0 10px 30px rgba(40,100,200,.5); }
    .ht-logo.big { width: 96px; height: 96px; font-size: 3rem; background: radial-gradient(circle at 35% 30%, #5be0a8, #17895f); box-shadow: 0 10px 40px rgba(60,200,140,.5); animation: ht-pop .6s cubic-bezier(.2,1.4,.4,1) both; }
    @keyframes ht-pop { from { transform: scale(.3); opacity: 0; } }
    .ht-form { display: grid; gap: 12px; margin: 18px 0 8px; text-align: right; }
    .ht-field { display: grid; gap: 4px; font-size: .85rem; color: var(--pp-muted); }
    .ht-input { display: block; min-height: 46px; padding: 11px 14px; border-radius: 10px; background: #0a1120; color: #fff;
      box-shadow: inset 0 0 0 1px var(--pp-line); font: 600 1.15rem ui-monospace, Menlo, monospace; letter-spacing: .1em; direction: ltr; text-align: left; }
    .ht-checks { display: grid; gap: 8px; margin: 12px 0; padding: 0; list-style: none; }
    .ht-check-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 10px; background: var(--pp-panel); box-shadow: inset 0 0 0 1px var(--pp-line); }
    .ht-check-item i { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,.1); font-style: normal; font-weight: 800; }
    .ht-check-item.ok i { background: var(--pp-good); color: #04251a; animation: ht-pop .4s ease both; }
    .ht-strip { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
    .ht-step { display: flex; align-items: center; gap: 8px; padding: 5px 12px 5px 8px; border-radius: 999px; background: rgba(255,255,255,.06); color: var(--pp-muted); font-size: .85rem; font-weight: 700; }
    .ht-step i { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: rgba(255,255,255,.12); font-style: normal; font-size: .75rem; }
    .ht-step.on { background: rgba(78,161,255,.18); color: #fff; box-shadow: inset 0 0 0 1px var(--pp-accent); }
    .ht-step.on i { background: var(--pp-accent); color: #06142c; }
    .ht-step.done { color: var(--pp-good); }
    .ht-step.done i { background: var(--pp-good); color: #04251a; }
    .ht-stage { position: relative; width: min(900px, 100%); height: min(500px, 62vh); margin: 0 auto; border-radius: 14px; overflow: hidden; background: #0a1120; box-shadow: inset 0 0 0 1px var(--pp-line); }
    .ht-holder { min-height: 200px; }
  `;
  document.head.append(style);
}
