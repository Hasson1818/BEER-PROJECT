import { Person, randomLook } from '../../shared/engine/people.js';
import { candidateLook, campLife } from '../../yom-sayarot/src/team.js';
import { SQUAD, CUT_TRAITS, STAFF } from './content.js';
import { SPOTS } from './world.js';

const between = (a, b) => a + Math.random() * (b - a);

// Staff: reservists from the unit in dark shirts and caps; the pool instructor in red (the game's choice).
const staffLook = (extra = {}) => randomLook({ shirt: '#1d2733', pants: '#2b3640', shoes: '#1b1b1b', beret: '#14181f', longHair: false, ...extra });

function candidate(crowd, info) {
  const person = crowd.add(new Person(candidateLook({ shirt: '#5b6236', pants: '#5b6236', longHair: false }), info.name));
  person.info = { ...info };
  person.fitness = info.trait === 'quitter' ? 0.84 : info.trait === 'hider' ? 0.92 : between(0.94, 1.1);
  return person;
}

export function createPeople(crowd) {
  const staff = {
    head: crowd.add(new Person(staffLook({ scale: 1.06 }), STAFF.head).place(SPOTS.checkin.x, SPOTS.checkin.z - 2, 0).setPose('arms-crossed')),
    guy: crowd.add(new Person(staffLook(), STAFF.guy).place(SPOTS.briefing.x + 2, SPOTS.briefing.z, Math.PI).setPose('clipboard')),
    pool: crowd.add(new Person(randomLook({ shirt: '#c0392b', pants: '#1d2733', shoes: '#f2f2f2' }), STAFF.pool).place(SPOTS.poolDeck.x, SPOTS.poolDeck.z, Math.PI / 2).setPose('arms-crossed')),
    medic: crowd.add(new Person(randomLook({ shirt: '#5b6236', pants: '#5b6236' }), STAFF.medic).place(SPOTS.medic.x, SPOTS.medic.z - 2, 0)),
    psych: crowd.add(new Person(randomLook({ shirt: '#e8e2d6', pants: '#3b3b3b' }), STAFF.psych).place(SPOTS.hall.x + 2, SPOTS.hall.z - 1, 0).setPose('clipboard')),
    others: [],
  };
  for (const [x, z, facing] of [
    [-14, 2, Math.PI],
    [14, 2, Math.PI],
    [6, -52, Math.PI],
  ]) staff.others.push(crowd.add(new Person(staffLook(), 'מגבש').place(x, z, facing).setPose('clipboard')));
  const squad = SQUAD.map((info) => candidate(crowd, info));
  const others = [];
  for (let i = 0; i < 14; i++) others.push(crowd.add(new Person(candidateLook({ shirt: '#5b6236', pants: '#5b6236', longHair: false }), 'מתגבש מחוליה אחרת')));
  campLife(others);
  return { staff, squad, teammates: squad, others };
}

/** The cut on day 3: who leaves the squad. Returns them. */
export function dayThreeCut(people) {
  const leaving = people.squad.filter((p) => CUT_TRAITS.includes(p.info.trait));
  for (const p of leaving) {
    p.info.out = true;
    p.carry(null);
    p.group.visible = false;
  }
  people.teammates = people.squad.filter((p) => !leaving.includes(p));
  return leaving;
}
