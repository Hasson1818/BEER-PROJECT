import * as THREE from 'three';
import { SPOTS, MARCH, RACK, height } from './world.js';
import { active, rackSlot } from './team.js';
import { MY_NUMBER, STAFF_LINES } from './content.js';
import { beep, chime, click } from '../../shared/engine/audio.js';

const between = (a, b) => a + Math.random() * (b - a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const LANE_GAP = 0.82;

/**
 * Physical parts of the gibbush. Effort is modelled with stamina, like in
 * יום סיירות: moving drains it, standing restores it, and a tired player slows down.
 * The staff here don't shout or encourage (that's how the Air Force describes
 * the gibbush), they just note it.
 */
export function createDrills(game) {
  const { player, ui, people, world, hud, state } = game;
  const stats = { stops: 0 };
  let stamina = 100;
  let carrying = null;
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
    player.eyeOverride = null;
    document.body.classList.remove('eyes-closed');
    hud.setDrill(null);
  }

  function note(staffName, text) {
    ui.toast(`${staffName}: ${text}`, 2200);
  }

  /** Runs every frame during a drill. */
  function effort(dt, { drain = 3, staffName = 'המ״כ', idleLimit = 5 } = {}) {
    const moved = player.movedThisFrame;
    const ground = height(player.x, player.z);
    const uphill = moved > 0.001 && ground > lastGround + 0.002;
    lastGround = ground;

    if (moved > 0.001) {
      let rate = drain;
      if (carrying === 'sandbag') rate *= 1.8;
      if (carrying === 'kitbag') rate *= 1.3;
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
        note(staffName, `${MY_NUMBER}, ${STAFF_LINES[Math.floor(Math.random() * STAFF_LINES.length)]}`);
      }
    }

    let scale = 1;
    if (carrying === 'sandbag') scale *= 0.62;
    if (carrying === 'kitbag') scale *= 0.78;
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
      await wait(600);
    }
    chime();
    ui.announce(text);
    hud.setDrill(before?.title ?? null, before?.info ?? '');
  }

  function whistle() {
    beep();
    setTimeout(beep, 180);
  }

  const near = (target, radius) => Math.hypot(player.x - target.x, player.z - target.z) < radius;

  // ---------- Screening run: 1,000 m ----------

  async function screeningRun() {
    const start = SPOTS.runStart;
    const turn = SPOTS.runTurn;
    const scale = 1000 / (2 * Math.abs(start.x - turn.x)); // Game meters → real meters.
    const limit = 300; // About 5:00 for boys, according to the debriefs.

    player.teleport(start.x - 0.8, start.z, Math.PI / 2);
    const runners = [...active(people), ...people.others.slice(0, 10)];
    // Runners start in two blocks beside your lane, so nobody stands in your way.
    runners.forEach((person, i) => {
      person.group.visible = true;
      person.carry(null);
      person.stop('stand');
      const side = i % 2 ? 1 : -1;
      person.place(start.x - 0.8 + Math.floor(i / 6) * 0.8, start.z + side * (0.9 + (Math.floor(i / 2) % 3) * 0.55), -Math.PI / 2);
    });

    hud.setDrill('ריצת ניפוי · 1,000 מ׳', 'עד הקונוס הכתום וחזרה');
    await countdown();
    player.autoRun = true;
    runners.forEach((person, i) => {
      const speed = between(3.5, 4.5) * person.fitness;
      const z = person.position.z;
      // After the finish line they step off the road to catch their breath.
      person.walkTo([{ x: turn.x + 0.6, z }, { x: start.x + 1, z }, { x: start.x + 2 + (i % 4) * 0.7, z: start.z + (z > start.z ? 3.5 : -3.5) }], {
        speed,
        pose: 'hands-on-knees',
      });
    });

    let time = 0;
    let turned = false;
    await game.waitUntil((dt) => {
      if (ui.modalOpen) return false;
      time += dt;
      effort(dt, { drain: 1.6, staffName: people.staff.mc.name, idleLimit: 6 });
      if (!turned && near(turn, 3)) {
        turned = true;
        ui.toast('500 מטר. חזרה!', 1500);
      }
      const covered = turned ? 500 + (player.x - turn.x) * scale : (start.x - player.x) * scale;
      const meters = THREE.MathUtils.clamp(Math.round(covered / 10) * 10, 0, 1000);
      hud.setDrill('ריצת ניפוי · 1,000 מ׳', `${meters} מ׳ · ${formatTime(time * scale)}`);
      return turned && player.x >= start.x - 0.5;
    });

    const realTime = time * scale;
    resetBody();
    rest(6);
    stats.run = { time: realTime, passed: realTime <= limit };
    return stats.run;
  }

  // ---------- Crawl heats ("סדרי הגעה") ----------

  /**
   * Crawl from the start line to the row of sandbags and back, `heats` times.
   * Ranked by arrival. Holding Shift lifts your backside: faster, but against the rules.
   */
  async function crawlHeats(heats, { staffName, title = 'זחילות · סדרי הגעה' } = {}) {
    const cx = SPOTS.crawlStart.x;
    const startZ = SPOTS.crawlStart.z;
    const bagZ = SPOTS.crawlBag.z + 0.7;
    const list = active(people);
    const laneOf = (i) => cx + (i - list.length / 2) * LANE_GAP;
    const myLane = laneOf(MY_NUMBER - 1);
    const results = [];
    let cheated = 0;
    let warned = false;

    for (let heat = 1; heat <= heats; heat++) {
      // Line up lying down on the start line.
      let s = 0;
      list.forEach((person) => {
        if (s === MY_NUMBER - 1) s++;
        person.group.visible = true;
        person.carry(null);
        person.place(laneOf(s++), startZ + 0.6, Math.PI).setPose('crawl');
      });
      player.teleport(myLane, startZ + 0.6, 0);
      setCrawl(true);
      hud.setDrill(`${title} · מקצה ${heat}`, 'זוחלים עד השקים וחזרה לקו');
      await countdown();
      if (!warned && !player.touch) {
        warned = true;
        ui.toast('Shift = להרים ישבן. מהר יותר, אבל אסור', 3200);
      }
      player.autoRun = true;

      const finishes = [];
      let elapsed = 0;
      list.forEach((person) => {
        const x = person.position.x;
        const speed = between(1.15, 1.45) * person.fitness * Math.max(0.7, 1 - heat * 0.04);
        person.walkTo([{ x, z: bagZ }, { x: x + 0.01, z: startZ + 0.6 }], {
          speed,
          moving: 'crawl',
          pose: 'hands-on-knees',
          facing: Math.PI,
          onArrive: () => finishes.push({ person, time: elapsed }),
        });
      });

      let turned = false;
      let lifted = 0;
      await game.waitUntil((dt) => {
        if (ui.modalOpen) return false;
        elapsed += dt;
        effort(dt, { drain: 2.2, staffName });
        const lifting = player.keys.has('ShiftLeft') || player.keys.has('ShiftRight');
        if (lifting && player.movedThisFrame > 0.001) {
          lifted += dt;
          player.speedScale *= 1.45;
        }
        if (!turned && player.z <= bagZ + 0.6) {
          turned = true;
          ui.toast('✓ השקים. חזרה לקו!', 900);
        }
        return turned && player.z >= startZ + 0.4;
      });
      const rank = finishes.length + 1;
      for (const person of list) if (person.walking) person.stop('hands-on-knees');
      setCrawl(false);
      player.autoRun = false;
      const broke = lifted > 0.6;
      if (broke) {
        cheated++;
        game.violation('crawl', 'הרמת ישבן בזחילה');
      }
      results.push({ rank, broke });
      ui.announce(`הגעת ${rank} מתוך ${list.length + 1}`, broke ? 'הרמת ישבן. לפי הכללים, מקצה עם הפרה לא נספר.' : 'לשורה לפי סדר ההגעה');
      rest(5);
      await wait(1600);
    }
    resetBody();
    const counted = results.filter((r) => !r.broke);
    const result = {
      heats: results.length,
      average: counted.length ? counted.reduce((a, r) => a + r.rank, 0) / counted.length : 16,
      best: Math.min(...results.map((r) => r.rank)),
      cheated,
    };
    (stats.crawls ??= []).push(result);
    return result;
  }

  // ---------- Plum rack ----------

  function hangPerson(person, slot) {
    person.group.visible = true;
    person.carry(null);
    person.place(slot.x, slot.z, slot.facing).setPose('hang');
    person.group.position.y += 0.42;
  }

  function dropPerson(person) {
    person.setPose('hands-on-knees');
    person.group.position.y = height(person.position.x, person.position.z);
  }

  /** One personal hang. Tap "פעולה" to keep your grip; it gets harder over time. */
  async function personalHang(outward) {
    const list = active(people);
    const slots = [];
    let s = 0;
    for (const person of list) {
      if (s === MY_NUMBER - 1) s++;
      const slot = rackSlot(s++, outward);
      slots.push(slot);
      hangPerson(person, slot);
      person.fallAt = between(18, 46) * person.fitness * (person.info.trait === 'quitter' ? 0.6 : 1);
      person.fallen = false;
    }
    const mine = rackSlot(MY_NUMBER - 1, outward);
    player.teleport(mine.x, mine.z, 0);
    player.faceTowards(outward ? 2 * mine.x - RACK.x : RACK.x, outward ? 2 * mine.z - RACK.z : RACK.z, 2.1);
    player.positionLocked = true;
    player.eyeOverride = 2.12;
    if (outward) document.body.classList.add('eyes-closed');

    let grip = 100;
    let t = 0;
    let fallenBefore = 0;
    game.onAction = () => {
      grip = Math.min(100, grip + 5 * Math.max(0.2, 1 - t / 45));
      click();
    };
    hud.setDrill(outward ? 'מתלה שזיפים · פנים החוצה, עיניים עצומות' : 'מתלה שזיפים · פנים פנימה', 'לחץ "פעולה" / E שוב ושוב כדי להחזיק');
    await game.waitUntil((dt) => {
      if (ui.modalOpen) return false;
      t += dt;
      grip -= 9 * dt;
      hud.setGrip(grip);
      for (const person of list) {
        if (!person.fallen && t >= person.fallAt) {
          person.fallen = true;
          dropPerson(person);
          fallenBefore++;
          if (outward) click();
        }
      }
      return grip <= 0;
    });
    game.onAction = null;
    hud.setGrip(null);
    const rank = list.length + 1 - fallenBefore; // 1 = last to fall.
    // Everyone else lets go too.
    for (const person of list) if (!person.fallen) dropPerson(person);
    player.positionLocked = false;
    player.eyeOverride = null;
    document.body.classList.remove('eyes-closed');
    return { time: t, fellBefore: fallenBefore, rank };
  }

  /**
   * Group hang: at least `minimum` of the class must hang at every moment.
   * "פעולה" switches between hanging and resting; grip drains while you hang.
   */
  async function groupHang(duration = 45, minimum = 9) {
    const list = active(people);
    let s = 0;
    const slots = new Map();
    for (const person of list) {
      if (s === MY_NUMBER - 1) s++;
      const slot = rackSlot(s++, false);
      slots.set(person, slot);
      hangPerson(person, slot);
      person.grip = between(70, 100);
      person.hanging = true;
    }
    const mine = rackSlot(MY_NUMBER - 1, false);
    player.teleport(mine.x, mine.z, 0);
    player.faceTowards(RACK.x, RACK.z, 2.1);
    player.positionLocked = true;

    let hanging = true;
    let grip = 100;
    let t = 0;
    let resets = 0;
    let critical = 0; // Times you got back up when the class was at the limit.
    let restedWhenSafe = 0;
    game.onAction = () => {
      if (hanging) {
        hanging = false;
        const count = list.filter((p) => p.hanging).length + 1;
        if (count - 1 >= minimum + 2) restedWhenSafe++;
      } else if (grip > 10) {
        hanging = true;
        const count = list.filter((p) => p.hanging).length;
        if (count <= minimum) critical++;
      }
      click();
    };
    hud.setDrill('מתלה קבוצתי', `פעולה / E: לתלות או לנוח · לפחות ${minimum} תלויים כל הזמן`);
    await game.waitUntil((dt) => {
      if (ui.modalOpen) return false;
      t += dt;
      // You.
      if (hanging) {
        grip -= 6 * dt;
        if (grip <= 0) {
          grip = 0;
          hanging = false;
          ui.toast('הידיים נפתחו. נח רגע', 1400);
        }
      } else {
        grip = Math.min(100, grip + 14 * dt);
      }
      player.eyeOverride = hanging ? 2.12 : null;
      hud.setGrip(grip);
      // The class.
      let count = (hanging ? 1 : 0) + list.filter((p) => p.hanging).length;
      for (const person of list) {
        if (person.hanging) {
          person.grip -= (5 + (person.info.trait === 'quitter' ? 3 : 0)) * dt / person.fitness;
          const careless = person.info.trait === 'hider' || person.info.trait === 'quitter';
          const canRest = count > minimum + (careless ? 0 : 1);
          if (person.grip <= 0 || (person.grip < 25 && canRest)) {
            person.hanging = false;
            dropPerson(person);
            count--;
          }
        } else {
          person.grip = Math.min(100, person.grip + 12 * dt);
          const needed = count <= minimum && person.grip > 30;
          if (person.grip > 85 || needed) {
            person.hanging = true;
            hangPerson(person, slots.get(person));
            count++;
          }
        }
      }
      hud.setDrill('מתלה קבוצתי', `תלויים: ${count} מתוך ${list.length + 1} · מינימום ${minimum} · ${formatTime(duration - t)}`);
      if (count < minimum) {
        resets++;
        t = 0;
        ui.announce(`רק ${count} תלויים`, 'ירדתם מתחת למינימום. מתחילים מחדש');
        for (const person of list) {
          person.hanging = true;
          person.grip = Math.max(person.grip, 60);
          hangPerson(person, slots.get(person));
        }
        hanging = grip > 20;
        if (resets >= 3) return true;
      }
      return t >= duration;
    });
    game.onAction = null;
    hud.setGrip(null);
    for (const person of list) dropPerson(person);
    resetBody();
    const result = { success: resets < 3, resets, critical, restedWhenSafe };
    stats.groupHang = result;
    return result;
  }

  async function plumRack(staffName) {
    const results = [];
    for (const outward of [false, true]) {
      await countdown('תלייה!');
      const r = await personalHang(outward);
      results.push(r);
      ui.announce(`החזקת ${Math.round(r.time)} שניות`, `${r.fellBefore} נפלו לפניך`);
      note(staffName, 'לשורה לפי סדר הנפילה.');
      rest(8);
      await wait(2200);
    }
    hud.setDrill(null);
    stats.rack = results;
    return results;
  }

  // ---------- "אדמה בוערת": running in place ----------

  async function burningGround(seconds, staffName) {
    const list = active(people);
    for (const p of list) p.setPose('run-place');
    let presses = 0;
    let gap = 0;
    let stops = 0;
    let t = 0;
    game.onAction = () => {
      presses++;
      gap = 0;
    };
    hud.setDrill('אדמה בוערת', 'ריצה במקום: לחץ "פעולה" / E בקצב קבוע');
    await game.waitUntil((dt) => {
      if (ui.modalOpen) return false;
      t += dt;
      gap += dt;
      player.eyeOverride = 1.6 + (gap < 0.6 ? Math.abs(Math.sin(t * 11)) * 0.07 : 0);
      if (gap > 1.4) {
        gap = 0;
        stops++;
        note(staffName, `${MY_NUMBER}, אדמה בוערת.`);
      }
      stamina = Math.max(0, stamina - 2 * dt);
      hud.setStamina(stamina);
      hud.setDrill('אדמה בוערת', `${Math.max(0, Math.ceil(seconds - t))}`);
      return t >= seconds;
    });
    game.onAction = null;
    for (const p of list) p.setPose('stand');
    resetBody();
    const result = { rate: presses / seconds, stops };
    (stats.burning ??= []).push(result);
    return result;
  }

  // ---------- Night march with all the gear ----------

  async function nightMarch(staffName) {
    const list = active(people);
    // The class walks in a column ahead of you.
    list.forEach((person, i) => {
      person.group.visible = true;
      person.place(MARCH[0].x - 1.2 * i * 0.3, MARCH[0].z + 1 + i * 1.3, 0);
      person.carry('kitbag');
      // In pairs along the route; at the end they stop in two rows.
      const last = MARCH.length - 2;
      person.walkTo(
        MARCH.slice(1).map((p, k) => ({ x: p.x + (i % 2 ? 0.6 : -0.6), z: p.z + (k === last ? Math.floor(i / 2) * 0.9 : 0) })),
        { speed: 1.55 + (i % 3) * 0.02, pose: 'stand' },
      );
    });
    people.staff.mc.group.visible = true;
    people.staff.mc.place(MARCH[0].x + 2, MARCH[0].z, 0).walkTo(MARCH.slice(1).map((p) => ({ x: p.x + 1.5, z: p.z - 1 })), { speed: 1.6 });
    player.teleport(MARCH[0].x, MARCH[0].z + 3 + list.length * 1.3, Math.PI);
    setCarry('kitbag');
    hud.setDrill('מסע לילה · כל ציוד השינה', 'שמור על קשר עין עם הטור');
    // The marker shows where the column is only when you fall behind.
    game.setTarget(() => {
      const last = list[list.length - 1];
      if (Math.hypot(player.x - last.position.x, player.z - last.position.z) < 7) return null;
      return { x: last.position.x, y: last.position.y + 2.3, z: last.position.z };
    });
    let behind = 0;
    let warnings = 0;
    const end = MARCH[MARCH.length - 1];
    await game.waitUntil((dt) => {
      if (ui.modalOpen) return false;
      effort(dt, { drain: 0.7, staffName, idleLimit: 8 });
      const last = list[list.length - 1];
      const gapToColumn = Math.hypot(player.x - last.position.x, player.z - last.position.z);
      if (gapToColumn > 10) {
        behind += dt;
        if (behind > 4) {
          behind = 0;
          warnings++;
          note(staffName, `${MY_NUMBER}, להדביק את הטור.`);
        }
      } else {
        behind = 0;
      }
      return !last.walking && (near(end, 4) || gapToColumn < 5);
    });
    game.setTarget(null);
    resetBody();
    for (const p of list) p.carry(null);
    stats.march = { warnings };
    return stats.march;
  }

  // ---------- Walking tzukon: personal pile or class pile ----------

  async function tzukon(duration, staffName) {
    const fill = SPOTS.fill;
    const crest = SPOTS.crest;
    const myPile = { x: crest.x - 7 + 3 * 2, z: crest.z - 0.4 };
    const classPile = { x: crest.x + 10, z: crest.z - 0.4 };
    const pileMaterial = new THREE.MeshStandardMaterial({ color: '#e0c393', roughness: 1 });
    const makePile = (spot) => {
      const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.6, 12), pileMaterial);
      mesh.position.set(spot.x, height(spot.x, spot.z), spot.z);
      mesh.scale.setScalar(0.05);
      game.scene.add(mesh);
      return mesh;
    };
    const myMesh = makePile(myPile);
    const classMesh = makePile(classPile);
    let mine = 0;
    let shared = 0;
    let classTotal = 0;
    const grow = () => {
      myMesh.scale.setScalar(0.05 + Math.min(1.6, mine * 0.12));
      classMesh.scale.setScalar(0.05 + Math.min(3, classTotal * 0.035));
    };

    // Classmates: each one splits differently between "mine" and "the class".
    const generosity = { helper: 0.75, leader: 0.55, smart: 0.45, dominant: 0.2, quitter: 0.3, hider: 0.1, steady: 0.45 };
    const list = active(people);
    let running = true;
    list.forEach((person, i) => {
      person.trips = { mine: 0, shared: 0 };
      const peg = { x: crest.x - 7 + (i % 8) * 2 + 0.3, z: crest.z - 0.6 };
      person.place(fill.x - 4 + (i % 8), fill.z + 1.5 + Math.floor(i / 8), Math.PI);
      const go = () => {
        if (!running) return;
        const toClass = Math.random() < (generosity[person.info.trait] ?? 0.45);
        const target = toClass ? { x: classPile.x + between(-0.6, 0.6), z: classPile.z } : peg;
        person.carry('sandbag');
        person.walkTo([target], {
          speed: 1.25 * person.fitness * between(0.9, 1.05),
          onArrive: () => {
            if (!running) return;
            if (toClass) {
              person.trips.shared++;
              classTotal++;
              grow();
            } else {
              person.trips.mine++;
            }
            person.carry(null);
            person.walkTo([{ x: fill.x + between(-3, 3), z: fill.z + 1 }], { speed: 1.7 * person.fitness, onArrive: () => setTimeout(go, 700) });
          },
        });
      };
      setTimeout(go, between(0, 2500));
    });

    player.teleport(fill.x + 2, fill.z + 2.5, Math.PI);
    hud.setDrill('צוקון בהליכה', 'פעולה ליד ערימת החול: למלא שק · למעלה: לשפוך לערימה שלך או לכיתתית');
    await countdown('מתחילים. רק הליכה!');
    let holding = false;
    let filling = false;
    game.onAction = async () => {
      if (filling) return;
      if (!holding && near(fill, 5)) {
        filling = true;
        click();
        ui.toast('ממלא שק…', 900);
        await wait(900);
        filling = false;
        holding = true;
        setCarry('sandbag');
      } else if (holding && near(myPile, 2.4)) {
        holding = false;
        mine++;
        setCarry(null);
        click();
        grow();
      } else if (holding && near(classPile, 2.6)) {
        holding = false;
        shared++;
        classTotal++;
        setCarry(null);
        click();
        grow();
      } else {
        ui.toast(holding ? 'למעלה: לערימה שלך (מספר 7) או לערימה הכיתתית' : 'ממלאים שק בערימת החול למטה', 1600);
      }
    };
    game.setTarget(() => (holding ? null : { x: fill.x - 3.5, y: height(fill.x, fill.z) + 2.4, z: fill.z + 0.5 }));

    let t = 0;
    let ran = 0;
    await game.waitUntil((dt) => {
      if (ui.modalOpen) return false;
      t += dt;
      effort(dt, { drain: 1.6, staffName, idleLimit: 7 });
      // "Walking only": running here breaks a rule.
      if (player.keys.has('ShiftLeft') || player.keys.has('ShiftRight')) ran += dt;
      hud.setDrill('צוקון בהליכה', `שקים: ${mine} לערימה שלך · ${shared} לכיתתית`);
      return t >= duration;
    });
    running = false;
    game.onAction = null;
    game.setTarget(null);
    whistle();
    ui.announce('עצור!', 'מסדרים את הכיתה לפי מי שתרם הכי הרבה');
    for (const p of list) {
      p.carry(null);
      p.stop('hands-on-knees');
    }
    resetBody();
    if (ran > 1.5) game.violation('tzukon', 'רצתי בצוקון כשאמרו הליכה בלבד');
    const totals = list.map((p) => p.trips.mine + p.trips.shared);
    const myTotal = mine + shared;
    const rank = 1 + totals.filter((n) => n > myTotal).length;
    const result = { mine, shared, total: myTotal, rank, classTotal, average: totals.reduce((a, b) => a + b, 0) / Math.max(1, totals.length) };
    stats.tzukon = result;
    setTimeout(() => {
      myMesh.removeFromParent();
      classMesh.removeFromParent();
    }, 20000);
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
    const start = SPOTS.sprintStart;
    const coneSpot = SPOTS.sprintCone;
    const list = active(people);
    const stretcher = makeStretcher();
    stretcher.visible = false;
    const results = [];
    const laneX = (i) => start.x + (i - list.length / 2) * 0.5;
    // The loop the stretcher runs on the gravel.
    const path = [
      new THREE.Vector2(start.x, start.z - 1),
      new THREE.Vector2(start.x + 4.5, start.z - 9),
      new THREE.Vector2(start.x, start.z - 18),
      new THREE.Vector2(start.x - 4.5, start.z - 9),
      new THREE.Vector2(start.x, start.z - 1),
    ];
    const legs = path.slice(1).map((p, i) => p.distanceTo(path[i]));
    const total = legs.reduce((a, b) => a + b, 0);

    for (let round = 1; round <= rounds; round++) {
      let s = 0;
      list.forEach((person) => {
        if (s === MY_NUMBER - 1) s++;
        person.group.visible = true;
        person.carry(null);
        person.stop('stand');
        person.place(laneX(s++), start.z + 0.8, Math.PI);
      });
      player.teleport(laneX(MY_NUMBER - 1), start.z + 0.8, 0);
      hud.setDrill(`אלונקה סוציומטרית · מקצה ${round}`, 'ספרינט עד הקונוס וחזרה. ארבעת הראשונים מרימים אלונקה');
      await countdown();
      player.autoRun = true;

      const finishes = [];
      let elapsed = 0;
      list.forEach((person) => {
        const x = person.position.x;
        const speed = between(3.3, 4.4) * person.fitness * Math.max(0.75, 1 - round * 0.04);
        person.walkTo([{ x: coneSpot.x + (x > coneSpot.x ? 0.8 : -0.8), z: coneSpot.z - 0.4 }, { x, z: start.z + 0.8 }], {
          speed,
          pose: 'hands-on-knees',
          onArrive: () => finishes.push(person),
        });
      });
      let touched = false;
      await game.waitUntil((dt) => {
        if (ui.modalOpen) return false;
        elapsed += dt;
        effort(dt, { staffName, drain: 3 });
        if (!touched && near(coneSpot, 2.2)) {
          touched = true;
          ui.toast('✓ קונוס. חזרה!', 900);
        }
        return touched && player.z >= start.z + 0.2;
      });
      const rank = finishes.length + 1;
      const order = [...finishes];
      for (const person of list) {
        if (person.walking) person.stop('stand');
        if (!order.includes(person)) order.push(person);
      }
      const carrier = rank <= 4;
      ui.announce(`הגעת ${rank}`, carrier ? 'אתה בין הארבעה הראשונים: לאלונקה!' : 'הארבעה הראשונים לוקחים את האלונקה. אתה נח.');
      const bearers = order.filter((p, i) => i < 4 && p).slice(0, carrier ? 3 : 4);
      player.autoRun = false;

      // The stretcher lap.
      stretcher.visible = true;
      const corners = [
        [-0.45, 1.15],
        [0.45, 1.15],
        [-0.45, -1.15],
        [0.45, -1.15],
      ];
      if (carrier) {
        player.positionLocked = true;
        ui.toast('תחזיק קדימה (W / ג׳ויסטיק) כדי לסחוב איתם', 2400);
      } else {
        player.faceTowards(start.x, start.z - 9, 1);
      }
      let progress = 0;
      let held = 0;
      let heldTotal = 0;
      await game.waitUntil((dt) => {
        if (ui.modalOpen) return false;
        const pushing = carrier ? (player.input?.forward ?? 0) > 0.2 : true;
        if (carrier) {
          heldTotal += dt;
          if (pushing) held += dt;
          effort(dt, { staffName, drain: 3.5, idleLimit: 99 });
        } else {
          rest(dt * 0.6);
        }
        const speed = 2.1 * (pushing ? 1 : 0.45);
        progress = Math.min(total, progress + speed * dt);
        let d = progress;
        let leg = 0;
        while (leg < legs.length - 1 && d > legs[leg]) d -= legs[leg++];
        const from = path[leg];
        const to = path[leg + 1];
        const local = Math.min(1, d / legs[leg]);
        const sx = THREE.MathUtils.lerp(from.x, to.x, local);
        const sz = THREE.MathUtils.lerp(from.y, to.y, local);
        const heading = Math.atan2(to.x - from.x, to.y - from.y);
        stretcher.position.set(sx, height(sx, sz) + 0.85, sz);
        stretcher.rotation.y = heading;
        const sin = Math.sin(heading);
        const cos = Math.cos(heading);
        let npc = 0;
        corners.forEach(([cx, cz], i) => {
          const px = sx + cx * cos + cz * sin;
          const pz = sz - cx * sin + cz * cos;
          if (carrier && i === 1) {
            player.x = px;
            player.z = pz;
            return;
          }
          const bearer = bearers[npc++];
          if (!bearer) return;
          bearer.carry('jerrycan');
          bearer.place(px, pz, heading);
          bearer.speed = speed;
          bearer.setPose('walk');
        });
        return progress >= total;
      });
      bearers.forEach((p) => {
        p.carry(null);
        p.stop('hands-on-knees');
      });
      stretcher.visible = false;
      resetBody();
      rest(8);
      results.push({ rank, carrier, held: carrier ? held / Math.max(1, heldTotal) : 1 });
      if (round < rounds) await wait(1500);
    }
    stretcher.removeFromParent();
    stats.stretcher = results;
    return results;
  }

  // ---------- Digging: a personal pit and the class pit ----------

  async function digDrill(duration, staffName) {
    const mineSpot = { x: SPOTS.dig.x - 1.5, z: SPOTS.dig.z };
    const groupSpot = { x: SPOTS.dig.x, z: SPOTS.dig.z - 4 };
    player.teleport(mineSpot.x, mineSpot.z + 1.4, 0);
    player.pitch = -0.6;
    const list = active(people);
    // Classmates dig in the other squares and in the class pit.
    // Square 1 is yours; the others go to squares 0, 2 and 3.
    const squares = [0, 2, 3];
    list.forEach((person, i) => {
      person.group.visible = true;
      person.carry(null);
      const atGroup = i % 3 !== 0;
      const x = atGroup ? groupSpot.x - 1.8 + (i % 5) * 0.9 : SPOTS.dig.x - 4.5 + squares[Math.floor(i / 3) % 3] * 3;
      const z = atGroup ? groupSpot.z + (i % 2 ? 1.4 : -1.4) : SPOTS.dig.z + 0.9;
      person.place(x, z, atGroup ? (i % 2 ? Math.PI : 0) : Math.PI).setPose('dig');
    });

    const holeMaterial = () => new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 1 });
    const myHole = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), holeMaterial());
    myHole.rotation.x = -Math.PI / 2;
    myHole.position.set(mineSpot.x, height(mineSpot.x, mineSpot.z) + 0.03, mineSpot.z);
    const groupHole = new THREE.Mesh(new THREE.PlaneGeometry(4, 2), holeMaterial());
    groupHole.rotation.x = -Math.PI / 2;
    groupHole.position.set(groupSpot.x, height(groupSpot.x, groupSpot.z) + 0.03, groupSpot.z);
    game.scene.add(myHole, groupHole);

    let mine = 0;
    let shared = 0;
    let groupDepth = 0;
    const update = () => {
      myHole.material.color.setHSL(0.09, 0.35, THREE.MathUtils.lerp(0.4, 0.14, Math.min(1, mine / 45)));
      groupHole.material.color.setHSL(0.09, 0.35, THREE.MathUtils.lerp(0.4, 0.14, Math.min(1, groupDepth / 160)));
      hud.setDrill('חפירה', `הבור שלך: ${Math.round(Math.min(100, (mine / 45) * 100))} ס״מ · הבור הכיתתי: ${Math.round(Math.min(100, (groupDepth / 160) * 100))} ס״מ`);
    };
    hud.setDrill('חפירה', 'פעולה / E ליד הבור שלך או ליד הבור הכיתתי (הכתום)');
    await countdown('חופרים!');
    game.onAction = () => {
      if (stamina < 4) {
        ui.toast('אין כוח… נשום רגע', 1000);
        return;
      }
      if (near(mineSpot, 1.9)) {
        mine++;
      } else if (Math.abs(player.x - groupSpot.x) < 3.2 && Math.abs(player.z - groupSpot.z) < 2.4) {
        shared++;
        groupDepth++;
      } else {
        ui.toast('צריך לעמוד ליד אחד הבורות', 1000);
        return;
      }
      stamina = Math.max(0, stamina - 2.6);
      click();
      update();
    };
    let t = 0;
    let lastActions = 0;
    let idleTime = 0;
    await game.waitUntil((dt) => {
      if (ui.modalOpen) return false;
      t += dt;
      // The class digs in the shared pit too.
      groupDepth += 0.18 * list.length * dt;
      update();
      stamina = Math.min(100, stamina + 3 * dt);
      hud.setStamina(stamina);
      const actions = mine + shared;
      idleTime = actions === lastActions && player.movedThisFrame < 0.001 ? idleTime + dt : 0;
      lastActions = actions;
      if (idleTime > 5) {
        idleTime = 0;
        stats.stops++;
        note(staffName, `${MY_NUMBER}, ממשיכים.`);
      }
      return t >= duration;
    });
    game.onAction = null;
    whistle();
    ui.announce('עצור! הניחו את האתים');
    for (const p of list) p.setPose('stand');
    resetBody();
    setTimeout(() => {
      myHole.removeFromParent();
      groupHole.removeFromParent();
    }, 15000);
    const result = { mine, shared, total: mine + shared, perSecond: (mine + shared) / duration, share: shared / Math.max(1, mine + shared) };
    stats.dig = result;
    return result;
  }

  /** Dig under the low fence and crawl through without touching the wire. */
  async function fenceDig(staffName) {
    const fence = SPOTS.fence;
    const wire = 22; // cm above the ground.
    const needed = 45; // cm of space you need to crawl under (with the helmet).
    player.teleport(fence.x + 1.6, fence.z, Math.PI / 2);
    setCrawl(true);
    player.autoRun = false;
    let depth = 0;
    let attempts = 0;
    let digs = 0;
    hud.setDrill('מעבר מתחת לגדר', `פעולה / E: לחפור · כשמספיק עמוק, זחול מתחת. גדר בגובה ${wire} ס״מ`);
    game.onAction = () => {
      if (Math.abs(player.x - fence.x) > 2.2) {
        ui.toast('צריך להיות צמוד לגדר כדי לחפור', 1000);
        return;
      }
      digs++;
      depth = Math.min(50, depth + 2.5);
      click();
      hud.setDrill('מעבר מתחת לגדר', `מקום מתחת לחוט: ${Math.round(wire + depth)} ס״מ · צריך בערך ${needed} כדי לעבור בלי לגעת`);
    };
    await game.waitUntil(() => {
      if (ui.modalOpen) return false;
      // Crossing the fence line.
      if (player.x < fence.x - 0.2 && Math.abs(player.z - fence.z) < 2.2) {
        if (wire + depth < needed) {
          attempts++;
          ui.announce('נגעת בגדר!', 'לפי החוקים מתחילים מחדש');
          note(staffName, 'מההתחלה.');
          player.teleport(fence.x + 1.6, fence.z, Math.PI / 2);
          depth = 0;
          return false;
        }
        return true;
      }
      // Walking around the fence doesn't count.
      if (Math.abs(player.z - fence.z) > 2.4 && player.x < fence.x + 0.5) {
        ui.toast('עוברים רק מתחת לגדר', 1200);
        player.teleport(fence.x + 1.6, fence.z, Math.PI / 2);
      }
      return false;
    });
    game.onAction = null;
    resetBody();
    stats.fence = { restarts: attempts, digs };
    return stats.fence;
  }

  return {
    screeningRun,
    crawlHeats,
    plumRack,
    groupHang,
    burningGround,
    nightMarch,
    tzukon,
    stretcherDrill,
    digDrill,
    fenceDig,
    resetBody,
    rest,
    countdown,
    whistle,
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
