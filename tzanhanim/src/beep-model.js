// The beep test as a model, without the 3D part, so it can be tuned (and tested) on its own.
// The real test: 20 m between two lines, the beeps get shorter every level (the standard 20 m shuttle-run table:
// level L runs at 8 + 0.5·L km/h). In the game the distance is 12 m and the time runs 3 times faster, so a level
// keeps the same feel but the whole test is a third of the length. What counts is the real time it represents.

export const GAME_DISTANCE = 12;
export const TIME_SCALE = 3;
export const SHUTTLES = [7, 8, 8, 9, 9, 10, 10, 11, 11, 11, 12, 12, 13, 13, 13]; // per level, levels 1..15

/** Real seconds for one 20 m shuttle at level `L`. */
export const shuttleReal = (L) => 72 / (8 + 0.5 * L);

/** The beep schedule: [{ level, shuttle, end (real seconds at the beep) }]. */
export function schedule(maxReal = 8 * 60) {
  const out = [];
  let t = 0;
  for (let L = 1; L <= SHUTTLES.length; L++) {
    for (let s = 1; s <= SHUTTLES[L - 1]; s++) {
      t += shuttleReal(L);
      out.push({ level: L, shuttle: s, end: t });
      if (t >= maxReal) return out;
    }
  }
  return out;
}

export const fmt = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/**
 * The runner. `tap()` is a stride (Space / the button); speed fades without strides. Running fast costs stamina,
 * waiting at the line before the beep gives a little back, and the top speed drops as stamina runs out.
 * Tuned with a simulation: about 4 strides a second passes 6:30, a fast steady rhythm gets to about 7:30.
 */
export function createRunner() {
  const r = {
    pos: 0, // 0..GAME_DISTANCE along the current shuttle
    v: 0,
    stamina: 1,
    tap() {
      r.v = Math.min(r.top(), r.v + 0.85);
    },
    top() {
      return 5.0 + 2.3 * r.stamina;
    },
    /** Advance `dt` game seconds; `waiting` = at the line, before the beep. Returns true when the line is reached. */
    step(dt, waiting) {
      if (waiting) {
        r.v = Math.max(0, r.v - dt * 6);
        r.stamina = Math.min(1, r.stamina + dt * 0.035);
        return true;
      }
      r.v = Math.max(0, r.v - dt * (1.5 + 0.25 * r.v));
      r.v = Math.min(r.v, r.top());
      r.stamina = Math.max(0, r.stamina - dt * 0.0028 * (r.v / 4) ** 3);
      r.pos = Math.min(GAME_DISTANCE, r.pos + r.v * dt);
      return r.pos >= GAME_DISTANCE;
    },
  };
  return r;
}
