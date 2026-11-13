import { Person, randomLook } from '../../shared/engine/people.js';
import { candidateLook, campLife } from '../../yom-sayarot/src/team.js';
import { SQUAD, SQUAD_F, STAFF } from './content.js';
import { SPOTS } from '../../yom-sayarot/src/world.js';

const between = (a, b) => a + Math.random() * (b - a);

// Everyone is already a soldier: recruits in uniform with a numbered hat (the accounts), staff are reservists from
// the brigade and the sayeret in uniform (the accounts mention no ranks; the colors are the game's own).
const OLIVE = '#5b6236';
const staffLook = (extra = {}) => randomLook({ shirt: OLIVE, pants: OLIVE, shoes: '#3a2a1c', beret: '#2a2d22', longHair: false, ...extra });
// Men come before enlistment in sports clothes; women are already soldiers in basic training (the accounts).
const recruitLook = (f) => (f ? candidateLook({ shirt: OLIVE, pants: OLIVE, longHair: true }) : candidateLook({ longHair: false }));

function candidate(crowd, info, f) {
  const person = crowd.add(new Person(recruitLook(f), info.name));
  person.info = { ...info };
  person.fitness = info.trait === 'quitter' ? 0.82 : info.trait === 'hider' ? 0.93 : between(0.92, 1.08);
  return person;
}

export function createPeople(crowd) {
  const staff = {
    medic: crowd.add(new Person(randomLook({ shirt: OLIVE, pants: OLIVE }), STAFF.medic).place(SPOTS.medic.x, SPOTS.medic.z - 2, 0)),
    head: crowd.add(new Person(staffLook({ scale: 1.06 }), STAFF.head).place(SPOTS.checkin.x, SPOTS.checkin.z - 2, 0).setPose('arms-crossed')),
    guy: crowd.add(new Person(staffLook(), STAFF.guy).place(SPOTS.briefing.x + 2, SPOTS.briefing.z, Math.PI).setPose('clipboard')),
    rasar: crowd.add(new Person(staffLook({ beret: '#9e1b20' }), STAFF.rasar).place(SPOTS.camp.x + 4, SPOTS.camp.z - 3, 0).setPose('arms-crossed')),
    guy2: crowd.add(new Person(staffLook({ longHair: true }), STAFF.guy2).place(SPOTS.briefing.x - 3, SPOTS.briefing.z, Math.PI).setPose('clipboard')),
    others: [],
  };
  for (const [x, z, facing] of [
    [-14, 2, Math.PI],
    [14, 2, Math.PI],
    [30, -1, 0],
  ]) {
    staff.others.push(crowd.add(new Person(staffLook(), 'מגבש').place(x, z, facing).setPose('clipboard')));
  }
  const squads = { m: SQUAD.map((info) => candidate(crowd, info, false)), f: SQUAD_F.map((info) => candidate(crowd, info, true)) };
  const crowds = { m: [], f: [] };
  for (let i = 0; i < 16; i++) {
    crowds.m.push(crowd.add(new Person(recruitLook(false), 'מתגבש מצוות אחר')));
    crowds.f.push(crowd.add(new Person(recruitLook(true), 'מתגבשת מצוות אחר')));
  }
  const people = { staff, squads, crowds, squad: squads.m, teammates: squads.m, others: crowds.m };
  setGender(people, 'm');
  return people;
}

/** Show the squad and the crowd of one route and hide the other. */
export function setGender(people, gender) {
  const other = gender === 'f' ? 'm' : 'f';
  for (const p of [...people.squads[other], ...people.crowds[other]]) p.group.visible = false;
  for (const p of [...people.squads[gender], ...people.crowds[gender]]) p.group.visible = !p.info?.out;
  people.squad = people.squads[gender];
  people.teammates = people.squad.filter((p) => !p.info.out);
  people.others = people.crowds[gender];
  campLife(people.others);
}

/** People who quit during the night: they leave the squad (the accounts: many quit on the first day). */
export function dropOut(people, traits) {
  const gone = people.squad.filter((p) => !p.info.out && traits.includes(p.info.trait));
  for (const p of gone) {
    p.info.out = true;
    p.carry(null);
    p.group.visible = false;
  }
  people.teammates = people.squad.filter((p) => !p.info.out);
  return gone;
}
