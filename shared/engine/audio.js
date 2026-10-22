// Small synthesized sounds (clicks, beeps), plus the shared audio context and the mute switch used by
// the recorded sounds in sound.js.

let ctx = null;
let master = null;
let muted = false;
try {
  muted = localStorage.getItem('beer-project-muted') === '1';
} catch {
  // Storage can be blocked; sound stays on.
}

function context() {
  if (!ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    ctx = new AudioContext();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Everything the game plays goes through this node, so one switch can silence it all. */
export function audioOut() {
  const audio = context();
  if (!audio) return null;
  if (!master) {
    master = audio.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(audio.destination);
  }
  return master;
}

export const audioContext = () => context();
export const isMuted = () => muted;

export function setMuted(value) {
  muted = value;
  try {
    localStorage.setItem('beer-project-muted', value ? '1' : '0');
  } catch {
    // Same as above.
  }
  if (master) master.gain.setTargetAtTime(value ? 0 : 1, master.context.currentTime, 0.05);
}

// Browsers only allow sound after the first user gesture.
// (iPhones need touchend or click specifically.)
for (const type of ['pointerdown', 'keydown', 'touchend', 'click']) {
  window.addEventListener(type, () => context(), { once: true });
}

function tone(freq, start, duration, { type = 'sine', volume = 0.18 } = {}) {
  const audio = context();
  if (!audio) return;
  const t = audio.currentTime + start;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(audioOut());
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

/** "Ding-dong" before a number is called. */
export function chime() {
  tone(880, 0, 0.9);
  tone(660, 0.35, 1.1);
}

export function beep() {
  tone(1500, 0, 0.12, { type: 'square', volume: 0.06 });
}

export function click() {
  tone(600, 0, 0.05, { type: 'triangle', volume: 0.08 });
}
