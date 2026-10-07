/* The hero dumpling: the real model from the character study, rendered live.
   Squash-and-stretch springs, blinking and gaze follow the original study. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const hero = document.querySelector('.hero');
const canvas = document.querySelector('#dumpling');
const stage = document.querySelector('.hero-pop');
const particles = document.querySelector('.hero-particles');
const hintText = document.querySelector('.hint-text');
const reduceMotion = document.documentElement.classList.contains('reduced');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch {
  canvas.remove();
  throw new Error('WebGL unavailable; keeping the poster image.');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.5 : 2));
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
const LOOK = new THREE.Vector3(0, 1.12, 0);

const pmrem = new THREE.PMREMGenerator(renderer);
const room = new RoomEnvironment();
scene.environment = pmrem.fromScene(room, 0.04).texture;
scene.environmentIntensity = 0.6;
room.dispose();
pmrem.dispose();

scene.add(new THREE.HemisphereLight(0xfff5ff, 0x5a4660, 1.7));
const key = new THREE.DirectionalLight(0xfff3e6, 3.0);
key.position.set(-3.5, 6, 5);
scene.add(key);
const lilac = new THREE.DirectionalLight(0xc9b8ff, 2.2);
lilac.position.set(4, 3, -3);
scene.add(lilac);
const rim = new THREE.DirectionalLight(0xff9ec4, 2.4);
rim.position.set(-4, 2.5, -4);
scene.add(rim);
const fill = new THREE.DirectionalLight(0xffe1d8, 0.6);
fill.position.set(3, 1, 4);
scene.add(fill);

// Soft contact shadow painted into a canvas texture.
const shadowCanvas = document.createElement('canvas');
shadowCanvas.width = shadowCanvas.height = 128;
const sctx = shadowCanvas.getContext('2d');
const grad = sctx.createRadialGradient(64, 64, 4, 64, 64, 64);
grad.addColorStop(0, 'rgba(0,0,0,.55)');
grad.addColorStop(0.45, 'rgba(0,0,0,.25)');
grad.addColorStop(1, 'rgba(0,0,0,0)');
sctx.fillStyle = grad;
sctx.fillRect(0, 0, 128, 128);
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(3.6, 2.6),
  new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false })
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.002;
scene.add(shadow);

// Every part shares one deformation hierarchy so the face stays attached.
const turntable = new THREE.Group();
const bounceRoot = new THREE.Group();
const squashRoot = new THREE.Group();
scene.add(turntable);
turntable.add(bounceRoot);
bounceRoot.add(squashRoot);

let character = null;
let eyes = [];
let mouth = null;

const state = {
  time: 0, compression: 0, compressionVelocity: 0, targetCompression: 0,
  bounce: 0, bounceVelocity: 0, angle: 0, targetAngle: 0,
  gazeX: 0, gazeY: 0, targetGazeX: 0, targetGazeY: 0,
  happyUntil: 0, nextBlink: 2.3, blinkStart: -10,
  spin: null, jumpRequested: false, jumpLaunchAt: 0,
  lastInteraction: 0, nextIdleHop: 7, interactions: 0,
};

function findPart(model, name) {
  const wanted = name.replace(/[._-]/g, '').toLowerCase();
  let found;
  model.traverse(o => { if (!found && o.name.replace(/[._-]/g, '').toLowerCase() === wanted) found = o; });
  return found;
}

function setupCharacter(model) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model, true);
  const size = bounds.getSize(new THREE.Vector3());
  model.scale.multiplyScalar(2.4 / Math.max(size.y, 0.001));
  model.updateMatrixWorld(true);
  const nb = new THREE.Box3().setFromObject(model, true);
  const center = nb.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= nb.min.y;
  squashRoot.add(model);
  model.updateMatrixWorld(true);

  for (const side of ['L', 'R']) {
    const eye = findPart(model, `Eye.${side}`);
    if (!eye) continue;
    const worldCenter = new THREE.Box3().setFromObject(eye, true).getCenter(new THREE.Vector3());
    const pivot = new THREE.Group();
    model.add(pivot);
    pivot.position.copy(model.worldToLocal(worldCenter));
    pivot.updateMatrixWorld(true);
    pivot.attach(eye);
    for (const name of ['Pupil', 'Highlight', 'Sparkle']) {
      const part = findPart(model, `${name}.${side}`);
      if (part && part !== eye) pivot.attach(part);
    }
    eyes.push({ pivot, home: pivot.position.clone() });
  }
  mouth = findPart(model, 'Mouth');
  if (mouth) mouth.userData.homeScale = mouth.scale.clone();
  character = model;
}

function hearts(count = 5, stars = false) {
  if (reduceMotion || !particles) return;
  const point = new THREE.Vector3(0, 2.1 + state.bounce, 0).project(camera);
  const w = stage.clientWidth, h = stage.clientHeight;
  const cx = (point.x * 0.5 + 0.5) * w;
  const cy = (-point.y * 0.5 + 0.5) * h;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = `heart${stars ? ' star' : ''}`;
    p.textContent = stars ? '✦' : '♥';
    p.style.left = `${cx + (Math.random() - 0.5) * w * 0.32}px`;
    p.style.top = `${cy + Math.random() * h * 0.08}px`;
    p.style.setProperty('--drift', `${(Math.random() - 0.5) * 90}px`);
    p.style.setProperty('--spin', `${(Math.random() - 0.5) * 60}deg`);
    p.style.animationDelay = `${i * 0.08}s`;
    particles.append(p);
    p.addEventListener('animationend', () => p.remove(), { once: true });
  }
}

const HINTS = {
  squish: 'Squiiish… now let go.',
  boing: 'Boing! Drag sideways to spin it.',
  spin: 'Every side is a good side.',
  pet: 'Hmm, that felt nice.',
};
let hintTimer;
function hint(key) {
  if (!hintText) return;
  const box = hintText.parentElement;
  hintText.textContent = HINTS[key];
  box.classList.add('is-live');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => {
    box.classList.remove('is-live');
    hintText.textContent = 'the dumpling. It’s a real-time model from my character study.';
  }, 4200);
}

function touch() {
  state.lastInteraction = state.time;
  state.nextIdleHop = state.time + 9;
  state.interactions++;
}

function jump() {
  if (state.bounce > 0.06 || state.jumpRequested) return;
  state.jumpRequested = true;
  state.jumpLaunchAt = state.time + 0.16;
  state.targetCompression = reduceMotion ? 0.04 : 0.17;
}

function pet() {
  state.happyUntil = state.time + 2;
  state.compressionVelocity += 0.85;
  state.nextBlink = state.time;
  hearts(5);
  hint('pet');
}

// ---------------------------------------------------------------- input
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let drag = null;

function toNDC(event) {
  const r = canvas.getBoundingClientRect();
  pointer.set(((event.clientX - r.left) / r.width) * 2 - 1, -((event.clientY - r.top) / r.height) * 2 + 1);
}

// The eyes follow the cursor anywhere over the hero, not only over the canvas.
hero.addEventListener('pointermove', event => {
  const r = canvas.getBoundingClientRect();
  state.targetGazeX = THREE.MathUtils.clamp(((event.clientX - r.left) / r.width) * 2 - 1, -1.4, 1.4);
  state.targetGazeY = THREE.MathUtils.clamp(-(((event.clientY - r.top) / r.height) * 2 - 1), -1.4, 1.4);
}, { passive: true });
hero.addEventListener('pointerleave', () => { state.targetGazeX = 0; state.targetGazeY = 0; });

canvas.addEventListener('pointerdown', event => {
  if (drag || !character) return;
  toNDC(event);
  raycaster.setFromCamera(pointer, camera);
  const onCharacter = raycaster.intersectObject(character, true).length > 0;
  drag = { id: event.pointerId, startX: event.clientX, previousX: event.clientX, distance: 0, character: onCharacter, turning: false, type: event.pointerType };
  if (event.pointerType === 'mouse') canvas.setPointerCapture(event.pointerId);
  state.spin = null;
  touch();
  if (onCharacter) {
    state.targetCompression = reduceMotion ? 0.1 : 0.32;
    hint('squish');
  }
});

canvas.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.id) return;
  const dx = event.clientX - drag.previousX;
  drag.distance += Math.abs(dx);
  if (Math.abs(event.clientX - drag.startX) > 12 || !drag.character) {
    drag.turning = true;
    state.targetAngle += dx * 0.01;
    state.targetCompression = 0;
  }
  if (drag.character && drag.distance > 200 && Math.random() < 0.05) hearts(1);
  drag.previousX = event.clientX;
});

function release(event, cancelled = false) {
  if (!drag || event.pointerId !== drag.id) return;
  if (!cancelled && drag.character && !drag.turning) {
    state.compressionVelocity -= reduceMotion ? 0.3 : 1.35;
    state.happyUntil = state.time + 0.8;
    hearts(3, true);
    hint(state.interactions % 4 === 0 ? 'pet' : 'boing');
    if (state.interactions % 4 === 0) pet();
  } else if (drag.turning) {
    hint('spin');
  }
  state.targetCompression = 0;
  if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  drag = null;
}
canvas.addEventListener('pointerup', e => release(e));
canvas.addEventListener('pointercancel', e => release(e, true));
canvas.addEventListener('lostpointercapture', e => { if (drag && drag.id === e.pointerId) release(e, true); });
canvas.addEventListener('keydown', event => {
  if (event.code === 'Space') { event.preventDefault(); touch(); jump(); }
  if (event.key.toLowerCase() === 'c') { touch(); pet(); }
  if (event.code === 'ArrowLeft') { event.preventDefault(); touch(); state.targetAngle -= 0.3; }
  if (event.code === 'ArrowRight') { event.preventDefault(); touch(); state.targetAngle += 0.3; }
});
addEventListener('blur', () => { drag = null; state.targetCompression = 0; });
addEventListener('hero:intro', () => { state.nextIdleHop = state.time + 0.6; });

// ---------------------------------------------------------------- layout
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.position.set(0, 2.35, 7.1);
  camera.lookAt(LOOK);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

// ---------------------------------------------------------------- loop
let visible = true;
new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0 }).observe(hero);

let last = performance.now();
let lastScroll = scrollY;
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(Math.max((now - last) / 1000, 0), 0.1);
  last = now;
  if (!visible || document.hidden || !character) return;
  state.time += dt;
  const t = state.time;

  // Scrolling nudges the spring, so the dumpling wobbles as the page moves.
  const sy = scrollY;
  const scrollDelta = sy - lastScroll;
  lastScroll = sy;
  if (!reduceMotion && Math.abs(scrollDelta) > 0.5) state.compressionVelocity += THREE.MathUtils.clamp(scrollDelta * 0.004, -0.25, 0.25);

  // A little hop now and then invites a first squeeze.
  if (!reduceMotion && t > state.nextIdleHop && !drag) {
    jump();
    state.nextIdleHop = t + 7 + Math.random() * 4;
  }

  const stiffness = 105, damping = reduceMotion ? 21 : 9;
  let remaining = dt;
  let simTime = t - dt;
  while (remaining > 1e-6) {
    const step = Math.min(remaining, 0.016);
    simTime += step;
    if (state.jumpRequested && simTime >= state.jumpLaunchAt) {
      state.jumpRequested = false;
      state.targetCompression = 0;
      state.bounceVelocity = reduceMotion ? 1.1 : 3.4;
      state.compressionVelocity = -1.2;
      hearts(2, true);
    }
    if (state.bounce > 0 || state.bounceVelocity > 0) {
      state.bounceVelocity -= 10.5 * step;
      state.bounce += state.bounceVelocity * step;
      if (state.bounce <= 0) {
        state.bounce = 0;
        state.compressionVelocity += Math.min(2.4, Math.abs(state.bounceVelocity) * 0.72);
        state.bounceVelocity = 0;
        state.nextBlink = t;
      }
    }
    const acc = (state.targetCompression - state.compression) * stiffness - state.compressionVelocity * damping;
    state.compressionVelocity += acc * step;
    state.compression = THREE.MathUtils.clamp(state.compression + state.compressionVelocity * step, -0.2, 0.44);
    remaining -= step;
  }

  const happy = t < state.happyUntil;
  const breathing = reduceMotion ? 0 : Math.sin(t * 1.7) * 0.012;
  const yScale = 1 - state.compression + breathing;
  const xz = 1 / Math.sqrt(Math.max(yScale, 0.4));
  squashRoot.scale.set(xz, yScale, xz);
  squashRoot.rotation.z = reduceMotion ? 0 : Math.sin(t * 1.15) * 0.014 + (happy ? Math.sin(t * 7) * 0.024 : 0);
  bounceRoot.position.y = state.bounce;

  if (state.spin) {
    const p = Math.min((t - state.spin.start) / state.spin.duration, 1);
    state.angle = state.spin.from + Math.PI * 2 * (p * p * (3 - 2 * p));
    state.targetAngle = state.angle;
    if (p === 1) state.spin = null;
  } else {
    state.angle += (state.targetAngle - state.angle) * (1 - Math.exp(-12 * dt));
  }
  const scrollTurn = Math.min(sy / innerHeight, 1.2) * 1.4;
  const sway = reduceMotion || drag ? 0 : Math.sin(t * 0.8) * 0.06 + state.gazeX * 0.22;
  turntable.rotation.y = state.angle + sway + scrollTurn;
  turntable.rotation.x = reduceMotion ? 0 : -state.gazeY * 0.05;

  state.gazeX += (state.targetGazeX - state.gazeX) * (1 - Math.exp(-6 * dt));
  state.gazeY += (state.targetGazeY - state.gazeY) * (1 - Math.exp(-6 * dt));

  if (t >= state.nextBlink) {
    state.blinkStart = t;
    state.nextBlink = t + 2.2 + Math.random() * 3.8;
  }
  const age = t - state.blinkStart;
  let blink = age < 0.18 ? Math.sin(Math.PI * age / 0.18) : 0;
  if (happy) blink = Math.max(blink, 0.75 + Math.sin(t * 3) * 0.05);
  for (const eye of eyes) {
    eye.pivot.scale.y = 1 - blink * 0.95;
    eye.pivot.position.copy(eye.home);
    eye.pivot.position.x += state.gazeX * 0.02;
    eye.pivot.position.y += state.gazeY * 0.014;
  }
  if (mouth) {
    mouth.scale.copy(mouth.userData.homeScale);
    if (happy) mouth.scale.x *= 1.1;
  }
  shadow.scale.setScalar(1 + state.compression * 0.18 - state.bounce * 0.12);
  shadow.material.opacity = Math.max(0.25, 1 - state.bounce * 0.6);

  renderer.render(scene, camera);
}

new GLTFLoader().load('models/dumpling.glb', gltf => {
  setupCharacter(gltf.scene);
  resize();
  requestAnimationFrame(t => { last = t; requestAnimationFrame(animate); });
  hero.classList.add('model-ready');
  state.compressionVelocity = 1.6; // land with a wobble
}, undefined, error => {
  console.warn('Dumpling model failed to load; keeping the poster image.', error);
});
