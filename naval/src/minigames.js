import { BOOKLET, HYDRAULICS, DRAWING } from './content.js';
import { click } from '../../shared/engine/audio.js';
import { play } from '../../shared/engine/sound.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text, className = 'button') {
  const b = el('button', className, text);
  b.type = 'button';
  return b;
}
function actions(...buttons) {
  const row = el('div', 'actions');
  row.append(...buttons);
  return row;
}
function timerLine(node, seconds, onEnd, label = 'זמן') {
  let left = seconds;
  node.textContent = `${label}: ${left} שנ׳`;
  const id = setInterval(() => {
    left--;
    node.textContent = `${label}: ${Math.max(0, left)} שנ׳`;
    if (left <= 0) {
      clearInterval(id);
      onEnd();
    }
  }, 1000);
  return () => clearInterval(id);
}

/** Multiple-choice questions, one after another. Resolves to the share right (0..1). */
export function quiz(ui, { eyebrow, questions, seconds = null }) {
  return ui.panel('fact', (panel, close, cleanup) => {
    let right = 0;
    let i = 0;
    const time = el('p', 'note');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      close(right / questions.length);
    };
    const show = () => {
      panel.innerHTML = '';
      if (i >= questions.length) return finish();
      const item = questions[i];
      panel.append(el('p', 'eyebrow', `${eyebrow} · שאלה ${i + 1} מתוך ${questions.length}`), el('h2', '', item.q));
      const grid = el('div', 'bag-grid');
      item.choices.forEach((choice, j) => {
        const b = button(choice, 'bag-item');
        b.addEventListener('click', () => {
          click();
          if (j === item.answer) right++;
          i++;
          show();
        });
        grid.append(b);
      });
      panel.append(grid, time);
    };
    show();
    if (seconds) cleanup(timerLine(time, seconds, finish, 'זמן למבחן'));
  });
}

/** The booklet: a few pages to read in the time there is. */
export function bookletStudy(ui, seconds = 50) {
  return ui.panel('fact', (panel, close, cleanup) => {
    panel.append(el('p', 'eyebrow', 'הפנקס · כ־50 עמודים במציאות, כאן ארבעה'), el('h2', '', BOOKLET.title));
    for (const [title, text] of BOOKLET.pages) {
      panel.append(el('h3', 'nv-h3', title), el('p', '', text));
    }
    const time = el('p', 'note');
    const done = button('סגרתי את הפנקס');
    done.addEventListener('click', () => close());
    panel.append(el('p', 'note', 'הטקסט נכתב בשביל המשחק. על הפנקס יהיו מבחנים קצרים בכל יום.'), time, actions(done));
    cleanup(timerLine(time, seconds, () => close(), 'זמן קריאה'));
  });
}

/** The hydraulics "video": the parts light up one after another, once. */
export function hydraulicsVideo(ui) {
  return ui.panel('fact', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'יום א׳ בערב · סרטון שייבחן מאוחר יותר'), el('h2', '', HYDRAULICS.title));
    const flow = el('div', 'nv-flow');
    const boxes = HYDRAULICS.steps.map((s) => {
      const b = el('div', 'nv-step', s);
      flow.append(b);
      return b;
    });
    panel.append(flow, el('p', 'note', 'במציאות זה סרטון על ההידראוליקה של צוללת. התוכן כאן פשוט ושל המשחק.'));
    let k = 0;
    const id = setInterval(() => {
      boxes.forEach((b, i) => b.classList.toggle('on', i === k));
      play('sms', { volume: 0.15, rate: 2 });
      k++;
      if (k > boxes.length) {
        clearInterval(id);
        boxes.forEach((b) => b.classList.remove('on'));
        const ok = button('הסרטון נגמר');
        ok.addEventListener('click', () => close());
        panel.append(actions(ok));
      }
    }, 1400);
  });
}

/**
 * The closed raft: kneeling facing the wall while it rocks. Keep the nausea down by breathing slowly and looking
 * at one point (press when the circle is full). Resolves to { score, vomited }.
 */
export function raftEndurance(ui, seconds = 40) {
  return ui.panel('raft', (panel, close, cleanup) => {
    panel.append(el('p', 'eyebrow', 'סירת ההקאות · במציאות 20–30 דקות, כאן 40 שניות'), el('h2', '', 'על הברכיים, מול הדופן'));
    const view = el('div', 'nv-raft');
    const dot = el('div', 'nv-dot');
    view.append(dot);
    const nausea = el('div', 'nv-bar');
    const nauseaFill = el('i');
    nausea.append(el('span', '', 'בחילה'), nauseaFill);
    const breath = el('div', 'nv-bar breath');
    const breathFill = el('i');
    breath.append(el('span', '', 'נשימה'), breathFill);
    const hint = el('p', 'note', 'לחץ "נשימה" כשהעיגול מתמלא (או רווח). מהר מדי זה מגביר את הבחילה.');
    const go = button('נשימה עמוקה');
    panel.append(view, nausea, breath, hint, actions(go));
    let level = 0.2;
    let cycle = 0;
    let t = 0;
    let good = 0;
    let presses = 0;
    let vomited = false;
    const press = () => {
      presses++;
      if (cycle > 0.8) {
        good++;
        level = Math.max(0, level - 0.12);
        click();
      } else level = Math.min(1, level + 0.05);
      cycle = 0;
    };
    go.addEventListener('click', press);
    const onKey = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        press();
      }
    };
    document.addEventListener('keydown', onKey);
    cleanup(() => document.removeEventListener('keydown', onKey));
    let lastTick = performance.now();
    const id = setInterval(() => {
      // Real elapsed time (a background tab slows timers down), in steps of 0.1 s so the rates below stay right.
      const now = performance.now();
      const steps = Math.max(1, Math.min(10, Math.round((now - lastTick) / (0.1 * 1000))));
      lastTick = now;
      t += 0.1 * steps;
      cycle = Math.min(1, cycle + (0.1 * steps) / 3.5);
      // About 0.04 a second: slow, steady breaths (one every 3.5 s, -0.12 each) keep it down; gasping doesn't.
      level = Math.min(1, level + (0.0032 + Math.max(0, Math.sin(t * 1.3)) * 0.0025) * steps);
      view.style.transform = `rotate(${Math.sin(t * 1.4) * 6}deg) translateY(${Math.sin(t * 2.1) * 6}px)`;
      dot.style.transform = `scale(${0.6 + cycle * 0.6})`;
      dot.classList.toggle('ready', cycle > 0.8);
      nauseaFill.style.transform = `scaleX(${level})`;
      breathFill.style.transform = `scaleX(${cycle})`;
      if (level >= 1 && !vomited) {
        vomited = true;
        level = 0.55;
        hint.textContent = 'הקאת. מישהו לידך מתחיל גם. ממשיכים: נשימה, נקודה אחת על הדופן.';
      }
      if (t >= seconds) {
        clearInterval(id);
        close({ score: Math.max(0, Math.min(1, 1 - level * 0.6 + (good / Math.max(8, presses)) * 0.3 - (vomited ? 0.25 : 0))), vomited });
      }
    }, 100);
    cleanup(() => clearInterval(id));
  });
}

/** Tug-of-war: pull on "הופ!". Resolves to the share of good pulls (0..1) and whether your side won. */
export function tugOfWar(ui, seconds = 25) {
  return ui.panel('fact', (panel, close, cleanup) => {
    panel.append(el('p', 'eyebrow', 'משיכת חבל · מחלקה מול מחלקה'), el('h2', '', 'מושכים ביחד עם הקריאה'));
    const lane = el('div', 'nv-tug');
    const knot = el('div', 'nv-knot');
    lane.append(el('span', 'nv-side', 'אנחנו'), knot, el('span', 'nv-side', 'הם'));
    const call = el('div', 'nv-bar breath');
    const callFill = el('i');
    call.append(el('span', '', 'קריאה'), callFill);
    const go = button('משיכה!');
    panel.append(lane, call, el('p', 'note', 'לחץ כשהקריאה בשיא (או E / רווח). משיכה לבד, לא בקצב, מושכת אתכם קדימה.'), actions(go));
    let pos = 0;
    let c = 0;
    let pulls = 0;
    let good = 0;
    let t = 0;
    const pull = () => {
      pulls++;
      if (c > 0.82) {
        good++;
        pos -= 0.08;
        click();
      } else pos += 0.02;
    };
    go.addEventListener('click', pull);
    const onKey = (e) => {
      if ((e.code === 'Space' || e.code === 'KeyE') && !e.repeat) {
        e.preventDefault();
        pull();
      }
    };
    document.addEventListener('keydown', onKey);
    cleanup(() => document.removeEventListener('keydown', onKey));
    let lastTick = performance.now();
    const id = setInterval(() => {
      // Real elapsed time (a background tab slows timers down), in steps of 0.1 s so the rates below stay right.
      const now = performance.now();
      const steps = Math.max(1, Math.min(10, Math.round((now - lastTick) / (0.1 * 1000))));
      lastTick = now;
      t += 0.1 * steps;
      c = (c + (0.1 * steps) / 1.2) % 1;
      pos += 0.006 * steps; // The other side pulls all the time.
      callFill.style.transform = `scaleX(${c})`;
      knot.style.transform = `translateX(${Math.max(-1, Math.min(1, pos)) * 120}px)`;
      if (t >= seconds || Math.abs(pos) >= 1) {
        clearInterval(id);
        close({ score: good / Math.max(10, pulls), won: pos < 0 });
      }
    }, 100);
    cleanup(() => clearInterval(id));
  });
}

/** The engineering drawing: shown once, then a question. Resolves to 0..1. */
export async function drawingTest(ui) {
  await ui.panel('fact', (panel, close, cleanup) => {
    panel.append(el('p', 'eyebrow', 'מבחן מגמה · מכונה · תזכור את השרטוט'), el('h2', '', DRAWING.title));
    const flow = el('div', 'nv-flow row');
    for (const part of DRAWING.parts) flow.append(el('div', 'nv-step on', part));
    const time = el('p', 'note');
    panel.append(flow, time);
    cleanup(timerLine(time, 8, () => close(), 'השרטוט נעלם בעוד'));
  });
  return quiz(ui, { eyebrow: 'מבחן מגמה · מכונה', questions: [{ q: DRAWING.q, choices: DRAWING.choices, answer: DRAWING.answer }] });
}

/** The interception simulator: missiles come down, click them before they hit. Resolves to 0..1. */
export function interceptSim(ui, seconds = 25) {
  return ui.panel('intercept', (panel, close, cleanup) => {
    panel.append(el('p', 'eyebrow', 'מבחן מגמה · אלקטרוניקה'), el('h2', '', 'סימולטור יירוט'), el('p', 'note', 'לפי העדויות יש סימולטור יירוט טילים. איך הוא נראה לא פורסם; זה של המשחק. לחץ על כל טיל לפני שהוא מגיע לספינה.'));
    const field = el('div', 'nv-field');
    const ship = el('div', 'nv-ship', '⛴');
    field.append(ship);
    const score = el('p', 'nv-score', '');
    panel.append(field, score);
    let hits = 0;
    let missed = 0;
    let t = 0;
    const missiles = new Set();
    const spawn = () => {
      const m = el('button', 'nv-missile', '▼');
      m.type = 'button';
      m.style.left = `${8 + Math.random() * 84}%`;
      m.dataset.y = '0';
      m.dataset.v = String(0.9 + Math.random() * 0.9 + t / 25);
      m.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        hits++;
        click();
        m.remove();
        missiles.delete(m);
      });
      field.append(m);
      missiles.add(m);
    };
    let lastTick = performance.now();
    const id = setInterval(() => {
      // Real elapsed time (a background tab slows timers down), in steps of 0.05 s so the rates below stay right.
      const now = performance.now();
      const steps = Math.max(1, Math.min(10, Math.round((now - lastTick) / (0.05 * 1000))));
      lastTick = now;
      t += 0.05 * steps;
      if (Math.random() < 0.05 + t / 600) spawn();
      for (const m of [...missiles]) {
        const y = Number(m.dataset.y) + Number(m.dataset.v) * 0.05 * 22 * steps;
        m.dataset.y = String(y);
        m.style.top = `${y}%`;
        if (y > 86) {
          missed++;
          m.remove();
          missiles.delete(m);
          ship.classList.remove('hit');
          void ship.offsetWidth;
          ship.classList.add('hit');
        }
      }
      score.textContent = `יורטו: ${hits} · פגעו: ${missed}`;
      if (t >= seconds) {
        clearInterval(id);
        close(hits / Math.max(1, hits + missed));
      }
    }, 50);
    cleanup(() => clearInterval(id));
  });
}

/** The online screening's writing parts: sentence completion and a story about a picture. Resolves to 0..1. */
export async function writingParts(ui) {
  let total = 0;
  const sentences = [
    { start: 'כשאני תחת לחץ, אני…', options: ['עוצר, נושם ומחליט מה הדבר הראשון לעשות', 'מתעצבן על כולם', 'מחכה שמישהו אחר יחליט'], scores: [1, 0.2, 0.3] },
    { start: 'החברים שלי אומרים שאני…', options: ['אמין, ולפעמים עקשן', 'מושלם', 'לא יודע מה הם אומרים'], scores: [1, 0.2, 0.4] },
    { start: 'הכישלון הכי גדול שלי…', options: ['היה כשוויתרתי על נבחרת. למדתי לא לוותר באמצע', 'עוד לא קרה', 'לא רלוונטי לכאן'], scores: [1, 0.2, 0.2] },
  ];
  for (const s of sentences) {
    const k = await ui.talk('המיון המקוון · השלמת משפטים', s.start, s.options);
    total += s.scores[k];
  }
  const story = await ui.talk(
    'המיון המקוון · סיפור על תמונה',
    'בתמונה: אדם עומד על מזח בלילה, מסתכל על ספינה רחוקה. מה הסיפור שתכתוב?',
    ['קצין צעיר שמחכה לצאת למשימה הראשונה שלו. הוא לחוץ, אבל יודע שהצוות סומך עליו', 'אדם שמתגעגע למישהו', 'אין לי מושג'],
  );
  total += [1, 0.6, 0.1][story];
  return total / (sentences.length + 1);
}

// ---------- Sociometric (the naval version: best commander, best friend) ----------

const SOCIO = {
  commander: { leader: 1, helper: 0.8, steady: 0.7, loud: 0.3, hider: 0.1, quitter: 0.1, cheater: 0.1 },
  friend: { helper: 1, steady: 0.8, leader: 0.8, loud: 0.3, hider: 0.2, quitter: 0.4, cheater: 0.1 },
};
export function sociometric(ui, teammates) {
  const names = teammates.filter((t) => !t.info.out).map((t) => t.info);
  const questions = [
    { q: 'מי המפקד הכי טוב במחלקה?', key: 'commander' },
    { q: 'מי החבר הכי טוב שהיה לך בגיבוש?', key: 'friend' },
  ];
  return ui.panel('socio', (panel, close) => {
    const answers = [];
    const show = (i) => {
      panel.innerHTML = '';
      panel.append(el('p', 'eyebrow', `סוציומטרי · שאלה ${i + 1} מתוך 2`), el('h2', '', questions[i].q), el('p', '', 'אלה שתי השאלות שהעדויות מתארות. ענה לפי מה שראית.'));
      const grid = el('div', 'bag-grid');
      for (const info of names) {
        const b = button('', 'bag-item');
        b.append(el('span', 'check', ''), info.note ? `${info.name} · ${info.note}` : info.name);
        b.addEventListener('click', () => {
          click();
          answers.push(SOCIO[questions[i].key][info.trait] ?? 0.5);
          if (i + 1 < questions.length) show(i + 1);
          else close(answers.reduce((a, b2) => a + b2, 0) / answers.length);
        });
        grid.append(b);
      }
      panel.append(grid);
    };
    show(0);
  });
}
