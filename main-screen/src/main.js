import './style.css';
import { createBackground } from './scene.js';

const SAVE_KEY = 'beer-project-save';

const canvas = document.getElementById('bg');
try {
  createBackground(canvas);
} catch (error) {
  // No WebGL: the CSS gradient on <body> stays as the background.
  console.warn('3D background unavailable', error);
  canvas.remove();
}

function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const save = readSave();
if (save) {
  document.getElementById('continue-note').textContent = `שמור: ${save.stageName ?? 'שלב לא ידוע'}`;
}

const toast = document.getElementById('toast');
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

const startButton = document.getElementById('start');
const continueButton = document.getElementById('continue');

// The stages don't exist yet, so the buttons only explain that for now.
startButton.addEventListener('click', () => {
  showToast('השלב הראשון, צו ראשון, עדיין בבנייה');
});

continueButton.addEventListener('click', () => {
  showToast(save ? 'טעינת שמירה עדיין לא מוכנה' : 'עדיין אין משחק שמור. התחל משחק חדש');
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && document.activeElement === document.body) {
    startButton.click();
  }
});

requestAnimationFrame(() => document.body.classList.add('ready'));
