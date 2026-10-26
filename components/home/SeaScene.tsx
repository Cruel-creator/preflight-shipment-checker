'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PHOTOS } from '@/lib/media';

gsap.registerPlugin(ScrollTrigger);

const MAXR = 16;          // ripple rings alive at once
const IMG_ASPECT = 2400 / 1596;
const C = [0.52, 0.487];  // hull centre in the photo (texture space, y down)
const K = 0.42;           // ship scale on screen
const LOW = 0.13;         // how far below centre it sails, under the copy

const frag = /* glsl */ `
  uniform sampler2D uMap; uniform float uTime, uSpeed, uAspect; uniform vec3 uShip; uniform vec4 uR[${MAXR}]; uniform vec2 uScale;
  varying vec2 vUv;
  const vec2 C = vec2(${C[0]}, ${C[1]});
  const float K = ${K}, LOW = ${LOW};
  // the ship in the photo: pointed bow on the left, square stern on the right
  float hull(vec2 t) {
    float bow = clamp((t.x - .106) / .085, 0., 1.);
    float halfH = .066 * sqrt(bow);
    float inX = smoothstep(.103, .112, t.x) * (1. - smoothstep(.898, .906, t.x));
    return inX * (1. - smoothstep(halfH - .004, halfH + .003, abs(t.y - C.y)));
  }
  // where the original ship and its wake were
  float band(vec2 t) { return smoothstep(.04, .08, t.x) * smoothstep(.36, .405, t.y) * (1. - smoothstep(.58, .625, t.y)); }
  // open water: the ship's band is filled from the water above and below it
  vec3 water(vec2 t) {
    vec3 a = texture2D(uMap, t).rgb;
    vec3 up = texture2D(uMap, vec2(t.x, t.y - .21)).rgb, down = texture2D(uMap, vec2(t.x, t.y + .2)).rgb;
    return mix(a, mix(up, down, smoothstep(.39, .6, t.y)), band(t));
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + 1.), f.x), f.y); }
  void main() {
    vec2 t = (vec2(vUv.x, 1. - vUv.y) - .5) * uScale + .5;
    // slow swell plus ripple rings from the hull and the wake
    vec2 disp = vec2(sin(t.y * 60. + uTime * 1.3), cos(t.x * 48. + uTime * 1.1)) * .0012;
    float crest = 0.;
    for (int i = 0; i < ${MAXR}; i++) {
      float age = uTime - uR[i].z; if (age < 0. || age > 4.5) continue;
      vec2 dv = (t - uR[i].xy) * vec2(uAspect, 1.); float d = length(dv); float front = age * .055;
      float ring = sin((d - front) * 160.) * exp(-abs(d - front) * 90.) * exp(-age * .8) * uR[i].w;
      disp += normalize(dv + 1e-5) * ring * .004 / vec2(uAspect, 1.); crest += max(ring, 0.);
    }
    vec3 col = water(t + disp) + crest * .09;
    // the ship: moved by scroll, bobbing (a tiny scale pulse seen from above) and yawing
    vec2 p = t - vec2(uShip.x, uShip.y + LOW) - C;
    float a = uShip.z; p = mat2(cos(a), -sin(a), sin(a), cos(a)) * (p * vec2(uAspect, 1.)) / vec2(uAspect, 1.);
    p /= K * (1. + .006 * sin(uTime * 1.6));
    vec2 st = p + C;
    float tx = st.x - .9;  // foam trail behind the stern, longer while moving
    float foam = step(0., tx) * exp(-tx * (9. - 6. * uSpeed)) * exp(-pow((st.y - C.y) / (.02 + tx * .14), 2.));
    foam *= .25 + .75 * noise(st * vec2(70., 120.) + vec2(uTime * 3., 0.));
    col = mix(col, vec3(.86, .94, .97), clamp(foam * (.3 + .7 * uSpeed), 0., .8));
    col *= 1. - .35 * hull(st + vec2(-.012, -.03));  // soft shadow on the water
    col = mix(col, texture2D(uMap, st).rgb, hull(st));
    gl_FragColor = vec4(col, 1.);
  }`;

/** The container ship is lifted out of its photo and sails across rippling water as the section scrolls. */
export function SeaScene() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const tex = new THREE.TextureLoader().setCrossOrigin('anonymous').load(`${PHOTOS.sea.src}?w=2400&q=85&auto=format`);
    tex.flipY = false;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    const ripples = Array.from({ length: MAXR }, () => new THREE.Vector4(0, 0, -99, 0));
    const uniforms = {
      uMap: { value: tex }, uTime: { value: 0 }, uSpeed: { value: 0 }, uShip: { value: new THREE.Vector3() },
      uR: { value: ripples }, uScale: { value: new THREE.Vector2(1, 1) }, uAspect: { value: IMG_ASPECT },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: frag,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(quad);

    const size = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      const ca = w / h;  // cover the canvas, slightly zoomed in
      uniforms.uScale.value.set(ca > IMG_ASPECT ? 1 : ca / IMG_ASPECT, ca > IMG_ASPECT ? IMG_ASPECT / ca : 1).multiplyScalar(0.82);
    };
    size();
    addEventListener('resize', size);

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    // scroll drives the crossing (right to left: the bow is on the left); it keeps floating when you stop
    const ride = { x: reduce ? 0 : 0.5 };
    const tween = reduce ? null : gsap.to(ride, { x: -0.5, ease: 'none', scrollTrigger: { trigger: canvas, start: 'top 90%', end: 'bottom 10%', scrub: 1.4 } });

    let t = 0, last = ride.x, next = 0, ri = 0, speed = 0, frame = 0, prev = performance.now();
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      if (!visible) return;
      t += dt;
      const v = Math.abs(ride.x - last) / Math.max(dt, 1e-3);
      last = ride.x;
      speed += (Math.min(v * 4, 1) - speed) * 0.08;
      uniforms.uTime.value = t;
      uniforms.uSpeed.value = speed;
      uniforms.uShip.value.set(ride.x, Math.sin(t * 0.7) * 0.002, reduce ? 0 : Math.sin(t * 0.5) * 0.006);
      if (t > next) {  // wake rings at the stern while moving, gentle rings along the hull when idle
        const moving = speed > 0.15;
        const sternX = C[0] + ride.x + (0.9 - C[0]) * K;
        ripples[ri].set(moving ? sternX : sternX - Math.random() * 0.8 * K, C[1] + LOW + (Math.random() - 0.5) * 0.14 * K, t, moving ? 1 : 0.45);
        ri = (ri + 1) % MAXR;
        next = t + (moving ? 0.22 : 0.7);
      }
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('resize', size);
      io.disconnect();
      tween?.scrollTrigger?.kill();
      tween?.kill();
      material.dispose();
      quad.geometry.dispose();
      tex.dispose();
      renderer.dispose();
    };
  }, []);
  return <canvas ref={ref} aria-label="A container ship sailing across rippling water" />;
}
