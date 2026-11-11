import { Person, randomLook } from '../../shared/engine/people.js';
import { candidateLook, campLife } from '../../yom-sayarot/src/team.js';
import { SQUAD, CUT_TRAITS, STAFF } from './content.js';
import { SPOTS, SUB } from './world.js';

const between = (a, b) => a + Math.random() * (b - a);

// Staff: navy work uniform (dark blue), the cadets in khaki-blue; the game's choice of colors.
const navyLook = (extra = {}) => randomLook({ shirt: '#22324d', pants: '#22324d', shoes: '#1b1b1b', beret: '#1a2338', longHair: false, ...extra });

function candidate(crowd, info) {
  const person = crowd.add(new Person(candidateLook({ shirt: '#5b6236', pants: '#5b6236', longHair: Boolean(info.girl) }), info.name));
  person.info = { ...info };
  person.fitness = info.trait === 'quitter' ? 0.84 : info.trait === 'hider' ? 0.93 : between(0.92, 1.08);
  return person;
}

export function createPeople(crowd) {
  const staff = {
    head: crowd.add(new Person(navyLook({ scale: 1.06 }), STAFF.head).place(SPOTS.checkin.x, SPOTS.checkin.z - 2, 0).setPose('arms-crossed')),
    guy: crowd.add(new Person(navyLook(), STAFF.guy).place(SPOTS.briefing.x + 2, SPOTS.briefing.z, Math.PI).setPose('clipboard')),
    sub: crowd.add(new Person(navyLook({ shirt: '#151c2b', pants: '#151c2b' }), STAFF.sub).place(SPOTS.briefing.x - 3, SPOTS.briefing.z, Math.PI).setPose('clipboard')),
    cadet: crowd.add(new Person(navyLook({ shirt: '#3b4a63' }), STAFF.cadet).place(SPOTS.briefing.x + 5, SPOTS.briefing.z - 1, Math.PI).setPose('clipboard')),
    medic: crowd.add(new Person(randomLook({ shirt: '#5b6236', pants: '#5b6236', longHair: true }), STAFF.medic).place(SPOTS.medic.x, SPOTS.medic.z - 2, 0)),
    psych: crowd.add(new Person(randomLook({ shirt: '#e8e2d6', pants: '#3b3b3b', longHair: true }), STAFF.psych).place(SPOTS.hall.x + 2, SPOTS.hall.z - 1, 0).setPose('clipboard')),
    committee: crowd.add(new Person(navyLook({ shirt: '#e9edf2', pants: '#22324d', scale: 1.04 }), STAFF.committee).place(SPOTS.committee.x, SPOTS.committee.z, 0).setPose('arms-crossed')),
    // The guide inside the submarine.
    subGuide: crowd.add(new Person(navyLook({ shirt: '#151c2b', pants: '#151c2b' }), 'צוללן, המדריך בסיור').place(SUB.x, 9, Math.PI)),
    others: [],
  };
  for (const [x, z, facing] of [
    [-14, 2, Math.PI],
    [14, 2, Math.PI],
    [30, -1, 0],
  ]) {
    staff.others.push(crowd.add(new Person(navyLook(), 'מגבש').place(x, z, facing).setPose('clipboard')));
  }
  const squad = SQUAD.map((info) => candidate(crowd, info));
  const others = [];
  for (let i = 0; i < 14; i++) others.push(crowd.add(new Person(candidateLook({ shirt: '#5b6236', pants: '#5b6236', longHair: i % 4 === 0 }), 'מתגבש ממחלקה אחרת')));
  campLife(others);
  return { staff, squad, teammates: squad, others };
}

/** The mid-gibbush cut: who leaves the squad. Returns them. */
export function midCut(people) {
  const leaving = people.squad.filter((p) => CUT_TRAITS.includes(p.info.trait));
  for (const p of leaving) {
    p.info.out = true;
    p.carry(null);
    p.group.visible = false;
  }
  people.teammates = people.squad.filter((p) => !leaving.includes(p));
  return leaving;
}
