'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import land from '@/lib/data/landDots.json';
import { circleTexture, disposeScene, makeOpenParcel, prefersReducedMotion, smoothDamp, Spring } from './shared';

const ll = (lat: number, lon: number, r = 1) => {
  const p = (lat * Math.PI) / 180, l = (lon * Math.PI) / 180;
  return new THREE.Vector3(r * Math.cos(p) * Math.sin(l), r * Math.sin(p), r * Math.cos(p) * Math.cos(l));
};
const CITY: Record<string, [number, number]> = {
  London: [51.5, -0.1], Manchester: [53.5, -2.2], Birmingham: [52.5, -1.9], Leeds: [53.8, -1.55],
  Berlin: [52.5, 13.4], Frankfurt: [50.1, 8.7], Hamburg: [53.55, 10], Paris: [48.86, 2.35], Lyon: [45.76, 4.84], Amsterdam: [52.37, 4.9], Rotterdam: [51.92, 4.48],
};
const ORIGINS = ['London', 'Manchester', 'Birmingham', 'Leeds'];
const LANES: [string, string, 'road' | 'air'][] = [
  ['London', 'Paris', 'road'], ['London', 'Amsterdam', 'road'], ['Manchester', 'Frankfurt', 'road'],
  ['Birmingham', 'Lyon', 'road'], ['Leeds', 'Hamburg', 'road'], ['Manchester', 'Rotterdam', 'road'], ['London', 'Berlin', 'air'],
];

function arc(a: THREE.Vector3, b: THREE.Vector3, lift: number, seg = 72) {
  const w = a.angleTo(b), pts: THREE.Vector3[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const p = a.clone().multiplyScalar(Math.sin((1 - t) * w) / Math.sin(w)).add(b.clone().multiplyScalar(Math.sin(t * w) / Math.sin(w)));
    pts.push(p.normalize().multiplyScalar(1 + 0.006 + Math.sin(Math.PI * t) * lift));
  }
  return new THREE.CatmullRomCurve3(pts);
}

/** Put an object on a curve with its up-axis along the surface normal and +z along travel. */
function place(o: THREE.Object3D, c: THREE.CatmullRomCurve3, t: number) {
  const p = c.getPointAt(t), tan = c.getTangentAt(t);
  const up = p.clone().normalize();
  const x = new THREE.Vector3().crossVectors(up, tan).normalize();
  const y = new THREE.Vector3().crossVectors(tan, x).normalize();
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, tan));
  o.position.copy(p);
}

/** Rigged truck: named wheels + body so AnimationClips can drive them. */
function makeTruck() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  body.name = 'body';
  g.add(body);
  const cargo = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.03, 0.07), new THREE.MeshLambertMaterial({ color: 0xf6f3ea }));
  cargo.position.set(0, 0.026, -0.014);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.0346, 0.008, 0.0702), new THREE.MeshLambertMaterial({ color: 0xff6a1a }));
  stripe.position.set(0, 0.018, -0.014);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.022, 0.024), new THREE.MeshLambertMaterial({ color: 0xff6a1a }));
  cab.position.set(0, 0.022, 0.037);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.0325, 0.008, 0.008), new THREE.MeshBasicMaterial({ color: 0x9cc7ff }));
  glass.position.set(0, 0.028, 0.046);
  body.add(cargo, stripe, cab, glass);
  const wheelGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.006, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0d1424 });
  const wheels: THREE.Mesh[] = [];
  [[-0.018, -0.03], [0.018, -0.03], [-0.018, 0.0], [0.018, 0.0], [-0.017, 0.04], [0.017, 0.04]].forEach(([x, z], i) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.name = `w${i}`;
    w.position.set(x, 0.007, z);
    g.add(w);
    wheels.push(w);
  });
  g.scale.setScalar(0.3);
  return { g, wheels };
}

/** Wheel-spin + body-bob "drive" clip and a low "idle" rumble clip, blended with crossFadeTo. */
function truckClips(wheels: THREE.Mesh[]) {
  const times = [0, 0.125, 0.25, 0.375, 0.5];
  const spin = wheels.map((w) => {
    const q = (a: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
    const vals = [0, 1, 2, 3, 4].flatMap((k) => { const e = q((k * Math.PI) / 2); return [e.x, e.y, e.z, e.w]; });
    return new THREE.QuaternionKeyframeTrack(`${w.name}.quaternion`, times, vals);
  });
  const bob = new THREE.VectorKeyframeTrack('body.position', times, [0, 0, 0, 0, 0.0016, 0, 0, 0, 0, 0, 0.0012, 0, 0, 0, 0]);
  const drive = new THREE.AnimationClip('drive', 0.5, [...spin, bob]);
  const rumble = new THREE.VectorKeyframeTrack('body.position', [0, 0.15, 0.3, 0.45, 0.6], [0, 0, 0, 0.0004, 0.0005, 0, 0, 0, 0.0003, -0.0004, 0.0003, 0, 0, 0, 0]);
  const idle = new THREE.AnimationClip('idle', 0.6, [rumble]);
  drive.optimize();
  return { drive, idle };
}

class Truck {
  g: THREE.Group;
  mixer: THREE.AnimationMixer;
  drive: THREE.AnimationAction;
  idle: THREE.AnimationAction;
  state: 'drive' | 'dock' = 'drive';
  hold = 0;
  constructor(public curve: THREE.CatmullRomCurve3, public t: number, public speed: number) {
    const { g, wheels } = makeTruck();
    this.g = g;
    const { drive, idle } = truckClips(wheels);
    this.mixer = new THREE.AnimationMixer(g);
    this.drive = this.mixer.clipAction(drive);
    this.idle = this.mixer.clipAction(idle);
    this.drive.play();
    this.idle.play();
    this.idle.setEffectiveWeight(0);
  }
  update(dt: number) {
    if (this.state === 'drive') {
      this.t += this.speed * dt;
      this.drive.timeScale = 1 + this.speed * 8;
      if (this.t >= 0.985) {
        this.t = 0.985;
        this.state = 'dock';
        this.hold = 1.4 + Math.random() * 0.8;
        this.drive.crossFadeTo(this.idle.reset().play(), 0.35, false); // unload at the destination
      }
    } else {
      this.hold -= dt;
      if (this.hold <= 0) {
        this.t = 0.01;
        this.state = 'drive';
        this.idle.crossFadeTo(this.drive.reset().play(), 0.35, false);
      }
    }
    place(this.g, this.curve, this.t);
    this.mixer.update(dt);
  }
}

function makePlane(): THREE.Group {
  const g = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.11, 12), white);
  body.rotation.x = Math.PI / 2;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 12), white);
  nose.rotation.x = Math.PI / 2; nose.position.z = 0.07;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.003, 0.03), new THREE.MeshLambertMaterial({ color: 0xdfe8f7 }));
  wing.position.z = 0.005;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.03, 0.022), new THREE.MeshLambertMaterial({ color: 0xff6a1a }));
  tail.position.set(0, 0.015, -0.05);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.003, 0.016), white);
  stab.position.z = -0.05;
  g.add(body, nose, wing, tail, stab);
  g.scale.setScalar(0.34);
  return g;
}

export default function HeroScene({ className = '', framing = 'banner' }: { className?: string; framing?: 'banner' | 'tile' }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      return; // no WebGL: the CSS gradient behind stays as the fallback
    }
    const reduced = prefersReducedMotion();
    const tile = framing === 'tile';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-2, 2.5, 4);
    scene.add(sun);

    const globe = new THREE.Group();
    scene.add(globe);

    // ocean + atmosphere glow
    globe.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshBasicMaterial({ color: 0x0f2a55 })));
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.14, 48, 32),
      new THREE.ShaderMaterial({
        transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec3 n; void main(){ n = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'varying vec3 n; void main(){ float i = pow(0.62 - dot(n, vec3(0.,0.,1.)), 3.0); gl_FragColor = vec4(1.0,0.42,0.1,1.0)*i*0.9; }',
      }),
    );
    scene.add(glow);

    // graticule
    const grat: number[] = [];
    for (let lat = -60; lat <= 80; lat += 20) for (let lon = -180; lon < 180; lon += 4) { const a = ll(lat, lon, 1.002), b = ll(lat, lon + 4, 1.002); grat.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    for (let lon = -180; lon < 180; lon += 20) for (let lat = -80; lat < 80; lat += 4) { const a = ll(lat, lon, 1.002), b = ll(lat + 4, lon, 1.002); grat.push(a.x, a.y, a.z, b.x, b.y, b.z); }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(grat, 3));
    globe.add(new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: 0x2f5aa8, transparent: true, opacity: 0.22 })));

    // land as dots — Europe lit brighter
    const dotTex = circleTexture();
    const lp: number[] = [], lc: number[] = [];
    const eu = ll(50, 8), bright = new THREE.Color(0xe7f0ff), dim = new THREE.Color(0x6f95de);
    for (let i = 0; i < land.length; i += 2) {
      const v = ll(land[i], land[i + 1], 1.004);
      lp.push(v.x, v.y, v.z);
      const k = THREE.MathUtils.clamp(1 - v.clone().normalize().angleTo(eu) / 0.55, 0, 1);
      const c = dim.clone().lerp(bright, k);
      lc.push(c.r, c.g, c.b);
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    lg.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3));
    globe.add(new THREE.Points(lg, new THREE.PointsMaterial({ size: 0.0098, map: dotTex, vertexColors: true, transparent: true, alphaTest: 0.2, depthWrite: false })));

    // cities with pulsing rings
    const rings: { m: THREE.Mesh; o: number }[] = [];
    Object.entries(CITY).forEach(([name, [lat, lon]], i) => {
      const origin = ORIGINS.includes(name);
      const pos = ll(lat, lon, 1.01);
      const pin = new THREE.Mesh(new THREE.SphereGeometry(origin ? 0.0065 : 0.0048, 12, 12), new THREE.MeshBasicMaterial({ color: origin ? 0xff6a1a : 0xffffff }));
      pin.position.copy(pos);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.008, 0.0105, 32), new THREE.MeshBasicMaterial({ color: origin ? 0xff6a1a : 0xcfe0ff, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      ring.position.copy(pos);
      ring.lookAt(pos.clone().multiplyScalar(2));
      globe.add(pin, ring);
      rings.push({ m: ring, o: i * 0.7 });
    });

    // lanes, vehicles, packets
    type Mover = { obj: THREE.Object3D; curve: THREE.CatmullRomCurve3; speed: number; t: number };
    const movers: Mover[] = [];
    const packets: Mover[] = [];
    const trucks: Truck[] = [];
    let planeCurve: THREE.CatmullRomCurve3 | null = null;
    let plane: THREE.Group | null = null;
    const trailN = 44;
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(trailN * 3), 3));
    const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
    trail.frustumCulled = false;
    const trailPts: THREE.Vector3[] = [];

    LANES.forEach(([a, b, kind], i) => {
      const curve = arc(ll(...CITY[a]), ll(...CITY[b]), kind === 'air' ? 0.2 : 0.045);
      const geo = new THREE.TubeGeometry(curve, 80, kind === 'air' ? 0.0011 : 0.0016, 6, false);
      globe.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: kind === 'air' ? 0xcfe0ff : 0xff6a1a, transparent: true, opacity: kind === 'air' ? 0.5 : 0.7 })));
      if (kind === 'road') {
        const tr = new Truck(curve, (i * 0.17) % 0.9, 0.045 + (i % 3) * 0.008);
        globe.add(tr.g);
        trucks.push(tr);
      } else {
        planeCurve = curve;
        plane = makePlane();
        globe.add(plane, trail);
      }
      for (let k = 0; k < 3; k++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.0032, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffd0b0 }));
        globe.add(s);
        packets.push({ obj: s, curve, speed: 0.11, t: (k / 3 + i * 0.13) % 1 });
      }
    });
    let planeT = 0;

    // floating parcels: float clip (holder) + lid MORPH target + ADDITIVE breathing (parcel), mixer events
    const floaters: { mixer: THREE.AnimationMixer; float: THREE.AnimationMixer; pop: Spring; holder: THREE.Group; base: number }[] = [];
    const spots: [number, number, number, number, number][] = tile
      ? [[0.24, 0.2, 1.3, 0, 0.3], [0.08, -0.3, 1.35, 2.2, 0.26]]
      : [[0.3, 0.14, 1.3, 0, 0.26], [0.22, -0.15, 1.35, 2.2, 0.22]];
    spots.forEach(([x, y, z, phase, sc], i) => {
      const { holder, mixer, lidAction } = makeOpenParcel();
      holder.scale.setScalar(sc);
      scene.add(holder);
      const times = [0, 2, 4];
      const pos = new THREE.VectorKeyframeTrack('.position', times, [x, y, z, x + 0.012, y + 0.035, z, x, y, z]);
      pos.setInterpolation(THREE.InterpolateSmooth);
      const q = (rx: number, ry: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0.1 * (i + 1)));
      const qs = [q(0.5, 0.5), q(0.55, 2.4), q(0.5, 0.5 + Math.PI * 2)];
      const rot = new THREE.QuaternionKeyframeTrack('.quaternion', times, qs.flatMap((e) => [e.x, e.y, e.z, e.w]));
      const float = new THREE.AnimationMixer(holder);
      const fa = float.clipAction(new THREE.AnimationClip(`float${i}`, 4, [pos, rot]));
      fa.time = phase;
      fa.play();
      lidAction.time = phase * 0.6;
      const pop = new Spring(170, 9);
      mixer.addEventListener('loop', () => { pop.velocity = 2.4; }); // pop each time the lid cycle restarts
      floaters.push({ mixer, float, pop, holder, base: sc });
    });

    // drifting dust
    const dust: number[] = [];
    for (let i = 0; i < 260; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(1.5 + Math.random() * 2.4); dust.push(v.x, v.y, v.z); }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(dust, 3));
    const dustPts = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.02, map: dotTex, color: 0xaecbff, transparent: true, opacity: 0.55, depthWrite: false }));
    scene.add(dustPts);

    // face Europe
    const lat0 = (51 * Math.PI) / 180, lon0 = (5 * Math.PI) / 180;
    const sx = new Spring(60, 9), sy = new Spring(60, 9);
    let wide = true;
    const baseCam = new THREE.Vector3(0, 0, 2);
    const camX = { v: 0 }, camY = { v: 0 };

    const resize = () => {
      const w = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      wide = w / h > 1.15;
      // Zoomed in so the UK–EU lanes are readable; the globe bleeds off the frame like a hero banner.
      const fit = tile ? THREE.MathUtils.clamp(2.2 / Math.max(camera.aspect, 0.8), 2.1, 2.7) : wide ? 2.0 : THREE.MathUtils.clamp(1.7 / camera.aspect, 1.9, 3.8);
      baseCam.set(0, 0, fit);
      camera.position.copy(baseCam);
      camera.lookAt(0, 0, 0);
      globe.position.set(tile ? 0.34 : wide ? 0.18 : 0, tile ? 0.04 : wide ? -0.03 : 0.3, 0);
      glow.position.copy(globe.position);
      camera.updateProjectionMatrix();
      if (reduced) renderer.render(scene, camera);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      sx.target = ((e.clientX - r.left) / r.width - 0.5) * 0.5;
      sy.target = ((e.clientY - r.top) / r.height - 0.5) * 0.3;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const clock = new THREE.Clock();
    let raf = 0, visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 });
    io.observe(el);

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) { clock.getDelta(); return; }
      const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
      globe.rotation.set(lat0 + sy.update(dt) * 0.6, -lon0 + Math.sin(t * 0.18) * (tile ? 0.1 : 0.32) + sx.update(dt), 0);
      glow.rotation.copy(globe.rotation);
      camera.position.x = smoothDamp(camera.position.x, baseCam.x + sx.target * 0.4, camX, 0.5, dt); // damped camera follow
      camera.position.y = smoothDamp(camera.position.y, baseCam.y - sy.target * 0.5, camY, 0.5, dt);
      camera.lookAt(globe.position.x * 0.5, globe.position.y * 0.5, 0);
      dustPts.rotation.y = t * 0.012;
      rings.forEach(({ m, o }) => { const k = ((t * 0.6 + o) % 1); m.scale.setScalar(1 + k * 1.8); (m.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.8; });
      trucks.forEach((tr) => tr.update(dt));
      packets.forEach((m) => { m.t = (m.t + m.speed * dt) % 1; m.obj.position.copy(m.curve.getPointAt(m.t)); });
      if (plane && planeCurve) {
        planeT = (planeT + 0.035 * dt) % 1;
        place(plane, planeCurve, planeT);
        plane.rotateZ(Math.sin(t * 1.5) * 0.12);
        trailPts.unshift(plane.position.clone());
        if (trailPts.length > trailN) trailPts.pop();
        const arr = trailGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < trailN; i++) { const p = trailPts[Math.min(i, trailPts.length - 1)] ?? plane.position; arr.setXYZ(i, p.x, p.y, p.z); }
        arr.needsUpdate = true;
      }
      floaters.forEach((f) => { f.mixer.update(dt); f.float.update(dt); f.pop.update(dt); f.holder.scale.setScalar(f.base * (1 + f.pop.position * 0.1)); });
      renderer.render(scene, camera);
    };
    if (reduced) {
      trucks.forEach((tr) => { place(tr.g, tr.curve, tr.t); tr.mixer.update(0.01); });
      packets.forEach((m) => m.obj.position.copy(m.curve.getPointAt(m.t)));
      if (plane && planeCurve) place(plane, planeCurve, 0.5);
      globe.rotation.set(lat0, -lon0, 0);
      floaters.forEach((f) => { f.mixer.update(1.8); f.float.update(0.3); });
      renderer.render(scene, camera);
    } else frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      window.removeEventListener('pointermove', onMove);
      floaters.forEach((f) => { f.mixer.stopAllAction(); f.float.stopAllAction(); });
      trucks.forEach((tr) => tr.mixer.stopAllAction());
      disposeScene(scene);
      dotTex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className={`absolute inset-0 ${className}`} />;
}
