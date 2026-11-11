import { showScreen, browserWindow, el, button } from '../../pilot-path/shared/screens.js';
import { fx } from '../../pilot-path/shared/fx.js';
import { ENVIRONMENTS, QUESTIONNAIRE } from './content.js';

// The personal area on the מתגייסים site: confirm the invitation, the 12 scores, the appeal form, the
// preferences questionnaire, and what opened for you. The pages are drawn by the game; the real site looks different.

const URL = 'https://www.mitgaisim.idf.il/personal-area';

function page(body, { eyebrow, title, sub }) {
  body.innerHTML = '';
  const wrap = el('div', 'pa-page');
  const head = el('div', 'pa-head');
  head.append(el('span', 'pa-logo', 'מתגייסים'), el('span', 'pa-user', 'האזור האישי'));
  wrap.append(head, el('p', 'pp-eyebrow', eyebrow ?? ''), el('h2', 'pp-title', title));
  if (sub) wrap.append(el('p', 'pp-sub', sub));
  body.append(wrap);
  return wrap;
}

function actions(...buttons) {
  const row = el('div', 'pp-actions');
  row.append(...buttons);
  return row;
}

const clickOnce = (b) => new Promise((r) => b.addEventListener('click', () => (fx.click(), r()), { once: true }));

/** The invitation: confirm, or move it. Resolves to 'confirm' | 'move'. */
export function confirmInvite(game) {
  return showScreen(game, 'pa-screen', async (root, close) => {
    const { body } = browserWindow(root, URL);
    const p = page(body, { eyebrow: 'זימונים', title: 'יום המא״ה · יום ג׳ · 08:00 · מהבית', sub: 'יש לאשר הגעה עד מחר. ביום עצמו יישלחו קישור לזום וקבוצת וואטסאפ.' });
    const list = el('ul', 'pp-list');
    for (const line of ['מחשב (לא טלפון) עם מצלמה ומיקרופון, ואינטרנט יציב', 'עכבר חיצוני וזום מותקן', 'דף, עט ותעודה מזהה', 'חדר שקט לכל היום (כ־08:00 עד 16:00)']) list.append(el('li', '', line));
    p.append(list, el('p', 'pp-note', 'הרשימה לפי אתרי הכנה ודפים רשמיים. הדף מצויר על ידי המשחק.'));
    const ok = button('אישור הגעה');
    const move = button('הזזת זימונים', 'pp-btn secondary');
    p.append(actions(move, ok));
    const value = await Promise.race([clickOnce(ok).then(() => 'confirm'), clickOnce(move).then(() => 'move')]);
    close(value);
  });
}

function dots(score) {
  const row = el('span', 'pa-dots');
  for (let i = 1; i <= 5; i++) row.append(el('i', i <= score ? 'on' : ''));
  return row;
}

/** The 12 scores. `canAppeal`: show the appeal button. Resolves to 'appeal' | 'next'. */
export function scoresPage(game, { scores, canAppeal, note }) {
  return showScreen(game, 'pa-screen', async (root, close) => {
    const { body } = browserWindow(root, URL);
    const p = page(body, { eyebrow: 'תוצאות יום המא״ה', title: 'ציוני סביבות העבודה', sub: '1 עד 5 לכל סביבה. אין ציון כולל.' });
    const groups = [...new Set(ENVIRONMENTS.map((e) => e.group))];
    const grid = el('div', 'pa-scores');
    for (const g of groups) {
      const box = el('div', 'pa-group');
      box.append(el('h3', '', g));
      for (const env of ENVIRONMENTS.filter((e) => e.group === g)) {
        const row = el('div', 'pa-row');
        row.append(el('span', '', env.name), dots(scores[env.id]), el('b', '', String(scores[env.id])));
        box.append(row);
      }
      grid.append(box);
    }
    p.append(grid);
    if (note) p.append(el('p', 'pp-note', note));
    const next = button('המשך');
    const buttons = [next];
    let appeal = null;
    if (canAppeal) {
      appeal = button('הגשת ערעור (פעם אחת)', 'pp-btn secondary');
      buttons.unshift(appeal);
    }
    p.append(actions(...buttons));
    const races = [clickOnce(next).then(() => 'next')];
    if (appeal) races.push(clickOnce(appeal).then(() => 'appeal'));
    close(await Promise.race(races));
  });
}

const REASONS = ['תקלה טכנית ביום המיון', 'מצב בריאותי ביום המיון', 'נסיבות אישיות שהשפיעו עליי', 'הציון לא משקף אותי'];
const LETTERS = [
  { text: 'בסימולציות ובהדרכה הייתי אחרי לילה בלי שינה בגלל אשפוז של סבא שלי. אני מבקש לעשות שוב את הסביבות האלה. אני מצרף אישור מבית החולים.', quality: 1 },
  { text: 'אני חושב שמגיע לי יותר. אני מבקש לעשות שוב.', quality: 0.2 },
  { text: 'אני רוצה ציון 5 בכל הסביבות כי אני רוצה ליחידה טובה.', quality: 0 },
];

/** Pick up to three environments, a reason and a letter. Resolves to { envs, reason, quality } or null. */
export function appealForm(game, { scores }) {
  return showScreen(game, 'pa-screen', async (root, close) => {
    const { body } = browserWindow(root, URL);
    const p = page(body, { eyebrow: 'ערעור על ציוני יום המא״ה', title: 'אילו סביבות לעשות שוב?', sub: 'רשמי: ערעור אחד לכל תהליך מיון, עם מכתב אישי. לפי אתרי הכנה: עד 3 סביבות.' });
    const chosen = new Set();
    const grid = el('div', 'pa-pick');
    const send = button('שליחת הערעור');
    send.disabled = true;
    let reason = null;
    let letter = null;
    const refresh = () => {
      send.disabled = !chosen.size || reason === null || letter === null;
    };
    for (const env of ENVIRONMENTS.filter((e) => e.id !== 'attention')) {
      const b = button(`${env.name} · ${scores[env.id]}`, 'pa-chip');
      b.addEventListener('click', () => {
        fx.click();
        if (chosen.has(env.id)) chosen.delete(env.id);
        else if (chosen.size < 3) chosen.add(env.id);
        b.classList.toggle('on', chosen.has(env.id));
        refresh();
      });
      grid.append(b);
    }
    p.append(grid, el('h3', 'pa-h3', 'סיבה'));
    const reasons = el('div', 'pa-pick');
    REASONS.forEach((r, i) => {
      const b = button(r, 'pa-chip');
      b.addEventListener('click', () => {
        fx.click();
        reason = i;
        [...reasons.children].forEach((c, k) => c.classList.toggle('on', k === i));
        refresh();
      });
      reasons.append(b);
    });
    p.append(reasons, el('h3', 'pa-h3', 'מכתב אישי'));
    const letters = el('div', 'pa-letters');
    LETTERS.forEach((l, i) => {
      const b = button(l.text, 'pa-letter');
      b.addEventListener('click', () => {
        fx.click();
        letter = i;
        [...letters.children].forEach((c, k) => c.classList.toggle('on', k === i));
        refresh();
      });
      letters.append(b);
    });
    const cancel = button('בלי ערעור', 'pp-btn secondary');
    p.append(letters, el('p', 'pp-note', 'במשחק בוחרים מכתב מוכן. במציאות כותבים לבד. מה הופך ערעור למאושר לא פורסם.'), actions(cancel, send));
    const value = await Promise.race([
      clickOnce(send).then(() => ({ envs: [...chosen], reason, quality: LETTERS[letter].quality })),
      clickOnce(cancel).then(() => null),
    ]);
    close(value);
  });
}

/** A row of 1..5 buttons; calls onPick(n). */
function scale(onPick, initial = null) {
  const row = el('div', 'pa-scale');
  for (let n = 1; n <= 5; n++) {
    const b = button(String(n), 'pa-num');
    if (n === initial) b.classList.add('on');
    b.addEventListener('click', () => {
      fx.click();
      [...row.children].forEach((c, k) => c.classList.toggle('on', k === n - 1));
      onPick(n);
    });
    row.append(b);
  }
  return row;
}

/**
 * The combat questionnaire ("יחידות שדה"). `profile`: units that need more are closed.
 * Resolves to { general: {id: n}, units: {id: n} }.
 */
export function questionnaire(game, { profile, dapar }) {
  return showScreen(game, 'pa-screen', async (root, close) => {
    const { body } = browserWindow(root, URL);
    const answers = { general: {}, units: {} };
    // Steps 1–3: the general questions.
    for (const [i, item] of QUESTIONNAIRE.general.entries()) {
      const p = page(body, { eyebrow: `שאלון העדפות · שלב ${i + 1} מתוך 5`, title: item.q, sub: '1 = בכלל לא, 5 = מאוד רוצה' });
      const next = button('הבא');
      next.disabled = true;
      p.append(scale((n) => {
        answers.general[item.id] = n;
        next.disabled = false;
      }), actions(next));
      await clickOnce(next);
    }
    // Step 4: the units.
    {
      const p = page(body, { eyebrow: 'שאלון העדפות · שלב 4 מתוך 5', title: 'דרג כל אחת מהיחידות', sub: `הנתונים שלך: פרופיל ${profile}, דפ״ר ${dapar ?? 'לא ידוע'}. לפי עדויות: לא כדאי לתת ציון נמוך לרוב התפקידים, כי אפשר להשתבץ גם במה שדירגת נמוך.` });
      const list = el('div', 'pa-units');
      const next = button('הבא');
      for (const unit of QUESTIONNAIRE.units) {
        const need = Number(unit.needs.match(/\d+/)[0]);
        const open = profile >= need && (unit.id !== 'sayarot' || (dapar ?? 0) >= 50);
        const row = el('div', `pa-unit${open ? '' : ' closed'}`);
        row.append(el('span', 'pa-unit-name', unit.name), el('small', '', unit.needs));
        if (open) {
          answers.units[unit.id] = 3;
          row.append(scale((n) => (answers.units[unit.id] = n), 3));
        } else row.append(el('em', '', 'לא פתוח בנתונים שלך'));
        list.append(row);
      }
      p.append(list, el('p', 'pp-note', 'הרשימה מקוצרת ונכתבה על ידי המשחק. אם מדרגים יחידות זו מול זו או נותנים לכל אחת ציון, לא ברור מהמקורות.'), actions(next));
      await clickOnce(next);
    }
    // Step 5: the summary.
    {
      const p = page(body, { eyebrow: 'שאלון העדפות · שלב 5 מתוך 5', title: 'סיכום', sub: 'השאלון פתוח לזמן מוגבל. אפשר לשנות עד תאריך הסגירה.' });
      const ul = el('ul', 'pp-list');
      for (const item of QUESTIONNAIRE.general) ul.append(el('li', '', `${item.q} ${answers.general[item.id]}`));
      const top = Object.entries(answers.units).sort((a, b) => b[1] - a[1]).slice(0, 3);
      ul.append(el('li', '', `הכי גבוה: ${top.map(([id, n]) => `${QUESTIONNAIRE.units.find((u) => u.id === id).name} (${n})`).join(', ')}`));
      p.append(ul, el('p', 'pp-note', 'תאריך הסגירה מופיע במסך הסיכום (רשמי). כאן הוא לא אמיתי: 30.09.'));
      const send = button('שליחת השאלון');
      p.append(actions(send));
      await clickOnce(send);
    }
    close(answers);
  });
}

/** What opened for you: a list of [title, detail, href?]. Resolves to the href picked, or null. */
export function openedPage(game, { items, note }) {
  return showScreen(game, 'pa-screen', async (root, close) => {
    const { body } = browserWindow(root, URL);
    const p = page(body, { eyebrow: 'המסלול שלי', title: 'מה נפתח לך', sub: 'לפי הנתונים מהצו הראשון, ציוני יום המא״ה והשאלון.' });
    const list = el('div', 'pa-open');
    const races = [];
    for (const [title, detail, href, label] of items) {
      const card = el('div', 'pa-open-item');
      card.append(el('b', '', title), el('span', '', detail));
      if (href) {
        const go = button(label ?? 'לשלב הזה');
        races.push(clickOnce(go).then(() => href));
        card.append(go);
      }
      list.append(card);
    }
    const menu = button('לתפריט הראשי', 'pp-btn secondary');
    const again = button('לשחק שוב', 'pp-btn secondary');
    races.push(clickOnce(menu).then(() => 'menu'), clickOnce(again).then(() => 'again'));
    p.append(list);
    if (note) p.append(el('p', 'pp-note', note));
    p.append(actions(again, menu));
    close(await Promise.race(races));
  });
}

const STYLE_ID = 'pa-style';
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .pa-page { max-width: 820px; margin: 0 auto; padding-bottom: 20px; animation: pp-fade .35s ease both; }
    .pa-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; padding: 8px 14px; border-radius: 10px; background: rgba(78,161,255,.12); }
    .pa-logo { font: 800 1rem 'Secular One', 'Heebo', sans-serif; color: #9fd0ff; }
    .pa-user { color: var(--pp-muted); font-size: .85rem; }
    .pa-scores { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; margin: 14px 0; }
    .pa-group { padding: 12px 14px; border-radius: 12px; background: var(--pp-panel); box-shadow: inset 0 0 0 1px var(--pp-line); }
    .pa-group h3 { margin: 0 0 8px; font-size: .9rem; color: #9fd0ff; }
    .pa-row { display: grid; grid-template-columns: 1fr auto 1.4em; align-items: center; gap: 8px; padding: 4px 0; }
    .pa-row b { text-align: center; }
    .pa-dots { display: flex; gap: 3px; }
    .pa-dots i { width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,.14); }
    .pa-dots i.on { background: #4ea1ff; }
    .pa-pick { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
    .pa-chip { padding: 8px 12px; border: 0; border-radius: 999px; background: #1b2740; color: #e8eefc; font: 600 .9rem 'Heebo', sans-serif; cursor: pointer; }
    .pa-chip.on { background: #2d8cff; color: #fff; }
    .pa-h3 { margin: 14px 0 0; font-size: .95rem; color: #9fd0ff; }
    .pa-letters { display: grid; gap: 8px; margin: 10px 0; }
    .pa-letter { padding: 10px 12px; border: 0; border-radius: 10px; background: #1b2740; color: #e8eefc; font: 500 .9rem 'Heebo', sans-serif; text-align: right; cursor: pointer; }
    .pa-letter.on { box-shadow: inset 0 0 0 2px #2d8cff; background: #1f3352; }
    .pa-scale { display: flex; gap: 8px; margin: 16px 0; }
    .pa-num { width: 52px; height: 52px; border: 0; border-radius: 12px; background: #1b2740; color: #e8eefc; font: 800 1.2rem 'Heebo', sans-serif; cursor: pointer; }
    .pa-num.on { background: #2d8cff; color: #fff; }
    .pa-units { display: grid; gap: 6px; margin: 12px 0; }
    .pa-unit { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 10px; background: var(--pp-panel); }
    .pa-unit small { color: var(--pp-muted); }
    .pa-unit.closed { opacity: .55; }
    .pa-unit em { color: #ffb08a; font-style: normal; font-size: .85rem; }
    .pa-unit .pa-scale { margin: 0; gap: 4px; }
    .pa-unit .pa-num { width: 36px; height: 36px; font-size: .95rem; }
    @media (max-width: 640px) { .pa-unit { grid-template-columns: 1fr; } }
    .pa-open { display: grid; gap: 10px; margin: 14px 0; }
    .pa-open-item { display: grid; gap: 6px; padding: 12px 14px; border-radius: 12px; background: var(--pp-panel); box-shadow: inset 0 0 0 1px var(--pp-line); }
    .pa-open-item b { font-size: 1.05rem; }
    .pa-open-item span { color: var(--pp-muted); font-size: .9rem; }
    .pa-open-item .pp-btn { justify-self: start; }
  `;
  document.head.append(style);
}
