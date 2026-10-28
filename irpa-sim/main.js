import '../pilot-path/shared/pilot.css';
import { runIrpaSimulator } from '../pilot-path/shared/flight/irpa.js';
import { fx } from '../pilot-path/shared/fx.js';
import { audioContext } from '../shared/engine/audio.js';
import { showScreen, el, button } from '../pilot-path/shared/screens.js';

// The first simulator of ירפ״א א׳ on its own page, to send to friends: no hub, no links, nothing from the rest of the
// game, and no progress saved. The simulator only needs `game` to open its full-screen overlay.
const host = {
  ui: { holdModal: () => () => {} },
  renderPaused: false,
};

function card(build) {
  return showScreen(host, 'irpa-solo', (root, close) => {
    const box = el('div', 'pp-intro');
    box.style.cssText = 'width:min(640px,100%);max-height:100%;overflow:auto;padding:24px 28px;border-radius:18px;background:rgba(14,24,70,.96);box-shadow:inset 0 0 0 1px rgba(207,255,42,.35),0 30px 80px rgba(0,0,0,.6);';
    root.append(box);
    build(box, close);
  });
}

function welcome() {
  return card((box, close) => {
    box.append(el('p', 'pp-eyebrow', 'ירפ״א א׳'), el('h2', 'pp-title', 'סימולטור ירפ״א א׳'));
    const list = el('ul', 'pp-list');
    for (const line of [
      'שחזור של הסימולטור הראשון, לפי מה שמועמדים ואתרי הכנה מתארים. זה לא הסימולטור הרשמי, וכל המספרים כאן הם של המשחק.',
      'מסך כחול עם מטוס אויב שנע לפי התנועה שלך. המצערת קובעת תאוצה, ויש שמונה תרגילים: התקרבות, מרכוז, נעילה וירי, ועוד.',
      'כדאי באוזניות. אפשר לשחק עם עכבר ומקלדת או עם מקלדת בלבד, ובוחרים לפני שמתחילים.',
    ]) list.append(el('li', '', line));
    box.append(list);
    const row = el('div', 'pp-actions');
    const go = button('מתחילים');
    row.append(go);
    box.append(row);
    go.focus();
    go.addEventListener('click', () => {
      audioContext(); // sound needs a click first
      fx.click();
      close();
    });
  });
}

function summary(result) {
  return card((box, close) => {
    box.append(el('p', 'pp-eyebrow', 'סיום הסימולטור'), el('h2', 'pp-title', result.passed ? 'עברת את הסימולטור' : 'הפעם לא עברת'));
    box.append(el('p', 'pp-sub', `ציון: ${Math.round(result.score * 100)}%. אפשר לנסות שוב כמה פעמים שרוצים.`));
    const row = el('div', 'pp-actions');
    const again = button('לנסות שוב');
    row.append(again);
    box.append(row);
    again.focus();
    again.addEventListener('click', () => {
      fx.click();
      close();
    });
  });
}

(async () => {
  await welcome();
  for (;;) {
    const result = await runIrpaSimulator(host, { fx });
    await summary(result);
  }
})();
