// Achievements: each one is worth some points, and the points add up to the progress bar on the main screen
// (100 points = 100%). Unlocked achievements are kept in the browser (localStorage), like the save slot.

import { play } from './engine/sound.js';

const KEY = 'beer-project-achievements';

export const STAGES = [
  { id: 'tzav-rishon', name: 'צו ראשון', done: 'tzav-done' },
  { id: 'yom-sayarot', name: 'יום סיירות', done: 'sayarot-done' },
  { id: 'gibbush-tayis', name: 'גיבוש טייס', done: 'gibbush-done' },
  { id: 'interview-week', name: 'שבוע ראיונות', done: 'interview-done' },
];

// group: which stage the achievement belongs to ('all' = the whole journey).
export const ACHIEVEMENTS = [
  { id: 'first-steps', group: 'all', icon: '👣', title: 'צעד ראשון', desc: 'נכנסת לשלב כלשהו במשחק.', points: 1 },
  { id: 'persistence', group: 'all', icon: '🔁', title: 'לא מוותרים', desc: 'שיחקת שלב שוב מההתחלה.', points: 1 },
  { id: 'reader', group: 'all', icon: '📌', title: 'קורא את הלוחות', desc: 'קראת את כל הכרזות של היחידות באולם ההמתנה בשבוע ראיונות.', points: 2 },
  { id: 'map-master', group: 'all', icon: '🗺️', title: 'נווט מצטיין', desc: 'סימנת ערים על המפה בחול בדיוק של 90% ומעלה (יום סיירות או גיבוש טייס).', points: 3 },
  { id: 'full-journey', group: 'all', icon: '🏁', title: 'מסע שלם', desc: 'סיימת את כל ארבעת השלבים.', points: 10 },

  { id: 'tzav-done', group: 'tzav-rishon', icon: '📋', title: 'יצאת מהלשכה', desc: 'סיימת את הצו הראשון וקיבלת את הנתונים.', points: 6 },
  { id: 'dapar-70', group: 'tzav-rishon', icon: '🧠', title: 'ראש חד', desc: 'דפ״ר 70 ומעלה.', points: 3 },
  { id: 'profile-97', group: 'tzav-rishon', icon: '💪', title: 'פרופיל מלא', desc: 'פרופיל 97 בצו הראשון.', points: 2 },

  { id: 'sayarot-done', group: 'yom-sayarot', icon: '🏜️', title: 'שרדת את הדיונה', desc: 'סיימת את יום סיירות וקיבלת תשובה.', points: 6 },
  { id: 'sayarot-run', group: 'yom-sayarot', icon: '⏱️', title: 'עמדת ברף', desc: 'עברת את ריצת הסף בניסיון הראשון.', points: 3 },
  { id: 'sayarot-steady', group: 'yom-sayarot', icon: '🔥', title: 'לא עוצרים', desc: 'המגבשים צעקו עליך פעמיים או פחות לאורך היום.', points: 3 },
  { id: 'sayarot-unit', group: 'yom-sayarot', icon: '🎖️', title: 'זימון ליחידה', desc: 'קיבלת זימון לגיבוש היחידה (סיירת מטכ״ל ושלד״ג).', points: 5 },
  { id: 'sayarot-team', group: 'yom-sayarot', icon: '🤝', title: 'שחקן צוות', desc: 'תיאום מעולה במשימות הצוות: מפה ופירמידת שקים.', points: 2 },

  { id: 'gibbush-done', group: 'gibbush-tayis', icon: '✈️', title: 'חמישה ימים בחצרים', desc: 'סיימת את גיבוש הטיס.', points: 6 },
  { id: 'gibbush-pass', group: 'gibbush-tayis', icon: '🥇', title: 'כנפיים', desc: 'עברת את גיבוש הטיס והוזמנת לקורס.', points: 8 },
  { id: 'gibbush-honest', group: 'gibbush-tayis', icon: '🗣️', title: 'כנות מלאה', desc: 'דיווחת על כלל ששברת, ולא הסתרת דבר שהמ״כים ראו.', points: 3 },
  { id: 'rack-team', group: 'gibbush-tayis', icon: '🦾', title: 'מתלה שזיפים', desc: 'הכיתה עמדה במתלה הקבוצתי בלי להתחיל מחדש.', points: 2 },
  { id: 'crawl-first', group: 'gibbush-tayis', icon: '🐍', title: 'זוחל ראשון', desc: 'הגעת ראשון באחד ממקצי הזחילה.', points: 2 },
  { id: 'badach-ace', group: 'gibbush-tayis', icon: '📘', title: 'בד״ח בעל פה', desc: 'עברת את כל מבחני הבד״ח בלי להתרסק.', points: 3 },
  { id: 'einstein', group: 'gibbush-tayis', icon: '🧩', title: 'איינשטיין', desc: 'פתרת את חידת איינשטיין בלי טעות.', points: 2 },
  { id: 'star', group: 'gibbush-tayis', icon: '⭐', title: 'זה כוכב', desc: 'עמדת מאחורי מה שראית, גם כשצעקו עליך.', points: 3 },

  { id: 'interview-done', group: 'interview-week', icon: '🗂️', title: 'יום בבקו״ם', desc: 'סיימת את שבוע הראיונות וקיבלת תשובה.', points: 6 },
  { id: 'interview-accepted', group: 'interview-week', icon: '✅', title: 'התקבלת', desc: 'שובצת ליחידה בעקבות הראיונות.', points: 6 },
  { id: 'interview-consistent', group: 'interview-week', icon: '🎯', title: 'עקבי כמו השאלון', desc: 'אף תשובה בראיון לא סתרה את הטופס האישי.', points: 3 },
  { id: 'interview-calm', group: 'interview-week', icon: '🧘', title: 'רגוע בהמתנה', desc: 'התנהגת יפה בכל שלושת הרגעים באולם ההמתנה.', points: 2 },
  { id: 'interview-heard', group: 'interview-week', icon: '🎧', title: 'האזנת לכולם', desc: 'שמעת את כל היחידות במצגת הזום.', points: 2 },
  { id: 'interview-strong', group: 'interview-week', icon: '🌟', title: 'רושם חזק', desc: 'כל שלוש היחידות התרשמו מאוד.', points: 3 },
  { id: 'interview-wide', group: 'interview-week', icon: '📊', title: 'דירוג רחב', desc: 'דירגת שש יחידות ומעלה בסקר.', points: 2 },
];

const BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
export const TOTAL_POINTS = ACHIEVEMENTS.reduce((sum, a) => sum + a.points, 0);

export const RANKS = [
  [0, 'מלש״ב מתחיל'],
  [10, 'מתגייס'],
  [25, 'טירון'],
  [40, 'חייל'],
  [55, 'סמל'],
  [70, 'מפקד כיתה'],
  [85, 'קצין'],
  [100, 'אגדה'],
];

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage can be blocked; the game still works.
  }
}

export const unlocked = () => read().done ?? {};

export function progress() {
  const done = unlocked();
  const ids = Object.keys(done).filter((id) => BY_ID[id]);
  const earned = ids.reduce((sum, id) => sum + BY_ID[id].points, 0);
  const percent = Math.round((earned / TOTAL_POINTS) * 100);
  const rank = [...RANKS].reverse().find(([from]) => percent >= from)[1];
  return { earned, percent, rank, count: ids.length, total: ACHIEVEMENTS.length, left: 100 - percent, points: TOTAL_POINTS };
}

/** Unlock an achievement. Does nothing if you already have it. Shows a pop-up unless `quiet`. */
export function unlock(id, { quiet = false } = {}) {
  const item = BY_ID[id];
  if (!item) return false;
  const data = read();
  data.done ??= {};
  if (data.done[id]) return false;
  data.done[id] = Date.now();
  write(data);
  if (!quiet) popup(item);
  // Finishing every stage is an achievement of its own.
  if (STAGES.every((s) => data.done[s.done])) unlock('full-journey', { quiet });
  return true;
}

/** Collect values in a set (e.g. posters you read); unlock when `needed` different ones were collected. */
export function mark(setName, value, needed, id) {
  const data = read();
  data.sets ??= {};
  const set = new Set(data.sets[setName] ?? []);
  set.add(value);
  data.sets[setName] = [...set];
  write(data);
  if (set.size >= needed) unlock(id);
}

/** Players who finished a stage before achievements existed get the matching ones, without pop-ups. */
export function syncFromResults() {
  let results = {};
  try {
    results = JSON.parse(localStorage.getItem('beer-project-results') ?? '{}');
  } catch {
    return;
  }
  for (const stage of STAGES) {
    if (results[stage.id]) unlock(stage.done, { quiet: true });
  }
  const tzav = results['tzav-rishon'];
  if (tzav) {
    if (tzav.dapar >= 70) unlock('dapar-70', { quiet: true });
    if (tzav.profile === 97) unlock('profile-97', { quiet: true });
  }
}

// ---------- The pop-up ("achievement unlocked") ----------

let queue = [];
let showing = false;

function popup(item) {
  queue.push(item);
  if (!showing) next();
}

function ensureStyle() {
  if (document.getElementById('achievement-style')) return;
  const style = document.createElement('style');
  style.id = 'achievement-style';
  style.textContent = `
    .ach-pop { position: fixed; top: 18px; left: 50%; z-index: 99999; display: flex; align-items: center; gap: 12px;
      min-width: min(340px, calc(100vw - 24px)); max-width: calc(100vw - 24px); padding: 10px 18px 10px 14px; border-radius: 14px;
      background: linear-gradient(135deg, #2b3216, #4b5320); color: #f1e8cf; direction: rtl; font-family: Heebo, system-ui, sans-serif;
      box-shadow: 0 10px 30px rgba(0,0,0,.45), inset 0 0 0 2px #f2c94c; pointer-events: none;
      transform: translate(-50%, -140%); opacity: 0; transition: transform .5s cubic-bezier(.2,1.2,.4,1), opacity .3s; }
    .ach-pop.on { transform: translate(-50%, 0); opacity: 1; }
    .ach-icon { flex: none; display: grid; place-items: center; width: 46px; height: 46px; border-radius: 50%;
      background: #f2c94c; font-size: 1.5rem; box-shadow: 0 0 0 4px rgba(242,201,76,.3); }
    .ach-text small { display: block; font-size: .7rem; font-weight: 800; letter-spacing: .05em; color: #f2c94c; }
    .ach-text strong { display: block; font-size: 1rem; }
    .ach-text span { display: block; font-size: .78rem; opacity: .85; }
    .ach-gain { direction: ltr; unicode-bidi: isolate; margin-inline-start: auto; font-weight: 800; color: #f2c94c; font-size: 1.05rem; white-space: nowrap; }
    @media (prefers-reduced-motion: reduce) { .ach-pop { transition: opacity .2s; } }
  `;
  document.head.append(style);
}

function next() {
  const item = queue.shift();
  if (!item) {
    showing = false;
    return;
  }
  showing = true;
  ensureStyle();
  const gain = ((item.points / TOTAL_POINTS) * 100).toFixed(item.points % 1 ? 1 : 0);
  const el = document.createElement('div');
  el.className = 'ach-pop';
  el.setAttribute('role', 'status');
  el.innerHTML = `<div class="ach-icon"></div><div class="ach-text"><small>הישג חדש!</small><strong></strong><span></span></div><div class="ach-gain"></div>`;
  el.querySelector('.ach-icon').textContent = item.icon;
  el.querySelector('strong').textContent = item.title;
  el.querySelector('span').textContent = item.desc;
  el.querySelector('.ach-gain').textContent = `+${gain}%`;
  document.body.append(el);
  play('achievement', { volume: 0.6 });
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
  setTimeout(() => el.classList.remove('on'), 3800);
  setTimeout(() => {
    el.remove();
    next();
  }, 4300);
}
