import { Person, randomLook, soldierLook } from './people.js';
import { ROOMS } from './world.js';
import { NPC_NAMES } from './content.js';

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const between = (min, max) => min + Math.random() * (max - min);
const FACING = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 };

let numberCounter = 140;
export function nextNumber(prefix = pick(['A', 'A', 'B', 'C'])) {
  numberCounter += 1 + Math.floor(Math.random() * 3);
  return `${prefix}-${String(numberCounter).padStart(3, '0')}`;
}

export function stationLabel(room) {
  return `${room.name} · ${room.room}`;
}

// ---------- Staff ----------

export function createStaff(world, crowd) {
  const sitAt = (person, spot, dir, pose = 'sit-type') => {
    person.place(spot.x, spot.z, FACING[dir]).setPose(pose);
    return crowd.add(person);
  };

  const guard = crowd.add(
    new Person(randomLook({ shirt: '#1d2b44', pants: '#1d2b44', shoes: '#111111', longHair: false }), 'מאבטח')
      .place(1.4, -2.3, 0)
      .setPose('arms-crossed'),
  );

  const routingClerks = world.windows.map((w, i) =>
    sitAt(new Person(soldierLook({ longHair: i !== 2 }), 'פקידת ניתוב'), { x: w.x, z: -9.35 }, '+z', i === 2 ? 'sit-type' : 'sit'),
  );

  const dataClerk = sitAt(new Person(soldierLook({ longHair: true }), 'פקידת אימות נתונים'), world.spots.dataClerk, '+z');
  const dataClerk2 = sitAt(new Person(soldierLook({ longHair: true }), 'פקידת אימות נתונים'), world.spots.dataClerk2, '+z', 'sit-talk');
  const dataCandidate = sitAt(new Person(randomLook(), 'מלש״ב'), world.spots.dataCandidate2, '-z', 'sit-talk');

  const proctor = crowd.add(
    new Person(soldierLook({ beret: true }), 'משגיח המבחנים').place(world.spots.proctor.x, world.spots.proctor.z, FACING['-x']).setPose('clipboard'),
  );

  const measureMedic = crowd.add(
    new Person(soldierLook({ longHair: true }), 'חובשת').place(world.spots.measureMedic.x, world.spots.measureMedic.z, FACING['-x']),
  );
  const visionMedic = sitAt(new Person(soldierLook(), 'חובש'), world.spots.visionMedic, '+z', 'sit');
  const doctor = sitAt(new Person(randomLook({ coat: true, shirt: '#cfd8dc', pants: '#37474f', hair: '#8d8d8d' }), 'רופא הוועדה'), world.spots.doctor, '-z', 'sit-type');

  const interviewers = {};
  for (const key of ['interview1', 'interview2', 'interview3']) {
    const spot = world.spots[key];
    interviewers[key] = sitAt(new Person(soldierLook({ longHair: Math.random() < 0.8 }), 'מאבחנת'), spot.interviewer, '+z', key === 'interview2' ? 'sit' : 'sit-talk');
    if (key !== 'interview2') sitAt(new Person(randomLook(), 'מלש״ב'), spot.chair, '-z', 'sit-talk');
  }

  // People already taking the computer test.
  const testers = [];
  world.daparStations.forEach((station) => {
    if (station.number === 5 || Math.random() < 0.35) return;
    testers.push(sitAt(new Person(randomLook(), 'מלש״ב'), station, '-x', 'sit-type'));
  });

  // Outside: a parent saying goodbye, someone on the bench.
  const parent = crowd.add(new Person(randomLook({ scale: 1.03 }), 'הורה').place(-3.2, 4.6, Math.PI / 2).setPose('talk'));
  const kid = crowd.add(new Person(randomLook(), 'מלש״ב').place(-2.4, 4.6, -Math.PI / 2).setPose('stand'));
  const bench = crowd.add(new Person(randomLook(), 'הורה מחכה').place(6.5, 1.75, 0).setPose('sit-phone'));

  return { guard, routingClerks, dataClerk, dataClerk2, dataCandidate, proctor, measureMedic, visionMedic, doctor, interviewers, testers, parent, kid, bench };
}

// ---------- Routing queue ----------

const LANE = { minX: -3.5, maxX: 6.7, minZ: -6.8, maxZ: -5.2 };
const slot = (i) => ({ x: -3.0 + i * 0.8, z: -6.0 });

export class RoutingQueue {
  constructor(world, crowd, hall, staff) {
    this.world = world;
    this.crowd = crowd;
    this.hall = hall;
    this.staff = staff;
    this.entries = [];
    this.windows = world.windows.map((w, i) => ({ x: w.x, index: i, open: i < 2, busy: null }));
    this.playerNeeded = false;
    this.playerCalledWindow = null;
    this.arrivalTimer = 6;
    this.pool = [];
    this.onPlayerCalled = null;
    this.onPlayerLeft = null;

    for (let i = 0; i < 4; i++) {
      const person = this.crowd.add(new Person(randomLook(), pick(NPC_NAMES)));
      const pos = slot(i);
      person.place(pos.x, pos.z, FACING['-x']).setPose(Math.random() < 0.5 ? 'phone' : 'stand');
      this.entries.push({ type: 'npc', person, number: nextNumber() });
    }
  }

  get playerIndex() {
    return this.entries.findIndex((e) => e.type === 'player');
  }

  inLane(player) {
    return player.x > LANE.minX && player.x < LANE.maxX && player.z > LANE.minZ && player.z < LANE.maxZ;
  }

  /** Where the player should stand: right behind the last person. */
  get endOfLine() {
    const index = this.playerIndex >= 0 ? this.playerIndex : this.entries.length;
    return slot(Math.min(index, 11));
  }

  windowFor(index) {
    return this.world.windows[index];
  }

  moveUp() {
    this.entries.forEach((entry, i) => {
      if (entry.type !== 'npc' || entry.arriving) return;
      const pos = slot(i);
      const p = entry.person.position;
      if (Math.abs(p.x - pos.x) > 0.05) {
        entry.person.walkTo([pos], { facing: FACING['-x'], pose: Math.random() < 0.5 ? 'phone' : 'stand', speed: 0.9 });
      }
    });
  }

  spawnArrival() {
    const person = this.pool.pop() ?? (this.crowd.full ? null : this.crowd.add(new Person(randomLook(), pick(NPC_NAMES))));
    if (!person) return;
    const fromLeft = Math.random() < 0.5;
    person.group.visible = true;
    person.place(fromLeft ? -18 : 18, 7.5, 0);
    const entry = { type: 'npc', person, number: nextNumber(), arriving: true };
    this.entries.push(entry);
    person.walkTo([{ x: 0, z: 2 }, { x: 0, z: -3.8 }, { x: 7.2, z: -4.4 }, { x: 7.2, z: -6.0 }, slot(Math.min(this.entries.indexOf(entry), 11))], {
      facing: FACING['-x'],
      onArrive: () => {
        entry.arriving = false;
        this.moveUp();
      },
    });
  }

  serve(windowState, entry) {
    windowState.busy = entry;
    this.entries.shift();
    this.moveUp();
    const clerk = this.staff.routingClerks[windowState.index];
    entry.person.walkTo([{ x: -3.9, z: -6.4 }, { x: windowState.x, z: -7.55 }], {
      facing: Math.PI,
      onArrive: () => {
        clerk.setPose('sit-talk');
        setTimeout(() => {
          clerk.setPose('sit');
          windowState.busy = null;
          this.hall.receiveFromRouting(entry.person, entry.number, this.pool);
        }, between(5500, 8000));
      },
    });
  }

  update(dt, player) {
    // Player joins / leaves the line.
    if (this.playerNeeded) {
      const index = this.playerIndex;
      const inLane = this.inLane(player);
      if (index < 0 && inLane) {
        this.entries.push({ type: 'player' });
      } else if (index >= 0 && !inLane && this.playerCalledWindow === null) {
        this.entries.splice(index, 1);
        this.moveUp();
        this.onPlayerLeft?.();
      }
    }

    // Serve the front of the line.
    const front = this.entries[0];
    const freeWindow = this.windows.find((w) => w.open && !w.busy);
    if (front && freeWindow) {
      if (front.type === 'npc' && !front.arriving && !front.person.walking) {
        this.serve(freeWindow, front);
      } else if (front.type === 'player' && this.playerCalledWindow === null) {
        freeWindow.busy = front;
        this.playerCalledWindow = freeWindow.index;
        this.onPlayerCalled?.(freeWindow.index);
      }
    }

    // New people keep arriving.
    this.arrivalTimer -= dt;
    if (this.arrivalTimer <= 0) {
      this.arrivalTimer = between(9, 15);
      if (this.entries.length < 7) this.spawnArrival();
    }
  }

  /** Called after the player finished at the window. */
  playerServed() {
    const index = this.playerIndex;
    if (index >= 0) this.entries.splice(index, 1);
    const w = this.windows[this.playerCalledWindow];
    if (w) w.busy = null;
    this.playerCalledWindow = null;
    this.playerNeeded = false;
    this.moveUp();
  }
}

// ---------- Waiting hall ----------

export class HallLife {
  constructor(world, crowd) {
    this.world = world;
    this.crowd = crowd;
    this.called = [];
    this.waiting = [];
    this.callTimer = 4;
    this.seated = [];
    this.highlight = null;
    this.paused = false;

    const poses = ['sit', 'sit-phone', 'sit-phone', 'sit', 'sit-talk'];
    const free = world.seatList.filter(() => true).sort(() => Math.random() - 0.5);
    for (let i = 0; i < 30; i++) {
      const seat = free[i];
      const person = this.crowd.add(new Person(randomLook(), pick(NPC_NAMES)));
      this.seatPerson(person, seat, pick(poses));
      this.seated.push({ person, seat, number: nextNumber() });
    }
    for (let i = 0; i < 6; i++) this.called.push({ number: nextNumber(), station: stationLabel(pick(Object.values(ROOMS))) });
    for (let i = 0; i < 5; i++) this.waiting.push(nextNumber());

    // Two friends chatting and a parent on the phone, standing.
    this.crowd.add(new Person(randomLook(), pick(NPC_NAMES)).place(11.2, -18, -Math.PI / 2).setPose('talk'));
    this.crowd.add(new Person(randomLook(), pick(NPC_NAMES)).place(10.5, -18, Math.PI / 2).setPose('arms-crossed'));
    this.crowd.add(new Person(randomLook({ scale: 1.04 }), 'הורה').place(-11.8, -26.5, Math.PI / 2).setPose('phone'));

    // A soldier walking around with a clipboard.
    this.walker = this.crowd.add(new Person(soldierLook({ beret: true }), 'חייל מהלשכה').place(-11.6, -13, Math.PI));
    this.patrol();
    this.refreshScreens();
  }

  seatPerson(person, seat, pose = 'sit') {
    seat.taken = true;
    person.place(seat.x, seat.z, Math.PI).setPose(pose);
  }

  patrol() {
    const route = [
      { x: -11.6, z: -28.6 },
      { x: 11.6, z: -28.6 },
      { x: 11.6, z: -13 },
      { x: -11.6, z: -13 },
    ];
    const step = (i) => {
      this.walker.walkTo([route[i]], {
        pose: 'clipboard',
        onArrive: () => setTimeout(() => step((i + 1) % route.length), between(2000, 6000)),
        speed: 1.0,
      });
    };
    step(0);
  }

  laneZ(seat) {
    return seat.z - 1.1;
  }

  pathToRoom(seat, room) {
    const side = seat.row.side;
    const sideX = side * 11.6;
    const lane = this.laneZ(seat);
    const path = [
      { x: seat.x, z: lane },
      { x: sideX, z: lane },
    ];
    if (room.door.z === -30) {
      path.push({ x: sideX, z: -28.8 }, { x: room.door.x, z: -28.8 });
    } else {
      path.push({ x: sideX, z: room.door.z }, { x: side * 13.2, z: room.door.z });
    }
    path.push({ x: room.door.x, z: room.door.z }, room.inside);
    return path;
  }

  /** Someone just finished at the routing counter: they come and sit down. */
  receiveFromRouting(person, number, pool) {
    const seat = this.freeSeat();
    if (!seat) {
      person.walkTo([{ x: -3.0, z: -7.6 }, { x: 12, z: -11.5 }], {
        onArrive: () => {
          person.group.visible = false;
          pool.push(person);
        },
      });
      return;
    }
    seat.taken = true;
    const lane = this.laneZ(seat);
    person.walkTo(
      [
        { x: -3.0, z: -7.6 },
        { x: -2.2, z: -11.2 },
        { x: 0, z: -12.8 },
        { x: 0, z: lane },
        { x: seat.x, z: lane },
        { x: seat.x, z: seat.z },
      ],
      {
        pose: pick(['sit', 'sit-phone']),
        facing: Math.PI,
        onArrive: () => this.seated.push({ person, seat, number }),
      },
    );
  }

  freeSeat() {
    const free = this.world.seatList.filter((s) => !s.taken);
    return free.length ? pick(free) : null;
  }

  callSomeone(player) {
    // Prefer people not right next to the player.
    const candidates = this.seated.filter(
      (s) => !s.person.walking && s.person.group.visible && Math.hypot(s.person.position.x - player.x, s.person.position.z - player.z) > 3,
    );
    if (!candidates.length) return;
    const entry = pick(candidates);
    const side = entry.seat.row.side;
    const rooms = side < 0 ? ['data', 'dapar', 'interview1', 'interview2'] : ['measure', 'vision', 'doctor', 'interview3'];
    const room = ROOMS[pick(rooms)];
    // The next number in line on the screen is the one that gets called.
    entry.number = this.waiting.shift() ?? entry.number;
    this.pushCalled(entry.number, stationLabel(room));
    this.seated.splice(this.seated.indexOf(entry), 1);

    const { person, seat } = entry;
    const path = this.pathToRoom(seat, room);
    person.walkTo(path, {
      onArrive: () => {
        person.group.visible = false;
        setTimeout(() => {
          person.group.visible = true;
          person.walkTo([...path].reverse().slice(1).concat([{ x: seat.x, z: seat.z }]), {
            pose: pick(['sit', 'sit-phone']),
            facing: Math.PI,
            onArrive: () => this.seated.push({ person, seat, number: nextNumber() }),
          });
        }, between(15000, 40000));
      },
    });
  }

  pushCalled(number, station) {
    this.called.unshift({ number, station });
    this.called.length = Math.min(this.called.length, 6);
    while (this.waiting.length < 5) this.waiting.push(nextNumber());
    this.refreshScreens();
  }

  /** Show the player's number in the "waiting" row with `ahead` numbers before it. */
  setPlayerWaiting(number, ahead) {
    const next = number ? { number, ahead } : null;
    if (JSON.stringify(next) === JSON.stringify(this.playerWaiting ?? null)) return;
    this.playerWaiting = next;
    this.refreshScreens();
  }

  refreshScreens() {
    const waiting = this.playerWaiting
      ? [...this.waiting.slice(0, this.playerWaiting.ahead), this.playerWaiting.number]
      : this.waiting;
    this.world.updateScreens({ called: this.called, waiting, highlight: this.highlight });
  }

  update(dt, player) {
    if (this.paused) return;
    this.callTimer -= dt;
    if (this.callTimer <= 0) {
      this.callTimer = between(8, 14);
      this.callSomeone(player);
    }
  }
}

export const HALL_ZONE = { minX: -13.8, maxX: 13.8, minZ: -29.8, maxZ: -12 };
export function inHall(player) {
  return player.x > HALL_ZONE.minX && player.x < HALL_ZONE.maxX && player.z > HALL_ZONE.minZ && player.z < HALL_ZONE.maxZ;
}
