import { audioContext, audioOut, isMuted, setMuted } from './audio.js';

// Recorded sounds (ambience, steps, whistles...). The files are in assets/sounds, made by
// tools/sounds/process-sounds.mjs from free sounds on Pixabay (see assets/sounds/CREDITS.md).
// Loops are cross-faded so they repeat without a click.

const files = import.meta.glob('./assets/sounds/*.mp3', { eager: true, query: '?url', import: 'default' });
const urls = Object.fromEntries(Object.entries(files).map(([path, url]) => [path.split('/').pop().replace('.mp3', ''), url]));

const buffers = new Map();
const loading = new Map();

/** Fetches and decodes a sound (once). Resolves to null if audio isn't available. */
export function load(name) {
  if (buffers.has(name)) return Promise.resolve(buffers.get(name));
  if (loading.has(name)) return loading.get(name);
  const audio = audioContext();
  if (!audio || !urls[name]) return Promise.resolve(null);
  const promise = fetch(urls[name])
    .then((r) => r.arrayBuffer())
    .then((data) => audio.decodeAudioData(data))
    .then((buffer) => {
      buffers.set(name, buffer);
      return buffer;
    })
    .catch(() => null);
  loading.set(name, promise);
  return promise;
}

export function preload(names) {
  for (const name of names) load(name);
}

/** Plays a sound once. Resolves when it was started (or skipped). */
export async function play(name, { volume = 1, rate = 1 } = {}) {
  if (isMuted()) return;
  const buffer = await load(name);
  const audio = audioContext();
  const out = audioOut();
  if (!buffer || !audio || !out) return;
  const source = audio.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = rate;
  const gain = audio.createGain();
  gain.gain.value = volume;
  source.connect(gain).connect(out);
  source.start();
}

/** Plays one of `name1`..`nameN`, picked at random (e.g. the shovel hits). */
export function playRandom(prefix, count, options) {
  return play(`${prefix}${1 + Math.floor(Math.random() * count)}`, options);
}

/**
 * A looping sound with its own volume and speed. It starts silent: use setVolume() to bring it in.
 * Returns { setVolume(v, seconds), setRate(r), stop() }.
 */
export function loop(name, { volume = 0, rate = 1 } = {}) {
  let source = null;
  let gain = null;
  let wanted = volume;
  let wantedRate = rate;
  let stopped = false;
  load(name).then((buffer) => {
    const audio = audioContext();
    const out = audioOut();
    if (!buffer || !audio || !out || stopped) return;
    gain = audio.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(wanted, audio.currentTime, 0.25);
    source = audio.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = wantedRate;
    source.connect(gain).connect(out);
    source.start(0, Math.random() * buffer.duration * 0.9); // Not always from the same spot.
  });
  return {
    setVolume(next, seconds = 0.6) {
      if (Math.abs(next - wanted) < 0.005) return;
      wanted = next;
      if (gain) gain.gain.setTargetAtTime(next, gain.context.currentTime, seconds / 3);
    },
    setRate(next) {
      if (Math.abs(next - wantedRate) < 0.01) return;
      wantedRate = next;
      if (source) source.playbackRate.setTargetAtTime(next, source.context.currentTime, 0.1);
    },
    stop() {
      stopped = true;
      source?.stop();
    },
  };
}

// ---------- The mute button (key M) ----------

export function mountMuteButton() {
  if (document.getElementById('mute-button')) return;
  const style = document.createElement('style');
  style.textContent = `
    #mute-button { position: fixed; left: 14px; bottom: 14px; z-index: 40; width: 40px; height: 40px; border-radius: 50%;
      background: rgba(24, 28, 18, 0.78); color: #f1e8cf; font-size: 1.15rem; line-height: 1; cursor: pointer;
      box-shadow: inset 0 0 0 1px rgba(241, 232, 207, 0.25); }
    #mute-button:hover { background: rgba(60, 68, 35, 0.9); }
    @media (pointer: coarse) { #mute-button { bottom: auto; top: 112px; width: 36px; height: 36px; } }
  `;
  document.head.append(style);
  const button = document.createElement('button');
  button.id = 'mute-button';
  button.type = 'button';
  const update = () => {
    button.textContent = isMuted() ? '🔇' : '🔊';
    button.setAttribute('aria-label', isMuted() ? 'להפעיל סאונד' : 'להשתיק סאונד');
    button.title = 'סאונד (M)';
  };
  const toggle = () => {
    setMuted(!isMuted());
    update();
  };
  button.addEventListener('click', toggle);
  document.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM' && !event.repeat && !event.ctrlKey && !event.metaKey) toggle();
  });
  update();
  document.body.append(button);
}
