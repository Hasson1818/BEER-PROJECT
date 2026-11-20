// The units and roles in the calculator, with their entry requirements and traits.
//
// Requirements come from the research "דרישות סף ליחידות צהל 2026" (read 17.11.2026) and its re-check "בדיקת יחידות
// צהל למחשבון" (read 20.11.2026): mostly the official role pages on mitgaisim.idf.il (undated, so "as read in
// 11.2026"), and prep sites or news where there is no official number. Every unit says where its numbers come from
// (`src`).
//
// Yom HaMa'a minimums (`maa`) belong to the role: most official pages mark them "לבנות בלבד", so by default they
// apply to women only; `maaFor: 'all'` marks pages that apply them to everyone. `womenCombat` adds the women's
// combat screening as a pending step; `profile70` lets the new profile 70 try the role (announced 09.2026). Missing numbers are left out rather than guessed.
//
// `traits` (0..3, domain = land/sea/air/cyber) are the game's own judgement, built from the facts (service length,
// keva years, base, physical demand) for the fit questionnaire. They are not an official rating.
import { ENVIRONMENTS } from '../../yom-hamaa/src/content.js';

export const MAA_ENVS = ENVIRONMENTS;
export const PROFILES = [97, 82, 72, 70, 64, 45, 25, 21];
export const DAPARS = [10, 20, 30, 40, 50, 60, 70, 80, 90];
export const HEBREWS = [5, 6, 7, 8];

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
const SNIP = 'רשמי (מתקציר חיפוש)';
const NEWS = 'חדשות (2025–2026)';
const ATUDA = 'רשמי (חוברת העתודה 2026–2027)';

export const UNITS = [
  // ---------- Elite ----------
  { id: 'matkal', cat: 'elite', name: 'סיירת מטכ״ל', req: { profile: 97, dapar: 50 }, gender: M, selection: 'יום סיירות וגיבוש מטכ״ל', src: PREP, note: 'אין דף תפקיד רשמי. פרופיל 97 לפי אתרי הכנה; דפ״ר 50 הוא הסף הרשמי ליום הסיירות. פיילוט ללוחמות מ־12.2024.', stage: '../gibbush-matkal/?new=1', traits: T(3, 3, 3, 2, 0, 1, 1, 3, 'land', 3, 1, 2) },
  { id: 'shayetet', cat: 'elite', name: 'שייטת 13', req: { profile: 82, dapar: 50, hebrew: 8 }, gender: M, selection: 'יום סיירות או גדנ״ע צלילה, וגיבוש שייטת', src: OFF, note: 'הדף הרשמי סותר את עצמו: פרופיל "97 או 82", ועברית 8 או 7. הדף מבקש גם ציוני מא״ה 2 בשבע סביבות.', stage: '../shayetet/?new=1', traits: T(3, 3, 3, 2, 0, 1, 1, 2, 'sea', 3, 1, 2) },
  { id: 'shaldag', cat: 'elite', name: 'שלדג', req: { profile: 82, dapar: 50, hebrew: 7 }, gender: M, selection: 'יום סיירות, מיון גופני וגיבוש', src: OFF, note: 'רשמי 82; יש אתרים שכותבים 97 ודפ״ר 80. 18 חודשי קבע לפי הדף.', stage: '../gibbush-matkal/?new=1', traits: T(3, 3, 3, 2, 0, 1, 1, 2, ['land', 'air'], 3, 1, 2) },
  { id: 'u669', cat: 'elite', name: '669 · חילוץ והצלה מוטס', req: { profile: 97, dapar: 50, hebrew: 7 }, gender: MF, selection: 'יום סיירות או יום שדה, וגיבוש / דראפט', src: MIX, note: 'הדף הרשמי כותב "גברים". ללוחמות: מסלול מ־2023 לפי חדשות ואתר הכנה.', stage: '../draft/?new=1&path=669', traits: T(3, 3, 3, 2, 0, 1, 3, 2, ['air', 'land'], 3, 2, 2) },
  { id: 'commando', cat: 'elite', name: 'חטיבת הקומנדו (מגלן, אגוז, דובדבן)', req: { profile: 82, hebrew: 5 }, gender: M, selection: 'יום סיירות (תוצאת מטכ״ל או שייטת), גיבוש ודראפט, או גיבוש יחט״יות', src: OFF, note: 'דף רשמי אחד לכל יחידות הקומנדו. סיירת רימון פורקה ב־2018.', stage: '../draft/?new=1&path=commando', traits: T(3, 3, 2.5, 1, 0, 0, 1, 1, 'land', 3, 0, 2) },
  { id: 'oketz', cat: 'elite', name: 'עוקץ · יחידת הכלבנים', req: { profile: 82 }, gender: MF, selection: 'גיבוש עוקץ (לוחמות: דרך גדוד גבול)', src: OFF, note: 'לוחמים מתחייבים לשנת קבע.', stage: '../oketz/?new=1', traits: T(3, 3, 2.5, 1, 0, 1, 2, 1, 'land', 3, 1, 1) },
  { id: 'yahalom', cat: 'elite', name: 'יהל״ם', req: { profile: 82, dapar: 50 }, gender: MF, womenCombat: true, selection: 'גיבוש יהל״ם', src: OFF, note: 'ללוחמות קבוע מ־12.2025.', traits: T(3, 3, 2.5, 1, 0, 3, 1, 2, 'land', 3, 2, 1) },
  { id: 'yaltam', cat: 'elite', name: 'ילת״ם', req: { profile: 82, dapar: 50, hebrew: 7 }, gender: MF, selection: 'מיון ייעודי', src: OFF, traits: T(3, 3, 2.5, 1, 0, 2, 1, 2, 'sea', 3, 1, 1) },
  { id: 'kodkod', cat: 'elite', name: 'קודקוד (חיל האוויר)', req: { profile: 82, dapar: 50, hebrew: 7 }, gender: M, selection: 'עמידה בכל המיון הגופני של טיס, חובלים או צוללות', src: OFF, traits: T(3, 3, 2.5, 1, 0, 1, 1, 2, ['air', 'land'], 3, 1, 2) },
  { id: 'brigaderecon', cat: 'elite', name: 'סיירות החטיבות (גולני, גבעתי, נח״ל, צנחנים)', req: { profile: 82, hebrew: 5 }, gender: M, selection: 'גיבוש יחט״יות בטירונות (לצנחנים: גיבוש צנחנים לפני הגיוס)', src: MIX, note: 'סיירת צנחנים לפי אתרי הכנה; השאר רשמי.', stage: '../yechatiyot/?new=1', traits: T(3, 3, 2, 0.5, 0.5, 0, 1, 1, 'land', 3, 0, 2) },

  // ---------- Infantry ----------
  { id: 'golani', cat: 'infantry', name: 'גולני', req: { profile: 82, hebrew: 5 }, gender: M, src: OFF, note: 'לסיירת: גיבוש יחט״יות בטירונות.', stage: '../yechatiyot/?new=1', traits: T(3, 3, 1, 0, 1, 0, 1, 1, 'land', 3, 0, 2) },
  { id: 'tzanhanim', cat: 'infantry', name: 'צנחנים', req: { profile: 82 }, gender: M, selection: 'גיבוש צנחנים לפני הגיוס', src: MIX, stage: '../tzanhanim/?new=1', traits: T(3, 3, 1.5, 0, 1, 0, 1, 1, 'land', 3, 0, 2) },
  { id: 'givati', cat: 'infantry', name: 'גבעתי', req: { profile: 82 }, gender: M, src: OFF, note: 'לסיירת: גיבוש יחט״יות בטירונות.', stage: '../yechatiyot/?new=1', traits: T(3, 3, 1, 0, 1, 0, 1, 1, 'land', 3, 0, 2) },
  { id: 'nahal', cat: 'infantry', name: 'נח״ל', req: { profile: 82 }, gender: M, src: OFF, note: 'לסיירת: גיבוש יחט״יות בטירונות.', stage: '../yechatiyot/?new=1', traits: T(3, 3, 1, 0, 1, 0, 1, 1, 'land', 3, 0, 2) },
  { id: 'kfir', cat: 'infantry', name: 'כפיר', req: { profile: 82 }, gender: M, src: OFF, note: 'לחרוב וללוט״ר: גיבוש יחט״יות.', stage: '../yechatiyot/?new=1', traits: T(3, 3, 1, 0, 1, 0, 1, 1, 'land', 3, 0, 2) },
  { id: 'hashmonaim', cat: 'infantry', name: 'חשמונאים (חטיבה חרדית)', req: { profile: 82 }, gender: M, src: NEWS, note: 'לחרדים בלבד. אין סף רשמי מפורסם: 82 הוא הערכה לפי שאר החי״ר. גיוס ראשון 01.2025, גדודי יונתן ומכבים.', traits: T(3, 3, 1, 0, 1, 0, 1, 1, 'land', 3, 0, 2) },

  // ---------- Armor, artillery, engineering ----------
  { id: 'armor', cat: 'ground', name: 'שריון', req: { profile: 72, hebrew: 5 }, gender: M, src: OFF, note: 'צוות טנק של ארבעה. ללוחמות: פלוגות טנקים בגדודי הגבול, ופיילוט נפרד של כ־50 לוחמות בחטיבה 460 שמתגייס ב־11.2026 (חדשות). לא פתוח בשאלון.', traits: T(3, 2, 0, 0, 1, 2, 1, 1, 'land', 3, 1, 1) },
  { id: 'artillery', cat: 'ground', name: 'תותחנים', req: { profile: 72, hebrew: 5 }, gender: MF, womenCombat: true, profile70: true, src: OFF, note: 'BMI 17–35. ליחידות מורן ורוכב שמיים: פרופיל 82 ומיון בטירונות.', traits: T(2.5, 2, 0, 0, 1, 2, 1, 1, 'land', 2, 1, 1) },
  { id: 'engineering', cat: 'ground', name: 'הנדסה קרבית', req: { profile: 82, hebrew: 5 }, gender: M, src: OFF, note: 'גדודי עשף, להב והמחץ. BMI 17–32.', traits: T(3, 3, 0.5, 0, 1, 2, 1, 1, 'land', 3, 1, 1) },
  { id: 'moran', cat: 'ground', name: 'מורן ורוכב שמיים (תותחנים)', req: { profile: 82, hebrew: 5 }, selection: 'מיון בטירונות התותחנים', src: OFF, note: 'לא נמצא מקור אם פתוח ללוחמות.', traits: T(2.5, 2, 1.5, 0.5, 1, 3, 1, 2, 'land', 2, 1, 1) },

  // ---------- Border, Border Police, Home Front ----------
  { id: 'border', cat: 'border', name: 'גדודי גבול משולבים (קרקל, ברדלס, אריות הירדן, לביאי הבקעה, פנתר)', req: { profile: 72, hebrew: 5 }, gender: MF, womenCombat: true, src: OFF, note: 'בעיקר בדרום ובבקעה. לוחמות: קורס מיון של שבועיים אחרי הגיוס.', stage: '../lochamot/?new=1', traits: T(3, 2.5, 0, 0, 1, 0, 1, 1, 'land', 3, 0, 1) },
  { id: 'collection', cat: 'border', name: 'איסוף קרבי', req: { profile: 82, hebrew: 5 }, gender: MF, womenCombat: true, src: OFF, note: 'לפי הדף, אפשר גם 72 עם סעיפים מסוימים. שחף וניצן לבנים, איתם לבנות, איתן ונשר מעורבים. לוחמות: 32 חודשים.', traits: T(2.5, 2, 0.5, 0, 1, 2, 1, 2, 'land', 3, 0, 1) },
  { id: 'magav', cat: 'border', name: 'מג״ב', req: { profile: 82, hebrew: 5, maa: { command: 2, team: 2, maturity: 2, effort: 2 } }, gender: MF, womenCombat: true, src: OFF, note: 'הדף העברי (11.2026): 82 לבנות ולבנים, ולבנים גם 72 עם סעיף מתיר. הדף האנגלי עוד כותב 72 ופיקוד 3 לבנות. BMI 17–32.', traits: T(3, 2.5, 0, 0, 1, 0, 2, 1, 'land', 3, 1, 1) },
  { id: 'rescue', cat: 'border', name: 'חילוץ והצלה (פקע״ר)', req: { profile: 72, hebrew: 5, maa: { team: 2, maturity: 2, effort: 2 } }, gender: MF, womenCombat: true, src: OFF, note: 'גדודי שחר, קדם, תבור ורם; גדוד חמישי בהקמה.', traits: T(2.5, 2.5, 0, 0, 1, 1, 3, 1, 'land', 3, 1, 1) },
  { id: 'airdef', cat: 'border', name: 'הגנה אווירית', req: { profile: 72, hebrew: 6, maa: { tech: 3, info: 2, team: 2, maturity: 2, effort: 2, spatial: 2, attention: 2 } }, gender: MF, womenCombat: true, profile70: true, src: OFF, note: 'כיפת ברזל, חץ, קלע דוד ופטריוט הם שיבוצים בתוך התפקיד. בנים משובצים בלי מיון.', traits: T(2, 1.5, 0, 0, 1, 3, 1, 1, ['land', 'air'], 2, 1, 1) },

  // ---------- Air force ----------
  { id: 'pilot', cat: 'air', name: 'קורס טיס', req: { profile: 97, dapar: 60 }, gender: MF, selection: 'מסלול המיון לטיס (מבחנים, ירפ״א, פסיכולוג וגיבוש)', src: OFF, note: 'גיל עד 23. שלוש שנות קורס ו־7 שנות קבע.', stage: '../pilot-path/', traits: T(2.5, 1, 3, 3, 1, 3, 1, 3, 'air', 1, 3, 2) },
  { id: 'uav', cat: 'air', name: 'מטיס/ה כטב״ם', req: { profile: 64, dapar: 50 }, gender: MF, src: OFF, note: 'דורש ניסיון בהטסת טיסנים. קורס של 50 שבועות בפלמחים.', traits: T(1.5, 0, 1, 1, 2, 3, 0, 2, 'air', 0, 2, 0) },
  { id: 'airtech', cat: 'air', name: 'טכנאי/ת מטוסים', req: { profile: 64, hebrew: 5 }, gender: MF, src: OFF, traits: T(0, 1, 0, 0, 2, 3, 0, 1, 'air', 1, 3, 0) },
  { id: 'flightctrl', cat: 'air', name: 'פקח/ית טיסה', req: { profile: 45, dapar: 60 }, gender: MF, src: PREP, note: 'הדפ״ר לפי אתר הכנה (07.2026). הפרופיל לא אומת.', traits: T(0, 0, 0.5, 0, 2, 2, 1, 3, 'air', 0, 2, 1) },
  { id: 'tzah', cat: 'air', name: 'מפענח/ת תצ״א', req: { profile: 45, dapar: 60, maa: { effort: 3, info: 3, spatial: 3, attention: 3 } }, gender: MF, selection: 'מבחני פענוח ממוחשבים וסיווג', src: OFF, note: 'לפי הדף: התמדה, עיבוד מידע, תפיסה מרחבית וקשב, כל אחד 3.', traits: T(0, 0, 0.5, 0, 2, 2, 0, 3, ['air', 'cyber'], 0, 2, 0) },
  { id: 'siminst', cat: 'air', name: 'מדריכת סימולטור טיסה', req: { profile: 45, dapar: 60, maa: { info: 4 } }, gender: F, src: PREP, note: 'שתי גרסאות של הדף הרשמי סותרות.', traits: T(0, 0, 0.5, 0, 2, 2, 3, 2, 'air', 0, 1, 1) },
  { id: 'aircontrol', cat: 'air', name: 'משק/ית בקרה אווירית', req: { profile: 45, dapar: 50, notCombatMen: true, maa: { organize: 2, info: 3, team: 3, effort: 3, spatial: 3, attention: 3 } }, gender: MF, src: OFF, note: 'לבנים פרופיל 45–64. קורס של 10 שבועות בעובדה.', traits: T(0.5, 0, 0.5, 0, 1.5, 2, 1, 3, 'air', 0, 2, 1) },

  // ---------- Navy ----------
  { id: 'hovlim', cat: 'navy', name: 'קורס חובלים', req: { profile: 82, dapar: 60, maa: { tech: 3, info: 2, command: 4, team: 2, maturity: 2, effort: 2 } }, gender: MF, selection: 'יום סיירות או מיון מקוון, וגיבוש של 5 ימים בעתלית', src: OFF, note: 'ציוני המא״ה לבנות בלבד. כ־2.5 שנות קורס ו־5 שנות קבע. העברית בדף סותרת (8 או 5).', stage: '../naval/?new=1', traits: T(2, 2, 3, 3, 0, 2, 1, 3, 'sea', 2, 2, 3) },
  { id: 'subs', cat: 'navy', name: 'צוללות', req: { profile: 82, dapar: 60, hebrew: 8 }, gender: M, selection: 'יום סיירות וגיבוש של 5 ימים', src: OFF, note: 'קורס של כ־14 חודשים. עדיין לבנים בלבד.', stage: '../naval/?new=1', traits: T(2, 1, 2, 1, 0, 3, 1, 2, 'sea', 1, 2, 1) },
  { id: 'stil', cat: 'navy', name: 'לוחם/ת ספינות (סטי״ל ואח״י)', req: { profile: 72, dapar: 30, hebrew: 6, maa: { effort: 2, team: 2, tech: 3, info: 2, maturity: 2, frame: 2 } }, gender: MF, womenCombat: true, src: OFF, traits: T(2.5, 2, 0.5, 0, 0.5, 2, 1, 1, 'sea', 2, 1, 1) },
  { id: 'snapir', cat: 'navy', name: 'לוחם/ת סנפיר (ביטחון נמלים)', req: { profile: 72, dapar: 30, hebrew: 7 }, gender: MF, womenCombat: true, selection: 'גיבוש של יומיים בחיפה', src: OFF, note: 'הדפ״ר בדף סותר (30 או 50). אתר הכנה: 30 לבנים, 50 לבנות.', traits: T(2.5, 2, 0.5, 0, 1, 1, 1, 1, 'sea', 3, 0, 1) },
  { id: 'navytech', cat: 'navy', name: 'טכנאי/ת אלקטרוניקה ימית', req: { profile: 72, maa: { tech: 2, info: 2 } }, gender: MF, src: 'רשמי (מתקציר חיפוש)', note: 'ציוני המא״ה לבנות.', traits: T(0.5, 1, 0, 0, 1, 3, 0, 1, 'sea', 1, 3, 0) },
  { id: 'navyofficer', cat: 'navy', name: 'קצונה ייעודית בחיל הים', req: { profile: 45, dapar: 60 }, gender: MF, src: SNIP, traits: T(0.5, 0.5, 1.5, 2, 1, 2, 1, 2, 'sea', 1, 2, 3) },
  { id: 'bakash', cat: 'navy', name: 'בק״שית (בקרה ימית)', req: { profile: 45, dapar: 40 }, gender: F, src: SNIP, traits: T(0.5, 0, 0, 0, 1.5, 2, 1, 2, 'sea', 0, 1, 0) },
  { id: 'atim', cat: 'navy', name: 'אתי״ם (תקשורת ימית מסווגת)', req: { profile: 45, dapar: 50, notCombatMen: true }, gender: MF, src: SNIP, traits: T(0, 0, 0.5, 0, 1.5, 2, 0, 2, 'sea', 0, 2, 0) },

  // ---------- Intelligence ----------
  { id: 'u8200', cat: 'intel', name: '8200', req: { profile: 25, dapar: 60 }, gender: MF, selection: 'מיון כלל חמ״ן ומבחני היחידה', src: PREP, note: 'יש אתרים שכותבים דפ״ר 70. מסלולים שונים מתחייבים מכמה חודשים עד 3 שנות קבע.', stage: '../klal-haman/?new=1', traits: T(0, 0, 1.5, 1, 2, 2, 0, 3, 'cyber', 0, 3, 1) },
  { id: 'specialintel', cat: 'intel', name: 'מסלול מודיעיני ייחודי', req: { profile: 25, dapar: 60 }, gender: MF, selection: 'כלל חמ״ן, ראיון מקצועי ומיון אישיותי', src: OFF, note: 'לבוגרי מגמות מדעיות. חצי שנת קבע.', stage: '../klal-haman/?new=1', traits: T(0, 0, 1.5, 0.5, 2, 1, 0, 3, 'cyber', 0, 2, 1) },
  { id: 'arabic', cat: 'intel', name: 'מסלולי ערבית במודיעין', req: { profile: 25, dapar: 50 }, gender: MF, selection: 'כלל חמ״ן', src: 'רשמי (מתקציר חיפוש)', note: '5 יחידות ערבית.', stage: '../klal-haman/?new=1', traits: T(0, 0, 1, 0, 2, 0, 0, 3, 'cyber', 0, 2, 0) },
  { id: 'u9900', cat: 'intel', name: '9900 · מודיעין חזותי', req: { profile: 25, dapar: 60 }, gender: MF, selection: 'מבחני היחידה', src: PREP, stage: '../klal-haman/?new=1', traits: T(0, 0, 1, 0, 2, 2, 0, 3, 'cyber', 0, 2, 0) },
  { id: 'intelresearch', cat: 'intel', name: 'חוקר/ת מודיעין (אוויר / ים)', req: { profile: 45, dapar: 60, notCombatMen: true }, gender: MF, selection: 'כלל חמ״ן', src: SNIP, note: 'לבנים פרופיל 45–64.', stage: '../klal-haman/?new=1', traits: T(0, 0, 1, 0, 2, 1, 0, 3, ['air', 'sea'], 0, 2, 1) },
  { id: 'sigint', cat: 'intel', name: 'מסלול סיגינט', req: { profile: 25, dapar: 60 }, gender: MF, selection: 'כלל חמ״ן', src: OFF, note: '10 יח״ל מחשבים. שנת קבע.', stage: '../klal-haman/?new=1', traits: T(0, 0, 1.5, 1, 2, 3, 0, 3, 'cyber', 0, 3, 0) },
  { id: 'agoz', cat: 'intel', name: 'מסלול אגו״ז (חמ״ן)', req: { profile: 45, dapar: 70 }, gender: MF, selection: 'מיון', src: OFF, note: 'רקע במגמה מדעית. קורס של כ־4 חודשים, 4 חודשי קבע. הדף עוד מציין קב״א, שכבר לא קיים.', stage: '../klal-haman/?new=1', traits: T(0, 0, 1.5, 0.5, 1.5, 1, 0, 3, 'cyber', 0, 2, 1) },
  { id: 'intelworker', cat: 'intel', name: 'עובד/ת חקר מודיעין', req: { profile: 25, dapar: 60, maa: { organize: 3, info: 3 } }, gender: MF, src: SNIP, stage: '../klal-haman/?new=1', traits: T(0, 0, 0.5, 0, 2, 1, 0, 3, 'cyber', 0, 2, 0) },
  { id: 'tunnels', cat: 'intel', name: 'מפענח/ת תת־קרקע', req: { profile: 64, dapar: 60, maa: { teach: 3, organize: 2, info: 4, tech: 2, attention: 3 } }, gender: MF, src: SNIP, note: 'היחידה לאיתור תת־קרקעי.', traits: T(0.5, 0, 1, 0, 1.5, 2, 0, 3, 'land', 1, 2, 0) },

  // ---------- Cyber, C4I, technology ----------
  { id: 'cyberdef', cat: 'cyber', name: 'מגן/ת בסייבר (תקשוב)', req: { profile: 45, dapar: 70, daparCombatMen: 80, hebrew: 7, maa: { organize: 2, info: 4, attention: 3 } }, maaFor: 'all', gender: MF, selection: 'יום מיון מקצועות המחשב וסיווג ביטחוני', src: OFF, note: 'לבנים בפרופיל קרבי: דפ״ר 80 ו־10 יחידות מדעי המחשב. שנתיים קבע.', traits: T(0, 0, 1.5, 1.5, 2, 3, 0, 3, 'cyber', 0, 3, 1) },
  { id: 'mamram', cat: 'cyber', name: 'תוכניתן/ית (קורס תכנות ממר״ם)', req: { profile: 45, dapar: 70 }, gender: MF, selection: 'מבחני "מחשבון קרב" ו"להב"', src: OFF, note: 'קורס של כ־22 שבועות ו־2.5 שנות קבע.', traits: T(0, 0, 1.5, 1.5, 2, 3, 0, 3, 'cyber', 0, 3, 0) },
  { id: 'c4itech', cat: 'cyber', name: 'טכנאי/ת מערכות ורשתות תקשוב', req: { profile: 45, dapar: 50 }, gender: MF, src: 'רשמי (מתקציר חיפוש)', traits: T(0, 0.5, 0, 0, 2, 3, 0, 1, 'cyber', 1, 3, 0) },
  { id: 'techmaint', cat: 'cyber', name: 'חייל/ת טכני/ת (טכנולוגיה ואחזקה)', req: { profile: 64, maa: { tech: 3 } }, gender: MF, src: OFF, note: 'טירונות וקורס של 4–10 שבועות בבה״ד 20.', traits: T(0, 1.5, 0, 0, 1.5, 3, 0, 1, 'land', 1, 3, 0) },
  { id: 'data', cat: 'cyber', name: 'דאטא אנליסט/ית', req: { profile: 25, dapar: 60, hebrew: 7, notCombatMen: true, maa: { organize: 3, info: 4, attention: 3 } }, maaFor: 'all', gender: MF, src: OFF, note: 'לבנים: פרופיל עורפי בלבד. 32 חודשי שירות.', traits: T(0, 0, 1, 0, 2, 3, 0, 3, 'cyber', 0, 3, 0) },
  { id: 'qa', cat: 'cyber', name: 'בודק/ת תוכנה', req: { profile: 25, dapar: 60 }, gender: MF, src: SNIP, note: 'הפרופיל לא אומת.', traits: T(0, 0, 0.5, 0, 2, 3, 0, 2, 'cyber', 0, 3, 0) },
  { id: 'techdefense', cat: 'cyber', name: 'טכנאי/ת מערכות הגנה', req: { profile: 64 }, gender: MF, src: OFF, traits: T(0, 1, 0, 0, 1.5, 3, 0, 1, 'land', 1, 3, 0) },
  { id: 'radartech', cat: 'cyber', name: 'טכנאי/ת מכ״ם', req: { profile: 64 }, gender: MF, src: SNIP, traits: T(0, 0.5, 0, 0, 1.5, 3, 0, 1, ['land', 'air'], 1, 3, 0) },
  { id: 'tankmech', cat: 'cyber', name: 'טכנאי/ת הנעה רק״ם', req: { profile: 64 }, gender: MF, src: SNIP, traits: T(0.5, 2, 0, 0, 1, 3, 0, 1, 'land', 2, 3, 0) },
  { id: 'mechanic', cat: 'cyber', name: 'מכונאי/ת רכב', req: { profile: 64 }, gender: MF, src: OFF, note: 'הדף מסווג אותו "עורפי".', traits: T(0, 1.5, 0, 0, 2, 3, 0, 1, 'land', 1, 3, 0) },
  { id: 'weather', cat: 'cyber', name: 'עוזר/ת חזאי', req: { profile: 25, dapar: 60, maa: { tech: 2, info: 3 } }, gender: MF, src: SNIP, note: 'הפרופיל לא אומת.', traits: T(0, 0, 0.5, 0, 2, 2, 0, 3, 'air', 0, 2, 0) },

  // ---------- Excellence programs ----------
  { id: 'talpiot', cat: 'excellence', name: 'תלפיות', req: { profile: 72, dapar: 90 }, gender: MF, selection: 'מיון רב־שלבי', src: PREP, note: '40 חודשי הכשרה ו־6 שנות קבע. לא נמצא אם פתוח לבנות; במחשבון פתוח לשניהם.', traits: T(0, 0.5, 3, 3, 1, 3, 0, 3, 'cyber', 0, 3, 2) },
  { id: 'havatzalot', cat: 'excellence', name: 'חבצלות', req: { profile: 25, dapar: 80 }, gender: MF, selection: 'פסיכומטרי 650 ומיון', src: PREP, note: '6 שנות קבע.', traits: T(0, 0.5, 3, 3, 1, 1, 1, 3, 'cyber', 0, 3, 3) },
  { id: 'psagot', cat: 'excellence', name: 'פסגות', req: { profile: 25, dapar: 70 }, gender: MF, selection: 'פסיכומטרי 675 וארבעה שלבי מיון', src: ATUDA, note: 'חוברת העתודה 2026–2027: דפ״ר 70. דף ישן (01.2023) כתב "80–90 בלבד". כולל קורס קצינים.', traits: T(0, 0.5, 3, 2.5, 1, 3, 0, 3, 'cyber', 0, 3, 2) },
  { id: 'atuda', cat: 'excellence', name: 'עתודה אקדמית (רעמים, ברקים, סילון, אלונים, גבישים, אביבים)', req: { profile: 25, dapar: 70 }, gender: MF, selection: 'פסיכומטרי 650–680 ומיון', src: ATUDA, note: 'לימודים לפני השירות ו־3 שנות קבע לפחות. אביבים חדשה ב־2026–2027.', traits: T(0, 0, 2, 3, 2, 2, 1, 3, 'cyber', 0, 3, 1) },

  // ---------- Support ----------
  { id: 'edu', cat: 'support', name: 'רכז/ת חינוך (מש״קית חינוך)', req: { profile: 25, dapar: 50, hebrew: 8, maa: { teach: 3, care: 3, organize: 2, maturity: 3 } }, gender: MF, src: OFF, traits: T(0, 0, 0, 0, 2, 0, 3, 1, 'land', 0, 2, 1) },
  { id: 'hrofficer', cat: 'support', name: 'קצין/ת משא״ן ות״ש', req: { profile: 45, dapar: 60, hebrew: 7, maa: { teach: 2, command: 2, organize: 2 } }, gender: MF, selection: 'יום מיון', src: OFF, note: 'הדף דורש גם "יחסי אנוש 3", שלא נמצא ברשימת 12 הסביבות.', traits: T(0, 0, 1, 1, 2, 0, 3, 1, 'land', 0, 2, 3) },
  { id: 'medic', cat: 'support', name: 'חובש/ת קדמי/ת', req: { profile: 64, dapar: 50, hebrew: 8, maa: { team: 3, care: 3, organize: 2, maturity: 3 } }, maaFor: 'all', gender: MF, src: OFF, note: 'הדף לא מסמן את ציוני המא״ה "לבנות בלבד". דורש גם אינהביציה וגמישות מחשבתית 3, שאין להן ציון במחשבון.', traits: T(1.5, 2, 0, 0, 1, 1, 3, 1, 'land', 2, 2, 0) },
  { id: 'paramedic', cat: 'support', name: 'קפ״ץ · פראמדיק', req: { profile: 72, dapar: 70, hebrew: 8 }, gender: MF, selection: 'מבחן מקוון ומיון קבוצתי', src: OFF, traits: T(1.5, 1.5, 1, 0.5, 1, 1, 3, 2, 'land', 2, 3, 1) },
  { id: 'logistics', cat: 'support', name: 'מש״ק/ית לוגיסטיקה', req: { profile: 45, hebrew: 5, maa: { organize: 3 } }, gender: MF, src: OFF, traits: T(0, 1, 0, 0, 2, 1, 1, 1, 'land', 1, 1, 1) },
  { id: 'driver', cat: 'support', name: 'נהג/ת רכב קל', req: { profile: 45, hebrew: 5 }, gender: MF, src: OFF, note: 'רישיון B ידני. כותרת הדף: "נהג/ת".', traits: T(0, 0.5, 0, 0, 1.5, 1, 0, 0, 'land', 2, 2, 0) },
  { id: 'mp', cat: 'support', name: 'שוטר/ת צבאי/ת', req: { profile: 45, dapar: 40, hebrew: 6, maa: { command: 3, organize: 2, frame: 3 } }, gender: MF, src: OFF, note: 'ציוני המא״ה לבנות בלבד. הדף דורש גם "יחסי אנוש 3".', traits: T(0.5, 1, 0, 0, 2, 0, 2, 1, 'land', 1, 1, 2) },
  { id: 'spokes', cat: 'support', name: 'כתב/ת דובר צה״ל', req: { profile: 25, dapar: 70, hebrew: 7, notCombatMen: true, maa: { info: 3, frame: 3, organize: 2 } }, gender: MF, selection: 'מיון בשני שלבים', src: OFF, note: 'לא פתוח לבנים שמיועדים ללחימה. דורש גם גמישות מחשבתית 3.', traits: T(0, 0, 1, 0, 2, 1, 2, 2, 'land', 1, 3, 0) },
  { id: 'galatz', cat: 'support', name: 'גלי צה״ל', req: { profile: 25, dapar: 70, hebrew: 8, notCombatMen: true }, gender: MF, selection: 'מיון', src: SNIP, note: 'לא פתוח לבנים שמיועדים ללחימה.', traits: T(0, 0, 1.5, 0, 3, 1, 2, 2, 'land', 0, 3, 0) },
  { id: 'hfops', cat: 'support', name: 'סמב״צ/ית פיקוד העורף', req: { profile: 45, dapar: 40, hebrew: 7, maa: { tech: 2, organize: 3, info: 2 } }, gender: MF, src: OFF, note: 'שבוע בבית ושבוע בבסיס, לפי הדף.', traits: T(0, 0, 0, 0, 2.5, 2, 1, 2, 'land', 0, 1, 1) },
  { id: 'opsroom', cat: 'support', name: 'חדר מבצעים · סמב״צית יבשה', req: { profile: 25, maa: { attention: 3, info: 3, organize: 2, team: 3 } }, gender: F, selection: 'מיון', src: OFF, traits: T(0, 0, 0, 0, 1.5, 2, 0, 2, 'land', 0, 1, 0) },
  { id: 'tatzpit', cat: 'support', name: 'תצפיתנית', req: { profile: 64, dapar: 40, maa: { info: 3, team: 3, effort: 3 } }, gender: F, src: OFF, traits: T(1, 0.5, 0, 0, 1, 1, 0, 2, 'land', 1, 0, 0) },
  { id: 'armorinst', cat: 'support', name: 'מדריכת שריון', req: { profile: 72, dapar: 40, hebrew: 8, maa: { teach: 4 } }, gender: F, src: OFF, note: 'הדרכה 4 ועוד כמה ציונים ב־3.', traits: T(0.5, 1.5, 0.5, 0, 1, 2, 3, 1, 'land', 2, 1, 2) },
  { id: 'infinst', cat: 'support', name: 'מדריכת חי״ר', req: { profile: 72, dapar: 40, maa: { teach: 4 } }, gender: F, src: OFF, note: 'הדרכה 4 ועוד כמה ציונים ב־3.', traits: T(0.5, 2, 0.5, 0, 1, 1, 3, 1, 'land', 2, 1, 2) },
  { id: 'teacher', cat: 'support', name: 'מורה חיילת', req: { profile: 25, dapar: 40 }, gender: F, src: 'רשמי (מתקציר חיפוש)', traits: T(0, 0, 0, 0, 2.5, 0, 3, 1, 'land', 0, 2, 1) },
  { id: 'combattrainer', cat: 'support', name: 'מדריכת אימונים קרביים', req: { profile: 72, dapar: 40, hebrew: 7, maa: { tech: 3, command: 2, frame: 2 } }, gender: F, src: OFF, note: 'מפעילת האמר קרבי או מפעילת כוחות אויב.', traits: T(1, 2, 0.5, 0, 1, 2, 2, 1, 'land', 3, 1, 2) },
  { id: 'fitnessinst', cat: 'support', name: 'מדריך/ת כושר קרבי', req: { profile: 72, dapar: 30, hebrew: 7, maa: { teach: 3 } }, gender: MF, selection: 'מבחני כושר וראיון', src: OFF, traits: T(1, 3, 0.5, 0, 1, 0, 3, 0, 'land', 3, 2, 2) },
  { id: 'tzidinst', cat: 'support', name: 'מדריכת צי״ד', req: { profile: 45, dapar: 40, hebrew: 8, maa: { teach: 4 } }, gender: F, src: OFF, note: 'הדף דורש עוד חמש סביבות ב־3, וסותר את עצמו לגבי מיון.', traits: T(0.5, 0.5, 0.5, 0, 1, 2, 3, 1, 'land', 1, 1, 2) },
  { id: 'airdefinst', cat: 'support', name: 'מדריכת הגנה אווירית', req: { profile: 72 }, gender: F, src: OFF, note: 'הדף לא מציין דפ״ר, עברית ומא״ה.', traits: T(0.5, 1, 0.5, 0, 1, 2, 3, 1, ['land', 'air'], 2, 1, 2) },
  { id: 'enginst', cat: 'support', name: 'מדריך/ת הנדסה קרבית', req: { profile: 72, maa: { tech: 2, teach: 4, command: 3, team: 3 } }, gender: MF, src: OFF, note: 'דף באנגלית. דורש גם "שדה 3" ו"יחסי אנוש 3".', traits: T(0.5, 2, 0.5, 0, 1, 2, 3, 1, 'land', 3, 1, 2) },
  { id: 'heavydriver', cat: 'support', name: 'נהג/ת משא כבד', req: { profile: 45 }, gender: MF, src: OFF, note: 'רישיון C1 מתקבל בהכשרה.', traits: T(0.5, 1, 0, 0, 1, 1, 0, 0, 'land', 2, 3, 0) },
  { id: 'cook', cat: 'support', name: 'טבח/ית', req: { profile: 64, hebrew: 5 }, gender: MF, src: OFF, traits: T(0, 1.5, 0, 0, 1.5, 1, 1, 0, 'land', 0, 3, 0) },
  { id: 'medlab', cat: 'support', name: 'עובד/ת מעבדה רפואית', req: { profile: 25, dapar: 60, hebrew: 6, maa: { care: 3, organize: 2, info: 2 } }, maaFor: 'all', gender: MF, src: OFF, note: 'לבנות: עיבוד מידע 3.', traits: T(0, 0, 0.5, 0, 2, 2, 1, 2, 'land', 0, 3, 0) },
  { id: 'mednco', cat: 'support', name: 'מש״ק/ית שירותי רפואה', req: { profile: 45, dapar: 40, hebrew: 7, maa: { care: 3, attention: 2, organize: 2 } }, gender: MF, src: OFF, note: '"יחסי אנוש 3" בדף; במחשבון: טיפול באדם.', traits: T(0, 0, 0, 0, 2, 0, 3, 1, 'land', 0, 2, 0) },
  { id: 'argaman', cat: 'support', name: 'פלגת ארגמן (תמיכה ביחידות המיוחדות)', req: { profile: 25 }, gender: MF, selection: 'חשיפה, דירוג וראיון', src: OFF, traits: T(0.5, 1, 1, 0, 1, 1, 1, 1, 'land', 1, 1, 0) },
];
