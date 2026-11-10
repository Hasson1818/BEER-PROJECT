import { BAG_ITEMS, ARTICLE, WEAPONS, KNOT, LECTURE_TOPICS } from './content.js';
import { click } from '../../shared/engine/audio.js';
import { play } from '../../shared/engine/sound.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(text, className = 'button') {
  const b = el('button', className, text);
  b.type = 'button';
  return b;
}

function actions(...buttons) {
  const row = el('div', 'actions');
  row.append(...buttons);
  return row;
}

const shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

/** A line that counts down in real seconds; calls onEnd at zero. Returns stop(). */
function timerLine(node, seconds, onEnd, label = 'זמן') {
  let left = seconds;
  node.textContent = `${label}: ${left} שנ׳`;
  const id = setInterval(() => {
    left--;
    node.textContent = `${label}: ${Math.max(0, left)} שנ׳`;
    if (left <= 0) {
      clearInterval(id);
      onEnd();
    }
  }, 1000);
  return () => clearInterval(id);
}

// ---------- Packing ----------

export function bagCheck(ui) {
  return ui.panel('bag', (panel, close) => {
    panel.append(
      el('p', 'eyebrow', 'יום א׳ · 09:00 בבית'),
      el('h2', '', 'מה לוקחים לגיבוש?'),
      el('p', '', 'חמישה ימים בדיונות. את רוב הציוד מקבלים שם. לחץ על מה שצריך להכניס לתיק.'),
    );
    const grid = el('div', 'bag-grid');
    const note = el('p', 'bag-note');
    const go = button('לרכבת');
    go.disabled = true;
    const packed = new Set();
    const needed = BAG_ITEMS.filter((i) => i.needed).length;
    for (const item of BAG_ITEMS) {
      const b = button('', 'bag-item');
      const check = el('span', 'check', '');
      b.append(check, item.label);
      b.addEventListener('click', () => {
        click();
        if (!item.needed) {
          b.classList.add('wrong');
          note.textContent = item.note;
          return;
        }
        const has = packed.has(item.id);
        if (has) packed.delete(item.id);
        else packed.add(item.id);
        b.classList.toggle('packed', !has);
        check.textContent = has ? '' : '✓';
        note.textContent = '';
        go.disabled = packed.size < needed;
      });
      grid.append(b);
    }
    go.addEventListener('click', () => close());
    panel.append(grid, note, actions(go));
  });
}

// ---------- The article: study, and a test later ----------

/** Shows the article for `seconds`. Resolves when time is up or the player is done. */
export function articleStudy(ui, seconds = 45) {
  return ui.panel('fact', (panel, close, cleanup) => {
    panel.append(el('p', 'eyebrow', 'מאמר לשינון · המבחן יגיע בלי הודעה מראש'), el('h2', '', ARTICLE.title));
    for (const p of ARTICLE.paragraphs) panel.append(el('p', '', p));
    const time = el('p', 'note');
    const done = button('סיימתי לקרוא');
    done.addEventListener('click', () => close());
    panel.append(time, actions(done));
    cleanup(timerLine(time, seconds, () => close(), 'זמן שנשאר לקרוא'));
  });
}

/** The test. Resolves to the share of right answers (0..1). */
export function articleTest(ui) {
  return ui.panel('fact', (panel, close) => {
    let right = 0;
    const show = (i) => {
      panel.innerHTML = '';
      const item = ARTICLE.questions[i];
      panel.append(el('p', 'eyebrow', `מבחן על המאמר · שאלה ${i + 1} מתוך ${ARTICLE.questions.length}`), el('h2', '', item.q));
      const grid = el('div', 'bag-grid');
      item.choices.forEach((choice, j) => {
        const b = button(choice, 'bag-item');
        b.addEventListener('click', () => {
          click();
          if (j === item.answer) right++;
          if (i + 1 < ARTICLE.questions.length) show(i + 1);
          else close(right / ARTICLE.questions.length);
        });
        grid.append(b);
      });
      panel.append(grid);
    };
    show(0);
  });
}

// ---------- Weapon strip ----------

/**
 * Click the steps in the right order. mode: 'slow' (shows the next step), 'timed', 'pressure' (less time,
 * after a sprint and push-ups). Resolves to { errors, done, seconds }.
 */
export function weaponDrill(ui, kind, mode) {
  const weapon = WEAPONS[kind];
  const limits = { slow: 60, timed: 25, pressure: 15 };
  const titles = { slow: 'לאט, עם הסבר', timed: 'על זמן', pressure: 'תחת לחץ' };
  return ui.panel('fact', (panel, close, cleanup) => {
    panel.append(el('p', 'eyebrow', `פירוק ${weapon.name} · ${titles[mode]}`), el('h2', '', 'לחץ על השלבים לפי הסדר'));
    if (mode === 'pressure') panel.append(el('p', 'note', 'ספרינט עד הקונוס ו־10 שכיבות סמיכה, ומיד לנשק. הידיים רועדות.'));
    const hint = el('p', '');
    const time = el('p', 'note');
    const grid = el('div', 'bag-grid');
    let next = 0;
    let errors = 0;
    const started = performance.now();
    let stop = () => {};
    const finish = (done) => {
      stop();
      close({ errors, done, seconds: (performance.now() - started) / 1000 });
    };
    const showHint = () => {
      hint.textContent = mode === 'slow' && next < weapon.steps.length ? `השלב הבא: ${weapon.steps[next]}` : '';
    };
    for (const step of shuffle(weapon.steps)) {
      const b = button('', 'bag-item');
      const check = el('span', 'check', '');
      b.append(check, step);
      b.addEventListener('click', () => {
        if (b.classList.contains('packed')) return;
        click();
        if (step === weapon.steps[next]) {
          next++;
          b.classList.add('packed');
          check.textContent = String(next);
          showHint();
          if (next === weapon.steps.length) setTimeout(() => finish(true), 350);
        } else {
          errors++;
          b.classList.add('wrong');
          setTimeout(() => b.classList.remove('wrong'), 400);
        }
      });
      grid.append(b);
    }
    showHint();
    panel.append(hint, grid, time);
    stop = timerLine(time, limits[mode], () => finish(false));
    cleanup(() => stop());
  });
}

// ---------- The 669 knot: shown once, then put in order ----------

export function knotLesson(ui, seconds = 10) {
  return ui.panel('fact', (panel, close, cleanup) => {
    panel.append(el('p', 'eyebrow', 'מגבש 669 מדגים פעם אחת'), el('h2', '', `קשר ${KNOT.name}`));
    const list = el('ol', '');
    for (const step of KNOT.steps) list.append(el('li', '', step));
    const time = el('p', 'note');
    panel.append(list, el('p', '', 'הוא לא יחזור על זה. תזכור את הסדר.'), time);
    cleanup(timerLine(time, seconds, () => close(), 'הוא מסיים בעוד'));
  });
}

/** Resolves to 0..1: how many steps were put in the right place. */
export function knotTest(ui) {
  return ui.panel('fact', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'מגבש 669 · מבחן'), el('h2', '', 'סדר את שלבי הקשר'), el('p', '', 'לחץ על השלבים לפי הסדר שבו הוא הדגים.'));
    const grid = el('div', 'bag-grid');
    const order = [];
    for (const step of shuffle(KNOT.steps)) {
      const b = button('', 'bag-item');
      const check = el('span', 'check', '');
      b.append(check, step);
      b.addEventListener('click', () => {
        if (order.includes(step)) return;
        click();
        order.push(step);
        b.classList.add('packed');
        check.textContent = String(order.length);
        if (order.length === KNOT.steps.length) {
          const right = order.filter((s, i) => s === KNOT.steps[i]).length;
          setTimeout(() => close(right / KNOT.steps.length), 400);
        }
      });
      grid.append(b);
    }
    panel.append(grid);
  });
}

// ---------- A short talk in front of the squad ----------

/** Three choices; resolves to 0..1. */
export async function lecture(ui, speaker) {
  const topic = await ui.talk(speaker, 'הרצאה של שתי דקות מול החוליה. בחר נושא.', LECTURE_TOPICS);
  const open = await ui.talk(speaker, `"${LECTURE_TOPICS[topic]}". איך אתה פותח?`, [
    'בסיפור קצר אחד, עם רגע מסוים',
    'בהגדרה מהמילון',
    '"אממ... אני לא בטוח מה להגיד"',
  ]);
  const middle = await ui.talk(speaker, 'באמצע אתה מאבד את החוט. מה עושה?', [
    'עוצר שנייה, נושם, וחוזר לנקודה האחרונה שאמרתי',
    'מדבר מהר יותר כדי שלא ישימו לב',
    'מתנצל ומסיים מוקדם',
  ]);
  const close = await ui.talk(speaker, 'איך מסיימים?', ['במשפט אחד: מה למדתי מזה', 'בבדיחה', 'פשוט מפסיק לדבר']);
  return ([1, 0.4, 0.1][open] + [1, 0.4, 0.2][middle] + [1, 0.6, 0.2][close]) / 3;
}

// ---------- Sociometric questionnaire ----------

const SOCIO_SCORE = {
  fit: { helper: 1, steady: 0.9, leader: 0.9, hider: 0.3, loud: 0.3, cheater: 0.1, quitter: 0.1 },
  least: { quitter: 1, cheater: 1, hider: 0.9, loud: 0.7, leader: 0.1, helper: 0, steady: 0.2 },
};

/** Two questions about the squad. Resolves to 0..1: how fairly you judged what you saw. */
export function sociometric(ui, teammates, round) {
  const names = teammates.filter((t) => !t.info.out).map((t) => t.info);
  const questions = [
    { q: 'מי מתאים להיות לוחם ביחידה?', key: 'fit' },
    { q: 'מי תרם הכי פחות לחוליה? (חובה לבחור)', key: 'least' },
  ];
  return ui.panel('socio', (panel, close) => {
    const answers = [];
    const show = (i) => {
      panel.innerHTML = '';
      panel.append(el('p', 'eyebrow', `סוציומטרי ${round} · שאלה ${i + 1} מתוך ${questions.length}`), el('h2', '', questions[i].q));
      panel.append(el('p', '', 'ענה לפי מה שראית. במשחק בוחרים שם אחד; כמה שמות כותבים במציאות, לא ידוע.'));
      const grid = el('div', 'bag-grid');
      for (const info of names) {
        const b = button('', 'bag-item');
        b.append(el('span', 'check', ''), info.note ? `${info.name} · ${info.note}` : info.name);
        b.addEventListener('click', () => {
          click();
          answers.push(SOCIO_SCORE[questions[i].key][info.trait] ?? 0.5);
          if (i + 1 < questions.length) show(i + 1);
          else close(answers.reduce((a, b2) => a + b2, 0) / answers.length);
        });
        grid.append(b);
      }
      panel.append(grid);
    };
    show(0);
  });
}

// ---------- 669 or commando ----------

export function preferenceForm(ui) {
  return ui.panel('prefs', (panel, close) => {
    panel.append(
      el('p', 'eyebrow', 'שאלון העדפות · סוף יום ד׳'),
      el('h2', '', 'אם לא תיבחר למטכ״ל או לשלדג, לאן תעדיף?'),
      el('p', '', 'לפי העדויות ממלאים את השאלון הזה אחרי "תם החלק הפיזי". הוא קובע לאן תעלה בדראפט.'),
    );
    const b669 = button('669 · חילוץ והצלה מוטס');
    const bCommando = button('חטיבת הקומנדו · מגלן, אגוז, דובדבן', 'button secondary');
    b669.addEventListener('click', () => close('669'));
    bCommando.addEventListener('click', () => close('commando'));
    panel.append(actions(b669, bCommando));
  });
}

// ---------- The cut parade ----------

/** Numbers read out; resolves when the player has seen whether theirs is among them. */
export function cutParade(ui, { bib, stays, numbers }) {
  return ui.panel('fact', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'יום ג׳ · 06:10 · מסדר ניפויים'), el('h2', '', 'המספרים שממשיכים'));
    panel.append(el('p', 'note', 'אין עדות של מי שהודח, אז איך המסדר נראה מבפנים זו השערה של המשחק.'));
    const grid = el('div', 'result-grid');
    for (const n of numbers) {
      const tile = el('div', `result-tile${n === bib ? '' : ' dim'}`);
      tile.append(el('strong', '', n));
      grid.append(tile);
    }
    panel.append(grid);
    panel.append(el('p', '', stays ? `המספר שלך, ${bib}, הוקרא. אתה ממשיך.` : `המספר שלך, ${bib}, לא הוקרא.`));
    const ok = button(stays ? 'לחוליה החדשה' : 'לאוטובוס');
    ok.addEventListener('click', () => close());
    panel.append(actions(ok));
  });
}

// ---------- Results ----------

export function resultsCard(ui, { bib, outcome, lines, next, time = 'יום ה׳ · 13:05' }) {
  return ui.panel('phone-wrap', (panel, close) => {
    panel.className = 'phone';
    const screen = el('div', 'phone-screen');
    screen.append(el('div', 'phone-time', time));
    play('sms', { volume: 0.8 });
    const sms = el('div', 'sms');
    sms.append(el('b', '', 'צה״ל · מיונים'), `שלום ${bib}, תוצאות הגיבוש: `, el('strong', 'sms-outcome', outcome.title));
    sms.append(el('p', 'sms-detail', outcome.detail));
    screen.append(sms);
    const list = el('ul', 'summary-list');
    for (const [label, value] of lines) {
      const li = el('li');
      li.append(el('span', '', label), el('strong', '', value));
      list.append(li);
    }
    screen.append(el('p', 'eyebrow', 'מה המגבשים ראו (רק במשחק)'), list);
    screen.append(el('p', 'note', 'במציאות לא מקבלים פירוט. המשקלות והספים כאן הם החלטה של המשחק, לא של צה״ל.'));
    const buttons = [];
    if (next) {
      const b = button(next.label);
      b.addEventListener('click', () => close('next'));
      buttons.push(b);
    }
    const again = button('לנסות שוב', 'button secondary');
    const menu = button('לתפריט הראשי', 'button secondary');
    again.addEventListener('click', () => close('again'));
    menu.addEventListener('click', () => close('menu'));
    if (buttons.length) screen.append(actions(...buttons));
    screen.append(actions(again, menu));
    panel.append(screen);
  });
}
