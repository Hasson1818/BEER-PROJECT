import * as THREE from 'three';

const EYE_HEIGHT = 1.65;
const SEATED_EYE = 1.15;
const RADIUS = 0.3;
const WALK_SPEED = 2.6;
const RUN_SPEED = 4.4;

/** First-person movement: keyboard + mouse on desktop, joystick + drag on touch. */
export class Player {
  constructor(camera, canvas, world, crowd) {
    this.camera = camera;
    this.canvas = canvas;
    this.world = world;
    this.crowd = crowd;
    this.x = 0;
    this.z = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.enabled = true;
    this.seat = null;
    this.onStandUp = null;
    this.keys = new Set();
    this.joystick = { x: 0, y: 0 };
    this.bob = 0;
    this.eye = EYE_HEIGHT;
    this.touch = window.matchMedia('(pointer: coarse)').matches;

    camera.rotation.order = 'YXZ';

    document.addEventListener('keydown', (event) => {
      if (event.target instanceof HTMLInputElement) return;
      this.keys.add(event.code);
      if (event.code.startsWith('Arrow')) event.preventDefault();
    });
    document.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.keys.clear());

    // When pointer lock isn't available, dragging with the mouse looks around instead.
    this.dragLook = false;
    document.addEventListener('mousemove', (event) => {
      if (!this.enabled) return;
      if (document.pointerLockElement === canvas) {
        this.look(event.movementX * 0.0022, event.movementY * 0.0022);
      } else if (this.dragLook && event.buttons & 1 && event.target === canvas) {
        this.look(event.movementX * 0.004, event.movementY * 0.004);
      }
    });

    if (this.touch) this.setupTouch();
  }

  get locked() {
    return document.pointerLockElement === this.canvas;
  }

  lock() {
    if (this.touch || this.locked) return;
    try {
      const result = this.canvas.requestPointerLock();
      result?.catch?.(() => {});
    } catch {
      // Not allowed right now (no user gesture); the click overlay handles it.
    }
  }

  unlock() {
    if (this.locked) document.exitPointerLock();
  }

  look(dx, dy) {
    this.yaw -= dx;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy, -1.2, 1.2);
  }

  teleport(x, z, yaw = this.yaw) {
    this.standUp(false);
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    this.pitch = 0;
    this.applyCamera(0);
  }

  /** Face a point, e.g. the person you're talking to. */
  faceTowards(x, z, y = 1.5) {
    const dx = x - this.x;
    const dz = z - this.z;
    this.yaw = Math.atan2(-dx, -dz);
    this.pitch = Math.atan2(y - this.eye, Math.hypot(dx, dz)) * 0.8;
  }

  sit(seat, facing) {
    this.seat = seat;
    seat.taken = true;
    this.x = seat.x;
    this.z = seat.z;
    this.yaw = facing;
    this.pitch = -0.05;
  }

  standUp(notify = true) {
    if (!this.seat) return;
    const seat = this.seat;
    seat.taken = false;
    this.seat = null;
    // Step out in front of the chair (hall chairs face -z).
    const exit = seat.exit ?? { x: seat.x, z: seat.z - 0.75 };
    this.x = exit.x;
    this.z = exit.z;
    if (notify) this.onStandUp?.();
  }

  setupTouch() {
    document.body.classList.add('touch');
    const base = document.getElementById('joystick');
    const knob = document.getElementById('joystick-knob');
    let joyId = null;
    const moveKnob = (event) => {
      const rect = base.getBoundingClientRect();
      let dx = event.clientX - (rect.left + rect.width / 2);
      let dy = event.clientY - (rect.top + rect.height / 2);
      const max = rect.width / 2;
      const len = Math.hypot(dx, dy);
      if (len > max) {
        dx = (dx / len) * max;
        dy = (dy / len) * max;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joystick.x = dx / max;
      this.joystick.y = dy / max;
    };
    base.addEventListener('pointerdown', (event) => {
      joyId = event.pointerId;
      try {
        base.setPointerCapture(joyId);
      } catch {
        // Some browsers refuse capture; the joystick still works while the finger stays on it.
      }
      moveKnob(event);
    });
    base.addEventListener('pointermove', (event) => {
      if (event.pointerId === joyId) moveKnob(event);
    });
    const release = (event) => {
      if (event.pointerId !== joyId) return;
      joyId = null;
      knob.style.transform = '';
      this.joystick.x = 0;
      this.joystick.y = 0;
    };
    base.addEventListener('pointerup', release);
    base.addEventListener('pointercancel', release);

    // Drag anywhere on the 3D view to look around.
    let lookId = null;
    let lastX = 0;
    let lastY = 0;
    this.canvas.addEventListener('pointerdown', (event) => {
      if (lookId !== null) return;
      lookId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
    });
    window.addEventListener('pointermove', (event) => {
      if (event.pointerId !== lookId || !this.enabled) return;
      this.look((event.clientX - lastX) * 0.005, (event.clientY - lastY) * 0.005);
      lastX = event.clientX;
      lastY = event.clientY;
    });
    const endLook = (event) => {
      if (event.pointerId === lookId) lookId = null;
    };
    window.addEventListener('pointerup', endLook);
    window.addEventListener('pointercancel', endLook);
  }

  update(dt) {
    let forward = 0;
    let strafe = 0;
    let turn = 0;
    if (this.enabled) {
      const k = this.keys;
      if (k.has('KeyW') || k.has('ArrowUp')) forward += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) forward -= 1;
      if (k.has('KeyD')) strafe += 1;
      if (k.has('KeyA')) strafe -= 1;
      if (k.has('ArrowLeft')) turn += 1;
      if (k.has('ArrowRight')) turn -= 1;
      forward -= this.joystick.y;
      strafe += this.joystick.x;
    }
    this.yaw += turn * dt * 2.2;

    const moving = Math.hypot(forward, strafe) > 0.1;
    if (this.seat && moving) this.standUp();

    if (!this.seat && moving) {
      const length = Math.max(1, Math.hypot(forward, strafe));
      const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? RUN_SPEED : WALK_SPEED;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      // Camera looks down -z at yaw 0.
      const fx = -sin;
      const fz = -cos;
      const rx = cos;
      const rz = -sin;
      this.x += ((fx * forward + rx * strafe) / length) * speed * dt;
      this.z += ((fz * forward + rz * strafe) / length) * speed * dt;
      this.bob += dt * speed * 3.2;
      this.collide();
    }

    this.applyCamera(moving && !this.seat ? 1 : 0, dt);
  }

  collide() {
    for (let pass = 0; pass < 2; pass++) {
      for (const c of this.world.colliders) {
        const cx = Math.max(c.minX, Math.min(this.x, c.maxX));
        const cz = Math.max(c.minZ, Math.min(this.z, c.maxZ));
        const dx = this.x - cx;
        const dz = this.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= RADIUS * RADIUS) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          this.x = cx + (dx / d) * RADIUS;
          this.z = cz + (dz / d) * RADIUS;
        } else {
          // Center is inside the box: push out the shortest way.
          const pushes = [
            [c.minX - RADIUS - this.x, 0],
            [c.maxX + RADIUS - this.x, 0],
            [0, c.minZ - RADIUS - this.z],
            [0, c.maxZ + RADIUS - this.z],
          ].sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
          this.x += pushes[0][0];
          this.z += pushes[0][1];
        }
      }
      for (const person of this.crowd.people) {
        if (!person.group.visible || person.pose.startsWith('sit')) continue;
        const dx = this.x - person.position.x;
        const dz = this.z - person.position.z;
        const min = RADIUS + 0.25;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          this.x = person.position.x + (dx / d) * min;
          this.z = person.position.z + (dz / d) * min;
        }
      }
    }
  }

  applyCamera(moving, dt = 0) {
    const targetEye = this.seat ? SEATED_EYE : EYE_HEIGHT;
    this.eye += (targetEye - this.eye) * Math.min(1, dt * 8 || 1);
    const bob = moving ? Math.sin(this.bob) * 0.035 : 0;
    this.camera.position.set(this.x, this.eye + bob, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
