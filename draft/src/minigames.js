import { KNOTS, STRETCHER, UNITS } from './content.js';
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

/**
 * Click the steps of a sequence in the right order before the time runs out.
 * Resolves to { done, errors, seconds }.
 */
function sequence(ui, { eyebrow, title, note, steps, seconds, hintFirst = false }) {
  return ui.panel('fact', (panel, close, cleanup) => {
    panel.append(el('p', 'eyebrow', eyebrow), el('h2', '', title));
    if (note) panel.append(el('p', 'note', note));
    const hint = el('p', '');
    const time = el('p', 'note');
    const grid = el('div', 'bag-grid');
    let next = 0;
    let errors = 0;
    const started = performance.now();
    let stop = () => {};
    const finish = (done) => {
      stop();
      close({ done, errors, seconds: (performance.now() - started) / 1000 });
    };
    const showHint = () => {
      hint.textContent = hintFirst && next === 0 ? `מתחילים ב: ${steps[0]}` : '';
    };
    for (const step of shuffle(steps)) {
      const b = button('', 'bag-item');
      const check = el('span', 'check', '');
      b.append(check, step);
      b.addEventListener('click', () => {
        if (b.classList.contains('packed')) return;
        click();
        if (step === steps[next]) {
          next++;
          b.classList.add('packed');
          check.textContent = String(next);
          showHint();
          if (next === steps.length) setTimeout(() => finish(true), 350);
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
    stop = timerLine(time, seconds, () => finish(false));
    cleanup(() => stop());
  });
}

// ---------- Knots: shown for a few seconds, then tied against the clock ----------

export function knotShow(ui, knot, seconds = 9) {
  return ui.panel('fact', (panel, close, cleanup) => {
    panel.append(el('p', 'eyebrow', 'מגבש 669 מראה פעם אחת'), el('h2', '', knot.name));
    const list = el('ol', '');
    for (const step of knot.steps) list.append(el('li', '', step));
    const time = el('p', 'note');
    panel.append(list, time);
    cleanup(timerLine(time, seconds, () => close(), 'הוא מסיים בעוד'));
  });
}

/** Both knots, each shown once and then tied on time. Resolves to 0..1. */
export async function knots(ui) {
  let score = 0;
  for (const knot of KNOTS) {
    await knotShow(ui, knot);
    const r = await sequence(ui, { eyebrow: 'קשרים על זמן', title: knot.name, note: 'לחץ על השלבים לפי הסדר.', steps: knot.steps, seconds: 20 });
    score += r.done ? Math.max(0.3, 1 - r.errors * 0.18) : 0.15;
  }
  return score / KNOTS.length;
}

/** Take the stretcher apart, then put it back together. Resolves to 0..1. */
export async function stretcherDrill(ui) {
  const note = 'איך בנויה "אלונקת 669" לא פורסם. השלבים כאן כלליים לאלונקה מתקפלת.';
  const a = await sequence(ui, { eyebrow: 'אלונקה · פירוק', title: 'פרקו את האלונקה', note, steps: STRETCHER.take, seconds: 30, hintFirst: true });
  const b = await sequence(ui, { eyebrow: 'אלונקה · הרכבה, על זמן', title: 'הרכיבו אותה בחזרה', steps: STRETCHER.build, seconds: 22 });
  const part = (r) => (r.done ? Math.max(0.3, 1 - r.errors * 0.15) : 0.15);
  return (part(a) + part(b)) / 2;
}

// ---------- Sociometric questionnaire ----------

const SOCIO_SCORE = {
  fit: { helper: 1, leader: 0.9, steady: 0.8, panic: 0.4, hider: 0.2, loud: 0.3, cheater: 0.1 },
  least: { cheater: 1, hider: 1, loud: 0.7, panic: 0.3, steady: 0.3, leader: 0, helper: 0 },
};

export function sociometric(ui, group) {
  const names = group.map((p) => p.info);
  const questions = [
    { q: 'עם מי היית רוצה להיות בצוות חילוץ?', key: 'fit' },
    { q: 'מי תרם הכי פחות לקבוצה היום? (חובה לבחור)', key: 'least' },
  ];
  return ui.panel('socio', (panel, close) => {
    const answers = [];
    const show = (i) => {
      panel.innerHTML = '';
      panel.append(el('p', 'eyebrow', `סוציומטרי · שאלה ${i + 1} מתוך ${questions.length}`), el('h2', '', questions[i].q));
      panel.append(el('p', '', 'לפי אתר הכנה יש סוציומטרי בסוף יום הבריכה. השאלות עצמן לא פורסמו; אלה של המשחק.'));
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

// ---------- Commando: rank the three units ----------

/** Resolves to the unit ids in your order. */
export function rankUnits(ui) {
  return ui.panel('prefs', (panel, close) => {
    panel.append(
      el('p', 'eyebrow', 'שאלון העדפות · חטיבת הקומנדו'),
      el('h2', '', 'דרג את היחידות לפי הסדר שאתה רוצה'),
      el('p', '', 'לפי עדות מ־2023 מדרגים את מגלן, אגוז ודובדבן כבר בשאלון ההעדפות של הגיבוש. לחץ לפי הסדר: הראשונה היא העדפה ראשונה.'),
    );
    const order = [];
    const grid = el('div', 'unit-grid');
    const go = button('שליחה');
    go.disabled = true;
    for (const unit of UNITS) {
      const card = button('', 'unit-card');
      const badge = el('span', 'unit-rank', '');
      card.append(badge, el('strong', '', unit.name), el('span', '', unit.text), el('small', '', unit.base));
      card.addEventListener('click', () => {
        click();
        const at = order.indexOf(unit.id);
        if (at >= 0) order.splice(at, 1);
        else order.push(unit.id);
        for (const c of grid.children) {
          const i = order.indexOf(c.dataset.id);
          c.querySelector('.unit-rank').textContent = i >= 0 ? String(i + 1) : '';
          c.classList.toggle('packed', i >= 0);
        }
        go.disabled = order.length < UNITS.length;
      });
      card.dataset.id = unit.id;
      grid.append(card);
    }
    go.addEventListener('click', () => close([...order]));
    panel.append(grid, actions(go));
  });
}

// ---------- The phone ----------

/**
 * A text message on the phone. `buttons`: [[label, value, secondary?], ...]; resolves to the value.
 * `lines`: optional [label, value] rows under the message.
 */
export function phoneMessage(ui, { time, from = 'צה״ל · מיונים', text, strong = '', detail = '', lines = [], note = '', buttons = [['המשך', 'ok']] }) {
  return ui.panel('phone-wrap', (panel, close) => {
    panel.className = 'phone';
    const screen = el('div', 'phone-screen');
    screen.append(el('div', 'phone-time', time));
    play('sms', { volume: 0.8 });
    const sms = el('div', 'sms');
    sms.append(el('b', '', from), text);
    if (strong) sms.append(' ', el('strong', 'sms-outcome', strong));
    if (detail) sms.append(el('p', 'sms-detail', detail));
    screen.append(sms);
    if (lines.length) {
      const list = el('ul', 'summary-list');
      for (const [label, value] of lines) {
        const li = el('li');
        li.append(el('span', '', label), el('strong', '', value));
        list.append(li);
      }
      screen.append(el('p', 'eyebrow', 'מה ראו עליך היום (רק במשחק)'), list);
    }
    if (note) screen.append(el('p', 'note', note));
    const main = buttons.filter((b) => !b[2]);
    const rest = buttons.filter((b) => b[2]);
    const make = ([label, value, secondary]) => {
      const b = button(label, secondary ? 'button secondary' : 'button');
      b.addEventListener('click', () => close(value));
      return b;
    };
    if (main.length) screen.append(actions(...main.map(make)));
    if (rest.length) screen.append(actions(...rest.map(make)));
    panel.append(screen);
  });
}

/** A phone call: who is calling, then the conversation happens in dialogue lines. */
export function incomingCall(ui, { time, caller }) {
  return ui.panel('phone-wrap', (panel, close) => {
    panel.className = 'phone';
    const screen = el('div', 'phone-screen call');
    screen.append(el('div', 'phone-time', time), el('p', 'call-label', 'שיחה נכנסת'), el('h2', '', caller));
    play('sms', { volume: 0.6 });
    const answer = button('לענות');
    answer.addEventListener('click', () => close());
    screen.append(actions(answer));
    panel.append(screen);
  });
}

/** Where to start, when you come to this page without a result from the unit gibbush. */
export function choosePath(ui) {
  return ui.panel('prefs', (panel, close) => {
    panel.append(
      el('p', 'eyebrow', 'הדראפט · 669 / קומנדו'),
      el('h2', '', 'מאיפה מתחילים?'),
      el('p', '', 'השלב הזה מגיע אחרי גיבוש היחידה (מטכ״ל / שלדג), למי שסיים ולא נבחר. אפשר לשחק אותו גם בלי לעבור את הגיבוש: בחר מה היה בשאלון ההעדפות שלך.'),
    );
    const b669 = button('בחרתי ב־669 · יום הבריכה');
    const bCommando = button('בחרתי בקומנדו · שיבוץ ליחידה', 'button secondary');
    b669.addEventListener('click', () => close('669'));
    bCommando.addEventListener('click', () => close('commando'));
    panel.append(actions(b669, bCommando));
  });
}
