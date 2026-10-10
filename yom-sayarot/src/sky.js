import * as THREE from 'three';

// Sky, sun/moon and stars for each part of the two days.
const PRESETS = {
  afternoon: { top: '#3d82d0', horizon: '#d8e7ef', sun: [-0.5, 0.65, -0.35], sunColor: '#fff1d6', sunIntensity: 2.3, hemi: 1.25, stars: 0, flood: 0, fogFar: 260 },
  dusk: { top: '#25365f', horizon: '#f0a35e', sun: [-0.85, 0.07, -0.3], sunColor: '#ffb070', sunIntensity: 1.3, hemi: 0.65, stars: 0.15, flood: 0.4, fogFar: 220 },
  night: { top: '#03050c', horizon: '#141a2e', sun: [0.35, 0.6, 0.4], sunColor: '#a9bcff', sunIntensity: 0.22, hemi: 0.18, stars: 1, flood: 1, fogFar: 160 },
  dawn: { top: '#2f4675', horizon: '#f3b48a', sun: [0.85, 0.08, -0.2], sunColor: '#ffc08a', sunIntensity: 1.1, hemi: 0.6, stars: 0.25, flood: 0.5, fogFar: 220 },
  day: { top: '#3a7fd1', horizon: '#e6eef2', sun: [0.25, 0.9, 0.2], sunColor: '#fff6e5', sunIntensity: 2.6, hemi: 1.45, stars: 0, flood: 0, fogFar: 280 },
};

export function createSky(scene, floodlights) {
  const uniforms = {
    top: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3() },
    sunColor: { value: new THREE.Color() },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 top;
        uniform vec3 horizon;
        uniform vec3 sunDir;
        uniform vec3 sunColor;
        varying vec3 vDir;
        void main() {
          vec3 dir = normalize(vDir);
          vec3 col = mix(horizon, top, smoothstep(-0.02, 0.45, dir.y));
          float s = max(dot(dir, normalize(sunDir)), 0.0);
          col += sunColor * (pow(s, 700.0) * 1.6 + pow(s, 10.0) * 0.25);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    }),
  );
  dome.renderOrder = -2;
  scene.add(dome);

  // Stars: random points on the upper half of a big sphere.
  const starPositions = new Float32Array(1500 * 3);
  for (let i = 0; i < 1500; i++) {
    const theta = Math.random() * Math.PI * 2;
    const y = 0.08 + Math.random() * 0.92;
    const r = Math.sqrt(1 - y * y);
    starPositions.set([Math.cos(theta) * r * 380, y * 380, Math.sin(theta) * r * 380], i * 3);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({ color: '#ffffff', size: 1.4, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false }),
  );
  scene.add(stars);

  const hemi = new THREE.HemisphereLight('#ffffff', '#b59a6e', 1);
  const sun = new THREE.DirectionalLight('#ffffff', 1);
  scene.add(hemi, sun, sun.target);
  scene.fog = new THREE.Fog('#ffffff', 40, 260);

  function setTime(name) {
    const p = PRESETS[name];
    uniforms.top.value.set(p.top);
    uniforms.horizon.value.set(p.horizon);
    uniforms.sunDir.value.set(...p.sun).normalize();
    uniforms.sunColor.value.set(p.sunColor);
    sun.color.set(p.sunColor);
    sun.intensity = p.sunIntensity;
    sun.position.copy(uniforms.sunDir.value).multiplyScalar(100);
    hemi.intensity = p.hemi;
    hemi.color.set(name === 'night' ? '#8fa2d6' : '#ffffff');
    stars.material.opacity = p.stars;
    stars.visible = p.stars > 0;
    scene.fog.color.set(p.horizon);
    scene.fog.far = p.fogFar;
    floodlights.setPower(p.flood);
  }

  function update(camera) {
    dome.position.copy(camera.position);
    stars.position.copy(camera.position);
  }

  return { setTime, update };
}
