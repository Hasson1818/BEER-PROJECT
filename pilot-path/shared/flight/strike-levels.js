import * as THREE from 'three';

// The missions of the second simulator (ירפ״א ב׳): 20 training missions that each teach one thing, then 30 tests that
// mix everything and get harder. What is described by candidates and prep sites: navigation from memory, a map that is
// shown for a few seconds, a mini-map with three circles (1, 2, 3 km), air and ground threats with alarms and defenses
// (air defense 15 s, ground defense 10 s, limited uses), targets worth different points, decoys you must not hit, a
// limited number of missiles, and radio calls. The mission list, the numbers and the points are ours: nothing in the
// public sources lists the real ones (see pilot-path/README.md).

export const POINTS = { cone: 30, square: 20, circle: 10 };

/** A stretch of low ground to fly over: the direction (degrees) with the lowest peaks within 12 km. */
export function findRegion(height) {
  let best = null;
  for (let a = 0; a < 360; a += 10) {
    const rad = THREE.MathUtils.degToRad(a);
    const dir = { x: Math.sin(rad), z: -Math.cos(rad) };
    let peak = 0;
    for (let d = -1500; d <= 12000; d += 250) {
      for (const off of [-1800, 0, 1800]) {
        peak = Math.max(peak, height(dir.x * d - dir.z * off, dir.z * d + dir.x * off));
      }
    }
    if (!best || peak < best.peak) best = { heading: a, peak, dir };
  }
  const { dir } = best;
  return {
    heading: best.heading,
    peak: best.peak,
    baseAlt: Math.max(900, best.peak + 420),
    /** A point `d` meters ahead and `off` meters to the right of the start. */
    at: (d, off = 0) => ({ x: dir.x * d - dir.z * off, z: dir.z * d + dir.x * off }),
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
    title: 'המיני־מפה',
    teaches: 'קריאת המיני־מפה',
    brief: ['בפינה מיני־מפה. המשולש האפור זה אתה, והיא מסתובבת איתך כך שקדימה זה למעלה.', 'שלושת העיגולים הם קילומטר, שניים ושלושה. הנקודה הבאה מסומנת עליה. נווט לפיה.'],
    make: (m) => {
      m.nav([{ d: 2400, off: -900 }, { d: 4800, off: 900 }], { hideRings: true });
      m.limit = 80;
    },
  },
  {
    title: 'מטרה ראשונה: ריבוע כתום',
    teaches: 'נעילה וירי טיל',
    brief: ['המטרה (ריבוע כתום) נראית גם בנוף וגם במיני־מפה. כוון את הכוונת אליה והחזק עד שהיא ננעלת, ואז שגר טיל.', 'לפי מועמד שעבר, מטרות שונות שוות ניקוד שונה: כאן מתחילים מהאמצעית.'],
    make: (m) => {
      m.target('square', 3200, 150);
      m.missiles = 3;
      m.destroy({ count: 1 });
      m.limit = 70;
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
    title: 'ניווט ותקיפה',
    teaches: 'לשלב ניווט עם תקיפה',
    brief: ['נקודה, מטרה ועוד נקודה. הכול באותה משימה.'],
    make: (m) => {
      m.nav([{ d: 2400, off: 0 }, { d: 6600, off: 200 }]);
      m.target('square', 4400, -900);
      m.missiles = 2;
      m.destroy({ count: 1 });
      m.limit = 100;
    },
  },
  {
    title: 'קריאת קשר',
    teaches: 'להגיב להוראות בקשר',
    brief: ['לפי אתרי הכנה יש רשת קשר, ותגובה שגויה עולה בנקודות. כשתקבל הוראה בקשר, בצע אותה: גובה או כיוון.'],
    make: (m) => {
      m.nav([{ d: 5200, off: 0 }]);
      m.radio([{ at: 8, alt: m.region.baseAlt + 500 }, { at: 24, heading: 70 }]);
      m.limit = 70;
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
      m.radio([{ at: 14, alt: m.region.baseAlt + 300 }]);
      m.limit = 110;
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

function testMission(i, total) {
  const k = i / Math.max(1, total - 1); // 0 .. 1
  const rnd = seeded(i * 7 + 3);
  const side = () => (rnd() < 0.5 ? -1 : 1) * (350 + rnd() * 900);
  return {
    title: `מבחן ${i + 1}`,
    teaches: k < 0.3 ? 'עדיין מסביר' : k < 0.7 ? 'עומס עולה' : 'כמעט בלי רגע לנשום',
    brief: [
      k < 0.15 ? 'המבחנים בנויים מהכול ביחד, והם הולכים ומתקשים.' : k < 0.5 ? 'יותר איומים, פחות זמן.' : k < 0.85 ? 'העומס גדל. כל התראה מחייבת תגובה.' : 'האחרונים. לפי אתרי הכנה, המטרה לעייף, אבל חייבים להמשיך.',
    ],
    make: (m) => {
      const wps = 1 + Math.round(k * 3 + rnd());
      const pts = [];
      for (let n = 0; n < wps; n++) pts.push({ d: 2200 + n * (1900 + rnd() * 500), off: side() * (0.6 + k * 0.6) });
      m.nav(pts, { hideRings: k > 0.35, memory: k > 0.55 });
      const nTargets = 1 + Math.round(k * 3 * rnd() + k * 2);
      const kinds = ['circle', 'square', 'cone'];
      for (let n = 0; n < nTargets; n++) m.target(kinds[Math.floor(rnd() * 3)], 3000 + n * 1500 + rnd() * 600, side());
      for (let n = 0; n < Math.round(k * 2.2); n++) m.decoy(3200 + n * 1700, side());
      for (let n = 0; n < Math.round(k * 4 * rnd() + k * 2); n++) m.site(2600 + n * 1500 + rnd() * 800, side() * 0.7);
      for (let n = 0; n < Math.round(k * 3 * rnd() + k * 1.5); n++) m.vehicle(2600 + n * 1700 + rnd() * 800, side() * 0.7, { heading: rnd() < 0.5 ? 80 : -80 });
      for (let n = 0; n < Math.round(k * 2.4 + rnd() * 0.8); n++) m.air({ d: 4600 + n * 2200, off: side() });
      m.missiles = Math.max(2, nTargets + 1 - Math.round(k * 1.5));
      m.destroy({ points: Math.round(20 + k * 30) });
      if (k > 0.25) m.radio([{ at: 10 + R(rnd() * 8), alt: m.region.baseAlt + 150 + R(rnd() * 500) }, ...(k > 0.6 ? [{ at: 28 + R(rnd() * 10), heading: R(rnd() * 360) }] : [])]);
      m.defense = { air: 6, ground: 6 };
      m.limit = Math.round(105 - k * 25);
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
