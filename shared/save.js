// One save slot for the whole game, kept in the browser's localStorage.

const SAVE_KEY = 'beer-project-save';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, updatedAt: Date.now() }));
  } catch {
    // Storage can be blocked (private mode); the game still works without saving.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Ignore, same as above.
  }
}

// Final results of finished stages, kept separately from the "continue" slot,
// e.g. { 'tzav-rishon': { profile: 97, dapar: 70, ... } }.
const RESULTS_KEY = 'beer-project-results';

export function loadResults(stage) {
  try {
    const all = JSON.parse(localStorage.getItem(RESULTS_KEY) ?? '{}');
    return stage ? (all[stage] ?? null) : all;
  } catch {
    return stage ? null : {};
  }
}

export function saveResults(stage, results) {
  try {
    const all = JSON.parse(localStorage.getItem(RESULTS_KEY) ?? '{}');
    all[stage] = { ...results, finishedAt: Date.now() };
    localStorage.setItem(RESULTS_KEY, JSON.stringify(all));
  } catch {
    // Same as writeSave: the game works without storage.
  }
}
