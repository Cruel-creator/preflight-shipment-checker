'use client';
import { useEffect, useRef } from 'react';

/** Vanta NET behind the closing band; only runs while the band is on screen. */
export function CtaNet() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let effect: { destroy(): void } | null = null;
    let alive = true;
    const io = new IntersectionObserver(async ([entry]) => {
      if (entry.isIntersecting && !effect) {
        const [THREE, { default: NET }] = await Promise.all([import('three-vanta'), import('vanta/dist/vanta.net.min')]);
        if (!alive || effect) return;
        effect = NET({ el, THREE, color: 0xc41f2e, backgroundColor: 0x0b1733, points: 8, maxDistance: 20, spacing: 18, showDots: false, scaleMobile: 3 });
      } else if (!entry.isIntersecting && effect) {
        effect.destroy();
        effect = null;
      }
    });
    io.observe(el);
    return () => { alive = false; io.disconnect(); effect?.destroy(); };
  }, []);
  return <div ref={ref} className="cta-net" aria-hidden="true" />;
}
