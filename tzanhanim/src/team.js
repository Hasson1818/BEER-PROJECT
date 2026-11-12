import { Person, randomLook } from '../../shared/engine/people.js';
import { candidateLook, campLife } from '../../yom-sayarot/src/team.js';
import { SQUAD, STAFF } from './content.js';
import { SPOTS } from '../../yom-sayarot/src/world.js';

const between = (a, b) => a + Math.random() * (b - a);

// Staff: paratroopers in uniform with the red beret; the interviewers are reservists (the accounts).
const paraLook = (extra = {}) => randomLook({ shirt: '#5b6236', pants: '#5b6236', shoes: '#6b3a22', beret: '#9e1b20', longHair: false, ...extra });

function candidate(crowd, info) {
  // Candidates come in civilian sports clothes, with a number (the game's choice of colors).
  const person = crowd.add(new Person(candidateLook({ longHair: false }), info.name));
  person.info = { ...info };
  person.fitness = info.trait === 'quitter' ? 0.84 : info.trait === 'hider' ? 0.92 : between(0.94, 1.08);
  return person;
}

export const INTERVIEW_SPOT = { x: -20, z: 34 };

export function createPeople(crowd) {
  const staff = {
    soldier: crowd.add(new Person(paraLook({ longHair: true, beret: false }), STAFF.soldier).place(SPOTS.checkin.x, SPOTS.checkin.z - 2, 0).setPose('clipboard')),
    medic: crowd.add(new Person(paraLook({ beret: false }), STAFF.medic).place(SPOTS.medic.x, SPOTS.medic.z - 2, 0)),
    guy: crowd.add(new Person(paraLook(), STAFF.guy).place(SPOTS.briefing.x + 2, SPOTS.briefing.z, Math.PI).setPose('clipboard')),
    int1: crowd.add(new Person(paraLook({ scale: 1.05 }), STAFF.int1).place(INTERVIEW_SPOT.x - 0.7, INTERVIEW_SPOT.z - 1.2, 0).setPose('sit')),
    int2: crowd.add(new Person(paraLook({ longHair: true }), STAFF.int2).place(INTERVIEW_SPOT.x + 0.7, INTERVIEW_SPOT.z - 1.2, 0).setPose('sit')),
    others: [],
  };
  for (const [x, z, facing] of [
    [-14, 2, Math.PI],
    [14, 2, Math.PI],
  ]) staff.others.push(crowd.add(new Person(paraLook(), 'מגבש').place(x, z, facing).setPose('clipboard')));
  const squad = SQUAD.map((info) => candidate(crowd, info));
  const others = [];
  for (let i = 0; i < 16; i++) {
    const p = crowd.add(new Person(candidateLook({ longHair: false }), 'מתגבש מצוות אחר'));
    p.fitness = between(0.88, 1.06);
    others.push(p);
  }
  campLife(others);
  return { staff, squad, teammates: squad, others };
}
