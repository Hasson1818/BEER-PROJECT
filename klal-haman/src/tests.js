import { showScreen, browserWindow, el, button, introCard, typeInto } from '../../pilot-path/shared/screens.js';
import { fx } from '../../pilot-path/shared/fx.js';
// The look of the test screens (mt-* classes) comes with the יום המא״ה tests.
import '../../yom-hamaa/src/tests.js';

// The computer tests of the כלל חמ״ן day. The kinds of sections come from prep sites and testimonies (pair
// comparison, number series, conclusions about a building's residents, analogies, an invented language for the
// language tracks). The items are made up by the game every time; the real ones were never published.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

function numberChoices(right, spread = 4) {
  const set = new Set([right]);
  for (let guard = 0; set.size < 4 && guard < 80; guard++) set.add(right + rand(-spread, spread));
  for (let k = 1; set.size < 4; k++) set.add(right + spread + k);
  return shuffle([...set]).map(String);
}

// ---------- 1. Pair comparison: are the two lines the same? ----------

const CHARS = 'אבגדהוזחטיכלמנסעפצקרשת0123456789';
function pairItem() {
  const len = rand(7, 10);
  const a = Array.from({ length: len }, () => pick([...CHARS])).join('');
  const same = Math.random() < 0.5;
  let b = a;
  if (!same) {
    const i = rand(0, len - 1);
    let c = pick([...CHARS]);
    while (c === a[i]) c = pick([...CHARS]);
    b = a.slice(0, i) + c + a.slice(i + 1);
  }
  const box = el('div', 'kh-pair');
  box.append(el('span', '', a), el('span', '', b));
  return { prompt: [box, el('p', 'mt-q', 'השורות זהות?')], choices: ['זהות', 'שונות'], answer: same ? 'זהות' : 'שונות', keepOrder: true, big: true };
}

// ---------- 2. Number series ----------

function seriesItem() {
  const kind = rand(0, 3);
  let seq;
  if (kind === 0) {
    const a = rand(1, 20);
    const d = rand(2, 9) * pick([1, -1]);
    seq = Array.from({ length: 6 }, (_, i) => a + d * i + (d < 0 ? 60 : 0));
  } else if (kind === 1) {
    const a = rand(1, 4);
    const r = pick([2, 3]);
    seq = Array.from({ length: 6 }, (_, i) => a * r ** i);
  } else if (kind === 2) {
    // The differences grow by one.
    const a = rand(1, 10);
    const d = rand(1, 4);
    seq = [a];
    for (let i = 1; i < 6; i++) seq.push(seq[i - 1] + d + i - 1);
  } else {
    // Two interleaved series.
    const a = rand(1, 9);
    const b = rand(20, 40);
    const da = rand(2, 5);
    const db = rand(1, 4);
    seq = Array.from({ length: 6 }, (_, i) => (i % 2 === 0 ? a + da * (i / 2) : b - db * ((i - 1) / 2)));
  }
  const answer = seq[5];
  const row = el('div', 'kh-series');
  for (const v of seq.slice(0, 5)) row.append(el('span', '', String(v)));
  row.append(el('span', 'q', '?'));
  return { prompt: [row, el('p', 'mt-q', 'מה המספר הבא בסדרה?')], choices: numberChoices(answer, kind === 1 ? Math.max(4, Math.round(answer / 4)) : 4), answer: String(answer) };
}

// ---------- 3. Conclusions: who lives on which floor ----------

const RESIDENTS = ['דנה', 'יוסי', 'מאיה', 'רון'];

function permutations(list) {
  if (list.length <= 1) return [list];
  return list.flatMap((x, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map((p) => [x, ...p]));
}

function buildingItem() {
  // floors[name] = 1..4
  const order = shuffle(RESIDENTS);
  const floors = Object.fromEntries(order.map((name, i) => [name, i + 1]));
  const all = permutations([1, 2, 3, 4]).map((p) => Object.fromEntries(RESIDENTS.map((n, i) => [n, p[i]])));
  const makeClue = () => {
    const [x, y] = shuffle(RESIDENTS);
    const kind = rand(0, 3);
    if (kind === 0) return floors[x] > floors[y] ? { text: `${x} גר/ה מעל ${y}.`, test: (f) => f[x] > f[y] } : { text: `${x} גר/ה מתחת ל${y}.`, test: (f) => f[x] < f[y] };
    if (kind === 1) {
      const wrong = pick([1, 2, 3, 4].filter((n) => n !== floors[x]));
      return { text: `${x} לא גר/ה בקומה ${wrong}.`, test: (f) => f[x] !== wrong };
    }
    if (kind === 2) return Math.abs(floors[x] - floors[y]) === 1 ? { text: `${x} ו${y} שכנים בקומות צמודות.`, test: (f) => Math.abs(f[x] - f[y]) === 1 } : { text: `בין ${x} ל${y} יש לפחות קומה אחת.`, test: (f) => Math.abs(f[x] - f[y]) > 1 };
    return { text: `${x} גר/ה בקומה ${floors[x] % 2 === 0 ? 'זוגית' : 'אי־זוגית'}.`, test: (f) => f[x] % 2 === floors[x] % 2 };
  };
  const clues = [];
  let left = all;
  const askAbout = pick(RESIDENTS);
  for (let guard = 0; guard < 40; guard++) {
    const options = new Set(left.map((f) => f[askAbout]));
    if (options.size === 1) break;
    const clue = makeClue();
    const next = left.filter(clue.test);
    if (next.length === left.length || clues.some((c) => c.text === clue.text)) continue;
    clues.push(clue);
    left = next;
  }
  const list = el('ul', 'kh-clues');
  for (const c of clues) list.append(el('li', '', c.text));
  const head = el('p', 'kh-note', 'בבניין ארבע קומות, ובכל קומה גר/ה אחד/ת מהם.');
  return {
    prompt: [head, list, el('p', 'mt-q', `באיזו קומה גר/ה ${askAbout}?`)],
    choices: ['1', '2', '3', '4'],
    answer: String(floors[askAbout]),
    keepOrder: true,
    big: true,
  };
}

// ---------- 4. Analogies ----------

const ANALOGIES = [
  { a: 'רופא', b: 'בית חולים', c: 'מורה', right: 'בית ספר', wrong: ['תלמיד', 'לוח', 'שיעור'] },
  { a: 'ציפור', b: 'להקה', c: 'זאב', right: 'עדר', wrong: ['יער', 'יילל', 'גור'] },
  { a: 'מפתח', b: 'מנעול', c: 'סיסמה', right: 'חשבון', wrong: ['מקלדת', 'סוד', 'אות'] },
  { a: 'סופר', b: 'עט', c: 'צלם', right: 'מצלמה', wrong: ['תמונה', 'אלבום', 'חתונה'] },
  { a: 'צמא', b: 'מים', c: 'עייפות', right: 'שינה', wrong: ['מיטה', 'לילה', 'פיהוק'] },
  { a: 'מפה', b: 'שטח', c: 'תוכנית', right: 'בניין', wrong: ['אדריכל', 'נייר', 'קיר'] },
  { a: 'שעון', b: 'זמן', c: 'מדחום', right: 'טמפרטורה', wrong: ['חום', 'קיץ', 'מעלות'] },
  { a: 'דף', b: 'ספר', c: 'לבנה', right: 'קיר', wrong: ['אדום', 'חול', 'פועל'] },
];

function analogyItem() {
  const it = pick(ANALOGIES);
  const row = el('div', 'kh-analogy');
  row.append(el('span', '', `${it.a} : ${it.b}`), el('b', '', '='), el('span', '', `${it.c} : ?`));
  return { prompt: [row, el('p', 'mt-q', 'מה משלים את היחס?')], choices: shuffle([it.right, ...it.wrong]), answer: it.right };
}

// ---------- 5. An invented language (language tracks) ----------

// The game's own little language. Word order: verb, subject, object. Plural: the prefix "או". Past: the suffix
// "ת" on the verb. "נה" before the verb: not.
export const LANG = {
  nouns: [
    { he: 'ילד', pl: 'ילדים', w: 'זאקי' },
    { he: 'כלב', pl: 'כלבים', w: 'מורל' },
    { he: 'חייל', pl: 'חיילים', w: 'פנדו' },
    { he: 'ציפור', pl: 'ציפורים', w: 'טילה' },
  ],
  verbs: [
    { w: 'סבו', now: ['רואה', 'רואים'], past: ['ראה', 'ראו'], notNow: ['לא רואה', 'לא רואים'], notPast: ['לא ראה', 'לא ראו'] },
    { w: 'לימו', now: ['מוצא', 'מוצאים'], past: ['מצא', 'מצאו'], notNow: ['לא מוצא', 'לא מוצאים'], notPast: ['לא מצא', 'לא מצאו'] },
    { w: 'גרש', now: ['שומע', 'שומעים'], past: ['שמע', 'שמעו'], notNow: ['לא שומע', 'לא שומעים'], notPast: ['לא שמע', 'לא שמעו'] },
  ],
  rules: [
    'סדר המילים: פועל, ואחריו מי שעושה, ואחריו את מי.',
    'רבים: מוסיפים "או" בתחילת שם העצם (זאקי → אוזאקי).',
    'עבר: מוסיפים "ת" בסוף הפועל (סבו → סבות).',
    'שלילה: "נה" לפני הפועל.',
  ],
};

function sentence({ verb, subj, obj, subjPl, objPl, past, neg }) {
  const v = `${neg ? 'נה ' : ''}${verb.w}${past ? 'ת' : ''}`;
  const s = `${subjPl ? 'או' : ''}${subj.w}`;
  const o = `${objPl ? 'או' : ''}${obj.w}`;
  return `${v} ${s} ${o}`;
}
function hebrew({ verb, subj, obj, subjPl, objPl, past, neg }) {
  const form = neg ? (past ? verb.notPast : verb.notNow) : past ? verb.past : verb.now;
  return `ה${subjPl ? subj.pl : subj.he} ${form[subjPl ? 1 : 0]} את ה${objPl ? obj.pl : obj.he}`;
}

function languageItem() {
  const [subj, obj] = shuffle(LANG.nouns);
  const base = { verb: pick(LANG.verbs), subj, obj, subjPl: Math.random() < 0.5, objPl: Math.random() < 0.4, past: Math.random() < 0.5, neg: Math.random() < 0.3 };
  const variants = [
    { ...base, subjPl: !base.subjPl },
    { ...base, past: !base.past },
    { ...base, subj: base.obj, obj: base.subj, subjPl: base.objPl, objPl: base.subjPl },
    { ...base, neg: !base.neg },
    { ...base, objPl: !base.objPl },
  ];
  const toLang = Math.random() < 0.5;
  const render = toLang ? sentence : hebrew;
  const right = render(base);
  const wrong = [...new Set(shuffle(variants).map(render))].filter((t) => t !== right).slice(0, 3);
  const sheet = el('div', 'kh-sheet');
  sheet.append(el('b', '', 'דף החוקים'));
  const vocab = el('p', '', [...LANG.nouns.map((n) => `${n.w} = ${n.he}`), ...LANG.verbs.map((v) => `${v.w} = ${v.now[0]}`)].join(' · '));
  const rules = el('ol', '');
  for (const r of LANG.rules) rules.append(el('li', '', r));
  sheet.append(vocab, rules);
  const q = toLang ? `איך אומרים בשפה: "${hebrew(base)}"?` : `מה פירוש המשפט: "${sentence(base)}"?`;
  return { prompt: [sheet, el('p', 'mt-q', q)], choices: shuffle([right, ...wrong]), answer: right };
}

export const MODULES = [
  { id: 'pairs', title: 'השוואת זוגות', intro: ['שתי שורות של אותיות ומספרים. זהות או שונות?', 'מהר: הרבה שאלות בזמן קצר.'], make: pairItem, count: 10, seconds: 45 },
  { id: 'series', title: 'סדרות מספרים', intro: ['מוצאים את החוק של הסדרה ובוחרים את המספר הבא.'], make: seriesItem, count: 6, seconds: 90 },
  { id: 'building', title: 'הסקת מסקנות', intro: ['ארבעה דיירים בבניין של ארבע קומות. לפי הרמזים: מי גר איפה?'], make: buildingItem, count: 4, seconds: 120 },
  { id: 'analogy', title: 'אנלוגיות', intro: ['א׳ קשור לב׳ כמו שג׳ קשור ל…?'], make: analogyItem, count: 5, seconds: 60 },
  {
    id: 'language',
    title: 'שפה מומצאת',
    intro: ['לפי אתרי הכנה: מבחן למסלולי השפות. מקבלים דף חוקים של שפה שלא קיימת, ומתרגמים.', 'הדף מופיע מעל כל שאלה. השפה עצמה הומצאה בשביל המשחק.'],
    make: languageItem,
    count: 5,
    seconds: 150,
  },
];

/** One module against the clock. Resolves to { score, answered, total }. */
function runModule(stage, mod, { count, seconds, practice }) {
  return new Promise((resolve) => {
    let i = 0;
    let right = 0;
    let answered = 0;
    let left = seconds;
    const head = el('div', 'mt-head');
    const progress = el('span', '', '');
    const clock = el('span', 'mt-clock', '');
    head.append(el('b', '', practice ? `${mod.title} · תרגול` : mod.title), progress, clock);
    const body = el('div', 'mt-item');
    stage.append(head, body);
    let done = false;
    let buttons = [];
    const onKey = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= buttons.length) buttons[n - 1].click();
    };
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(timer);
      document.removeEventListener('keydown', onKey);
      resolve({ score: right / count, answered, total: count });
    };
    const timer = setInterval(() => {
      left--;
      clock.textContent = `${Math.max(0, left)} שנ׳`;
      clock.classList.toggle('low', left <= 10);
      if (left <= 0) finish();
    }, 1000);
    clock.textContent = `${left} שנ׳`;
    document.addEventListener('keydown', onKey);
    const show = () => {
      if (i >= count) return finish();
      progress.textContent = `שאלה ${i + 1} מתוך ${count}`;
      const item = mod.make();
      if (import.meta.env.DEV) window.__khAnswer = item.answer; // for the test bot
      body.innerHTML = '';
      body.append(...item.prompt);
      const grid = el('div', `mt-choices${item.big ? ' big' : ''}`);
      buttons = item.choices.map((text, k) => {
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
            }, 1100);
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
 * The online test day in a browser window: log in, the explanation part, then the modules. `withLanguage` adds the
 * invented-language test. Resolves to { results: {id: {score, answered, total}}, practiced }.
 */
export function runTests(game, { withLanguage = true } = {}) {
  const list = MODULES.filter((m) => withLanguage || m.id !== 'language');
  return showScreen(game, 'mt-screen', async (root, close) => {
    const { body } = browserWindow(root, 'https://sorting.intelligence.idf.il/klal-haman');
    const page = el('div', 'mt-login');
    page.append(el('div', 'mt-logo kh-logo', 'חמ״ן'), el('h1', 'pp-title', 'מיון כלל חמ״ן · מקוון'), el('p', 'pp-sub', 'יש להישאר מול המצלמה לאורך כל המיון'));
    const idOut = el('output', 'mt-input');
    page.append(el('p', 'pp-sub', 'תעודת זהות'), idOut);
    const go = button('כניסה');
    go.disabled = true;
    page.append(go);
    body.append(page);
    await wait(400);
    await typeInto(idOut, '3290 …', { speed: 80, fx });
    go.disabled = false;
    go.focus();
    await new Promise((r) => go.addEventListener('click', () => (fx.click(), r())));

    // The explanation part (official: the day opens with it).
    body.innerHTML = '';
    const brief = el('div', 'mt-login kh-brief');
    brief.append(el('div', 'mt-logo kh-logo', '▶'), el('h2', 'pp-title', 'חלק ההסברה'));
    const lines = el('div', 'kh-brief-lines');
    brief.append(lines);
    body.append(brief);
    for (const line of [
      'קצינת מיון מחיל המודיעין: "בוקר טוב לכולם. היום אתם ממוינים למסלולי כלל חמ״ן."',
      '"המבחנים ארוכים, ולא כולם מסיימים. זה בסדר. אם נתקעתם בשאלה, תמשיכו הלאה."',
      '"אל תספרו לאף אחד על התוכן של המבחנים. גם זה חלק מהעבודה אצלנו."',
    ]) {
      const p = el('p', '', '');
      lines.append(p);
      await typeInto(p, line, { speed: 18, fx });
      await wait(600);
    }
    const ok = button('הבנתי, להתחיל');
    brief.append(ok);
    await new Promise((r) => ok.addEventListener('click', () => (fx.click(), r())));

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
          note: 'השאלות נכתבו בשביל המשחק, לפי סוגי השאלות שאתרי הכנה ועדויות מתארים. במציאות המבחנים נמשכים שעות.',
        });
        holder.innerHTML = '';
        const stage = el('div', 'mt-stage');
        holder.append(stage);
        if (choice === 'practice') {
          practiced++;
          await runModule(stage, mod, { count: 2, seconds: 90, practice: true });
          continue;
        }
        results[mod.id] = await runModule(stage, mod, { count: mod.count, seconds: mod.seconds, practice: false });
        fx.done();
        break;
      }
    }
    body.innerHTML = '';
    const end = el('div', 'mt-login');
    end.append(el('div', 'mt-logo good', '✓'), el('h2', 'pp-title', 'המבחנים נשלחו'), el('p', 'pp-sub', 'עכשיו השאלון האישי. בלי זמן לכל השאלון, אבל עם זמן לכל היגד.'));
    body.append(end);
    await wait(1800);
    close({ results, practiced });
  });
}
