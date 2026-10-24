import { showScreen, el, button } from '../../shared/screens.js';
import { fx, tone, noise } from '../../shared/fx.js';

// The eye check of ירפ״א ב׳: read letters that get smaller, then eye drops that widen the pupils, so the
// rest of the day is blurry and bright. Resolves to { score }.

const LETTERS = 'CDEFHKNPRUVZ'.split('');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function runEyeTest(game) {
  return showScreen(game, 'eye-screen', async (root, close) => {
    const card = el('div', 'ey-card');
    root.append(card);
    card.append(el('p', 'pp-eyebrow', 'בדיקת ראייה'), el('h2', 'pp-title', 'קראו את האות'));
    card.append(el('p', 'pp-sub', 'האותיות הולכות ומתקטנות. בחרו את האות שאתם רואים (מקשים 1 עד 4). הסתירו עין אחת, כמו שביקשה האחות.'));
    const chart = el('canvas', 'ey-chart');
    chart.width = 420;
    chart.height = 300;
    const choices = el('div', 'ey-choices');
    const info = el('p', 'pp-note', '');
    card.append(chart, choices, info);

    let correct = 0;
    const rows = 8;
    for (let i = 0; i < rows; i++) {
      const letter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
      const options = [letter];
      while (options.length < 4) {
        const l = LETTERS[Math.floor(Math.random() * LETTERS.length)];
        if (!options.includes(l)) options.push(l);
      }
      options.sort(() => Math.random() - 0.5);
      const size = 150 * 0.74 ** i; // each row 26% smaller
      const ctx = chart.getContext('2d');
      ctx.fillStyle = '#f4f4ee';
      ctx.fillRect(0, 0, chart.width, chart.height);
      ctx.fillStyle = '#101010';
      ctx.font = `800 ${Math.max(10, size)}px "Helvetica Neue", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, chart.width / 2, chart.height / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.font = '600 13px Heebo, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`שורה ${i + 1} מתוך ${rows}`, chart.width - 10, 20);
      choices.innerHTML = '';
      const picked = await new Promise((resolve) => {
        const onKey = (e) => {
          const n = Number(e.key);
          if (n >= 1 && n <= 4) done(options[n - 1]);
        };
        const done = (v) => {
          document.removeEventListener('keydown', onKey);
          resolve(v);
        };
        document.addEventListener('keydown', onKey);
        options.forEach((o, k) => {
          const b = button(`${k + 1} · ${o}`, 'ey-choice');
          b.addEventListener('click', () => done(o));
          choices.append(b);
        });
      });
      fx.click();
      if (picked === letter) correct++;
      else if (i >= 4) break; // a miss in the small rows ends the chart
    }
    const score = Math.min(1, correct / rows + 0.1);
    card.innerHTML = '';
    card.append(el('p', 'pp-eyebrow', 'ההמשך'), el('h2', 'pp-title', 'טיפות להרחבת האישונים'));
    card.append(el('p', 'pp-sub', 'לפי אתרי הכנה, אצל חלק מהמועמדים מטפטפים טיפות. אחרי זה הכול מטושטש ובוהק, וממתינים בחדר.'));
    const eye = el('div', 'ey-eye');
    eye.innerHTML = '<i></i>';
    const drop = el('div', 'ey-drop');
    card.append(drop, eye);
    const go = button('להטפטף');
    const actions = el('div', 'pp-actions');
    actions.append(go);
    card.append(actions);
    await new Promise((resolve) => go.addEventListener('click', resolve));
    go.disabled = true;
    drop.classList.add('fall');
    await wait(500);
    fx.drip();
    eye.classList.add('wide');
    tone(300, 0.5, { volume: 0.04, slide: 180 });
    noise(0.4, { freq: 800, q: 0.7, volume: 0.04 });
    await wait(1700);
    const blurry = el('p', 'pp-note', 'מהר מאוד הכול מתחיל להיטשטש ולהיות בוהק. עכשיו מחכים.');
    card.append(blurry);
    await wait(1800);
    close({ score });
  });
}

const STYLE_ID = 'ey-style';
if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .eye-screen { background: radial-gradient(900px 500px at 50% 10%, #1b3355 0%, #0b1424 70%); }
    .ey-card { width: min(560px, 100%); padding: 22px 26px; border-radius: 18px; background: rgba(14,24,44,.94); box-shadow: inset 0 0 0 1px var(--pp-line), 0 30px 80px rgba(0,0,0,.6); text-align: center; animation: pp-fade .3s ease both; }
    .ey-chart { width: min(420px, 100%); height: auto; border-radius: 12px; box-shadow: 0 0 0 4px #0a1120; }
    .ey-choices { display: flex; gap: 8px; justify-content: center; margin: 14px 0 6px; flex-wrap: wrap; }
    .ey-choice { min-width: 76px; min-height: 46px; padding: 0 16px; border-radius: 12px; background: var(--pp-panel); color: #fff; font: 800 1.05rem 'Heebo', sans-serif; cursor: pointer; box-shadow: inset 0 0 0 1px var(--pp-line); }
    .ey-choice:hover { background: rgba(78,161,255,.3); }
    .ey-eye { position: relative; width: 150px; height: 84px; margin: 16px auto 8px; border-radius: 50% / 100%; background: #f6f2ec; overflow: hidden; box-shadow: 0 0 0 4px #2a1a14; }
    .ey-eye i { position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; margin: -23px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #6fa8dc 0%, #3b6e9e 55%, #1c3550 100%); transition: transform 1.4s ease; }
    .ey-eye i::after { content: ''; position: absolute; left: 50%; top: 50%; width: 16px; height: 16px; margin: -8px; border-radius: 50%; background: #05080c; transition: transform 1.4s ease; }
    .ey-eye.wide i::after { transform: scale(2.1); }
    .ey-drop { position: relative; height: 40px; }
    .ey-drop::after { content: ''; position: absolute; left: 50%; top: 0; width: 12px; height: 16px; margin-left: -6px; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; background: #bfe6ff; opacity: 0; }
    .ey-drop.fall::after { animation: ey-fall .55s ease-in both; }
    @keyframes ey-fall { 0% { opacity: 1; top: 0; } 100% { opacity: 1; top: 52px; } }
  `;
  document.head.append(style);
}
