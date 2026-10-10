import { BAG_ITEMS, UNITS, MAP_PLACES, MAP_OUTLINE, FACTS } from './content.js';
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

// ---------- The summons, with the player's own data from צו ראשון ----------

export function summons(ui, tzav) {
  return ui.panel('summons', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'זימון · יום שדה (יום סיירות) · אוקטובר'), el('h2', '', 'הוזמנת ליום סיירות'));
    panel.append(el('p', '', 'ההזמנה נשלחת לפי הנתונים מהצו הראשון. ' + FACTS.before.points[1]));
    const grid = el('div', 'result-grid');
    const rows = [
      ['פרופיל', tzav?.profile ?? '—', '82 ומעלה', (v) => v === 'זמני' || v >= 82],
      ['דפ״ר', tzav?.dapar ?? '—', '50 ומעלה', (v) => v >= 50],
    ];
    let allOk = true;
    for (const [label, value, need, ok] of rows) {
      const passed = typeof value === 'number' ? ok(value) : value === 'זמני';
      if (tzav && !passed) allOk = false;
      const tile = el('div', `result-tile${tzav && !passed ? ' low' : ''}`);
      tile.append(el('span', '', label), el('strong', '', String(value)), el('small', '', `נדרש: ${need}`));
      grid.append(tile);
    }
    panel.append(grid);
    if (!tzav) panel.append(el('p', 'note', 'עוד לא שיחקת את הצו הראשון, אז אין לנו את הנתונים שלך. בשלב הזה נניח שאתה עומד בתנאים.'));
    else if (!allOk) panel.append(el('p', 'note', 'לפי הנתונים שלך, במציאות היית צריך לבקש חריג דרך מיט״ב. במשחק אפשר להמשיך.'));
    else panel.append(el('p', 'note', 'אתה עומד בתנאי הסף. בהצלחה!'));
    const go = button('יאללה');
    go.addEventListener('click', () => close());
    panel.append(actions(go));
  });
}

// ---------- Packing ----------

export function bagCheck(ui) {
  return ui.panel('bag', (panel, close) => {
    panel.append(
      el('p', 'eyebrow', 'יום 1 · 10:30 בבוקר, לפני היציאה'),
      el('h2', '', 'מה לוקחים ליום סיירות?'),
      el('p', '', 'יש לינה בשטח, ריצות ומקצים בחול. לחץ על מה שצריך להכניס לתיק.'),
    );
    const grid = el('div', 'bag-grid');
    const note = el('p', 'bag-note');
    const go = button('לאוטובוס');
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

// ---------- Unit preferences ----------

export function preferences(ui) {
  return ui.panel('prefs', (panel, close) => {
    panel.append(
      el('p', 'eyebrow', 'שאלון העדפות'),
      el('h2', '', 'לאן היית רוצה להגיע?'),
      el('p', '', 'בחר עד שלוש יחידות לפי הסדר. ההעדפות עוזרות לשבץ אותך אם תעבור, אבל ההחלטה היא לפי מה שתראה בשטח.'),
    );
    const grid = el('div', 'bag-grid');
    const chosen = [];
    const send = button('שלח');
    send.disabled = true;
    const buttons = UNITS.map((unit) => {
      const b = button('', 'bag-item');
      const badge = el('span', 'check', '');
      b.append(badge, unit);
      b.addEventListener('click', () => {
        click();
        const index = chosen.indexOf(unit);
        if (index >= 0) chosen.splice(index, 1);
        else if (chosen.length < 3) chosen.push(unit);
        buttons.forEach(({ b: other, badge: otherBadge, unit: u }) => {
          const i = chosen.indexOf(u);
          other.classList.toggle('packed', i >= 0);
          otherBadge.textContent = i >= 0 ? String(i + 1) : '';
        });
        send.disabled = chosen.length === 0;
      });
      grid.append(b);
      return { b, badge, unit };
    });
    send.addEventListener('click', () => close([...chosen]));
    panel.append(grid, actions(send));
  });
}

// ---------- Quick medical check ----------

export function medicCheck(ui) {
  const pulse = 64 + Math.round(Math.random() * 18);
  const sys = 112 + Math.round(Math.random() * 14);
  const dia = 68 + Math.round(Math.random() * 12);
  return ui.panel('measure', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'מרפאה · לפני הריצה'), el('h2', '', 'בדיקה קצרה'));
    const grid = el('div', 'readouts');
    for (const [label, value] of [
      ['דופק', String(pulse)],
      ['לחץ דם', `${sys}/${dia}`],
      ['טופס רפואי', 'חתום ✓'],
      ['כשיר למיון', 'כן'],
    ]) {
      const cell = el('div', 'readout');
      cell.append(el('span', '', label), el('strong', '', value));
      grid.append(cell);
    }
    const ok = button('תודה');
    ok.addEventListener('click', () => close());
    panel.append(grid, el('p', '', 'החובש בודק דופק ולחץ דם לפני הריצה. מי שלא מרגיש טוב צריך להגיד עכשיו.'), actions(ok));
  });
}

// ---------- Sand map of Israel ----------

const project = ([lon, lat]) => [(lon - 34.1) * 100, (33.45 - lat) * 118];

/** Tap where each place is. Resolves to accuracy 0..1. */
export function mapTask(ui) {
  return ui.panel('map-task', (panel, close) => {
    const ns = 'http://www.w3.org/2000/svg';
    const [w, h] = project([35.95, 29.4]);
    panel.append(el('p', 'eyebrow', 'משימת צוות · מפה בחול'), el('h2', '', 'סמנו את המקומות על המפה'));
    const prompt = el('p', 'map-prompt', '');
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('class', 'sand-map');
    const outline = document.createElementNS(ns, 'polygon');
    outline.setAttribute('points', MAP_OUTLINE.map((p) => project(p).join(',')).join(' '));
    outline.setAttribute('class', 'map-land');
    svg.append(outline);
    const sea = document.createElementNS(ns, 'text');
    sea.setAttribute('x', '6');
    sea.setAttribute('y', String(h * 0.42));
    sea.setAttribute('class', 'map-sea');
    sea.textContent = 'הים';
    svg.append(sea);
    const layout = el('div', 'map-layout');
    const side = el('div', 'map-side');
    const list = el('ol', 'map-list');
    side.append(prompt, list);
    layout.append(svg, side);
    panel.append(layout);

    const results = [];
    let index = 0;
    const showPrompt = () => {
      prompt.textContent = index < MAP_PLACES.length ? `איפה ${MAP_PLACES[index][0]}? לחץ על המפה.` : 'כל הכבוד. בירוק: המקומות האמיתיים.';
    };
    showPrompt();

    const dot = (x, y, cls, label) => {
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', x);
      c.setAttribute('cy', y);
      c.setAttribute('r', '3.4');
      c.setAttribute('class', cls);
      svg.append(c);
      if (label) {
        const t = document.createElementNS(ns, 'text');
        t.setAttribute('x', x + 5);
        t.setAttribute('y', y + 3);
        t.setAttribute('class', 'map-label');
        t.textContent = label;
        svg.append(t);
      }
    };

    svg.addEventListener('pointerdown', (event) => {
      if (index >= MAP_PLACES.length) return;
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const local = point.matrixTransform(svg.getScreenCTM().inverse());
      const [name, lon, lat] = MAP_PLACES[index];
      const [tx, ty] = project([lon, lat]);
      const km = Math.hypot((local.x - tx) * 0.94, (local.y - ty) * 0.94);
      results.push(Math.max(0, 1 - km / 60));
      dot(local.x, local.y, 'map-guess', name);
      list.append(el('li', '', `${name}: ${km < 8 ? 'בול!' : `סטייה של כ־${Math.round(km)} ק״מ`}`));
      click();
      index++;
      if (index === MAP_PLACES.length) {
        for (const [, lo, la] of MAP_PLACES) dot(...project([lo, la]), 'map-true');
        const done = button('סיימנו את המפה');
        done.addEventListener('click', () => close(results.reduce((a, b) => a + b, 0) / results.length));
        side.append(actions(done));
      }
      showPrompt();
    });
  });
}

// ---------- Sociometric questionnaire ----------

/** Two questions about teammates. Resolves to a 0..1 "fair judgement" score. */
export function sociometric(ui, teammates) {
  const names = teammates.filter((t) => t.info.trait !== 'steady' || t.info.note).map((t) => t.info);
  const questions = [
    {
      q: 'את מי הכי היית רוצה לידך במשימה קשה?',
      score: { helper: 1, steady: 1, leader: 0.9, loud: 0.4, quitter: 0.1 },
    },
    {
      q: 'מי לדעתך תרם הכי פחות לצוות? (חובה לבחור)',
      score: { quitter: 1, loud: 0.8, leader: 0.3, helper: 0, steady: 0 },
    },
  ];
  return ui.panel('socio', (panel, close) => {
    const answers = [];
    const show = (i) => {
      panel.innerHTML = '';
      panel.append(el('p', 'eyebrow', `שאלון סוציומטרי · שאלה ${i + 1} מתוך ${questions.length}`), el('h2', '', questions[i].q));
      panel.append(el('p', '', 'ענה לפי מה שראית במקצים. אף אחד מהצוות לא רואה את התשובות.'));
      const grid = el('div', 'bag-grid');
      for (const info of names) {
        const b = button('', 'bag-item');
        b.append(el('span', 'check', ''), info.name);
        b.addEventListener('click', () => {
          click();
          answers.push(questions[i].score[info.trait] ?? 0.5);
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

// ---------- Results by SMS ----------

export function resultsSms(ui, { bib, outcome, lines }) {
  return ui.panel('phone-wrap', (panel, close) => {
    panel.className = 'phone';
    const screen = el('div', 'phone-screen');
    screen.append(el('div', 'phone-time', 'יום 3 · 17:20'));
    const sms = el('div', 'sms');
    sms.append(el('b', '', 'צה״ל · מיונים'), `שלום ${bib}, תשובות יום השדה: `, el('strong', 'sms-outcome', outcome.title));
    sms.append(el('p', 'sms-detail', outcome.detail));
    screen.append(sms);
    const list = el('ul', 'summary-list');
    for (const [label, value] of lines) {
      const li = el('li');
      li.append(el('span', '', label), el('strong', '', value));
      list.append(li);
    }
    screen.append(el('p', 'eyebrow', 'איך היה לך (רק במשחק)'), list);
    screen.append(el('p', 'note', 'במציאות מקבלים רק את התשובה, בלי פירוט. החישוב כאן פשוט ונועד להראות מה המגבשים מחפשים.'));
    const menu = button('לתפריט הראשי');
    const again = button('לשחק שוב', 'button secondary');
    menu.addEventListener('click', () => close('menu'));
    again.addEventListener('click', () => close('again'));
    screen.append(actions(menu, again));
    panel.append(screen);
  });
}
