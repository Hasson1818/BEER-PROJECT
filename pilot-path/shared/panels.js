import { el, button } from './screens.js';
import { click } from '../../shared/engine/audio.js';
import { play } from '../../shared/engine/sound.js';

// Small panels used by several parts of המסלול לטיס (they use the shared panel styles of the game).

function actions(...buttons) {
  const row = el('div', 'actions');
  row.append(...buttons);
  return row;
}

/** A text message on the phone. Resolves when the player closes it. */
export function smsPanel(ui, { from, text, time = 'היום · 21:15', label = 'הבנתי', extra = null }) {
  return ui.panel('phone-wrap', (panel, close) => {
    panel.className = 'phone';
    const screen = el('div', 'phone-screen');
    screen.append(el('div', 'phone-time', time));
    const sms = el('div', 'sms');
    sms.append(el('b', '', from));
    if (Array.isArray(text)) for (const line of text) sms.append(el('p', 'sms-detail', line));
    else sms.append(text);
    screen.append(sms);
    if (extra) screen.append(extra);
    const ok = button(label, 'button');
    ok.addEventListener('click', () => {
      click();
      close();
    });
    screen.append(actions(ok));
    panel.append(screen);
    play('sms', { volume: 0.8 });
  });
}

/**
 * The answer at the end of a part: an SMS plus a summary of how you did (only in the game: in real life
 * you get no breakdown). `buttons` = [{ id, label, secondary }]. Resolves to the id of the clicked one.
 */
export function answerPhone(ui, { from, time, headline, detail, lines = [], note, buttons }) {
  return ui.panel('phone-wrap', (panel, close) => {
    panel.className = 'phone';
    const screen = el('div', 'phone-screen');
    screen.append(el('div', 'phone-time', time));
    const sms = el('div', 'sms');
    sms.append(el('b', '', from), el('strong', 'sms-outcome', headline));
    for (const line of Array.isArray(detail) ? detail : [detail]) if (line) sms.append(el('p', 'sms-detail', line));
    screen.append(sms);
    if (lines.length) {
      const list = el('ul', 'summary-list');
      for (const [label, value] of lines) {
        const li = el('li');
        li.append(el('span', '', label), el('strong', '', value));
        list.append(li);
      }
      screen.append(el('p', 'eyebrow', 'איך היה לך (רק במשחק)'), list);
    }
    if (note) screen.append(el('p', 'note', note));
    const row = el('div', 'actions');
    for (const b of buttons) {
      const node = button(b.label, b.secondary ? 'button secondary' : 'button');
      node.addEventListener('click', () => {
        click();
        close(b.id);
      });
      row.append(node);
    }
    screen.append(row);
    panel.append(screen);
    play('sms', { volume: 0.8 });
  });
}

/** A checklist to tick off in the 3D world (the objectives are shown by the stage, this is only the sheet). */
export function noticeCard(ui, { eyebrow, title, lines, label = 'הבנתי' }) {
  return ui.panel('prefs', (panel, close) => {
    panel.append(el('p', 'eyebrow', eyebrow), el('h2', '', title));
    const list = el('ul', 'path-list');
    for (const line of lines) list.append(el('li', '', line));
    panel.append(list);
    const ok = button(label, 'button');
    ok.addEventListener('click', () => close());
    panel.append(actions(ok));
  });
}
