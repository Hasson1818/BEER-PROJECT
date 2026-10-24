import './style.css';
import { createStage, failToLoad, runSteps, pickStart } from '../../shared/stage.js';
import { buildHomeRoom, HOME_SPOTS } from '../../shared/home-room.js';
import { HANDLERS, STEPS } from './flow.js';
import { loop, preload } from '../../../shared/engine/sound.js';
import { fx, roomHum } from '../../shared/fx.js';

async function start() {
  const game = await createStage({
    id: 'psychologist',
    name: 'הפסיכולוג',
    time: 'night',
    buildWorld: (scene) => buildHomeRoom(scene, { outside: 'night' }),
    onFrame,
  });
  const { world, interactions, ui, player } = game;

  // ---------- Things to use in the room ----------

  const use = (key, label, x, y, z, sx, sy, sz, enabled = () => game.pending.has(key)) =>
    game.hitbox(x, y, z, sx, sy, sz, {
      id: key,
      label,
      range: 3.2,
      enabled,
      priority: () => game.pending.has(key),
      onInteract: () => game.trigger(key),
    });
  use('phone', 'לקרוא את ההודעה', HOME_SPOTS.phone.x - 0.1, 0.75, HOME_SPOTS.phone.z, 0.5, 0.4, 0.5);
  use('window', 'לסגור את החלון', 0, 1.55, -3.2, 2.2, 1.4, 0.5);
  use('drawer', 'להכניס את הטלפון למגירה', 2.2, 0.4, -2.3, 0.5, 0.8, 0.5);
  use('water', 'לקחת בקבוק מים', 2.6, 0.7, 1.55, 0.5, 0.5, 0.5);
  use('chair', 'לשבת ליד השולחן', 1.55, 0.7, -1.95, 0.7, 1.0, 0.7);
  use('laptop', 'לפתוח את המחשב', 1.45, 0.95, -2.85, 0.7, 0.5, 0.5);
  // Just for flavor, when the story isn't waiting for them.
  game.hitbox(-2.25, 0.5, -0.6, 1.5, 0.8, 2.2, { id: 'bed', label: 'המיטה', range: 2.6, onInteract: () => ui.toast('אחרי הבוחן. עכשיו לא.') });
  game.hitbox(-3.0, 1.55, -0.5, 0.2, 1.1, 1.0, { id: 'dream', label: 'הכנפיים בפוסטר', range: 3, onInteract: () => ui.toast('עוד לא ויתרתי.') });

  // ---------- Sound: room tone, the street, the fan of the laptop ----------

  const sounds = { room: loop('roomtone'), crickets: loop('crickets'), wind: loop('wind') };
  roomHum(0.03);
  function onFrame() {
    const closed = game.state.prepared?.includes('window');
    const night = game.sky.time === 'night';
    sounds.room.setVolume(0.7);
    sounds.crickets.setVolume(night ? (closed ? 0.1 : 0.45) : 0);
    sounds.wind.setVolume(night ? 0 : closed ? 0.03 : 0.12);
  }

  preload(['sms', 'achievement']);
  game.begin();
  await runSteps(game, HANDLERS, STEPS, pickStart(game, STEPS));
}

start().catch(failToLoad);
