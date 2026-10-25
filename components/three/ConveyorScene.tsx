'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { disposeScene, makeParcel, prefersReducedMotion, Spring } from './shared';

/** A sorting-hub conveyor: parcels ride a belt through a scanner arch. Used as the "working…" loader. */
export default function ConveyorScene({ className = '' }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); } catch { return; }
    const reduced = prefersReducedMotion();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
    camera.position.set(0.6, 2.1, 5.6);
    camera.lookAt(0, 0.2, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(-2, 4, 3);
    scene.add(key);

    // belt with moving chevrons
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const x = c.getContext('2d')!;
    x.fillStyle = '#1b2640'; x.fillRect(0, 0, 256, 64);
    x.strokeStyle = '#ff6a1a'; x.lineWidth = 6;
    for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(i * 64 + 14, 12); x.lineTo(i * 64 + 40, 32); x.lineTo(i * 64 + 14, 52); x.stroke(); }
    const beltTex = new THREE.CanvasTexture(c);
    beltTex.wrapS = beltTex.wrapT = THREE.RepeatWrapping;
    beltTex.repeat.set(3, 1);
    beltTex.colorSpace = THREE.SRGBColorSpace;
    const belt = new THREE.Mesh(new THREE.BoxGeometry(9, 0.14, 1.5), [
      new THREE.MeshLambertMaterial({ color: 0x2a3858 }), new THREE.MeshLambertMaterial({ color: 0x2a3858 }),
      new THREE.MeshLambertMaterial({ map: beltTex }), new THREE.MeshLambertMaterial({ color: 0x0d1424 }),
      new THREE.MeshLambertMaterial({ color: 0x2a3858 }), new THREE.MeshLambertMaterial({ color: 0x2a3858 }),
    ]);
    belt.position.y = -0.07;
    scene.add(belt);
    for (const z of [-0.8, 0.8]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(9, 0.1, 0.06), new THREE.MeshLambertMaterial({ color: 0xff6a1a }));
      rail.position.set(0, 0.03, z);
      scene.add(rail);
    }

    // scanner arch + laser
    const arch = new THREE.Group();
    const steel = new THREE.MeshLambertMaterial({ color: 0xdfe6f3 });
    for (const z of [-0.95, 0.95]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.5, 0.12), steel); post.position.set(0, 0.7, z); arch.add(post); }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 2.1), new THREE.MeshLambertMaterial({ color: 0x12284c }));
    bar.position.y = 1.5;
    arch.add(bar);
    const laserMat = new THREE.MeshBasicMaterial({ color: 0xff3b1f, transparent: true, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const laser = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.4), laserMat);
    laser.rotation.y = Math.PI / 2;
    laser.position.set(0, 0.72, 0);
    arch.add(laser);
    scene.add(arch);

    // parcels
    const sizes: [number, number, number][] = [[0.7, 0.5, 0.55], [0.5, 0.42, 0.5], [0.85, 0.55, 0.6], [0.55, 0.7, 0.5], [0.7, 0.45, 0.55]];
    const parcels = sizes.map(([w, h, d], i) => {
      const g = makeParcel(w, h, d, i % 2 === 0);
      g.rotation.y = (i % 2 ? 0.15 : -0.1);
      scene.add(g);
      return { g, h, x: -4 + i * 1.9, pop: new Spring(160, 9), hit: false, base: 1 };
    });

    const resize = () => {
      const w = el.clientWidth || 1, h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.z = camera.aspect < 2.4 ? 5.6 + (2.4 - camera.aspect) * 2.2 : 5.6;
      camera.lookAt(0, 0.2, 0);
      camera.updateProjectionMatrix();
      if (reduced) renderer.render(scene, camera);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const place = () => parcels.forEach((p) => { p.g.position.set(p.x, p.h / 2, 0); p.g.scale.setScalar(p.base + p.pop.position * 0.12); });
    const clock = new THREE.Clock();
    let raf = 0, visible = true, flash = 0;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(el);
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) { clock.getDelta(); return; }
      const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
      beltTex.offset.x -= dt * 0.45;
      parcels.forEach((p) => {
        p.x += dt * 1.35;
        if (p.x > 4.6) { p.x = -4.6; p.hit = false; }
        if (!p.hit && p.x > -0.1 && p.x < 0.4) { p.hit = true; p.pop.velocity = 3.2; flash = 1; }
        p.pop.update(dt);
      });
      flash = Math.max(0, flash - dt * 2.2);
      laserMat.opacity = 0.3 + 0.25 * Math.sin(t * 9) ** 2 + flash * 0.4;
      laser.scale.y = 1 + flash * 0.15;
      place();
      renderer.render(scene, camera);
    };
    if (reduced) { place(); renderer.render(scene, camera); } else frame();

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      disposeScene(scene); beltTex.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className={`relative ${className}`} />;
}
