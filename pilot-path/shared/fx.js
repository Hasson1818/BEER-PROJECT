// Sounds made on the spot with the Web Audio API, for the pilot-path stages: keyboard clicks, exam beeps,
// water, radio, engine, guns, the video-call chimes. They go through the same output as the recorded
// sounds, so the mute button silences them too. Nothing here needs a file.

import { audioContext, audioOut, isMuted } from '../../shared/engine/audio.js';

const ready = () => {
  const audio = audioContext();
  const out = audioOut();
  return audio && out && !isMuted() ? { audio, out } : null;
};

let noiseBuffer = null;
function noiseSource(audio) {
  if (!noiseBuffer) {
    noiseBuffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const source = audio.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;
  return source;
}

/** One oscillator note. `slide` glides to another frequency over the note. */
export function tone(freq, duration, { at = 0, type = 'sine', volume = 0.15, slide = null, attack = 0.01, pan = 0 } = {}) {
  const r = ready();
  if (!r) return;
  const { audio, out } = r;
  const t = audio.currentTime + at;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + duration);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  let node = gain;
  if (pan && audio.createStereoPanner) {
    const panner = audio.createStereoPanner();
    panner.pan.value = pan;
    gain.connect(panner);
    node = panner;
  }
  osc.connect(gain);
  node.connect(out);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

/** A burst of filtered noise (clicks, splashes, crashes, wind). */
export function noise(duration, { at = 0, volume = 0.2, filter = 'bandpass', freq = 1800, q = 1, sweep = null, attack = 0.005 } = {}) {
  const r = ready();
  if (!r) return;
  const { audio, out } = r;
  const t = audio.currentTime + at;
  const source = noiseSource(audio);
  const biquad = audio.createBiquadFilter();
  biquad.type = filter;
  biquad.frequency.setValueAtTime(freq, t);
  if (sweep) biquad.frequency.exponentialRampToValueAtTime(sweep, t + duration);
  biquad.Q.value = q;
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  source.connect(biquad).connect(gain).connect(out);
  source.start(t);
  source.stop(t + duration + 0.05);
}

// ---------- Computer and exam sounds ----------

export const fx = {
  /** A key on a laptop keyboard. */
  key() {
    noise(0.035, { freq: 3200 + Math.random() * 900, q: 2, volume: 0.07 });
    tone(220 + Math.random() * 40, 0.03, { type: 'triangle', volume: 0.04 });
  },
  /** Mouse button. */
  click() {
    noise(0.03, { freq: 2400, q: 3, volume: 0.09 });
    tone(540, 0.04, { type: 'triangle', volume: 0.05, at: 0.012 });
  },
  tick() {
    tone(1200, 0.04, { type: 'square', volume: 0.03 });
  },
  ok() {
    tone(660, 0.12, { type: 'sine', volume: 0.11 });
    tone(990, 0.18, { type: 'sine', volume: 0.1, at: 0.09 });
  },
  bad() {
    tone(200, 0.22, { type: 'sawtooth', volume: 0.09, slide: 140 });
  },
  /** The notification on a phone / a message arriving on the computer. */
  notify() {
    tone(1040, 0.16, { type: 'sine', volume: 0.12 });
    tone(1560, 0.34, { type: 'sine', volume: 0.1, at: 0.12 });
  },
  /** A laptop waking up. */
  boot() {
    noise(0.9, { freq: 300, sweep: 4000, q: 0.7, volume: 0.05, filter: 'lowpass' });
    [392, 523, 659, 784].forEach((f, i) => tone(f, 0.55, { type: 'sine', volume: 0.07, at: 0.2 + i * 0.12 }));
  },
  /** Task finished. */
  done() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, { type: 'triangle', volume: 0.1, at: i * 0.1 }));
  },
  fail() {
    [392, 330, 262].forEach((f, i) => tone(f, 0.4, { type: 'triangle', volume: 0.1, at: i * 0.16 }));
  },

  // Water, for the bucket task.
  drip() {
    tone(1500 + Math.random() * 300, 0.09, { type: 'sine', volume: 0.07, slide: 700 });
  },
  pour(duration = 0.25) {
    noise(duration, { freq: 1800, q: 0.8, volume: 0.07, attack: 0.03 });
  },
  splash() {
    noise(0.5, { freq: 1400, sweep: 500, q: 0.6, volume: 0.22 });
    noise(0.25, { freq: 4200, q: 1, volume: 0.08 });
  },
  /** The bucket falls and hits the floor. */
  crash() {
    noise(0.7, { freq: 900, sweep: 150, q: 0.7, volume: 0.32, filter: 'lowpass' });
    tone(110, 0.5, { type: 'square', volume: 0.12, slide: 55 });
    noise(0.5, { freq: 2500, q: 0.9, volume: 0.1, at: 0.05 });
  },
  coin() {
    tone(1318, 0.07, { type: 'square', volume: 0.05 });
    tone(1760, 0.18, { type: 'square', volume: 0.05, at: 0.07 });
  },

  // ---------- Video call ----------

  zoomJoin() {
    tone(587, 0.18, { volume: 0.12 });
    tone(784, 0.18, { volume: 0.12, at: 0.14 });
    tone(988, 0.34, { volume: 0.12, at: 0.28 });
  },
  zoomLeave() {
    tone(988, 0.16, { volume: 0.1 });
    tone(740, 0.16, { volume: 0.1, at: 0.13 });
    tone(587, 0.34, { volume: 0.1, at: 0.26 });
  },
  ring() {
    for (let i = 0; i < 2; i++) {
      tone(880, 0.35, { type: 'sine', volume: 0.1, at: i * 0.55 });
      tone(1109, 0.35, { type: 'sine', volume: 0.07, at: i * 0.55 });
    }
  },

  // ---------- Cockpit ----------

  /** A short radio call: squelch, a mumble of voice-like noise, squelch. */
  radio(duration = 1.4) {
    noise(0.07, { freq: 2200, q: 1.2, volume: 0.12 });
    noise(duration, { freq: 1500, q: 2.2, volume: 0.035, attack: 0.05 });
    for (let i = 0; i < duration * 7; i++) tone(180 + Math.random() * 160, 0.09, { type: 'sawtooth', volume: 0.018, at: 0.08 + i * 0.14 });
    noise(0.1, { freq: 2600, q: 1, volume: 0.1, at: duration + 0.08 });
  },
  /** The cockpit warning beep the candidate answers with a key. */
  beep() {
    tone(1250, 0.12, { type: 'square', volume: 0.07 });
    tone(1250, 0.12, { type: 'square', volume: 0.07, at: 0.2 });
  },
  warning() {
    tone(880, 0.16, { type: 'square', volume: 0.08 });
    tone(660, 0.16, { type: 'square', volume: 0.08, at: 0.18 });
  },
  /** Missile warning: fast, rising. */
  missile() {
    for (let i = 0; i < 4; i++) tone(1700 + i * 110, 0.07, { type: 'square', volume: 0.07, at: i * 0.1 });
  },
  alarm() {
    for (let i = 0; i < 3; i++) tone(960, 0.18, { type: 'square', volume: 0.07, slide: 700, at: i * 0.26 });
  },
  /** The gun, a short burst. */
  gun() {
    for (let i = 0; i < 5; i++) {
      noise(0.07, { freq: 900, q: 0.5, volume: 0.14, filter: 'lowpass', at: i * 0.055 });
      tone(130, 0.06, { type: 'square', volume: 0.06, at: i * 0.055, slide: 70 });
    }
  },
  hit() {
    noise(0.3, { freq: 3000, sweep: 800, q: 0.8, volume: 0.14 });
    tone(520, 0.2, { type: 'triangle', volume: 0.1, slide: 260 });
  },
  explosion() {
    noise(1.3, { freq: 700, sweep: 80, q: 0.5, volume: 0.4, filter: 'lowpass' });
    tone(70, 0.9, { type: 'sawtooth', volume: 0.18, slide: 28 });
  },
  /** Tone that rises as the target gets close to the gunsight. */
  lock(strength) {
    tone(600 + strength * 900, 0.06, { type: 'sine', volume: 0.05 });
  },
  gearThump() {
    noise(0.2, { freq: 200, q: 0.8, volume: 0.2, filter: 'lowpass' });
  },
};

/**
 * Jet engine bed: turbine whine, rumble and rushing air. `set(throttle 0..1, speed 0..1)` follows the
 * controls. Returns { set, stop }.
 */
export function engine() {
  const r = ready();
  if (!r) return { set() {}, stop() {} };
  const { audio, out } = r;
  const master = audio.createGain();
  master.gain.value = 0;
  master.connect(out);

  const whine = audio.createOscillator();
  whine.type = 'sawtooth';
  const whineFilter = audio.createBiquadFilter();
  whineFilter.type = 'bandpass';
  whineFilter.Q.value = 6;
  const whineGain = audio.createGain();
  whineGain.gain.value = 0.04;
  whine.connect(whineFilter).connect(whineGain).connect(master);

  const rumble = audio.createOscillator();
  rumble.type = 'sawtooth';
  const rumbleFilter = audio.createBiquadFilter();
  rumbleFilter.type = 'lowpass';
  rumbleFilter.frequency.value = 160;
  const rumbleGain = audio.createGain();
  rumbleGain.gain.value = 0.16;
  rumble.connect(rumbleFilter).connect(rumbleGain).connect(master);

  const air = noiseSource(audio);
  const airFilter = audio.createBiquadFilter();
  airFilter.type = 'bandpass';
  airFilter.Q.value = 0.5;
  const airGain = audio.createGain();
  airGain.gain.value = 0.05;
  air.connect(airFilter).connect(airGain).connect(master);

  whine.start();
  rumble.start();
  air.start();
  master.gain.setTargetAtTime(0.9, audio.currentTime, 0.6);

  return {
    set(throttle, speed = throttle) {
      const t = audio.currentTime;
      whine.frequency.setTargetAtTime(520 + throttle * 1500, t, 0.12);
      whineFilter.frequency.setTargetAtTime(700 + throttle * 1600, t, 0.12);
      whineGain.gain.setTargetAtTime(0.03 + throttle * 0.05, t, 0.15);
      rumble.frequency.setTargetAtTime(38 + throttle * 34, t, 0.15);
      rumbleGain.gain.setTargetAtTime(0.1 + throttle * 0.16, t, 0.15);
      airFilter.frequency.setTargetAtTime(500 + speed * 2800, t, 0.2);
      airGain.gain.setTargetAtTime(0.02 + speed * 0.12, t, 0.2);
    },
    stop() {
      const t = audio.currentTime;
      master.gain.setTargetAtTime(0, t, 0.25);
      setTimeout(() => {
        try {
          whine.stop();
          rumble.stop();
          air.stop();
        } catch {
          // Already stopped.
        }
      }, 1200);
    },
  };
}

/** A faint air-conditioning / fan hum for rooms with computers. Returns { stop }. */
export function roomHum(volume = 0.04) {
  const r = ready();
  if (!r) return { stop() {} };
  const { audio, out } = r;
  const gain = audio.createGain();
  gain.gain.value = 0;
  gain.connect(out);
  const hum = audio.createOscillator();
  hum.type = 'sine';
  hum.frequency.value = 100;
  const hum2 = audio.createOscillator();
  hum2.type = 'sine';
  hum2.frequency.value = 50.3;
  const air = noiseSource(audio);
  const airFilter = audio.createBiquadFilter();
  airFilter.type = 'lowpass';
  airFilter.frequency.value = 600;
  const airGain = audio.createGain();
  airGain.gain.value = 0.35;
  hum.connect(gain);
  hum2.connect(gain);
  air.connect(airFilter).connect(airGain).connect(gain);
  hum.start();
  hum2.start();
  air.start();
  gain.gain.setTargetAtTime(volume, audio.currentTime, 0.6);
  return {
    stop() {
      gain.gain.setTargetAtTime(0, audio.currentTime, 0.3);
      setTimeout(() => {
        try {
          hum.stop();
          hum2.stop();
          air.stop();
        } catch {
          // Already stopped.
        }
      }, 1500);
    },
  };
}

/** Reads a line aloud with the browser's voice (Hebrew if the device has one). Silent if it can't. */
export function speak(text, { rate = 1, pitch = 1 } = {}) {
  if (isMuted() || !('speechSynthesis' in window)) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'he-IL';
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = 0.8;
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang?.startsWith('he'));
    if (voice) utterance.voice = voice;
    else return; // A voice in the wrong language would only confuse.
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    // No speech on this device; the text is shown anyway.
  }
}
