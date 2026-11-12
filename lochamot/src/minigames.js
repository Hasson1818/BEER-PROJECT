import { ROUTES } from './content.js';
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => Math.round(a + Math.random() * (b - a));

/** Height and weight, then BMI. Resolves to { height, weight, bmi }. The ranges are the game's own. */
export function bmiCheck(ui) {
  const height = rand(156, 176);
  const weight = rand(51, 72);
  const bmi = Math.round((weight / (height / 100) ** 2) * 10) / 10;
  return ui.panel('measure', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'יום מיון לוחמות · חדר מדידות'), el('h2', '', 'גובה, משקל ו־BMI'));
    const status = el('p', '', '');
    const grid = el('div', 'readouts');
    const rows = [
      ['גובה', `${height} ס״מ`, 'גב לסרגל, עקבים צמודים…'],
      ['משקל', `${weight} ק״ג`, 'המשקל מתייצב…'],
      ['BMI', String(bmi), 'מחשבים…'],
    ];
    const cells = rows.map(([label]) => {
      const cell = el('div', 'readout pending');
      cell.append(el('span', '', label), el('strong', '', '—'));
      grid.append(cell);
      return cell;
    });
    const done = button('תודה');
    done.disabled = true;
    done.addEventListener('click', () => close({ height, weight, bmi }));
    panel.append(status, grid, actions(done));
    (async () => {
      for (let i = 0; i < rows.length; i++) {
        status.textContent = rows[i][2];
        await sleep(1100);
        cells[i].classList.remove('pending');
        cells[i].querySelector('strong').textContent = rows[i][1];
        click();
      }
      status.textContent = bmi >= 17 && bmi <= 35 ? 'בטווח (17–35). אפשר להמשיך.' : 'מחוץ לטווח. החובשת תסביר.';
      done.disabled = false;
    })();
  });
}

/**
 * The digital preference form: pick routes in order (up to 5). Routes you can't get are shown with the reason.
 * Resolves to the list of chosen ids in order.
 */
export function rankForm(ui, { profile, bmi }) {
  return ui.panel('fact', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'טופס העדפות דיגיטלי · סוף היום'), el('h2', '', 'דרגי את המסלולים: לחצי לפי הסדר'));
    panel.append(el('p', 'note', `הפרופיל שלך: ${profile} · BMI ${bmi}. הספים לפי אתרי הכנה (2026). אפשר לבחור עד 5.`));
    const chosen = [];
    const grid = el('div', 'bag-grid');
    const send = button('שליחה');
    send.disabled = true;
    for (const route of ROUTES) {
      const b = button('', 'bag-item');
      const check = el('span', 'check', '');
      const blocked = profile < route.profile ? `פרופיל ${route.profile}+` : bmi > (route.bmiMax ?? 35) || bmi < 17 ? `BMI עד ${route.bmiMax ?? 35}` : '';
      b.append(check, route.name);
      if (blocked) {
        b.disabled = true;
        b.append(el('small', 'lo-blocked', ` · ${blocked}`));
      }
      b.addEventListener('click', () => {
        click();
        const at = chosen.indexOf(route.id);
        if (at >= 0) chosen.splice(at, 1);
        else if (chosen.length < 5) chosen.push(route.id);
        for (const node of grid.children) {
          const k = chosen.indexOf(node.dataset.id);
          node.classList.toggle('packed', k >= 0);
          node.querySelector('.check').textContent = k >= 0 ? String(k + 1) : '';
        }
        send.disabled = chosen.length < 3;
      });
      b.dataset.id = route.id;
      grid.append(b);
    }
    send.addEventListener('click', () => close([...chosen]));
    panel.append(grid, el('p', 'note', 'צריך לבחור לפחות שלוש. במציאות השיבוץ נעשה באחת משלוש הראשונות (לפי אתרי הכנה).'), actions(send));
  });
}
