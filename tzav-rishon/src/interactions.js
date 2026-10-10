import * as THREE from 'three';

/**
 * Things the player can use: people, chairs, the computer station...
 * Each item: { id, object, label, position?, range, enabled(), onInteract() }.
 * The item under the crosshair wins; on touch screens we also accept the
 * closest item in front of the player.
 */
export class Interactions {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.items = [];
    this.byObject = new Map();
    this.current = null;
    this.raycaster = new THREE.Raycaster();
    this.center = new THREE.Vector2(0, 0);
    this.tmp = new THREE.Vector3();
  }

  add(item) {
    const entry = { range: 3.0, enabled: () => true, ...item };
    this.items.push(entry);
    this.byObject.set(entry.object, entry);
    return entry;
  }

  remove(entry) {
    this.items = this.items.filter((item) => item !== entry);
    this.byObject.delete(entry.object);
  }

  positionOf(item) {
    if (typeof item.position === 'function') return item.position();
    if (item.position) return item.position;
    return item.object.getWorldPosition(this.tmp);
  }

  update(player) {
    this.current = null;
    if (!player.enabled) return null;

    const active = this.items.filter((item) => item.object.visible !== false && item.object.parent?.visible !== false && item.enabled());
    this.raycaster.setFromCamera(this.center, this.camera);
    this.raycaster.far = 3.4;
    const targets = [...active.map((item) => item.object), ...this.world.blockers];
    const hits = this.raycaster.intersectObjects(targets, false);
    for (const hit of hits) {
      const item = this.byObject.get(hit.object);
      if (!item) break; // A wall is in the way.
      if (hit.distance <= item.range) {
        this.current = item;
        break;
      }
    }

    if (!this.current && player.touch) {
      // Touch fallback: nearest item roughly in front of the player.
      let best = null;
      let bestDist = 1.9;
      const fx = -Math.sin(player.yaw);
      const fz = -Math.cos(player.yaw);
      for (const item of active) {
        const p = this.positionOf(item);
        const dx = p.x - player.x;
        const dz = p.z - player.z;
        const dist = Math.hypot(dx, dz);
        if (dist > bestDist || dist < 0.01) continue;
        if ((dx * fx + dz * fz) / dist < 0.55) continue;
        best = item;
        bestDist = dist;
      }
      this.current = best;
    }
    return this.current;
  }

  label() {
    if (!this.current) return null;
    const { label } = this.current;
    return typeof label === 'function' ? label() : label;
  }

  trigger() {
    const item = this.current;
    if (item) item.onInteract(item);
    return Boolean(item);
  }
}
