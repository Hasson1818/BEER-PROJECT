// What you did in "המסלול לטיס": the result of each part, plus the personal answers that the later parts
// compare with (the psychologist reads what you wrote in the questionnaires).

import { unlock } from '../../shared/achievements.js';

const KEY = 'beer-project-pilot';

export const PARTS = [
  { id: 'home-test', number: 1, name: 'מבחנים בבית', short: 'הבוחן המקוון', page: './home-test/', ready: true },
  { id: 'yarpa-a', number: 2, name: 'ירפ״א א׳', short: 'מבחנים וסימולטור', page: './yarpa-a/', ready: true },
  { id: 'yarpa-b', number: 3, name: 'ירפ״א ב׳', short: 'סימולטור ושאלות אישיות', page: './yarpa-b/', ready: false },
  { id: 'psychologist', number: 4, name: 'הפסיכולוג', short: 'ראיון בזום', page: './psychologist/', ready: false },
  { id: 'gibbush', number: 5, name: 'גיבוש טייס', short: 'חמישה ימים בחצרים', page: '../gibbush-tayis/?new=1', ready: true },
];

function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

function write(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Storage can be blocked; the game still works, it just doesn't remember.
  }
}

/** Result of a part: { done, passed, score, ... } or null. */
export const partResult = (id) => read().parts?.[id] ?? null;

export function saveResult(id, result) {
  const data = read();
  data.parts ??= {};
  data.parts[id] = { ...result, done: true, at: Date.now() };
  write(data);
  // Passed all four parts that come before the gibbush: that is its own achievement.
  const four = ['home-test', 'yarpa-a', 'yarpa-b', 'psychologist'];
  if (four.every((part) => data.parts[part]?.passed)) unlock('pilot-all-four');
}

/** The personal answers (what you wrote about yourself, what you said you want). */
export const getAnswers = () => read().answers ?? {};

export function saveAnswers(patch) {
  const data = read();
  data.answers = { ...(data.answers ?? {}), ...patch };
  write(data);
}

/** Mid-part save, so a refresh doesn't send you back to the beginning of the part. */
export function loadPartSave(id) {
  const save = read().saves?.[id];
  return save ?? null;
}

export function writePartSave(id, step, state) {
  const data = read();
  data.saves ??= {};
  data.saves[id] = { step, state, at: Date.now() };
  write(data);
}

export function clearPartSave(id) {
  const data = read();
  if (data.saves?.[id]) {
    delete data.saves[id];
    write(data);
  }
}
