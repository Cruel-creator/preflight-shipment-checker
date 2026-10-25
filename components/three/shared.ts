import * as THREE from 'three';

/** Spring from the animation guide: critically-damped-ish follow used for pointer parallax and pops. */
export class Spring {
  position = 0;
  velocity = 0;
  target = 0;
  constructor(public stiffness = 90, public damping = 12) {}
  update(dt: number) {
    const force = -this.stiffness * (this.position - this.target);
    const damp = -this.damping * this.velocity;
    this.velocity += (force + damp) * dt;
    this.position += this.velocity * dt;
    return this.position;
  }
}

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function disposeScene(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose?.();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
      (x as THREE.MeshBasicMaterial).map?.dispose?.();
      x.dispose();
    });
  });
}

/** Cardboard parcel with tape and a printed shipping label. */
export function makeParcel(w = 0.2, h = 0.14, d = 0.16, label = true): THREE.Group {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: 0xc89b62 }));
  g.add(box);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(w * 0.18, h * 1.012, d * 1.012), new THREE.MeshLambertMaterial({ color: 0xe9d6ab }));
  g.add(tape);
  if (label) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 160;
    const x = c.getContext('2d')!;
    x.fillStyle = '#fffdf6'; x.fillRect(0, 0, 256, 160);
    x.fillStyle = '#12284c'; x.fillRect(0, 0, 256, 34);
    x.fillStyle = '#ff6a1a'; x.font = 'bold 22px sans-serif'; x.fillText('MERIDIAN', 12, 25);
    x.fillStyle = '#12284c'; x.font = '14px monospace'; x.fillText('UK  →  EU  ·  PALLET 3/4', 12, 60);
    for (let i = 0, px = 12; px < 240; i++) { const bw = 2 + ((i * 7) % 4); x.fillRect(px, 78, bw, 52); px += bw + 2 + ((i * 5) % 3); }
    x.font = '11px monospace'; x.fillText('MF 4821 0937 55', 12, 150);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.55, h * 0.62), new THREE.MeshBasicMaterial({ map: tex }));
    lab.position.set(-w * 0.2, 0, d / 2 + 0.002);
    g.add(lab);
  }
  return g;
}

export function circleTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.beginPath(); x.arc(32, 32, 32, 0, Math.PI * 2); x.fill();
  return new THREE.CanvasTexture(c);
}

/** Smooth damping from the animation guide (critically damped follow), per axis. */
export function smoothDamp(current: number, target: number, vel: { v: number }, smoothTime: number, dt: number) {
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (vel.v + omega * change) * dt;
  vel.v = (vel.v - omega * temp) * exp;
  return target + (change + temp) * exp;
}

/**
 * Parcel whose lid opens through a MORPH TARGET. The lid is a flat quad hinged at the back edge;
 * its single morph target is the same quad rotated open. A NumberKeyframeTrack drives
 * `.morphTargetInfluences[0]`, a BooleanKeyframeTrack reveals the shipment inside, and an
 * ADDITIVE "breathe" clip squashes the box on top of whatever else is playing.
 */
export function makeOpenParcel(w = 0.22, h = 0.15, d = 0.18) {
  const holder = new THREE.Group();
  const parcel = new THREE.Group();
  parcel.name = 'parcel';
  holder.add(parcel);

  const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: 0xc89b62 }));
  parcel.add(base);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(w * 0.16, h * 1.01, d * 1.01), new THREE.MeshLambertMaterial({ color: 0xe9d6ab }));
  parcel.add(tape);

  const lidGeo = new THREE.PlaneGeometry(w, d, 1, 1);
  lidGeo.rotateX(-Math.PI / 2);
  lidGeo.translate(0, 0, d / 2); // hinge at z = 0
  const open = lidGeo.attributes.position.clone();
  const v = new THREE.Vector3();
  for (let i = 0; i < open.count; i++) {
    v.fromBufferAttribute(open, i).applyAxisAngle(new THREE.Vector3(1, 0, 0), -2.05);
    open.setXYZ(i, v.x, v.y, v.z);
  }
  lidGeo.morphAttributes.position = [open];
  const lid = new THREE.Mesh(lidGeo, new THREE.MeshLambertMaterial({ color: 0xd9ad72, side: THREE.DoubleSide }));
  lid.name = 'lid';
  lid.position.set(0, h / 2 + 0.001, -d / 2);
  lid.updateMorphTargets();
  parcel.add(lid);

  const item = new THREE.Mesh(new THREE.OctahedronGeometry(Math.min(w, d) * 0.22), new THREE.MeshBasicMaterial({ color: 0xff6a1a }));
  item.name = 'item';
  item.position.set(0, h / 2 + 0.03, 0);
  item.visible = false;
  parcel.add(item);

  const lidClip = new THREE.AnimationClip('open-lid', 4.4, [
    new THREE.NumberKeyframeTrack('lid.morphTargetInfluences[0]', [0, 0.9, 1.4, 3.0, 3.6, 4.4], [0, 0, 1, 1, 0, 0]),
    new THREE.BooleanKeyframeTrack('item.visible', [0, 1.3, 3.1], [false, true, false]),
    new THREE.VectorKeyframeTrack('item.position', [1.3, 2.1, 3.0], [0, h / 2 + 0.01, 0, 0, h / 2 + 0.09, 0, 0, h / 2 + 0.01, 0]),
  ]);
  lidClip.tracks[0].setInterpolation(THREE.InterpolateSmooth);
  lidClip.optimize();

  const breathe = new THREE.AnimationClip('breathe', 2, [
    new THREE.VectorKeyframeTrack('.scale', [0, 1, 2], [1, 1, 1, 1.05, 0.95, 1.05, 1, 1, 1]),
  ]);
  THREE.AnimationUtils.makeClipAdditive(breathe);

  const mixer = new THREE.AnimationMixer(parcel);
  const lidAction = mixer.clipAction(lidClip);
  lidAction.play();
  const breatheAction = mixer.clipAction(breathe);
  breatheAction.blendMode = THREE.AdditiveAnimationBlendMode;
  breatheAction.play();

  return { holder, parcel, mixer, lidAction, breatheAction };
}
