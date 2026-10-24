import './style.css';
import * as THREE from 'three';
import { createStage, failToLoad, runSteps, pickStart } from '../../shared/stage.js';
import { buildYarpaWorld, SPOTS } from '../../shared/yarpa-world.js';
import { createYarpaPeople, pace } from '../../shared/yarpa-people.js';
import { HANDLERS, STEPS, HALL_CHATTER } from './flow.js';
import { loop, preload } from '../../../shared/engine/sound.js';
import { GUARD_LINES } from './content.js';

async function start() {
  const game = await createStage({
    id: 'yarpa-a',
    name: 'ירפ״א א׳',
    time: 'dawn',
    buildWorld: buildYarpaWorld,
    createPeople: createYarpaPeople,
    fogFar: 220,
    onFrame,
  });
  const { world, people, player, ui } = game;
  game.resumeSpawn = () => {
    game.sky.setTime('day');
    player.teleport(0, 8, 0);
  };
  pace(people.pacers[0], { x: -7, z: 8 }, { x: 8, z: 9.5 });
  pace(people.pacers[1], { x: 9, z: 10.5 }, { x: -9, z: 7 });

  // ---------- People ----------
  const staffLines = {
    guard1: GUARD_LINES.later,
    guard2: 'תכנס, אל תעמוד בשער.',
    clerk1: () => `מספר ${game.state.number ?? '…'}. תשב באולם, קוראים לפי מספר.`,
    clerk2: 'הרישום אצל הקולגה. תשב באולם.',
    proctor: 'שקט במעבדה, בבקשה.',
    formsProctor: 'החדר הזה לשלב הבא.',
    instructorA: 'תיכנס לחדר הסימולטור כשקוראים לך.',
    instructorB: 'החדר הזה לשלב הבא.',
    nurse: 'הבדיקות לפי התור. לא עכשיו.',
  };
  game.makeTalkable(people.staff, staffLines);
  for (const person of people.hall) {
    game.interactions.add({
      id: 'hall',
      object: person.hitbox,
      label: `לדבר עם ${person.name}`,
      enabled: () => !person.walking && person.group.visible,
      onInteract: () => game.handle('hall', person, () => HALL_CHATTER[Math.floor(Math.random() * HALL_CHATTER.length)]),
    });
  }

  // Chairs in the hall.
  for (const seat of world.seatList) {
    game.hitbox(seat.x, 0.45, seat.z, 0.5, 0.9, 0.5, {
      id: 'seat',
      label: 'לשבת',
      range: 2.4,
      enabled: () => !seat.taken && !player.seat && !ui.modalOpen,
      onInteract: () => {
        player.sit({ ...seat, exit: { x: seat.x, z: seat.z + 0.8 } }, 0);
        seat.taken = true;
        player.onStandUp = () => {
          seat.taken = false;
        };
      },
    });
  }
  // The computer station that is yours, the vending machine and the pilot's chair.
  const mine = world.labSeats[5];
  game.hitbox(mine.x, 0.8, mine.z - 0.4, 0.9, 1.4, 1.0, {
    id: 'labseat',
    label: 'לשבת בעמדה',
    range: 3.2,
    enabled: () => game.pending.has('labseat'),
    priority: () => game.pending.has('labseat'),
    onInteract: () => game.trigger('labseat'),
  });
  game.hitbox(SPOTS.vending.x, 1.1, SPOTS.vending.z, 1.2, 2.2, 1.0, {
    id: 'vending',
    label: 'לקחת מים',
    range: 3,
    onInteract: () => (game.trigger('vending') ? undefined : ui.toast('בקבוק מים קר. תודה.')),
  });
  game.hitbox(SPOTS.simA.chair.x, 0.7, SPOTS.simA.chair.z, 1.2, 1.4, 1.2, {
    id: 'simchair',
    label: 'לשבת בכיסא הטייס',
    range: 3,
    enabled: () => game.pending.has('simchair'),
    priority: () => game.pending.has('simchair'),
    onInteract: () => game.trigger('simchair'),
  });

  // ---------- Sound ----------
  const sounds = { wind: loop('wind'), murmur: loop('murmur'), room: loop('roomtone'), steps: loop('steps') };
  function onFrame(dt) {
    const z = player.z;
    const x = player.x;
    const outside = z > 21;
    const hall = !outside && z > -8;
    const inSim = z < -8 && x > 4;
    sounds.wind.setVolume(outside ? 0.5 : 0);
    sounds.murmur.setVolume(hall ? 0.5 : outside ? 0.04 : inSim ? 0 : 0.12);
    sounds.room.setVolume(outside ? 0 : inSim ? 0.4 : 0.9);
    const speed = dt > 0 ? player.movedThisFrame / dt : 0;
    const moving = speed > 0.3 && !player.seat && !ui.modalOpen;
    sounds.steps.setVolume(moving ? Math.min(0.8, 0.35 + speed / 8) : 0, 0.2);
    sounds.steps.setRate(THREE.MathUtils.clamp(speed / 2.6, 0.85, 1.6));
  }

  preload(['sms', 'achievement', 'vending']);
  game.begin();
  await runSteps(game, HANDLERS, STEPS, pickStart(game, STEPS));
}

start().catch(failToLoad);
