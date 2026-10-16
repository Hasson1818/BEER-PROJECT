import { click } from './audio.js';

// "Draw a map of Israel in the sand": tap where each place is.
// Used by the field stages; styles are in field.css.

// Rough outline of the land between the sea and the Jordan: [longitude, latitude].
const MAP_OUTLINE = [
  [35.1, 33.09], [35.57, 33.28], [35.75, 33.33], [35.85, 33.1], [35.75, 32.72], [35.57, 32.62], [35.55, 32.2],
  [35.52, 31.85], [35.55, 31.75], [35.42, 31.1], [35.3, 30.9], [35.15, 30.4], [35.0, 29.9], [34.95, 29.55],
  [34.9, 29.49], [34.7, 30.0], [34.5, 30.6], [34.27, 31.22], [34.22, 31.32], [34.48, 31.6], [34.57, 31.67],
  [34.65, 31.8], [34.77, 32.08], [34.85, 32.33], [34.9, 32.45], [34.96, 32.83], [35.07, 32.93], [35.09, 33.0],
];

const project = ([lon, lat]) => [(lon - 34.1) * 100, (33.45 - lat) * 118];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * `places` is a list of [name, longitude, latitude]. Resolves to accuracy 0..1
 * (each place scores 1 when exact, 0 when 60 km or more away).
 */
export function mapTask(ui, places, { eyebrow = 'משימת צוות · מפה בחול', title = 'סמנו את המקומות על המפה', done = 'סיימנו את המפה' } = {}) {
  return ui.panel('map-task', (panel, close) => {
    const ns = 'http://www.w3.org/2000/svg';
    const [w, h] = project([35.95, 29.4]);
    panel.append(el('p', 'eyebrow', eyebrow), el('h2', '', title));
    const prompt = el('p', 'map-prompt', '');
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('class', 'sand-map');
    const outline = document.createElementNS(ns, 'polygon');
    outline.setAttribute('points', MAP_OUTLINE.map((p) => project(p).join(',')).join(' '));
    outline.setAttribute('class', 'map-land');
    svg.append(outline);
    const sea = document.createElementNS(ns, 'text');
    sea.setAttribute('x', '6');
    sea.setAttribute('y', String(h * 0.42));
    sea.setAttribute('class', 'map-sea');
    sea.textContent = 'הים';
    svg.append(sea);
    const layout = el('div', 'map-layout');
    const side = el('div', 'map-side');
    const list = el('ol', 'map-list');
    side.append(prompt, list);
    layout.append(svg, side);
    panel.append(layout);

    const results = [];
    let index = 0;
    const showPrompt = () => {
      prompt.textContent = index < places.length ? `איפה ${places[index][0]}? לחץ על המפה.` : 'כל הכבוד. בירוק: המקומות האמיתיים.';
    };
    showPrompt();

    const dot = (x, y, cls, label) => {
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', x);
      c.setAttribute('cy', y);
      c.setAttribute('r', '3.4');
      c.setAttribute('class', cls);
      svg.append(c);
      if (label) {
        const t = document.createElementNS(ns, 'text');
        t.setAttribute('x', x + 5);
        t.setAttribute('y', y + 3);
        t.setAttribute('class', 'map-label');
        t.textContent = label;
        svg.append(t);
      }
    };

    svg.addEventListener('pointerdown', (event) => {
      if (index >= places.length) return;
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const local = point.matrixTransform(svg.getScreenCTM().inverse());
      const [name, lon, lat] = places[index];
      const [tx, ty] = project([lon, lat]);
      const km = Math.hypot((local.x - tx) * 0.94, (local.y - ty) * 0.94);
      results.push(Math.max(0, 1 - km / 60));
      dot(local.x, local.y, 'map-guess', name);
      list.append(el('li', '', `${name}: ${km < 8 ? 'בול!' : `סטייה של כ־${Math.round(km)} ק״מ`}`));
      click();
      index++;
      if (index === places.length) {
        for (const [, lo, la] of places) dot(...project([lo, la]), 'map-true');
        const finish = el('button', 'button', done);
        finish.type = 'button';
        finish.addEventListener('click', () => close(results.reduce((a, b) => a + b, 0) / results.length));
        const row = el('div', 'actions');
        row.append(finish);
        side.append(row);
      }
      showPrompt();
    });
  });
}
