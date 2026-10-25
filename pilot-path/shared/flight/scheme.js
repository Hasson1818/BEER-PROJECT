import { el, button } from '../screens.js';
import { SCHEMES } from './input.js';

/**
 * The card shown before a simulator: how will you fly? Only the chosen way works afterwards:
 * with the keyboard alone the mouse does nothing to the plane, and with the mouse the arrows do nothing.
 * `showCard(build)` is the simulator's own card function. Phones and tablets keep their on-screen stick and skip this.
 */
export function chooseScheme(showCard, controls, fx) {
  // Only a device with no mouse at all (a phone or a tablet) skips this; a touchscreen laptop still asks.
  if (!window.matchMedia('(any-pointer: fine)').matches) return Promise.resolve(controls.state.scheme);
  return showCard((card, done) => {
    card.append(el('p', 'pp-eyebrow', 'בקרים'), el('h2', 'pp-title', 'איך תטיס?'));
    card.append(el('p', 'pp-sub', 'בוחרים דרך אחת. הדרך השנייה לא תפריע: עם מקלדת בלבד העכבר לא מזיז את המטוס.'));
    const row = el('div', 'pp-actions');
    row.style.cssText = 'display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));';
    const buttons = [];
    for (const [id, info] of Object.entries(SCHEMES)) {
      const b = button(info.label, id === controls.state.scheme ? 'pp-btn' : 'pp-btn secondary');
      b.style.cssText = 'display:grid;gap:6px;text-align:center;padding:14px 16px;height:auto;';
      b.append(el('small', '', info.stick), el('small', '', info.throttle));
      b.addEventListener('click', () => {
        fx?.click?.();
        controls.setScheme(id);
        done(id);
      });
      buttons.push(b);
      row.append(b);
    }
    card.append(row);
    buttons.find((b) => b.className === 'pp-btn')?.focus();
  });
}
