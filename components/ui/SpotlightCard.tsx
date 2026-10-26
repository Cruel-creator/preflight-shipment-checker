'use client';
import Link from 'next/link';
import { useRef, type MouseEvent, type ReactNode } from 'react';

/** Card with a soft light that follows the cursor (React Bits' SpotlightCard pattern). */
export function SpotlightCard({ href, className = '', spotlightColor = 'rgba(196,31,46,.10)', children }: {
  href: string; className?: string; spotlightColor?: string; children: ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const move = (e: MouseEvent<HTMLAnchorElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
    el.style.setProperty('--spot', spotlightColor);
  };
  return <Link ref={ref} href={href} onMouseMove={move} className={`spot ${className}`}>{children}</Link>;
}
