import * as THREE from 'three';

// Low-poly people built from simple shapes. A person faces +z, origin at the feet.

const SKIN = ['#f1c9a5', '#e0ac85', '#c68863', '#a86f4c', '#7d4f33', '#f5d6bc'];
const HAIR = ['#1f1a17', '#3b2a1e', '#5a3d27', '#8a5a33', '#c79a5b', '#2b2b2b'];
const SHIRTS = ['#3d6fa8', '#c0392b', '#ffffff', '#2c3e50', '#7f8c8d', '#e67e22', '#16a085', '#8e44ad', '#f4d03f', '#34495e', '#d35400', '#27ae60'];
const PANTS = ['#2c3e66', '#1f2a44', '#3b3b3b', '#5d6d7e', '#c8b28a', '#22313f'];
const UNIFORM = '#5b6236';

function makeCapsule(radius, length, pivotTop = true) {
  const geometry = new THREE.CapsuleGeometry(radius, length, 3, 8);
  if (pivotTop) geometry.translate(0, -(length / 2 + radius), 0);
  return geometry;
}

const GEO = {
  thigh: makeCapsule(0.075, 0.3),
  shin: makeCapsule(0.065, 0.31),
  upperArm: makeCapsule(0.055, 0.22),
  forearm: makeCapsule(0.05, 0.2),
  torso: new THREE.CapsuleGeometry(0.17, 0.3, 4, 12),
  neck: new THREE.CylinderGeometry(0.045, 0.05, 0.1, 8),
  head: new THREE.SphereGeometry(0.115, 16, 12),
  eye: new THREE.SphereGeometry(0.016, 6, 4),
  hand: new THREE.SphereGeometry(0.045, 8, 6),
  shoe: new THREE.BoxGeometry(0.1, 0.07, 0.24),
  hairCap: new THREE.SphereGeometry(0.124, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
  hairLong: new THREE.BoxGeometry(0.22, 0.3, 0.07),
  beret: new THREE.CylinderGeometry(0.115, 0.125, 0.045, 14),
  phone: new THREE.BoxGeometry(0.055, 0.105, 0.01),
  paper: new THREE.BoxGeometry(0.22, 0.01, 0.3),
};

const hitboxGeometry = new THREE.CylinderGeometry(0.35, 0.35, 1.8, 8);
hitboxGeometry.translate(0, 0.9, 0);
const hitboxMaterial = new THREE.MeshBasicMaterial({ visible: false });

// Every body part is drawn through one InstancedMesh per shape (see Crowd),
// so 60+ people cost about 15 draw calls instead of 1000+. That's what keeps
// the game smooth on phones.
const MAX_PEOPLE = 160;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function randomLook(overrides = {}) {
  return {
    skin: pick(SKIN),
    hair: pick(HAIR),
    shirt: pick(SHIRTS),
    pants: pick(PANTS),
    shoes: pick(['#2b2b2b', '#f2f2f2', '#6b4b33']),
    longHair: Math.random() < 0.4,
    scale: 0.94 + Math.random() * 0.12,
    ...overrides,
  };
}

export function soldierLook(overrides = {}) {
  return randomLook({ shirt: UNIFORM, pants: UNIFORM, shoes: '#1b1b1b', beret: false, ...overrides });
}

export class Person {
  constructor(look = randomLook(), name = 'מלש״ב') {
    this.name = name;
    this.look = look;
    this.group = new THREE.Group();
    this.body = new THREE.Group(); // Lowered when sitting.
    this.group.add(this.body);
    this.group.scale.setScalar(look.scale ?? 1);

    this.pose = 'stand';
    this.time = Math.random() * 10;
    this.path = [];
    this.speed = 1.25;
    this.onArrive = null;
    this.arrivePose = 'stand';
    this.arriveFacing = null;
    this.headTarget = 0;
    this.headTimer = 0;
    this.talking = false;

    this.parts = [];
    this.build();

    this.hitbox = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
    this.group.add(this.hitbox);
  }

  /** A body part: an empty node that the Crowd draws with shape `key` and `color`. */
  part(key, color, parent) {
    const node = new THREE.Object3D();
    parent.add(node);
    this.parts.push({ key, color, node });
    return node;
  }

  build() {
    const { look } = this;

    // Legs
    this.legs = [-1, 1].map((side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.09, 0.9, 0);
      this.part('thigh', look.pants, hip);
      const knee = new THREE.Group();
      knee.position.y = -0.44;
      this.part('shin', look.pants, knee);
      this.part('shoe', look.shoes, knee).position.set(0, -0.42, 0.04);
      hip.add(knee);
      this.body.add(hip);
      return { hip, knee };
    });

    // Torso
    const torso = this.part('torso', look.shirt, this.body);
    torso.scale.set(1.12, 1, 0.68);
    torso.position.y = 1.22;
    this.torso = torso;

    // Arms
    this.arms = [-1, 1].map((side) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.23, 1.47, 0);
      this.part('upperArm', look.shirt, shoulder);
      const elbow = new THREE.Group();
      elbow.position.y = -0.31;
      this.part('forearm', look.shortSleeves === false ? look.shirt : look.skin, elbow);
      const hand = this.part('hand', look.skin, elbow);
      hand.position.y = -0.31;
      shoulder.add(elbow);
      this.body.add(shoulder);
      return { shoulder, elbow, hand, side };
    });

    // Head
    this.part('neck', look.skin, this.body).position.y = 1.57;

    this.head = new THREE.Group();
    this.head.position.y = 1.7;
    this.part('head', look.skin, this.head);
    for (const side of [-1, 1]) {
      this.part('eye', '#1a1a1a', this.head).position.set(side * 0.042, 0.015, 0.103);
    }
    if (!look.bald) {
      const cap = this.part('hairCap', look.hair, this.head);
      cap.rotation.x = -0.35;
      cap.position.set(0, 0.008, -0.01);
      if (look.longHair) this.part('hairLong', look.hair, this.head).position.set(0, -0.08, -0.09);
    }
    if (look.beret) {
      const beret = this.part('beret', look.beret === true ? '#3d4224' : look.beret, this.head);
      beret.position.set(-0.015, 0.1, -0.01);
      beret.rotation.z = 0.25;
    }
    if (look.coat) {
      // White doctor's coat over the shirt.
      const coat = this.part('torso', '#f7f7f4', this.body);
      coat.scale.set(1.2, 1.18, 0.74);
      coat.position.y = 1.17;
    }
    this.body.add(this.head);

    // Props, shown only in some poses.
    this.phone = this.part('phone', '#111111', this.arms[1].elbow);
    this.phone.position.set(0, -0.36, 0.03);
    this.phone.rotation.x = -0.6;
    this.phone.visible = false;

    this.paper = this.part('paper', '#ffffff', this.arms[0].elbow);
    this.paper.position.set(0, -0.34, 0.08);
    this.paper.visible = false;
  }

  get position() {
    return this.group.position;
  }

  place(x, z, facing = 0) {
    this.group.position.set(x, 0, z);
    this.group.rotation.y = facing;
    return this;
  }

  faceTowards(x, z) {
    this.group.rotation.y = Math.atan2(x - this.group.position.x, z - this.group.position.z);
  }

  setPose(pose) {
    this.pose = pose;
    this.phone.visible = pose === 'phone' || pose === 'sit-phone';
    this.paper.visible = pose === 'clipboard';
    const sitting = pose.startsWith('sit');
    this.body.position.y = sitting ? -0.43 : 0;
    return this;
  }

  /** Walk along [{x, z}, ...]; on arrival switch to `pose`, optionally face `facing`. */
  walkTo(points, { pose = 'stand', facing = null, onArrive = null, speed = 1.25 } = {}) {
    this.path = points.map((p) => new THREE.Vector2(p.x, p.z));
    this.arrivePose = pose;
    this.arriveFacing = facing;
    this.onArrive = onArrive;
    this.speed = speed;
    this.setPose('walk');
    return this;
  }

  get walking() {
    return this.path.length > 0;
  }

  update(dt) {
    this.time += dt;
    const t = this.time;

    if (this.path.length) {
      const target = this.path[0];
      const pos = this.group.position;
      const dx = target.x - pos.x;
      const dz = target.y - pos.z;
      const dist = Math.hypot(dx, dz);
      const step = this.speed * dt;
      if (dist <= step) {
        pos.x = target.x;
        pos.z = target.y;
        this.path.shift();
        if (!this.path.length) {
          this.setPose(this.arrivePose);
          if (this.arriveFacing !== null) this.group.rotation.y = this.arriveFacing;
          const done = this.onArrive;
          this.onArrive = null;
          done?.(this);
        }
      } else {
        pos.x += (dx / dist) * step;
        pos.z += (dz / dist) * step;
        const targetAngle = Math.atan2(dx, dz);
        let diff = targetAngle - this.group.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.group.rotation.y += diff * Math.min(1, dt * 10);
      }
    }

    this.animate(t, dt);
  }

  animate(t, dt) {
    const [legL, legR] = this.legs;
    const [armL, armR] = this.arms;
    const reset = () => {
      for (const leg of this.legs) {
        leg.hip.rotation.set(0, 0, 0);
        leg.knee.rotation.set(0, 0, 0);
      }
      for (const arm of this.arms) {
        arm.shoulder.rotation.set(0, 0, arm.side * 0.08);
        arm.elbow.rotation.set(0, 0, 0);
      }
      this.head.rotation.set(0, 0, 0);
      this.torso.rotation.set(0, 0, 0);
    };
    reset();

    const breathe = 1 + Math.sin(t * 2.2) * 0.012;
    this.torso.scale.y = breathe;

    // Occasional glance to the side.
    this.headTimer -= dt;
    if (this.headTimer <= 0) {
      this.headTimer = 2 + Math.random() * 5;
      this.headTarget = Math.random() < 0.5 ? 0 : (Math.random() - 0.5) * 1.2;
    }
    this.headYaw = (this.headYaw ?? 0) + (this.headTarget - (this.headYaw ?? 0)) * Math.min(1, dt * 3);

    const sitting = this.pose.startsWith('sit');
    if (sitting) {
      for (const leg of this.legs) {
        leg.hip.rotation.x = -Math.PI / 2;
        leg.knee.rotation.x = Math.PI / 2;
      }
      legL.hip.rotation.y = 0.06;
      legR.hip.rotation.y = -0.06;
    }

    switch (this.pose) {
      case 'walk': {
        const phase = t * this.speed * 5.2;
        const swing = Math.sin(phase) * 0.5;
        legL.hip.rotation.x = swing;
        legR.hip.rotation.x = -swing;
        legL.knee.rotation.x = Math.max(0, -Math.sin(phase)) * 0.7;
        legR.knee.rotation.x = Math.max(0, Math.sin(phase)) * 0.7;
        armL.shoulder.rotation.x = -swing * 0.7;
        armR.shoulder.rotation.x = swing * 0.7;
        armL.elbow.rotation.x = -0.25;
        armR.elbow.rotation.x = -0.25;
        this.body.position.y = Math.abs(Math.cos(phase)) * 0.03;
        break;
      }
      case 'phone':
      case 'sit-phone':
        armR.shoulder.rotation.x = -0.25;
        armR.shoulder.rotation.z = 0.12;
        armR.elbow.rotation.x = -1.2;
        armL.shoulder.rotation.x = sitting ? -0.35 : -0.1;
        armL.elbow.rotation.x = sitting ? -0.9 : -0.2;
        this.head.rotation.x = 0.5;
        this.head.rotation.y = 0;
        return;
      case 'sit-type':
      case 'type':
        for (const arm of this.arms) {
          arm.shoulder.rotation.x = -0.75;
          arm.elbow.rotation.x = -0.75 + Math.sin(t * 14 + arm.side) * 0.06;
        }
        this.head.rotation.x = 0.12;
        this.head.rotation.y = this.headYaw * 0.3;
        return;
      case 'clipboard':
        armL.shoulder.rotation.x = -0.4;
        armL.elbow.rotation.x = -1.2;
        armR.shoulder.rotation.x = -0.3;
        armR.elbow.rotation.x = -1.0;
        this.head.rotation.x = 0.25;
        return;
      case 'sit-talk':
      case 'talk':
        armR.shoulder.rotation.x = sitting ? -0.4 : -0.3;
        armR.elbow.rotation.x = -0.9 + Math.sin(t * 3) * 0.25;
        armL.shoulder.rotation.x = sitting ? -0.35 : 0;
        armL.elbow.rotation.x = sitting ? -0.9 : 0;
        this.head.rotation.x = Math.sin(t * 4) * 0.06;
        this.head.rotation.y = this.headYaw * 0.4;
        return;
      case 'sit':
        for (const arm of this.arms) {
          arm.shoulder.rotation.x = -0.35;
          arm.elbow.rotation.x = -0.9;
        }
        break;
      case 'arms-crossed':
        for (const arm of this.arms) {
          arm.shoulder.rotation.x = -0.35;
          arm.shoulder.rotation.z = -arm.side * 0.15;
          arm.elbow.rotation.x = -1.6;
          arm.elbow.rotation.y = arm.side * 0.9;
        }
        break;
      default:
        break;
    }

    if (this.pose !== 'walk') this.head.rotation.y = this.headYaw;
  }
}

/** Keeps a list of people, animates them and draws all their body parts in batches. */
export class Crowd {
  constructor(scene) {
    this.scene = scene;
    this.people = [];
    this.batches = new Map();
    this.color = new THREE.Color();
  }

  get full() {
    return this.people.length >= MAX_PEOPLE;
  }

  batch(key) {
    let mesh = this.batches.get(key);
    if (!mesh) {
      // At most 2 of each shape per person (legs, arms, eyes; a coat reuses the torso shape).
      mesh = new THREE.InstancedMesh(GEO[key], new THREE.MeshStandardMaterial({ roughness: 0.85 }), MAX_PEOPLE * 2);
      mesh.count = 0;
      mesh.frustumCulled = false; // People move around, so the batch has no fixed bounds.
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(mesh);
      this.batches.set(key, mesh);
    }
    return mesh;
  }

  add(person) {
    this.people.push(person);
    this.scene.add(person.group);
    for (const part of person.parts) {
      const mesh = this.batch(part.key);
      part.mesh = mesh;
      part.index = mesh.count++;
      mesh.setColorAt(part.index, this.color.set(part.color));
      mesh.instanceColor.needsUpdate = true;
    }
    return person;
  }

  update(dt, camera) {
    for (const person of this.people) {
      if (!person.group.visible) continue;
      // Skip animation for people far away from the player.
      const far = camera && person.group.position.distanceToSquared(camera.position) > 45 * 45;
      if (far && !person.walking) continue;
      person.update(dt);
    }
    this.sync();
  }

  /** Copy every body part's position into its batch. */
  sync() {
    for (const person of this.people) {
      const shown = person.group.visible;
      if (shown) person.group.updateMatrixWorld(true);
      for (const part of person.parts) {
        part.mesh.setMatrixAt(part.index, shown && part.node.visible ? part.node.matrixWorld : HIDDEN);
      }
    }
    for (const mesh of this.batches.values()) mesh.instanceMatrix.needsUpdate = true;
  }
}
