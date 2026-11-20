import { showScreen, browserWindow, el, button } from '../../pilot-path/shared/screens.js';
import { fx } from '../../pilot-path/shared/fx.js';
import { STATEMENTS, SCALE, INTERESTS, BACKGROUND, INTERVIEWER } from './content.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The personality questionnaire: one statement at a time, about 9 seconds each (testimonies: 8–10). A statement
 * left without an answer counts as skipped. Then the untimed part: background and interests.
 * Resolves to { answers: {id: 0..3|null}, consistency 0..1, skipped, lie, background: {cs, arabic}, interest }.
 */
export function questionnaire(game) {
  return showScreen(game, 'mt-screen', async (root, close) => {
    const { body } = browserWindow(root, 'https://sorting.intelligence.idf.il/questionnaire');
    const answers = {};
    let skipped = 0;
    const card = el('div', 'mt-stage kh-q');
    body.append(card);
    for (const [i, s] of STATEMENTS.entries()) {
      card.innerHTML = '';
      const head = el('div', 'mt-head');
      const clock = el('span', 'mt-clock', '');
      head.append(el('b', '', 'שאלון אישי'), el('span', '', `היגד ${i + 1} מתוך ${STATEMENTS.length}`), clock);
      const bar = el('div', 'kh-timebar');
      const fill = el('span', '');
      bar.append(fill);
      const text = el('p', 'kh-statement', s.text);
      const grid = el('div', 'kh-scale');
      card.append(head, bar, text, grid);
      const value = await new Promise((resolve) => {
        let t = 9;
        clock.textContent = `${t} שנ׳`;
        fill.style.transition = 'none';
        fill.style.width = '100%';
        requestAnimationFrame(() => {
          fill.style.transition = 'width 9s linear';
          fill.style.width = '0%';
        });
        const timer = setInterval(() => {
          t--;
          clock.textContent = `${Math.max(0, t)} שנ׳`;
          clock.classList.toggle('low', t <= 3);
          if (t <= 0) done(null);
        }, 1000);
        const onKey = (e) => {
          const n = Number(e.key);
          if (n >= 1 && n <= 4) done(n - 1);
        };
        document.addEventListener('keydown', onKey);
        function done(v) {
          clearInterval(timer);
          document.removeEventListener('keydown', onKey);
          resolve(v);
        }
        SCALE.forEach((label, k) => {
          const b = button('', 'mt-choice');
          b.append(el('span', 'mt-key', String(k + 1)), el('span', 'mt-text', label));
          b.addEventListener('click', () => {
            fx.click();
            done(k);
          });
          grid.append(b);
        });
      });
      answers[s.id] = value;
      if (value === null) skipped++;
    }

    // Consistency: each pair asks the same thing twice (one of them reversed). The game's own measure.
    const pairs = {};
    for (const s of STATEMENTS) if (s.pair) (pairs[s.pair] ??= []).push(s);
    let agree = 0;
    let counted = 0;
    for (const [a, b] of Object.values(pairs)) {
      const va = answers[a.id];
      const vb = answers[b.id];
      if (va == null || vb == null) continue;
      const na = a.reverse ? 3 - va : va;
      const nb = b.reverse ? 3 - vb : vb;
      agree += 1 - Math.abs(na - nb) / 3;
      counted++;
    }
    const consistency = counted ? agree / counted : 0.5;
    const lie = answers.l1 === 3;
    const puzzles = answers.b1;

    // The untimed part.
    card.innerHTML = '';
    card.append(el('div', 'mt-head', ''), el('p', 'kh-statement', 'חלק אחרון, בלי זמן: רקע ומה מעניין אותך'));
    const background = {};
    for (const item of BACKGROUND) {
      const row = el('div', 'kh-form-row');
      row.append(el('p', '', item.q));
      const choices = el('div', 'kh-inline');
      item.choices.forEach((label, k) => {
        const b = button(label, 'mt-choice');
        b.addEventListener('click', () => {
          fx.click();
          background[item.id] = k === 0;
          for (const x of choices.children) x.classList.toggle('kh-on', x === b);
          check();
        });
        choices.append(b);
      });
      row.append(choices);
      card.append(row);
    }
    const row = el('div', 'kh-form-row');
    row.append(el('p', '', 'איזה תחום הכי מעניין אותך?'));
    const list = el('div', 'kh-list');
    let interest = null;
    for (const it of INTERESTS) {
      const b = button(it.label, 'mt-choice kh-wide');
      b.addEventListener('click', () => {
        fx.click();
        interest = it.id;
        for (const x of list.children) x.classList.toggle('kh-on', x === b);
        check();
      });
      list.append(b);
    }
    row.append(list);
    const send = button('שליחת השאלון');
    send.disabled = true;
    function check() {
      send.disabled = !(interest && BACKGROUND.every((b) => b.id in background));
    }
    card.append(row, send);
    await new Promise((r) => send.addEventListener('click', () => (fx.click(), r())));
    card.innerHTML = '';
    card.append(el('div', 'mt-logo good', '✓'), el('p', 'kh-statement', 'השאלון נשלח. המיון המקוון הסתיים. אפשר לסגור את החלון.'));
    await wait(1600);
    close({ answers, consistency, skipped, lie, puzzles, background, interest });
  });
}

/**
 * A room in "מתקן רמות": a full-screen scene with a backdrop and a person, and a dialogue box in it.
 * `script(api)` runs the scene; api.say(text), api.ask(text, choices) → index, api.setScene(place, who).
 */
export function roomScene(game, { place, who }, script) {
  return showScreen(game, 'kh-room-screen', async (root, close) => {
    const backdrop = el('div', 'kh-room');
    const placeTag = el('div', 'kh-place', place);
    const person = el('div', 'kh-person');
    const face = el('div', 'kh-face', who?.icon ?? '🙂');
    const tag = el('div', 'kh-who', who ? `${who.name} · ${who.title}` : '');
    person.append(face, tag);
    person.hidden = !who;
    const box = el('div', 'kh-dialogue');
    const speaker = el('div', 'kh-speaker', '');
    const text = el('p', 'kh-text', '');
    const choices = el('div', 'kh-choices');
    box.append(speaker, text, choices);
    backdrop.append(placeTag, person, box);
    root.append(backdrop);

    const api = {
      setScene(nextPlace, nextWho) {
        placeTag.textContent = nextPlace;
        person.hidden = !nextWho;
        if (nextWho) {
          face.textContent = nextWho.icon ?? '🙂';
          tag.textContent = `${nextWho.name} · ${nextWho.title}`;
        }
      },
      say(line, from = who?.name ?? '') {
        return api.ask(line, ['המשך ◂'], from).then(() => undefined);
      },
      ask(line, options, from = who?.name ?? '') {
        speaker.textContent = from;
        text.textContent = line;
        choices.innerHTML = '';
        return new Promise((resolve) => {
          const onKey = (e) => {
            const n = Number(e.key);
            if (n >= 1 && n <= options.length) buttons[n - 1].click();
            else if ((e.key === 'Enter' || e.key === ' ') && options.length === 1) buttons[0].click();
          };
          document.addEventListener('keydown', onKey);
          const buttons = options.map((label, k) => {
            const b = button('', options.length === 1 ? 'kh-next' : 'mt-choice kh-wide');
            if (options.length > 1) b.append(el('span', 'mt-key', String(k + 1)));
            b.append(el('span', 'mt-text', label));
            b.addEventListener('click', () => {
              fx.click();
              document.removeEventListener('keydown', onKey);
              resolve(k);
            });
            choices.append(b);
            return b;
          });
        });
      },
      wait,
    };
    const value = await script(api);
    close(value);
  });
}

export { INTERVIEWER };
