import { Person, randomLook } from '../../shared/engine/people.js';
import { GROUP, STAFF } from './content.js';
import { SPOTS, POOL } from './world.js';

const between = (a, b) => a + Math.random() * (b - a);
const SKIN = ['#f1c9a5', '#e0ac85', '#c68863', '#a86f4c', '#f5d6bc'];
const SHORTS = ['#1f2a44', '#2c3e66', '#111111', '#1d3f8a', '#3b3b3b', '#8a1f1f'];

/** Swim shorts, bare chest and feet. */
export function swimLook(extra = {}) {
  const skin = SKIN[Math.floor(Math.random() * SKIN.length)];
  return randomLook({ skin, shirt: skin, shins: skin, shoes: skin, pants: SHORTS[Math.floor(Math.random() * SHORTS.length)], longHair: false, beret: false, ...extra });
}

// Staff: dark shirts and shorts (reservists from the unit, no ranks; the game's choice).
const staffLook = (extra = {}) => randomLook({ shirt: '#1f2a33', pants: '#2b3640', shoes: '#1b1b1b', longHair: false, ...extra });

function candidate(crowd, info) {
  const person = crowd.add(new Person(swimLook(), info.name));
  person.info = { ...info };
  // How fast they swim (m/s) and how well they hold out in the water.
  person.pace = info.trait === 'panic' ? 1.05 : info.trait === 'hider' ? 1.1 : between(1.15, 1.45);
  person.calm = info.trait === 'panic' ? 0.2 : info.trait === 'helper' || info.trait === 'leader' ? 0.9 : between(0.6, 0.85);
  return person;
}

export function createPeople(crowd) {
  const H = SPOTS.home;
  const staff = {
    head: crowd.add(new Person(staffLook({ scale: 1.05 }), STAFF.head).place(SPOTS.briefing.x + 1.5, SPOTS.briefing.z - 1.2, Math.PI).setPose('clipboard')),
    second: crowd.add(new Person(staffLook({ shirt: '#2a3a2a' }), STAFF.second).place(SPOTS.edgeWest.x, SPOTS.edgeWest.z + 6, Math.PI / 2).setPose('arms-crossed')),
    lifeguard: crowd.add(new Person(randomLook({ shirt: '#c0392b', pants: '#c0392b', shoes: '#f2f2f2' }), STAFF.lifeguard).place(SPOTS.lifeguard.x, SPOTS.lifeguard.z, Math.PI / 2).setPose('sit')),
    medic: crowd.add(new Person(randomLook({ shirt: '#5b6236', pants: '#5b6236', longHair: true }), STAFF.medic).place(SPOTS.medic.x, SPOTS.medic.z - 1.4, 0)),
    psych: crowd.add(new Person(randomLook({ shirt: '#e8e2d6', pants: '#3b3b3b', longHair: true }), STAFF.psych).place(SPOTS.psych.x, SPOTS.psych.z, -Math.PI / 2).setPose('clipboard')),
    clerk: crowd.add(new Person(randomLook({ shirt: '#5b6236', pants: '#5b6236', longHair: true }), STAFF.clerk).place(SPOTS.checkin.x, SPOTS.checkin.z - 1.4, 0).setPose('clipboard')),
  };
  // The lifeguard sits up on the chair.
  staff.lifeguard.group.position.y = 1.4;

  const group = GROUP.map((info) => candidate(crowd, info));
  // They wait at the gate in a loose bunch until the briefing.
  group.forEach((p, i) => p.place(SPOTS.gate.x - 3 + (i % 5) * 1.1, SPOTS.gate.z + 1.5 + Math.floor(i / 5) * 1.2, Math.PI));

  // Another group swims in the far lanes and sits on the benches between tasks.
  const others = [];
  for (let i = 0; i < 10; i++) {
    const p = crowd.add(new Person(swimLook(), 'מועמד מקבוצה אחרת'));
    p.pace = between(1.1, 1.4);
    others.push(p);
  }
  placeOthers(others, 'benches');
  return { staff, group, others, home: H };
}

/** Puts the other group somewhere sensible for a part of the day. */
export function placeOthers(others, where) {
  others.forEach((p, i) => {
    if (where === 'benches') {
      p.place(SPOTS.bench.x + 1.2, -12 + i * 2.6, -Math.PI / 2).setPose('sit');
      p.group.position.y = 0.02;
    } else if (where === 'gate') {
      p.place(SPOTS.gate.x + 2 + (i % 4), SPOTS.gate.z + 2 + Math.floor(i / 4), Math.PI).setPose('stand');
    } else if (where === 'water') {
      // Treading in the far end of the pool.
      const a = (i / others.length) * Math.PI * 2;
      p.place(3 + Math.cos(a) * 2, -8 + Math.sin(a) * 2, a + Math.PI).setPose('tread');
    }
  });
}

/** A person lined up at the edge of a lane, then swimming it. */
export function laneStart(p, lane, end = 1) {
  const x = POOL.lanes[lane];
  p.place(x, end * (POOL.halfZ - 0.6), end > 0 ? Math.PI : 0).setPose('tread');
}
