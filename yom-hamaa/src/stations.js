import { el, button } from '../../pilot-path/shared/screens.js';
import { fx } from '../../pilot-path/shared/fx.js';
import { GROUP, GROUP_TASK, TEACH, SIMS, ASSESSOR } from './content.js';

// The Zoom part of the day: an introduction round, the group task (ending in a poster), the instruction with
// ready slides and the turn passed in the chat, and two 1-on-1 role plays. Every choice adds to environments
// (the game's own mapping). `env` is { id: [values 0..1] }.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function addEnv(env, values) {
  for (const [id, v] of Object.entries(values)) (env[id] ??= []).push(v);
}

export const MEMBERS = (myName) => [
  ...GROUP.map((g, i) => ({ id: `g${i}`, name: g.name, look: g.look, trait: g.trait })),
  { id: 'me', name: myName, look: { shirt: '#3d6fa8', longHair: false } },
  { id: 'assessor', name: ASSESSOR.name, look: { shirt: '#e8e2d6', pants: '#3b3b3b', longHair: true }, pose: 'sit-type' },
  { id: 'assessor2', name: 'מאבחנת 2', cameraOff: true },
];

const idOf = (name) => `g${GROUP.findIndex((g) => g.name === name)}`;

export async function intro(api, env) {
  api.layout(['g0', 'g1', 'g2', 'g3', 'g4', 'me', 'assessor', 'assessor2']);
  api.chat('מאבחנת', 'בוקר טוב. נא להשאיר מצלמות פתוחות לכל אורך היום.');
  await api.say('assessor', 'בוקר טוב לכולם. אני המאבחנת שלכם היום. נתחיל בסבב היכרות קצר: שם, מאיפה, ומשהו אחד שאתם אוהבים לעשות.', { voice: true });
  await api.say('g0', 'נוי, מחיפה. אני בתנועת נוער, מדריכה שכבה.');
  await api.say('g1', 'איתמר... מרחובות. אני אוהב לבנות דברים.');
  await api.say('g2', 'מאיה, מבאר שבע. אני מתנדבת במד״א.');
  await api.say('g3', 'עומר מתל אביב, ואני הכי מצחיק פה. בדקתי.');
  await api.say('g4', 'שירה, מקיבוץ בגליל. אני רוקדת.');
  const k = await api.choose(['שם, מאיפה, ומשהו אחד אמיתי שאני אוהב, בשני משפטים', 'רק שם ומאיפה, קצר', 'מספר על כל מה שעשיתי בתיכון, שתי דקות'], 'התור שלך בסבב.');
  addEnv(env, [{ maturity: 0.9, frame: 0.9 }, { maturity: 0.6, frame: 0.8 }, { maturity: 0.4, frame: 0.4 }][k]);
}

export async function groupTask(api, env, state) {
  await api.say('assessor', GROUP_TASK.intro, { voice: true });
  api.chat('מאבחנת', `רעיונות לדוגמה: ${GROUP_TASK.ideas.join(' · ')}`);
  const picks = [];
  for (const m of GROUP_TASK.moments) {
    for (const [name, line] of m.say) await api.say(idOf(name), line);
    const k = await api.choose(m.choices.map((c) => c.text), m.q);
    picks.push(k);
    addEnv(env, m.choices[k].env);
    // The group reacts to what you did.
    if (m.id === 'open') await api.say(k === 0 ? 'g2' : 'g0', k === 0 ? 'רעיון טוב, סבב קצר. אני בעד חונכות.' : k === 1 ? 'מעולה, אז חדר שקט.' : 'אוקיי... לא חייבים להיות חריפים.');
    if (m.id === 'quiet' && k === 0) await api.say('g1', 'כי... גינה זה משהו שכל השכבות עושות יחד. לא רק מי שכבר חברים.');
    if (m.id === 'split') await api.say('g4', k === 0 ? 'אני כותבת. עומר מצייר.' : k === 1 ? '...יצא חדר שקט.' : 'אוקיי, אוקיי. נלך על שלך.');
  }
  state.groupPicks = picks;
  // The poster.
  const merged = picks[2] === 0;
  const poster = el('div', 'zg-poster');
  poster.append(el('h3', '', merged ? 'חונכות בחדר השקט' : picks[2] === 2 ? 'הרעיון שלי' : 'חדר שקט'));
  const ul = el('ul');
  for (const line of merged ? ['חדר שקט פתוח בהפסקות', 'תלמידי י״ב חונכים את ז׳ שם פעמיים בשבוע', 'גינה קטנה בחלון (הרעיון של איתמר)'] : ['חדר שקט פתוח בהפסקות', 'פוסטר של הכללים', 'לוח הרשמה']) ul.append(el('li', '', line));
  poster.append(ul);
  api.share(poster);
  const presenter = picks[3] === 0 ? 'g1' : picks[3] === 1 ? 'me' : 'g0';
  if (presenter === 'g1') {
    await api.say('g1', 'הרעיון שלנו... חונכות בתוך החדר השקט. זה מחבר בין שתי הדעות שהיו.');
    await api.say('me', 'ואת השאר אני אציג: איך זה עובד ביום־יום, ומה צריך מהתקציב.');
  } else if (presenter === 'me') await api.say('me', 'אז הרעיון שלנו, ואני אסביר למה בחרנו בו...');
  else await api.say('g0', 'הרעיון שלנו הוא... טוב, אני אסביר.');
  api.share(null);
  await api.say('assessor', 'תודה. עכשיו הפסקה של עשרים דקות. אחריה ההדרכות.', { voice: true });
}

/** The instruction: pick a topic, put the talk in order (the prep), then your turn passed in the chat. */
export async function teachTask(api, env, state) {
  api.chat('מאבחנת', 'כל אחד קיבל מצגת מוכנה במייל. יש לכם עשר דקות להתכונן. סדר ההצגות ייקבע כאן בצ׳אט.');
  const topic = await api.card((card, done) => {
    card.append(el('h2', '', 'בחר את המצגת שתציג'), el('p', '', 'לפי העדויות מקבלים מצגת מוכנה ומציגים אותה 4–5 דקות. הנושאים כאן של המשחק.'));
    const list = el('div', 'zg-list');
    TEACH.topics.forEach((t, i) => {
      const b = button(t.title, 'zg-item');
      b.addEventListener('click', () => (fx.click(), done(i)));
      list.append(b);
    });
    card.append(list);
  });
  const chosen = TEACH.topics[topic];
  // Prep: the order of the talk.
  const order = await api.card((card, done) => {
    card.append(el('h2', '', 'עשר דקות הכנה: באיזה סדר תדבר?'), el('p', '', 'לחץ על חלקי ההדרכה לפי הסדר שבו תעביר אותם.'));
    const list = el('div', 'zg-list');
    const picked = [];
    const shuffled = TEACH.plan.map((p) => [Math.random(), p]).sort((a, b) => a[0] - b[0]).map(([, p]) => p);
    for (const part of shuffled) {
      const b = button(part, 'zg-item');
      b.addEventListener('click', () => {
        if (picked.includes(part)) return;
        fx.click();
        picked.push(part);
        b.classList.add('done');
        b.textContent = `${picked.length}. ${part}`;
        if (picked.length === TEACH.plan.length) setTimeout(() => done(picked), 400);
      });
      list.append(b);
    }
    card.append(list);
  });
  const right = order.filter((p, i) => p === TEACH.plan[i]).length / TEACH.plan.length;
  addEnv(env, { teach: 0.3 + 0.7 * right, organize: 0.4 + 0.6 * right });

  // Turns in the chat: two people before you. If you miss your turn, the assessor moves on (an account, 01/2026).
  await wait(400);
  api.chat('מאבחנת', 'סדר ההצגות: מאיה, עומר, ואחריו האחרים לפי הסדר בצ׳אט.');
  await api.say('g2', 'אני מציגה על עזרה ראשונה בהתנדבות... (מאיה מציגה ארבע דקות)', { hold: 300 });
  api.chat('עומר', 'מישהו יודע איך משתפים מסך?? 😅');
  await api.say('g3', '(עומר מציג על אימון כושר בבית, וצוחק בעצמו מהשקף השני)', { hold: 300 });
  api.chat('נוי', 'אני יכולה אחרי עומר');
  api.chat('מאבחנת', `הבא בתור: ${state.myName}. מי שמוכן, לוחץ על הכפתור.`);
  const onTime = await api.waitChatButton('אני מוכן להציג', 8);
  state.missedTurn = !onTime;
  if (!onTime) {
    api.chat('מאבחנת', `${state.myName}? לא ראיתי תגובה. נוי, את מתחילה, ו־${state.myName} אחרייך.`);
    await api.say('g0', '(נוי מציגה. אתה מחכה, הדופק עולה)', { hold: 300 });
    addEnv(env, { frame: 0.4, attention: 0.4 });
    await api.say('assessor', `${state.myName}, עכשיו אתה.`, { voice: true });
  } else addEnv(env, { frame: 1, attention: 0.8 });

  // The talk itself, over the slides.
  const slide = (title, text) => {
    const s = el('div', 'zg-slide');
    s.append(el('h3', '', title), el('p', '', text));
    return s;
  };
  api.share(slide(chosen.title, chosen.slides.map((x, i) => `${i + 1}. ${x}`).join(' · ')));
  for (const [i, m] of TEACH.moments.entries()) {
    if (i === 1) {
      api.share(slide(chosen.slides[1], 'שקף 2 מתוך 4'));
      api.chat('עומר', 'לא הבנתי את השלב השני 🙈');
    }
    if (i === 2) {
      api.share(slide(chosen.slides[2], 'שקף 3 מתוך 4'));
      await api.say('assessor', 'נשארה לך דקה.', { hold: 200 });
    }
    const k = await api.choose(m.choices.map((c) => c.text), m.q);
    addEnv(env, m.choices[k].env);
    if (state.missedTurn && i === 0) addEnv(env, { teach: 0.6 });
  }
  api.share(slide('תודה!', 'שאלות?'));
  await wait(900);
  api.share(null);
  await api.say('assessor', 'תודה. עכשיו ניפגש כל אחד לבד לשתי סימולציות. כולם חוץ ממני יוצאים לחדר ההמתנה.', { voice: true });
}

export async function simTasks(api, env) {
  for (const sim of SIMS) {
    api.layout(['assessor', 'me']);
    api.chat('מאבחנת', sim.title);
    const ready = await api.card((card, done) => {
      card.append(el('h2', '', sim.title), el('p', '', sim.setup), el('p', '', 'יש לך דקה לחשוב. לפי העדויות הסימולציה נמשכת 3–6 דקות.'));
      const b = button('אני מוכן', 'zg-item');
      b.addEventListener('click', () => (fx.click(), done(true)));
      card.append(b);
    });
    void ready;
    for (const line of sim.lines) {
      await api.say('assessor', line.say, { voice: true, hold: 200 });
      const k = await api.choose(line.choices.map((c) => c.text));
      addEnv(env, line.choices[k].env);
    }
    await api.say('assessor', 'תודה. סיימנו את הסימולציה הזאת.', { hold: 400 });
  }
  await api.say('assessor', 'זהו, סיימנו להיום. הציונים יעלו לאזור האישי. בהצלחה!', { voice: true });
}
