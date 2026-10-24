// Psychotechnic tests of the IAF aeromedical day (ירפ״א א׳), in a compressed practice form.
// Three tests - quantitative/physical thinking, the cube, and the aircraft in space (the view from the cockpit).
// The descriptions come from preparation sites, NOT from official material, and every question is generated
// on the spot by this file: no real exam item is copied. Everything is drawn with canvas 2D / plain HTML.
//
//   runPsychotech(id, container, { count, seconds, practice, fx, onProgress }) -> Promise<result>

import { tone } from './fx.js';

export const PSYCHOTECH_TESTS = [
  {
    id: 'quant',
    title: 'חשיבה כמותית / פיזיקלית',
    intro: [
      'לפי אתרי הכנה (לא מידע רשמי): כ־30 שאלות ב־30 דקות, ולכל שאלה 5 תשובות.',
      'שאלות מילוליות על תנועה, אחוזים, שברים, קצב עבודה, הספק, שטחים, גלגלי שיניים וטבלאות. בלי מחשבון.',
      'אין ניקוד שלילי על טעות, ולכן תמיד עדיף לסמן תשובה במקום להשאיר ריק. אם נשארו שניות - נחשו.',
      'כאן השאלות נוצרות במשחק בלבד, והן לא שאלות אמיתיות.',
    ],
    realCount: 30,
    realMinutes: 30,
    penalty: false,
  },
  {
    id: 'cube',
    title: 'קובייה',
    intro: [
      'לפי אתרי הכנה (לא מידע רשמי): כ־30 שאלות ב־30 דקות, ולכל שאלה 6 תשובות.',
      'נקודות נעות לאורך הקצוות של קובייה תלת־ממדית, והשאלה היא אם ומתי הן נפגשות. מספרים אותו כמבחן הקשה והמתסכל ביותר.',
      'יש ניקוד שלילי על טעות. אם אתם לא בטוחים - עדיף לדלג מאשר לנחש.',
      'כאן הקובייה נוצרת במשחק בלבד, והשאלות לא אמיתיות.',
    ],
    realCount: 30,
    realMinutes: 30,
    penalty: true,
  },
  {
    id: 'plane',
    title: 'מטוס במרחב - נוף מתא הטייס',
    intro: [
      'לפי אתרי הכנה (לא מידע רשמי): כ־30 שאלות ב־25 דקות, ולכל שאלה 5 תשובות.',
      'רואים את האופק מתוך תא הטייס (נטייה קדימה־אחורה וגלגול הצידה), ובוחרים איזו תמונת מטוס מבחוץ מתאימה: עולה, צולל, מוטה ימינה או שמאלה, הפוך.',
      'אין ניקוד שלילי על טעות, ולכן שווה לסמן תשובה בכל שאלה.',
      'כאן התמונות נוצרות במשחק בלבד, והשאלות לא אמיתיות.',
    ],
    realCount: 30,
    realMinutes: 25,
    penalty: false,
  },
];

/* ============================================================================================
   Small helpers
   ============================================================================================ */

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sign = () => (Math.random() < 0.5 ? -1 : 1);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rad = (d) => (d * Math.PI) / 180;
const smooth = (x) => x * x * (3 - 2 * x);
function shuffle(a) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Numbers inside Hebrew text must not jump around, so they live in a left-to-right isolate.
const LRI = '⁦';
const PDI = '⁩';
const iso = (s) => LRI + s + PDI;
const fmt = (x) => String(Math.round(x * 100) / 100);
const N = (x) => iso(fmt(x));
const NP = (x) => iso(fmt(x) + '%');
const NC = (x) => iso(fmt(x) + ' ש״ח');

/** Numeric options, always sorted from small to large like a real exam. */
function numOptions(correct, wrongs, { f = N, n = 5, min = 0.0001, int = false } = {}) {
  const seen = new Set([fmt(correct)]);
  const out = [];
  for (const w of wrongs) {
    if (!Number.isFinite(w) || w < min) continue;
    const k = fmt(w);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(w);
    if (out.length === n - 1) break;
  }
  let guard = 0;
  while (out.length < n - 1 && guard++ < 200) {
    const base = Math.max(int ? 1 : 0.5, Math.abs(correct) * 0.12);
    let w = correct + sign() * base * rnd(1, 7);
    if (int) w = Math.round(w);
    if (w < min) continue;
    const k = fmt(w);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(w);
  }
  const all = [correct, ...out].sort((a, b) => a - b);
  return { options: all.map((x) => f(x)), correct: all.indexOf(correct) };
}

/** Text options in a random order. */
function strOptions(correct, wrongs, n = 5) {
  const seen = new Set([correct]);
  const out = [];
  for (const w of shuffle(wrongs)) {
    if (seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length === n - 1) break;
  }
  const all = shuffle([correct, ...out]);
  return { options: all, correct: all.indexOf(correct) };
}

/* ============================================================================================
   QUANT - question templates
   ============================================================================================ */

const HE_FRAC = { 2: 'חצי', 3: 'שליש', 4: 'רבע', 5: 'חמישית' };

function qMeet() {
  const S = pick([80, 100, 120, 140, 160]);
  const v1 = 10 * rnd(3, S / 10 - 3);
  const v2 = S - v1;
  const t = 3 * rnd(5, 30);
  const d = (S * t) / 60;
  const { options, correct } = numOptions(
    t,
    [Math.abs(v1 - v2) ? (d / Math.abs(v1 - v2)) * 60 : t * 2, t * 2, t / 2, (d / Math.max(v1, v2)) * 60, (d / Math.min(v1, v2)) * 60, t + 15, t - 15],
    { f: (x) => `${N(x)} דק׳` },
  );
  return {
    quant: 'meet',
    html: `שתי עיירות נמצאות במרחק ${N(d)} ק״מ זו מזו. באותו רגע יוצאות שתי מכוניות זו לקראת זו: האחת במהירות ${N(v1)} קמ״ש והשנייה במהירות ${N(v2)} קמ״ש. אחרי כמה דקות הן ייפגשו?`,
    diagram: { kind: 'meet', d, v1, v2 },
    options,
    correct,
    explain: `כשנעים זה לקראת זה, המהירויות מצטרפות: ${N(v1)} + ${N(v2)} = ${N(S)} קמ״ש. זמן = מרחק ÷ מהירות = ${N(d)} ÷ ${N(S)} שעות = ${N(t)} דקות.`,
  };
}

function qChase() {
  const diff = pick([10, 20, 30]);
  const v1 = diff * rnd(2, 5);
  const v2 = v1 + diff;
  const h = rnd(1, 3);
  const t = (v1 * h) / diff;
  const { options, correct } = numOptions(t, [t + h, (v1 * h) / v2, (v1 * h) / (v1 + v2), h * 2, t * 2, t - 1, diff], {
    f: (x) => `${N(x)} שעות`,
  });
  return {
    quant: 'chase',
    html: `אופניים יוצאים לדרך במהירות ${N(v1)} קמ״ש. ${N(h)} ${h === 1 ? 'שעה' : 'שעות'} אחריהם יוצא באותו כיוון אופנוע במהירות ${N(v2)} קמ״ש. כמה שעות אחרי יציאת האופנוע הוא ישיג את האופניים?`,
    diagram: { kind: 'chase', v1, v2, h },
    options,
    correct,
    explain: `לאופניים יש יתרון של ${N(v1)} × ${N(h)} = ${N(v1 * h)} ק״מ. האופנוע מקצר ${N(diff)} ק״מ בכל שעה (${N(v2)} − ${N(v1)}). לכן ${N(v1 * h)} ÷ ${N(diff)} = ${N(t)} שעות.`,
  };
}

function qPercent(easy) {
  if (!easy && Math.random() < 0.4) {
    const a = pick([10, 20, 30, 40, 50]);
    const net = (a * a) / 100;
    const correctText = `נמוך ב־${NP(net)} מהמחיר המקורי`;
    const wrongs = [
      'זהה למחיר המקורי',
      `גבוה ב־${NP(net)} מהמחיר המקורי`,
      `נמוך ב־${NP(a)} מהמחיר המקורי`,
      `נמוך ב־${NP(a / 2)} מהמחיר המקורי`,
      `גבוה ב־${NP(a)} מהמחיר המקורי`,
      `נמוך ב־${NP(net * 2)} מהמחיר המקורי`,
    ];
    const { options, correct } = strOptions(correctText, wrongs);
    return {
      quant: 'percent',
      html: `מחיר של מוצר עלה ב־${NP(a)}, ולאחר מכן ירד ב־${NP(a)} מהמחיר החדש. המחיר הסופי של המוצר:`,
      options,
      correct,
      explain: `אם המחיר המקורי הוא 100: אחרי העלייה ${N(100 + a)}, ואחרי הירידה ${N(100 + a)} × ${N(1 - a / 100)} = ${N(100 - net)}. הוא נמוך ב־${NP(net)}.`,
    };
  }
  for (let guard = 0; guard < 100; guard++) {
    const p = pick([200, 400, 500, 800, 1000]);
    const a = pick([10, 20, 25, 50]);
    const b = pick([10, 20, 25, 50]);
    const f = p * (1 + a / 100) * (1 - b / 100);
    if (Math.abs(f * 2 - Math.round(f * 2)) > 1e-9) continue;
    const { options, correct } = numOptions(f, [p * (1 + (a - b) / 100), p * (1 + a / 100) - b, p * (1 + a / 100), p * (1 - b / 100), p * (1 + a / 100) * (1 + b / 100)], {
      f: NC,
    });
    return {
      quant: 'percent',
      html: `מחירו של מוצר הוא ${NC(p)}. תחילה המחיר הועלה ב־${NP(a)}, ואחר כך המחיר החדש הוזל ב־${NP(b)}. מהו המחיר הסופי?`,
      options,
      correct,
      explain: `אחרי העלייה: ${N(p)} × ${N(1 + a / 100)} = ${N(p * (1 + a / 100))}. אחרי ההוזלה: ${N(p * (1 + a / 100))} × ${N(1 - b / 100)} = ${N(f)}. אי אפשר פשוט לחסר את האחוזים - ההוזלה חלה על מחיר גדול יותר.`,
    };
  }
  return qMeet();
}

const WORK_TRIPLES = [
  [6, 3, 2], [12, 6, 4], [10, 15, 6], [20, 30, 12], [12, 4, 3], [24, 12, 8], [12, 12, 6], [8, 24, 6], [10, 40, 8], [15, 30, 10], [20, 5, 4], [40, 10, 8], [6, 12, 4], [30, 20, 12],
];
const WORK_STORIES = [
  { a: 'ברז ' + iso('A'), b: 'ברז ' + iso('B'), job: 'ממלא בריכה', unit: 'שעות', what: 'למילוי הבריכה' },
  { a: 'דנה', b: 'רון', job: 'צובעים חדר', unit: 'שעות', what: 'לצביעת החדר' },
  { a: 'מכונה ' + iso('A'), b: 'מכונה ' + iso('B'), job: 'מדפיסה את כל הסדרה', unit: 'שעות', what: 'להדפסת הסדרה כולה' },
  { a: 'נועה', b: 'איתי', job: 'מארזים משלוח', unit: 'ימים', what: 'לאריזת המשלוח' },
];
function qWork(easy) {
  const s = pick(WORK_STORIES);
  const verb = s.job;
  if (easy || Math.random() < 0.55) {
    let [x, y, t] = pick(WORK_TRIPLES);
    if (Math.random() < 0.5) [x, y] = [y, x];
    const { options, correct } = numOptions(t, [(x + y) / 2, x + y, Math.min(x, y) / 2, Math.abs(x - y), Math.min(x, y), t + 1, t * 2], { f: (v) => `${N(v)} ${s.unit}` });
    return {
      quant: 'work',
      html: `${s.a} לבד ${verb} ב־${N(x)} ${s.unit}, ו${s.b} לבד ${verb} ב־${N(y)} ${s.unit}. כמה ${s.unit} יידרשו להם ${s.what} אם יעבדו יחד, באותו קצב?`,
      options,
      correct,
      explain: `בכל יחידת זמן הם עושים ${iso('1/' + x)} + ${iso('1/' + y)} = ${iso((x + y) + '/' + x * y)} מהעבודה. הזמן הוא ההופכי: ${N(x * y)} ÷ ${N(x + y)} = ${N(t)} ${s.unit}.`,
    };
  }
  // together + one alone -> the other alone
  const [x0, y0, t] = pick(WORK_TRIPLES.filter((r) => r[0] !== r[1]));
  const [x, y] = Math.random() < 0.5 ? [x0, y0] : [y0, x0];
  const { options, correct } = numOptions(y, [x - t, x + t, t, (x + t) / 2, x * t / (x + t), y + 2, y * 2], { f: (v) => `${N(v)} ${s.unit}` });
  return {
    quant: 'work',
    html: `${s.a} לבד ${verb} ב־${N(x)} ${s.unit}. כששניהם עובדים יחד, ${s.what} נמשך ${N(t)} ${s.unit}. כמה ${s.unit} ייקח ל${s.b} לבד?`,
    options,
    correct,
    explain: `קצב משותף: ${iso('1/' + t)}. קצב של ${s.a}: ${iso('1/' + x)}. קצב של ${s.b}: ${iso('1/' + t)} − ${iso('1/' + x)} = ${iso('1/' + y)}. לכן ${N(y)} ${s.unit}.`,
  };
}

function qFraction() {
  const p = pick([2, 3, 4, 5]);
  const q = pick([2, 3, 4, 5]);
  const n = p * q * rnd(1, 3) * (p * q <= 6 ? 2 : 1);
  const first = n / p;
  const rest = n - first;
  const second = rest / q;
  const ans = rest - second;
  const { options, correct } = numOptions(ans, [n - first - n / q, first + n / q, rest, second, first, n - first - second - 1], { int: true });
  return {
    quant: 'fraction',
    html: `בכיתה ${N(n)} תלמידים. ${HE_FRAC[p]} מהם לומדים נגינה. מבין התלמידים שנשארו, ${HE_FRAC[q]} לומדים ציור. כמה תלמידים אינם לומדים לא נגינה ולא ציור?`,
    options,
    correct,
    explain: `נגינה: ${N(n)} ÷ ${N(p)} = ${N(first)}. נשארו ${N(rest)}. ציור: ${N(rest)} ÷ ${N(q)} = ${N(second)}. לא לומדים כלום: ${N(rest)} − ${N(second)} = ${N(ans)}. ה${HE_FRAC[q]} חל רק על מי שנשאר, לא על כל הכיתה.`,
  };
}

const GEAR_PAIRS = [[12, 36], [36, 12], [20, 30], [30, 20], [24, 16], [16, 24], [40, 10], [10, 40], [18, 27], [27, 18], [15, 45], [45, 15]];
function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}
function qGears(easy) {
  if (easy || Math.random() < 0.5) {
    const [a, b] = pick(GEAR_PAIRS);
    const g = gcd(a, b);
    const r = (b / g) * rnd(1, 3);
    const ans = (r * a) / b;
    const { options, correct } = numOptions(ans, [(r * b) / a, r, r + (b - a) / g, r * 2, ans + 2, Math.abs(r - ans)], { f: (x) => `${N(x)} סיבובים` });
    return {
      quant: 'gears',
      html: `גלגל שיניים ${iso('A')} בעל ${N(a)} שיניים מסובב גלגל שיניים ${iso('B')} בעל ${N(b)} שיניים. גלגל ${iso('A')} מבצע ${N(r)} סיבובים שלמים. כמה סיבובים מבצע גלגל ${iso('B')}?`,
      diagram: { kind: 'gears', teeth: [a, b], names: ['A', 'B'] },
      options,
      correct,
      explain: `מספר השיניים שעוברות זהה בשני הגלגלים: ${N(r)} × ${N(a)} = ${N(r * a)} שיניים. גלגל ${iso('B')} בעל ${N(b)} שיניים, לכן ${N(r * a)} ÷ ${N(b)} = ${N(ans)} סיבובים. הגלגל הקטן יותר מסתובב יותר.`,
    };
  }
  const [a, c] = pick(GEAR_PAIRS);
  const b = pick([14, 18, 22, 26, 30, 36].filter((v) => v !== a && v !== c));
  const g = gcd(a, c);
  const r = (c / g) * rnd(1, 3);
  const ans = (r * a) / c;
  const { options, correct } = numOptions(ans, [(r * c) / a, (r * a) / b, (r * b) / c, r, ans + 2, r * 2], { f: (x) => `${N(x)} סיבובים` });
  return {
    quant: 'gears',
    html: `שלושה גלגלי שיניים מחוברים בשורה: ${iso('A')} בעל ${N(a)} שיניים מסובב את ${iso('B')} בעל ${N(b)} שיניים, וזה מסובב את ${iso('C')} בעל ${N(c)} שיניים. גלגל ${iso('A')} מבצע ${N(r)} סיבובים. כמה סיבובים מבצע גלגל ${iso('C')}?`,
    diagram: { kind: 'gears', teeth: [a, b, c], names: ['A', 'B', 'C'] },
    options,
    correct,
    explain: `גלגל האמצע רק מעביר את התנועה ולא משנה את מספר השיניים שעוברות: ${N(r)} × ${N(a)} = ${N(r * a)} שיניים. ב־${iso('C')} יש ${N(c)} שיניים, לכן ${N(r * a)} ÷ ${N(c)} = ${N(ans)} סיבובים.`,
  };
}

function qRect() {
  if (Math.random() < 0.3) {
    const k = pick([2, 3, 4, 5]);
    const { options, correct } = numOptions(k * k, [k, 2 * k, k * k + k, k * k - 1, k * k * k, 4 * k], { f: (x) => `פי ${N(x)}`, int: true });
    return {
      quant: 'rect',
      html: `כל צלעות ריבוע הוגדלו פי ${N(k)}. פי כמה גדל שטח הריבוע?`,
      options,
      correct,
      explain: `שטח ריבוע הוא צלע × צלע. אם הצלע גדלה פי ${N(k)}, השטח גדל פי ${N(k)} × ${N(k)} = ${N(k * k)}. גם ההיקף גדל פי ${N(k)}, אבל השטח גדל בריבוע.`,
    };
  }
  for (let guard = 0; guard < 200; guard++) {
    const l = pick([10, 20, 25, 30, 40, 50]);
    const w = pick([10, 20, 30, 40, 50]);
    const inc = pick([20, 50, 100]);
    const dec = pick([10, 20, 25, 50]);
    const nl = (l * (100 + inc)) / 100;
    const nw = (w * (100 - dec)) / 100;
    if (!Number.isInteger(nl) || !Number.isInteger(nw)) continue;
    const area = nl * nw;
    const { options, correct } = numOptions(area, [l * w, nl * w, l * nw, (l * w * (100 + inc - dec)) / 100, (l + inc) * (w - dec), area + l * 2], {
      f: (x) => `${N(x)} סמ״ר`,
    });
    return {
      quant: 'rect',
      html: `במלבן אורכו ${N(l)} ס״מ ורוחבו ${N(w)} ס״מ. האורך הוגדל ב־${NP(inc)} והרוחב הוקטן ב־${NP(dec)}. מהו שטח המלבן החדש?`,
      diagram: { kind: 'rect', l, w, nl, nw, inc, dec },
      options,
      correct,
      explain: `אורך חדש: ${N(l)} × ${N(1 + inc / 100)} = ${N(nl)}. רוחב חדש: ${N(w)} × ${N(1 - dec / 100)} = ${N(nw)}. שטח: ${N(nl)} × ${N(nw)} = ${N(area)} סמ״ר.`,
    };
  }
  return qMeet();
}

function qPower() {
  if (Math.random() < 0.55) {
    for (let guard = 0; guard < 200; guard++) {
      const m = pick([50, 100, 150, 200, 250, 300, 400, 500]);
      const h = pick([2, 3, 4, 5, 6, 8, 10]);
      const t = pick([2, 4, 5, 10, 20]);
      const P = (m * 10 * h) / t;
      if (!Number.isInteger(P) || P > 10000) continue;
      const { options, correct } = numOptions(P, [(m * h) / t, m * 10 * h * t, (m * 10 * t) / h, P * 2, P / 2, (m * h * t) / 10], { f: (x) => `${N(x)} וואט`, int: true });
      return {
        quant: 'power',
        html: `מנוף מרים משא של ${N(m)} ק״ג לגובה ${N(h)} מטרים בתוך ${N(t)} שניות, בקצב קבוע. נתון: כל ק״ג נמשך כלפי מטה בכוח של ${N(10)} ניוטון. מהו ההספק שמפעיל המנוף (בוואט)?`,
        diagram: { kind: 'lift', m, h, t },
        options,
        correct,
        explain: `אנרגיה (עבודה) = משקל × גובה = ${N(m)} × ${N(10)} × ${N(h)} = ${N(m * 10 * h)} ג׳אול. הספק = אנרגיה ÷ זמן = ${N(m * 10 * h)} ÷ ${N(t)} = ${N(P)} וואט.`,
      };
    }
  }
  const watt = pick([1000, 1500, 2000, 2500]);
  const hours = pick([2, 3, 4, 5]);
  const days = pick([10, 20, 30]);
  const price = pick([0.5, 0.6, 0.8, 1]);
  const kwh = (watt / 1000) * hours * days;
  const cost = kwh * price;
  const { options, correct } = numOptions(cost, [kwh, (watt * hours * days * price) / 100, cost * 10, (watt / 1000) * hours * price, cost / 2, kwh * price + hours], { f: NC });
  return {
    quant: 'power',
    html: `מכשיר חשמלי בהספק ${N(watt)} וואט פועל ${N(hours)} שעות ביום במשך ${N(days)} ימים. מחיר קילוואט־שעה הוא ${NC(price)}. מה עלות החשמל של המכשיר?`,
    options,
    correct,
    explain: `${N(watt)} וואט = ${N(watt / 1000)} קילוואט. אנרגיה: ${N(watt / 1000)} × ${N(hours)} × ${N(days)} = ${N(kwh)} קילוואט־שעה. עלות: ${N(kwh)} × ${N(price)} = ${NC(cost)}.`,
  };
}

const CAR_NAMES = ['רכב א׳', 'רכב ב׳', 'רכב ג׳', 'רכב ד׳', 'רכב ה׳'];
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];
function tableHtml(head, rows) {
  const th = head.map((h) => `<th>${h}</th>`).join('');
  const tr = rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${c}</th>` : `<td>${c}</td>`)).join('')}</tr>`).join('');
  return `<table class="pp-pt-table"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}
function qTable(easy) {
  if (easy || Math.random() < 0.5) {
    const effs = shuffle([8, 9, 10, 11, 12, 13, 14, 15, 16, 18]).slice(0, 5);
    const liters = effs.map(() => pick([10, 20, 25, 40, 50]));
    const km = effs.map((e, i) => e * liters[i]);
    const best = effs.indexOf(Math.max(...effs));
    const rows = CAR_NAMES.map((n, i) => [n, N(km[i]), N(liters[i])]);
    return {
      quant: 'table',
      html: `בטבלה מוצגים הנתונים של חמישה רכבים בנסיעה אחת. איזה רכב נסע הכי הרבה קילומטרים על ליטר דלק אחד (היעיל ביותר)?`,
      table: tableHtml(['רכב', 'מרחק (ק״מ)', 'דלק (ליטר)'], rows),
      options: CAR_NAMES.slice(),
      correct: best,
      explain: `מחשבים ק״מ לליטר בכל שורה: ${effs.map((e, i) => `${CAR_NAMES[i]} ${N(km[i])}÷${N(liters[i])}=${N(e)}`).join(', ')}. הגבוה ביותר: ${CAR_NAMES[best]}. לא הרכב שנסע הכי הרבה ק״מ בהכרח.`,
    };
  }
  let vals;
  do {
    vals = Array.from({ length: 5 }, () => rnd(12, 60));
  } while (vals.reduce((s, v) => s + v, 0) % 5 !== 0);
  const sum = vals.reduce((s, v) => s + v, 0);
  const avg = sum / 5;
  const sorted = vals.slice().sort((a, b) => a - b);
  const rows = DAY_NAMES.map((n, i) => [`יום ${n}`, N(vals[i])]);
  const { options, correct } = numOptions(avg, [sorted[2], sum, Math.max(...vals) - Math.min(...vals), (Math.max(...vals) + Math.min(...vals)) / 2, avg + 3, avg - 3], { int: true });
  return {
    quant: 'table',
    html: `בטבלה מספר הלקוחות בחנות בכל אחד מימי השבוע. מהו מספר הלקוחות הממוצע ליום?`,
    table: tableHtml(['יום', 'לקוחות'], rows),
    options,
    correct,
    explain: `סכום: ${vals.map(N).join(' + ')} = ${N(sum)}. ממוצע = ${N(sum)} ÷ ${N(5)} = ${N(avg)}.`,
  };
}

function genQuant(count, practice) {
  const hard = [qMeet, qChase, qPercent, qWork, qFraction, qGears, qRect, qPower, qTable];
  const easy = [() => qMeet(), () => qPercent(true), () => qWork(true), () => qGears(true), () => qTable(true)];
  const out = [];
  let bag = [];
  for (let i = 0; i < count; i++) {
    if (!bag.length) bag = shuffle(practice ? easy : hard);
    const q = bag.pop()(practice);
    q.type = 'quant';
    out.push(q);
  }
  return out;
}

/* ============================================================================================
   CUBE - a graph of 8 vertices; dots move along edges
   ============================================================================================ */

// Vertex v has coordinates x = bit 0 (right), y = bit 1 (up), z = bit 2 (forward, away from the viewer).
const AXES = [
  { pos: 'ימינה', neg: 'שמאלה' },
  { pos: 'למעלה', neg: 'למטה' },
  { pos: 'קדימה', neg: 'אחורה' },
];
const VERTEX_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח'];

/** The word that describes moving along `axis` from vertex v. */
function moveWord(v, axis) {
  return ((v >> axis) & 1) === 0 ? AXES[axis].pos : AXES[axis].neg;
}
function simulate(start, axes) {
  const pos = [start];
  for (const a of axes) pos.push(pos[pos.length - 1] ^ (1 << a));
  return pos;
}
/** Parse a word back into an axis, checking it is a legal move from v. Returns null for an illegal move. */
export function parseMove(v, word) {
  for (let a = 0; a < 3; a++) {
    if (word === AXES[a].pos && ((v >> a) & 1) === 0) return a;
    if (word === AXES[a].neg && ((v >> a) & 1) === 1) return a;
  }
  return null;
}
function firstMeeting(posR, posB) {
  for (let k = 1; k < posR.length; k++) if (posR[k] === posB[k]) return k;
  return 0;
}

function cubeQuestion(easy) {
  const L = easy ? 3 : rnd(4, 5);
  const mode = easy ? 'when' : Math.random() < 0.5 ? 'when' : 'where';
  // pick the kind of answer first, then search for a script that gives it, so every answer is common
  let target;
  if (mode === 'when') target = Math.random() < 0.25 ? 0 : rnd(1, L);
  else target = Math.random() < 0.6 ? 'meet' : 'apart';
  let best = null;
  for (let guard = 0; guard < 6000; guard++) {
    const sR = rnd(0, 7);
    let sB = rnd(0, 7);
    if (sB === sR) sB = sR ^ (1 << rnd(0, 2));
    const axR = Array.from({ length: L }, () => rnd(0, 2));
    const axB = Array.from({ length: L }, () => rnd(0, 2));
    const posR = simulate(sR, axR);
    const posB = simulate(sB, axB);
    const first = firstMeeting(posR, posB);
    const ok = mode === 'when' ? first === target : (posR[L] === posB[L]) === (target === 'meet');
    const cand = { sR, sB, axR, axB, posR, posB, first };
    if (ok) {
      best = cand;
      break;
    }
    if (!best) best = cand;
  }
  const { sR, sB, axR, axB, posR, posB, first } = best;
  const labels = shuffle(VERTEX_LETTERS); // labels[v] = the letter written on vertex v
  const wordsR = axR.map((a, i) => moveWord(posR[i], a));
  const wordsB = axB.map((a, i) => moveWord(posB[i], a));
  const lastMeet = posR[L] === posB[L];
  let options, correct, text, explain;
  const trace = [];
  for (let k = 1; k <= L; k++) {
    trace.push(`צעד ${N(k)}: האדומה ${labels[posR[k - 1]]}→${labels[posR[k]]}, הכחולה ${labels[posB[k - 1]]}→${labels[posB[k]]}`);
  }
  if (mode === 'when') {
    options = [1, 2, 3, 4, 5].map((k) => `אחרי צעד ${N(k)}`).concat(['לא נפגשות']);
    correct = first ? first - 1 : 5;
    text = 'אחרי איזה צעד הנקודות נפגשות לראשונה, כלומר נמצאות באותו קדקוד?';
    explain = `${trace.join('. ')}. ` + (first ? `בצעד ${N(first)} שתיהן בקדקוד ${labels[posR[first]]} - זה המפגש הראשון.` : 'בשום צעד הן לא נמצאות באותו קדקוד.');
    if (!first) {
      const d0 = popcount(sR ^ sB);
      if (d0 % 2 === 1) explain += ' טריק: כל צעד משנה את הזוגיות של המרחק בין הנקודות (מספר הקצוות ביניהן) בשתיהן יחד, ולכן אם המרחק ההתחלתי אי־זוגי הן לעולם לא ייפגשו.';
    }
  } else {
    const pool = [posR[L], posB[L], sR, sB];
    for (let v = 0; v < 8; v++) if (!pool.includes(v)) pool.push(v);
    let vs = [];
    if (lastMeet) vs.push(posR[L]);
    for (const v of shuffle(pool)) if (!vs.includes(v) && vs.length < 5) vs.push(v);
    vs = vs.sort((a, b) => VERTEX_LETTERS.indexOf(labels[a]) - VERTEX_LETTERS.indexOf(labels[b]));
    options = vs.map((v) => `קדקוד ${labels[v]}`).concat(['לא נפגשות']);
    correct = lastMeet ? vs.indexOf(posR[L]) : 5;
    text = 'בתום כל הצעדים, באיזה קדקוד נמצאות שתי הנקודות יחד? אם הן לא באותו קדקוד - "לא נפגשות".';
    explain = `${trace.join('. ')}. ` + (lastMeet ? `בסוף שתיהן בקדקוד ${labels[posR[L]]}.` : `בסוף האדומה ב־${labels[posR[L]]} והכחולה ב־${labels[posB[L]]} - לא באותו קדקוד.`);
  }
  return {
    type: 'cube',
    mode,
    L,
    labels,
    startR: sR,
    startB: sB,
    axesR: axR,
    axesB: axB,
    wordsR,
    wordsB,
    posR,
    posB,
    first,
    text,
    options,
    correct,
    explain,
  };
}
function popcount(x) {
  let c = 0;
  while (x) {
    c += x & 1;
    x >>= 1;
  }
  return c;
}
function genCube(count, practice) {
  return Array.from({ length: count }, () => cubeQuestion(practice));
}

/* ============================================================================================
   PLANE - attitude math shared by the cockpit view and the outside thumbnails
   ============================================================================================ */

// World: x right, y up, z forward. Body: x right wing, y up (canopy), z nose.
// pitch (theta) > 0 = nose up; bank (phi) > 0 = right wing down; |phi| = 180 is upside down.

/** Body-to-world matrix (rows). world = M * body. */
export function bodyToWorld(theta, phi) {
  const ct = Math.cos(rad(theta));
  const st = Math.sin(rad(theta));
  const cp = Math.cos(rad(phi));
  const sp = Math.sin(rad(phi));
  return [
    [cp, sp, 0],
    [-ct * sp, ct * cp, st],
    [st * sp, -st * cp, ct],
  ];
}
const mulV = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]];

/** What the pilot sees, derived from the direction of "up" (the world's up vector expressed in the body frame). */
export function cockpitParams(theta, phi) {
  const g = bodyToWorld(theta, phi)[1]; // world up in body coordinates
  const horiz = Math.hypot(g[0], g[1]);
  return {
    sx: g[0] / horiz, // direction of the sky on the screen (x to the right, y up)
    sy: g[1] / horiz,
    pitch: (Math.asin(clamp(g[2], -1, 1)) * 180) / Math.PI,
    alpha: Math.atan2(g[0] / horiz, g[1] / horiz),
  };
}
const norm180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
const angDist = (a, b) => Math.abs(norm180(a - b));
const farApart = (A, B) => Math.abs(A.theta - B.theta) >= 14 || angDist(A.phi, B.phi) >= 25;

function describeAttitude(theta, phi) {
  const pit = theta > 0 ? `האף מורם (עלייה, ${N(Math.abs(theta))} מעלות)` : `האף מורד (צלילה, ${N(Math.abs(theta))} מעלות)`;
  const a = Math.abs(phi);
  let bank;
  if (a < 8) bank = 'הכנפיים ישרות';
  else if (a > 172) bank = 'המטוס הפוך לגמרי (הגג כלפי האדמה)';
  else if (a > 100) bank = `המטוס כמעט הפוך, מוטה ${phi > 0 ? 'ימינה' : 'שמאלה'}`;
  else bank = `המטוס מוטה ${phi > 0 ? 'ימינה (הכנף הימנית למטה)' : 'שמאלה (הכנף השמאלית למטה)'}`;
  return `${pit}; ${bank}`;
}

function planeQuestion(easy) {
  const theta = sign() * pick(easy ? [20, 25, 30, 35, 40] : [10, 15, 20, 25, 30, 35, 40]);
  let phi;
  const r = Math.random();
  if (easy) phi = pick([0, 0, sign() * 30, sign() * 45, sign() * 60]);
  else if (r < 0.1) phi = 0;
  else if (r < 0.45) phi = sign() * pick([15, 20, 25, 30, 40, 45, 50, 60, 70]);
  else if (r < 0.7) phi = sign() * pick([100, 110, 120, 135, 150, 160]);
  else if (r < 0.8) phi = 180;
  else phi = sign() * pick([80, 85, 90, 95]);
  const right = { theta, phi };
  const prio = [
    { theta, phi: -phi }, // wrong bank direction
    { theta: -theta, phi }, // wrong pitch sign
  ];
  const rest = [
    { theta: -theta, phi: -phi },
    { theta, phi: norm180(phi + 180) },
    { theta: -theta, phi: norm180(phi + 180) },
    { theta, phi: norm180(phi + 30) },
    { theta, phi: norm180(phi - 30) },
    { theta: theta > 0 ? Math.max(10, theta - 20) : Math.min(-10, theta + 20), phi },
    { theta: theta > 0 ? Math.min(40, theta + 15) : Math.max(-40, theta - 15), phi: norm180(phi + sign() * 40) },
    { theta: -theta, phi: norm180(180 - phi) },
    { theta, phi: norm180(180 - phi) },
  ];
  const chosen = [];
  const consider = (c) => {
    if (chosen.length >= 4) return;
    if (!farApart(right, c)) return;
    if (chosen.some((o) => !farApart(o, c))) return;
    chosen.push({ theta: Math.round(c.theta), phi: Math.round(norm180(c.phi)) });
  };
  (Math.random() < 0.8 ? [...shuffle(prio), ...shuffle(rest)] : shuffle([...prio, ...rest])).forEach(consider);
  for (let guard = 0; chosen.length < 4 && guard < 500; guard++) consider({ theta: sign() * rnd(10, 40), phi: rnd(-180, 180) });
  const all = shuffle([right, ...chosen]);
  const correct = all.findIndex((o) => o === right);
  return {
    type: 'plane',
    theta,
    phi,
    attitudes: all,
    options: all.map(() => ''),
    correct,
    text: 'זה מה שהטייס רואה מתוך תא הטייס. איזה מהמטוסים (מבט מבחוץ) נמצא באותו מצב?',
    explain: `באופק: ${theta > 0 ? 'הקו מתחת למרכז המסך, כלומר האף מעל האופק' : 'הקו מעל מרכז המסך, כלומר האף מתחת לאופק'}. ${describeAttitude(theta, phi)}. מחפשים את המטוס שהאף שלו והכנפיים שלו נמצאים במצב הזה ביחס לאדמה.`,
  };
}
function genPlane(count, practice) {
  return Array.from({ length: count }, () => planeQuestion(practice));
}

const GENERATORS = { quant: genQuant, cube: genCube, plane: genPlane };

/* ============================================================================================
   Drawing - shared
   ============================================================================================ */

const FONT = "'Heebo', system-ui, sans-serif";

function fitCanvas(canvas) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  if (!w || !h) return null;
  let changed = false;
  if (canvas.__w !== w || canvas.__h !== h || canvas.__dpr !== dpr) {
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.__w = w;
    canvas.__h = h;
    canvas.__dpr = dpr;
    changed = true;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h, changed };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, { size = 14, color = '#e8eefc', align = 'center', weight = 700, base = 'middle' } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.direction = 'rtl';
  ctx.fillText(str, x, y);
}

/* ---------- quant diagrams ---------- */

function drawGear(ctx, cx, cy, teeth, R, rot, fill, stroke) {
  const tooth = Math.max(3, R * 0.14);
  const step = (Math.PI * 2) / teeth;
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a = rot + i * step;
    const pts = [
      [R, a],
      [R, a + step * 0.2],
      [R + tooth, a + step * 0.32],
      [R + tooth, a + step * 0.58],
      [R, a + step * 0.7],
    ];
    pts.forEach(([r, ang], j) => {
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r;
      if (i === 0 && j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(8,16,34,0.55)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    const a = rot + (k * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * R * 0.6, cy + Math.sin(a) * R * 0.6);
    ctx.stroke();
  }
}

function drawCar(ctx, x, y, color, dir) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.fillStyle = color;
  roundRect(ctx, -17, -9, 34, 12, 4);
  ctx.fill();
  roundRect(ctx, -9, -16, 18, 9, 3);
  ctx.fill();
  ctx.fillStyle = '#0b1530';
  ctx.beginPath();
  ctx.arc(-9, 3, 4, 0, 7);
  ctx.arc(9, 3, 4, 0, 7);
  ctx.fill();
  ctx.restore();
}

function drawQuantDiagram(ctx, w, h, t, d) {
  ctx.clearRect(0, 0, w, h);
  if (d.kind === 'meet' || d.kind === 'chase') {
    const y = h * 0.62;
    ctx.strokeStyle = 'rgba(160,190,255,0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(18, y + 10);
    ctx.lineTo(w - 18, y + 10);
    ctx.stroke();
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(18, y + 10);
    ctx.lineTo(w - 18, y + 10);
    ctx.stroke();
    ctx.setLineDash([]);
    const phase = (t * 0.16) % 1;
    if (d.kind === 'meet') {
      const x0 = 36;
      const x1 = w - 36;
      const frac = d.v1 / (d.v1 + d.v2);
      const mid = x0 + (x1 - x0) * frac;
      const xa = x0 + (mid - x0) * phase;
      const xb = x1 - (x1 - mid) * phase;
      drawCar(ctx, xa, y, '#ff6b6b', 1);
      drawCar(ctx, xb, y, '#4ea1ff', -1);
      text(ctx, iso(d.v1 + ' קמ״ש'), xa, y - 28, { size: 13, color: '#ffb3b3' });
      text(ctx, iso(d.v2 + ' קמ״ש'), xb, y - 28, { size: 13, color: '#a9d2ff' });
      // distance bracket
      ctx.strokeStyle = '#ffc857';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x0, y + 28);
      ctx.lineTo(x1, y + 28);
      ctx.moveTo(x0, y + 22);
      ctx.lineTo(x0, y + 34);
      ctx.moveTo(x1, y + 22);
      ctx.lineTo(x1, y + 34);
      ctx.stroke();
      text(ctx, iso(d.d + ' ק״מ'), w / 2, y + 46, { size: 14, color: '#ffc857' });
    } else {
      const x0 = 40;
      const xc = w - 56;
      const f = smooth(phase);
      const bikeFrac = (d.v2 - d.v1 + d.v1 * f) / d.v2;
      const xBike = x0 + (xc - x0) * bikeFrac;
      const xMoto = x0 + (xc - x0) * f;
      const yBike = h * 0.36;
      const yMoto = h * 0.68;
      [yBike, yMoto].forEach((yy) => {
        ctx.strokeStyle = 'rgba(160,190,255,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(18, yy + 10);
        ctx.lineTo(w - 18, yy + 10);
        ctx.stroke();
      });
      drawCar(ctx, xBike, yBike, '#ffc857', 1);
      drawCar(ctx, xMoto, yMoto, '#4ea1ff', 1);
      text(ctx, 'אופניים ' + iso(d.v1 + ' קמ״ש'), xBike, yBike - 28, { size: 13, color: '#ffe0a0' });
      text(ctx, 'אופנוע ' + iso(d.v2 + ' קמ״ש'), xMoto, yMoto - 28, { size: 13, color: '#a9d2ff' });
      text(ctx, 'האופנוע יוצא ' + iso(d.h + '') + (d.h === 1 ? ' שעה' : ' שעות') + ' מאוחר יותר', w / 2, h * 0.92, { size: 12, color: '#cfe0ff', weight: 500 });
    }
    return;
  }
  if (d.kind === 'gears') {
    const R = d.teeth.map((n) => n);
    const total = R.reduce((s, r) => s + r * 2, 0);
    const k = Math.min((w * 0.86) / total, (h * 0.62) / (Math.max(...R) * 2));
    const colors = ['#4ea1ff', '#7a8cff', '#4cd29a'];
    let x = (w - total * k) / 2;
    const cy = h * 0.54;
    d.teeth.forEach((n, i) => {
      const r = n * k;
      x += r;
      const speed = 1.1 * (d.teeth[0] / n) * (i % 2 ? -1 : 1);
      drawGear(ctx, x, cy, n, r, t * speed * 0.35 + (i % 2 ? Math.PI / n : 0), colors[i % colors.length] + 'cc', 'rgba(255,255,255,0.55)');
      text(ctx, iso(n + ''), x, cy, { size: Math.max(12, Math.min(22, r * 0.5)), color: '#fff' });
      text(ctx, d.names[i], x, cy - r - Math.max(9, r * 0.2) - 8, { size: 15, color: '#cfe0ff' });
      text(ctx, 'שיניים', x, cy + r * 0.3 + 10, { size: 10, color: '#cfe0ff', weight: 500 });
      x += r;
    });
    return;
  }
  if (d.kind === 'rect') {
    const maxW = w * 0.62;
    const maxH = h * 0.48;
    const sc = Math.min(maxW / Math.max(d.l, d.nl), maxH / Math.max(d.w, d.nw));
    const ox = w / 2 - (d.l * sc) / 2;
    const oy = h * 0.2;
    ctx.fillStyle = 'rgba(78,161,255,0.25)';
    ctx.strokeStyle = '#4ea1ff';
    ctx.lineWidth = 2;
    ctx.fillRect(ox, oy, d.l * sc, d.w * sc);
    ctx.strokeRect(ox, oy, d.l * sc, d.w * sc);
    text(ctx, iso(d.l + ' ס״מ'), ox + (d.l * sc) / 2, oy - 12, { size: 13, color: '#a9d2ff' });
    text(ctx, iso(d.w + ' ס״מ'), ox - 8, oy + (d.w * sc) / 2, { size: 13, color: '#a9d2ff', align: 'right' });
    text(ctx, 'מלבן מקורי', w / 2, oy + d.w * sc + 22, { size: 13, color: '#cfe0ff' });
    text(ctx, iso('אורך +' + d.inc + '%') + '   ' + iso('רוחב −' + d.dec + '%'), w / 2, oy + d.w * sc + 44, { size: 13, color: '#ffc857' });
    return;
  }
  if (d.kind === 'lift') {
    const baseY = h * 0.84;
    const topY = h * 0.2;
    const x = w * 0.5;
    ctx.strokeStyle = 'rgba(160,190,255,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 90, baseY + 6);
    ctx.lineTo(x + 90, baseY + 6);
    ctx.stroke();
    ctx.strokeStyle = '#ffc857';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 60, baseY);
    ctx.lineTo(x + 60, topY);
    ctx.moveTo(x + 54, baseY);
    ctx.lineTo(x + 66, baseY);
    ctx.moveTo(x + 54, topY);
    ctx.lineTo(x + 66, topY);
    ctx.stroke();
    text(ctx, iso(d.h + ' מ׳'), x + 74, (baseY + topY) / 2, { size: 13, color: '#ffc857', align: 'left' });
    const phase = (t * 0.25) % 1;
    const by = baseY - (baseY - topY - 30) * smooth(phase);
    ctx.strokeStyle = '#9fb0d3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, topY - 8);
    ctx.lineTo(x, by - 22);
    ctx.stroke();
    ctx.fillStyle = '#4ea1ff';
    roundRect(ctx, x - 24, by - 22, 48, 28, 5);
    ctx.fill();
    text(ctx, iso(d.m + ' ק״ג'), x, by - 8, { size: 12, color: '#06142c' });
    text(ctx, iso(d.t + ' שניות'), x - 80, h * 0.3, { size: 13, color: '#cfe0ff' });
  }
}

/* ---------- cube ---------- */

function rotCube(p, yaw, pit) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x = p[0] * cy + p[2] * sy;
  const z0 = -p[0] * sy + p[2] * cy;
  const cp = Math.cos(pit);
  const sp = Math.sin(pit);
  return [x, p[1] * cp + z0 * sp, -p[1] * sp + z0 * cp];
}
const vCoord = (v) => [(v & 1) - 0.5, ((v >> 1) & 1) - 0.5, ((v >> 2) & 1) - 0.5];
const CUBE_EDGES = (() => {
  const e = [];
  for (let v = 0; v < 8; v++) for (let a = 0; a < 3; a++) if (((v >> a) & 1) === 0) e.push([v, v | (1 << a), a]);
  return e;
})();
const CUBE_FACES = (() => {
  const f = [];
  for (let a = 0; a < 3; a++)
    for (let s = 0; s < 2; s++) {
      const b = (a + 1) % 3;
      const c = (a + 2) % 3;
      const base = s << a;
      f.push({ a, s, vs: [base, base | (1 << b), base | (1 << b) | (1 << c), base | (1 << c)] });
    }
  return f;
})();

function cubeDotPos(q, which, stepF) {
  const pos = which === 'R' ? q.posR : q.posB;
  const L = q.L;
  const s = clamp(stepF, 0, L);
  const i = Math.min(L - 1, Math.floor(s));
  const frac = s >= L ? 1 : smooth(s - i);
  const a = vCoord(pos[i]);
  const b = vCoord(pos[i + 1]);
  return a.map((v, k) => v + (b[k] - v) * frac);
}

function drawCube(ctx, w, h, t, q, anim) {
  ctx.clearRect(0, 0, w, h);
  const yaw = -0.62 + 0.3 * Math.sin(t * 0.55);
  const pit = 0.44 + 0.07 * Math.sin(t * 0.4 + 1);
  const D = 3.4;
  const sc = Math.min(w * 0.45, h * 0.46);
  const cx = w / 2;
  const cy = h * 0.5;
  const P = (p) => {
    const r = rotCube(p, yaw, pit);
    const k = D / (r[2] + D);
    return { x: cx + r[0] * sc * k, y: cy - r[1] * sc * k, z: r[2], k };
  };
  const V = Array.from({ length: 8 }, (_, v) => P(vCoord(v)));
  // faces: visible or not
  const faceInfo = CUBE_FACES.map((f) => {
    const n = [0, 0, 0];
    n[f.a] = f.s ? 1 : -1;
    const nr = rotCube(n, yaw, pit);
    const cen = [0, 0, 0];
    f.vs.forEach((v) => vCoord(v).forEach((c, i) => (cen[i] += c / 4)));
    const cr = rotCube(cen, yaw, pit);
    const dot = nr[0] * cr[0] + nr[1] * cr[1] + nr[2] * (cr[2] + D);
    const light = clamp(0.5 + 0.35 * nr[1] - 0.2 * nr[0] + 0.1 * (-nr[2]), 0.2, 1);
    return { ...f, front: dot < 0, light, depth: cr[2] };
  });
  // back faces: a faint fill
  faceInfo
    .filter((f) => !f.front)
    .forEach((f) => {
      ctx.beginPath();
      f.vs.forEach((v, i) => (i ? ctx.lineTo(V[v].x, V[v].y) : ctx.moveTo(V[v].x, V[v].y)));
      ctx.closePath();
      ctx.fillStyle = 'rgba(70,100,170,0.07)';
      ctx.fill();
    });
  // hidden edges
  const edgeHidden = (u, v, a) => {
    const others = [0, 1, 2].filter((k) => k !== a);
    return others.every((k) => {
      const side = (u >> k) & 1;
      return !faceInfo.find((f) => f.a === k && f.s === side).front;
    });
  };
  ctx.lineCap = 'round';
  ctx.setLineDash([5, 6]);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(150,180,235,0.4)';
  CUBE_EDGES.forEach(([u, v, a]) => {
    if (!edgeHidden(u, v, a)) return;
    ctx.beginPath();
    ctx.moveTo(V[u].x, V[u].y);
    ctx.lineTo(V[v].x, V[v].y);
    ctx.stroke();
  });
  ctx.setLineDash([]);
  // front faces
  faceInfo
    .filter((f) => f.front)
    .sort((a, b) => b.depth - a.depth)
    .forEach((f) => {
      ctx.beginPath();
      f.vs.forEach((v, i) => (i ? ctx.lineTo(V[v].x, V[v].y) : ctx.moveTo(V[v].x, V[v].y)));
      ctx.closePath();
      const l = f.light;
      ctx.fillStyle = `rgba(${Math.round(70 + 90 * l)},${Math.round(110 + 100 * l)},${Math.round(190 + 60 * l)},0.20)`;
      ctx.fill();
    });
  // trails of the dots
  const stepF = anim.step;
  const trail = (which, color) => {
    const pos = which === 'R' ? q.posR : q.posB;
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    const upto = Math.min(q.L, stepF);
    for (let i = 0; i < Math.ceil(upto); i++) {
      const a = P(vCoord(pos[i]));
      const frac = i + 1 <= upto ? 1 : smooth(upto - i);
      const b = P(vCoord(pos[i + 1]));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x + (b.x - a.x) * frac, a.y + (b.y - a.y) * frac);
      ctx.stroke();
    }
  };
  if (stepF > 0) {
    trail('R', 'rgba(255,90,100,0.45)');
    trail('B', 'rgba(80,160,255,0.45)');
  }
  // visible edges
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = '#cfe0ff';
  CUBE_EDGES.forEach(([u, v, a]) => {
    if (edgeHidden(u, v, a)) return;
    ctx.beginPath();
    ctx.moveTo(V[u].x, V[u].y);
    ctx.lineTo(V[v].x, V[v].y);
    ctx.stroke();
  });
  // start markers + dots
  const startRing = (v, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(V[v].x, V[v].y, 13 * V[v].k, 0, 7);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  startRing(q.startR, '#ff8a93');
  startRing(q.startB, '#8ec1ff');
  const dots = [
    { p: P(cubeDotPos(q, 'R', stepF)), c: '#ff4d5e', c2: '#ffb0b6' },
    { p: P(cubeDotPos(q, 'B', stepF)), c: '#3d93ff', c2: '#a9d0ff' },
  ];
  const together = Math.hypot(dots[0].p.x - dots[1].p.x, dots[0].p.y - dots[1].p.y) < 4;
  dots.forEach((d, i) => {
    const off = together ? (i ? 8 : -8) : 0;
    const r = 10 * d.p.k;
    const g = ctx.createRadialGradient(d.p.x + off - 3, d.p.y - 3, 1, d.p.x + off, d.p.y, r + 7);
    g.addColorStop(0, d.c2);
    g.addColorStop(0.45, d.c);
    g.addColorStop(1, d.c + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(d.p.x + off, d.p.y, r + 7, 0, 7);
    ctx.fill();
    ctx.fillStyle = d.c;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(d.p.x + off, d.p.y, r, 0, 7);
    ctx.fill();
    ctx.stroke();
  });
  // vertex labels
  const center = P([0, 0, 0]);
  for (let v = 0; v < 8; v++) {
    const hidden = [0, 1, 2].every((a) => !faceInfo.find((f) => f.a === a && f.s === ((v >> a) & 1)).front);
    const dx = V[v].x - center.x;
    const dy = V[v].y - center.y;
    const len = Math.hypot(dx, dy) || 1;
    const lx = V[v].x + (dx / len) * 23;
    const ly = V[v].y + (dy / len) * 23;
    ctx.globalAlpha = hidden ? 0.5 : 1;
    ctx.fillStyle = hidden ? 'rgba(20,34,64,0.9)' : 'rgba(10,20,44,0.92)';
    ctx.beginPath();
    ctx.arc(lx, ly, 11, 0, 7);
    ctx.fill();
    ctx.strokeStyle = hidden ? 'rgba(160,190,255,0.35)' : 'rgba(160,190,255,0.8)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    text(ctx, q.labels[v], lx, ly + 1, { size: 14, color: hidden ? '#9fb0d3' : '#fff' });
    ctx.globalAlpha = 1;
  }
  // axis legend (rotates together with the cube)
  const gx = 56;
  const gy = h - 46;
  const axisInfo = [
    { v: [1, 0, 0], label: 'ימינה', color: '#ffd479' },
    { v: [0, 1, 0], label: 'למעלה', color: '#7ee0a8' },
    { v: [0, 0, 1], label: 'קדימה', color: '#d5a6ff' },
  ];
  ctx.fillStyle = 'rgba(10,20,44,0.6)';
  roundRect(ctx, 6, h - 96, 112, 90, 10);
  ctx.fill();
  axisInfo.forEach((ax) => {
    const r = rotCube(ax.v, yaw, pit);
    const len = 36;
    const ex = gx + r[0] * len;
    const ey = gy - r[1] * len;
    ctx.strokeStyle = ax.color;
    ctx.fillStyle = ax.color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    const ang = Math.atan2(ey - gy, ex - gx);
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - Math.cos(ang - 0.45) * 8, ey - Math.sin(ang - 0.45) * 8);
    ctx.lineTo(ex - Math.cos(ang + 0.45) * 8, ey - Math.sin(ang + 0.45) * 8);
    ctx.closePath();
    ctx.fill();
    text(ctx, ax.label, ex + Math.cos(ang) * 16, ey + Math.sin(ang) * 11, { size: 12, color: ax.color });
  });
  if (anim.playing || anim.step > 0) {
    const k = Math.min(q.L, Math.floor(anim.step + 1e-6));
    text(ctx, `צעד ${k} מתוך ${q.L}` + (k > 0 && q.posR[k] === q.posB[k] && Math.abs(anim.step - k) < 0.05 ? '  -  נפגשו!' : ''), w / 2, 18, { size: 14, color: '#ffc857' });
  }
}

/* ---------- plane ---------- */

const MODEL = (() => {
  const ring = (z, hw, top, bot) => [[-hw, 0, z], [0, top, z], [hw, 0, z], [0, -bot, z]];
  const r1 = ring(0.8, 0.3, 0.28, 0.22);
  const r2 = ring(-1.0, 0.34, 0.3, 0.25);
  const r3 = ring(-1.7, 0.2, 0.18, 0.15);
  const nose = [0, 0, 2.3];
  const faces = [];
  const FUS = [140, 160, 196];
  const closed = (v, col, ref = [0, 0, 0]) => faces.push({ v, col, ref });
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    closed([nose, r1[i], r1[j]], [196, 206, 226], [0, 0, 0.4]);
    closed([r1[i], r1[j], r2[j], r2[i]], FUS);
    closed([r2[i], r2[j], r3[j], r3[i]], [118, 134, 172]);
  }
  closed([r3[0], r3[1], r3[2], r3[3]], [38, 44, 66], [0, 0, 0]);
  // canopy
  const F = [0, 0.28, 0.7];
  const K = [0, 0.29, -0.5];
  const Pk = [0, 0.52, 0.15];
  const SL = [-0.18, 0.2, 0.1];
  const SR = [0.18, 0.2, 0.1];
  const CAN = [64, 196, 255];
  [[F, Pk, SL], [F, SR, Pk], [K, SL, Pk], [K, Pk, SR]].forEach((v) => closed(v, CAN, [0, 0.25, 0.1]));
  // flat parts: top color, bottom color
  const flat = (v, top, bot, tip = false) => faces.push({ v, top, bot, flat: true, tip });
  const TOP = [70, 108, 188];
  const BOT = [214, 222, 240];
  [1, -1].forEach((s) => {
    const X = (x) => s * x;
    flat([[X(0.3), 0, 0.5], [X(1.75), 0, -0.628], [X(1.75), 0, -1.2417], [X(0.3), 0, -1.0]], TOP, BOT);
    const tip = s > 0 ? [60, 235, 140] : [255, 70, 70];
    flat([[X(1.75), 0, -0.628], [X(2.1), 0, -0.9], [X(2.1), 0, -1.3], [X(1.75), 0, -1.2417]], tip, tip, true);
    flat([[X(0.25), 0.02, -1.0], [X(0.95), 0.02, -1.6], [X(0.95), 0.02, -1.85], [X(0.2), 0.02, -1.7]], [90, 124, 196], [196, 206, 228]);
  });
  flat([[0, 0.3, -0.7], [0, 1.05, -1.55], [0, 1.05, -1.8], [0, 0.28, -1.6]], [232, 96, 90], [232, 96, 90]);
  return faces;
})();

const PLANE_CAM = { az: rad(26), el: rad(9), D: 8.5 };

/** World point -> screen for the thumbnail camera (a fixed camera behind the aircraft, above and to the side). */
export function projectPlane(p, w, h) {
  const { az, el, D } = PLANE_CAM;
  const x = p[0] * Math.cos(az) + p[2] * Math.sin(az);
  const z = -p[0] * Math.sin(az) + p[2] * Math.cos(az);
  const y2 = p[1] * Math.cos(el) + z * Math.sin(el);
  const z2 = -p[1] * Math.sin(el) + z * Math.cos(el) + D;
  const F = Math.min(w * 1.35, h * 1.75) * 1.0;
  return { x: w / 2 + (F * x) / z2, y: h * 0.56 - (F * y2) / z2, z: z2 };
}

function drawPlaneView(ctx, w, h, theta, phi) {
  const F = Math.min(w * 1.35, h * 1.75);
  const horizonY = h * 0.56 - F * Math.tan(PLANE_CAM.el);
  const sky = ctx.createLinearGradient(0, 0, 0, Math.max(10, horizonY));
  sky.addColorStop(0, '#1e5aa8');
  sky.addColorStop(1, '#9bd3ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizonY);
  const gnd = ctx.createLinearGradient(0, horizonY, 0, h);
  gnd.addColorStop(0, '#7a6a47');
  gnd.addColorStop(1, '#2a2d1e');
  ctx.fillStyle = gnd;
  ctx.fillRect(0, horizonY, w, h - horizonY);
  // ground grid so the "down" direction reads clearly
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  const gridY = -2.7;
  for (let g = -40; g <= 40; g += 4) {
    ctx.beginPath();
    let started = false;
    for (let z = -14; z <= 60; z += 2) {
      const p = projectPlane([g, gridY, z], w, h);
      if (p.z < 1) continue;
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  for (let z = -14; z <= 60; z += 4) {
    ctx.beginPath();
    let started = false;
    for (let g = -40; g <= 40; g += 4) {
      const p = projectPlane([g, gridY, z], w, h);
      if (p.z < 1) continue;
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  ctx.lineTo(w, horizonY);
  ctx.stroke();
  // the aircraft
  const M = bodyToWorld(theta, phi);
  const light = (() => {
    const l = [-0.4, 0.8, -0.45];
    const n = Math.hypot(...l);
    return l.map((v) => v / n);
  })();
  const items = [];
  for (const f of MODEL) {
    const world = f.v.map((p) => mulV(M, p));
    const cam = world.map((p) => {
      const { az, el, D } = PLANE_CAM;
      const x = p[0] * Math.cos(az) + p[2] * Math.sin(az);
      const z = -p[0] * Math.sin(az) + p[2] * Math.cos(az);
      return [x, p[1] * Math.cos(el) + z * Math.sin(el), -p[1] * Math.sin(el) + z * Math.cos(el) + D];
    });
    const cen = cam.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]).map((v) => v / cam.length);
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    // normal in the body frame -> world -> camera, so shading uses the world normal
    const bn = cross(sub(f.v[1], f.v[0]), sub(f.v[2], f.v[0]));
    let nW = mulV(M, bn);
    const ln = Math.hypot(...nW) || 1;
    nW = nW.map((v) => v / ln);
    const nC = cross(sub(cam[1], cam[0]), sub(cam[2], cam[0]));
    // camera normal consistent with nW (a rotation preserves the orientation)
    const nCn = nC.map((v) => v / (Math.hypot(...nC) || 1));
    let col;
    let nWf = nW;
    let nCf = nCn;
    if (f.flat) {
      // choose the "top" side as the body +y (or +x for the fin) side
      const bodyTop = Math.abs(bn[1]) > 1e-6 ? Math.sign(bn[1]) : Math.sign(bn[0]);
      const topW = nW.map((v) => v * bodyTop);
      const topC = nCn.map((v) => v * bodyTop);
      const facing = dot(topC, cen) < 0;
      col = facing ? f.top : f.bot;
      nWf = facing ? topW : topW.map((v) => -v);
      nCf = facing ? topC : topC.map((v) => -v);
    } else {
      const refW = mulV(M, f.ref);
      const { az, el, D } = PLANE_CAM;
      const rc = [refW[0] * Math.cos(az) + refW[2] * Math.sin(az), 0, 0];
      const rz = -refW[0] * Math.sin(az) + refW[2] * Math.cos(az);
      rc[1] = refW[1] * Math.cos(el) + rz * Math.sin(el);
      rc[2] = -refW[1] * Math.sin(el) + rz * Math.cos(el) + D;
      if (dot(nCn, sub(cen, rc)) < 0) {
        nWf = nW.map((v) => -v);
        nCf = nCn.map((v) => -v);
      }
      if (dot(nCf, cen) >= 0) continue; // faces away from the camera
      col = f.col;
    }
    const lit = f.tip ? 1.05 : 0.38 + 0.62 * Math.max(0, dot(nWf, light));
    items.push({ pts: f.v.map((_, i) => projectPlane(world[i], w, h)), col, lit, depth: cen[2] });
  }
  items.sort((a, b) => b.depth - a.depth);
  for (const it of items) {
    ctx.beginPath();
    it.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    const c = it.col.map((v) => clamp(Math.round(v * it.lit), 0, 255));
    ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(8,16,34,0.55)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

function drawCockpit(ctx, w, h, theta, phi) {
  const cp = cockpitParams(theta, phi);
  const kpx = Math.min(w, h * 1.6) / 62; // pixels per degree of pitch
  const R = Math.hypot(w, h);
  ctx.save();
  roundRect(ctx, 0, 0, w, h, 14);
  ctx.clip();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(cp.alpha);
  const d = cp.pitch * kpx; // horizon below centre when the nose is up
  const sky = ctx.createLinearGradient(0, d - R * 0.7, 0, d);
  sky.addColorStop(0, '#0e3f86');
  sky.addColorStop(1, '#8fd0ff');
  ctx.fillStyle = sky;
  ctx.fillRect(-R, -R * 2 + d, R * 2, R * 2);
  const gnd = ctx.createLinearGradient(0, d, 0, d + R * 0.7);
  gnd.addColorStop(0, '#85764d');
  gnd.addColorStop(1, '#2e2c1d');
  ctx.fillStyle = gnd;
  ctx.fillRect(-R, d, R * 2, R * 2);
  // ground lines: converge toward the vanishing point on the horizon
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  for (let i = -12; i <= 12; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 8, d);
    ctx.lineTo(i * 120, d + R);
    ctx.stroke();
  }
  for (let i = 1; i < 14; i++) {
    const y = d + 5 * Math.pow(i, 1.6);
    ctx.beginPath();
    ctx.moveTo(-R, y);
    ctx.lineTo(R, y);
    ctx.stroke();
  }
  // horizon
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-R, d);
  ctx.lineTo(R, d);
  ctx.stroke();
  // pitch ladder
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.6;
  for (let p = -40; p <= 40; p += 10) {
    if (!p) continue;
    const y = d - p * kpx;
    const half = 34;
    ctx.beginPath();
    ctx.moveTo(-half, y);
    ctx.lineTo(half, y);
    ctx.moveTo(-half, y);
    ctx.lineTo(-half, y + (p > 0 ? 6 : -6));
    ctx.moveTo(half, y);
    ctx.lineTo(half, y + (p > 0 ? 6 : -6));
    ctx.stroke();
    ctx.save();
    ctx.translate(0, y);
    text(ctx, iso(Math.abs(p) + ''), -half - 14, 0, { size: 11, color: 'rgba(255,255,255,0.85)' });
    text(ctx, iso(Math.abs(p) + ''), half + 14, 0, { size: 11, color: 'rgba(255,255,255,0.85)' });
    ctx.restore();
  }
  ctx.restore();
  // fixed cockpit parts
  ctx.save();
  roundRect(ctx, 0, 0, w, h, 14);
  ctx.clip();
  // canopy frame
  const frame = ctx.createLinearGradient(0, 0, 0, h * 0.2);
  frame.addColorStop(0, 'rgba(6,10,20,0.96)');
  frame.addColorStop(1, 'rgba(6,10,20,0)');
  ctx.fillStyle = frame;
  ctx.fillRect(0, 0, w, h * 0.2);
  ctx.fillStyle = 'rgba(6,10,20,0.94)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w * 0.1, 0);
  ctx.lineTo(w * 0.035, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w, 0);
  ctx.lineTo(w * 0.9, 0);
  ctx.lineTo(w * 0.965, h);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  // glare shield
  const gs = ctx.createLinearGradient(0, h * 0.86, 0, h);
  gs.addColorStop(0, 'rgba(8,14,28,0)');
  gs.addColorStop(0.3, 'rgba(8,14,28,0.95)');
  gs.addColorStop(1, 'rgba(8,14,28,1)');
  ctx.fillStyle = gs;
  ctx.fillRect(0, h * 0.86, w, h * 0.14);
  ctx.restore();
  // aircraft reference symbol (fixed to the cockpit)
  const cx = w / 2;
  const cy = h / 2;
  ctx.strokeStyle = '#ffd34d';
  ctx.fillStyle = '#ffd34d';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 52, cy);
  ctx.lineTo(cx - 20, cy);
  ctx.lineTo(cx - 12, cy + 10);
  ctx.moveTo(cx + 52, cy);
  ctx.lineTo(cx + 20, cy);
  ctx.lineTo(cx + 12, cy + 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 3.2, 0, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,190,255,0.35)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 0.75, 0.75, w - 1.5, h - 1.5, 14);
  ctx.stroke();
}

/* ============================================================================================
   Styles
   ============================================================================================ */

const STYLE_ID = 'pp-pt-style';
const CSS = `
.pp-pt-root{position:relative;display:flex;flex-direction:column;gap:8px;width:100%;height:100%;min-height:0;box-sizing:border-box;direction:rtl;color:var(--pp-text,#e8eefc);font-family:'Heebo',system-ui,sans-serif;font-size:16px;user-select:none;-webkit-user-select:none}
.pp-pt-root *{box-sizing:border-box}
.pp-pt-head{display:flex;align-items:center;gap:10px;min-height:28px}
.pp-pt-count{font-weight:800;font-size:1.05rem;white-space:nowrap}
.pp-pt-title{font-size:.9rem;color:var(--pp-muted,#9fb0d3);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.pp-pt-time{margin-inline-start:auto;font-variant-numeric:tabular-nums;font-weight:800;font-size:1.35rem;direction:ltr;transition:color .3s}
.pp-pt-bar{height:11px;flex:none}
.pp-pt-bar>i{width:100%;transition:width .25s linear,background .4s}
.pp-pt-bar.warn>i{background:linear-gradient(90deg,#ff9f1c,var(--pp-warn,#ffc857))}
.pp-pt-bar.crit>i{background:linear-gradient(90deg,#ff3b4e,var(--pp-bad,#ff6b6b))}
.pp-pt-time.warn{color:var(--pp-warn,#ffc857)}
.pp-pt-time.crit{color:var(--pp-bad,#ff6b6b);animation:pp-pt-blink 1s steps(2,jump-none) infinite}
@keyframes pp-pt-blink{50%{opacity:.55}}
.pp-pt-stage{position:relative;flex:1;min-height:0}
.pp-pt-q{position:absolute;inset:0;display:flex;flex-direction:column;gap:10px;min-height:0}
.pp-pt-q.in{animation:pp-pt-in .3s ease both}
.pp-pt-q.out{animation:pp-pt-out .18s ease both;pointer-events:none}
@keyframes pp-pt-in{from{opacity:0;transform:translateX(-26px)}to{opacity:1;transform:none}}
@keyframes pp-pt-out{from{opacity:1}to{opacity:0;transform:translateX(26px)}}
.pp-pt-stim{flex:1;min-height:0;display:flex;gap:12px}
.pp-pt-stim>.pp-card{min-height:0;min-width:0}
.pp-pt-textcard{flex:1.35;display:flex;flex-direction:column;justify-content:center;gap:10px;overflow:auto;padding:14px 18px}
.pp-pt-qtext{margin:0;font-size:1.2rem;line-height:1.65;font-weight:500}
.pp-pt-qtext.big{font-size:1.5rem;line-height:1.7}
.pp-pt-diag{flex:1;position:relative;padding:6px}
.pp-pt-cv{display:block;width:100%;height:100%}
.pp-pt-table{border-collapse:collapse;width:100%;font-size:1rem;text-align:center}
.pp-pt-table th,.pp-pt-table td{padding:5px 10px;border:1px solid var(--pp-line,rgba(160,190,255,.18))}
.pp-pt-table thead th{background:rgba(78,161,255,.14);color:var(--pp-accent-2,#7cc4ff)}
.pp-pt-table tbody th{text-align:start;font-weight:700}
.pp-pt-opts{display:grid;grid-template-columns:repeat(var(--n,5),minmax(0,1fr));gap:10px;flex:none}
.pp-pt-opt{position:relative;display:flex;align-items:center;justify-content:center;gap:9px;min-height:54px;padding:8px 10px;border-radius:12px;border:1.5px solid var(--pp-line,rgba(160,190,255,.18));background:var(--pp-panel,#182742);color:var(--pp-text,#e8eefc);font:700 1.05rem 'Heebo',sans-serif;cursor:pointer;transition:transform .12s,border-color .12s,background .2s,box-shadow .2s}
.pp-pt-opt:hover:not(:disabled){border-color:var(--pp-accent,#4ea1ff);transform:translateY(-2px);background:#1d3052}
.pp-pt-opt:disabled{cursor:default}
.pp-pt-opt .n{flex:none;display:grid;place-items:center;width:26px;height:26px;border-radius:8px;background:#0a1120;color:#fff;font:800 .85rem ui-monospace,Menlo,monospace;box-shadow:inset 0 0 0 1px var(--pp-line,rgba(160,190,255,.18))}
.pp-pt-opt .t{min-width:0;text-align:center;line-height:1.25}
.pp-pt-opt.sel{background:var(--pp-accent,#4ea1ff);border-color:#fff;color:#06142c}
.pp-pt-opt.sel .n{background:#06142c}
.pp-pt-opt.ok{background:rgba(76,210,154,.22);border-color:var(--pp-good,#4cd29a);box-shadow:0 0 0 2px rgba(76,210,154,.35)}
.pp-pt-opt.bad{background:rgba(255,107,107,.2);border-color:var(--pp-bad,#ff6b6b)}
.pp-pt-opt.dim{opacity:.55}
.pp-pt-opt.thumb{flex-direction:column;gap:5px;padding:6px 6px 8px}
.pp-pt-opt.thumb canvas{display:block;width:100%;height:var(--thumb-h,100px);border-radius:8px}
.pp-pt-opt.thumb .n{position:absolute;top:10px;inset-inline-start:10px}
.pp-pt-foot{display:flex;align-items:center;gap:12px;min-height:40px;flex:none}
.pp-pt-skip{min-height:38px;padding:0 16px;font-size:.95rem;display:inline-flex;align-items:center;gap:8px}
.pp-pt-note{font-size:.85rem;color:var(--pp-warn,#ffc857);font-weight:700}
.pp-pt-hint{margin-inline-start:auto;font-size:.82rem;color:var(--pp-muted,#9fb0d3);display:flex;align-items:center;gap:5px;white-space:nowrap}
.pp-pt-explain{flex:1;display:flex;align-items:center;gap:14px;padding:8px 14px;border-radius:12px;background:var(--pp-panel,#182742);box-shadow:inset 0 0 0 1.5px var(--pp-line,rgba(160,190,255,.18));animation:pp-pt-in .25s ease both;max-height:150px;overflow:auto}
.pp-pt-explain.ok{box-shadow:inset 0 0 0 2px var(--pp-good,#4cd29a)}
.pp-pt-explain.bad{box-shadow:inset 0 0 0 2px var(--pp-bad,#ff6b6b)}
.pp-pt-explain .msg{flex:1;font-size:.95rem;line-height:1.55}
.pp-pt-explain .msg b{display:block;font-size:1.05rem;margin-bottom:2px}
.pp-pt-cubecard{flex:1.5;display:flex;flex-direction:column;padding:0;overflow:hidden}
.pp-pt-cubecard .pp-pt-cv{flex:1;min-height:0;height:auto}
.pp-pt-cubecap{flex:none;padding:5px 10px 7px;text-align:center;font-size:.76rem;line-height:1.35;color:var(--pp-muted,#9fb0d3)}
.pp-pt-script{flex:1;max-width:380px;display:flex;flex-direction:column;gap:8px;padding:12px 14px;overflow:auto}
.pp-pt-script .pp-pt-qtext{font-size:1.02rem;line-height:1.5}
.pp-pt-steps{display:grid;grid-template-columns:auto 1fr 1fr;gap:4px 6px;align-items:center;font-size:.92rem}
.pp-pt-steps .h{font-size:.78rem;color:var(--pp-muted,#9fb0d3);text-align:center;font-weight:700}
.pp-pt-steps .k{font-weight:800;color:var(--pp-muted,#9fb0d3);text-align:center;min-width:22px}
.pp-pt-steps .c{padding:4px 6px;border-radius:8px;text-align:center;font-weight:700;transition:background .2s,box-shadow .2s}
.pp-pt-steps .c.r{background:rgba(255,77,94,.16);color:#ffc2c8}
.pp-pt-steps .c.b{background:rgba(61,147,255,.18);color:#bcdcff}
.pp-pt-steps .c.cur{box-shadow:0 0 0 2px #ffc857}
.pp-pt-steps .c.done{opacity:.6}
.pp-pt-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-inline-end:4px;vertical-align:middle}
.pp-pt-dot.r{background:#ff4d5e}.pp-pt-dot.b{background:#3d93ff}
.pp-pt-play{align-self:flex-start;min-height:36px;padding:0 16px;font-size:.92rem}
.pp-pt-sum{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;animation:pp-pt-in .35s ease both;overflow:auto;padding:4px}
.pp-pt-ring{position:relative;width:132px;height:132px;flex:none}
.pp-pt-ring svg{width:100%;height:100%;transform:rotate(-90deg)}
.pp-pt-ring circle{fill:none;stroke-width:11;stroke-linecap:round}
.pp-pt-ring .bg{stroke:rgba(255,255,255,.1)}
.pp-pt-ring .fg{stroke-dasharray:339.3;animation:pp-pt-ring 1s ease-out both}
@keyframes pp-pt-ring{from{stroke-dashoffset:339.3}}
.pp-pt-ring b{position:absolute;inset:0;display:grid;place-items:center;font:400 2rem 'Secular One','Heebo',sans-serif;direction:ltr}
.pp-pt-sum h3{margin:0;font:400 1.35rem 'Secular One','Heebo',sans-serif}
.pp-pt-sum p{margin:0;max-width:560px;line-height:1.6;font-size:.98rem;color:var(--pp-text,#e8eefc)}
.pp-pt-sum .small{font-size:.8rem;color:var(--pp-muted,#9fb0d3)}
.pp-pt-dots{display:flex;flex-wrap:wrap;gap:7px;justify-content:center}
.pp-pt-dots i{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;font:800 .72rem ui-monospace,monospace;font-style:normal;color:#06142c}
.pp-pt-dots i.ok{background:var(--pp-good,#4cd29a)}
.pp-pt-dots i.bad{background:var(--pp-bad,#ff6b6b)}
.pp-pt-dots i.skip{background:#6b7a99}
.pp-pt-legend{display:flex;gap:14px;font-size:.78rem;color:var(--pp-muted,#9fb0d3)}
.pp-pt-narrow .pp-pt-stim{flex-direction:column;gap:8px}
.pp-pt-narrow .pp-pt-textcard{flex:none;max-height:46%;padding:10px 12px}
.pp-pt-narrow .pp-pt-qtext,.pp-pt-narrow .pp-pt-qtext.big{font-size:1.05rem;line-height:1.55}
.pp-pt-narrow .pp-pt-diag{flex:1;min-height:90px}
.pp-pt-narrow .pp-pt-opts{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
.pp-pt-narrow .pp-pt-opt{min-height:46px;font-size:.95rem;padding:6px}
.pp-pt-narrow .pp-pt-script{max-width:none;flex:none;padding:8px 10px}
.pp-pt-narrow .pp-pt-cubecard{flex:1;min-height:170px}
.pp-pt-narrow .pp-pt-hint{display:none}
.pp-pt-narrow .pp-pt-time{font-size:1.15rem}
.pp-pt-narrow .pp-pt-title{display:none}
.pp-pt-narrow .pp-pt-explain{flex-direction:column;align-items:stretch;gap:6px;padding:6px 10px}
.pp-pt-short .pp-pt-textcard{padding:8px 12px}
.pp-pt-short .pp-pt-qtext{font-size:1rem;line-height:1.45}
.pp-pt-short .pp-pt-sum{gap:8px}
.pp-pt-short .pp-pt-ring{width:96px;height:96px}
.pp-pt-short .pp-pt-ring b{font-size:1.5rem}
@media (prefers-reduced-motion:reduce){.pp-pt-q.in,.pp-pt-q.out,.pp-pt-sum,.pp-pt-explain,.pp-pt-ring .fg{animation:none}.pp-pt-time.crit{animation:none}}
`;

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}

function h(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

/* ============================================================================================
   Views - one per question, built on demand
   ============================================================================================ */

function optionButton(i, content, extra = '') {
  const b = h('button', 'pp-pt-opt ' + extra);
  b.type = 'button';
  b.tabIndex = -1;
  b.dataset.i = String(i);
  b.setAttribute('aria-label', `תשובה ${i + 1}`);
  b.innerHTML = `<span class="n">${i + 1}</span>`;
  if (typeof content === 'string') b.insertAdjacentHTML('beforeend', `<span class="t">${content}</span>`);
  else b.appendChild(content);
  b.addEventListener('mousedown', (e) => e.preventDefault());
  return b;
}

function viewQuant(q) {
  const root = h('div');
  const stim = h('div', 'pp-pt-stim');
  const card = h('div', 'pp-card pp-pt-textcard');
  card.appendChild(h('p', 'pp-pt-qtext' + (q.diagram || q.table ? '' : ' big'), q.html));
  if (q.table) card.insertAdjacentHTML('beforeend', q.table);
  stim.appendChild(card);
  const draws = [];
  if (q.diagram) {
    const dg = h('div', 'pp-card pp-pt-diag');
    const cv = h('canvas', 'pp-pt-cv');
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', 'איור לשאלה');
    dg.appendChild(cv);
    stim.appendChild(dg);
    draws.push({ canvas: cv, animated: true, draw: (ctx, w, hh, t) => drawQuantDiagram(ctx, w, hh, t, q.diagram) });
  }
  const opts = h('div', 'pp-pt-opts');
  opts.style.setProperty('--n', String(q.options.length));
  const buttons = q.options.map((o, i) => optionButton(i, o));
  buttons.forEach((b) => opts.appendChild(b));
  root.append(stim, opts);
  return { el: root, draws, buttons, update() {}, destroy() {} };
}

function viewCube(q, api) {
  const root = h('div');
  const stim = h('div', 'pp-pt-stim');
  const script = h('div', 'pp-card pp-pt-script');
  script.appendChild(h('p', 'pp-pt-qtext', q.text));
  const steps = h('div', 'pp-pt-steps');
  steps.innerHTML = `<span class="h">צעד</span><span class="h"><i class="pp-pt-dot r"></i>האדומה</span><span class="h"><i class="pp-pt-dot b"></i>הכחולה</span>`;
  const cells = [];
  for (let i = 0; i < q.L; i++) {
    steps.appendChild(h('span', 'k', String(i + 1)));
    const cr = h('span', 'c r', q.wordsR[i]);
    const cb = h('span', 'c b', q.wordsB[i]);
    steps.append(cr, cb);
    cells.push([cr, cb]);
  }
  script.appendChild(steps);
  const play = h('button', 'pp-btn secondary pp-pt-play', '▶ הצג צעדים');
  play.type = 'button';
  play.tabIndex = -1;
  play.addEventListener('mousedown', (e) => e.preventDefault());
  script.appendChild(play);
  const card = h('div', 'pp-card pp-pt-cubecard');
  const cv = h('canvas', 'pp-pt-cv');
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', 'קובייה תלת־ממדית עם שתי נקודות');
  card.appendChild(cv);
  card.appendChild(h('div', 'pp-pt-cubecap', 'בכל צעד שתי הנקודות נעות בו־זמנית לאורך קצה אחד של הקובייה. מפגש נחשב רק כששתיהן באותו קדקוד בסוף צעד.'));
  stim.append(script, card);
  const anim = { step: 0, playing: false, lastWhole: 0 };
  play.addEventListener('click', () => {
    if (anim.step >= q.L - 1e-6) anim.step = 0;
    anim.playing = true;
    anim.lastWhole = 0;
    api.fx?.click?.();
  });
  const opts = h('div', 'pp-pt-opts');
  opts.style.setProperty('--n', String(q.options.length));
  const buttons = q.options.map((o, i) => optionButton(i, o));
  buttons.forEach((b) => opts.appendChild(b));
  root.append(stim, opts);
  const view = {
    el: root,
    buttons,
    draws: [{ canvas: cv, animated: true, draw: (ctx, w, hh, t) => drawCube(ctx, w, hh, t, q, anim) }],
    update(dt) {
      if (anim.playing) {
        anim.step = Math.min(q.L, anim.step + dt / 1.1);
        const whole = Math.floor(anim.step + 1e-6);
        if (whole !== anim.lastWhole) {
          anim.lastWhole = whole;
          try {
            tone(520 + whole * 90, 0.09, { type: 'triangle', volume: 0.05 });
          } catch {
            /* sound is optional */
          }
        }
        if (anim.step >= q.L) {
          anim.playing = false;
          play.textContent = '↻ שוב';
        } else play.textContent = '… מציג';
      }
      const s = anim.step;
      cells.forEach(([cr, cb], i) => {
        const cur = anim.playing && Math.floor(s) === i;
        const done = s >= i + 1 - 1e-6;
        cr.classList.toggle('cur', cur);
        cb.classList.toggle('cur', cur);
        cr.classList.toggle('done', done && !cur);
        cb.classList.toggle('done', done && !cur);
      });
    },
    destroy() {},
    anim,
  };
  return view;
}

function viewPlane(q) {
  const root = h('div');
  const stim = h('div', 'pp-pt-stim');
  const card = h('div', 'pp-card pp-pt-textcard');
  card.style.flex = '0.8';
  card.appendChild(h('p', 'pp-pt-qtext', q.text));
  card.appendChild(h('p', 'pp-pt-qtext', '<span class="small" style="font-size:.85rem;color:var(--pp-muted)">המספרים בסולם הם מעלות מעל האופק (עליון) או מתחתיו (תחתון). הסימן הצהוב הוא מטוס הייחוס הקבוע בתא.</span>'));
  const cockpit = h('div', 'pp-card pp-pt-diag');
  cockpit.style.flex = '1.5';
  cockpit.style.padding = '4px';
  const cv = h('canvas', 'pp-pt-cv');
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', 'נוף מתא הטייס: האופק והאדמה');
  cockpit.appendChild(cv);
  stim.append(card, cockpit);
  const draws = [{ canvas: cv, animated: false, draw: (ctx, w, hh) => drawCockpit(ctx, w, hh, q.theta, q.phi) }];
  const opts = h('div', 'pp-pt-opts');
  opts.style.setProperty('--n', String(q.options.length));
  const buttons = q.attitudes.map((a, i) => {
    const c = h('canvas');
    c.setAttribute('aria-hidden', 'true');
    draws.push({ canvas: c, animated: false, draw: (ctx, w, hh) => drawPlaneView(ctx, w, hh, a.theta, a.phi) });
    const b = optionButton(i, c, 'thumb');
    return b;
  });
  buttons.forEach((b) => opts.appendChild(b));
  root.append(stim, opts);
  return { el: root, draws, buttons, update() {}, destroy() {} };
}

const VIEWS = { quant: viewQuant, cube: viewCube, plane: viewPlane };

/* ============================================================================================
   The runner
   ============================================================================================ */

export function runPsychotech(id, container, options = {}) {
  const def = PSYCHOTECH_TESTS.find((t) => t.id === id);
  if (!def) return Promise.reject(new Error(`psychotech: unknown test "${id}"`));
  const { practice = false, fx, onProgress } = options;
  const count = practice ? 2 : Math.max(1, Math.round(options.count ?? 8));
  const seconds = Math.max(5, options.seconds ?? 150);
  injectStyles();
  const questions = GENERATORS[id](count, practice);
  const nOpt = questions[0].options.length;
  const play = (name) => {
    try {
      fx?.[name]?.();
    } catch {
      /* sound is optional */
    }
  };

  return new Promise((resolve) => {
    const root = h('div', 'pp-pt-root');
    root.innerHTML = `
      <div class="pp-pt-head">
        <span class="pp-pt-count"></span>
        <span class="pp-pt-title"></span>
        <span class="pp-tag prep">לפי אתרי הכנה</span>
        <span class="pp-pt-time" role="timer"></span>
      </div>
      <div class="pp-bar pp-pt-bar"><i></i></div>
      <div class="pp-pt-stage"></div>
      <div class="pp-pt-foot"></div>`;
    container.appendChild(root);
    const $ = (s) => root.querySelector(s);
    const elCount = $('.pp-pt-count');
    const elTime = $('.pp-pt-time');
    const elBar = $('.pp-pt-bar');
    const elFill = $('.pp-pt-bar > i');
    const stage = $('.pp-pt-stage');
    const foot = $('.pp-pt-foot');
    $('.pp-pt-title').textContent = def.title + (practice ? ' - תרגול' : '');

    let index = 0;
    let timeLeft = practice ? Infinity : seconds;
    let elapsed = 0;
    let anim = 0;
    let phase = 'question'; // question | feedback | summary
    let qStartElapsed = 0;
    let view = null;
    const olds = new Set();
    const answers = [];
    let result = null;
    let lastTickSecond = -1;
    let finished = false;

    /* ----- foot: skip / hint / explanation ----- */
    function buildFoot() {
      foot.textContent = '';
      const skip = h('button', 'pp-btn secondary pp-pt-skip', 'דלג <span class="pp-kbd">Space</span>');
      skip.type = 'button';
      skip.tabIndex = -1;
      skip.addEventListener('mousedown', (e) => e.preventDefault());
      skip.addEventListener('click', () => doSkip());
      foot.appendChild(skip);
      if (def.penalty) foot.appendChild(h('span', 'pp-pt-note', 'טעות מורידה ניקוד - עדיף לדלג מלנחש'));
      else if (!practice) foot.appendChild(h('span', 'pp-pt-note', 'אין ניקוד שלילי - כדאי לנחש'));
      foot.appendChild(h('span', 'pp-pt-hint', `בחירה במקשים <span class="pp-kbd">1</span>–<span class="pp-kbd">${nOpt}</span>`));
    }

    function showExplain(chosen, q) {
      foot.textContent = '';
      const isOk = chosen === q.correct;
      const box = h('div', 'pp-pt-explain ' + (chosen === null ? '' : isOk ? 'ok' : 'bad'));
      const head = chosen === null ? 'דילגת על השאלה' : isOk ? 'נכון!' : 'לא מדויק';
      const msg = h('div', 'msg', `<b>${head}</b>${q.explain}`);
      const btn = h('button', 'pp-btn pp-pt-skip', 'המשך <span class="pp-kbd">Enter</span>');
      btn.type = 'button';
      btn.addEventListener('click', () => proceed());
      box.append(msg, btn);
      foot.appendChild(box);
    }

    /* ----- layout classes ----- */
    function applySize() {
      const w = container.clientWidth;
      const hh = container.clientHeight;
      root.classList.toggle('pp-pt-narrow', w > 0 && w < 640);
      root.classList.toggle('pp-pt-short', hh > 0 && hh < 460);
      root.style.setProperty('--thumb-h', `${Math.round(clamp(hh * 0.25, 66, 150))}px`);
      if (w > 0 && w < 640) root.style.setProperty('--thumb-h', `${Math.round(clamp(hh * 0.12, 54, 80))}px`);
    }

    /* ----- header ----- */
    function paintHeader() {
      elCount.textContent = phase === 'summary' ? 'סיכום' : `שאלה ${Math.min(index + 1, count)} / ${count}`;
      if (practice) {
        elTime.textContent = 'תרגול';
        elTime.className = 'pp-pt-time';
        elFill.style.width = '100%';
        elBar.className = 'pp-bar pp-pt-bar';
        return;
      }
      const tl = Math.max(0, timeLeft);
      const m = Math.floor(Math.ceil(tl) / 60);
      const s = Math.ceil(tl) % 60;
      elTime.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      const frac = clamp(tl / seconds, 0, 1);
      elFill.style.width = `${frac * 100}%`;
      const cls = tl <= 10 || frac <= 0.1 ? 'crit' : frac <= 0.34 ? 'warn' : '';
      elBar.className = 'pp-bar pp-pt-bar ' + cls;
      elTime.className = 'pp-pt-time ' + cls;
    }

    /* ----- drawing ----- */
    function renderAll(force = false) {
      if (!view) return;
      for (const d of view.draws) {
        const f = fitCanvas(d.canvas);
        if (!f) continue;
        if (force || f.changed || d.animated || !d.drawn) {
          d.draw(f.ctx, f.w, f.h, anim);
          d.drawn = true;
        }
      }
    }

    /* ----- questions ----- */
    function mountQuestion() {
      const q = questions[index];
      const v = VIEWS[q.type](q, { fx });
      v.el.classList.add('pp-pt-q', 'in');
      if (view) {
        const old = view;
        old.el.classList.remove('in');
        old.el.classList.add('out');
        olds.add(old);
        setTimeout(() => {
          old.el.remove();
          olds.delete(old);
        }, 260);
      }
      stage.appendChild(v.el);
      view = v;
      v.buttons.forEach((b, i) => b.addEventListener('click', () => choose(i)));
      phase = 'question';
      qStartElapsed = elapsed;
      buildFoot();
      paintHeader();
      renderAll(true);
    }

    function record(chosen, how) {
      const q = questions[index];
      answers.push({
        index,
        chosen: chosen === null ? null : chosen + 1,
        correct: q.correct + 1,
        isCorrect: chosen !== null && chosen === q.correct,
        skipped: chosen === null,
        timedOut: how === 'timeout',
        seconds: Math.round((elapsed - qStartElapsed) * 10) / 10,
      });
      try {
        const c = answers.filter((a) => a.isCorrect).length;
        const sk = answers.filter((a) => a.skipped).length;
        onProgress?.({ index: answers.length, total: count, correct: c, wrong: answers.length - c - sk, skipped: sk });
      } catch {
        /* the caller's callback must not break the test */
      }
    }

    function choose(i) {
      if (phase !== 'question' || finished || i < 0 || i >= nOpt) return;
      const q = questions[index];
      play('click');
      record(i, 'answer');
      if (practice) {
        phase = 'feedback';
        view.buttons.forEach((b, k) => {
          b.disabled = true;
          b.classList.toggle('ok', k === q.correct);
          b.classList.toggle('bad', k === i && k !== q.correct);
          b.classList.toggle('dim', k !== q.correct && k !== i);
        });
        play(i === q.correct ? 'ok' : 'bad');
        showExplain(i, q);
        return;
      }
      view.buttons[i].classList.add('sel');
      next();
    }

    function doSkip() {
      if (phase !== 'question' || finished) return;
      const q = questions[index];
      play('click');
      record(null, 'skip');
      if (practice) {
        phase = 'feedback';
        view.buttons.forEach((b, k) => {
          b.disabled = true;
          b.classList.toggle('ok', k === q.correct);
          b.classList.toggle('dim', k !== q.correct);
        });
        showExplain(null, q);
        return;
      }
      next();
    }

    function proceed() {
      if (phase === 'feedback') next();
      else if (phase === 'summary') close();
    }

    function next() {
      index += 1;
      if (index >= count) finish();
      else mountQuestion();
    }

    /* ----- end ----- */
    function finish(timedOut = false) {
      if (finished) return;
      finished = true;
      // anything unanswered is skipped
      for (let i = answers.length; i < count; i++) {
        const q = questions[i];
        answers.push({ index: i, chosen: null, correct: q.correct + 1, isCorrect: false, skipped: true, timedOut: true, seconds: 0 });
      }
      const correct = answers.filter((a) => a.isCorrect).length;
      const skipped = answers.filter((a) => a.skipped).length;
      const wrong = count - correct - skipped;
      const score = def.penalty ? clamp((correct - wrong / 5) / count, 0, 1) : correct / count;
      const lines = [`ענית נכון על ${correct} מתוך ${count} שאלות (טעית ב־${wrong}, דילגת על ${skipped}).`];
      if (timedOut) lines.push('הזמן נגמר לפני שסיימת, ושאלות שלא הגעת אליהן נחשבות כדילוג.');
      if (def.penalty) {
        if (wrong > 0) lines.push(`בקובייה יש ניקוד שלילי: ${wrong} טעויות הורידו ${fmt(wrong / 5)} שאלות מהציון.`);
        else if (skipped > 0) lines.push('דילוג על שאלות לא הוריד ניקוד - זו אסטרטגיה סבירה בקובייה.');
      } else if (skipped > 0 && !practice) lines.push('במבחן הזה אין ניקוד שלילי, אז תמיד כדאי לנחש במקום לדלג.');
      lines.push('(התרגול כאן מבוסס על תיאורי אתרי הכנה, והשאלות נוצרו במשחק - לא שאלות אמיתיות.)');
      result = { correct, wrong, skipped, total: count, score, summary: lines.join(' '), answers: answers.map((a) => ({ ...a })), timedOut };
      phase = 'summary';
      play('done');
      showSummary(lines, timedOut);
    }

    function showSummary(lines, timedOut) {
      if (view) {
        view.el.classList.remove('in');
        view.el.classList.add('out');
        const old = view;
        setTimeout(() => old.el.remove(), 260);
        view = null;
      }
      foot.textContent = '';
      const pct = Math.round(result.score * 100);
      const color = pct >= 70 ? 'var(--pp-good,#4cd29a)' : pct >= 40 ? 'var(--pp-warn,#ffc857)' : 'var(--pp-bad,#ff6b6b)';
      const sum = h('div', 'pp-pt-sum');
      const off = (339.3 * (1 - result.score)).toFixed(1);
      sum.innerHTML = `
        <h3>${def.title}${practice ? ' - תרגול' : ''}</h3>
        <div class="pp-pt-ring"><svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="54"/><circle class="fg" cx="60" cy="60" r="54" style="stroke:${color};stroke-dashoffset:${off}"/></svg><b>${pct}%</b></div>
        <div class="pp-pt-dots">${answers.map((a, i) => `<i class="${a.isCorrect ? 'ok' : a.skipped ? 'skip' : 'bad'}" title="שאלה ${i + 1}">${i + 1}</i>`).join('')}</div>
        <div class="pp-pt-legend"><span>ירוק: נכון (${result.correct})</span><span>אדום: טעות (${result.wrong})</span><span>אפור: דילוג (${result.skipped})</span></div>
        <p>${lines.slice(0, -1).join(' ')}</p>
        <p class="small">${lines[lines.length - 1]}</p>`;
      const btn = h('button', 'pp-btn', 'המשך');
      btn.type = 'button';
      btn.addEventListener('click', () => close());
      sum.appendChild(btn);
      stage.appendChild(sum);
      paintHeader();
      elTime.textContent = timedOut ? 'נגמר הזמן' : 'הסתיים';
      elTime.className = 'pp-pt-time';
      elFill.style.width = practice ? '100%' : `${clamp(timeLeft / seconds, 0, 1) * 100}%`;
      setTimeout(() => btn.focus({ preventScroll: true }), 50);
    }

    function close() {
      if (phase !== 'summary' || !result) return;
      cleanup();
      resolve(result);
    }

    function cleanup() {
      cancelAnimationFrame(raf);
      clearInterval(timer);
      document.removeEventListener('keydown', onKey, true);
      ro?.disconnect();
      root.remove();
      olds.clear();
      if (container.__task) delete container.__task;
    }

    /* ----- time ----- */
    function step(dt) {
      if (finished || dt <= 0) return;
      elapsed += dt;
      anim += Math.min(dt, 0.1);
      if (phase === 'question' && !practice) {
        timeLeft -= dt;
        if (timeLeft <= 10 && timeLeft > 0) {
          const sec = Math.ceil(timeLeft);
          if (sec !== lastTickSecond) {
            lastTickSecond = sec;
            play('tick');
          }
        }
        if (timeLeft <= 0) {
          timeLeft = 0;
          paintHeader();
          finish(true);
          return;
        }
      }
      view?.update(dt);
      paintHeader();
      renderAll();
    }

    let last = performance.now();
    let raf = 0;
    const frame = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      step(dt);
      raf = requestAnimationFrame(frame);
    };
    // A timer as well, so the clock keeps running when the tab throttles animation frames.
    const timer = setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      if (dt > 0.2) {
        last = now;
        step(dt);
      }
    }, 250);

    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (finished && phase !== 'summary') return;
      const k = e.key;
      if (phase === 'summary') {
        if (k === 'Enter' || k === ' ') {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
        return;
      }
      if (/^[1-9]$/.test(k)) {
        e.preventDefault();
        e.stopPropagation();
        if (phase === 'question') choose(Number(k) - 1);
      } else if (k === ' ' || k === 'Spacebar') {
        e.preventDefault();
        e.stopPropagation();
        if (phase === 'question') doSkip();
        else if (phase === 'feedback') proceed();
      } else if (k === 'Enter' && phase === 'feedback') {
        e.preventDefault();
        e.stopPropagation();
        proceed();
      }
    }
    document.addEventListener('keydown', onKey, true);

    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
      applySize();
      renderAll(true);
    }) : null;
    ro?.observe(container);
    applySize();
    mountQuestion();
    raf = requestAnimationFrame(frame);

    if (import.meta.env && import.meta.env.DEV) {
      container.__task = {
        advance(sec) {
          // fine steps so animations and the clock behave as in real time
          let left = sec;
          while (left > 0 && !finished) {
            const d = Math.min(left, 0.1);
            step(d);
            left -= d;
          }
          if (finished && phase !== 'summary') return;
        },
        answer(n) {
          choose(n - 1);
        },
        skip() {
          doSkip();
        },
        proceed,
        state() {
          const q = questions[index];
          return {
            index,
            total: count,
            correctIndex: q && !finished ? q.correct : -1,
            correctOption: q && !finished ? q.correct + 1 : -1,
            timeLeft,
            phase,
            type: q?.type,
            question: q,
            result,
          };
        },
      };
    }
  });
}

/** Exposed for self-tests (not used by the game). */
export const psychotechInternals = {
  genQuant,
  genCube,
  genPlane,
  cubeQuestion,
  planeQuestion,
  moveWord,
  simulate,
  firstMeeting,
  farApart,
  bodyToWorld,
  cockpitParams,
  projectPlane,
  drawPlaneView,
  drawCockpit,
  MODEL,
  VERTEX_LETTERS,
  AXES,
};
