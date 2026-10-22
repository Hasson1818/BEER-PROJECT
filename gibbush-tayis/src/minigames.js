import { BADACH, RIDDLE, ATTACK, TENT_STEPS, DRESS_ITEMS, BUNKER, CHECKERS, SUDOKU, RESCUE, TRAITS, MY_NUMBER, CLASS_NAME } from './content.js';
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

const shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

/** A shrinking time bar. Calls `onEnd` when time is up; returns a stop function. */
function timer(parent, seconds, onEnd) {
  const track = el('div', 'time-bar');
  const fill = el('div', 'time-fill');
  const label = el('span', 'time-label');
  track.append(fill, label);
  parent.append(track);
  const startedAt = performance.now();
  let stopped = false;
  const tick = () => {
    if (stopped) return;
    const left = Math.max(0, seconds - (performance.now() - startedAt) / 1000);
    fill.style.transform = `scaleX(${left / seconds})`;
    label.textContent = `${Math.ceil(left)}`;
    track.classList.toggle('low', left < seconds * 0.25);
    if (left <= 0) {
      stopped = true;
      onEnd();
      return;
    }
    requestAnimationFrame(tick);
  };
  tick();
  return {
    stop() {
      stopped = true;
    },
    get elapsed() {
      return (performance.now() - startedAt) / 1000;
    },
  };
}

// ---------- The summons ----------

export function summons(ui, tzav) {
  return ui.panel('summons', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'זימון · גיבוש טיס · בית הספר לטיסה, חצרים'), el('h2', '', 'הוזמנת לגיבוש טיס'));
    panel.append(el('p', '', 'עברת את כל שלבי המיון שלפני הגיבוש. נשאר השלב האחרון: חמישה ימים בגבעת הגיבוש.'));
    const steps = el('ol', 'path-list');
    for (const [title, detail] of [
      ['צו ראשון', 'נתוני הסף: פרופיל, דפ״ר וקב״א'],
      ['ירפ״א א׳ (שני חלקים)', 'סימולטור טיסה, מבחנים ממוחשבים ושאלוני אישיות'],
      ['ירפ״א ב׳', 'ראיון עם פסיכולוג ובדיקות רפואיות'],
      ['גיבוש טיס', 'עכשיו. ראשון עד חמישי'],
    ]) {
      const li = el('li');
      li.append(el('strong', '', title), el('span', '', detail));
      steps.append(li);
    }
    panel.append(steps);
    const grid = el('div', 'result-grid');
    const rows = [
      ['פרופיל', tzav?.profile ?? '—', '82 ומעלה', (v) => v >= 82],
      ['דפ״ר', tzav?.dapar ?? '—', '60 ומעלה', (v) => v >= 60],
    ];
    let allOk = true;
    for (const [label, value, need, ok] of rows) {
      const passed = typeof value === 'number' ? ok(value) : false;
      if (tzav && !passed) allOk = false;
      const tile = el('div', `result-tile${tzav && !passed ? ' low' : ''}`);
      tile.append(el('span', '', label), el('strong', '', String(value)), el('small', '', `נדרש: ${need}`));
      grid.append(tile);
    }
    panel.append(grid);
    if (!tzav) panel.append(el('p', 'note', 'עוד לא שיחקת את הצו הראשון, אז אין לנו את הנתונים שלך. נניח שאתה עומד בתנאים.'));
    else if (!allOk) panel.append(el('p', 'note', 'לפי הנתונים שלך מהצו הראשון, במציאות היית צריך לבקש חריג (מיט״ב). במשחק אפשר להמשיך.'));
    else panel.append(el('p', 'note', 'אתה עומד בתנאי הסף שמופיעים במדריכי ההכנה. בהצלחה!'));
    const go = button('לתחנת הרכבת באופקים');
    go.addEventListener('click', () => close());
    panel.append(actions(go));
  });
}

// ---------- On the bus ----------

/** Health declaration, the phone, and the first בד״ח sheet. */
export function busRide(ui) {
  return ui.panel('bus', (panel, close) => {
    const show = (page) => {
      panel.innerHTML = '';
      if (page === 0) {
        panel.append(el('p', 'eyebrow', 'יום ראשון · 11:00 · באוטובוס מאופקים לחצרים'), el('h2', '', 'הצהרת בריאות'));
        panel.append(el('p', '', 'מרגע העלייה לאוטובוס אסור לדבר. ממלאים בשקט.'));
        const form = el('div', 'declaration');
        const questions = ['האם אתה מרגיש טוב היום?', 'האם שתית לפחות שני ליטר מים אתמול?', 'האם ישנת הלילה?', 'האם אתה לוקח תרופות קבועות?'];
        const answers = new Map();
        const next = button('מסור לחיילת');
        next.disabled = true;
        for (const q of questions) {
          const row = el('div', 'decl-row');
          row.append(el('span', '', q));
          for (const a of ['כן', 'לא']) {
            const b = button(a, 'decl-choice');
            b.addEventListener('click', () => {
              click();
              answers.set(q, a);
              row.querySelectorAll('.decl-choice').forEach((x) => x.classList.toggle('on', x === b));
              next.disabled = answers.size < questions.length;
            });
            row.append(b);
          }
          form.append(row);
        }
        next.addEventListener('click', () => show(1));
        panel.append(form, actions(next));
      } else if (page === 1) {
        panel.append(el('p', 'eyebrow', 'הטלפון'), el('h2', '', 'שולחים הודעה הביתה ומכבים'));
        const phone = el('div', 'mini-phone');
        phone.append(el('div', 'bubble', 'אמא, אני מנתק עכשיו. נדבר ביום חמישי ❤️'));
        panel.append(phone, el('p', '', 'בגיבוש אין טלפונים ואין שעונים. החיילת אוספת את הטלפונים לשקית של הכיתה.'));
        const off = button('לכבות ולמסור');
        off.addEventListener('click', () => {
          click();
          show(2);
        });
        panel.append(actions(off));
      } else {
        panel.append(el('p', 'eyebrow', 'מה קיבלת'), el('h2', '', 'בקבוק מים ודף בד״ח ראשון'));
        panel.append(el('p', '', 'בקבוק של ליטר וחצי, שנשאר איתך כל הגיבוש. ודף עם שלושה נהלים קצרים: מכת חום, התייבשות, וצבע אדום בשטח פתוח.'));
        panel.append(el('p', 'note', 'אפשר לפתוח את חוברת הבד״ח בכל רגע: מקש B, או הכפתור 📘 למעלה. יבחנו אותך בלי התראה.'));
        const go = button('ללמוד בדרך');
        go.addEventListener('click', () => close());
        panel.append(actions(go));
      }
    };
    show(0);
  });
}

// ---------- Medic and doctor ----------

export function medicStation(ui) {
  const pulse = 62 + Math.round(Math.random() * 20);
  const temp = (36.4 + Math.random() * 0.5).toFixed(1);
  return ui.panel('measure', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'אולם הספורט · תחנה 1'), el('h2', '', 'חובש ורופאה'));
    const grid = el('div', 'readouts');
    for (const [label, value] of [
      ['דופק', String(pulse)],
      ['חום', `${temp}°`],
      ['טופס רפואי', 'חתום ✓'],
      ['חותמת', 'יד ימין ✓'],
    ]) {
      const cell = el('div', 'readout');
      cell.append(el('span', '', label), el('strong', '', value));
      grid.append(cell);
    }
    const ok = button('לתחנה הבאה');
    ok.addEventListener('click', () => close());
    panel.append(grid, el('p', '', 'מקבלים חותמת על היד אחרי כל תחנה. מי שלא מרגיש טוב, זה הזמן להגיד.'), actions(ok));
  });
}

// ---------- Equipment issue, on the clock ----------

export function gearIssue(ui) {
  const items = ['קיטבג', 'תד״ל: 3 מקלות, 4 יתדות ויריעה', 'שק״ש', 'מזרן שטח', 'מעיל', 'את חפירה'];
  return ui.panel('gear', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'אפסנאות גיבוש · "החלוקה על זמנים"'), el('h2', '', 'חותמים ואורזים'));
    panel.append(el('p', '', 'סמן כל פריט שקיבלת ובדקת. אחרי זה הכול נכנס לקיטבג.'));
    const grid = el('div', 'bag-grid');
    const got = new Set();
    const done = button('חתמתי');
    done.disabled = true;
    let t;
    for (const item of items) {
      const b = button('', 'bag-item');
      const check = el('span', 'check', '');
      b.append(check, item);
      b.addEventListener('click', () => {
        click();
        got.add(item);
        b.classList.add('packed');
        check.textContent = '✓';
        done.disabled = got.size < items.length;
      });
      grid.append(b);
    }
    panel.append(grid);
    t = timer(panel, 25, () => close({ time: 25, missing: items.length - got.size }));
    done.addEventListener('click', () => {
      t.stop();
      close({ time: t.elapsed, missing: 0 });
    });
    panel.append(actions(done));
  });
}

// ---------- Pop-up: grab what you need in a few seconds ----------

export function dressCheck(ui, seconds = 9) {
  return ui.panel('dress', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'הקפצה!'), el('h2', '', 'דיגום מלא. מהר!'));
    panel.append(el('p', '', 'לחץ על כל מה שצריך לקחת לפני שנגמר הזמן.'));
    const grid = el('div', 'bag-grid');
    const note = el('p', 'bag-note');
    const taken = new Set();
    let wrong = 0;
    const needed = DRESS_ITEMS.filter((i) => i.needed);
    const finish = (timeUp) => {
      t.stop();
      const missing = needed.filter((i) => !taken.has(i.id)).map((i) => i.label);
      close({ missing, wrong, timeUp, time: t.elapsed });
    };
    for (const item of shuffle(DRESS_ITEMS)) {
      const b = button('', 'bag-item');
      const check = el('span', 'check', '');
      b.append(check, item.label);
      b.addEventListener('click', () => {
        click();
        if (!item.needed) {
          wrong++;
          b.classList.add('wrong');
          note.textContent = item.note;
          return;
        }
        taken.add(item.id);
        b.classList.add('packed');
        check.textContent = '✓';
        if (taken.size === needed.length) finish(false);
      });
      grid.append(b);
    }
    panel.append(grid, note);
    const t = timer(panel, seconds, () => finish(true));
  });
}

// ---------- The בד״ח booklet ----------

export function badachBook(ui, day) {
  const available = BADACH.filter((p) => p.given <= day);
  return ui.panel('booklet', (panel, close, cleanup) => {
    panel.append(el('p', 'eyebrow', `חוברת בד״ח · ${CLASS_NAME} · מספר ${MY_NUMBER}`), el('h2', '', 'בדיקות חיוניות ונהלי חירום'));
    panel.append(el('p', 'note', 'הנהלים במשחק נכתבו בשביל המשחק. הם לא החוברת האמיתית.'));
    const tabs = el('div', 'booklet-tabs');
    const page = el('div', 'booklet-page');
    const showProc = (proc) => {
      tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.id === proc.id));
      page.innerHTML = '';
      page.append(el('h3', '', proc.title));
      const list = el('ol', 'booklet-steps');
      for (const step of proc.steps) list.append(el('li', '', step));
      page.append(list);
    };
    for (const proc of available) {
      const b = button(proc.title, 'booklet-tab');
      b.dataset.id = proc.id;
      b.addEventListener('click', () => showProc(proc));
      tabs.append(b);
    }
    const locked = BADACH.length - available.length;
    if (locked) tabs.append(el('span', 'booklet-locked', `+${locked} נהלים יחולקו בהמשך`));
    panel.append(tabs, page);
    showProc(available[0]);
    const ok = button('לסגור את החוברת');
    ok.addEventListener('click', () => close());
    panel.append(actions(ok));
    cleanup(
      ui.onKey((event) => {
        if (event.code === 'Escape' || event.code === 'KeyB') close();
      }),
    );
  });
}

/**
 * Oral test on one procedure: pick the steps in order. One mistake ends it
 * ("התרסקת"), like in the debriefs. Resolves to { correct, total }.
 */
export function badachTest(ui, procId, { speaker = 'המ״כ', title = 'מבחן בד״ח' } = {}) {
  const proc = BADACH.find((p) => p.id === procId);
  return ui.panel('badach-test', (panel, close) => {
    panel.append(el('p', 'eyebrow', `${title} · ${speaker}`), el('h2', '', `${MY_NUMBER}, בד״ח ${proc.title}.`));
    panel.append(el('p', '', 'לחץ על הסעיפים לפי הסדר.'));
    const said = el('ol', 'said-steps');
    const grid = el('div', 'step-grid');
    let next = 0;
    const end = (crashed) => {
      grid.querySelectorAll('button').forEach((b) => (b.disabled = true));
      const result = el('p', crashed ? 'test-result bad' : 'test-result good', crashed ? `התרסקת. ${next} מתוך ${proc.steps.length}. "תלמד יותר טוב."` : `${proc.steps.length} מתוך ${proc.steps.length}. "רשמתי."`);
      const ok = button('המשך');
      ok.addEventListener('click', () => close({ correct: next, total: proc.steps.length, crashed }));
      panel.append(result, actions(ok));
    };
    for (const step of shuffle(proc.steps)) {
      const b = button(step, 'step');
      b.addEventListener('click', () => {
        if (step === proc.steps[next]) {
          click();
          next++;
          said.append(el('li', '', step));
          b.disabled = true;
          b.classList.add('done');
          if (next === proc.steps.length) end(false);
        } else {
          b.classList.add('wrong');
          end(true);
        }
      });
      grid.append(b);
    }
    panel.append(said, grid);
  });
}

/** "דו־קרב": you and a rival take turns saying the next line until someone gets it wrong. */
export function badachDuel(ui, procId, rival) {
  const proc = BADACH.find((p) => p.id === procId);
  return ui.panel('badach-test', (panel, close) => {
    panel.append(el('p', 'eyebrow', `דו־קרב בד״ח · מול ${rival}`), el('h2', '', `בד״ח ${proc.title}, בתורות`));
    panel.append(el('p', '', 'אתה מתחיל. בתורך בחר את הסעיף הבא מתוך שלוש אפשרויות.'));
    const said = el('ol', 'said-steps');
    const options = el('div', 'step-grid');
    panel.append(said, options);
    let i = 0;
    let myLines = 0;
    const finish = (won) => {
      options.innerHTML = '';
      panel.append(el('p', won ? 'test-result good' : 'test-result bad', won ? `${rival} טעה. ניצחת בדו־קרב.` : 'טעית. הדו־קרב נגמר.'));
      const ok = button('המשך');
      ok.addEventListener('click', () => close({ won, lines: myLines }));
      panel.append(actions(ok));
    };
    const myTurn = () => {
      options.innerHTML = '';
      const correct = proc.steps[i];
      const wrong = shuffle(proc.steps.filter((s, k) => k !== i)).slice(0, 2);
      for (const text of shuffle([correct, ...wrong])) {
        const b = button(text, 'step');
        b.addEventListener('click', () => {
          if (text !== correct) {
            b.classList.add('wrong');
            finish(false);
            return;
          }
          click();
          myLines++;
          said.append(el('li', '', text));
          i++;
          if (i >= proc.steps.length) {
            // Through the whole procedure: start again from the top, faster.
            i = 0;
            said.innerHTML = '';
          }
          rivalTurn();
        });
        options.append(b);
      }
    };
    let rivalLines = 0;
    const rivalTurn = () => {
      options.innerHTML = '';
      options.append(el('p', 'rival-thinking', `${rival} חושב…`));
      setTimeout(() => {
        rivalLines++;
        // The rival is good, but gets tired after a few lines.
        if (rivalLines >= 3 + Math.floor(Math.random() * 3)) {
          said.append(el('li', 'wrong-line', `${rival}: "…${shuffle(proc.steps)[0]}" ✗`));
          finish(true);
          return;
        }
        said.append(el('li', 'rival-line', `${rival}: ${proc.steps[i]}`));
        i++;
        if (i >= proc.steps.length) {
          i = 0;
          said.innerHTML = '';
        }
        myTurn();
      }, 900);
    };
    myTurn();
  });
}

// ---------- Einstein riddle ----------

export function einstein(ui) {
  return ui.panel('riddle', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'חידת איינשטיין · משימה כיתתית'), el('h2', '', 'מי טס במה, ומאיזה בסיס?'));
    const clues = el('ul', 'clues');
    for (const text of RIDDLE.mine) clues.append(el('li', 'mine', `הרמז שלך: ${text}`));
    for (const [who, text] of RIDDLE.others) clues.append(el('li', '', `${who}: ${text}`));
    panel.append(el('p', '', 'כל אחד בכיתה קיבל רמזים אחרים, והם אומרים אותם בקול:'), clues);
    const table = el('div', 'riddle-table');
    const selects = {};
    for (const name of RIDDLE.people) {
      const row = el('div', 'riddle-row');
      row.append(el('strong', '', name));
      const a = el('select');
      const b = el('select');
      for (const [select, list, placeholder] of [
        [a, RIDDLE.aircraft, 'כלי טיס'],
        [b, RIDDLE.bases, 'בסיס'],
      ]) {
        select.append(new Option(placeholder, ''));
        for (const item of list) select.append(new Option(item, item));
      }
      selects[name] = [a, b];
      row.append(a, b);
      table.append(row);
    }
    panel.append(table);
    const result = el('p', 'bag-note');
    const check = button('מגישים למ״כ');
    let t;
    const finish = (timeUp) => {
      t.stop();
      let correct = 0;
      for (const name of RIDDLE.people) {
        const [a, b] = selects[name];
        if (a.value === RIDDLE.answer[name][0]) correct++;
        if (b.value === RIDDLE.answer[name][1]) correct++;
      }
      const score = correct / (RIDDLE.people.length * 2);
      panel.querySelectorAll('select').forEach((s) => (s.disabled = true));
      check.remove();
      result.className = score === 1 ? 'test-result good' : 'test-result bad';
      result.textContent = timeUp ? `נגמר הזמן. ${correct} מתוך 8 נכונים.` : score === 1 ? 'פתרתם. 8 מתוך 8.' : `${correct} מתוך 8 נכונים.`;
      const answer = el('p', 'note', `הפתרון: ${RIDDLE.people.map((n) => `${n}: ${RIDDLE.answer[n].join(', ')}`).join(' · ')}`);
      const ok = button('המשך');
      ok.addEventListener('click', () => close({ score, time: t.elapsed }));
      panel.append(answer, actions(ok));
    };
    check.addEventListener('click', () => finish(false));
    panel.append(result, actions(check));
    t = timer(panel, 150, () => finish(true));
  });
}

// ---------- Attack planning ----------

export function attackPlan(ui) {
  return ui.panel('plan', (panel, close) => {
    let page = 0;
    const answers = [];
    const show = () => {
      panel.innerHTML = '';
      panel.append(el('p', 'eyebrow', 'תכנון תקיפה · משימה אישית'));
      if (page < ATTACK.pages.length) {
        const p = ATTACK.pages[page];
        panel.append(el('h2', '', p.title));
        const list = el('ul', 'plan-lines');
        for (const line of p.lines) list.append(el('li', '', line));
        panel.append(list);
        const next = button(page === 0 ? 'לעמוד 2' : 'לתכנן');
        next.addEventListener('click', () => {
          page++;
          show();
        });
        panel.append(actions(next));
        return;
      }
      const qi = page - ATTACK.pages.length;
      if (qi < ATTACK.questions.length) {
        const q = ATTACK.questions[qi];
        panel.append(el('h2', '', q.q));
        const peek = el('details', 'plan-peek');
        peek.append(el('summary', '', 'להציץ שוב בנתונים'));
        for (const p of ATTACK.pages) for (const line of p.lines) peek.append(el('p', '', line));
        panel.append(peek);
        const grid = el('div', 'step-grid');
        for (const choice of shuffle(q.choices)) {
          const b = button(choice.text, 'step');
          b.addEventListener('click', () => {
            click();
            answers.push(choice);
            page++;
            show();
          });
          grid.append(b);
        }
        panel.append(grid);
        return;
      }
      // Presenting the plan, then "what if?".
      if (answers.length === ATTACK.questions.length) {
        panel.append(el('h2', '', 'מציגים למ״כים'));
        const summary = el('ul', 'plan-lines');
        ATTACK.questions.forEach((q, i) => summary.append(el('li', '', `${q.q} ${answers[i].text}`)));
        panel.append(summary, el('p', '', `המ״כ: "${ATTACK.whatIf.q}"`));
        const grid = el('div', 'step-grid');
        for (const choice of shuffle(ATTACK.whatIf.choices)) {
          const b = button(choice.text, 'step');
          b.addEventListener('click', () => {
            click();
            answers.push(choice);
            show();
          });
          grid.append(b);
        }
        panel.append(grid);
        return;
      }
      // Feedback.
      panel.append(el('h2', '', 'מה המ״כים ראו'));
      const list = el('ul', 'plan-lines');
      [...ATTACK.questions, ATTACK.whatIf].forEach((q, i) => {
        const a = answers[i];
        list.append(el('li', a.score >= 1 ? 'ok' : 'miss', `${a.score >= 1 ? '✓' : '✗'} ${a.text}: ${a.why}`));
      });
      panel.append(list, el('p', 'note', 'במציאות לא מקבלים משוב. המגבשים רק רושמים.'));
      const score = answers.reduce((a, c) => a + c.score, 0) / answers.length;
      const ok = button('המשך');
      ok.addEventListener('click', () => close({ score, time: t.elapsed }));
      panel.append(actions(ok));
      t.stop();
    };
    const t = timer(panel, 9999, () => {});
    show();
  });
}

// ---------- Scout tent, in pairs ----------

export function scoutTent(ui, partner, seconds = 40) {
  return ui.panel('tent', (panel, close) => {
    panel.append(el('p', 'eyebrow', `אוהל סיירים · בזוג עם ${partner}`), el('h2', '', 'מקימים את האוהל'));
    panel.append(el('p', '', 'לחץ על השלבים לפי הסדר הנכון. טעות עולה זמן.'));
    const done = el('ol', 'said-steps');
    const grid = el('div', 'step-grid');
    let next = 0;
    let mistakes = 0;
    const finish = (timeUp) => {
      t.stop();
      grid.querySelectorAll('button').forEach((b) => (b.disabled = true));
      const ok = next === TENT_STEPS.length;
      panel.append(el('p', ok ? 'test-result good' : 'test-result bad', ok ? `האוהל עומד. ${Math.round(t.elapsed)} שניות.` : 'נגמר הזמן והאוהל לא עומד.'));
      const go = button('המשך');
      go.addEventListener('click', () => close({ done: ok, mistakes, time: t.elapsed, timeUp }));
      panel.append(actions(go));
    };
    for (const step of shuffle(TENT_STEPS)) {
      const b = button(step, 'step');
      b.addEventListener('click', () => {
        if (step === TENT_STEPS[next]) {
          click();
          next++;
          done.append(el('li', '', step));
          b.disabled = true;
          b.classList.add('done');
          if (next === TENT_STEPS.length) finish(false);
        } else {
          mistakes++;
          b.classList.add('wrong');
          setTimeout(() => b.classList.remove('wrong'), 500);
        }
      });
      grid.append(b);
    }
    panel.append(done, grid);
    const t = timer(panel, seconds, () => finish(true));
  });
}

// ---------- Human checkers ----------

export function checkers(ui) {
  return ui.panel('checkers', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'דמקה אנושית · לוח 6 על 6 בחול'), el('h2', '', 'הגע לשורה האחרונה'));
    panel.append(el('p', '', `אתה הכלי הכחול, עם שק חול על הכתפיים. זזים באלכסון קדימה. אפשר לקפוץ מעל שק (כלי של הקבוצה השנייה) אם המשבצת שאחריו ריקה. יש לך ${CHECKERS.maxMoves} מהלכים.`));
    const board = el('div', 'board');
    const status = el('p', 'bag-note');
    let pos = [...CHECKERS.start];
    const blocks = new Set(CHECKERS.blocks.map(([r, c]) => `${r},${c}`));
    let moves = 0;
    let over = false;
    const targets = () => {
      const list = [];
      for (const dc of [-1, 1]) {
        const r1 = pos[0] - 1;
        const c1 = pos[1] + dc;
        if (r1 < 0 || c1 < 0 || c1 > 5) continue;
        if (!blocks.has(`${r1},${c1}`)) list.push({ r: r1, c: c1 });
        else {
          const r2 = pos[0] - 2;
          const c2 = pos[1] + dc * 2;
          if (r2 >= 0 && c2 >= 0 && c2 <= 5 && !blocks.has(`${r2},${c2}`)) list.push({ r: r2, c: c2, jump: `${r1},${c1}` });
        }
      }
      return list;
    };
    const finish = (solved) => {
      over = true;
      draw();
      const ok = button('המשך');
      ok.addEventListener('click', () => close({ solved, moves }));
      panel.append(el('p', solved ? 'test-result good' : 'test-result bad', solved ? 'הגעת לשורה האחרונה!' : 'נגמרו המהלכים או שאין לאן לזוז.'), actions(ok));
    };
    const draw = () => {
      board.innerHTML = '';
      const options = over ? [] : targets();
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 6; c++) {
          const sq = el('button', `sq ${(r + c) % 2 ? 'dark' : 'light'}`);
          sq.type = 'button';
          if (blocks.has(`${r},${c}`)) sq.append(el('span', 'piece bag'));
          if (pos[0] === r && pos[1] === c) sq.append(el('span', 'piece me'));
          const option = options.find((o) => o.r === r && o.c === c);
          if (option) {
            sq.classList.add('target');
            sq.addEventListener('click', () => {
              click();
              if (option.jump) blocks.delete(option.jump);
              pos = [r, c];
              moves++;
              status.textContent = `מהלכים: ${moves} מתוך ${CHECKERS.maxMoves}`;
              if (r === 0) finish(true);
              else if (moves >= CHECKERS.maxMoves || !targets().length) finish(false);
              else draw();
            });
          } else {
            sq.disabled = true;
          }
          board.append(sq);
        }
      }
    };
    status.textContent = `מהלכים: 0 מתוך ${CHECKERS.maxMoves}`;
    panel.append(board, status);
    draw();
  });
}

// ---------- Choose 7 of 10 ----------

export function bunker(ui) {
  return ui.panel('bunker', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'דילמה · קודם לבד, אחר כך בכיתה'), el('h2', '', 'מי נכנס למקלט?'));
    panel.append(el('p', '', BUNKER.intro));
    const grid = el('div', 'bag-grid');
    const chosen = new Set();
    const go = button('זו הבחירה שלי');
    go.disabled = true;
    for (const person of BUNKER.people) {
      const b = button('', 'bag-item');
      const check = el('span', 'check', '');
      b.append(check, person);
      b.addEventListener('click', () => {
        click();
        if (chosen.has(person)) chosen.delete(person);
        else if (chosen.size < 7) chosen.add(person);
        b.classList.toggle('packed', chosen.has(person));
        check.textContent = chosen.has(person) ? '✓' : '';
        go.disabled = chosen.size !== 7;
      });
      grid.append(b);
    }
    go.addEventListener('click', () => {
      const matches = [...chosen].filter((p) => BUNKER.group.includes(p)).length;
      panel.innerHTML = '';
      panel.append(el('p', 'eyebrow', 'אחרי דיון כיתתי'), el('h2', '', `${matches} מתוך 7 בחירות שלך נכנסו לרשימה הכיתתית`));
      panel.append(el('p', '', `הרשימה של הכיתה: ${BUNKER.group.join(', ')}.`));
      panel.append(el('p', 'note', 'אין כאן תשובה נכונה. המגבשים מסתכלים איך מנמקים, ואיך הכיתה מגיעה להחלטה.'));
      const ok = button('המשך');
      ok.addEventListener('click', () => close({ matches }));
      panel.append(actions(ok));
    });
    panel.append(grid, actions(go));
  });
}

// ---------- Sudoku while walking ----------

export function sudoku(ui, seconds = 35) {
  const given = new Set(SUDOKU.given.map(([r, c]) => `${r},${c}`));
  return ui.panel('sudoku', (panel, close) => {
    const memorize = () => {
      panel.innerHTML = '';
      panel.append(el('p', 'eyebrow', 'סודוקו בהליכה · בלי עט'), el('h2', '', 'פותרים בראש תוך כדי הליכה'));
      panel.append(el('p', '', 'בכל שורה, עמודה וריבוע של 2×2 צריכים להופיע 1, 2, 3, 4. בסוף לוקחים לך את הדף, ותצטרך להגיד את הפתרון המלא מהזיכרון.'));
      const grid = el('div', 'sudoku-grid');
      SUDOKU.solution.forEach((row, r) =>
        row.forEach((v, c) => {
          grid.append(el('div', `cell${given.has(`${r},${c}`) ? ' given' : ''}`, given.has(`${r},${c}`) ? String(v) : ''));
        }),
      );
      panel.append(grid, el('p', 'walking', '🚶 הולכים במסלול…'));
      timer(panel, seconds, answer);
    };
    const answer = () => {
      panel.innerHTML = '';
      panel.append(el('p', 'eyebrow', 'המ״כ לקח את הדף'), el('h2', '', 'מה הפתרון?'));
      panel.append(el('p', '', 'לחץ על משבצת כדי להחליף מספר (1→2→3→4). המספרים שהיו בדף כבר מסומנים.'));
      const grid = el('div', 'sudoku-grid');
      const values = SUDOKU.solution.map((row, r) => row.map((v, c) => (given.has(`${r},${c}`) ? v : 0)));
      values.forEach((row, r) =>
        row.forEach((v, c) => {
          const cell = button(v ? String(v) : '', `cell${given.has(`${r},${c}`) ? ' given' : ''}`);
          if (given.has(`${r},${c}`)) cell.disabled = true;
          cell.addEventListener('click', () => {
            values[r][c] = (values[r][c] % 4) + 1;
            cell.textContent = String(values[r][c]);
            click();
          });
          grid.append(cell);
        }),
      );
      const done = button('זה הפתרון');
      done.addEventListener('click', () => {
        let correct = 0;
        let total = 0;
        values.forEach((row, r) =>
          row.forEach((v, c) => {
            if (given.has(`${r},${c}`)) return;
            total++;
            if (v === SUDOKU.solution[r][c]) correct++;
          }),
        );
        panel.append(el('p', correct === total ? 'test-result good' : 'test-result bad', `${correct} מתוך ${total} משבצות נכונות.`));
        done.remove();
        const ok = button('המשך');
        ok.addEventListener('click', () => close({ score: correct / total }));
        panel.append(actions(ok));
      });
      panel.append(grid, actions(done));
    };
    memorize();
  });
}

// ---------- Helicopter rescue ----------

export function rescuePlan(ui) {
  return ui.panel('plan', (panel, close) => {
    const scores = [];
    const show = (i) => {
      panel.innerHTML = '';
      panel.append(el('p', 'eyebrow', 'תכנון חילוץ במסוק · משימה כיתתית'), el('h2', '', i < RESCUE.questions.length ? RESCUE.questions[i].q : 'מוכנים להציג'));
      const list = el('ul', 'plan-lines');
      for (const line of RESCUE.data) list.append(el('li', '', line));
      panel.append(list);
      if (i >= RESCUE.questions.length) {
        const score = scores.reduce((a, b) => a + b, 0) / scores.length;
        panel.append(el('p', score === 1 ? 'test-result good' : 'test-result bad', score === 1 ? 'התוכנית סגורה: שתי גיחות, הקשים בראשונה.' : 'יש חור בתוכנית. 16 אנשים, 8 בכל גיחה: שתי גיחות, והקשים חייבים לעלות ראשונים.'));
        const ok = button('המשך');
        ok.addEventListener('click', () => close({ score }));
        panel.append(actions(ok));
        return;
      }
      const grid = el('div', 'step-grid');
      for (const choice of shuffle(RESCUE.questions[i].choices)) {
        const b = button(choice.text, 'step');
        b.addEventListener('click', () => {
          click();
          scores.push(choice.score);
          show(i + 1);
        });
        grid.append(b);
      }
      panel.append(grid);
    };
    show(0);
  });
}

// ---------- Five traits of a pilot ----------

export function traits(ui) {
  return ui.panel('traits', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'כל מ״כ שואל'), el('h2', '', 'מה חמש התכונות הכי חשובות לטייס?'));
    panel.append(el('p', '', 'בחר חמש. אחר כך הכיתה מסכימה על חמש משותפות, ומקבלים נקודה על כל התאמה.'));
    const grid = el('div', 'bag-grid');
    const chosen = new Set();
    const go = button('לכתוב על הפתק');
    go.disabled = true;
    for (const trait of TRAITS.all) {
      const b = button('', 'bag-item');
      const check = el('span', 'check', '');
      b.append(check, trait);
      b.addEventListener('click', () => {
        click();
        if (chosen.has(trait)) chosen.delete(trait);
        else if (chosen.size < 5) chosen.add(trait);
        b.classList.toggle('packed', chosen.has(trait));
        check.textContent = chosen.has(trait) ? '✓' : '';
        go.disabled = chosen.size !== 5;
      });
      grid.append(b);
    }
    go.addEventListener('click', () => {
      const matches = [...chosen].filter((t) => TRAITS.group.includes(t)).length;
      panel.innerHTML = '';
      panel.append(el('p', 'eyebrow', 'הרשימה של הכיתה'), el('h2', '', `${matches} נקודות`));
      panel.append(el('p', '', TRAITS.group.join(' · ')));
      panel.append(el('p', 'note', 'באתר חיל האוויר מדגישים במיוחד אמינות: "חיל האוויר רוצה לצאת לקרב עם אנשים שהוא יוכל לסמוך עליהם".'));
      const ok = button('המשך');
      ok.addEventListener('click', () => close({ matches }));
      panel.append(actions(ok));
    });
    panel.append(grid, actions(go));
  });
}

// ---------- Self report ----------

/** The מ״כ asks who broke a rule. Resolves to the list of violations you reported. */
export function selfReport(ui, violations, speaker) {
  const open = violations.filter((v) => !v.reported);
  return ui.panel('report', (panel, close) => {
    panel.append(el('p', 'eyebrow', `${speaker}: "מי שעבר על כלל, ניגש אליי."`), el('h2', '', 'על מה אתה מדווח?'));
    if (!open.length) {
      panel.append(el('p', '', 'לא עברת על אף כלל מאז הדיווח הקודם. אין על מה לדווח.'));
      const ok = button('לחזור לשורה');
      ok.addEventListener('click', () => close([]));
      panel.append(actions(ok));
      return;
    }
    panel.append(el('p', '', 'סמן את מה שאתה ניגש לספר. אף אחד לא יודע מה המ״כים ראו.'));
    const grid = el('div', 'bag-grid');
    const chosen = new Set();
    for (const v of open) {
      const b = button('', 'bag-item');
      const check = el('span', 'check', '');
      b.append(check, v.text);
      b.addEventListener('click', () => {
        click();
        if (chosen.has(v)) chosen.delete(v);
        else chosen.add(v);
        b.classList.toggle('packed', chosen.has(v));
        check.textContent = chosen.has(v) ? '✓' : '';
      });
      grid.append(b);
    }
    const go = button('לגשת ולספר');
    const skip = button('לא לגשת', 'button secondary');
    go.addEventListener('click', () => close([...chosen]));
    skip.addEventListener('click', () => close([]));
    panel.append(grid, actions(go, skip));
  });
}

// ---------- Sociometric questionnaire ----------

/**
 * Rank the class from most to least suited to be a pilot, by clicking names in
 * order. Resolves to how close your ranking is to what happened (0..1).
 */
export function sociometric(ui, classmates) {
  // Where each kind of classmate "earned" to be, as a range of places.
  const truth = { leader: [1, 3], helper: [1, 3], smart: [1, 4], steady: [4, 12], dominant: [10, 13], hider: [12, 15], quitter: [13, 15] };
  return ui.panel('socio', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'שאלון סוציומטרי · יום חמישי'), el('h2', '', 'דרג את הכיתה: מי הכי מתאים להיות טייס?'));
    panel.append(el('p', '', 'לחץ על השמות לפי הסדר, מהכי מתאים לפחות מתאים. בתחקירים מדרגים פעמיים: להתאמה לטיס ולהתאמה ללחימה. כאן נעשה פעם אחת.'));
    const notes = el('details', 'plan-peek');
    notes.append(el('summary', '', 'מה ראיתי בגיבוש'));
    for (const p of classmates) if (p.info.note) notes.append(el('p', '', `${p.info.number} · ${p.info.name}: ${p.info.note}`));
    panel.append(notes);
    const grid = el('div', 'bag-grid');
    const order = [];
    const go = button('הגשה');
    go.disabled = true;
    const buttons = classmates.map((person) => {
      const b = button('', 'bag-item');
      const badge = el('span', 'check', '');
      b.append(badge, `${person.info.number} · ${person.info.name}`);
      b.addEventListener('click', () => {
        click();
        const i = order.indexOf(person);
        if (i >= 0) order.splice(i, 1);
        else order.push(person);
        buttons.forEach(({ b: other, badge: otherBadge, person: p }) => {
          const k = order.indexOf(p);
          other.classList.toggle('packed', k >= 0);
          otherBadge.textContent = k >= 0 ? String(k + 1) : '';
        });
        go.disabled = order.length !== classmates.length;
      });
      grid.append(b);
      return { b, badge, person };
    });
    go.addEventListener('click', () => {
      // Average distance outside the range each one "earned"; 0 = a fair ranking.
      const diff =
        order.reduce((a, p, i) => {
          const [lo, hi] = truth[p.info.trait] ?? [4, 12];
          return a + Math.max(0, lo - (i + 1), i + 1 - hi);
        }, 0) / order.length;
      close(Math.max(0, 1 - diff / 4));
    });
    panel.append(grid, actions(go));
  });
}

// ---------- Results ----------

export function resultsPhone(ui, { outcome, lines, socialRank }) {
  return ui.panel('phone-wrap', (panel, close) => {
    panel.className = 'phone';
    const screen = el('div', 'phone-screen');
    screen.append(el('div', 'phone-time', 'יום ראשון · 19:00'));
    const sms = el('div', 'sms');
    sms.append(el('b', '', 'חיל האוויר · מיון לקורס טיס'), `שלום, תשובות גיבוש טיס: `, el('strong', 'sms-outcome', outcome.title));
    sms.append(el('p', 'sms-detail', outcome.detail));
    screen.append(sms);
    const list = el('ul', 'summary-list');
    for (const [label, value] of lines) {
      const li = el('li');
      li.append(el('span', '', label), el('strong', '', value));
      list.append(li);
    }
    screen.append(el('p', 'eyebrow', 'איך היה לך (רק במשחק)'), list);
    if (socialRank) screen.append(el('p', 'note', `לפי החישוב של המשחק, בסוציומטרי של הכיתה היית במקום ${socialRank} מתוך 16.`));
    screen.append(el('p', 'note', 'במציאות לא מקבלים פירוט, והנוסחה של הגיבוש סודית. החישוב כאן פשוט, ונועד להראות מה בודקים.'));
    const next = button('לשלב הבא: שבוע ראיונות');
    const menu = button('לתפריט הראשי', 'button secondary');
    const again = button('לשחק שוב', 'button secondary');
    next.addEventListener('click', () => close('next'));
    menu.addEventListener('click', () => close('menu'));
    again.addEventListener('click', () => close('again'));
    screen.append(actions(next), actions(menu, again));
    panel.append(screen);
    play('sms', { volume: 0.8 });
  });
}
