import './style.css';
import { createStage, failToLoad, runSteps, pickStart } from '../../pilot-path/shared/stage.js';
import { buildHomeRoom, HOME_SPOTS } from '../../pilot-path/shared/home-room.js';
import { HANDLERS, STEPS } from './flow.js';
import { loop, preload } from '../../shared/engine/sound.js';
import { roomHum } from '../../pilot-path/shared/fx.js';

async function start() {
  const game = await createStage({
    id: 'yom-hamaa',
    name: 'יום המא״ה',
    time: 'night',
    buildWorld: (scene) =>
      buildHomeRoom(scene, {
        outside: 'night',
        theme: 'general',
        sign: ['יום המא״ה', 'יום ג׳ · 08:00'],
        posters: [
          ['הצו הראשון', ['✓ עברתי', 'הנתונים באזור האישי'], '#4b5320'],
          ['לו״ז', ['08:00 מבחנים', 'זום: קבוצה, הדרכה'], '#1f3b73'],
        ],
        screenTitle: 'יום המא״ה · מתגייסים',
      }),
    onFrame,
  });
  const { ui, player } = game;

  // ---------- Things to use in the room ----------

  const use = (key, label, x, y, z, sx, sy, sz, enabled = () => game.pending.has(key)) =>
    game.hitbox(x, y, z, sx, sy, sz, { id: key, label, range: 3.2, enabled, priority: () => game.pending.has(key), onInteract: () => game.trigger(key) });
  use('phone', 'לקרוא את ההודעה', HOME_SPOTS.phone.x - 0.1, 0.75, HOME_SPOTS.phone.z, 0.5, 0.4, 0.5);
  use('window', 'לסגור את החלון', 0, 1.55, -3.2, 2.2, 1.4, 0.5);
  use('drawer', 'להכניס את הטלפון למגירה', 2.2, 0.4, -2.3, 0.5, 0.8, 0.5);
  use('water', 'לקחת בקבוק מים', 2.6, 0.7, 1.55, 0.5, 0.5, 0.5);
  use('paper', 'דף, עט ותעודה מזהה', 1.05, 0.8, -2.7, 0.4, 0.2, 0.4);
  // The chair: sit down (the story is waiting for it), or sit before the room is ready.
  game.hitbox(1.55, 0.7, -1.95, 0.7, 1.0, 0.7, {
    id: 'chair',
    label: 'לשבת ליד השולחן',
    range: 3.2,
    enabled: () => game.pending.has('chair') || game.pending.has('chair-early'),
    priority: () => game.pending.has('chair'),
    onInteract: () => game.trigger('chair') || game.trigger('chair-early'),
  });
  use('laptop', 'לפתוח את המחשב', 1.45, 0.95, -2.85, 0.7, 0.5, 0.5);
  game.hitbox(-2.25, 0.5, -0.6, 1.5, 0.8, 2.2, { id: 'bed', label: 'המיטה', range: 2.6, onInteract: () => ui.toast('לא עכשיו. מחר יום ארוך.') });

  // ---------- Sound ----------

  const sounds = { room: loop('roomtone'), crickets: loop('crickets'), wind: loop('wind') };
  roomHum(0.03);
  function onFrame() {
    const night = game.sky.time === 'night';
    const closed = game.state.prepared >= 1;
    sounds.room.setVolume(0.7);
    sounds.crickets.setVolume(night ? 0.4 : 0);
    sounds.wind.setVolume(night ? 0 : closed ? 0.03 : 0.12);
  }
  game.resumeSpawn = () => player.teleport(HOME_SPOTS.spawn.x, HOME_SPOTS.spawn.z, 0.5);

  preload(['sms', 'achievement']);
  if (import.meta.env.DEV) window.__maa = game;
  game.begin();
  await runSteps(game, HANDLERS, STEPS, pickStart(game, STEPS));
}

start().catch(failToLoad);
