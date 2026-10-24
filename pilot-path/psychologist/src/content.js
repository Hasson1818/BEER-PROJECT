import { FORM_QUESTIONS } from '../../yarpa-b/src/content.js';

// Texts of "הפסיכולוג". Official (from the air force site, seen only as a search snippet): the interview is on Zoom,
// from a computer, with a psychologist of the air force. Everything else (about 30 minutes, one on one, the
// psychologist has read your questionnaires, consistency matters, questions about motivation, family, guiding,
// difficulties, failures and weaknesses) comes from prep sites and is NOT official. No real transcript of an
// interview was found: the lines of the psychologist below are written for the game.

export const FACTS = {
  what: {
    title: 'הראיון עם הפסיכולוג, מה ידוע',
    points: [
      'רשמי (מתוך תקציר של אתר חיל האוויר): מי שעבר את השלב הקודם מתואם לראיון עם פסיכולוג/ית של חיל האוויר. הראיון מתקיים בזום, דרך מחשב בלבד.',
      'לפי אתרי הכנה (לא רשמי): שיחה אחת על אחת, בין חצי שעה לשעה, ולפעמים כמה ימים לפני כן מקבלים בדוא״ל טפסים ושאלון מוטיבציה. אין נתון רשמי על משך הראיון.',
      'לא פורסם: אילו שאלות נשאלות בפועל, מה משקל הראיון בציון הסופי, כמה נפסלים בו ואיך מערערים. המשחק לא ממציא אותם.',
    ],
  },
  honest: {
    title: 'מה נבדק, לפי אתרי הכנה',
    points: [
      'חוסן מנטלי, יוזמה וגמישות מחשבתית (אלה התכונות שחיל האוויר עצמו מציין), וגם אחריות, יכולת לעבוד עם אחרים והתמודדות עם כישלון.',
      'לפי אתרי הכנה הפסיכולוג קרא קודם את השאלונים שלך ובודק אם אתה עקבי. תשובות משוננות, "חולשה מתוחכמת" כמו "אני פרפקציוניסט" ותמונה בלי פגמים נראות מזויפות.',
      'כל המקורות ממליצים על דבר אחד: לענות בכנות, בקצרה ובלי לקלוע למה ש"רוצים לשמוע".',
    ],
  },
  end: {
    title: 'ומה אחרי הראיון?',
    points: [
      'לפי אתרי הכנה: התשובה מגיעה בטלפון, בדרך כלל תוך ימים (יש מקורות שאומרים באותו יום). מי שממשיך מוזמן לגיבוש הטייס בחצרים.',
      'ציון הפסיכולוג לא מכשיל לבדו לפי חלק מהמקורות, אלא משוקלל עם שאר הציונים. בנוסף, אפשר ללמוד מה הלך פחות טוב ולנסות להשתפר גם אם לא התקבלת.',
    ],
  },
};

export const MAIL = {
  from: 'חיל האוויר · מיון לקורס טיס',
  time: 'לפני כמה ימים · 17:20',
  text: [
    'שלום, עברת את השלב הקודם. תואם לך ראיון עם פסיכולוג/ית של חיל האוויר.',
    'הראיון יתקיים בזום, מהמחשב בלבד, מחר ב־08:45. הקישור מצורף.',
    'צרפנו טופס שמירה על סודיות ושאלון מוטיבציה לטיס. נא למלא ולהחזיר לפני הראיון.',
  ],
};

// Questions. `form` = the key of the personal form of ירפ״א ב׳ whose answer we compare with (same options, same order).
const F = (key) => FORM_QUESTIONS.find((q) => q.key === key);

export const DIFFICULTIES = {
  q: 'אילו קשיים אתה צופה בתפקיד של טייס?',
  options: ['הלחץ הנפשי והאחריות על חיי אחרים', 'העומס והלמידה המהירה', 'הזמן הרב הרחק מהבית', 'לא חשבתי על זה מספיק'],
  scores: [0.85, 0.8, 0.7, 0.3],
};

export const SIM_FEEL = {
  q: 'באמצע הסימולטור, כשנראה לך שזה לא הולך. מה עשית?',
  options: ['המשכתי, זה חלק מהמבחן', 'הרגשתי שאני מתפרק, עצרתי לנשום וחזרתי למשימה', 'כעסתי על המערכת', 'לא הרגשתי שום דבר'],
  scores: [0.6, 0.95, 0.35, 0.3],
};

export const TALK = [
  { id: 'why', form: 'why', q: 'ספר לי, למה אתה רוצה להיות טייס?', options: F('why').options, motivation: [0.9, 0.8, 0.75, 0.45] },
  { id: 'family', form: 'family', q: 'מה עמדת המשפחה שלך?', options: F('family').options },
  { id: 'lead', form: 'lead', q: 'האם הדרכת או הובלת? בתנועת נוער, בספורט, בבית ספר?', options: F('lead').options, team: [0.9, 0.8, 0.5, 0.4] },
  { id: 'difficulty', form: null, q: DIFFICULTIES.q, options: DIFFICULTIES.options, motivation: DIFFICULTIES.scores, resilience: DIFFICULTIES.scores },
  { id: 'weakness', form: 'weakness', q: 'מה החולשה הכי אמיתית שלך?', options: F('weakness').options, resilience: [0.8, 0.8, 0.65, 0.5] },
  { id: 'failure', form: 'failure', q: 'ספר לי איך אתה מגיב כשאתה נכשל.', options: F('failure').options, resilience: [0.95, 0.6, 0.7, 0.1], flag: [false, false, false, true] },
  { id: 'sim', form: null, q: SIM_FEEL.q, options: SIM_FEEL.options, resilience: SIM_FEEL.scores },
];

export const PSYCH_LINES = {
  wait: 'ממתינים שהמארח יאשר את הכניסה…',
  hello: ['שלום, אני הפסיכולוגית של חיל האוויר. את/ה שומע אותי טוב?', 'השיחה היא כדי להכיר אותך, לא לבחון אותך. אני קראתי את מה שמילאת. אשאל כמה דברים, ותענה כמו שאתה.'],
  note: ['…', 'מעניין.', 'רשמתי.', 'אה, בסדר.'],
  mismatch: (what) => `רגע. בשאלון כתבת ${what}, ועכשיו אתה אומר משהו אחר. מה קרה בין לבין?`,
  closing: ['תודה. זה כל מה שרציתי לשאול. שאלות אליי?', 'נחזור אליך בהמשך, בטלפון. תודה ובהצלחה.'],
};

export const MISMATCH_OPTIONS = [
  { text: 'צדקת, התכוונתי לאחרת. אני רוצה להסביר.', honesty: 0.7 },
  { text: 'חשבתי על זה אחרת מאז. זה השתנה.', honesty: 0.55 },
  { text: 'לא זוכר מה כתבתי.', honesty: 0.3 },
];

export const QUESTIONS_FOR_HER = {
  q: 'יש שאלות אליי?',
  options: ['כן. מה הצעד הבא ומתי אקבל תשובה?', 'לא, תודה.'],
};

export const RESULT = {
  pass: {
    from: 'חיל האוויר · מיון לקורס טיס',
    headline: 'מוזמן לגיבוש טייס',
    detail: ['עברת את שלב הפסיכולוג. הוזמנת לגיבוש הטייס בבית הספר לטיסה בחצרים.', 'התחברות לתחנת הרכבת באופקים. להביא תעודה, ציוד אישי וזימון.'],
  },
  fail: {
    from: 'חיל האוויר · מיון לקורס טיס',
    headline: 'לא נמשיך איתך הפעם',
    detail: [
      'לאחר הראיון, לא תוזמן לגיבוש.',
      'זו תחושה קשה, וזה בסדר. ההחלטה הזו לא קובעת מי אתה. אפשר לדבר עם מישהו קרוב, ויש גם גורמי תמיכה לחיילים ולמתגייסים.',
      'במשחק אפשר לנסות שוב מההתחלה.',
    ],
  },
};
