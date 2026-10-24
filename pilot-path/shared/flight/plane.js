import * as THREE from 'three';

// The flight model of the simulator. Not a real aerodynamic model: it is built to feel like a fighter
// from the cockpit (stick for pitch and roll, throttle for speed), while staying easy to read and to
// stabilize for someone who never flew. World axes: +y up, the plane starts looking along -z.

export const KT = 1.94384; // m/s -> knots
export const G = 9.81;

const FORWARD = new THREE.Vector3(0, 0, -1);
const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);

export class Plane {
  constructor({ position = new THREE.Vector3(0, 1500, 0), heading = 0, speed = 120, assist = 0.7 } = {}) {
    this.position = position.clone();
    this.quaternion = new THREE.Quaternion().setFromAxisAngle(UP, heading);
    this.speed = speed; // m/s
    this.throttle = 0.5;
    this.assist = assist; // 0: none, 1: strong self-leveling (training)
    this.rollRate = 0;
    this.pitchRate = 0;
    this.stall = false;
    this.gLoad = 1;
    this.minSpeed = 62;
    this.maxSpeed = 240;
    this.velocity = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._q = new THREE.Quaternion();
  }

  forwardVector(out = new THREE.Vector3()) {
    return out.copy(FORWARD).applyQuaternion(this.quaternion);
  }

  upVector(out = new THREE.Vector3()) {
    return out.copy(UP).applyQuaternion(this.quaternion);
  }

  rightVector(out = new THREE.Vector3()) {
    return out.copy(RIGHT).applyQuaternion(this.quaternion);
  }

  /** Heading in degrees 0..360 (0 = -z, clockwise seen from above). */
  get heading() {
    const f = this.forwardVector(this._tmp);
    return (THREE.MathUtils.radToDeg(Math.atan2(f.x, -f.z)) + 360) % 360;
  }

  get pitch() {
    return THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(this.forwardVector(this._tmp).y, -1, 1)));
  }

  /** Bank angle in degrees, positive = right wing down; ±180 when inverted. */
  get roll() {
    const right = this.rightVector(new THREE.Vector3());
    const up = this.upVector(new THREE.Vector3());
    return THREE.MathUtils.radToDeg(Math.atan2(-right.y, up.y));
  }

  /** Speed target from the throttle (0..1). */
  get targetSpeed() {
    return this.minSpeed + (this.maxSpeed - this.minSpeed) * this.throttle;
  }

  /**
   * Advance by dt seconds. `stick` = { x: -1..1 (right = roll right), y: -1..1 (up = nose up) }.
   * `ground(x, z)` returns the terrain height there.
   */
  update(dt, stick, throttleInput = 0) {
    // Throttle moves slowly, like a lever.
    this.throttle = THREE.MathUtils.clamp(this.throttle + throttleInput * 0.45 * dt, 0, 1);

    // Roll and pitch rates follow the stick with inertia.
    const wantRoll = stick.x * 2.4;
    const wantPitch = stick.y * 1.15 * (this.stall ? 0.4 : 1) * THREE.MathUtils.clamp(this.speed / 105, 0.55, 1.15);
    this.rollRate += (wantRoll - this.rollRate) * Math.min(1, dt * 7);
    this.pitchRate += (wantPitch - this.pitchRate) * Math.min(1, dt * 6);

    // Self-leveling help when the stick is released.
    if (this.assist > 0) {
      const idleX = 1 - Math.min(1, Math.abs(stick.x) * 4);
      const idleY = 1 - Math.min(1, Math.abs(stick.y) * 4);
      const roll = THREE.MathUtils.degToRad(this.roll);
      const level = Math.abs(roll) < Math.PI * 0.62; // not when nearly inverted
      if (level) this.rollRate += -Math.sin(roll) * 1.5 * this.assist * idleX * dt * 6;
      const pitch = THREE.MathUtils.degToRad(this.pitch);
      this.pitchRate += -Math.sin(pitch) * 0.55 * this.assist * idleY * idleX * dt * 6;
    }

    // Apply the rotations in the plane's own frame.
    this._q.setFromAxisAngle(FORWARD, this.rollRate * dt); // positive roll = right wing down
    this.quaternion.multiply(this._q);
    this._q.setFromAxisAngle(RIGHT, this.pitchRate * dt);
    this.quaternion.multiply(this._q);

    // A bank makes the nose come around (a coordinated turn would do this); helps the turns feel right.
    const bank = THREE.MathUtils.degToRad(this.roll);
    if (Math.abs(bank) < Math.PI * 0.45) {
      this._q.setFromAxisAngle(UP, -Math.tan(bank) * (G / Math.max(60, this.speed)) * 0.75 * dt);
      this.quaternion.premultiply(this._q);
    }
    this.quaternion.normalize();

    // Speed, like the real thing in spirit: thrust from the throttle, drag that grows with speed (and with
    // hard pulling), and gravity along the flight path: climbing slows you, diving speeds you up.
    const fwd = this.forwardVector(this._tmp);
    const thrust = 1.4 + this.throttle * 13;
    const drag = 0.00027 * this.speed * this.speed + Math.abs(this.pitchRate) * this.speed * 0.012;
    this.speed += (thrust - drag - G * fwd.y) * dt;
    this.speed = THREE.MathUtils.clamp(this.speed, 38, this.maxSpeed + 70);

    // Low speed: the nose sinks.
    this.stall = this.speed < this.minSpeed - 6;
    if (this.stall) {
      this._q.setFromAxisAngle(RIGHT, -0.5 * dt);
      this.quaternion.multiply(this._q);
    }

    // Fly.
    this.velocity.copy(fwd).multiplyScalar(this.speed);
    this.position.addScaledVector(this.velocity, dt);
    this.gLoad = 1 + Math.abs(this.pitchRate) * this.speed / G * 0.5;
  }
}
