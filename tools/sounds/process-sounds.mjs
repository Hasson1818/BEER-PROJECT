// Turns the sounds downloaded from Pixabay into small game-ready files:
// trims the silence, makes the long ones loop without a click (a cross-fade of the end into the
// start), evens out the loudness and saves small mono mp3 files in shared/engine/assets/sounds.
//
// Run: node tools/sounds/process-sounds.mjs <folder with the original mp3 files> [path to ffmpeg]
// (ffmpeg is free: `npm i ffmpeg-static` somewhere outside the project works too.)
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = process.argv[2];
const ffmpeg = process.argv[3] ?? 'ffmpeg';
if (!source) {
  console.error('Usage: node process-sounds.mjs <folder with the originals> [ffmpeg path]');
  process.exit(1);
}
const out = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'shared', 'engine', 'assets', 'sounds');
mkdirSync(out, { recursive: true });
const temp = mkdtempSync(join(tmpdir(), 'beer-sounds-'));

const run = (args) => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });

function levelOf(file) {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-nostats', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const text = `${result.stderr}`;
  const mean = Number(/mean_volume: (-?[\d.]+) dB/.exec(text)?.[1]);
  const max = Number(/max_volume: (-?[\d.]+) dB/.exec(text)?.[1]);
  return { mean, max };
}

/**
 * name: output file name. from/to: seconds of the original to keep.
 * loop: cross-fade seconds (makes the result loop seamlessly). mean: target average level in dB (for
 * loops and ambience); peak: target highest level in dB (for one-shot sounds). Whatever is stricter wins.
 */
async function make({ name, input, from = 0, to, loop = 0, mean = null, peak = -3, kbps = 64, fadeIn = 0, fadeOut = 0.05, extra = '' }) {
  const wav = join(temp, `${name}.wav`);
  const seg = to - from;
  let filter = `[0:a]atrim=${from}:${to},asetpts=PTS-STARTPTS,aformat=sample_rates=44100:channel_layouts=mono`;
  if (loop > 0) {
    // Overlap the end of the segment onto its start, then drop the overlapped part from the end.
    filter += `[s];[s]asplit=3[a][b][c];[a]atrim=${loop}:${seg - loop},asetpts=PTS-STARTPTS[mid];` +
      `[b]atrim=${seg - loop}:${seg},asetpts=PTS-STARTPTS,afade=t=out:st=0:d=${loop}:curve=qsin[tail];` +
      `[c]atrim=0:${loop},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=${loop}:curve=qsin[head];` +
      `[tail][head]amix=inputs=2:duration=longest:normalize=0[over];[over][mid]concat=n=2:v=0:a=1`;
  } else {
    if (fadeIn > 0) filter += `,afade=t=in:st=0:d=${fadeIn}`;
    if (fadeOut > 0) filter += `,afade=t=out:st=${seg - fadeOut}:d=${fadeOut}`;
  }
  run(['-i', input, '-filter_complex', filter, wav]);
  const { mean: m, max } = levelOf(wav);
  let gain = peak - max;
  if (mean !== null) gain = Math.min(mean - m, peak - max);
  const final = join(out, `${name}.mp3`);
  run(['-i', wav, '-af', `volume=${gain.toFixed(2)}dB${extra ? `,${extra}` : ''},alimiter=limit=0.9`, '-ac', '1', '-ar', '44100', '-b:a', `${kbps}k`, final]);
  const after = levelOf(final);
  console.log(`${name.padEnd(12)} ${seg.toFixed(1).padStart(5)} s  gain ${gain.toFixed(1).padStart(6)} dB  mean ${after.mean} peak ${after.max}`);
}

const f = (name) => join(source, name);
const jobs = [
  // Loops
  { name: 'wind', input: f('wind-desert.mp3'), from: 0.06, to: 21.3, loop: 2, mean: -26, kbps: 48 },
  { name: 'crickets', input: f('night-crickets.mp3'), from: 4, to: 34, loop: 3, mean: -34, kbps: 48 },
  { name: 'murmur', input: f('hall-murmur.mp3'), from: 1.7, to: 26.4, loop: 2.5, mean: -28, kbps: 48 },
  { name: 'roomtone', input: f('room-tone.mp3'), from: 2, to: 22, loop: 3, mean: -34, kbps: 40 },
  { name: 'crawl', input: f('crawl-sand.mp3'), from: 40, to: 52, loop: 1.5, mean: -24, kbps: 48 },
  // The original is very quiet, so a gate after boosting keeps the hiss between steps out.
  { name: 'steps', input: f('steps-sand.mp3'), from: 0.85, to: 8.0, loop: 0.12, mean: -24, peak: -4, kbps: 48, extra: 'highpass=f=120,agate=threshold=0.06:ratio=8:attack=3:release=150' },
  { name: 'breath', input: f('breath-heavy.mp3'), from: 0.15, to: 20.5, loop: 1.5, mean: -24, kbps: 40 },
  // One-shots
  { name: 'whistle', input: f('whistle.mp3'), from: 0.11, to: 1.62, peak: -3, fadeOut: 0.12 },
  { name: 'dig1', input: f('dig-sand.mp3'), from: 0.8, to: 1.1, peak: -4 },
  { name: 'dig2', input: f('dig-sand.mp3'), from: 2.0, to: 2.45, peak: -4 },
  { name: 'dig3', input: f('dig-sand.mp3'), from: 3.25, to: 3.75, peak: -4 },
  { name: 'dig4', input: f('dig-sand.mp3'), from: 4.5, to: 4.9, peak: -4 },
  { name: 'dig5', input: f('dig-sand.mp3'), from: 5.7, to: 6.15, peak: -4 },
  { name: 'dig6', input: f('dig-sand.mp3'), from: 7.0, to: 7.45, peak: -4 },
  { name: 'sms', input: f('sms.mp3'), from: 0.02, to: 1.05, peak: -6 },
  { name: 'achievement', input: f('achievement.mp3'), from: 0.17, to: 3.5, peak: -6, fadeOut: 0.3 },
  { name: 'jet', input: f('jet-flyover.mp3'), from: 1.2, to: 11.4, mean: -20, peak: -6, fadeIn: 0.6, fadeOut: 1.2, kbps: 56 },
  { name: 'vending', input: f('vending.mp3'), from: 0, to: 6.6, peak: -6, fadeOut: 0.2 },
];

for (const job of jobs) await make(job);
rmSync(temp, { recursive: true, force: true });
console.log(`Saved ${jobs.length} files in ${out}`);
