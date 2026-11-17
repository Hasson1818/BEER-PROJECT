// The fit questionnaire. Every question looks at one trait of the units (see data.js); every answer sets what the
// player wants on that trait (0..3, or a category with `match`) and how much it matters. "לא משנה לי" weighs
// nothing. The questions follow the dimensions the research found recruits weigh (report "דרישות סף ליחידות צהל
// 2026"); the trait values of each unit are the game's own judgement from the facts in data.js.

export const TRAITS = {
  combat: { name: 'לחימה', max: 3 },
  physical: { name: 'מאמץ פיזי', max: 3 },
  elite: { name: 'יחידה מובחרת', max: 3 },
  commitment: { name: 'התחייבות לשירות ארוך', max: 3 },
  home: { name: 'יציאות הביתה', max: 3 },
  tech: { name: 'עבודה טכנית', max: 3 },
  people: { name: 'עבודה עם אנשים', max: 3 },
  brains: { name: 'חשיבה וניתוח', max: 3 },
  domain: { name: 'זירה', max: 3 },
  outdoor: { name: 'שטח', max: 3 },
  career: { name: 'מקצוע לאזרחות', max: 3 },
  command: { name: 'פיקוד והובלה', max: 3 },
};

const NO = { label: 'לא משנה לי', want: null };

export const QUESTIONS = [
  {
    id: 'combat',
    trait: 'combat',
    q: 'כמה את/ה רוצה להיות בלחימה?',
    weight: 2,
    options: [
      { label: 'מאוד. לוחם/ת בקו הראשון', want: 3 },
      { label: 'קרוב ללחימה, אבל לא בהכרח בחזית (תומכי לחימה)', want: 2 },
      { label: 'מעדיף/ה תפקיד שלא קשור ללחימה', want: 0 },
      NO,
    ],
  },
  {
    id: 'physical',
    trait: 'physical',
    q: 'כמה מאמץ פיזי מתאים לך?',
    options: [
      { label: 'הרבה. אני אוהב/ת לדחוף את הגוף לקצה', want: 3 },
      { label: 'בינוני. כושר זה בסדר, לא כל יום מסעות', want: 1.5 },
      { label: 'מעט ככל האפשר', want: 0, weight: 1.5 },
      NO,
    ],
  },
  {
    id: 'elite',
    trait: 'elite',
    q: 'יחידה מובחרת: צוות קטן, גיבוש קשה, הכשרה ארוכה. מה דעתך?',
    options: [
      { label: 'זה בדיוק מה שאני רוצה', want: 3, weight: 1.5 },
      { label: 'אולי, אם זה ייצא', want: 1.5, weight: 0.5 },
      { label: 'לא בשבילי', want: 0 },
      NO,
    ],
  },
  {
    id: 'commitment',
    trait: 'commitment',
    q: 'כמה זמן את/ה מוכן/ה להתחייב לשירות?',
    options: [
      { label: 'רק שירות החובה', want: 0, weight: 2 },
      { label: 'עד שנה או שנתיים נוספות, אם התפקיד שווה את זה', want: 1.5 },
      { label: 'כמה שנים נוספות, בשביל תפקיד מיוחד', want: 3 },
      NO,
    ],
  },
  {
    id: 'home',
    trait: 'home',
    q: 'כמה חשוב לך לחזור הביתה?',
    options: [
      { label: 'מאוד. הכי טוב לישון בבית', want: 3, weight: 1.5 },
      { label: 'פעם בשבוע־שבועיים זה בסדר', want: 1.5 },
      { label: 'לא מפריע לי להיות הרבה בבסיס', want: 0, weight: 0.5 },
      NO,
    ],
  },
  {
    id: 'tech',
    trait: 'tech',
    q: 'עבודה עם מכשירים, מערכות ומנועים?',
    options: [
      { label: 'כן! אני אוהב/ת להבין איך דברים עובדים', want: 3 },
      { label: 'קצת, זה לא העיקר', want: 1.5 },
      { label: 'ממש לא', want: 0 },
      NO,
    ],
  },
  {
    id: 'people',
    trait: 'people',
    q: 'עבודה עם אנשים: להדריך, לחנך, לטפל, לעזור?',
    options: [
      { label: 'זה מה שהכי מתאים לי', want: 3 },
      { label: 'חלק מהעבודה, לא כולה', want: 1.5 },
      { label: 'מעדיף/ה לעבוד לבד או עם מערכות', want: 0 },
      NO,
    ],
  },
  {
    id: 'brains',
    trait: 'brains',
    q: 'חשיבה וניתוח: מודיעין, נתונים, שפות, פתרון בעיות?',
    options: [
      { label: 'מאוד. אני אוהב/ת לשבור את הראש', want: 3 },
      { label: 'במידה', want: 1.5 },
      { label: 'מעדיף/ה משהו מעשי', want: 0 },
      NO,
    ],
  },
  {
    id: 'domain',
    trait: 'domain',
    q: 'איפה הכי מושך אותך לשרת?',
    weight: 1.5,
    options: [
      { label: 'ביבשה', match: 'land' },
      { label: 'בים', match: 'sea' },
      { label: 'באוויר', match: 'air' },
      { label: 'מול מחשבים וסייבר', match: 'cyber' },
      NO,
    ],
  },
  {
    id: 'outdoor',
    trait: 'outdoor',
    q: 'שטח או משרד?',
    options: [
      { label: 'שטח, בחוץ, בתנועה', want: 3 },
      { label: 'שילוב', want: 1.5 },
      { label: 'משרד, חמ״ל או מעבדה', want: 0 },
      NO,
    ],
  },
  {
    id: 'career',
    trait: 'career',
    q: 'כמה חשוב לך שהתפקיד ייתן מקצוע לאזרחות?',
    options: [
      { label: 'מאוד חשוב', want: 3 },
      { label: 'נחמד, לא קריטי', want: 1.5, weight: 0.5 },
      { label: 'בכלל לא, אני מחפש/ת חוויה', want: 0, weight: 0.5 },
      NO,
    ],
  },
  {
    id: 'command',
    trait: 'command',
    q: 'לפקד, להוביל, לקחת אחריות על אחרים?',
    options: [
      { label: 'כן, אני רוצה להגיע לפיקוד', want: 3 },
      { label: 'אם יגיע, יגיע', want: 1.5, weight: 0.5 },
      { label: 'מעדיף/ה בלי', want: 0 },
      NO,
    ],
  },
];
