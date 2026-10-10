import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Joins all non-moving meshes that share a material into one mesh each.
 * A stage has hundreds of boxes; drawing them separately is too slow on phones.
 * Meshes with `userData.dynamic`, invisible hitboxes and multi-material meshes stay as they are.
 * Meshes listed in `blockers` (walls that stop the interaction ray) stay blockers after merging.
 */
export function mergeStatic(scene, blockers = []) {
  scene.updateMatrixWorld(true);
  const blockerSet = new Set(blockers);
  const buckets = new Map();
  scene.traverse((obj) => {
    if (!obj.isMesh || obj.isInstancedMesh || obj.userData.dynamic) return;
    if (Array.isArray(obj.material) || obj.material.visible === false) return;
    const key = `${obj.material.uuid}|${blockerSet.has(obj) ? 'block' : ''}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(obj);
  });

  for (const [key, meshes] of buckets) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map((mesh) => {
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      for (const name of Object.keys(geometry.attributes)) {
        if (!['position', 'normal', 'uv'].includes(name)) geometry.deleteAttribute(name);
      }
      return geometry.applyMatrix4(mesh.matrixWorld);
    });
    const merged = mergeGeometries(geometries);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, meshes[0].material);
    scene.add(mesh);
    for (const old of meshes) old.removeFromParent();
    if (key.endsWith('|block')) {
      for (const old of meshes) blockers.splice(blockers.indexOf(old), 1);
      blockers.push(mesh);
    }
  }
}
