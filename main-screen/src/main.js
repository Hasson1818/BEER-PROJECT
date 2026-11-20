import './style.css';
import { createBackground } from './scene.js';
import { loadSave } from '../../shared/save.js';
import { ACHIEVEMENTS, STAGES, unlocked, progress, syncFromResults } from '../../shared/achievements.js';

const canvas = document.getElementById('bg');
try {
  createBackground(canvas);
} catch (error) {
  // No WebGL: the CSS gradient on <body> stays as the background.
  console.warn('3D background unavailable', error);
  canvas.remove();
}

// Each stage has its own page; the save remembers which one you were in.
const STAGE_PAGES = { 'tzav-rishon': '../tzav-rishon/', 'yom-sayarot': '../yom-sayarot/', 'gibbush-tayis': '../gibbush-tayis/', 'gibbush-matkal': '../gibbush-matkal/', draft: '../draft/', naval: '../naval/', shayetet: '../shayetet/', tzanhanim: '../tzanhanim/', yechatiyot: '../yechatiyot/', lochamot: '../lochamot/', oketz: '../oketz/', 'interview-week': '../interview-week/' };

const save = loadSave();
if (save) {
  document.getElementById('continue-note').textContent = `שמור: ${save.stageName ?? 'שלב לא ידוע'}`;
}

const mainActions = document.getElementById('main-actions');
const groups = document.getElementById('groups');
const stages = document.getElementById('stages');
const pool = document.getElementById('stage-pool');
const view = document.getElementById('stage-view');

// The stage picker has two levels: the kind of service (combat / combat support / non-combat), then the stages of
// that kind in rows by category. Every stage link lives once in #stage-pool (with data-group and data-row); the
// views are built from copies of them. Groups without stages yet say so and point at the calculator.
const GROUP_INFO = {
  combat: { title: 'קרבי', rows: ['סיירות וקומנדו', 'חי״ר וחטיבות', 'לוחמות', 'חיל הים', 'חיל האוויר'] },
  support: { title: 'תומך לחימה', rows: [] },
  noncombat: { title: 'לא קרבי · מודיעין, תקשוב, סייבר ועוד', rows: ['מודיעין'] },
};
// Rows follow the order of the journey, not the order of the links in the page.
const ORDER = ['tzav-rishon', 'yom-hamaa', 'lochamot', 'yom-sayarot', 'gibbush-matkal', 'draft', 'oketz', 'tzanhanim', 'yechatiyot', 'naval', 'shayetet', 'gibbush-tayis', 'pilot-path', 'interview-week', 'klal-haman'];
const stageId = (a) => a.getAttribute('href').split('/')[1];
const poolStages = (group) => [...pool.querySelectorAll(`.stage[data-group="${group}"]`)].sort((x, y) => ORDER.indexOf(stageId(x)) - ORDER.indexOf(stageId(y)));

function level(name) {
  mainActions.hidden = name !== 'main';
  groups.hidden = name !== 'groups';
  stages.hidden = name !== 'stages';
  const focus = { main: document.getElementById('choose'), groups: groups.querySelector('.group'), stages: stages.querySelector('.stage, .btn-back') };
  focus[name]?.focus();
}

function openGroup(id) {
  const info = GROUP_INFO[id];
  document.getElementById('stages-title').textContent = info.title;
  view.innerHTML = '';
  const items = poolStages(id);
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'picker-empty';
    empty.innerHTML = 'עדיין אין כאן שלבים. בינתיים אפשר לראות אילו תפקידים פתוחים לך ב<a href="../calculator/">מחשבון צה״ל</a>.';
    view.append(empty);
  }
  for (const row of info.rows) {
    const inRow = items.filter((a) => a.dataset.row === row);
    if (!inRow.length) continue;
    const section = document.createElement('section');
    section.className = 'stage-row';
    const title = document.createElement('h3');
    title.textContent = row;
    section.append(title);
    for (const a of inRow) section.append(a.cloneNode(true));
    view.append(section);
  }
  level('stages');
}

// "For everyone" (first order, Yom HaMa'a, interview week) sits under the three tiles.
const common = document.getElementById('group-common');
const commonTitle = document.createElement('h3');
commonTitle.textContent = 'שלבים לכולם';
common.append(commonTitle);
for (const a of poolStages('all')) common.append(a.cloneNode(true));

document.getElementById('choose').addEventListener('click', () => level('groups'));
document.getElementById('back-groups').addEventListener('click', () => level('main'));
document.getElementById('back').addEventListener('click', () => level('groups'));
for (const b of groups.querySelectorAll('[data-pick]')) b.addEventListener('click', () => openGroup(b.dataset.pick));

const toast = document.getElementById('toast');
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

const startButton = document.getElementById('start');
const continueButton = document.getElementById('continue');

startButton.addEventListener('click', () => {
  window.location.href = '../tzav-rishon/?new=1';
});

continueButton.addEventListener('click', () => {
  if (save) {
    window.location.href = `${STAGE_PAGES[save.stage] ?? STAGE_PAGES['tzav-rishon']}?continue=1`;
  } else {
    showToast('עדיין אין משחק שמור. התחל משחק חדש');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && document.activeElement === document.body) {
    startButton.click();
  }
});

requestAnimationFrame(() => document.body.classList.add('ready'));

// ---------- Progress bar and achievements ----------

syncFromResults();

const $ = (id) => document.getElementById(id);
const GROUPS = [{ id: 'all', name: 'כל המסע' }, ...STAGES.map((s) => ({ id: s.id, name: s.name })), { id: 'yom-hamaa', name: 'יום המא״ה' }, { id: 'gibbush-matkal', name: 'גיבוש מטכ״ל / שלדג' }, { id: 'draft', name: 'הדראפט: 669 / קומנדו' }, { id: 'naval', name: 'ענף ים' }, { id: 'shayetet', name: 'גיבוש שייטת' }, { id: 'tzanhanim', name: 'גיבוש צנחנים' }, { id: 'yechatiyot', name: 'גיבוש יחט״יות' }, { id: 'lochamot', name: 'מסלול לוחמות' }, { id: 'oketz', name: 'גיבוש עוקץ' }, { id: 'klal-haman', name: 'מיון כלל חמ״ן' }, { id: 'pilot-path', name: 'המסלול לטיס' }];

function renderJourney(animate = true) {
  const p = progress();
  const done = unlocked();
  $('j-rank').textContent = p.rank;
  $('j-foot').textContent = p.percent >= 100 ? 'השלמת הכול. כל הכבוד!' : `הושלמו ${p.count} מתוך ${p.total} הישגים · נשארו ${p.left}% בדרך`;
  $('j-track').setAttribute('aria-valuenow', String(p.percent));
  $('j-stages').innerHTML = '';
  for (const stage of STAGES) {
    const li = document.createElement('li');
    const finished = Boolean(done[stage.done]);
    li.className = finished ? 'done' : '';
    li.textContent = `${finished ? '✓' : '○'} ${stage.name}`;
    $('j-stages').append(li);
  }
  // The fill and the runner move to the new value; the number counts up.
  requestAnimationFrame(() => {
    $('j-fill').style.setProperty('--p', p.percent);
    $('j-runner').style.setProperty('--p', p.percent);
  });
  const target = p.percent;
  const label = $('j-percent');
  if (!animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    label.textContent = String(target);
    return;
  }
  const started = performance.now();
  const duration = 1100;
  const tick = (now) => {
    const t = Math.min(1, (now - started) / duration);
    label.textContent = String(Math.round(target * (1 - (1 - t) ** 3)));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderAchievements() {
  const done = unlocked();
  const p = progress();
  $('ach-summary').textContent = `${p.count} מתוך ${p.total} הישגים · ${p.percent}% מהדרך · דרגה: ${p.rank}`;
  const root = $('ach-groups');
  root.innerHTML = '';
  for (const group of GROUPS) {
    const items = ACHIEVEMENTS.filter((a) => a.group === group.id);
    const got = items.filter((a) => done[a.id]).length;
    const section = document.createElement('section');
    section.className = 'ach-group';
    const head = document.createElement('h3');
    head.innerHTML = '<span></span><small></small>';
    head.querySelector('span').textContent = group.name;
    head.querySelector('small').textContent = `${got} מתוך ${items.length}`;
    const grid = document.createElement('div');
    grid.className = 'ach-grid';
    for (const a of items) {
      const have = Boolean(done[a.id]);
      const card = document.createElement('div');
      card.className = `ach${have ? ' got' : ''}`;
      const icon = document.createElement('div');
      icon.className = 'ach-badge';
      icon.textContent = have ? a.icon : '🔒';
      const text = document.createElement('div');
      text.className = 'ach-body';
      const title = document.createElement('strong');
      title.textContent = a.title;
      const desc = document.createElement('span');
      desc.textContent = a.desc;
      const pts = document.createElement('em');
      pts.textContent = `+${a.points}%`;
      text.append(title, desc);
      card.append(icon, text, pts);
      grid.append(card);
    }
    section.append(head, grid);
    root.append(section);
  }
}

function openAchievements(open) {
  if (open) renderAchievements();
  $('ach-panel').hidden = !open;
  if (open) $('ach-close').focus();
  else $('j-open').focus();
}
$('j-open').addEventListener('click', () => openAchievements(true));
$('ach-close').addEventListener('click', () => openAchievements(false));
$('ach-panel').addEventListener('click', (event) => {
  if (event.target === $('ach-panel')) openAchievements(false);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !$('ach-panel').hidden) openAchievements(false);
});
setTimeout(() => renderJourney(), 500);
