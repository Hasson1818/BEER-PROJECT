import * as THREE from 'three';

// Low-poly people built from simple shapes. A person faces +z, origin at the feet.

const SKIN = ['#f1c9a5', '#e0ac85', '#c68863', '#a86f4c', '#7d4f33', '#f5d6bc'];
const HAIR = ['#1f1a17', '#3b2a1e', '#5a3d27', '#8a5a33', '#c79a5b', '#2b2b2b'];
const SHIRTS = ['#3d6fa8', '#c0392b', '#ffffff', '#2c3e50', '#7f8c8d', '#e67e22', '#16a085', '#8e44ad', '#f4d03f', '#34495e', '#d35400', '#27ae60'];
const PANTS = ['#2c3e66', '#1f2a44', '#3b3b3b', '#5d6d7e', '#c8b28a', '#22313f'];
const UNIFORM = '#5b6236';

function makeCapsule(radius, length, pivotTop = true) {
  const geometry = new THREE.CapsuleGeometry(radius, length, 4, 10);
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
  head: new THREE.SphereGeometry(0.115, 18, 14),
  eye: new THREE.SphereGeometry(0.016, 8, 6),
  hand: new THREE.SphereGeometry(0.045, 8, 6),
  shoe: new THREE.BoxGeometry(0.1, 0.07, 0.24),
  hairCap: new THREE.SphereGeometry(0.124, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
  hairLong: new THREE.BoxGeometry(0.22, 0.3, 0.07),
  beret: new THREE.CylinderGeometry(0.115, 0.125, 0.045, 14),
  phone: new THREE.BoxGeometry(0.055, 0.105, 0.01),
  paper: new THREE.BoxGeometry(0.22, 0.01, 0.3),
  hitbox: new THREE.CylinderGeometry(0.35, 0.35, 1.8, 8),
};
GEO.hitbox.translate(0, 0.9, 0);

const materials = new Map();
function mat(color, options = {}) {
  const key = color + JSON.stringify(options);
  if (!materials.has(key)) {
    materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...options }));
  }
  return materials.get(key);
}
const hitboxMaterial = new THREE.MeshBasicMaterial({ visible: false });

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

    this.build();

    this.hitbox = new THREE.Mesh(GEO.hitbox, hitboxMaterial);
    this.group.add(this.hitbox);
  }

  build() {
    const { look } = this;
    const skin = mat(look.skin);

    // Legs
    this.legs = [-1, 1].map((side) => {
      const hip = new THREE.Group();
      hip.position.set(side * 0.09, 0.9, 0);
      hip.add(new THREE.Mesh(GEO.thigh, mat(look.pants)));
      const knee = new THREE.Group();
      knee.position.y = -0.44;
      knee.add(new THREE.Mesh(GEO.shin, mat(look.pants)));
      const shoe = new THREE.Mesh(GEO.shoe, mat(look.shoes));
      shoe.position.set(0, -0.42, 0.04);
      knee.add(shoe);
      hip.add(knee);
      this.body.add(hip);
      return { hip, knee };
    });

    // Torso
    const torso = new THREE.Mesh(GEO.torso, mat(look.shirt));
    torso.scale.set(1.12, 1, 0.68);
    torso.position.y = 1.22;
    this.torso = torso;
    this.body.add(torso);

    // Arms
    this.arms = [-1, 1].map((side) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.23, 1.47, 0);
      shoulder.add(new THREE.Mesh(GEO.upperArm, mat(look.shirt)));
      const elbow = new THREE.Group();
      elbow.position.y = -0.31;
      elbow.add(new THREE.Mesh(GEO.forearm, look.shortSleeves === false ? mat(look.shirt) : skin));
      const hand = new THREE.Mesh(GEO.hand, skin);
      hand.position.y = -0.31;
      elbow.add(hand);
      shoulder.add(elbow);
      this.body.add(shoulder);
      return { shoulder, elbow, hand, side };
    });

    // Head
    const neck = new THREE.Mesh(GEO.neck, skin);
    neck.position.y = 1.57;
    this.body.add(neck);

    this.head = new THREE.Group();
    this.head.position.y = 1.7;
    this.head.add(new THREE.Mesh(GEO.head, skin));
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(GEO.eye, mat('#1a1a1a'));
      eye.position.set(side * 0.042, 0.015, 0.103);
      this.head.add(eye);
    }
    if (!look.bald) {
      const cap = new THREE.Mesh(GEO.hairCap, mat(look.hair));
      cap.rotation.x = -0.35;
      cap.position.set(0, 0.008, -0.01);
      this.head.add(cap);
      if (look.longHair) {
        const back = new THREE.Mesh(GEO.hairLong, mat(look.hair));
        back.position.set(0, -0.08, -0.09);
        this.head.add(back);
      }
    }
    if (look.beret) {
      const beret = new THREE.Mesh(GEO.beret, mat(look.beret === true ? '#3d4224' : look.beret));
      beret.position.set(-0.015, 0.1, -0.01);
      beret.rotation.z = 0.25;
      this.head.add(beret);
    }
    if (look.coat) {
      // White doctor's coat over the shirt.
      const coat = new THREE.Mesh(GEO.torso, mat('#f7f7f4'));
      coat.scale.set(1.2, 1.18, 0.74);
      coat.position.y = 1.17;
      this.body.add(coat);
    }
    this.body.add(this.head);

    // Props, shown only in some poses.
    this.phone = new THREE.Mesh(GEO.phone, mat('#111111', { roughness: 0.3 }));
    this.phone.position.set(0, -0.36, 0.03);
    this.phone.rotation.x = -0.6;
    this.phone.visible = false;
    this.arms[1].elbow.add(this.phone);

    this.paper = new THREE.Mesh(GEO.paper, mat('#ffffff'));
    this.paper.position.set(0, -0.34, 0.08);
    this.paper.visible = false;
    this.arms[0].elbow.add(this.paper);
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

/** Keeps a list of people and updates them every frame. */
export class Crowd {
  constructor(scene) {
    this.scene = scene;
    this.people = [];
  }

  add(person) {
    this.people.push(person);
    this.scene.add(person.group);
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
  }
}
