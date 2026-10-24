import { showScreen, browserWindow, el, button, introCard } from '../../shared/screens.js';
import { fx } from '../../shared/fx.js';
import { PSYCHOTECH_TESTS, runPsychotech } from '../../shared/psychotech.js';

// The computer station in the tests lab. Each test: instructions, an optional practice, then the scored run.
// Like the real thing, no feedback while you work. Resolves to { tests: {id: result}, score }.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// The game shortens every test; the numbers are what the prep sites say the real ones look like.
const SETTINGS = {
  quant: { count: 8, seconds: 170 },
  cube: { count: 8, seconds: 170 },
  plane: { count: 8, seconds: 130 },
};

export function runLab(game, { number }) {
  return showScreen(game, 'lab-screen', async (root, close) => {
    const { body } = browserWindow(root, `תחנת מבחנים · מועמד ${number}`);
    const results = {};
    for (let i = 0; i < PSYCHOTECH_TESTS.length; i++) {
      const test = PSYCHOTECH_TESTS[i];
      for (;;) {
        body.innerHTML = '';
        const strip = el('div', 'lab-strip');
        PSYCHOTECH_TESTS.forEach((t, k) => {
          const item = el('span', `lab-step${k < i ? ' done' : k === i ? ' on' : ''}`, `${k + 1}. ${t.title}`);
          strip.append(item);
        });
        const holder = el('div', 'lab-holder');
        body.append(strip, holder);
        const choice = await introCard(holder, {
          eyebrow: `מבחן ${i + 1} מתוך ${PSYCHOTECH_TESTS.length} · בדרך כלל כ־${test.realCount} שאלות ב־${test.realMinutes} דקות`,
          title: test.title,
          lines: test.intro,
          keys: [{ keys: ['1', '2', '3', '4', '5'], text: 'בחירת תשובה (בקובייה גם 6)' }, { keys: ['Space'], text: 'דילוג על שאלה' }],
          note: test.penalty ? 'שימו לב: <b>טעות מורידה ניקוד</b> במבחן הזה. דילוג לא מוריד. (לפי אתרי הכנה)' : 'לפי אתרי הכנה אין הורדת ניקוד על טעות במבחן הזה, ולכן כדאי לנחש במקום לדלג.',
        });
        holder.innerHTML = '';
        const stage = el('div', 'lab-stage');
        holder.append(stage);
        if (choice === 'practice') {
          await runPsychotech(test.id, stage, { practice: true, count: 2, seconds: 120, fx });
          continue;
        }
        results[test.id] = await runPsychotech(test.id, stage, { ...SETTINGS[test.id], fx });
        break;
      }
    }
    body.innerHTML = '';
    const end = el('div', 'lab-end');
    end.append(el('h2', 'pp-title', 'המבחנים הסתיימו'), el('p', 'pp-sub', 'הורידו את האוזניות והמתינו למשגיח. אל תיגעו במחשב.'));
    body.append(end);
    fx.done();
    await wait(2400);
    const scores = Object.values(results).map((r) => r.score);
    close({ tests: results, score: scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length) });
  });
}

const STYLE_ID = 'lab-style';
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .lab-strip { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
    .lab-step { padding: 5px 14px; border-radius: 999px; background: rgba(255,255,255,.06); color: var(--pp-muted); font-size: .85rem; font-weight: 700; }
    .lab-step.on { background: rgba(78,161,255,.18); color: #fff; box-shadow: inset 0 0 0 1px var(--pp-accent); }
    .lab-step.done { color: var(--pp-good); }
    .lab-stage { position: relative; width: min(900px, 100%); height: min(500px, 64vh); margin: 0 auto; border-radius: 14px; overflow: hidden; background: #0a1120; box-shadow: inset 0 0 0 1px var(--pp-line); }
    .lab-end { max-width: 520px; margin: 8vh auto 0; text-align: center; animation: pp-fade .4s ease both; }
  `;
  document.head.append(style);
}
