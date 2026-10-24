import { Person, randomLook } from '../../shared/engine/people.js';
import { SPOTS } from './yarpa-world.js';

// The people of the aeromedical unit: staff in uniform, and candidates in civilian clothes.

const between = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

const SHIRTS = ['#3d6fa8', '#c0392b', '#2c3e50', '#7f8c8d', '#e67e22', '#16a085', '#8e44ad', '#34495e', '#d35400', '#27ae60', '#f4f4f0', '#a33'];
const JEANS = ['#2c3e66', '#1f2a44', '#3b3b3b', '#5d6d7e', '#22313f'];

const civilian = (extra = {}) =>
  randomLook({ shirt: pick(SHIRTS), pants: pick(JEANS), shoes: pick(['#2b2b2b', '#f2f2f2', '#6b4b33']), shortSleeves: Math.random() < 0.7 ? undefined : false, ...extra });
// Air force staff: blue-gray shirts. Doctors and nurses in white.
const airForce = (extra = {}) => randomLook({ shirt: '#6f8196', pants: '#3d4a5c', shoes: '#1b1b1b', shortSleeves: true, longHair: false, beret: '#4a6aa0', ...extra });
const medical = (extra = {}) => randomLook({ shirt: '#f2f4f5', pants: '#e8ecef', shoes: '#f2f2f2', shortSleeves: true, ...extra });

export function createYarpaPeople(crowd, world) {
  const add = (p) => crowd.add(p);

  const staff = {
    guard1: add(new Person(airForce({ beret: '#2a2a2a', shirt: '#5b6236', pants: '#5b6236' }), 'השומר בשער')),
    guard2: add(new Person(airForce({ beret: '#2a2a2a', shirt: '#5b6236', pants: '#5b6236' }), 'השומרת בשער')),
    clerk1: add(new Person(airForce({ longHair: true }), 'חיילת ברישום')),
    clerk2: add(new Person(airForce(), 'חייל ברישום')),
    proctor: add(new Person(airForce({ scale: 1.03 }), 'המשגיח במעבדה')),
    formsProctor: add(new Person(airForce({ longHair: true }), 'המשגיחה בחדר השאלונים')),
    instructorA: add(new Person(airForce({ scale: 1.05 }), 'מדריך הסימולטור')),
    instructorB: add(new Person(airForce({ longHair: true }), 'מדריכת הסימולטור')),
    nurse: add(new Person(medical({ longHair: true }), 'האחות')),
  };
  staff.guard1.place(2.6, 42.2, -Math.PI / 2 + 0.2).setPose('stand');
  staff.guard2.place(-2.6, 42.2, Math.PI / 2 - 0.2).setPose('lean');
  staff.clerk1.place(SPOTS.desks[0].x, SPOTS.desks[0].z - 1.0, 0).setPose('type');
  staff.clerk2.place(SPOTS.desks[1].x, SPOTS.desks[1].z - 1.0, 0).setPose('type');
  staff.proctor.place(SPOTS.lab.proctor.x + 0.8, SPOTS.lab.proctor.z - 0.9, Math.PI).setPose('type');
  staff.formsProctor.place(SPOTS.forms.proctor.x + 0.8, SPOTS.forms.proctor.z - 0.9, Math.PI).setPose('type');
  staff.instructorA.place(SPOTS.simA.instructor.x - 1.0, SPOTS.simA.instructor.z - 0.5, Math.PI).setPose('clipboard');
  staff.instructorB.place(SPOTS.simB.instructor.x - 1.0, SPOTS.simB.instructor.z - 0.5, Math.PI).setPose('clipboard');
  staff.nurse.place(SPOTS.eye.x - 0.9, SPOTS.eye.z + 0.5, -Math.PI / 2).setPose('clipboard');

  // Candidates in the hall: most are seated, some stand and talk, one or two pace.
  const hall = [];
  for (let i = 0; i < 46; i++) hall.push(add(new Person(civilian(), 'מועמד')));
  const seats = shuffle(world.seatList);
  const poses = ['sit-read', 'sit-fidget', 'sit-bow', 'sit-relax', 'sit-phone', 'sit-fidget', 'sit-bow', 'sit-phone'];
  const seated = hall.slice(0, 34);
  seated.forEach((person, i) => {
    const seat = seats[i];
    seat.taken = true;
    person.seat = seat;
    person.place(seat.x, seat.z - 0.02, Math.PI).setPose(poses[i % poses.length]);
  });
  const [a, b, c, d, e, f, g, h, i2, j2, k2, l2] = hall.slice(34);
  a.place(-1.4, 6.6, Math.PI * 0.4).setPose('talk');
  b.place(-0.4, 6.5, -Math.PI * 0.6).setPose('talk');
  c.place(-17.4, -3, Math.PI / 2).setPose('lean');
  d.place(-17.4, 12, Math.PI / 2).setPose('lean');
  e.place(2.2, 8, Math.PI);
  f.place(-2.2, 9, 0);
  g.place(SPOTS.vending.x - 1.4, SPOTS.vending.z - 0.6, -Math.PI / 2).setPose('stand');
  h.place(SPOTS.vending.x - 2.0, SPOTS.vending.z + 0.4, -Math.PI / 2).setPose('stand');
  i2.place(-11.5, 10.6, Math.PI * 0.9).setPose('talk');
  j2.place(-10.4, 10.4, -Math.PI * 0.1).setPose('talk');
  k2.place(11.5, 10.8, -Math.PI / 2).setPose('phone');
  l2.place(16.8, 15, -Math.PI / 2).setPose('lean');
  const pacers = [e, f];

  // Candidates who will sit at the computers next to you (hidden until the tests start).
  const labMates = [];
  for (let i = 0; i < 9; i++) {
    const p = add(new Person(civilian(), 'מועמד'));
    p.group.visible = false;
    labMates.push(p);
  }

  return { staff, hall, pacers, seated, labMates };
}

/** Walk a pacer back and forth, stopping now and then (so the hall is alive). */
export function pace(person, from, to) {
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

/** Put candidates at the computers of a room (all stations but yours). */
export function seatMates(people, seats, mySeat) {
  const free = shuffle(seats.filter((s) => s !== mySeat)).slice(0, people.length);
  people.forEach((person, i) => {
    const s = free[i];
    if (!s) return;
    person.group.visible = true;
    person.place(s.x, s.z - 0.05, Math.PI).setPose(i % 3 === 0 ? 'sit-type' : 'sit-relax');
  });
}

export function hideMates(people) {
  for (const p of people) p.group.visible = false;
}
