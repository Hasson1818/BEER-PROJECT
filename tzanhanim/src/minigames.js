import { FORM, MAP12, BASE_TARGETS } from './content.js';
import { click } from '../../shared/engine/audio.js';

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

/** The personal form in the morning. Resolves to { key: optionIndex }. */
export function personalForm(ui) {
  return ui.panel('form', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'טופס אישי · אחד משלושת הטפסים של הבוקר'), el('h2', '', 'כתוב רק מה שנכון'), el('p', '', 'לפי העדויות המראיינים משווים את מה שתגיד להם למה שכתבת כאן.'));
    const answers = {};
    const send = button('הגשה');
    send.disabled = true;
    for (const item of FORM) {
      panel.append(el('h3', 'tz-q', item.q));
      const row = el('div', 'tz-options');
      item.options.forEach((text, k) => {
        const b = button(text, 'tz-option');
        b.addEventListener('click', () => {
          click();
          answers[item.key] = k;
          [...row.children].forEach((c, n) => c.classList.toggle('on', n === k));
          send.disabled = Object.keys(answers).length < FORM.length;
        });
        row.append(b);
      });
      panel.append(row);
    }
    send.addEventListener('click', () => close(answers));
    panel.append(actions(send));
  });
}

/** The map handed out in the wait: look at it for a while. */
export function mapStudy(ui, seconds = 30) {
  return ui.panel('fact', (panel, close, cleanup) => {
    panel.append(el('p', 'eyebrow', 'בהמתנה · מחלקים מפה לשינון'), el('h2', '', MAP12.title));
    const grid = el('div', 'tz-map');
    for (const [n, name] of MAP12.points) {
      const cell = el('div', 'tz-point');
      cell.append(el('b', '', n), el('span', '', name));
      grid.append(cell);
    }
    const time = el('p', 'note');
    const done = button('החזרתי את המפה');
    done.addEventListener('click', () => close());
    panel.append(grid, el('p', 'note', 'המפה והנקודות של המשחק. בעדויות לא מפורט מה היה עליה.'), time, actions(done));
    cleanup(timerLine(time, seconds, () => close(), 'המפה נלקחת בעוד'));
  });
}

/** "Capture the base": the team picks where to drop two bombs. Resolves to 0..1 (a civilian target costs a lot). */
export function baseTargets(ui) {
  return ui.panel('fact', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'משימת צוות · כיבוש מוצב (לפי העדות מ־2025)'), el('h2', '', 'איפה מטילים את שתי הפצצות?'), el('p', '', 'יש לכם שתי פצצות בלבד. המטרה: שהמוצב לא יוכל להזעיק עזרה ולא יוכל להילחם. בחר שתיים.'));
    const grid = el('div', 'bag-grid');
    const picked = new Set();
    const go = button('זה ההחלטה של הצוות');
    go.disabled = true;
    for (const t of BASE_TARGETS) {
      const b = button(t.name, 'bag-item');
      b.addEventListener('click', () => {
        click();
        if (picked.has(t)) picked.delete(t);
        else if (picked.size < 2) picked.add(t);
        b.classList.toggle('packed', picked.has(t));
        go.disabled = picked.size !== 2;
      });
      grid.append(b);
    }
    go.addEventListener('click', () => {
      const list = [...picked];
      const civil = list.some((t) => t.civilian);
      close(civil ? 0 : list.reduce((a, t) => a + t.value, 0) / 2);
    });
    panel.append(grid, el('p', 'note', 'המוצב והמטרות של המשחק.'), actions(go));
  });
}

/**
 * The minefield: a grid with sacks; the team may step only on sacks. Click a path of sacks from the bottom row to
 * the top row, each step to a neighbor (not diagonal). Two attempts. Resolves to { solved, attempts }.
 */
export function minefield(ui, { eyebrow = 'שדה מוקשים · שתי אלונקות ושני ג׳ריקנים (לפי העדות מ־2025)', note = 'הלוח של המשחק. במציאות השקים מפוזרים על החול והצוות מעביר עליהם ציוד.' } = {}) {
  const W = 6;
  const H = 7;
  // A fixed field with one safe path and dead ends (the game's own layout).
  const sacks = new Set(['0,2', '1,2', '1,3', '2,3', '3,3', '3,4', '3,5', '4,5', '5,5', '6,5', '2,1', '2,0', '4,2', '4,1', '5,1', '5,0', '1,4', '0,4', '6,2', '5,2']);
  return ui.panel('fact', (panel, close) => {
    panel.append(el('p', 'eyebrow', eyebrow), el('h2', '', 'מעבר רק על השקים'));
    panel.append(el('p', '', 'לחץ על השקים לפי הסדר, מהשורה העליונה (נקודת היציאה) עד התחתונה, כל פעם לשק צמוד (לא באלכסון). דריכה מחוץ לשק: הצוות חוזר להתחלה. שני ניסיונות.'));
    const grid = el('div', 'tz-mines');
    const info = el('p', 'note', 'ניסיון 1 מתוך 2');
    let path = [];
    let attempt = 1;
    const cells = new Map();
    const reset = () => {
      path = [];
      for (const c of cells.values()) c.classList.remove('on', 'boom');
    };
    for (let row = 0; row < H; row++) {
      for (let col = 0; col < W; col++) {
        const key = `${row},${col}`;
        const c = button('', `tz-cell${sacks.has(key) ? ' sack' : ''}`);
        c.addEventListener('click', () => {
          click();
          const prev = path[path.length - 1];
          const [r, cc] = [row, col];
          const okStart = !prev && r === 0;
          const okStep = prev && Math.abs(prev[0] - r) + Math.abs(prev[1] - cc) === 1 && !path.some(([a, b]) => a === r && b === cc);
          if (!okStart && !okStep) return;
          if (!sacks.has(key)) {
            c.classList.add('boom');
            if (attempt >= 2) {
              info.textContent = 'בום. גם הניסיון השני נכשל (כמו בעדות מ־2025). המגבש: "מה למדתם?"';
              setTimeout(() => close({ solved: false, attempts: 2 }), 1400);
              return;
            }
            attempt++;
            info.textContent = 'בום. הצוות חוזר להתחלה. ניסיון 2 מתוך 2.';
            setTimeout(reset, 700);
            return;
          }
          path.push([r, cc]);
          c.classList.add('on');
          if (r === H - 1) {
            info.textContent = 'עברתם! שתי האלונקות והג׳ריקנים בצד השני.';
            setTimeout(() => close({ solved: true, attempts: attempt }), 1000);
          }
        });
        cells.set(key, c);
        grid.append(c);
      }
    }
    panel.append(grid, info, el('p', 'note', note));
  });
}
