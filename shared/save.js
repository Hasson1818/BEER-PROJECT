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
