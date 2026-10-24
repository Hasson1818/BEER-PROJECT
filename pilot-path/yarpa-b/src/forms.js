import { showScreen, browserWindow, el, button, introCard } from '../../shared/screens.js';
import { fx } from '../../shared/fx.js';
import { FORM_QUESTIONS, SENTENCES, STATEMENTS } from './content.js';

// The questionnaires of ירפ״א ב׳ at the computer: a personal form, sentence completion (timed, typed) and a
// personality inventory (rate how much each statement describes you, also timed). The psychologist reads them.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

function stepStrip(index, labels) {
  const row = el('div', 'fm-strip');
  labels.forEach((label, i) => row.append(el('span', `fm-step${i < index ? ' done' : i === index ? ' on' : ''}`, `${i + 1}. ${label}`)));
  return row;
}

async function personalForm(body) {
  const answers = {};
  const page = el('div', 'fm-page');
  page.append(el('p', 'pp-eyebrow', 'שאלון אישי · יוצג לפסיכולוג'), el('h2', 'pp-title', 'ספר על עצמך'));
  page.append(el('p', 'pp-sub', 'ענה בכנות. לפי אתרי הכנה, הפסיכולוג משווה בין מה שכתבת כאן לבין מה שתגיד לו בראיון.'));
  const go = button('הגשה');
  go.disabled = true;
  for (const q of FORM_QUESTIONS) {
    const box = el('div', 'fm-q');
    box.append(el('p', 'fm-qt', q.q));
    const row = el('div', 'fm-options');
    q.options.forEach((text, i) => {
      const b = button(text, 'fm-option');
      b.addEventListener('click', () => {
        fx.click();
        answers[q.key] = i;
        row.querySelectorAll('.fm-option').forEach((o) => o.classList.toggle('on', o === b));
        go.disabled = Object.keys(answers).length < FORM_QUESTIONS.length;
      });
      row.append(b);
    });
    box.append(row);
    page.append(box);
  }
  const actions = el('div', 'pp-actions');
  actions.append(go);
  page.append(actions);
  body.append(page);
  await new Promise((resolve) => go.addEventListener('click', () => (fx.click(), resolve())));
  return answers;
}

async function sentences(body) {
  const results = [];
  for (let i = 0; i < SENTENCES.length; i++) {
    body.innerHTML = '';
    body.append(stepStrip(1, ['שאלון אישי', 'השלמת משפטים', 'מבחן אישיות']));
    const page = el('div', 'fm-page narrow');
    page.append(el('p', 'pp-eyebrow', `משפט ${i + 1} מתוך ${SENTENCES.length} · כ־25 שניות לכל אחד`), el('h2', 'fm-start', SENTENCES[i]));
    const input = el('textarea', 'fm-text');
    input.rows = 3;
    input.maxLength = 160;
    input.setAttribute('aria-label', 'השלם את המשפט');
    input.placeholder = 'כתוב כאן את מה שעולה לך בראש';
    const bar = el('div', 'pp-bar');
    const fill = el('i');
    fill.style.width = '100%';
    fill.style.transition = 'none';
    bar.append(fill);
    const next = button(i === SENTENCES.length - 1 ? 'סיום' : 'הבא');
    const actions = el('div', 'pp-actions');
    actions.append(next);
    page.append(input, bar, actions);
    body.append(page);
    input.focus();
    input.addEventListener('input', () => fx.key());
    const text = await new Promise((resolve) => {
      let left = 25;
      const timer = setInterval(() => {
        left -= 0.1;
        fill.style.width = `${(left / 25) * 100}%`;
        fill.style.background = left < 6 ? 'var(--pp-bad)' : '';
        if (left <= 0) done();
      }, 100);
      const done = () => {
        clearInterval(timer);
        resolve(input.value.trim());
      };
      next.addEventListener('click', () => (fx.click(), done()));
    });
    results.push(text);
  }
  return results;
}

async function personality(body) {
  const answers = {};
  for (let i = 0; i < STATEMENTS.length; i++) {
    const s = STATEMENTS[i];
    body.innerHTML = '';
    body.append(stepStrip(2, ['שאלון אישי', 'השלמת משפטים', 'מבחן אישיות']));
    const page = el('div', 'fm-page narrow');
    page.append(el('p', 'pp-eyebrow', `היגד ${i + 1} מתוך ${STATEMENTS.length} · כ־15 שניות לכל אחד`), el('h2', 'fm-start', s.text));
    page.append(el('p', 'pp-sub', 'עד כמה זה מתאר אותך?'));
    const scale = el('div', 'fm-scale');
    const labels = ['בכלל לא', 'קצת', 'בינוני', 'הרבה', 'מאוד'];
    const bar = el('div', 'pp-bar');
    const fill = el('i');
    fill.style.width = '100%';
    fill.style.transition = 'none';
    bar.append(fill);
    const value = await new Promise((resolve) => {
      let left = 15;
      let finished = false;
      const finish = (v) => {
        if (finished) return;
        finished = true;
        clearInterval(timer);
        document.removeEventListener('keydown', onKey);
        resolve(v);
      };
      labels.forEach((label, k) => {
        const b = button(`${k + 1} · ${label}`, 'fm-rate');
        b.addEventListener('click', () => (fx.click(), finish(k + 1)));
        scale.append(b);
      });
      const onKey = (e) => {
        if (/^[1-5]$/.test(e.key)) {
          fx.click();
          finish(Number(e.key));
        }
      };
      document.addEventListener('keydown', onKey);
      const timer = setInterval(() => {
        left -= 0.1;
        fill.style.width = `${(left / 15) * 100}%`;
        fill.style.background = left < 4 ? 'var(--pp-bad)' : '';
        if (left <= 0) finish(3); // too slow: neutral
      }, 100);
      page.append(scale, bar);
      body.append(page);
    });
    answers[s.id] = value;
  }
  return answers;
}

/** Scores: how calm, how much of a team player, and how consistent (opposite statements answered the opposite way). */
export function scorePersonality(answers) {
  const pairs = {};
  for (const s of STATEMENTS) {
    if (s.trait === 'filler') continue;
    const v = answers[s.id] ?? 3;
    (pairs[s.trait] ??= []).push(s.sign === 1 ? v : 6 - v);
  }
  let diff = 0;
  let n = 0;
  const traits = {};
  for (const [trait, [a, b]] of Object.entries(pairs)) {
    diff += Math.abs(a - b);
    n++;
    traits[trait] = (a + b) / 2 / 5;
  }
  return { traits, consistency: clamp(1 - diff / n / 3), calm: traits.calm ?? 0.5, team: traits.team ?? 0.5 };
}

/** Resolves to { form, sentences: [..], personality: {id: 1..5}, scores }. */
export function runForms(game, { number }) {
  return showScreen(game, 'forms-screen', async (root, close) => {
    const { body } = browserWindow(root, `תחנת שאלונים · מועמד ${number}`);
    body.innerHTML = '';
    body.append(stepStrip(0, ['שאלון אישי', 'השלמת משפטים', 'מבחן אישיות']));
    const holder = el('div');
    body.append(holder);
    const start = await introCard(holder, {
      eyebrow: 'חדר השאלונים',
      title: 'שלושה שאלונים',
      lines: [
        'הראשון: שאלון אישי עם בחירה מבין אפשרויות. השני: השלמת משפטים, כ־25 שניות לכל משפט. השלישי: היגדים שמדרגים עד כמה הם מתארים אותך, כ־15 שניות לכל אחד.',
        'אין תשובה נכונה. המשחק מקצר מאוד: במציאות יש כ־65 משפטים ועשרות היגדים.',
        'הפסיכולוג יקרא מה כתבת. תענה כמו שאתה, ולא כמו שאתה חושב שרוצים לשמוע.',
      ],
      practice: false,
      startLabel: 'מתחילים',
    });
    void start;
    body.innerHTML = '';
    body.append(stepStrip(0, ['שאלון אישי', 'השלמת משפטים', 'מבחן אישיות']));
    const form = await personalForm(body);
    const texts = await sentences(body);
    const answers = await personality(body);
    body.innerHTML = '';
    const end = el('div', 'fm-page narrow');
    end.append(el('h2', 'pp-title', 'השאלונים הוגשו'), el('p', 'pp-sub', 'תודה. אפשר לצאת מהחדר ולהמשיך לבדיקה הבאה.'));
    body.append(end);
    fx.done();
    await wait(2000);
    close({ form, sentences: texts, personality: answers, scores: scorePersonality(answers) });
  });
}

const STYLE_ID = 'fm-style';
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .fm-strip { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
    .fm-step { padding: 5px 14px; border-radius: 999px; background: rgba(255,255,255,.06); color: var(--pp-muted); font-size: .85rem; font-weight: 700; }
    .fm-step.on { background: rgba(78,161,255,.18); color: #fff; box-shadow: inset 0 0 0 1px var(--pp-accent); }
    .fm-step.done { color: var(--pp-good); }
    .fm-page { max-width: 760px; margin: 0 auto; animation: pp-fade .3s ease both; }
    .fm-page.narrow { max-width: 620px; margin-top: 4vh; text-align: center; }
    .fm-q { margin: 14px 0; }
    .fm-qt { margin: 0 0 6px; font-weight: 800; }
    .fm-options { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 8px; }
    .fm-option { min-height: 44px; padding: 8px 14px; border-radius: 12px; background: var(--pp-panel); color: var(--pp-text); font: 600 .95rem 'Heebo', sans-serif; text-align: right; cursor: pointer; box-shadow: inset 0 0 0 1px var(--pp-line); transition: background .15s, box-shadow .15s; }
    .fm-option:hover { background: #1f3358; }
    .fm-option.on { background: rgba(78,161,255,.25); box-shadow: inset 0 0 0 2px var(--pp-accent); color: #fff; }
    .fm-start { margin: 8px 0 14px; font-family: 'Secular One', 'Heebo', sans-serif; font-weight: 400; font-size: clamp(1.4rem, 3.4vw, 2rem); color: #fff; }
    .fm-text { width: 100%; padding: 12px 14px; border-radius: 12px; background: #0a1120; color: #fff; font: 500 1.1rem 'Heebo', sans-serif; box-shadow: inset 0 0 0 1px var(--pp-line); resize: none; direction: rtl; }
    .fm-text:focus { outline: 2px solid var(--pp-accent); }
    .fm-scale { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 10px 0 16px; }
    .fm-rate { min-height: 54px; padding: 6px 4px; border-radius: 12px; background: var(--pp-panel); color: var(--pp-text); font: 700 .85rem 'Heebo', sans-serif; cursor: pointer; box-shadow: inset 0 0 0 1px var(--pp-line); }
    .fm-rate:hover { background: rgba(78,161,255,.25); box-shadow: inset 0 0 0 2px var(--pp-accent); }
    @media (max-width: 560px) { .fm-scale { grid-template-columns: 1fr; } }
  `;
  document.head.append(style);
}
