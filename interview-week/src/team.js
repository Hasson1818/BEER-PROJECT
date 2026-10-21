import { Person, randomLook } from '../../shared/engine/people.js';
import { HALL_PEOPLE } from './content.js';
import { SPOTS, ROOMS } from './world.js';

const between = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

const CIVILIAN_SHIRTS = ['#3d6fa8', '#c0392b', '#2c3e50', '#7f8c8d', '#e67e22', '#16a085', '#8e44ad', '#34495e', '#d35400', '#27ae60', '#f4f4f0', '#a33'];
const JEANS = ['#2c3e66', '#1f2a44', '#3b3b3b', '#5d6d7e', '#22313f'];

/** Candidates in civilian clothes, like everyone who comes to the interview day. */
const civilian = (extra = {}) =>
  randomLook({ shirt: pick(CIVILIAN_SHIRTS), pants: pick(JEANS), shoes: pick(['#2b2b2b', '#f2f2f2', '#6b4b33']), shortSleeves: Math.random() < 0.7 ? undefined : false, ...extra });
/** Soldiers in uniform, with the beret of their unit. */
const soldier = (beret, extra = {}) =>
  randomLook({ shirt: '#5b6236', pants: '#5b6236', shoes: '#1b1b1b', shortSleeves: false, longHair: false, beret: beret ?? '#3d4224', ...extra });

export function createPeople(crowd, world) {
  const add = (person) => crowd.add(person);

  const staff = {
    clerk1: add(new Person(soldier(null, { longHair: true }), 'חיילת ברישום')),
    clerk2: add(new Person(soldier(null), 'חייל ברישום')),
    announcer: add(new Person(soldier(null, { scale: 1.04 }), 'סמל הקליטה')),
    guard1: add(new Person(soldier('#2a2a2a'), 'שומר בשער')),
    guard2: add(new Person(soldier('#2a2a2a'), 'שומר בכניסה')),
    dad: add(new Person(randomLook({ shirt: '#5b7a99', pants: '#3b3b3b', longHair: false, scale: 1.05 }), 'אבא')),
  };
  staff.clerk1.place(SPOTS.desks[0].x, SPOTS.desks[0].z - 1.0, 0).setPose('type');
  staff.clerk2.place(SPOTS.desks[1].x, SPOTS.desks[1].z - 1.0, 0).setPose('type');
  staff.announcer.place(-4.2, -12.3, Math.PI / 2).setPose('clipboard');
  staff.guard1.place(2.6, 42.2, -Math.PI / 2 + 0.2).setPose('stand');
  staff.guard2.place(-2.6, 42.2, Math.PI / 2 - 0.2).setPose('lean');
  staff.dad.place(0.4, 122.4, Math.PI).setPose('stand');

  // Candidates in the hall.
  const hall = [];
  for (let i = 0; i < 52; i++) hall.push(add(new Person(civilian(), 'מועמד')));
  const seats = shuffle(world.seatList);
  const seated = hall.slice(0, 40);
  const poses = ['sit-read', 'sit-fidget', 'sit-bow', 'sit-relax', 'sit-phone', 'sit-read', 'sit-fidget', 'sit-phone', 'sit-relax', 'sit-bow'];
  seated.forEach((person, i) => {
    const seat = seats[i];
    seat.taken = true;
    person.seat = seat;
    person.place(seat.x, seat.z - 0.02, Math.PI).setPose(poses[i % poses.length]);
  });
  // Two friends talking in the aisle, two leaning on the walls, two pacing, two at the vending machine.
  const [a, b, c, d, e, f, g, h, i2, j2, k2, l2] = hall.slice(40);
  a.place(-1.2, 5.6, Math.PI * 0.4).setPose('talk');
  b.place(-0.2, 5.5, -Math.PI * 0.6).setPose('talk');
  c.place(-15.5, -8, Math.PI / 2).setPose('lean');
  d.place(-15.5, 11, Math.PI / 2).setPose('lean');
  e.place(2.2, 7, Math.PI);
  f.place(-2.2, 8, 0);
  g.place(SPOTS.vending.x - 1.4, SPOTS.vending.z - 0.6, -Math.PI / 2).setPose('stand');
  h.place(SPOTS.vending.x - 2.0, SPOTS.vending.z + 0.4, -Math.PI / 2).setPose('stand');
  i2.place(-9.5, 9.6, Math.PI * 0.9).setPose('talk');
  j2.place(-8.4, 9.4, -Math.PI * 0.1).setPose('talk');
  k2.place(10.5, 10.8, -Math.PI / 2).setPose('phone');
  l2.place(14.8, 14, -Math.PI / 2).setPose('lean');
  const pacers = [e, f];

  // Give some of them names and lines to say.
  const talkers = shuffle(seated).slice(0, HALL_PEOPLE.length);
  talkers.forEach((p, i) => {
    p.name = HALL_PEOPLE[i].name;
    p.line = HALL_PEOPLE[i].line;
  });
  // Numbers on the screen: other candidates.
  hall.forEach((p, i) => (p.number = 300 + i * 3 + (i % 2)));

  const people = { staff, hall, pacers, seated, talkers };
  return people;
}

/** Walk a pacer back and forth, stopping now and then (so the hall is alive). */
export function pace(person, from, to, game) {
  let toB = true;
  let alive = true;
  const go = () => {
    if (!alive) return;
    person.walkTo([toB ? to : from], {
      speed: between(0.95, 1.2),
      pose: Math.random() < 0.5 ? 'lean' : 'stand',
      onArrive: () => {
        toB = !toB;
        setTimeout(go, between(2500, 6000));
      },
    });
  };
  go();
  return () => {
    alive = false;
  };
}

/** Put the unit's interviewers (with their beret colour) in room `room`, facing the door. */
export function seatPanel(crowd, room, unit) {
  return unit.interviewers.map((rank, i) => {
    const person = crowd.add(new Person(soldier(unit.beret, { scale: 1 + i * 0.03 }), `${rank} של ${unit.name}`));
    const spot = room.panel[i];
    person.place(spot.x, spot.z, room.face).setPose(i === 0 ? 'sit-talk' : 'sit-type');
    return person;
  });
}

export function releasePanel(list) {
  for (const person of list) person.group.visible = false;
}

export { ROOMS };
