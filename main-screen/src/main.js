import './style.css';
import { createBackground } from './scene.js';
import { loadSave } from '../../shared/save.js';

const canvas = document.getElementById('bg');
try {
  createBackground(canvas);
} catch (error) {
  // No WebGL: the CSS gradient on <body> stays as the background.
  console.warn('3D background unavailable', error);
  canvas.remove();
}

// Each stage has its own page; the save remembers which one you were in.
const STAGE_PAGES = { 'tzav-rishon': '../tzav-rishon/', 'yom-sayarot': '../yom-sayarot/' };

const save = loadSave();
if (save) {
  document.getElementById('continue-note').textContent = `שמור: ${save.stageName ?? 'שלב לא ידוע'}`;
}

const mainActions = document.getElementById('main-actions');
const stages = document.getElementById('stages');
function showStages(show) {
  mainActions.hidden = show;
  stages.hidden = !show;
  (show ? stages.querySelector('.stage') : document.getElementById('choose')).focus();
}
document.getElementById('choose').addEventListener('click', () => showStages(true));
document.getElementById('back').addEventListener('click', () => showStages(false));

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

startButton.addEventListener('click', () => {
  window.location.href = '../tzav-rishon/?new=1';
});

continueButton.addEventListener('click', () => {
  if (save) {
    window.location.href = `${STAGE_PAGES[save.stage] ?? STAGE_PAGES['tzav-rishon']}?continue=1`;
  } else {
    showToast('עדיין אין משחק שמור. התחל משחק חדש');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && document.activeElement === document.body) {
    startButton.click();
  }
});

requestAnimationFrame(() => document.body.classList.add('ready'));
