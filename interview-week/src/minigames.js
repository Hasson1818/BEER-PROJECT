import { BAG_ITEMS, FORM, UNIT_BY_ID } from './content.js';
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

// ---------- A text message on the phone ----------

export function smsPanel(ui, { from, text, time = 'היום · 09:12', label = 'הבנתי' }) {
  return ui.panel('phone-wrap', (panel, close) => {
    panel.className = 'phone';
    const screen = el('div', 'phone-screen');
    screen.append(el('div', 'phone-time', time));
    const sms = el('div', 'sms');
    sms.append(el('b', '', from), text);
    screen.append(sms);
    const ok = button(label);
    ok.addEventListener('click', () => close());
    screen.append(actions(ok));
    panel.append(screen);
    play('sms', { volume: 0.8 });
  });
}

// ---------- The Zoom presentation of the units ----------

export function zoomPanel(ui, units) {
  return ui.panel('zoom', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'כשבוע עד שבועיים לפני היום · זום'), el('h2', '', 'היחידות מציגות את עצמן'));
    panel.append(el('p', '', 'לחץ על כל יחידה כדי לשמוע מה היא מספרת על עצמה. תצטרך לדרג אותן אחר כך, אז כדאי להקשיב לפחות לחמש.'));
    const grid = el('div', 'zoom-grid');
    const stage = el('div', 'zoom-stage');
    stage.append(el('p', 'zoom-hint', 'בחר יחידה'));
    const counter = el('p', 'zoom-count', 'האזנת ל־0 יחידות');
    const done = button('סיימתי להקשיב');
    done.disabled = true;
    const heard = new Set();
    for (const unit of units) {
      const tile = button('', 'zoom-tile');
      const dot = el('span', 'zoom-dot');
      dot.style.background = unit.beret;
      tile.append(dot, el('strong', '', unit.name));
      tile.addEventListener('click', () => {
        click();
        heard.add(unit.id);
        tile.classList.add('heard');
        grid.querySelectorAll('.zoom-tile').forEach((t) => t.classList.toggle('on', t === tile));
        stage.innerHTML = '';
        const head = el('div', 'zoom-head');
        const big = el('span', 'zoom-dot big');
        big.style.background = unit.beret;
        head.append(big, el('h3', '', unit.name));
        stage.append(head, el('p', '', unit.pitch), el('p', 'zoom-note', unit.note));
        counter.textContent = `האזנת ל־${heard.size} יחידות`;
        done.disabled = heard.size < 5;
      });
      grid.append(tile);
    }
    done.addEventListener('click', () => close([...heard]));
    panel.append(grid, stage, counter, actions(done));
  });
}

// ---------- Ranking units (the survey, and the personal ranking at the end of the day) ----------

/**
 * Click units in the order you want them. `min` is the least you must rank. Resolves to unit ids in order.
 */
export function rankingPanel(ui, units, { eyebrow, title, intro, min = 3, recommended = 5, confirm = 'שלח דירוג', warn = true }) {
  return ui.panel('ranking', (panel, close) => {
    panel.append(el('p', 'eyebrow', eyebrow), el('h2', '', title), el('p', '', intro));
    if (warn) {
      panel.append(el('p', 'warn', 'חשוב: אחרי שמתקבלים אי אפשר לוותר. דרג רק יחידות שאתה באמת מוכן לשרת בהן.'));
    }
    const grid = el('div', 'bag-grid');
    const order = [];
    const send = button(confirm);
    send.disabled = true;
    const note = el('p', 'bag-note');
    const buttons = units.map((unit) => {
      const b = button('', 'bag-item');
      const badge = el('span', 'check', '');
      b.append(badge, unit.name);
      b.addEventListener('click', () => {
        click();
        const i = order.indexOf(unit.id);
        if (i >= 0) order.splice(i, 1);
        else order.push(unit.id);
        buttons.forEach(({ b: other, badge: otherBadge, unit: u }) => {
          const k = order.indexOf(u.id);
          other.classList.toggle('packed', k >= 0);
          otherBadge.textContent = k >= 0 ? String(k + 1) : '';
        });
        send.disabled = order.length < min;
        note.textContent = order.length < recommended ? `דירגת ${order.length}. לפי אתרי הכנה כדאי לדרג לפחות ${recommended}, וגם לפחות ${min} חובה.` : `דירגת ${order.length}.`;
      });
      grid.append(b);
      return { b, badge, unit };
    });
    send.addEventListener('click', () => close([...order]));
    panel.append(grid, note, actions(send));
  });
}

// ---------- The personal form (they compare your interview answers with it) ----------

export function formPanel(ui) {
  return ui.panel('form', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'שאלון אישי · יוצג למראיינים'), el('h2', '', 'מלא בכנות'));
    panel.append(el('p', '', 'המראיינים קוראים את מה שכתבת כאן. לפי אתרי הכנה הם שואלים אותה שאלה שוב בניסוח אחר, ובודקים אם אתה עקבי. כתוב רק מה שנכון.'));
    const answers = {};
    const go = button('הגשה');
    go.disabled = true;
    for (const field of FORM) {
      const box = el('div', 'form-field');
      box.append(el('p', 'form-q', field.q));
      const row = el('div', 'form-options');
      field.options.forEach((text, i) => {
        const b = button(text, 'form-option');
        b.addEventListener('click', () => {
          click();
          answers[field.key] = i;
          row.querySelectorAll('.form-option').forEach((o) => o.classList.toggle('on', o === b));
          go.disabled = Object.keys(answers).length < FORM.length;
        });
        row.append(b);
      });
      box.append(row);
      panel.append(box);
    }
    go.addEventListener('click', () => close(answers));
    panel.append(actions(go));
  });
}

// ---------- What to bring ----------

export function bagCheck(ui) {
  return ui.panel('bag', (panel, close) => {
    panel.append(
      el('p', 'eyebrow', 'יום הראיונות · בבוקר, לפני היציאה'),
      el('h2', '', 'מה לוקחים לבקו״ם?'),
      el('p', '', 'יום ארוך שרובו המתנה. לחץ על מה שכדאי להכניס לתיק.'),
    );
    const grid = el('div', 'bag-grid');
    const note = el('p', 'bag-note');
    const go = button('יוצאים');
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

// ---------- Your schedule, handed out at registration ----------

export function schedulePanel(ui, { number, interviews }) {
  return ui.panel('summons', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'רישום · בקו״ם תל השומר'), el('h2', '', `מספר ${number}`));
    panel.append(el('p', '', 'קוראים אותך לפי המספר, על המסך באולם. זה הסדר שלך היום:'));
    const list = el('ol', 'path-list');
    interviews.forEach((id, i) => {
      const unit = UNIT_BY_ID[id];
      const li = el('li');
      li.append(el('strong', '', unit.name), el('span', '', `ראיון ${i + 1}`));
      list.append(li);
    });
    panel.append(list);
    panel.append(el('p', 'note', 'במציאות לא ברור איך מפרסמים את הסדר, כנראה לפי הקריאה. כאן הוא מופיע על הדף כדי שתדע לאן ללכת.'));
    const ok = button('למסך ההמתנה');
    ok.addEventListener('click', () => close());
    panel.append(actions(ok));
  });
}

// ---------- A poster on the board ----------

export function readPoster(ui, unit) {
  return ui.fact(unit.name, [unit.pitch, unit.note]);
}

// ---------- The answer ----------

export function resultsPhone(ui, { accepted, lines, impressions }) {
  return ui.panel('phone-wrap', (panel, close) => {
    panel.className = 'phone';
    const screen = el('div', 'phone-screen');
    screen.append(el('div', 'phone-time', 'כשבועיים אחרי היום · 18:40'));
    const sms = el('div', 'sms');
    sms.append(el('b', '', 'מתגייסים · צה״ל'), 'שלום, תשובה בנוגע לשבוע ראיונות: ');
    if (accepted) sms.append(el('strong', 'sms-outcome', `שובצת ל${accepted.name}`), el('p', 'sms-detail', 'השיבוץ מחייב. פרטי הגיוס יופיעו באזור האישי.'));
    else sms.append(el('strong', 'sms-outcome', 'לא נמצאה יחידה שקיבלה אותך'), el('p', 'sms-detail', 'ההמשך נקבע לפי נתוניך האישיים והיחידות שאליהן עדיין אפשר להגיע.'));
    screen.append(sms);
    const list = el('ul', 'summary-list');
    for (const [label, value] of lines) {
      const li = el('li');
      li.append(el('span', '', label), el('strong', '', value));
      list.append(li);
    }
    screen.append(el('p', 'eyebrow', 'איך היה לך (רק במשחק)'), list);
    if (impressions.length) {
      const bars = el('div', 'impressions');
      for (const { unit, value, accepts } of impressions) {
        const row = el('div', 'impression');
        row.append(el('span', '', unit.name));
        const track = el('div', 'impression-track');
        const fill = el('div', 'impression-fill');
        fill.style.width = `${Math.round(value * 100)}%`;
        fill.classList.toggle('good', accepts);
        track.append(fill);
        row.append(track, el('b', '', accepts ? '✓' : '✗'));
        bars.append(row);
      }
      screen.append(bars);
    }
    screen.append(el('p', 'note', 'במציאות לא מקבלים פירוט. הנוסחה של השיבוץ אינה פומבית, והחישוב כאן פשוט ונועד להראות מה בודקים.'));
    const learn = button('מה עוד כדאי לדעת');
    const menu = button('לתפריט הראשי', 'button secondary');
    const again = button('לשחק שוב', 'button secondary');
    learn.addEventListener('click', () => close('learn'));
    menu.addEventListener('click', () => close('menu'));
    again.addEventListener('click', () => close('again'));
    screen.append(actions(learn), actions(menu, again));
    panel.append(screen);
    play('sms', { volume: 0.8 });
  });
}

export function learnMenu(ui, topics) {
  return ui.panel('prefs', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'שבוע ראיונות'), el('h2', '', 'על מה תרצה לדעת עוד?'));
    const grid = el('div', 'bag-grid');
    for (const topic of topics) {
      const b = button(topic.title, 'bag-item');
      b.addEventListener('click', async () => {
        click();
        await ui.fact(topic.title, topic.points);
      });
      grid.append(b);
    }
    const done = button('סיימתי');
    done.addEventListener('click', () => close());
    panel.append(grid, actions(done));
  });
}
