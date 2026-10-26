'use client';
import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { useGSAP } from '@gsap/react';
import { ReactLenis, useLenis, type LenisRef } from 'lenis/react';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(useGSAP, ScrollTrigger, MotionPathPlugin);

/** Smooth scroll (Lenis, driven by GSAP's ticker) plus every scroll-linked animation on the home page. */
export function HomeMotion() {
  const lenisRef = useRef<LenisRef>(null);
  useLenis(() => ScrollTrigger.update());

  useGSAP(() => {
    const raf = (t: number) => lenisRef.current?.lenis?.raf(t * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.8 } })
        .fromTo('.hero-in', { y: 28, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.09 });
      gsap.fromTo('#heroImg', { scale: 1.12 }, { scale: 1, duration: 2.4, ease: 'power2.out' });
      gsap.to('#heroImg', { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      ScrollTrigger.batch('.rv', {
        start: 'top 88%',
        onEnter: (els) => gsap.fromTo(els, { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.08, duration: 0.7, ease: 'power3.out' }),
      });
      // a small truck rides the dashed route as the steps scroll past
      gsap.to('#rider', {
        motionPath: { path: '#routeLine', align: '#routeLine', alignOrigin: [0.5, 0.5], autoRotate: true },
        ease: 'none', scrollTrigger: { trigger: '.journey', start: 'top 75%', end: 'bottom 40%', scrub: 1 },
      });
      // the plane flies toward you and climbs; the train rolls into its frame
      gsap.fromTo('#planeImg', { scale: 1, xPercent: 18, yPercent: 6, rotate: 0 },
        { scale: 1.55, xPercent: 12, yPercent: -10, rotate: -2.5, ease: 'none', scrollTrigger: { trigger: '.air', start: 'top bottom', end: 'bottom top', scrub: 0.8 } });
      gsap.fromTo('#trainImg', { scale: 1.35, xPercent: 8 },
        { scale: 1, xPercent: 0, ease: 'none', scrollTrigger: { trigger: '.rail', start: 'top bottom', end: 'center 45%', scrub: 0.8 } });
      // map routes draw out from London
      const routes = gsap.utils.toArray<SVGPathElement>('#routes path');
      routes.forEach((p) => { const len = p.getTotalLength(); gsap.set(p, { strokeDasharray: len, strokeDashoffset: len }); });
      gsap.to(routes, { strokeDashoffset: 0, stagger: 0.12, duration: 1.2, ease: 'power2.inOut', scrollTrigger: { trigger: '#map', start: 'top 70%' } });
    });
    mm.add('(prefers-reduced-motion: reduce)', () => { gsap.set('.hero-in, .rv', { autoAlpha: 1 }); });

    return () => { gsap.ticker.remove(raf); };
  });

  return <ReactLenis root ref={lenisRef} options={{ autoRaf: false, anchors: true, lerp: 0.1 }} />;
}
