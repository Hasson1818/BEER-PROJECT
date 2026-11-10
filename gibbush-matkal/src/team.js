import { Person, randomLook } from '../../shared/engine/people.js';
import { candidateLook, campLife } from '../../yom-sayarot/src/team.js';
import { SQUAD, NEWCOMERS, CUT_TRAITS, STAFF } from './content.js';
import { SPOTS } from '../../yom-sayarot/src/world.js';

const between = (a, b) => a + Math.random() * (b - a);

// Staff: reservists from the units, in dark shirts and caps (the accounts describe no ranks).
const staffLook = (extra = {}) => randomLook({ shirt: '#2a2d30', pants: '#3a3f45', shoes: '#1b1b1b', beret: '#15171a', longHair: false, ...extra });

function candidate(crowd, info) {
  const person = crowd.add(new Person(candidateLook({ shirt: '#5b6236', pants: '#5b6236' }), info.name));
  person.info = { ...info };
  person.fitness = info.trait === 'quitter' ? 0.82 : info.trait === 'hider' ? 0.93 : between(0.92, 1.08);
  return person;
}

export function createPeople(crowd) {
  const staff = {
    medic: crowd.add(new Person(randomLook({ shirt: '#5b6236', pants: '#5b6236' }), STAFF.medic).place(SPOTS.medic.x, SPOTS.medic.z - 2, 0)),
    head: crowd.add(new Person(staffLook({ scale: 1.06 }), STAFF.head).place(SPOTS.checkin.x, SPOTS.checkin.z - 2, 0).setPose('arms-crossed')),
    guy: crowd.add(new Person(staffLook(), STAFF.guy).place(SPOTS.briefing.x + 2, SPOTS.briefing.z, Math.PI).setPose('clipboard')),
    knot: crowd.add(new Person(staffLook({ shirt: '#1f3b4d' }), STAFF.knot).place(SPOTS.map.x + 4, SPOTS.map.z + 3, -Math.PI / 2)),
    rasar: crowd.add(new Person(staffLook({ shirt: '#4a4f36' }), STAFF.rasar).place(SPOTS.camp.x + 4, SPOTS.camp.z - 3, 0).setPose('arms-crossed')),
    guy2: crowd.add(new Person(staffLook({ longHair: true }), STAFF.guy2).place(SPOTS.briefing.x - 3, SPOTS.briefing.z, Math.PI).setPose('clipboard')),
    others: [],
  };
  staff.guy2.group.visible = false;
  for (const [x, z, facing] of [
    [-14, 2, Math.PI],
    [14, 2, Math.PI],
    [30, -1, 0],
  ]) {
    staff.others.push(crowd.add(new Person(staffLook(), 'מגבש').place(x, z, facing).setPose('clipboard')));
  }

  const squad = SQUAD.map((info) => candidate(crowd, info));
  const newcomers = NEWCOMERS.map((info) => candidate(crowd, info));
  newcomers.forEach((p) => {
    p.group.visible = false;
  });

  // Other squads: around the camp.
  const others = [];
  for (let i = 0; i < 14; i++) others.push(crowd.add(new Person(candidateLook({ shirt: '#5b6236', pants: '#5b6236' }), 'מתגבש מחוליה אחרת')));
  campLife(others);

  // `teammates` is what the drills use; after the cut it becomes the new squad.
  return { staff, squad, newcomers, teammates: squad, others };
}

/** The cut: the weak half of the squad leaves, newcomers from other squads join. Returns who left. */
export function reshuffle(people) {
  const leaving = people.squad.filter((p) => CUT_TRAITS.includes(p.info.trait));
  const quiet = people.squad.filter((p) => p.info.trait === 'steady' && !leaving.includes(p)).slice(-2);
  leaving.push(...quiet);
  for (const p of leaving) {
    p.info.out = true;
    p.carry(null);
    p.group.visible = false;
  }
  const stay = people.squad.filter((p) => !leaving.includes(p));
  for (const p of people.newcomers) {
    p.group.visible = true;
    p.info.out = false;
  }
  people.teammates = [...stay, ...people.newcomers];
  return leaving;
}
