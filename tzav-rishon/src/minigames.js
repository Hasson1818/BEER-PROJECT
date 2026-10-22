import { BAG_ITEMS, DAPAR_SECTIONS, FACTS, LEARN } from './content.js';
import { beep, click } from '../../shared/engine/audio.js';
import { play } from '../../shared/engine/sound.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (min, max) => Math.round(min + Math.random() * (max - min));

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

// ---------- Bag check (before leaving home) ----------

export function bagCheck(ui) {
  return ui.panel('bag', (panel, close) => {
    panel.append(
      el('p', 'eyebrow', 'יום הצו הראשון · 07:15 בבוקר'),
      el('h2', '', 'מה לוקחים לצו ראשון?'),
      el('p', '', 'לחץ על מה שצריך להכניס לתיק. ' + FACTS.before.points[1]),
    );
    const grid = el('div', 'bag-grid');
    const note = el('p', 'bag-note');
    const go = button('יאללה, יוצאים');
    go.disabled = true;
    const packed = new Set();

    for (const item of BAG_ITEMS) {
      const b = button('', 'bag-item');
      const check = el('span', 'check', '');
      b.append(check, item.label);
      b.addEventListener('click', () => {
        click();
        if (!item.needed) {
          b.classList.add('wrong');
          note.textContent = item.note;
          return;
        }
        if (packed.has(item.id)) {
          packed.delete(item.id);
          b.classList.remove('packed');
          check.textContent = '';
        } else {
          packed.add(item.id);
          b.classList.add('packed');
          check.textContent = '✓';
          note.textContent = '';
        }
        go.disabled = packed.size < BAG_ITEMS.filter((i) => i.needed).length;
      });
      grid.append(b);
    }

    const actions = el('div', 'actions');
    actions.append(go);
    go.addEventListener('click', () => close());
    panel.append(grid, note, actions);
  });
}

// ---------- Computerized test (דפ״ר) ----------

function figureSvg(kind, value, size = 64) {
  if (kind === 'dot') {
    const corners = [
      [16, 16],
      [48, 16],
      [48, 48],
      [16, 48],
    ];
    const [cx, cy] = corners[value];
    return `<svg width="${size}" height="${size}" viewBox="0 0 64 64"><rect x="6" y="6" width="52" height="52" fill="none" stroke="#13263b" stroke-width="3"/><circle cx="${cx}" cy="${cy}" r="7" fill="#13263b"/></svg>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64"><g transform="rotate(${value} 32 32)"><line x1="32" y1="52" x2="32" y2="14" stroke="#13263b" stroke-width="5" stroke-linecap="round"/><polyline points="20,26 32,12 44,26" fill="none" stroke="#13263b" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
}

export function daparTest(ui, stationNumber) {
  return ui.panel('computer', (panel, close, cleanup) => {
    const header = el('div', 'computer-header');
    const title = el('span', '', `מערכת מבחנים ממוחשבת · עמדה ${stationNumber}`);
    const timer = el('span', 'computer-timer', '');
    header.append(title, timer);
    const body = el('div', 'computer-body');
    panel.append(header, body);

    let answerKey = null;
    cleanup(
      ui.onKey((event) => {
        if (event.repeat || !answerKey) return;
        const index = Number(event.key) - 1;
        if (index >= 0) answerKey(index, event);
        else if (['Enter', 'Space'].includes(event.code)) answerKey(-1, event);
      }),
    );

    let countdown = null;
    cleanup(() => clearInterval(countdown));

    function startTimer(seconds, onEnd) {
      clearInterval(countdown);
      const end = performance.now() + seconds * 1000;
      const tick = () => {
        const left = Math.max(0, Math.ceil((end - performance.now()) / 1000));
        timer.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
        timer.classList.toggle('low', left <= 10);
        if (left <= 0) {
          clearInterval(countdown);
          onEnd();
        }
      };
      tick();
      countdown = setInterval(tick, 250);
    }

    function screen(build) {
      body.innerHTML = '';
      build(body);
    }

    function waitForContinue(label) {
      return new Promise((resolve) => {
        const b = button(label);
        const actions = el('div', 'actions');
        actions.append(b);
        body.append(actions);
        const go = () => {
          answerKey = null;
          resolve();
        };
        b.addEventListener('click', go);
        answerKey = (index) => {
          if (index === -1) go();
        };
      });
    }

    async function runSection(section) {
      timer.textContent = '';
      screen((b) => {
        b.append(el('h3', '', section.title), el('p', '', section.instructions), el('p', 'progress', `${section.questions.length} שאלות · ${Math.round(section.time / 60 * 10) / 10} דקות`));
      });
      await waitForContinue('התחל פרק');

      let correct = 0;
      let timeUp = false;
      let resolveSection;
      const sectionDone = new Promise((r) => {
        resolveSection = r;
      });
      startTimer(section.time, () => {
        timeUp = true;
        resolveSection();
      });

      for (let i = 0; i < section.questions.length && !timeUp; i++) {
        const q = section.questions[i];
        const chosen = await Promise.race([
          new Promise((resolve) => {
            screen((b) => {
              b.append(el('h3', '', section.title));
              const question = el('div', 'question');
              if (q.figure) {
                question.innerHTML = `<div style="display:flex;gap:14px;justify-content:center;direction:ltr">${q.sequence
                  .map((v) => figureSvg(q.figure, v))
                  .join('')}<div style="width:64px;height:64px;border:3px dashed #8aa0b8;border-radius:8px;display:grid;place-items:center;font-size:1.6rem">?</div></div>`;
              } else {
                question.textContent = q.q;
                if (q.letters) question.append(el('div', 'letters', q.letters));
              }
              const options = el('div', 'options');
              q.options.forEach((option, index) => {
                const o = button('', 'option');
                o.append(el('span', 'choice-key', String(index + 1)));
                if (q.figure) {
                  const holder = el('span');
                  holder.innerHTML = figureSvg(q.figure, option, 48);
                  o.append(holder);
                } else {
                  o.append(option);
                }
                o.addEventListener('click', () => resolve(index));
                options.append(o);
              });
              b.append(question, options, el('p', 'progress', `שאלה ${i + 1} מתוך ${section.questions.length}`));
              answerKey = (index) => {
                if (index >= 0 && index < q.options.length) resolve(index);
              };
            });
          }),
          sectionDone.then(() => null),
        ]);
        answerKey = null;
        if (chosen === null) break;
        click();
        if (chosen === q.answer) correct++;
      }
      clearInterval(countdown);
      return correct;
    }

    async function attentionTest() {
      timer.textContent = '';
      screen((b) => {
        b.append(
          el('h3', '', 'מבחן קשב'),
          el('p', '', 'על המסך יופיעו עיגולים. כשמופיע עיגול ירוק, לחץ על רווח (או על המסך) כמה שיותר מהר. על עיגול אדום לא לוחצים!'),
        );
      });
      await waitForContinue('התחל');

      const result = { hits: 0, misses: 0, falseAlarms: 0 };
      let current = null;
      let area;
      screen((b) => {
        b.append(el('h3', '', 'מבחן קשב'));
        area = el('div', 'attention-area');
        b.append(area, el('p', 'progress', 'רווח / לחיצה = ירוק'));
      });
      const press = () => {
        if (current?.green && !current.pressed) {
          current.pressed = true;
          result.hits++;
          current.node.style.transform = 'scale(0.6)';
        } else if (current && !current.green && !current.pressed) {
          current.pressed = true;
          result.falseAlarms++;
          beep();
        }
      };
      area.addEventListener('pointerdown', press);
      answerKey = (index, event) => {
        if (event?.code === 'Space') press();
      };

      const end = performance.now() + 22000;
      startTimer(22, () => {});
      while (performance.now() < end) {
        await sleep(500 + Math.random() * 900);
        const green = Math.random() < 0.7;
        const node = el('div', 'attention-dot');
        node.style.background = green ? '#2ecc71' : '#e74c3c';
        node.style.left = `${15 + Math.random() * 70}%`;
        node.style.top = `${20 + Math.random() * 60}%`;
        area.append(node);
        current = { green, pressed: false, node };
        await sleep(900);
        if (current.green && !current.pressed) result.misses++;
        node.remove();
        current = null;
      }
      answerKey = null;
      clearInterval(countdown);
      return result;
    }

    (async () => {
      screen((b) => {
        b.append(
          el('h3', '', 'ברוך הבא למבחן הממוחשב'),
          el('p', '', 'המבחן מורכב מ־4 פרקים ובסוף מבחן קשב קצר. לכל פרק יש זמן מוגבל, ואי אפשר לחזור לפרק שהסתיים.'),
          el('p', '', 'אפשר לענות בעכבר או במקשים 1–4.'),
        );
      });
      await waitForContinue('התחל את המבחן');

      let correct = 0;
      let total = 0;
      for (const section of DAPAR_SECTIONS) {
        correct += await runSection(section);
        total += section.questions.length;
      }
      const attention = await attentionTest();
      timer.textContent = '';
      screen((b) => {
        b.append(
          el('h3', '', 'המבחן הסתיים'),
          el('p', '', 'תודה! הציון לא מוצג עכשיו. הוא יופיע באזור האישי באתר מתגייסים.'),
        );
      });
      await waitForContinue('סיום');
      close({ correct, total, attention });
    })();
  });
}

// ---------- Measurements ----------

export function measurements(ui) {
  const values = {
    height: rand(165, 188),
    weight: rand(56, 84),
    systolic: rand(110, 128),
    diastolic: rand(68, 82),
    pulse: rand(62, 84),
  };
  return ui.panel('measure', (panel, close) => {
    panel.append(el('p', 'eyebrow', 'בדיקות רפואיות · חדר מדידות'), el('h2', '', 'מדידות'));
    const status = el('p', '', '');
    const grid = el('div', 'readouts');
    const rows = [
      ['גובה', `${values.height} ס״מ`, 'עמוד ישר על המשקל, גב לסרגל…'],
      ['משקל', `${values.weight} ק״ג`, 'רגע, המשקל מתייצב…'],
      ['לחץ דם', `${values.systolic}/${values.diastolic}`, 'השרוול מתנפח על היד…'],
      ['דופק', `${values.pulse}`, 'נושמים רגיל…'],
    ];
    const cells = rows.map(([label]) => {
      const cell = el('div', 'readout pending');
      cell.append(el('span', '', label), el('strong', '', '—'));
      grid.append(cell);
      return cell;
    });
    const actions = el('div', 'actions');
    const done = button('תודה');
    done.disabled = true;
    actions.append(done);
    panel.append(status, grid, actions);
    done.addEventListener('click', () => close(values));

    (async () => {
      for (let i = 0; i < rows.length; i++) {
        status.textContent = rows[i][2];
        await sleep(1300);
        cells[i].classList.remove('pending');
        cells[i].querySelector('strong').textContent = rows[i][1];
        click();
      }
      status.textContent = 'הכול תקין. עכשיו לבדיקת הראייה בחדר הסמוך.';
      done.disabled = false;
    })();
  });
}

// ---------- Vision ----------

function drawPlate(canvas, number) {
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const mask = document.createElement('canvas');
  mask.width = mask.height = size;
  const m = mask.getContext('2d');
  m.fillStyle = '#000';
  m.font = `900 ${size * 0.52}px Arial`;
  m.textAlign = 'center';
  m.textBaseline = 'middle';
  m.fillText(String(number), size / 2, size / 2 + size * 0.03);
  const maskData = m.getImageData(0, 0, size, size).data;

  ctx.fillStyle = '#f4efe2';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  const inside = ['#e07b39', '#d9622b', '#eb9a4f', '#c9562a', '#f0a95f'];
  const outside = ['#8fae5a', '#a8be6a', '#7c9b4c', '#b5c77a', '#98b363'];
  for (let i = 0; i < 1400; i++) {
    const r = 2.5 + Math.random() * 5;
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * (size / 2 - r - 2);
    const x = size / 2 + Math.cos(a) * d;
    const y = size / 2 + Math.sin(a) * d;
    const index = (Math.floor(y) * size + Math.floor(x)) * 4 + 3;
    const palette = maskData[index] > 0 ? inside : outside;
    ctx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function visionTest(ui) {
  return ui.panel('computer', (panel, close, cleanup) => {
    const header = el('div', 'computer-header');
    header.append(el('span', '', 'בדיקת ראייה'), el('span', 'computer-timer', ''));
    const body = el('div', 'computer-body');
    panel.append(header, body);

    let onArrow = null;
    cleanup(
      ui.onKey((event) => {
        const map = { ArrowUp: 270, ArrowRight: 0, ArrowDown: 90, ArrowLeft: 180 };
        if (onArrow && event.code in map) {
          event.preventDefault();
          onArrow(map[event.code]);
        }
        const n = Number(event.key) - 1;
        if (onNumber && n >= 0 && n < 4) onNumber(n);
      }),
    );
    let onNumber = null;

    (async () => {
      body.append(
        el('h3', '', 'חלק 1 · חדות ראייה'),
        el('p', '', 'עמוד על הקו הצהוב. לאן פונות ה"רגליים" של האות E? ענה בחיצים במקלדת או בכפתורים.'),
      );
      const chart = el('div', 'eye-chart');
      const letter = el('div', 'eye-letter', 'E');
      chart.append(letter);
      const pad = el('div', 'arrow-pad');
      const dirs = [
        ['up', '↑', 270],
        ['left', '←', 180],
        ['down', '↓', 90],
        ['right', '→', 0],
      ];
      const progress = el('p', 'progress', '');
      let answer = null;
      for (const [cls, label, angle] of dirs) {
        const b = button(label, cls);
        b.addEventListener('click', () => answer?.(angle));
        pad.append(b);
      }
      body.append(chart, pad, progress);

      const sizes = [80, 60, 44, 32, 22, 15];
      let acuity = 0;
      for (let i = 0; i < sizes.length; i++) {
        const angle = [0, 90, 180, 270][Math.floor(Math.random() * 4)];
        letter.style.fontSize = `${sizes[i]}px`;
        letter.style.transform = `rotate(${angle}deg)`;
        progress.textContent = `שורה ${i + 1} מתוך ${sizes.length}`;
        const picked = await new Promise((resolve) => {
          answer = resolve;
          onArrow = resolve;
        });
        click();
        if (picked === angle) acuity++;
      }
      onArrow = null;
      answer = null;

      body.innerHTML = '';
      body.append(el('h3', '', 'חלק 2 · עיוורון צבעים'), el('p', '', 'איזה מספר מסתתר בתוך העיגול?'));
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 230;
      canvas.className = 'plate';
      const options = el('div', 'options');
      const progress2 = el('p', 'progress', '');
      body.append(canvas, options, progress2);

      const plates = [12, 29, 57].sort(() => Math.random() - 0.5);
      let colors = 0;
      for (let i = 0; i < plates.length; i++) {
        const number = plates[i];
        drawPlate(canvas, number);
        const choices = new Set([number]);
        while (choices.size < 3) choices.add(rand(10, 99));
        const list = [...choices].sort(() => Math.random() - 0.5);
        list.push('לא רואה מספר');
        options.innerHTML = '';
        progress2.textContent = `לוח ${i + 1} מתוך ${plates.length}`;
        const picked = await new Promise((resolve) => {
          list.forEach((value, index) => {
            const o = button('', 'option');
            o.append(el('span', 'choice-key', String(index + 1)), String(value));
            o.addEventListener('click', () => resolve(value));
            options.append(o);
          });
          onNumber = (index) => resolve(list[index]);
        });
        onNumber = null;
        click();
        if (picked === number) colors++;
      }

      body.innerHTML = '';
      body.append(
        el('h3', '', 'הבדיקה הסתיימה'),
        el('p', '', `חדות ראייה: ${acuity} מתוך ${sizes.length} שורות. ראיית צבעים: ${colors} מתוך ${plates.length} לוחות.`),
        el('p', '', 'התוצאות עוברות לרופא, שיראה אותן בבדיקה שלו.'),
      );
      const actions = el('div', 'actions');
      const done = button('להמשיך לרופא');
      actions.append(done);
      body.append(actions);
      done.addEventListener('click', () => close({ acuity, colors }));
    })();
  });
}

// ---------- Results on the phone ----------

export function resultsPhone(ui, results) {
  return ui.panel('phone-wrap', (panel, close) => {
    panel.className = 'phone';
    play('sms', { volume: 0.8 });
    const screen = el('div', 'phone-screen');
    const time = el('div', 'phone-time', '16:42');
    const sms = el('div', 'sms');
    sms.append(el('b', '', 'מתגייסים'), 'שלום! התוצאות מהצו הראשון שלך זמינות באזור האישי.');
    const grid = el('div', 'result-grid');
    const tiles = [
      ['פרופיל רפואי', results.profile, '21–97'],
      ['דפ״ר', results.dapar, '10–90'],
      ['קב״א', results.kaba, '41–56'],
      ['ציון עברית', results.hebrew, '5–8'],
    ];
    for (const [label, value, range] of tiles) {
      const tile = el('div', 'result-tile');
      tile.append(el('span', '', label), el('strong', '', String(value)), el('small', '', `טווח: ${range}`));
      grid.append(tile);
    }
    const note = el('p', 'note', 'במשחק החישוב פשוט יותר מבמציאות. הקב״א מחושב מהדפ״ר, ההשכלה והראיון. בקשות לערעור ושינויים עוברים דרך אתר מתגייסים.');
    const actions = el('div', 'actions');
    const next = button('מה המספרים האלה אומרים?');
    actions.append(next);
    screen.append(time, sms, grid, note, actions);
    panel.append(screen);
    next.addEventListener('click', () => close());
  });
}

// ---------- "What do you want to learn about?" ----------

/**
 * Lets the player pick דפ״ר / פרופיל / עברית and read what their own number means.
 * Resolves to 'menu', 'again' or 'next' (the next stage).
 */
export function learnMore(ui, results) {
  return ui.panel('learn', (panel, close) => {
    const values = { dapar: results.dapar, profile: results.profile, hebrew: results.hebrew };
    const seen = new Set();

    function showMenu() {
      panel.innerHTML = '';
      panel.append(
        el('p', 'eyebrow', 'התוצאות שלך'),
        el('h2', '', 'על מה תרצה לדעת עוד?'),
        el('p', '', 'בחר נתון כדי להבין מה הוא אומר, איך הוא נקבע ומה הוא פותח לך.'),
      );
      const grid = el('div', 'learn-grid');
      for (const [key, info] of Object.entries(LEARN)) {
        const card = button('', `learn-card${seen.has(key) ? ' seen' : ''}`);
        card.append(el('span', 'learn-label', info.label), el('strong', '', String(values[key] ?? '—')), el('small', '', `טווח ${info.range}`));
        card.addEventListener('click', () => showTopic(key));
        grid.append(card);
      }
      const actions = el('div', 'actions');
      const nextStage = button('לשלב הבא: יום סיירות');
      const menu = button('לתפריט הראשי', 'button secondary');
      const again = button('לשחק שוב', 'button secondary');
      nextStage.addEventListener('click', () => close('next'));
      menu.addEventListener('click', () => close('menu'));
      again.addEventListener('click', () => close('again'));
      actions.append(nextStage, menu, again);
      panel.append(grid, actions);
    }

    function showTopic(key) {
      seen.add(key);
      const info = LEARN[key];
      panel.innerHTML = '';
      const mine = el('div', 'learn-mine');
      mine.append(el('span', '', 'הציון שלך'), el('strong', '', String(values[key] ?? '—')), el('p', '', info.verdict(values[key])));
      const list = el('ul', 'learn-points');
      for (const point of info.points) list.append(el('li', '', point));
      const actions = el('div', 'actions');
      const back = button('חזרה לבחירה');
      back.addEventListener('click', showMenu);
      actions.append(back);
      panel.append(el('p', 'eyebrow', `טווח ${info.range}`), el('h2', '', info.title), mine, list, actions);
      panel.parentElement?.scrollTo?.({ top: 0 });
    }

    showMenu();
  });
}
