// The units and roles in the calculator, with their entry requirements and traits.
//
// Requirements come from the research "דרישות סף ליחידות צהל 2026" (read 17.11.2026): mostly the official role pages
// on mitgaisim.idf.il (undated, so "as read in 11.2026"), and prep sites where there is no official number. Every
// unit says where its numbers come from (`src`). KABA appears on no official combat page any more; the few KABA
// numbers here are from prep sites. Missing numbers are left out rather than guessed.
//
// `traits` (0..3, domain = land/sea/air/cyber) are the game's own judgement, built from the facts (service length,
// keva years, base, physical demand) for the fit questionnaire. They are not an official rating.
import { ENVIRONMENTS } from '../../yom-hamaa/src/content.js';

export const MAA_ENVS = ENVIRONMENTS;
export const PROFILES = [97, 82, 72, 64, 45, 25, 21];
export const DAPARS = [10, 20, 30, 40, 50, 60, 70, 80, 90];
export const KABAS = [41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56];
export const HEBREWS = [5, 6, 7, 8, 9];

export const CATEGORIES = {
  elite: 'יחידות מובחרות',
  infantry: 'חי״ר',
  ground: 'שריון, תותחנים והנדסה',
  border: 'גבולות, מג״ב ופקע״ר',
  air: 'חיל האוויר',
  navy: 'חיל הים',
  intel: 'מודיעין',
  cyber: 'סייבר, תקשוב וטכנולוגיה',
  excellence: 'תוכניות מצוינות',
  support: 'תפקידי עורף ותמיכה',
};

export const DISCLAIMER =
  'הספים לקוחים מדפי התפקידים באתר מתגייסים (נקראו 11.2026) ומאתרי הכנה, וכל יחידה מסומנת לפי המקור. זה לא מחשבון רשמי: השיבוץ האמיתי נקבע לפי צורכי הצבא, המיונים וההעדפות. התכונות בשאלון ההתאמה הן הערכה של המשחק.';

export const SOURCES = [
  ['דפי התפקידים באתר מתגייסים', 'https://www.mitgaisim.idf.il/roles/'],
  ['מתגייסים: יום המא״ה ושאלון ההעדפות', 'https://www.mitgaisim.idf.il/'],
];

// Trait tuple: combat, physical, elite, commitment, home, tech, people, brains, domain, outdoor, career, command.
const T = (combat, physical, elite, commitment, home, tech, people, brains, domain, outdoor, career, command) => ({ combat, physical, elite, commitment, home, tech, people, brains, domain, outdoor, career, command });
const MF = ['m', 'f'];
const M = ['m'];
const F = ['f'];
const OFF = 'רשמי (מתגייסים, 11.2026)';
const PREP = 'אתר הכנה';
const MIX = 'רשמי ואתרי הכנה';

export const UNITS = [
  // ---------- Elite ----------
  { id: 'matkal', cat: 'elite', name: 'סיירת מטכ״ל', req: { profile: 97, dapar: 50 }, gender: M, selection: 'יום סיירות וגיבוש מטכ״ל', src: PREP, note: 'אין דף תפקיד רשמי. פרופיל 97 לפי אתרי הכנה; דפ״ר 50 הוא הסף הרשמי ליום הסיירות. פיילוט ללוחמות מ־12.2024.', stage: '../gibbush-matkal/?new=1', traits: T(3, 3, 3, 2, 0, 1, 1, 3, 'land', 3, 1, 2) },
  { id: 'shayetet', cat: 'elite', name: 'שייטת 13', req: { profile: 82, dapar: 50, hebrew: 8 }, gender: M, selection: 'יום סיירות או גדנ״ע צלילה, וגיבוש שייטת', src: OFF, note: 'הדף הרשמי סותר את עצמו: פרופיל "97 או 82", ועברית 8 או 7.', stage: '../shayetet/?new=1', traits: T(3, 3, 3, 2, 0, 1, 1, 2, 'sea', 3, 1, 2) },
  { id: 'shaldag', cat: 'elite', name: 'שלדג', req: { profile: 82, dapar: 50 }, gender: M, selection: 'יום סיירות, מיון גופני וגיבוש', src: OFF, note: 'רשמי 82; יש אתרים שכותבים 97 ודפ״ר 80.', stage: '../gibbush-matkal/?new=1', traits: T(3, 3, 3, 2, 0, 1, 1, 2, ['land', 'air'], 3, 1, 2) },
  { id: 'u669', cat: 'elite', name: '669 · חילוץ והצלה מוטס', req: { profile: 97, dapar: 50 }, gender: MF, selection: 'יום סיירות או יום שדה, וגיבוש / דראפט', src: OFF, note: 'ללוחמות: פיילוט מ־11.2023.', stage: '../draft/?new=1&path=669', traits: T(3, 3, 3, 2, 0, 1, 3, 2, ['air', 'land'], 3, 2, 2) },
  { id: 'commando', cat: 'elite', name: 'חטיבת הקומנדו (מגלן, אגוז, דובדבן)', req: { profile: 82 }, gender: M, selection: 'יום סיירות, גיבוש או דראפט', src: OFF, note: 'דף רשמי אחד לכל יחידות הקומנדו. קב״א 51 לדובדבן לפי אתר הכנה.', stage: '../draft/?new=1&path=commando', traits: T(3, 3, 2.5, 1, 0, 0, 1, 1, 'land', 3, 0, 2) },
  { id: 'oketz', cat: 'elite', name: 'עוקץ · יחידת הכלבנים', req: { profile: 82 }, gender: MF, selection: 'גיבוש עוקץ (לוחמות: דרך גדוד גבול)', src: OFF, note: 'לוחמים מתחייבים לשנת קבע.', stage: '../oketz/?new=1', traits: T(3, 3, 2.5, 1, 0, 1, 2, 1, 'land', 3, 1, 1) },
  { id: 'yahalom', cat: 'elite', name: 'יהל״ם', req: { profile: 82, dapar: 50 }, gender: MF, selection: 'גיבוש יהל״ם', src: OFF, note: 'קב״א 52 לפי אתר הכנה. ללוחמות קבוע מ־12.2025.', traits: T(3, 3, 2.5, 1, 0, 3, 1, 2, 'land', 3, 2, 1) },
  { id: 'yaltam', cat: 'elite', name: 'ילת״ם', req: { profile: 82, dapar: 50 }, gender: MF, selection: 'מיון ייעודי', src: OFF, note: 'קב״א 51 לפי אתר הכנה.', traits: T(3, 3, 2.5, 1, 0, 2, 1, 2, 'sea', 3, 1, 1) },

  // ---------- Infantry ----------
  { id: 'golani', cat: 'infantry', name: 'גולני', req: { profile: 82 }, gender: M, src: OFF, note: 'לסיירת: גיבוש יחט״יות בטירונות.', stage: '../yechatiyot/?new=1', traits: T(3, 3, 1, 0, 1, 0, 1, 1, 'land', 3, 0, 2) },
  { id: 'tzanhanim', cat: 'infantry', name: 'צנחנים', req: { profile: 82 }, gender: M, selection: 'גיבוש צנחנים לפני הגיוס', src: MIX, note: 'פרופיל 82 וקב״א 47 (מתגייסים 2021).', stage: '../tzanhanim/?new=1', traits: T(3, 3, 1.5, 0, 1, 0, 1, 1, 'land', 3, 0, 2) },
  { id: 'givati', cat: 'infantry', name: 'גבעתי', req: { profile: 82 }, gender: M, src: OFF, note: 'לסיירת: גיבוש יחט״יות בטירונות.', stage: '../yechatiyot/?new=1', traits: T(3, 3, 1, 0, 1, 0, 1, 1, 'land', 3, 0, 2) },
  { id: 'nahal', cat: 'infantry', name: 'נח״ל', req: { profile: 82 }, gender: M, src: OFF, note: 'לסיירת: גיבוש יחט״יות בטירונות.', stage: '../yechatiyot/?new=1', traits: T(3, 3, 1, 0, 1, 0, 1, 1, 'land', 3, 0, 2) },
  { id: 'kfir', cat: 'infantry', name: 'כפיר', req: { profile: 82 }, gender: M, src: OFF, note: 'לחרוב וללוט״ר: גיבוש יחט״יות.', stage: '../yechatiyot/?new=1', traits: T(3, 3, 1, 0, 1, 0, 1, 1, 'land', 3, 0, 2) },

  // ---------- Armor, artillery, engineering ----------
  { id: 'armor', cat: 'ground', name: 'שריון', req: { profile: 72 }, gender: M, src: OFF, note: 'צוות טנק של ארבעה. ללוחמות: פלוגת טנקים בגבול מצרים; פיילוט נוסף אושר ל־11.2026 ולא אומת שנפתח.', traits: T(3, 2, 0, 0, 1, 2, 1, 1, 'land', 3, 1, 1) },
  { id: 'artillery', cat: 'ground', name: 'תותחנים', req: { profile: 72 }, gender: MF, src: OFF, note: 'דף רשמי מ־2025 כותב ללוחמות 97 וגיבוש: סתירה.', traits: T(2.5, 2, 0, 0, 1, 2, 1, 1, 'land', 2, 1, 1) },
  { id: 'engineering', cat: 'ground', name: 'הנדסה קרבית', req: { profile: 82 }, gender: M, src: OFF, traits: T(3, 3, 0.5, 0, 1, 2, 1, 1, 'land', 3, 1, 1) },

  // ---------- Border, Border Police, Home Front ----------
  { id: 'border', cat: 'border', name: 'גדודי גבול משולבים (קרקל, ברדלס, אריות הירדן, לביאי הבקעה, פנתר)', req: { profile: 72 }, gender: MF, src: OFF, note: 'בעיקר בדרום ובבקעה. לוחמות: קורס מיון של שבועיים אחרי הגיוס.', stage: '../lochamot/?new=1', traits: T(3, 2.5, 0, 0, 1, 0, 1, 1, 'land', 3, 0, 1) },
  { id: 'collection', cat: 'border', name: 'איסוף קרבי', req: { profile: 82 }, gender: MF, src: OFF, note: 'לפי הדף, אפשר גם 72 עם סעיפים מסוימים.', traits: T(2.5, 2, 0.5, 0, 1, 2, 1, 2, 'land', 3, 0, 1) },
  { id: 'magav', cat: 'border', name: 'מג״ב', req: { profile: 72 }, gender: MF, src: OFF, note: 'רשמי 72; מקורות ישנים כותבים 82.', traits: T(3, 2.5, 0, 0, 1, 0, 2, 1, 'land', 3, 1, 1) },
  { id: 'rescue', cat: 'border', name: 'חילוץ והצלה (פקע״ר)', req: { profile: 72 }, gender: MF, src: OFF, traits: T(2.5, 2.5, 0, 0, 1, 1, 3, 1, 'land', 3, 1, 1) },
  { id: 'airdef', cat: 'border', name: 'הגנה אווירית', req: { profile: 72 }, gender: MF, src: OFF, traits: T(2, 1.5, 0, 0, 1, 3, 1, 1, ['land', 'air'], 2, 1, 1) },

  // ---------- Air force ----------
  { id: 'pilot', cat: 'air', name: 'קורס טיס', req: { profile: 97, dapar: 60 }, gender: MF, selection: 'מסלול המיון לטיס (מבחנים, ירפ״א, פסיכולוג וגיבוש)', src: OFF, note: 'גיל עד 23. שלוש שנות קורס ו־7 שנות קבע.', stage: '../pilot-path/', traits: T(2.5, 1, 3, 3, 1, 3, 1, 3, 'air', 1, 3, 2) },
  { id: 'uav', cat: 'air', name: 'מטיס/ה כטב״ם', req: { profile: 64, dapar: 50 }, gender: MF, src: OFF, note: 'דורש ניסיון בהטסת טיסנים. קורס של 50 שבועות בפלמחים.', traits: T(1.5, 0, 1, 1, 2, 3, 0, 2, 'air', 0, 2, 0) },
  { id: 'airtech', cat: 'air', name: 'טכנאי/ת מטוסים', req: { profile: 64 }, gender: MF, src: 'רשמי (מתקציר חיפוש)', traits: T(0, 1, 0, 0, 2, 3, 0, 1, 'air', 1, 3, 0) },
  { id: 'flightctrl', cat: 'air', name: 'פקח/ית טיסה', req: { profile: 45, dapar: 60 }, gender: MF, src: PREP, note: 'הדפ״ר לפי אתר הכנה (07.2026). הפרופיל לא אומת.', traits: T(0, 0, 0.5, 0, 2, 2, 1, 3, 'air', 0, 2, 1) },
  { id: 'tzah', cat: 'air', name: 'מפענח/ת תצ״א', req: { profile: 45, dapar: 60, maa: { tech: 3, info: 3, spatial: 3, attention: 3 } }, gender: MF, selection: 'מבחני פענוח ממוחשבים וסיווג', src: OFF, note: 'לפי הדף: ארבעה ציונים ב־3. במחשבון: טכני, עיבוד מידע, מרחבי וקשב.', traits: T(0, 0, 0.5, 0, 2, 2, 0, 3, ['air', 'cyber'], 0, 2, 0) },
  { id: 'siminst', cat: 'air', name: 'מדריכת סימולטור טיסה', req: { profile: 45, dapar: 60, maa: { info: 4 } }, gender: F, src: PREP, note: 'שתי גרסאות של הדף הרשמי סותרות.', traits: T(0, 0, 0.5, 0, 2, 2, 3, 2, 'air', 0, 1, 1) },

  // ---------- Navy ----------
  { id: 'hovlim', cat: 'navy', name: 'קורס חובלים', req: { profile: 82, dapar: 60, maa: { tech: 3, info: 2, command: 4, team: 2, maturity: 2, effort: 2 } }, gender: MF, selection: 'יום גיבוש ימי, מיון מקוון וגיבוש של 5 ימים בעתלית', src: OFF, note: 'ציוני המא״ה רק לבנות. כ־2.5 שנות קורס ו־5 שנות קבע. העברית בדף סותרת (8 או 5).', stage: '../naval/?new=1', traits: T(2, 2, 3, 3, 0, 2, 1, 3, 'sea', 2, 2, 3) },
  { id: 'subs', cat: 'navy', name: 'צוללות', req: { profile: 82, dapar: 60, hebrew: 8 }, gender: M, selection: 'גיבוש של 5 ימים', src: OFF, note: 'קורס של כ־14 חודשים.', stage: '../naval/?new=1', traits: T(2, 1, 2, 1, 0, 3, 1, 2, 'sea', 1, 2, 1) },
  { id: 'snapir', cat: 'navy', name: 'לוחם/ת ים (סנפיר ועוד)', req: { profile: 72, dapar: 30, kaba: 47 }, gender: MF, selection: 'גיבוש של יומיים בחיפה', src: OFF, note: 'הדפ״ר בדף סותר (30 או 50). אתר הכנה: 30 לבנים, 50 לבנות.', traits: T(2.5, 2, 0.5, 0, 1, 1, 1, 1, 'sea', 3, 0, 1) },
  { id: 'navytech', cat: 'navy', name: 'טכנאי/ת אלקטרוניקה ימית', req: { profile: 72, maa: { tech: 2, info: 2 } }, gender: MF, src: 'רשמי (מתקציר חיפוש)', note: 'ציוני המא״ה לבנות.', traits: T(0.5, 1, 0, 0, 1, 3, 0, 1, 'sea', 1, 3, 0) },

  // ---------- Intelligence ----------
  { id: 'u8200', cat: 'intel', name: '8200', req: { profile: 25, dapar: 60 }, gender: MF, selection: 'מיון כלל חמ״ן ומבחני היחידה', src: PREP, note: 'יש אתרים שכותבים דפ״ר 70. מסלולים שונים מתחייבים מכמה חודשים עד 3 שנות קבע.', traits: T(0, 0, 1.5, 1, 2, 2, 0, 3, 'cyber', 0, 3, 1) },
  { id: 'specialintel', cat: 'intel', name: 'מסלול מודיעיני ייחודי', req: { profile: 25, dapar: 60 }, gender: MF, selection: 'כלל חמ״ן, ראיון מקצועי ומיון אישיותי', src: OFF, note: 'לבוגרי מגמות מדעיות. חצי שנת קבע.', traits: T(0, 0, 1.5, 0.5, 2, 1, 0, 3, 'cyber', 0, 2, 1) },
  { id: 'arabic', cat: 'intel', name: 'מסלולי ערבית במודיעין', req: { profile: 25, dapar: 50 }, gender: MF, selection: 'כלל חמ״ן', src: 'רשמי (מתקציר חיפוש)', note: '5 יחידות ערבית.', traits: T(0, 0, 1, 0, 2, 0, 0, 3, 'cyber', 0, 2, 0) },
  { id: 'u9900', cat: 'intel', name: '9900 · מודיעין חזותי', req: { profile: 25, dapar: 60 }, gender: MF, selection: 'מבחני היחידה', src: PREP, traits: T(0, 0, 1, 0, 2, 2, 0, 3, 'cyber', 0, 2, 0) },
  { id: 'intelresearch', cat: 'intel', name: 'חוקר/ת מודיעין (אוויר / ים)', req: { profile: 25, dapar: 60 }, gender: MF, selection: 'כלל חמ״ן', src: 'רשמי (מתקציר חיפוש)', note: 'הפרופיל לא אומת.', traits: T(0, 0, 1, 0, 2, 1, 0, 3, ['air', 'sea'], 0, 2, 1) },

  // ---------- Cyber, C4I, technology ----------
  { id: 'cyberdef', cat: 'cyber', name: 'מגן/ת בסייבר (תקשוב)', req: { profile: 25, dapar: 70, daparCombatMen: 80 }, gender: MF, selection: 'יום מיון מקצועות המחשב וסיווג ביטחוני', src: OFF, note: 'לבנים בפרופיל קרבי: דפ״ר 80 ו־10 יחידות מדעי המחשב. שנתיים קבע.', traits: T(0, 0, 1.5, 1.5, 2, 3, 0, 3, 'cyber', 0, 3, 1) },
  { id: 'mamram', cat: 'cyber', name: 'קורס תכנות ממר״ם', req: { profile: 25, dapar: 70 }, gender: MF, selection: 'מבחני "מחשבון קרב" ו"להב"', src: PREP, note: 'זימון בדפ״ר 60–70 לפי אתרי הכנה. הפרופיל לא אומת.', traits: T(0, 0, 1.5, 1.5, 2, 3, 0, 3, 'cyber', 0, 3, 0) },
  { id: 'c4itech', cat: 'cyber', name: 'טכנאי/ת מערכות ורשתות תקשוב', req: { profile: 45, dapar: 50 }, gender: MF, src: 'רשמי (מתקציר חיפוש)', traits: T(0, 0.5, 0, 0, 2, 3, 0, 1, 'cyber', 1, 3, 0) },
  { id: 'techmaint', cat: 'cyber', name: 'חייל/ת טכני/ת (טכנולוגיה ואחזקה)', req: { profile: 64 }, gender: MF, src: OFF, note: 'טירונות וקורס של 4–10 שבועות בבה״ד 20.', traits: T(0, 1.5, 0, 0, 1.5, 3, 0, 1, 'land', 1, 3, 0) },

  // ---------- Excellence programs ----------
  { id: 'talpiot', cat: 'excellence', name: 'תלפיות', req: { profile: 72, dapar: 90 }, gender: MF, selection: 'מיון רב־שלבי', src: PREP, note: '40 חודשי הכשרה ו־6 שנות קבע. לא נמצא אם פתוח לבנות; במחשבון פתוח לשניהם.', traits: T(0, 0.5, 3, 3, 1, 3, 0, 3, 'cyber', 0, 3, 2) },
  { id: 'havatzalot', cat: 'excellence', name: 'חבצלות', req: { profile: 25, dapar: 80 }, gender: MF, selection: 'פסיכומטרי 650 ומיון', src: PREP, note: '6 שנות קבע.', traits: T(0, 0.5, 3, 3, 1, 1, 1, 3, 'cyber', 0, 3, 3) },
  { id: 'psagot', cat: 'excellence', name: 'פסגות', req: { profile: 25, dapar: 80 }, gender: MF, selection: 'פסיכומטרי 675 וארבעה שלבי מיון', src: OFF, note: 'הדף הרשמי (01.2023): דפ״ר "80–90 בלבד". כולל קורס קצינים.', traits: T(0, 0.5, 3, 2.5, 1, 3, 0, 3, 'cyber', 0, 3, 2) },

  // ---------- Support ----------
  { id: 'edu', cat: 'support', name: 'רכז/ת חינוך (מש״קית חינוך)', req: { profile: 25, dapar: 50, hebrew: 8, maa: { teach: 3, care: 3, organize: 2, maturity: 3 } }, gender: MF, src: OFF, traits: T(0, 0, 0, 0, 2, 0, 3, 1, 'land', 0, 2, 1) },
  { id: 'hrofficer', cat: 'support', name: 'קצין/ת משא״ן ות״ש', req: { profile: 45, dapar: 60, hebrew: 7, maa: { teach: 2, command: 2, organize: 2 } }, gender: MF, selection: 'יום מיון', src: OFF, note: 'הדף דורש גם "יחסי אנוש 3", שלא נמצא ברשימת 12 הסביבות.', traits: T(0, 0, 1, 1, 2, 0, 3, 1, 'land', 0, 2, 3) },
  { id: 'medic', cat: 'support', name: 'חובש/ת קדמי/ת', req: { profile: 64, dapar: 50, hebrew: 8, maa: { care: 3 } }, gender: MF, src: OFF, note: 'הדף דורש כמה ציונים ב־3; במחשבון רק טיפול באדם.', traits: T(1.5, 2, 0, 0, 1, 1, 3, 1, 'land', 2, 2, 0) },
  { id: 'paramedic', cat: 'support', name: 'קפ״ץ · פראמדיק', req: { profile: 72, dapar: 70, hebrew: 8 }, gender: MF, selection: 'מבחן מקוון ומיון קבוצתי', src: OFF, traits: T(1.5, 1.5, 1, 0.5, 1, 1, 3, 2, 'land', 2, 3, 1) },
  { id: 'logistics', cat: 'support', name: 'מש״ק/ית לוגיסטיקה', req: { profile: 45, hebrew: 5, maa: { organize: 3 } }, gender: MF, src: OFF, traits: T(0, 1, 0, 0, 2, 1, 1, 1, 'land', 1, 1, 1) },
  { id: 'driver', cat: 'support', name: 'נהג רכב קל', req: { profile: 45, hebrew: 5 }, gender: M, src: OFF, note: 'רישיון B ידני.', traits: T(0, 0.5, 0, 0, 1.5, 1, 0, 0, 'land', 2, 2, 0) },
  { id: 'mp', cat: 'support', name: 'שוטר/ת צבאי/ת', req: { profile: 45, dapar: 40, hebrew: 6, maa: { command: 3, organize: 2, frame: 3 } }, gender: MF, src: OFF, note: 'הדף דורש גם "יחסי אנוש 3".', traits: T(0.5, 1, 0, 0, 2, 0, 2, 1, 'land', 1, 1, 2) },
  { id: 'spokes', cat: 'support', name: 'כתב/ת דובר צה״ל', req: { profile: 25, dapar: 70, hebrew: 7, notCombatMen: true }, gender: MF, selection: 'מיון בשני שלבים', src: OFF, note: 'לא פתוח לבנים שמיועדים ללחימה.', traits: T(0, 0, 1, 0, 2, 1, 2, 2, 'land', 1, 3, 0) },
  { id: 'galatz', cat: 'support', name: 'גלי צה״ל', req: { profile: 25, dapar: 70 }, gender: MF, selection: 'מיון', src: 'רשמי (מתקציר חיפוש)', traits: T(0, 0, 1.5, 0, 3, 1, 2, 2, 'land', 0, 3, 0) },
  { id: 'hfops', cat: 'support', name: 'סמב״צ/ית פיקוד העורף', req: { profile: 45, dapar: 40, hebrew: 7, maa: { tech: 2, organize: 3, info: 2 } }, gender: MF, src: OFF, note: 'שבוע בבית ושבוע בבסיס, לפי הדף.', traits: T(0, 0, 0, 0, 2.5, 2, 1, 2, 'land', 0, 1, 1) },
  { id: 'opsroom', cat: 'support', name: 'חדר מבצעים · סמב״צית יבשה', req: { profile: 25, maa: { attention: 3, info: 3, organize: 2, team: 3 } }, gender: F, selection: 'מיון', src: OFF, traits: T(0, 0, 0, 0, 1.5, 2, 0, 2, 'land', 0, 1, 0) },
  { id: 'tatzpit', cat: 'support', name: 'תצפיתנית', req: { profile: 64, dapar: 40, maa: { info: 3, team: 3, effort: 3 } }, gender: F, src: OFF, traits: T(1, 0.5, 0, 0, 1, 1, 0, 2, 'land', 1, 0, 0) },
  { id: 'armorinst', cat: 'support', name: 'מדריכת שריון', req: { profile: 72, dapar: 40, hebrew: 8, maa: { teach: 4 } }, gender: F, src: OFF, note: 'הדרכה 4 ועוד כמה ציונים ב־3.', traits: T(0.5, 1.5, 0.5, 0, 1, 2, 3, 1, 'land', 2, 1, 2) },
  { id: 'infinst', cat: 'support', name: 'מדריכת חי״ר', req: { profile: 72, dapar: 40, maa: { teach: 4 } }, gender: F, src: OFF, note: 'הדרכה 4 ועוד כמה ציונים ב־3.', traits: T(0.5, 2, 0.5, 0, 1, 1, 3, 1, 'land', 2, 1, 2) },
  { id: 'teacher', cat: 'support', name: 'מורה חיילת', req: { profile: 25, dapar: 40 }, gender: F, src: 'רשמי (מתקציר חיפוש)', traits: T(0, 0, 0, 0, 2.5, 0, 3, 1, 'land', 0, 2, 1) },
];
