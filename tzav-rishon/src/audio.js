// Small synthesized sounds, so the game needs no audio files.

let ctx = null;

function context() {
  if (!ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    ctx = new AudioContext();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Browsers only allow sound after the first user gesture.
for (const type of ['pointerdown', 'keydown']) {
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
  osc.connect(gain).connect(audio.destination);
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
