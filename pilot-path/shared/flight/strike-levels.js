import * as THREE from 'three';

// The missions of the second simulator (ירפ״א ב׳): 20 training missions that each teach one thing, then 30 tests that
// mix everything and get harder. What is described by candidates and prep sites: navigation from memory, a map that is
// shown for a few seconds, a mini-map with three circles (1, 2, 3 km), air and ground threats with alarms and defenses
// (air defense 15 s, ground defense 10 s, limited uses), targets worth different points, decoys you must not hit, a
// limited number of missiles, and radio calls. The mission list, the numbers and the points are ours: nothing in the
// public sources lists the real ones (see pilot-path/README.md).

export const POINTS = { cone: 30, square: 20, circle: 10 };

/** Routes are about this much longer than the distances written in the missions below. */
export const ROUTE_SCALE = 1.6;
export const MAX_AHEAD = 18500;
export const scaleD = (d) => Math.min(d * ROUTE_SCALE, MAX_AHEAD);

/**
 * A long stretch of low ground to fly over: the direction (degrees) with the lowest peaks. The start sits at the
 * back edge of the terrain so that a route can run about 19 km ahead.
 */
export function findRegion(height) {
  const BACK = 9000;
  let best = null;
  for (let a = 0; a < 360; a += 10) {
    const rad = THREE.MathUtils.degToRad(a);
    const dir = { x: Math.sin(rad), z: -Math.cos(rad) };
    let peak = 0;
    for (let d = -1200; d <= 19000; d += 400) {
      for (const off of [-2500, 0, 2500]) {
        const x = dir.x * (d - BACK) - dir.z * off;
        const z = dir.z * (d - BACK) + dir.x * off;
        peak = Math.max(peak, height(x, z));
      }
    }
    if (!best || peak < best.peak) best = { heading: a, peak, dir };
  }
  const { dir } = best;
  const start = { x: -dir.x * BACK, z: -dir.z * BACK };
  return {
    heading: best.heading,
    peak: best.peak,
    baseAlt: Math.max(900, best.peak + 420),
    start,
    /** A point `d` meters ahead and `off` meters to the right of the start. */
    at: (d, off = 0) => ({ x: start.x + dir.x * d - dir.z * off, z: start.z + dir.z * d + dir.x * off }),
  };
}

const R = (n) => Math.round(n);

// ---------- Training (20) ----------
// Each: title, teaches, brief, and make(m) which adds things to the mission m.

const TRAINING = [
  {
    title: 'היכרות עם הבקרים',
    teaches: 'סטיק ומצערת',
    brief: ['הסטיק מטה את המטוס, המצערת קובעת כמה מהר טסים. נסה את שניהם.', 'משימה: להחזיק מהירות בין 280 ל־340 קשר שש שניות רצופות.'],
    make: (m) => {
      m.hold({ speed: [280, 340], seconds: 6 });
      m.limit = 45;
    },
  },
  {
    title: 'איזון מהירות וגובה',
    teaches: 'גובה מול מהירות',
    brief: ['כשעולים המהירות יורדת, וכשיורדים היא עולה. צריך לאזן את הסטיק עם המצערת.', 'משימה: להחזיק גובה בטווח המסומן ומהירות בין 280 ל־340 שמונה שניות רצופות.'],
    make: (m) => {
      m.hold({ speed: [280, 340], alt: [m.region.baseAlt + 100, m.region.baseAlt + 400], seconds: 8 });
      m.limit = 55;
    },
  },
  {
    title: 'כיוון ונקודה ראשונה',
    teaches: 'ניווט לנקודה',
    brief: ['על המסך הטבעת הירוקה היא נקודת הציון. פנה אליה ועבור דרכה.', 'כדי לפנות מטים את המטוס (גלגול) ומושכים קלות את הסטיק אחורה.'],
    make: (m) => {
      m.nav([{ d: 2800, off: 300 }]);
      m.limit = 55;
    },
  },
  {
    title: 'שתי נקודות',
    teaches: 'ניווט בין נקודות',
    brief: ['אותה משימה, עם שתי נקודות. כל טבעת נעלמת כשעוברים אותה, והבאה נדלקת.'],
    make: (m) => {
      m.nav([{ d: 2200, off: -500 }, { d: 4600, off: 600 }]);
      m.limit = 70;
    },
  },
  {
    title: 'מפה וציר ניווט',
    teaches: 'סמלי המפה והציר',
    brief: [
      'לפני הטיסה תראה מפה עם סמלים (מסילה, כביש, שביל, נחל, קו מתח, יישוב) ועליה ציר הניווט שלך: הקו הירוק והנקודות המספריות. כל הסמלים נראים גם בנוף.',
      'בפינה מיני־מפה: המשולש האפור זה אתה, והיא מסתובבת איתך. שלושת העיגולים הם קילומטר, שניים ושלושה.',
      'אם תתרחק מהציר יישמע צליל סטייה חזק ומציק. תחזור לציר והוא ייפסק.',
    ],
    make: (m) => {
      m.nav([{ d: 2600, off: -900 }, { d: 5200, off: 900 }, { d: 7600, off: -300 }], { hideRings: true, corridor: 800, map: 'learn' });
      m.limit = 80;
    },
  },
  {
    title: 'מטרה ראשונה: ריבוע כתום',
    teaches: 'נעילה וירי טיל',
    brief: [
      'המטרה (ריבוע כתום) נראית בנוף ובמיני־מפה. הכוונת (עיגול על המסך) לא זזה עם המטוס: מזיזים אותה בנפרד עם Q שמאלה, E ימינה, R למעלה ו־F למטה (או עם הכפתורים בתחתית).',
      'הטה את המטוס לכיוון המטרה, העבר עליה את הכוונת והחזק עד שהיא ננעלת, ואז שגר טיל (רווח). אחוז הפגיעה על המסך הכי גבוה כשאתה בערך קילומטר מהמטרה.',
      'לפי מועמד שעבר, מטרות שונות שוות ניקוד שונה: כאן מתחילים מהאמצעית.',
    ],
    make: (m) => {
      m.target('square', 3200, 150);
      m.missiles = 3;
      m.destroy({ count: 1 });
      m.limit = 90;
    },
  },
  {
    title: 'חרוט תכלת',
    teaches: 'המטרה הכי יקרה',
    brief: ['החרוט התכלת הוא המטרה ששווה הכי הרבה נקודות. שים לב איך היא נראית מרחוק, ובמיני־מפה.'],
    make: (m) => {
      m.target('cone', 3400, -250);
      m.missiles = 3;
      m.destroy({ count: 1 });
      m.limit = 70;
    },
  },
  {
    title: 'סדר עדיפויות',
    teaches: 'מה להשמיד קודם',
    brief: ['שלוש מטרות ושני טילים בלבד: חרוט תכלת (הכי הרבה נקודות), ריבוע כתום, ועיגול ירוק (הכי מעט).', 'החלט במה לפגוע. הניקוד נקבע לפי מה שהשמדת.'],
    make: (m) => {
      m.target('circle', 2800, -700);
      m.target('square', 3800, 700);
      m.target('cone', 4800, 0);
      m.missiles = 2;
      m.destroy({ points: 50 });
      m.limit = 90;
    },
  },
  {
    title: 'מטרות דמה',
    teaches: 'לא לפגוע במה שאסור',
    brief: ['לפי אתרי הכנה יש מטרות פיתיון שאסור לפגוע בהן, ופגיעה בהן מורידה ניקוד. כאן הן אפורות.', 'השמד רק את מה שצבעוני.'],
    make: (m) => {
      m.target('cone', 3600, -300);
      m.decoy(2800, 500);
      m.decoy(4300, 600);
      m.missiles = 3;
      m.destroy({ count: 1 });
      m.limit = 80;
    },
  },
  {
    title: 'אויב קרקעי ראשון',
    teaches: 'התראה קרקעית והגנה',
    brief: ['ריבוע אדום במיני־מפה הוא טיל קרקעי. כשהוא בטווח שני קילומטר נשמע ביפ סכנה, וכשהוא בטווח קילומטר הוא יורה עליך.', 'לחץ על "הגנה קרקעית" (המקש 2) כשהוא בטווח הירי: היא פועלת 10 שניות. אל תבזבז אותה מוקדם מדי.'],
    make: (m) => {
      m.site(3000, 350);
      m.nav([{ d: 5200, off: 0 }]);
      m.limit = 70;
    },
  },
  {
    title: 'שני אויבים קרקעיים',
    teaches: 'ניהול הגנה קרקעית',
    brief: ['שני טילים קרקעיים בדרך אחת אחרי השנייה. ההגנות מוגבלות, לכן נצל כל הפעלה היטב.'],
    make: (m) => {
      m.site(2600, 250);
      m.site(4600, -250);
      m.nav([{ d: 6400, off: 0 }]);
      m.defense = { air: 6, ground: 4 };
      m.limit = 80;
    },
  },
  {
    title: 'רכבים עם טילים',
    teaches: 'אויב קרקעי נע',
    brief: ['משולש אדום קטן הוא רכב עם טילים קרקעיים, והוא זז. אותה התראה ואותה הגנה, אבל קשה יותר לשער מתי הוא ייכנס לטווח.'],
    make: (m) => {
      m.vehicle(2800, -400, { heading: 80 });
      m.vehicle(4200, 500, { heading: -90 });
      m.nav([{ d: 6000, off: 0 }]);
      m.limit = 80;
    },
  },
  {
    title: 'אויב אווירי ראשון',
    teaches: 'התראה והגנה אווירית',
    brief: ['משולש אדום צר וארוך במיני־מפה הוא מטוס אויב. בטווח שלושה קילומטר נשמע ביפ חזק ורציף.', 'כשהוא בתוך שני קילומטר הוא יורה: לחץ על "הגנה אווירית" (המקש 1). היא פועלת 15 שניות, ואם הוא עדיין קרוב כשהיא נגמרת הוא ימשיך לירות.'],
    make: (m) => {
      m.air({ d: 5200, off: 600 });
      m.nav([{ d: 4200, off: 0 }]);
      m.limit = 70;
    },
  },
  {
    title: 'אויב אווירי חוזר',
    teaches: 'הפעלה חוזרת של הגנה',
    brief: ['המטוס חולף ואז חוזר. אין זמן המתנה בין הפעלות, אבל מספר ההפעלות מוגבל לשש.'],
    make: (m) => {
      m.air({ d: 5000, off: 700 });
      m.air({ d: 7000, off: -700 });
      m.nav([{ d: 5200, off: 0 }]);
      m.defense = { air: 4, ground: 6 };
      m.limit = 80;
    },
  },
  {
    title: 'ניהול הגנות',
    teaches: 'אווירי וקרקעי ביחד',
    brief: ['איום אווירי וקרקעי באותה משימה. שני הצלילים שונים: הקרקעי מתחיל בשני קילומטר, האווירי בשלושה.'],
    make: (m) => {
      m.air({ d: 5000, off: 800 });
      m.site(3200, -300);
      m.nav([{ d: 6000, off: 0 }]);
      m.limit = 85;
    },
  },
  {
    title: 'ניווט תחת איום',
    teaches: 'להמשיך לנווט תחת לחץ',
    brief: ['צריך להגיע לכל הנקודות גם כשמצפצפים. בלי להיבהל.'],
    make: (m) => {
      m.air({ d: 4200, off: -800 });
      m.site(5200, 300);
      m.nav([{ d: 2200, off: -300 }, { d: 4600, off: 500 }, { d: 6600, off: 0 }]);
      m.limit = 100;
    },
  },
  {
    title: 'תקיפה תחת אש',
    teaches: 'להשמיד כשיורים עליך',
    brief: ['מטרה שמוגנת על ידי טיל קרקעי. נעל, ירה, והפעל הגנה בזמן.'],
    make: (m) => {
      m.target('cone', 4200, 100);
      m.site(3200, -200);
      m.site(4800, 400);
      m.missiles = 3;
      m.destroy({ count: 1 });
      m.limit = 90;
    },
  },
  {
    title: 'ניווט מהזיכרון',
    teaches: 'לשנן ציר ולטוס בלעדיו',
    brief: [
      'המפה תוצג עד 15 שניות ואז תיעלם. תשנן את הציר: כיוון, כמה זמן בכל קטע, ואילו סמלים עוברים לידו.',
      'אחר כך טסים לפי הזיכרון. בדרך יש מטרה לתקיפה. אם תסטה מהציר יישמע צליל הסטייה.',
    ],
    make: (m) => {
      m.nav([{ d: 2600, off: 0 }, { d: 6800, off: 500 }], { memory: true, hideRings: true, corridor: 800, map: 'memory' });
      m.target('square', 4400, -900);
      m.missiles = 2;
      m.destroy({ count: 1 });
      m.limit = 100;
    },
  },
  {
    title: 'קריאת קשר',
    teaches: 'לשמוע ולאשר, ולא לענות לאחרים',
    brief: [
      'בקשר יש טייסים בשמות של פירות. סימן הקריאה שלך מופיע בפינה. לא צריך לבצע פעולות: רק לאשר.',
      'אם אומרים רק את השם שלך: לחץ "קיבלתי קריאה" (Z). אם אומרים את השם שלך והוראה: לחץ "קיבלתי קריאה" וגם "שמעתי הוראה" (X). אם קוראים לפרי אחר: אל תלחץ על כלום.',
    ],
    make: (m) => {
      m.nav([{ d: 5400, off: 0 }], { corridor: 900 });
      m.radio([{ at: 8, kind: 'call' }, { at: 26, kind: 'order', instruction: 'עלה לגובה אלף וארבע מאות' }, { at: 46, kind: 'other' }, { at: 64, kind: 'order', instruction: 'פנה ימינה לכיוון שתיים שבעים' }]);
      m.limit = 90;
    },
  },
  {
    title: 'סיכום ההדרכה',
    teaches: 'הכול ביחד, בקצב רגוע',
    brief: [
      'הכול ביחד, בקצב נוח: ניווט, מטרות, איומים ושיחת קשר.',
      'סדר העדיפויות, לפי מועמד שעבר: חרוט תכלת הכי הרבה נקודות, ריבוע כתום אחריו, עיגול ירוק הכי פחות. לא פוגעים במטרות דמה, ולא מבזבזים טילים והגנות.',
    ],
    make: (m) => {
      m.nav([{ d: 2400, off: -400 }, { d: 5200, off: 500 }]);
      m.target('cone', 3800, 900);
      m.target('circle', 3000, -900);
      m.air({ d: 6200, off: 900 });
      m.missiles = 3;
      m.destroy({ points: 30 });
      m.radio([{ at: 16, kind: 'order', instruction: 'שמור גובה ותמשיך בציר' }, { at: 40, kind: 'other' }]);
      m.limit = 115;
    },
  },
];

// ---------- Tests (30): built from a difficulty that rises ----------

function seeded(i) {
  let s = (i + 1) * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const INSTRUCTIONS = [
  'עלה לגובה אלף וארבע מאות',
  'פנה ימינה לכיוון שתיים שבעים',
  'הקטן מהירות לשלוש מאות',
  'שמור גובה ותמשיך בציר',
  'ירד לגובה אלף ומאה',
  'פנה שמאלה לכיוון שמונים',
];
export const FRUITS = ['אפרסק', 'ענבים', 'שזיף', 'תפוז', 'אבטיח', 'תות', 'מלון', 'נקטרינה'];

function radioPlan(rnd, count, firstAt, gap) {
  const out = [];
  for (let n = 0; n < count; n++) {
    const r = rnd();
    out.push({ at: firstAt + n * gap + R(rnd() * 8), kind: r < 0.3 ? 'call' : r < 0.7 ? 'order' : 'other', instruction: INSTRUCTIONS[Math.floor(rnd() * INSTRUCTIONS.length)] });
  }
  return out;
}

function testMission(i, total) {
  const k = i / Math.max(1, total - 1); // 0 .. 1
  const rnd = seeded(i * 7 + 3);
  const side = () => (rnd() < 0.5 ? -1 : 1) * (350 + rnd() * 900);
  let lastD = 0;
  return {
    absLimit: true,
    title: `מבחן ${i + 1}`,
    teaches: k < 0.3 ? 'עדיין מסביר' : k < 0.7 ? 'עומס עולה' : 'כמעט בלי רגע לנשום',
    brief: [
      k < 0.15 ? 'המבחנים בנויים מהכול ביחד, והם הולכים ומתקשים.' : k < 0.5 ? 'יותר איומים, פחות זמן.' : k < 0.85 ? 'העומס גדל. כל התראה מחייבת תגובה.' : 'האחרונים. לפי אתרי הכנה, המטרה לעייף, אבל חייבים להמשיך.',
    ],
    make: (m) => {
      const wps = 2 + Math.round(k * 2.5 + rnd());
      const pts = [];
      for (let n = 0; n < wps; n++) pts.push({ d: 2800 + n * (2200 + rnd() * 400), off: side() * (0.6 + k * 0.6) });
      lastD = pts[pts.length - 1].d;
      m.nav(pts, { hideRings: k > 0.3, memory: true, map: 'memory', corridor: Math.round(850 - k * 300) });
      const nTargets = 1 + Math.round(k * 3 * rnd() + k * 2);
      const kinds = ['circle', 'square', 'cone'];
      for (let n = 0; n < nTargets; n++) m.target(kinds[Math.floor(rnd() * 3)], 3000 + n * 1500 + rnd() * 600, side());
      for (let n = 0; n < Math.round(k * 2.2); n++) m.decoy(3200 + n * 1700, side());
      for (let n = 0; n < Math.round(k * 4 * rnd() + k * 2); n++) m.site(2600 + n * 1500 + rnd() * 800, side() * 0.7);
      for (let n = 0; n < Math.round(k * 3 * rnd() + k * 1.5); n++) m.vehicle(2600 + n * 1700 + rnd() * 800, side() * 0.7, { heading: rnd() < 0.5 ? 80 : -80 });
      for (let n = 0; n < Math.round(k * 2.4 + rnd() * 0.8); n++) m.air({ d: 4600 + n * 2200, off: side() });
      m.missiles = Math.max(2, nTargets + 1 - Math.round(k * 1.5));
      m.destroy({ points: Math.round(20 + k * 30) });
      if (k > 0.12) m.radio(radioPlan(rnd, 1 + Math.round(k * 2.6 + rnd() * 0.8), 12 + R(rnd() * 6), 26));
      m.defense = { air: 6, ground: 6 };
      // About 130 m/s along the route, plus time for the maneuvers, tighter in the late tests.
      m.limit = Math.round(scaleD(lastD) / 125 + 55 - k * 15);
    },
  };
}

/** [{ id, phase: 'training'|'test', title, teaches, brief, make }]; `short` keeps a handful of each. */
export function buildMissions({ short = false } = {}) {
  const training = TRAINING.map((t, i) => ({ ...t, id: `t${i + 1}`, phase: 'training' }));
  const total = 30;
  const tests = Array.from({ length: total }, (_, i) => ({ ...testMission(i, total), id: `x${i + 1}`, phase: 'test' }));
  if (!short) return [...training, ...tests];
  const trainingPick = [0, 2, 4, 5, 9, 12, 19].map((i) => training[i]);
  const testPick = [0, 4, 9, 14, 19, 24, 27, 29].map((i) => tests[i]);
  return [...trainingPick, ...testPick];
}
