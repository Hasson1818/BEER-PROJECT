import { Person, randomLook } from '../../shared/engine/people.js';
import { TEAMMATES, STAFF } from './content.js';
import { SPOTS, DUNE } from './world.js';

const between = (a, b) => a + Math.random() * (b - a);

// Candidates wear white shirts (the numbers are written on them); staff wear dark shirts and caps.
export const candidateLook = (extra = {}) =>
  randomLook({ shirt: '#f4f4f0', pants: ['#22262b', '#2c3e66', '#3b3b3b'][Math.floor(Math.random() * 3)], longHair: Math.random() < 0.15, ...extra });
const staffLook = (extra = {}) =>
  randomLook({ shirt: '#2a2d30', pants: '#3a3f45', shoes: '#1b1b1b', beret: '#15171a', longHair: false, ...extra });

export function createPeople(crowd) {
  const staff = {
    clerk: crowd.add(new Person(randomLook({ shirt: '#5b6236', pants: '#5b6236', longHair: true }), STAFF.clerk).place(SPOTS.checkin.x, SPOTS.checkin.z - 2, 0).setPose('clipboard')),
    medic: crowd.add(new Person(randomLook({ shirt: '#5b6236', pants: '#5b6236' }), STAFF.medic).place(SPOTS.medic.x, SPOTS.medic.z - 2, 0)),
    head: crowd.add(new Person(staffLook({ scale: 1.06 }), STAFF.head).place(SPOTS.runStart.x - 1, SPOTS.runStart.z - 4, -Math.PI / 2).setPose('arms-crossed')),
    guy: crowd.add(new Person(staffLook(), STAFF.team).place(SPOTS.briefing.x + 2, SPOTS.briefing.z, Math.PI).setPose('clipboard')),
    others: [],
  };
  // More מגבשים around the site.
  for (const [x, z, facing] of [
    [-14, 2, Math.PI],
    [14, 2, Math.PI],
    [30, -1, 0],
  ]) {
    staff.others.push(crowd.add(new Person(staffLook(), 'מגבש').place(x, z, facing).setPose('clipboard')));
  }

  const teammates = TEAMMATES.map((info) => {
    const person = crowd.add(new Person(candidateLook(), info.name));
    person.info = info;
    person.fitness = info.trait === 'quitter' ? 0.82 : between(0.9, 1.08);
    return person;
  });

  // Candidates from other teams: in the camp, by the water, on the far side of the dune.
  const others = [];
  for (let i = 0; i < 14; i++) {
    const person = crowd.add(new Person(candidateLook(), 'מתגבש מצוות אחר'));
    others.push(person);
  }
  // Start them in the camp, so they never stand on the dune's start line.
  campLife(others);

  return { staff, teammates, others };
}

/** Place teammates in a loose group around (x, z), facing `facing`. */
export function gather(people, x, z, facing, pose = 'stand') {
  people.forEach((person, i) => {
    const row = Math.floor(i / 5);
    const col = i % 5;
    person.group.visible = true;
    person.stop(pose);
    person.carry(null);
    person.place(x + (col - 2) * 1.1 + (row % 2) * 0.5, z + row * 1.3, facing);
  });
}

/** Scatter the other teams' candidates around the camp. */
export function campLife(others) {
  const spots = [
    [SPOTS.water.x - 1.5, SPOTS.water.z + 1.2, 'phone'],
    [SPOTS.water.x + 1.2, SPOTS.water.z + 1.6, 'talk'],
    [-24, 36, 'sit-ground'],
    [-20, 36.2, 'sit-ground'],
    [-12, 37, 'talk'],
    [-11, 38, 'arms-crossed'],
    [4, 38, 'stand'],
    [5, 39, 'talk'],
    [-28, 44, 'sit-ground'],
    [14, 46, 'stand'],
    [18, 47, 'talk'],
    [-6, 44, 'hands-on-knees'],
    [26, 44, 'stand'],
    [10, 34, 'sit-ground'],
  ];
  others.forEach((person, i) => {
    const [x, z, pose] = spots[i % spots.length];
    person.group.visible = true;
    person.carry(null);
    person.stop(pose);
    person.place(x, z, Math.random() * Math.PI * 2);
  });
}

// ---------- Drill behaviour ----------

/** Lane x positions on the dune for teammates; the player's lane is x = 0. */
export function laneX(index) {
  const lanes = [-9.6, -7.6, -5.6, -3.6, -1.8, 1.8, 3.6, 5.6, 7.6, 9.6];
  return lanes[index % lanes.length];
}

export function nearestCone(x) {
  return DUNE.cones.reduce((best, c) => (Math.abs(c.x - x) < Math.abs(best.x - x) ? c : best));
}

/**
 * Runs a person through `steps` again and again while `active()` is true.
 * Step: { to: {x, z}, speed, moving: 'walk' | 'crawl', carry: item | null }.
 * Calls `onLap(person)` after each full pass. Speeds drop a little every lap (fatigue).
 */
export function loop(person, steps, { active, onLap, fatigue = 0.035, stopWhen = null, onStop = null }) {
  let lap = 0;
  const run = (i) => {
    if (!active()) return;
    if (i >= steps.length) {
      lap++;
      onLap?.(person, lap);
      if (stopWhen?.(lap)) {
        onStop?.(person);
        return;
      }
      run(0);
      return;
    }
    const step = steps[i];
    person.carry(step.carry ?? null);
    const tired = Math.max(0.55, 1 - fatigue * lap);
    person.walkTo([step.to], {
      speed: step.speed * person.fitness * tired,
      moving: step.moving ?? 'walk',
      pose: 'stand',
      onArrive: () => run(i + 1),
    });
  };
  run(0);
  return () => lap;
}
