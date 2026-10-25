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
