import { Person, randomLook } from '../../shared/engine/people.js';
import { CLASSMATES, STAFF, MY_NUMBER } from './content.js';
import { SPOTS, RACK } from './world.js';

const between = (a, b) => a + Math.random() * (b - a);
const UNIFORM = '#6a6d45';

// Candidates: מדי ב׳, a field hat or a helmet, and the water bottle on the belt.
export const candidateLook = (extra = {}) =>
  randomLook({ shirt: UNIFORM, pants: UNIFORM, shoes: '#1b1b1b', shortSleeves: false, longHair: false, helmet: '#3d4426', bucketHat: '#7b7b52', bottle: true, ...extra });
// Staff: no ranks, a cap and sunglasses all day.
const staffLook = (extra = {}) =>
  randomLook({ shirt: '#535a35', pants: '#535a35', shoes: '#1b1b1b', shortSleeves: false, longHair: false, cap: '#3a3f26', sunglasses: true, ...extra });

export function createPeople(crowd) {
  const staff = {
    mc: crowd.add(new Person(staffLook({ scale: 1.03 }), STAFF.mc)),
    mc2: crowd.add(new Person(staffLook({ scale: 0.98 }), STAFF.mc2)),
    sergeant: crowd.add(new Person(staffLook({ scale: 1.05 }), STAFF.sergeant)),
    commander: crowd.add(new Person(staffLook({ scale: 1.04, cap: false, beret: '#4a5f7a' }), STAFF.commander)),
    platoon: crowd.add(new Person(staffLook(), STAFF.platoon)),
    medic: crowd.add(new Person(randomLook({ shirt: UNIFORM, pants: UNIFORM, shoes: '#1b1b1b', shortSleeves: false }), STAFF.medic)),
    doctor: crowd.add(new Person(randomLook({ shirt: UNIFORM, pants: UNIFORM, coat: true, longHair: true }), STAFF.doctor)),
    quartermaster: crowd.add(new Person(randomLook({ shirt: UNIFORM, pants: UNIFORM, shoes: '#1b1b1b' }), STAFF.quartermaster)),
  };
  staff.medic.place(SPOTS.medic.x - 0.6, SPOTS.medic.z - 2.1, 0);
  staff.doctor.place(SPOTS.medic.x + 0.6, SPOTS.medic.z - 2.1, 0).setPose('clipboard');
  staff.quartermaster.place(SPOTS.uniforms.x, SPOTS.uniforms.z - 2.1, 0);
  staff.mc.place(SPOTS.classMat.x - 1, SPOTS.classMat.z, -Math.PI / 2).setPose('arms-crossed');
  staff.mc2.place(SPOTS.classMat.x + 1, SPOTS.classMat.z, -Math.PI / 2).setPose('clipboard');
  staff.sergeant.place(SPOTS.helmets.x, SPOTS.helmets.z - 2.1, 0);
  staff.commander.place(SPOTS.stage.x, SPOTS.stage.z, -Math.PI / 2);
  staff.platoon.place(SPOTS.stage.x - 1, SPOTS.stage.z + 5, -Math.PI / 2).setPose('arms-crossed');

  const classmates = CLASSMATES.map((info) => {
    const person = crowd.add(new Person(candidateLook(), `${info.number} · ${info.name}`));
    person.info = { ...info };
    person.fitness = info.trait === 'quitter' ? 0.85 : between(0.88, 1.08);
    return person;
  });

  // Other classes on the hill, so it never feels empty.
  const others = [];
  for (let i = 0; i < 30; i++) others.push(crowd.add(new Person(candidateLook(), 'מתגבש מכיתה אחרת')));
  const otherStaff = [];
  for (let i = 0; i < 3; i++) otherStaff.push(crowd.add(new Person(staffLook(), 'מ״כ מכיתה אחרת')));

  const people = { staff, classmates, others, otherStaff };
  othersAt(people, 'hall');
  return people;
}

/** Classmates still in the gibbush (someone may quit on day 3). */
export const active = (people) => people.classmates.filter((p) => !p.info.out);

export function headgear(people, kind) {
  for (const p of [...people.classmates, ...people.others]) p.setHeadgear(kind);
}

// ---------- Formations ----------

/**
 * "ח׳ כיתתית": the class stands on three sides of a rectangle, open towards
 * the מ״כ. Slot `MY_NUMBER - 1` is left empty for the player. Returns the
 * player's slot and the spot where the מ״כ stands.
 */
export function formation(people, cx, cz, facing = 0, pose = 'stand') {
  const sin = Math.sin(facing);
  const cos = Math.cos(facing);
  // Local frame: the class looks along +z towards the open side.
  const local = [];
  for (let i = 0; i < 5; i++) local.push([-3.2, -1.6 + i * 1.1]); // Left side.
  for (let i = 0; i < 6; i++) local.push([-2.2 + i * 0.88, -2.6]); // Back.
  for (let i = 0; i < 5; i++) local.push([3.2, -1.6 + i * 1.1]); // Right side.
  const toWorld = ([lx, lz]) => ({ x: cx + lx * cos + lz * sin, z: cz - lx * sin + lz * cos });
  const slots = local.map(toWorld);
  const center = toWorld([0, 0.5]);
  const facingOf = (slot) => Math.atan2(center.x - slot.x, center.z - slot.z);
  const list = active(people);
  let s = 0;
  for (const person of list) {
    if (s === MY_NUMBER - 1) s++;
    const slot = slots[s++ % slots.length];
    person.group.visible = true;
    person.carry(null);
    person.stop(pose);
    person.place(slot.x, slot.z, facingOf(slot));
  }
  const mine = slots[MY_NUMBER - 1];
  return { mine, facing: facingOf(mine), mc: toWorld([0, 3.2]), mcFacing: facing + Math.PI };
}

/** Rows of people sitting in eastern sitting, facing `facing`. */
export function sitRows(list, cx, cz, facing = 0, pose = 'sit-east', perRow = 6) {
  const sin = Math.sin(facing);
  const cos = Math.cos(facing);
  list.forEach((person, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const lx = (col - (perRow - 1) / 2) * 1.05;
    const lz = -row * 1.2;
    person.group.visible = true;
    person.carry(null);
    person.stop(pose);
    person.place(cx + lx * cos + lz * sin, cz - lx * sin + lz * cos, facing);
  });
}

/** A loose line side by side along x, facing `facing`. */
export function line(list, x, z, facing = 0, gap = 1.1, pose = 'stand') {
  list.forEach((person, i) => {
    person.group.visible = true;
    person.carry(null);
    person.stop(pose);
    person.place(x + (i - (list.length - 1) / 2) * gap, z, facing);
  });
}

// ---------- Other classes ----------

// Where the other classes are during each part of the gibbush.
const LAYOUTS = {
  hall: [
    { x: 64, z: 56, facing: Math.PI / 2, count: 10, pose: 'sit-east' },
    { x: 64, z: 48, facing: Math.PI / 2, count: 10, pose: 'sit-read' },
    { x: 76, z: 44, facing: 0, count: 10, pose: 'stand' },
  ],
  camp: [
    { x: -6, z: 42.5, facing: 0, count: 10, pose: 'sit-read' },
    { x: 26, z: 42.5, facing: 0, count: 10, pose: 'sit-east' },
    { x: -2, z: 60, facing: Math.PI, count: 10, pose: 'sit-ground' },
  ],
  field: [
    { x: 12, z: 6, facing: Math.PI / 2, count: 10, pose: 'sit-read' },
    { x: -14, z: 34, facing: 0, count: 10, pose: 'sit-east' },
    { x: 40, z: 10, facing: -Math.PI / 2, count: 10, pose: 'hands-on-knees' },
  ],
  night: [
    { x: -6, z: 48, facing: 0, count: 10, pose: 'sit-ground' },
    { x: 26, z: 48, facing: 0, count: 10, pose: 'sit-ground' },
    { x: -40, z: 46, facing: Math.PI / 2, count: 10, pose: 'sit-east' },
  ],
};

export function othersAt(people, layout) {
  const groups = LAYOUTS[layout];
  let i = 0;
  groups.forEach((g, gi) => {
    const list = people.others.slice(i, i + g.count);
    i += g.count;
    sitRows(list, g.x, g.z, g.facing, g.pose, 5);
    const mc = people.otherStaff[gi];
    if (mc) {
      mc.group.visible = true;
      mc.stop(gi === 1 ? 'clipboard' : 'arms-crossed');
      mc.place(g.x + Math.sin(g.facing) * 3, g.z + Math.cos(g.facing) * 3, g.facing + Math.PI);
    }
  });
}

// ---------- Movement helpers ----------

/**
 * Runs a person through `steps` again and again while `active()` is true.
 * Step: { to: {x, z}, speed, moving: 'walk' | 'crawl', carry: item | null }.
 */
export function loop(person, steps, { active: isActive, onLap, fatigue = 0.03 }) {
  let lap = 0;
  const run = (i) => {
    if (!isActive()) return;
    if (i >= steps.length) {
      lap++;
      onLap?.(person, lap);
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

/** Hanging spots around the plum rack: index → { x, z, facing } (facing in or out). */
export function rackSlot(index, outward = false) {
  const a = (index / RACK.slots) * Math.PI * 2 + 0.12;
  const r = RACK.r - 0.05; // Right under the bar.
  const x = RACK.x + Math.cos(a) * r;
  const z = RACK.z + Math.sin(a) * r;
  const inward = Math.atan2(RACK.x - x, RACK.z - z);
  return { x, z, facing: outward ? inward + Math.PI : inward };
}
