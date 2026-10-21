import * as THREE from 'three';

// Close-up characters. The people in the crowd are normally drawn from a few simple shapes
// (see Crowd in people.js). The few people nearest to the camera are swapped for this
// detailed, skinned model made in Blender (shared/engine/assets/character.blend):
// shaped body, face, hands, boots, belt and shirt details. It is driven by the very same
// joints as the simple version, so every pose and animation works on both.

const BONES = ['body', 'hipL', 'hipR', 'kneeL', 'kneeR', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'head'];

let loading = null;

/** Fetches the model once. Resolves to null if it can't be loaded (the simple characters stay). */
export function loadCharacter() {
  loading ??= fetch(new URL('./assets/character.json', import.meta.url))
    .then((response) => response.json())
    .then(prepare)
    .catch((error) => {
      console.warn('Detailed characters unavailable', error);
      return null;
    });
  return loading;
}

function prepare(data) {
  const count = data.region.length;
  const position = new Float32Array(count * 3);
  const normal = new Float32Array(count * 3);
  const skinWeight = new Float32Array(count * 4);
  for (let i = 0; i < count * 3; i++) {
    position[i] = data.pos[i] / 10000;
    normal[i] = data.nrm[i] / 127;
  }
  for (let i = 0; i < count * 4; i++) skinWeight[i] = data.wgt[i] / 255;
  const base = {
    position: new THREE.BufferAttribute(position, 3),
    normal: new THREE.BufferAttribute(normal, 3),
    skinIndex: new THREE.BufferAttribute(new Uint16Array(data.skin), 4),
    skinWeight: new THREE.BufferAttribute(skinWeight, 4),
    index: new THREE.BufferAttribute(count > 65535 ? new Uint32Array(data.index) : new Uint16Array(data.index), 1),
  };
  return { base, region: Uint8Array.from(data.region), count, regions: data.regions, pivots: data.pivots };
}

const REGION_ORDER = ['skin', 'shirt', 'sleeve', 'pants', 'shoes', 'hair', 'dark', 'shirtDark', 'white', 'shaft'];
const color = new THREE.Color();
const luminance = (hex) => color.set(hex).getHSL({ h: 0, s: 0, l: 0 }).l;

/** Region colors for one person's look. */
function palette(look) {
  const shirt = new THREE.Color(look.shirt);
  const skin = new THREE.Color(look.skin);
  const darkBoots = luminance(look.shoes) < 0.3;
  const pants = new THREE.Color(look.pants);
  return {
    skin,
    shirt,
    sleeve: look.shortSleeves === false ? shirt : skin,
    pants,
    shoes: new THREE.Color(look.shoes),
    hair: new THREE.Color(look.hair),
    dark: new THREE.Color('#141414'),
    shirtDark: shirt.clone().multiplyScalar(0.72),
    white: new THREE.Color('#efede6'),
    // Light sneakers: the trousers cover the ankle instead of a black boot shaft.
    shaft: darkBoots ? new THREE.Color(look.shoes) : pants,
  };
}

/** A fixed number of skinned meshes, handed to whoever is closest to the camera. */
export class DetailPool {
  constructor(scene, model, size, range) {
    this.model = model;
    this.range = range;
    this.frustum = new THREE.Frustum();
    this.matrix = new THREE.Matrix4();
    this.sphere = new THREE.Sphere();
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    this.entries = [];
    for (let i = 0; i < size; i++) this.entries.push(this.makeEntry(scene));
  }

  makeEntry(scene) {
    const { base, count, pivots } = this.model;
    const geometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(base)) {
      if (name === 'index') geometry.setIndex(attribute);
      else geometry.setAttribute(name, attribute);
    }
    const colors = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    colors.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('color', colors);
    const bones = BONES.map(() => new THREE.Bone());
    const inverses = BONES.map((name) => new THREE.Matrix4().makeTranslation(-pivots[name][0], -pivots[name][1], -pivots[name][2]));
    const mesh = new THREE.SkinnedMesh(geometry, this.material);
    mesh.frustumCulled = false; // The bones move it around, so the rest-pose bounds are wrong.
    mesh.visible = false;
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    mesh.bind(new THREE.Skeleton(bones, inverses), new THREE.Matrix4());
    return { mesh, bones, colors, person: null };
  }

  /** Give the nearest visible people (inside the camera's view) a detailed body. */
  select(people, camera) {
    this.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.matrix);
    const limit = this.range * this.range;
    const near = [];
    for (const person of people) {
      if (!person.group.visible) continue;
      const d = person.group.position.distanceToSquared(camera.position);
      if (d > limit) continue;
      this.sphere.center.set(person.group.position.x, person.group.position.y + 0.9, person.group.position.z);
      this.sphere.radius = 1.4;
      if (!this.frustum.intersectsSphere(this.sphere)) continue;
      near.push({ person, d });
    }
    near.sort((a, b) => a.d - b.d);
    const chosen = new Set(near.slice(0, this.entries.length).map((n) => n.person));
    for (const entry of this.entries) {
      if (entry.person && !chosen.has(entry.person)) this.release(entry);
    }
    for (const person of chosen) {
      if (person.detail) continue;
      const entry = this.entries.find((e) => !e.person);
      if (entry) this.assign(entry, person);
    }
  }

  assign(entry, person) {
    const colors = palette(person.look);
    const { region, count } = this.model;
    const array = entry.colors.array;
    const table = REGION_ORDER.map((name) => colors[name]);
    for (let i = 0; i < count; i++) {
      const c = table[region[i]];
      array[i * 3] = c.r;
      array[i * 3 + 1] = c.g;
      array[i * 3 + 2] = c.b;
    }
    entry.colors.needsUpdate = true;
    entry.person = person;
    person.detail = entry;
    entry.mesh.visible = true;
  }

  release(entry) {
    if (entry.person) entry.person.detail = null;
    entry.person = null;
    entry.mesh.visible = false;
  }

  /** Copy the person's joints onto the bones (the person's matrices must be up to date). */
  pose(person) {
    const entry = person.detail;
    const joints = person.joints;
    for (let i = 0; i < joints.length; i++) entry.bones[i].matrixWorld.copy(joints[i].matrixWorld);
  }
}

/** One call for a stage: load the model in the background and switch it on when ready. */
export function enableCloseUps(crowd) {
  const phone = window.matchMedia('(pointer: coarse)').matches;
  return loadCharacter().then((model) => crowd.enableDetail(model, { size: phone ? 8 : 12, range: phone ? 12 : 16 }));
}
