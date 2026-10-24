import './hub.css';
import { PARTS, partResult } from '../shared/progress.js';
import { syncFromResults } from '../../shared/achievements.js';
import { loadResults } from '../../shared/save.js';

// ---------- The route ----------

const DETAILS = {
  'home-test': ['בוחן מקוון של כ־40 דקות מהמחשב בבית', 'שלב חדש מ־2025'],
  'yarpa-a': ['יום בתל השומר: מבחני חשיבה וסימולטור ראשון', 'הכי הרבה מושך נושרים'],
  'yarpa-b': ['סימולטור קשה יותר, שאלונים והשלמת משפטים', 'לפי אתרי הכנה'],
  psychologist: ['שיחת וידאו אחת על אחת עם פסיכולוג/ית', 'כנות ועקביות'],
  gibbush: ['חמישה ימים בבית הספר לטיסה בחצרים', 'כבר במשחק'],
};

const route = document.getElementById('route');
const done = PARTS.filter((p) => partResult(p.id)?.passed || (p.id === 'gibbush' && loadResults('gibbush-tayis')));

PARTS.forEach((part, index) => {
  const finished = done.includes(part);
  const [line, tag] = DETAILS[part.id];
  const a = document.createElement(part.ready ? 'a' : 'div');
  a.className = `stop${finished ? ' done' : ''}${part.ready ? '' : ' soon'}`;
  if (part.ready) a.href = part.id === 'gibbush' ? part.page : `${part.page}?new=1`;
  a.style.setProperty('--i', String(index));
  a.innerHTML = `
    <span class="stop-no">${part.number}</span>
    <span class="stop-text"><strong></strong><small></small><em></em></span>
    <span class="stop-go"><span class="badge"></span><span class="arrow" aria-hidden="true">‹</span></span>`;
  a.querySelector('strong').textContent = part.name;
  a.querySelector('small').textContent = line;
  a.querySelector('em').textContent = tag;
  const badge = a.querySelector('.badge');
  badge.textContent = finished ? '✓ הושלם' : !part.ready ? 'בקרוב' : part.id === 'gibbush' ? 'שלב קיים' : 'חדש';
  badge.classList.add(finished ? 'done' : 'new');
  route.append(a);
});

const wings = document.getElementById('wings');
wings.innerHTML = '<span>כנפיים:</span><span class="pips"></span><span class="count"></span>';
wings.querySelector('.pips').innerHTML = PARTS.map((p) => `<i class="${done.includes(p) ? 'on' : ''}"></i>`).join('');
wings.querySelector('.count').textContent = `${done.length} מתוך ${PARTS.length}`;

// ---------- What is real and what is "usually" ----------

const TRUTH = [
  'רשמי: מאז יולי 2025 יש שלב ראשון מקוון של כ־40 דקות מהבית, שבודק זריזות מחשבה וזיכרון ומשמש כשלב מנפה. הציונים בשלבים מצטברים.',
  'רשמי: ראיון הפסיכולוג מתקיים בזום, מהמחשב, ומי שעבר את השלב הקודם מוזמן אליו.',
  'מקובל, לא רשמי: מבחני החשיבה (כמותי, קובייה, מטוס במרחב), הסימולטורים עם סטיק ומצערת, השאלונים הארוכים והשלמת המשפטים. הכול מתואר באתרי הכנה, מבלוגים ומפורומים. אין פרסום רשמי של התוכן.',
  'לא פורסם בשום מקום: ציוני סף, אחוזי מעבר בכל שלב, ומה בדיוק נבדק בכל מבחן. המשחק לא ממציא אותם: המבחנים כאן הם שחזור בהשראת התיאורים, לא העתק של מבחנים אמיתיים.',
  'מקורות סותרים לא נפתרו: למשל מה בדיוק נקרא "ירפ״א ב׳" (בעמוד הרשמי הישן זה הפסיכולוג והבדיקות הרפואיות, באתרי הכנה זה סימולטור שני ושאלונים). המשחק בנוי על המבנה שהמועמדים מכירים.',
];
const sheet = document.getElementById('sheet');
const list = document.getElementById('sheet-list');
for (const text of TRUTH) {
  const li = document.createElement('li');
  li.textContent = text;
  list.append(li);
}
document.getElementById('truth').addEventListener('click', () => {
  sheet.hidden = false;
  document.getElementById('sheet-close').focus();
});
document.getElementById('sheet-close').addEventListener('click', () => (sheet.hidden = true));
sheet.addEventListener('click', (event) => {
  if (event.target === sheet) sheet.hidden = true;
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') sheet.hidden = true;
});

document.getElementById('reset').addEventListener('click', () => {
  if (!confirm('לאפס את ההתקדמות במסלול לטיס? ההישגים נשארים.')) return;
  try {
    localStorage.removeItem('beer-project-pilot');
  } catch {
    // Nothing to remove.
  }
  window.location.reload();
});

syncFromResults();

// ---------- Sky: stars, a slow drift of clouds and jets crossing with a contrail ----------

const canvas = document.getElementById('sky');
const ctx = canvas.getContext('2d');
let w = 0;
let h = 0;
const dpr = Math.min(window.devicePixelRatio || 1, 2);
function resize() {
  w = window.innerWidth;
  h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const stars = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random() * 0.55, r: Math.random() * 1.3 + 0.2, p: Math.random() * 6 }));
const clouds = Array.from({ length: 7 }, (_, i) => ({ x: Math.random(), y: 0.45 + Math.random() * 0.45, s: 0.6 + Math.random() * 1.2, v: 0.004 + Math.random() * 0.01, a: 0.05 + Math.random() * 0.1 }));
const jets = [];
let nextJet = 1.5;

function spawnJet() {
  const fromRight = Math.random() < 0.5;
  jets.push({ x: fromRight ? 1.1 : -0.1, y: 0.1 + Math.random() * 0.35, v: (fromRight ? -1 : 1) * (0.1 + Math.random() * 0.08), trail: [] });
}

function drawJet(x, y, dir, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * scale, scale);
  ctx.fillStyle = 'rgba(12, 20, 40, 0.85)';
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-6, -2.2);
  ctx.lineTo(-12, -6);
  ctx.lineTo(-9, -1.2);
  ctx.lineTo(-14, 0);
  ctx.lineTo(-9, 1.2);
  ctx.lineTo(-12, 6);
  ctx.lineTo(-6, 2.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

let last = performance.now();
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  ctx.clearRect(0, 0, w, h);
  for (const s of stars) {
    s.p += dt;
    ctx.globalAlpha = 0.35 + Math.sin(s.p * 1.4) * 0.25;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const c of clouds) {
    c.x += c.v * dt;
    if (c.x > 1.3) c.x = -0.3;
    ctx.globalAlpha = c.a;
    ctx.fillStyle = '#fff';
    const cx = c.x * w;
    const cy = c.y * h;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(cx + i * 46 * c.s, cy + Math.sin(i * 1.7) * 10 * c.s, 80 * c.s, 22 * c.s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  nextJet -= dt;
  if (nextJet <= 0 && !reduced) {
    spawnJet();
    nextJet = 7 + Math.random() * 8;
  }
  for (const j of jets) {
    j.x += j.v * dt;
    const px = j.x * w;
    const py = j.y * h;
    j.trail.push({ x: px, y: py, a: 1 });
    if (j.trail.length > 60) j.trail.shift();
    for (const t of j.trail) {
      t.a -= dt * 0.35;
      if (t.a > 0) {
        ctx.globalAlpha = t.a * 0.5;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(t.x, t.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    drawJet(px, py, Math.sign(j.v), 1.4);
  }
  for (let i = jets.length - 1; i >= 0; i--) if (jets[i].x < -0.3 || jets[i].x > 1.3) jets.splice(i, 1);
  ctx.globalAlpha = 1;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
