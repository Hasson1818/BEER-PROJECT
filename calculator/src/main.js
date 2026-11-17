import './style.css';
import { loadResults } from '../../shared/save.js';
import { unlock } from '../../shared/achievements.js';
import { UNITS, PROFILES, DAPARS, KABAS, HEBREWS, MAA_ENVS, CATEGORIES, DISCLAIMER, SOURCES } from './data.js';
import { QUESTIONS, TRAITS } from './questions.js';
import { evaluate, grid, top } from './engine.js';

const $ = (id) => document.getElementById(id);
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

// ---------- State (kept in this browser only) ----------

const KEY = 'beer-project-calculator';
const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
})();
const input = saved?.input ?? { gender: 'm', profile: 97, dapar: 60, kaba: 52, hebrew: 9, maa: null };
let answers = saved?.answers ?? {};
let quizIndex = 0;
let filter = 'all';
const persist = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ input, answers }));
  } catch {
    // Private mode: the calculator still works, it just won't remember.
  }
};

// ---------- Inputs ----------

$('disclaimer').textContent = DISCLAIMER;
const fillSelect = (select, values, label = (v) => String(v), extra = null) => {
  select.innerHTML = '';
  if (extra) select.append(new Option(extra.label, extra.value));
  for (const v of values) select.append(new Option(label(v), String(v)));
};
fillSelect($('profile'), PROFILES);
fillSelect($('dapar'), DAPARS);
fillSelect($('kaba'), KABAS, String, { label: 'לא יודע/ת', value: '' });
fillSelect($('hebrew'), HEBREWS, String, { label: 'לא יודע/ת', value: '' });

const maaGrid = $('maa-grid');
for (const env of MAA_ENVS) {
  const label = el('label');
  const select = el('select');
  select.dataset.env = env.id;
  for (let s = 1; s <= 5; s++) select.append(new Option(String(s), String(s)));
  select.value = String(input.maa?.[env.id] ?? 3);
  label.append(el('span', '', env.name), select);
  maaGrid.append(label);
  select.addEventListener('change', () => {
    input.maa ??= {};
    input.maa[env.id] = Number(select.value);
    update();
  });
}

function syncInputs() {
  for (const b of $('gender').querySelectorAll('button')) b.setAttribute('aria-checked', String(b.dataset.v === input.gender));
  $('profile').value = String(input.profile);
  $('dapar').value = String(input.dapar);
  $('kaba').value = input.kaba == null ? '' : String(input.kaba);
  $('hebrew').value = input.hebrew == null ? '' : String(input.hebrew);
  $('maa-on').checked = Boolean(input.maa);
  maaGrid.classList.toggle('off', !input.maa);
  for (const s of maaGrid.querySelectorAll('select')) s.value = String(input.maa?.[s.dataset.env] ?? 3);
  $('maa-state').textContent = input.maa ? 'הוזנו · נבדקים מול דרישות התפקידים' : 'לא הוזנו · תפקידים שתלויים בהם יסומנו "תלוי"';
}

$('gender').addEventListener('click', (event) => {
  const b = event.target.closest('button');
  if (!b) return;
  input.gender = b.dataset.v;
  update();
});
$('profile').addEventListener('change', () => {
  input.profile = Number($('profile').value);
  update();
});
$('dapar').addEventListener('change', () => {
  input.dapar = Number($('dapar').value);
  update();
});
$('kaba').addEventListener('change', () => {
  input.kaba = $('kaba').value ? Number($('kaba').value) : null;
  update();
});
$('hebrew').addEventListener('change', () => {
  input.hebrew = $('hebrew').value ? Number($('hebrew').value) : null;
  update();
});
$('maa-on').addEventListener('change', () => {
  input.maa = $('maa-on').checked ? Object.fromEntries(MAA_ENVS.map((e) => [e.id, Number(maaGrid.querySelector(`[data-env="${e.id}"]`).value)])) : null;
  update();
});

// "Fill from the game": the צו ראשון and יום המא״ה results this browser saved.
$('fill').addEventListener('click', () => {
  const tzav = loadResults('tzav-rishon');
  const maa = loadResults('yom-hamaa');
  const got = [];
  if (tzav) {
    if (tzav.profile) input.profile = tzav.profile;
    if (tzav.dapar) input.dapar = Math.min(90, Math.max(10, Math.round(tzav.dapar / 10) * 10));
    if (tzav.kaba) input.kaba = tzav.kaba;
    if (tzav.hebrew) input.hebrew = tzav.hebrew;
    got.push('צו ראשון');
  }
  if (maa?.scores) {
    input.maa = Object.fromEntries(MAA_ENVS.map((e) => [e.id, Math.min(5, Math.max(1, Math.round(maa.scores[e.id] ?? 3)))]));
    got.push('יום המא״ה');
  }
  $('fill-hint').textContent = got.length ? `מולא מ: ${got.join(' ו')}` : 'אין עדיין תוצאות שמורות. שחקו את הצו הראשון ואת יום המא״ה.';
  update();
});

// ---------- Where you can go ----------

function req(unit) {
  const r = unit.req;
  const parts = [];
  if (r.profile) parts.push(`פרופיל ${r.profile}+`);
  if (r.dapar) parts.push(`דפ״ר ${r.dapar}+`);
  if (r.kaba) parts.push(`קב״א ${r.kaba}+`);
  if (r.hebrew) parts.push(`עברית ${r.hebrew}+`);
  if (r.maa) for (const [env, min] of Object.entries(r.maa)) parts.push(`${MAA_ENVS.find((e) => e.id === env)?.name ?? env} ${min}+`);
  return parts;
}

function card(entry) {
  const { unit, ok, reasons, pending } = entry;
  const node = el('article', `unit${ok ? (pending.length ? ' pending' : '') : ' no'}`);
  node.append(el('span', 'cat', CATEGORIES[unit.cat] ?? unit.cat), el('h3', '', unit.name));
  const tags = el('div', 'reqs');
  for (const p of req(unit)) tags.append(el('span', 'tag', p));
  if (unit.gender?.length === 1) tags.append(el('span', 'tag', unit.gender[0] === 'f' ? 'חיילות' : 'חיילים'));
  for (const r of reasons) tags.append(el('span', 'tag no', `חסר: ${r}`));
  for (const p of pending) tags.append(el('span', 'tag warn', p));
  tags.append(el('span', 'tag src', unit.src));
  node.append(tags);
  if (unit.note) node.append(el('p', 'why', unit.note));
  return node;
}

function renderUnits() {
  const all = evaluate(input);
  const open = all.filter((e) => e.ok);
  const closed = all.filter((e) => !e.ok);
  const free = open.filter((e) => !e.pending.length).length;
  $('summary').innerHTML = '';
  $('summary').append('עם הנתונים האלה נפתחים ', el('strong', '', String(open.length)), ` מתוך ${all.length} תפקידים ויחידות במחשבון. ${free} בלי מיון נוסף, ${open.length - free} עם מיון, גיבוש או נתון שחסר.`);

  const cats = ['all', ...new Set(open.map((e) => e.unit.cat))];
  if (!cats.includes(filter)) filter = 'all';
  $('filters').innerHTML = '';
  for (const c of cats) {
    const b = el('button', 'chip', c === 'all' ? `הכול (${open.length})` : `${CATEGORIES[c] ?? c} (${open.filter((e) => e.unit.cat === c).length})`);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(c === filter));
    b.addEventListener('click', () => {
      filter = c;
      renderUnits();
    });
    $('filters').append(b);
  }
  $('units').innerHTML = '';
  for (const e of open.filter((x) => filter === 'all' || x.unit.cat === filter)) $('units').append(card(e));
  $('closed-title').textContent = `לא נפתחים כרגע (${closed.length}) · ומה חסר`;
  $('closed').innerHTML = '';
  for (const e of closed) $('closed').append(card(e));
}

function heatColor(count, max) {
  const t = max ? count / max : 0;
  const a = [243, 220, 214];
  const b = [143, 178, 98];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}

function renderGrid() {
  const rows = grid(input);
  const max = Math.max(...rows.flatMap((r) => r.cells));
  const table = $('heat');
  table.innerHTML = '';
  const head = el('tr');
  head.append(el('th', '', 'פרופיל \\ דפ״ר'));
  for (const d of DAPARS) head.append(el('th', '', String(d)));
  table.append(head);
  for (const row of rows) {
    const tr = el('tr');
    tr.append(el('th', '', String(row.profile)));
    row.cells.forEach((count, i) => {
      const td = el('td', row.profile === input.profile && DAPARS[i] === input.dapar ? 'me' : '', String(count));
      td.style.background = heatColor(count, max);
      td.title = `פרופיל ${row.profile}, דפ״ר ${DAPARS[i]}: ${count} יחידות ותפקידים`;
      td.addEventListener('click', () => {
        input.profile = row.profile;
        input.dapar = DAPARS[i];
        update();
      });
      tr.append(td);
    });
    table.append(tr);
  }
}

// ---------- The questionnaire ----------

function renderQuiz() {
  const box = $('quiz');
  box.innerHTML = '';
  if (quizIndex >= QUESTIONS.length) {
    box.append(el('p', 'note', 'סיימת את השאלון. התוצאה למטה. אפשר לשנות את הנתונים למעלה והתוצאה תתעדכן.'));
    return;
  }
  const q = QUESTIONS[quizIndex];
  const wrap = el('div', 'quiz-q');
  const progress = el('div', 'quiz-progress');
  const fillBar = el('span');
  fillBar.style.width = `${(quizIndex / QUESTIONS.length) * 100}%`;
  progress.append(fillBar);
  wrap.append(progress, el('p', 'hint', `שאלה ${quizIndex + 1} מתוך ${QUESTIONS.length}`), el('h3', '', q.q));
  const options = el('div', 'options');
  q.options.forEach((option, i) => {
    const b = el('button', `option${answers[q.id] === i ? ' on' : ''}`, option.label);
    b.type = 'button';
    b.addEventListener('click', () => {
      answers[q.id] = i;
      quizIndex++;
      persist();
      renderQuiz();
      if (quizIndex >= QUESTIONS.length) renderTop(true);
    });
    options.append(b);
  });
  wrap.append(options);
  const row = el('div', 'row-actions');
  if (quizIndex > 0) {
    const back = el('button', 'btn ghost', 'לשאלה הקודמת');
    back.type = 'button';
    back.addEventListener('click', () => {
      quizIndex--;
      renderQuiz();
    });
    row.append(back);
  }
  wrap.append(row);
  box.append(wrap);
}

/** The traits on which a unit is closest to what the player asked for: the "why" line. */
function why(unit) {
  const hits = [];
  for (const q of QUESTIONS) {
    const option = q.options[answers[q.id]];
    if (!option || (option.want == null && option.match == null)) continue;
    const v = unit.traits[q.trait];
    const good = option.match != null ? (Array.isArray(v) ? v : [v]).includes(option.match) : Math.abs(v - option.want) <= 0.75;
    if (good) hits.push(TRAITS[q.trait].name);
  }
  return hits.slice(0, 4);
}

function renderTop(scroll = false) {
  const answered = QUESTIONS.filter((q) => answers[q.id] != null).length;
  if (answered < QUESTIONS.length) {
    $('result').hidden = true;
    return;
  }
  const list = top(input, answers, 5);
  $('result').hidden = false;
  $('top').innerHTML = '';
  for (const e of list) {
    const li = el('li');
    const rank = el('div', 'rank');
    rank.append(el('h3', '', e.unit.name), el('span', 'pct', `${e.fit}%`));
    const bar = el('div', 'bar');
    const fill = el('span');
    fill.style.width = `${e.fit}%`;
    bar.append(fill);
    li.append(rank, bar);
    const hits = why(e.unit);
    if (hits.length) li.append(el('p', 'why', `מתאים לך ב: ${hits.join(', ')}`));
    if (e.pending.length) li.append(el('p', 'why', `שימו לב: ${e.pending.join(' · ')}`));
    if (e.unit.stage) {
      const a = el('a', 'play', `לשחק את השלב במשחק ←`);
      a.href = e.unit.stage;
      li.append(a);
    }
    $('top').append(li);
  }
  $('top-note').textContent = list.length
    ? 'אחוזי ההתאמה הם של המשחק: הם משווים את התשובות שלך לתכונות של כל יחידה. הם לא חיזוי של שיבוץ אמיתי, שתלוי בצורכי הצבא, במיונים ובהעדפות.'
    : 'עם הנתונים האלה לא נפתחה אף יחידה במחשבון. נסו פרופיל או דפ״ר אחרים למעלה.';
  unlock('calculator-done');
  if (scroll) $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('redo').addEventListener('click', () => {
  answers = {};
  quizIndex = 0;
  persist();
  renderQuiz();
  $('result').hidden = true;
  $('s3').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ---------- Sources ----------

$('sources').innerHTML = '';
$('sources').append(el('p', '', 'מקורות עיקריים:'));
const ul = el('ul');
for (const [label, href] of SOURCES) {
  const li = el('li');
  const a = el('a', '', label);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  li.append(a);
  ul.append(li);
}
$('sources').append(ul);

// ---------- Go ----------

function update() {
  syncInputs();
  renderUnits();
  renderGrid();
  renderTop();
  persist();
}
if (QUESTIONS.every((q) => answers[q.id] != null)) quizIndex = QUESTIONS.length;
update();
renderQuiz();
