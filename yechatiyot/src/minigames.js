import { BRIGADES, SHEETS } from './content.js';
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
// Real elapsed time with setTimeout, so a hidden tab does not stretch it.
function timerLine(node, seconds, onEnd, label = 'זמן') {
  const end = performance.now() + seconds * 1000;
  let id = 0;
  const tick = () => {
    const left = Math.max(0, Math.ceil((end - performance.now()) / 1000));
    node.textContent = `${label}: ${left} שנ׳`;
    if (left <= 0) return onEnd();
    id = setTimeout(tick, 250);
  };
  tick();
  return () => clearTimeout(id);
}

/** Which brigade you enlisted to. Resolves to a BRIGADES key. */
export function brigadePicker(ui) {
  return ui.panel('fact', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'שבוע ראשון בטירונות'), el('h2', '', 'לאיזו חטיבה התגייסת?'));
    panel.append(el('p', '', 'המבנה של הגיבוש דומה בכל החטיבות. מה שמשתנה במשחק: ריצת הסף, הבסיס ולאן הולכים בסוף.'));
    const grid = el('div', 'bag-grid');
    for (const [key, b] of Object.entries(BRIGADES)) {
      const item = button('', 'bag-item');
      item.append(el('span', 'check', ''), `${b.name} · ${b.sayeret}`);
      item.addEventListener('click', () => {
        click();
        close(key);
      });
      grid.append(item);
    }
    panel.append(grid);
  });
}

/** The two sheets before the first act: look at them while there is time. */
export function studySheets(ui, seconds = 40) {
  return ui.panel('fact', (panel, close, cleanup) => {
    panel.append(el('p', 'eyebrow', '01:00 · שני דפים לשינון · "יהיה מבחן"'), el('h2', '', 'תזכור מה שאתה יכול'));
    panel.append(el('h3', 'tz-q', SHEETS.text.title));
    const list = el('ul', 'yt-lines');
    for (const line of SHEETS.text.lines) list.append(el('li', '', line));
    panel.append(list, el('h3', 'tz-q', SHEETS.map.title));
    const grid = el('div', 'tz-map');
    for (const [n, name] of SHEETS.map.points) {
      const cell = el('div', 'tz-point');
      cell.append(el('b', '', n), el('span', '', name));
      grid.append(cell);
    }
    const time = el('p', 'note');
    const done = button('מחזיר את הדפים');
    done.addEventListener('click', () => close());
    panel.append(grid, el('p', 'note', 'שני הדפים לפי העדות מ־08.2026. מה כתוב עליהם, של המשחק.'), time, actions(done));
    cleanup(timerLine(time, seconds, () => close(), 'הדפים נלקחים בעוד'));
  });
}

/** "מסדר דמעות": names read out with where each goes. Resolves to 'next' | 'again' | 'menu'. */
export function resultParade(ui, { bib, outcome, lines, next, time, readOut }) {
  return ui.panel('fact', (panel, close) => {
    panel.append(el('p', 'eyebrow', `${time} · מסדר דמעות`), el('h2', '', 'מקריאים מספרים, ולכל אחד לאן הוא הולך'));
    const grid = el('div', 'result-grid');
    for (const [n, where] of readOut) {
      const tile = el('div', `result-tile${n === bib ? '' : ' dim'}`);
      tile.append(el('strong', '', n), el('span', '', where));
      grid.append(tile);
    }
    panel.append(grid);
    panel.append(el('p', '', `${bib}: `), el('strong', 'sms-outcome', outcome.title));
    panel.append(el('p', 'sms-detail', outcome.detail));
    if (lines.length) {
      const list = el('ul', 'summary-list');
      for (const [label, value] of lines) {
        const li = el('li');
        li.append(el('span', '', label), el('strong', '', value));
        list.append(li);
      }
      panel.append(el('p', 'eyebrow', 'מה המגבשים ראו (רק במשחק)'), list);
    }
    panel.append(el('p', 'note', 'במציאות לא מקבלים פירוט. איך המסדר נשמע מבפנים, המשקלות והספים הם של המשחק.'));
    if (next) {
      const b = button(next.label);
      b.addEventListener('click', () => close('next'));
      panel.append(actions(b));
    }
    const again = button('לנסות שוב', 'button secondary');
    const menu = button('לתפריט הראשי', 'button secondary');
    again.addEventListener('click', () => close('again'));
    menu.addEventListener('click', () => close('menu'));
    panel.append(actions(again, menu));
  });
}
