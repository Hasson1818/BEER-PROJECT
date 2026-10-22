import * as THREE from 'three';
import { DUNE, SPOTS, height } from './world.js';
import { laneX, nearestCone, loop } from './team.js';
import { SHOUTS } from './content.js';
import { chime, click } from '../../shared/engine/audio.js';
import { play, playRandom } from '../../shared/engine/sound.js';

const between = (a, b) => a + Math.random() * (b - a);
const shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

/**
 * Physical drills. Each one returns stats that feed the final result.
 * The player's effort is modelled with stamina: moving drains it (more when
 * carrying, crawling or going uphill), standing restores it, and a tired
 * player slows down. Standing still too long gets you shouted at.
 */
export function createDrills(game) {
  const { player, ui, people, world, hud } = game;
  const stats = { stops: 0 };
  let stamina = 100;
  let carrying = null; // 'sandbag' | 'jerrycan' | null
  let crawling = false;
  let idle = 0;
  let lastGround = 0;

  function setCarry(item) {
    carrying = item;
    hud.setCarry(item);
  }

  function setCrawl(on) {
    crawling = on;
    player.eyeOverride = on ? 0.5 : null;
  }

  function resetBody() {
    setCarry(null);
    setCrawl(false);
    player.autoRun = false;
    player.speedScale = 1;
    player.positionLocked = false;
    hud.setDrill(null);
  }

  /** Runs every frame during a drill. `staffName` shouts if you stop. */
  function effort(dt, { drain = 3.2, staffName = 'המגבש', idleLimit = 4.5 } = {}) {
    const moved = player.movedThisFrame;
    const ground = height(player.x, player.z);
    const uphill = moved > 0.001 && ground > lastGround + 0.002;
    lastGround = ground;

    if (moved > 0.001) {
      let rate = drain;
      if (carrying === 'sandbag') rate *= 1.9;
      if (carrying === 'jerrycan') rate *= 1.4;
      if (crawling) rate *= 1.5;
      if (uphill) rate *= 1.4;
      stamina = Math.max(0, stamina - rate * dt);
      idle = 0;
    } else {
      stamina = Math.min(100, stamina + 9 * dt);
      idle += dt;
      if (idle > idleLimit) {
        idle = 0;
        stats.stops++;
        ui.toast(`${staffName}: מספר ${game.state.bib}! ${SHOUTS[Math.floor(Math.random() * SHOUTS.length)]}`, 2600);
      }
    }

    let scale = 1;
    if (carrying === 'sandbag') scale *= 0.62;
    if (carrying === 'jerrycan') scale *= 0.74;
    if (crawling) scale *= 0.32;
    if (stamina < 20) scale *= 0.5 + (0.5 * stamina) / 20;
    player.speedScale = scale;
    hud.setStamina(stamina);
  }

  function rest(seconds = 3) {
    stamina = Math.min(100, stamina + seconds * 15);
    hud.setStamina(stamina);
  }

  async function countdown(text = 'זינוק!') {
    const before = hud.getDrill();
    for (const n of ['3', '2', '1']) {
      hud.setDrill(null, n);
      click();
      await new Promise((r) => setTimeout(r, 650));
    }
    chime();
    ui.announce(text);
    hud.setDrill(before?.title ?? null, before?.info ?? '');
  }

  function whistle() {
    play('whistle', { volume: 0.85 });
  }

  /** Ask for "number and lap" after each lap; the HUD never shows the lap count. */
  async function report(lap, staffName) {
    const wrong = lap > 1 ? [lap + 1, lap - 1] : [lap + 1, lap + 2];
    const options = shuffle([lap, ...wrong]);
    const choice = await ui.talk(staffName, 'מספר וסיבוב?', options.map((n) => `${game.state.bib}, סיבוב ${n}`));
    const correct = options[choice] === lap;
    ui.toast(`${staffName}: רשמתי. ממשיכים!`, 1500);
    return correct;
  }

  function near(target, radius) {
    return Math.hypot(player.x - target.x, player.z - target.z) < radius;
  }

  function lineUp(yaw = 0) {
    player.teleport(0, DUNE.startZ + 1.2, yaw);
    people.teammates.forEach((person, i) => {
      if (person.info.out) return;
      person.group.visible = true;
      person.carry(null);
      person.stop('stand');
      person.place(laneX(i), DUNE.startZ + 1.2, Math.PI);
    });
  }

  // ---------- Threshold run (1,200 m) ----------

  async function thresholdRun() {
    const start = SPOTS.runStart;
    const turn = SPOTS.runTurn;
    const scale = 1200 / (2 * Math.abs(start.x - turn.x)); // Game meters → real meters.
    const limit = 300; // 5:00 for 1,200 m.

    player.teleport(start.x - 0.8, start.z, Math.PI / 2);
    const runners = [...people.others.slice(0, 8), ...people.teammates.slice(0, 6)];
    runners.forEach((person, i) => {
      person.group.visible = true;
      person.carry(null);
      person.stop('stand');
      person.place(start.x - 0.8 + (i % 2) * 0.6, start.z - 1.4 + (i % 7) * 0.45, -Math.PI / 2);
    });

    hud.setDrill('ריצת סף · 1,200 מ׳', 'ריצה עד הדגל הכתום וחזרה');
    await countdown();
    player.autoRun = true;
    runners.forEach((person) => {
      const speed = between(3.4, 4.6);
      person.walkTo([{ x: turn.x + 0.5, z: person.position.z }, { x: start.x - 3, z: person.position.z + between(-0.6, 0.6) }], {
        speed,
        pose: 'hands-on-knees',
      });
    });

    let time = 0;
    let turned = false;
    await game.waitUntil((dt) => {
      if (ui.modalOpen) return false;
      time += dt;
      effort(dt, { drain: 2.1, staffName: 'המגבש הראשי', idleLimit: 6 });
      if (!turned && near(turn, 3)) {
        turned = true;
        ui.toast('600 מטר. עכשיו חזרה!', 1500);
      }
      const covered = turned ? 600 + (player.x - turn.x) * scale : (start.x - player.x) * scale;
      const meters = THREE.MathUtils.clamp(Math.round(covered / 10) * 10, 0, 1200);
      const shown = time * scale;
      hud.setDrill('ריצת סף · 1,200 מ׳', `${meters} מ׳ · ${formatTime(shown)}`);
      return turned && player.x >= start.x - 0.5;
    });

    const realTime = time * scale;
    resetBody();
    rest(6);
    stats.run = { time: realTime, passed: realTime <= limit };
    return stats.run;
  }

  // ---------- Lap drills: the combined drill and the tzukon ----------

  async function lapDrill(kind, duration, staffName) {
    lineUp();
    const title = kind === 'combined' ? 'מקצה משולב' : 'צוקון';
    hud.setDrill(title, kind === 'combined' ? 'זחילה ← שק ← קונוס למעלה ← שק ← ספרינט לקו' : 'שק על השכמות ← קונוס למעלה ← חזרה לקו');
    await countdown('זינוק! ממשיכים עד שאומרים עצור');

    let active = true;
    const npcLaps = [];
    people.teammates.forEach((person, i) => {
      if (person.info.out) return;
      const x = laneX(i);
      const cone = nearestCone(x);
      const top = { x: cone.x + (x > cone.x ? 0.9 : -0.9), z: cone.z - 0.6 };
      const steps =
        kind === 'combined'
          ? [
              { to: { x, z: DUNE.crawlEndZ }, speed: 1.15, moving: 'crawl' },
              { to: { x, z: DUNE.bagRowZ }, speed: 2.6 },
              { to: top, speed: 2.2, carry: 'sandbag' },
              { to: { x, z: DUNE.bagRowZ }, speed: 2.9, carry: 'sandbag' },
              { to: { x, z: DUNE.startZ + 1 }, speed: 4.2 },
            ]
          : [
              { to: top, speed: 2.1, carry: 'sandbag' },
              { to: { x, z: DUNE.startZ + 1 }, speed: 2.8, carry: 'sandbag' },
            ];
      const quitter = kind === 'tzukon' && person.info.trait === 'quitter';
      const laps = loop(person, steps, {
        active: () => active,
        stopWhen: quitter ? (lap) => lap >= 2 : null,
        onStop: (p) => {
          p.carry(null);
          p.walkTo([{ x: -15.5, z: 3 }], { pose: 'sit-ground', speed: 1.1 });
          p.info.out = true;
          ui.toast(`${p.name} עצר וישב בצד.`, 2600);
        },
      });
      npcLaps.push({ person, laps });
    });

    player.autoRun = true;
    if (kind === 'tzukon') setCarry('sandbag');
    let lap = 0;
    let timeLeft = duration;
    const reports = [];
    const tick = (dt) => {
      if (ui.modalOpen) return;
      timeLeft -= dt;
      effort(dt, { staffName });
    };
    const until = (cond) => game.waitUntil((dt) => {
      tick(dt);
      return timeLeft <= 0 || cond();
    });

    while (timeLeft > 0) {
      if (kind === 'combined') {
        // Get down and crawl to the end of the crawl lane.
        await until(() => player.z < DUNE.startZ - 0.2);
        if (timeLeft <= 0) break;
        setCrawl(true);
        await until(() => player.z <= DUNE.crawlEndZ);
        setCrawl(false);
        if (timeLeft <= 0) break;
        await until(() => player.z <= DUNE.bagRowZ + 0.4);
        if (timeLeft <= 0) break;
        setCarry('sandbag');
      }
      await until(() => DUNE.cones.some((c) => near(c, 2.2)));
      if (timeLeft <= 0) break;
      ui.toast('✓ הקפת את הקונוס. למטה!', 1200);
      if (kind === 'combined') {
        await until(() => player.z >= DUNE.bagRowZ - 0.3);
        if (timeLeft <= 0) break;
        setCarry(null);
      }
      await until(() => player.z >= DUNE.startZ);
      if (timeLeft <= 0) break;
      lap++;
      reports.push(await report(lap, staffName));
    }

    active = false;
    whistle();
    ui.announce('עצור! סוף מקצה');
    resetBody();
    rest(8);
    // Everyone stops where they are and catches their breath.
    for (const { person } of npcLaps) {
      if (person.info.out) continue;
      person.carry(null);
      person.stop('hands-on-knees');
    }
    const others = npcLaps.filter(({ person }) => person.info.trait !== 'quitter').map(({ laps }) => laps());
    const average = others.reduce((a, b) => a + b, 0) / Math.max(1, others.length);
    const result = { laps: lap, average: Math.round(average * 10) / 10, correct: reports.filter(Boolean).length, reports: reports.length };
    stats[kind] = result;
    return result;
  }

  // ---------- Sociometric stretcher ----------

  function makeStretcher() {
    const group = new THREE.Group();
    for (const side of [-0.32, 0.32]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 6), world.metalMaterial);
      pole.rotation.x = Math.PI / 2;
      pole.position.set(side, 0, 0);
      group.add(pole);
    }
    const bed = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 1.8), world.oliveMaterial);
    group.add(bed);
    for (let i = 0; i < 3; i++) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), world.sandbagMaterial);
      bag.position.set(0, 0.11, -0.55 + i * 0.55);
      group.add(bag);
    }
    game.scene.add(group);
    return group;
  }

  async function stretcherDrill(rounds, staffName) {
    const results = [];
    const stretcher = makeStretcher();
    stretcher.visible = false;

    for (let round = 1; round <= rounds; round++) {
      lineUp();
      hud.setDrill(`אלונקה סוציומטרית · מקצה ${round}`, 'ספרינט עד הקונוס וחזרה. הראשונים מרימים אלונקה');
      await countdown();
      player.autoRun = true;

      // Sprint up and back; record who finishes when.
      const finishes = [];
      let elapsed = 0;
      const runners = people.teammates.filter((p) => !p.info.out);
      runners.forEach((person) => {
        const x = laneX(people.teammates.indexOf(person));
        const cone = nearestCone(x);
        const speed = between(3.2, 4.4) * person.fitness;
        person.walkTo([{ x: cone.x + (x > cone.x ? 0.9 : -0.9), z: cone.z - 0.5 }, { x, z: DUNE.startZ + 1 }], {
          speed,
          pose: 'hands-on-knees',
          onArrive: () => finishes.push({ person, time: elapsed }),
        });
      });
      let touched = false;
      await game.waitUntil((dt) => {
        if (ui.modalOpen) return false;
        elapsed += dt;
        effort(dt, { staffName });
        if (!touched && DUNE.cones.some((c) => near(c, 2.2))) {
          touched = true;
          ui.toast('✓ קונוס. חזרה לקו!', 1000);
        }
        return touched && player.z >= DUNE.startZ;
      });
      const rank = finishes.length + 1;
      const order = [...finishes.map((f) => f.person)];
      // Whoever is still running stops here; they finished after the player.
      for (const person of runners) person.stop('stand');
      // People still running finish after the player.
      for (const person of runners) if (!order.includes(person)) order.push(person);

      let role;
      if (rank <= 4) role = 'stretcher';
      else if (rank <= 6) role = 'jerrycan';
      else role = 'extra';
      const roleText = { stretcher: 'אתה בין הארבעה הראשונים: מרימים את האלונקה!', jerrycan: 'מקום חמישי או שישי: לוקחים ג׳ריקן לסיבוב נוסף.', extra: 'עוד סיבוב, בלי ציוד. לא עוצרים!' }[role];
      ui.announce(`הגעת ${rank}`, roleText);

      // NPC roles for the second lap.
      const bearers = order.filter((_, i) => i < 4 && i !== rank - 1).slice(0, role === 'stretcher' ? 3 : 4);
      const canCarriers = order.filter((p) => !bearers.includes(p)).slice(0, role === 'jerrycan' ? 1 : 2);
      const rest = order.filter((p) => !bearers.includes(p) && !canCarriers.includes(p));

      // Stretcher path: up the middle to the crest and back.
      const path = [new THREE.Vector2(0, DUNE.startZ + 0.5), new THREE.Vector2(0, DUNE.crestZ + 1.5), new THREE.Vector2(0, DUNE.startZ + 0.5)];
      const total = path[0].distanceTo(path[1]) + path[1].distanceTo(path[2]);
      let progress = 0;
      let held = 0;
      let heldTotal = 0;
      let helped = false;
      stretcher.visible = true;
      const corners = [
        [-0.45, 1.15],
        [0.45, 1.15],
        [-0.45, -1.15],
        [0.45, -1.15],
      ];
      const playerCorner = role === 'stretcher' ? 1 : -1;

      canCarriers.forEach((person) => {
        const x = person.position.x;
        const cone = nearestCone(x);
        person.carry('jerrycan');
        person.walkTo([{ x: cone.x + 0.9, z: cone.z - 0.5 }, { x, z: DUNE.startZ + 1 }], { speed: 2.4 * person.fitness, pose: 'hands-on-knees' });
      });
      rest.forEach((person) => {
        const x = person.position.x;
        const cone = nearestCone(x);
        person.carry(null);
        person.walkTo([{ x: cone.x - 0.9, z: cone.z - 0.5 }, { x, z: DUNE.startZ + 1 }], { speed: 3.0 * person.fitness, pose: 'hands-on-knees' });
      });
      if (role === 'jerrycan') setCarry('jerrycan');
      if (role === 'stretcher') {
        player.positionLocked = true;
        ui.toast('תחזיק קדימה (W / ג׳ויסטיק) כדי לסחוב איתם', 2600);
      }

      let playerTouched = false;
      await game.waitUntil((dt) => {
        if (ui.modalOpen) return false;
        // Move the stretcher; it goes faster when the player pushes too.
        const pushing = role === 'stretcher' ? (player.input?.forward ?? 0) > 0.2 : true;
        if (role === 'stretcher') {
          heldTotal += dt;
          if (pushing) held += dt;
          if (!pushing && !helped && heldTotal > 4) {
            helped = true;
            const helper = people.teammates.find((p) => p.info.trait === 'helper');
            ui.toast(`${helper?.name ?? 'נועם'}: יאללה, אני איתך! תחזיק!`, 2600);
          }
        }
        const uphill = progress < path[0].distanceTo(path[1]);
        const speed = (uphill ? 1.25 : 1.7) * (pushing ? 1 : 0.4);
        progress = Math.min(total, progress + speed * dt);
        const legA = path[0].distanceTo(path[1]);
        const [from, to, local] = progress < legA ? [path[0], path[1], progress / legA] : [path[1], path[2], (progress - legA) / (total - legA)];
        const sx = THREE.MathUtils.lerp(from.x, to.x, local);
        const sz = THREE.MathUtils.lerp(from.y, to.y, local);
        const heading = Math.atan2(to.x - from.x, to.y - from.y);
        stretcher.position.set(sx, height(sx, sz) + 0.85, sz);
        stretcher.rotation.y = heading;
        const sin = Math.sin(heading);
        const cos = Math.cos(heading);
        const cornerAt = ([cx, cz]) => ({ x: sx + cx * cos + cz * sin, z: sz - cx * sin + cz * cos });
        let npcIndex = 0;
        corners.forEach((corner, i) => {
          const p = cornerAt(corner);
          if (i === playerCorner) {
            player.x = p.x;
            player.z = p.z;
            return;
          }
          const bearer = bearers[npcIndex++];
          if (!bearer) return;
          bearer.carry('jerrycan');
          bearer.place(p.x, p.z, heading);
          bearer.speed = speed;
          bearer.setPose('walk');
        });

        if (role === 'stretcher') {
          effort(dt, { staffName, drain: 4, idleLimit: 99 });
        } else {
          effort(dt, { staffName });
          if (!playerTouched && DUNE.cones.some((c) => near(c, 2.2))) {
            playerTouched = true;
            ui.toast('✓ קונוס. חזרה!', 1000);
          }
        }
        const stretcherDone = progress >= total;
        const playerDone = role === 'stretcher' ? stretcherDone : playerTouched && player.z >= DUNE.startZ;
        return stretcherDone && playerDone;
      });

      bearers.forEach((p) => {
        p.carry(null);
        p.stop('hands-on-knees');
      });
      stretcher.visible = false;
      resetBody();
      rest(10);
      results.push({ rank, role, held: role === 'stretcher' ? held / Math.max(1, heldTotal) : 1 });
      if (round < rounds) {
        ui.announce('מנוחה', 'עוד מקצה אחד');
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
    stretcher.removeFromParent();
    stats.stretcher = results;
    return results;
  }

  // ---------- Digging ----------

  async function digDrill(duration, staffName, onChange) {
    const spot = { x: SPOTS.dig.x - 1.5, z: SPOTS.dig.z };
    player.teleport(spot.x, spot.z + 1.1, 0);
    player.pitch = -0.75;
    // Three teammates dig in the other squares (one of them never stops).
    const diggers = people.teammates.filter((p) => !p.info.out && p.info.trait !== 'quitter').slice(0, 3);
    if (!diggers.some((p) => p.info.trait === 'steady')) diggers[2] = people.teammates.find((p) => p.info.trait === 'steady');
    [-4.5, 1.5, 4.5].forEach((dx, i) => {
      const person = diggers[i];
      if (!person) return;
      person.group.visible = true;
      person.carry(null);
      person.place(SPOTS.dig.x + dx, spot.z + 0.9, Math.PI).setPose('dig');
    });
    const steady = diggers.find((p) => p?.info.trait === 'steady');
    setTimeout(() => steady && ui.toast(`${steady.name} חופר בלי לעצור לרגע.`, 2400), 12000);

    const hole = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 1 }));
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(spot.x, height(spot.x, spot.z) + 0.03, spot.z);
    game.scene.add(hole);
    const pile = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.6, 12), new THREE.MeshStandardMaterial({ color: '#cfae7c', roughness: 1 }));
    pile.position.set(spot.x + 1.1, height(spot.x + 1.1, spot.z), spot.z);
    pile.scale.setScalar(0.05);
    game.scene.add(pile);

    let depth = 0;
    let length = 1;
    let task = 'pit'; // then 'trench'
    let actions = 0;
    let changed = false;
    let busy = false;
    const target = () => (task === 'pit' ? 'בור: מטר על מטר, עומק מטר' : 'תעלה: אורך 2 מטר, עומק חצי מטר');

    hud.setDrill('חפירת בור', `${target()} · לחץ "פעולה" / E כדי לחפור`);
    await countdown('חופרים!');

    game.onAction = () => {
      if (busy || ui.modalOpen) return;
      if (stamina < 4) {
        ui.toast('אין כוח… נשום רגע ותמשיך', 1200);
        return;
      }
      actions++;
      stamina = Math.max(0, stamina - 3.2);
      const power = 0.5 + stamina / 200;
      if (task === 'pit') depth = Math.min(1, depth + 0.028 * power);
      else length = Math.min(2, length + 0.04 * power);
      playRandom('dig', 6, { volume: 0.8, rate: 0.95 + Math.random() * 0.1 });
      hole.material.color.setHSL(0.09, 0.35, THREE.MathUtils.lerp(0.4, 0.14, Math.min(1, depth)));
      // The trench grows to the left of the pit (the dirt pile is on the right).
      hole.scale.set(length, 1, 1);
      hole.position.x = spot.x - (length - 1) / 2;
      pile.scale.setScalar(0.05 + Math.min(1.4, actions * 0.02));
      hud.setDrill('חפירת בור', task === 'pit' ? `עומק: ${Math.round(depth * 100)} ס״מ מתוך 100` : `אורך תעלה: ${length.toFixed(1)} מ׳ מתוך 2`);
    };

    let timeLeft = duration;
    let idleTime = 0;
    let lastActions = 0;
    await game.waitUntil((dt) => {
      if (ui.modalOpen) return false;
      timeLeft -= dt;
      stamina = Math.min(100, stamina + 3 * dt);
      hud.setStamina(stamina);
      idleTime = actions === lastActions ? idleTime + dt : 0;
      lastActions = actions;
      if (idleTime > 4) {
        idleTime = 0;
        stats.stops++;
        ui.toast(`${staffName}: מספר ${game.state.bib}, ממשיכים לחפור!`, 2200);
      }
      if (!changed && task === 'pit' && depth >= 0.55) {
        changed = true;
        busy = true;
        onChange().then(() => {
          task = 'trench';
          busy = false;
          hud.setDrill('חפירה: משימה חדשה', `${target()} · לחץ "פעולה" / E`);
        });
      }
      return timeLeft <= 0;
    });

    game.onAction = null;
    whistle();
    ui.announce('עצור! הניחו את האתים');
    people.teammates.forEach((p) => p.setPose('stand'));
    resetBody();
    stats.dig = { actions, perSecond: actions / duration, depth, length };
    setTimeout(() => {
      hole.removeFromParent();
      pile.removeFromParent();
    }, 15000);
    return stats.dig;
  }

  // ---------- Sandbag pyramid ----------

  async function pyramid() {
    const site = SPOTS.pyramid;
    const pile = SPOTS.pile;
    const slots = [];
    [4, 3, 2, 1].forEach((count, row) => {
      for (let i = 0; i < count; i++) slots.push({ x: (i - (count - 1) / 2) * 0.54, y: 0.1 + row * 0.21 });
    });
    const placed = [];
    const place = () => {
      const slot = slots[placed.length];
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.2, 0.32), world.sandbagMaterial);
      bag.position.set(site.x + slot.x, height(site.x, site.z) + slot.y, site.z);
      game.scene.add(bag);
      placed.push(bag);
      click();
      hud.setDrill('פירמידת שקים', `${placed.length} מתוך ${slots.length} שקים`);
    };

    player.teleport(site.x + 2, site.z + 2.5, Math.PI / 4);
    hud.setDrill('פירמידת שקים', `0 מתוך ${slots.length} שקים · קח שק מהערימה (פעולה / E) והנח בפירמידה`);

    // Teammates carry too.
    let active = true;
    const workers = people.teammates.filter((p) => !p.info.out).slice(0, 3);
    workers.forEach((person, i) => {
      person.group.visible = true;
      person.place(pile.x + i * 0.6, pile.z - 1.4, 0);
      loop(
        person,
        [
          { to: { x: pile.x + (i - 1) * 0.6, z: pile.z - 1.1 }, speed: 1.6 },
          { to: { x: site.x + (i - 1) * 0.5, z: site.z - 1.0 }, speed: 1.3, carry: 'sandbag' },
        ],
        {
          active: () => active,
          onLap: () => {
            if (active && placed.length < slots.length) place();
          },
          fatigue: 0,
        },
      );
    });

    let holding = false;
    let carried = 0;
    game.onAction = () => {
      if (!holding && Math.hypot(player.x - pile.x, player.z - pile.z) < 2.6) {
        holding = true;
        setCarry('sandbag');
        click();
      } else if (holding && Math.hypot(player.x - site.x, player.z - site.z) < 2.4) {
        holding = false;
        setCarry(null);
        carried++;
        if (placed.length < slots.length) place();
      } else {
        ui.toast(holding ? 'צריך להתקרב לפירמידה' : 'צריך להתקרב לערימת השקים', 1200);
      }
    };
    game.setTarget(() => (holding ? { x: site.x, y: height(site.x, site.z) + 2, z: site.z } : { x: pile.x, y: height(pile.x, pile.z) + 2, z: pile.z }));

    await game.waitUntil((dt) => {
      if (!ui.modalOpen) effort(dt, { drain: 1.6, idleLimit: 99 });
      player.speedScale = holding ? 0.7 : 1;
      return placed.length >= slots.length;
    });

    active = false;
    game.onAction = null;
    game.setTarget(null);
    workers.forEach((p) => {
      p.carry(null);
      p.stop('stand');
    });
    resetBody();
    stats.pyramid = { carried };
    return stats.pyramid;
  }

  return {
    thresholdRun,
    lapDrill,
    stretcherDrill,
    digDrill,
    pyramid,
    resetBody,
    rest,
    stats,
    get stamina() {
      return stamina;
    },
  };
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
