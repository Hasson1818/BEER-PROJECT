import { showScreen, browserWindow, el, button, introCard, typeInto } from '../../pilot-path/shared/screens.js';
import { fx } from '../../pilot-path/shared/fx.js';

// The computer tests of יום המא״ה, in the four kinds the official page lists (2022): information processing,
// technical operation, management and organization, spatial thinking. The items are made up by the game each
// time (the real ones were never published). No points are taken off for a wrong answer (official, 2024).

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Wrong answers near the right number, without repeats. */
function numberChoices(right, spread = 3) {
  const set = new Set([right]);
  for (let guard = 0; set.size < 4 && guard < 60; guard++) {
    const v = right + rand(-spread, spread);
    if (v >= 0) set.add(v);
  }
  for (let k = 1; set.size < 4; k++) set.add(right + spread + k);
  return shuffle([...set]).map(String);
}

// ---------- 1. Information processing: a timetable, and a flow chart ----------

const STOPS = ['תחנה מרכזית', 'בית חולים', 'קניון', 'אוניברסיטה', 'נמל'];

function infoTable() {
  const lines = shuffle(Array.from({ length: 80 }, (_, k) => String(k + 10))).slice(0, 5);
  const rows = lines.map((line, i) => ({ line, dep: 7 * 60 + rand(0, 10) * 6, ride: rand(3, 9) * 5, to: STOPS[i] }));
  const table = el('table', 'mt-table');
  table.innerHTML = '<thead><tr><th>קו</th><th>יציאה</th><th>זמן נסיעה</th><th>יעד</th></tr></thead>';
  const tbody = el('tbody');
  for (const r of rows) {
    const tr = el('tr');
    for (const v of [r.line, hhmm(r.dep), `${r.ride} דק׳`, r.to]) tr.append(el('td', '', v));
    tbody.append(tr);
  }
  table.append(tbody);
  const kind = rand(0, 1);
  if (kind === 0) {
    const first = rows.reduce((a, b) => (a.dep + a.ride <= b.dep + b.ride ? a : b));
    const others = shuffle(rows.filter((r) => r !== first)).slice(0, 3);
    return { prompt: [table, el('p', 'mt-q', 'איזה קו מגיע ליעד שלו הכי מוקדם?')], choices: shuffle([first, ...others].map((r) => `קו ${r.line}`)), answer: `קו ${first.line}` };
  }
  const limit = 7 * 60 + 30;
  const count = rows.filter((r) => r.dep + r.ride <= limit).length;
  return { prompt: [table, el('p', 'mt-q', `כמה קווים מגיעים ליעד עד ${hhmm(limit)} (כולל)?`)], choices: numberChoices(count, 2).map((v) => String(Math.max(0, Number(v)))), answer: String(count) };
}

function infoFlow() {
  const start = rand(3, 12);
  const add = rand(2, 6);
  const steps = [
    { text: 'אם המספר זוגי: חלק ב־2', test: (x) => x % 2 === 0, act: (x) => x / 2 },
    { text: `אחרת: הוסף ${add}`, act: (x) => x + add },
  ];
  let x = start;
  for (let i = 0; i < 2; i++) x = steps[0].test(x) ? steps[0].act(x) : steps[1].act(x);
  const chart = el('div', 'mt-flow');
  for (const [cls, text] of [
    ['start', `התחלה: ${start}`],
    ['step', steps[0].text],
    ['step', steps[1].text],
    ['loop', 'חזור על הבדיקה פעם אחת נוספת'],
    ['end', 'התוצאה: ?'],
  ]) chart.append(el('div', `mt-box ${cls}`, text));
  return { prompt: [chart, el('p', 'mt-q', 'מה התוצאה?')], choices: numberChoices(x, 3), answer: String(x) };
}

// ---------- 2. Technical operation: gears ----------

function svg(w, h) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', `0 0 ${w} ${h}`);
  s.setAttribute('class', 'mt-svg');
  return s;
}
function svgEl(name, attrs) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}
function gear(s, x, y, r, label, highlight = false) {
  const teeth = Math.round(r / 3);
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    s.append(svgEl('rect', { x: x - 3, y: y - r - 6, width: 6, height: 10, fill: '#8aa0bf', transform: `rotate(${(a * 180) / Math.PI} ${x} ${y})` }));
  }
  s.append(svgEl('circle', { cx: x, cy: y, r, fill: highlight ? '#2f5d8a' : '#3b4a63', stroke: '#8aa0bf', 'stroke-width': 3 }));
  const t = svgEl('text', { x, y: y + 8, 'text-anchor': 'middle', fill: '#fff', 'font-size': 22, 'font-weight': 800, 'font-family': 'Heebo, sans-serif' });
  t.textContent = label;
  s.append(t);
}

function techGears() {
  const n = rand(3, 6);
  const width = 80 + n * 90;
  const s = svg(width, 170);
  const names = 'אבגדהו';
  // Gear א is on the right (Hebrew reads right to left).
  const gx = (i) => width - 60 - i * 90;
  for (let i = 0; i < n; i++) gear(s, gx(i), 85, 38, names[i], i === 0);
  // An arrow over the first gear: clockwise.
  const x0 = gx(0);
  s.append(svgEl('path', { d: `M ${x0 - 28} 32 A 44 44 0 0 1 ${x0 + 30} 36`, fill: 'none', stroke: '#f2c94c', 'stroke-width': 4, 'marker-end': 'url(#mt-arrow)' }));
  const defs = svgEl('defs', {});
  const marker = svgEl('marker', { id: 'mt-arrow', markerWidth: 8, markerHeight: 8, refX: 4, refY: 4, orient: 'auto' });
  marker.append(svgEl('path', { d: 'M0,0 L8,4 L0,8 z', fill: '#f2c94c' }));
  defs.append(marker);
  s.prepend(defs);
  const same = n % 2 === 1;
  return {
    prompt: [s, el('p', 'mt-q', `גלגל א׳ מסתובב עם כיוון השעון. לאן מסתובב גלגל ${names[n - 1]}׳?`)],
    choices: ['עם כיוון השעון', 'נגד כיוון השעון', 'הוא לא זז', 'אי אפשר לדעת'],
    answer: same ? 'עם כיוון השעון' : 'נגד כיוון השעון',
    keepOrder: true,
  };
}

function techRatio() {
  const a = pick([10, 12, 15, 20]);
  const mult = pick([2, 3]);
  const b = a * mult;
  const turns = pick([3, 6, 9, 12].filter((t) => t % mult === 0));
  const r2 = Math.round(40 * Math.sqrt(mult));
  const s = svg(160 + 2 * r2 + 30, 180);
  const w = 160 + 2 * r2 + 30;
  gear(s, w - 70, 90, 40, `${a}`, true);
  gear(s, w - 70 - 40 - r2 - 6, 90, r2, `${b}`);
  return {
    prompt: [s, el('p', 'mt-q', `לגלגל הקטן ${a} שיניים ולגדול ${b}. הקטן עושה ${turns} סיבובים. כמה סיבובים עושה הגדול?`)],
    choices: numberChoices(turns / mult, 2).map((v) => String(Math.max(1, Number(v)))),
    answer: String(turns / mult),
  };
}

// ---------- 3. Management and organization: find the copying errors ----------

const LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת';
function code() {
  return `${pick([...LETTERS])}${pick([...LETTERS])}-${rand(1000, 9999)}`;
}
function corrupt(text) {
  const i = rand(3, text.length - 1);
  const digit = String((Number(text[i]) + rand(1, 8)) % 10);
  return text.slice(0, i) + digit + text.slice(i + 1);
}

function orgCompare() {
  const rows = Array.from({ length: 6 }, code);
  const errors = rand(0, 3);
  const bad = new Set(shuffle([0, 1, 2, 3, 4, 5]).slice(0, errors));
  const table = el('table', 'mt-table mono');
  table.innerHTML = '<thead><tr><th>#</th><th>במקור</th><th>בהעתק</th></tr></thead>';
  const tbody = el('tbody');
  rows.forEach((r, i) => {
    const tr = el('tr');
    tr.append(el('td', '', String(i + 1)), el('td', '', r), el('td', '', bad.has(i) ? corrupt(r) : r));
    tbody.append(tr);
  });
  table.append(tbody);
  return { prompt: [table, el('p', 'mt-q', 'בכמה שורות ההעתק שונה מהמקור?')], choices: ['0', '1', '2', '3'], answer: String(errors), keepOrder: true };
}

function orgSort() {
  const items = shuffle(['דוח מלאי', 'רשימת ציוד', 'הזמנת אוכל', 'לוח שמירות', 'טופס יציאה']).slice(0, 4).map((name) => ({ name, day: rand(1, 28), prio: rand(1, 3) }));
  const sorted = [...items].sort((a, b) => a.prio - b.prio || a.day - b.day);
  const table = el('table', 'mt-table');
  table.innerHTML = '<thead><tr><th>משימה</th><th>דחיפות (1 הכי דחוף)</th><th>תאריך יעד</th></tr></thead>';
  const tbody = el('tbody');
  for (const it of items) {
    const tr = el('tr');
    tr.append(el('td', '', it.name), el('td', '', String(it.prio)), el('td', '', `${it.day}.11`));
    tbody.append(tr);
  }
  table.append(tbody);
  return {
    prompt: [table, el('p', 'mt-q', 'מסדרים לפי דחיפות, ובדחיפות שווה לפי התאריך המוקדם. מה המשימה השנייה בתור?')],
    choices: shuffle(items.map((i) => i.name)),
    answer: sorted[1].name,
  };
}

// ---------- 4. Spatial thinking: where does the arrow point after the turns ----------

const DIRS = ['↑', '→', '↓', '←'];
const TURNS = [
  { text: 'רבע סיבוב עם כיוון השעון', d: 1, icon: '↻ ¼' },
  { text: 'רבע סיבוב נגד כיוון השעון', d: -1, icon: '↺ ¼' },
  { text: 'חצי סיבוב', d: 2, icon: '⟳ ½' },
];

function spatialTurns() {
  const start = rand(0, 3);
  const steps = Array.from({ length: rand(3, 5) }, () => pick(TURNS));
  const end = (((start + steps.reduce((a, s) => a + s.d, 0)) % 4) + 4) % 4;
  const row = el('div', 'mt-turns');
  row.append(el('span', 'mt-arrow', DIRS[start]));
  for (const s of steps) row.append(el('span', 'mt-turn', s.icon));
  row.append(el('span', 'mt-arrow q', '?'));
  return {
    prompt: [row, el('p', 'mt-q', `החץ מסתובב לפי הסדר: ${steps.map((s) => s.text).join(', ')}. לאן הוא מצביע בסוף?`)],
    choices: DIRS,
    answer: DIRS[end],
    keepOrder: true,
    big: true,
  };
}

function spatialCount() {
  // A path on a grid; count how many times it turns.
  const moves = [];
  let dir = rand(0, 3);
  let turns = 0;
  for (let i = 0; i < 7; i++) {
    if (i > 0 && Math.random() < 0.55) {
      dir = (dir + (Math.random() < 0.5 ? 1 : 3)) % 4;
      turns++;
    }
    moves.push(dir);
  }
  const s = svg(320, 220);
  let x = 160;
  let y = 110;
  const pts = [[x, y]];
  const step = 26;
  for (const d of moves) {
    x += [0, step, 0, -step][d];
    y += [-step, 0, step, 0][d];
    pts.push([x, y]);
  }
  // Center the drawing.
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const dx = 160 - (Math.min(...xs) + Math.max(...xs)) / 2;
  const dy = 110 - (Math.min(...ys) + Math.max(...ys)) / 2;
  s.append(svgEl('polyline', { points: pts.map(([a, b]) => `${a + dx},${b + dy}`).join(' '), fill: 'none', stroke: '#4ea1ff', 'stroke-width': 6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  s.append(svgEl('circle', { cx: pts[0][0] + dx, cy: pts[0][1] + dy, r: 8, fill: '#34d58a' }));
  return { prompt: [s, el('p', 'mt-q', 'כמה פעמים המסלול פונה (מהנקודה הירוקה עד הסוף)?')], choices: numberChoices(turns, 2).map((v) => String(Math.max(0, Number(v)))), answer: String(turns) };
}

export const MODULES = [
  {
    id: 'info',
    title: 'עיבוד מידע',
    intro: ['טבלאות ותרשימי זרימה. קוראים, מחשבים, בוחרים תשובה.', 'רשמי: אין הורדת נקודות על טעות. כדאי לענות על כל השאלות.'],
    make: () => (Math.random() < 0.5 ? infoTable() : infoFlow()),
  },
  {
    id: 'tech',
    title: 'הפעלה טכנית',
    intro: ['גלגלי שיניים ומנגנונים פשוטים: לאן זה מסתובב, כמה סיבובים.'],
    make: () => (Math.random() < 0.6 ? techGears() : techRatio()),
  },
  {
    id: 'organize',
    title: 'ניהול וארגון',
    intro: ['מוצאים טעויות העתקה ומסדרים משימות לפי כללים.'],
    make: () => (Math.random() < 0.6 ? orgCompare() : orgSort()),
  },
  {
    id: 'spatial',
    title: 'תפיסה מרחבית',
    intro: ['סיבובים של חץ ומסלולים: לאן מצביעים בסוף, כמה פניות.'],
    make: () => (Math.random() < 0.6 ? spatialTurns() : spatialCount()),
  },
];

/** One module: `count` items against the clock. Resolves to { score, answered, total, seconds }. */
function runModule(stage, mod, { count, seconds, practice }) {
  return new Promise((resolve) => {
    let i = 0;
    let right = 0;
    let answered = 0;
    let left = seconds;
    const started = performance.now();
    const head = el('div', 'mt-head');
    const progress = el('span', '', '');
    const clock = el('span', 'mt-clock', '');
    head.append(el('b', '', practice ? `${mod.title} · תרגול` : mod.title), progress, clock);
    const body = el('div', 'mt-item');
    stage.append(head, body);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(timer);
      document.removeEventListener('keydown', onKey);
      resolve({ score: right / count, answered, total: count, seconds: (performance.now() - started) / 1000 });
    };
    const timer = setInterval(() => {
      left--;
      clock.textContent = `${Math.max(0, left)} שנ׳`;
      clock.classList.toggle('low', left <= 10);
      if (left <= 0) finish();
    }, 1000);
    clock.textContent = `${left} שנ׳`;
    let buttons = [];
    const onKey = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= buttons.length) buttons[n - 1].click();
    };
    document.addEventListener('keydown', onKey);
    const show = () => {
      if (i >= count) return finish();
      progress.textContent = `שאלה ${i + 1} מתוך ${count}`;
      const item = mod.make();
      body.innerHTML = '';
      body.append(...item.prompt);
      const grid = el('div', `mt-choices${item.big ? ' big' : ''}`);
      const choices = item.keepOrder ? item.choices : item.choices;
      buttons = choices.map((text, k) => {
        const b = button('', 'mt-choice');
        b.append(el('span', 'mt-key', String(k + 1)), el('span', 'mt-text', text));
        b.addEventListener('click', () => {
          if (done) return;
          answered++;
          const ok = text === item.answer;
          if (ok) right++;
          fx.click();
          if (practice) {
            b.classList.add(ok ? 'good' : 'bad');
            if (!ok) buttons.find((x) => x.querySelector('.mt-text').textContent === item.answer)?.classList.add('good');
            setTimeout(() => {
              i++;
              show();
            }, 900);
          } else {
            i++;
            show();
          }
        });
        grid.append(b);
        return b;
      });
      body.append(grid);
    };
    show();
  });
}

/**
 * The whole computer part, in a browser window. Resolves to { results: {id: {score, answered, total}}, practiced }.
 * The real tests take about two hours; here each module is a minute or two.
 */
export function runTests(game, { id = '3290 …', only = null } = {}) {
  const list = only ? MODULES.filter((m) => only.includes(m.id)) : MODULES;
  return showScreen(game, 'mt-screen', async (root, close) => {
    const { body } = browserWindow(root, 'https://maa.mitgaisim.idf.il/tests');
    // Log in.
    const page = el('div', 'mt-login');
    page.append(el('div', 'mt-logo', 'מא״ה'), el('h1', 'pp-title', 'יום המא״ה · מבחנים ממוחשבים'), el('p', 'pp-sub', 'מיון, איתור והתאמה'));
    const idOut = el('output', 'mt-input');
    page.append(el('p', 'pp-sub', 'תעודת זהות'), idOut);
    const go = button('כניסה');
    go.disabled = true;
    page.append(go);
    body.append(page);
    await wait(400);
    await typeInto(idOut, id, { speed: 80, fx });
    go.disabled = false;
    go.focus();
    await new Promise((r) => go.addEventListener('click', () => (fx.click(), r())));

    const results = {};
    let practiced = 0;
    for (const [index, mod] of list.entries()) {
      for (;;) {
        body.innerHTML = '';
        const strip = el('div', 'ht-strip');
        list.forEach((m, k) => {
          const item = el('div', `ht-step${k < index ? ' done' : k === index ? ' on' : ''}`);
          item.append(el('i', '', k < index ? '✓' : String(k + 1)), el('span', '', m.title));
          strip.append(item);
        });
        body.append(strip);
        const holder = el('div', 'ht-holder');
        body.append(holder);
        const choice = await introCard(holder, {
          eyebrow: `פרק ${index + 1} מתוך ${list.length}`,
          title: mod.title,
          lines: mod.intro,
          keys: [{ keys: ['1', '2', '3', '4'], text: 'בחירת תשובה (או לחיצה)' }],
          note: 'השאלות כאן נכתבו בשביל המשחק, לפי סוגי השאלות שפורסמו. במציאות כל המבחנים יחד כשעתיים.',
        });
        holder.innerHTML = '';
        const stage = el('div', 'mt-stage');
        holder.append(stage);
        if (choice === 'practice') {
          practiced++;
          await runModule(stage, mod, { count: 2, seconds: 60, practice: true });
          continue;
        }
        results[mod.id] = await runModule(stage, mod, { count: 6, seconds: 90, practice: false });
        fx.done();
        break;
      }
    }
    body.innerHTML = '';
    const end = el('div', 'mt-login');
    end.append(el('div', 'mt-logo good', '✓'), el('h2', 'pp-title', 'המבחנים נשלחו'), el('p', 'pp-sub', 'אפשר לסגור את החלון. בעוד כמה דקות מתחברים לזום.'));
    body.append(end);
    await wait(1800);
    close({ results, practiced });
  });
}

const STYLE_ID = 'mt-style';
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .mt-login { max-width: 520px; margin: 4vh auto 0; text-align: center; display: grid; gap: 10px; justify-items: center; animation: pp-fade .4s ease both; }
    .mt-logo { display: grid; place-items: center; width: 84px; height: 84px; border-radius: 22px; background: linear-gradient(140deg, #3d6fa8, #1f3b73); color: #fff; font: 800 1.4rem 'Secular One', 'Heebo', sans-serif; box-shadow: 0 10px 30px rgba(40,90,170,.5); }
    .mt-logo.good { border-radius: 50%; background: radial-gradient(circle at 35% 30%, #5be0a8, #17895f); font-size: 2.6rem; }
    .mt-input { display: block; width: 100%; min-height: 46px; padding: 11px 14px; border-radius: 10px; background: #0a1120; color: #fff; box-shadow: inset 0 0 0 1px var(--pp-line); font: 600 1.15rem ui-monospace, Menlo, monospace; letter-spacing: .1em; direction: ltr; text-align: left; }
    .mt-stage { width: min(860px, 100%); margin: 0 auto; padding: 14px 18px 18px; border-radius: 14px; background: #0a1120; box-shadow: inset 0 0 0 1px var(--pp-line); }
    .mt-head { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; color: var(--pp-muted); font-weight: 700; }
    .mt-head b { color: #fff; flex: 1; }
    .mt-clock { font-family: ui-monospace, Menlo, monospace; color: #9fd0ff; }
    .mt-clock.low { color: #ff7b6b; }
    .mt-item { display: grid; gap: 12px; justify-items: center; }
    .mt-q { margin: 0; font-weight: 700; font-size: 1.05rem; color: #eef3ff; text-align: center; }
    .mt-table { border-collapse: collapse; min-width: min(520px, 100%); color: #e4ecfb; font-size: .95rem; }
    .mt-table th, .mt-table td { padding: 6px 12px; border: 1px solid rgba(160,190,255,.25); text-align: center; }
    .mt-table th { background: rgba(78,161,255,.15); }
    .mt-table.mono td { font-family: ui-monospace, Menlo, monospace; letter-spacing: .06em; }
    .mt-flow { display: grid; gap: 8px; justify-items: center; }
    .mt-box { padding: 8px 18px; border-radius: 10px; background: #1b2740; color: #e8eefc; font-weight: 700; position: relative; }
    .mt-box.start, .mt-box.end { border-radius: 999px; background: #24406b; }
    .mt-box.loop { background: transparent; color: #9fd0ff; border: 1px dashed #4ea1ff; }
    .mt-box:not(:last-child)::after { content: '↓'; position: absolute; left: 50%; bottom: -19px; transform: translateX(-50%); color: #8aa0bf; font-size: .9rem; }
    .mt-svg { width: min(560px, 100%); height: auto; max-height: 220px; }
    .mt-turns { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px; }
    .mt-arrow { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 14px; background: #24406b; color: #fff; font-size: 2.2rem; font-weight: 800; }
    .mt-arrow.q { background: transparent; border: 2px dashed #4ea1ff; color: #9fd0ff; }
    .mt-turn { padding: 6px 10px; border-radius: 10px; background: #1b2740; color: #f2c94c; font-weight: 800; }
    .mt-choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; width: min(620px, 100%); }
    .mt-choices.big .mt-choice { font-size: 1.6rem; }
    .mt-choice { min-height: 46px; padding: 8px 14px; border-radius: 12px; border: 0; background: #1b2740; color: #e8eefc; font: 700 1rem 'Heebo', sans-serif; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(160,190,255,.2); }
    .mt-choice { display: flex; align-items: center; gap: 10px; }
    .mt-key { display: grid; place-items: center; min-width: 26px; height: 26px; border-radius: 7px; background: rgba(255,255,255,.1); font-size: .8rem; }
    .mt-text { flex: 1; text-align: center; unicode-bidi: plaintext; }
    .ht-strip { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
    .ht-step { display: flex; align-items: center; gap: 8px; padding: 5px 12px 5px 8px; border-radius: 999px; background: rgba(255,255,255,.06); color: var(--pp-muted); font-size: .85rem; font-weight: 700; }
    .ht-step i { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: rgba(255,255,255,.12); font-style: normal; font-size: .75rem; }
    .ht-step.on { background: rgba(78,161,255,.18); color: #fff; box-shadow: inset 0 0 0 1px var(--pp-accent); }
    .ht-step.on i { background: var(--pp-accent); color: #06142c; }
    .ht-step.done { color: var(--pp-good); }
    .ht-step.done i { background: var(--pp-good); color: #04251a; }
    .ht-holder { min-height: 200px; }
    .mt-choice:hover { background: #274066; box-shadow: inset 0 0 0 2px #4ea1ff; }
    .mt-choice.good { background: #17895f; }
    .mt-choice.bad { background: #8a2b2b; }
  `;
  document.head.append(style);
}
