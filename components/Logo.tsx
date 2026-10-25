import { BRAND } from '@/lib/brand';

/** Parcel-and-meridian mark: a box wrapped by an orbit line. */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="10" fill="var(--navy)" />
      <path d="M20 9 31 14.5v11L20 31 9 25.5v-11L20 9Z" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 14.5 20 20l11-5.5M20 20v11" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
      <path d="M20 9 25.5 11.8v5.6" stroke="var(--orange)" strokeWidth="3" strokeLinecap="round" fill="none" />
      <ellipse cx="20" cy="20" rx="17" ry="6.5" transform="rotate(-24 20 20)" fill="none" stroke="var(--orange)" strokeWidth="1.6" strokeDasharray="2 3" />
    </svg>
  );
}

export function Logo() {
  return (
    <a href="/" className="flex items-center gap-2.5" aria-label={`${BRAND.name} home`}>
      <LogoMark />
      <span className="leading-none">
        <span className="font-display block text-[1.05rem] font-bold tracking-tight">{BRAND.name}</span>
        <span className="mt-0.5 hidden text-[0.62rem] sm:block font-semibold uppercase tracking-[0.14em] text-muted">{BRAND.product} · booking checker</span>
      </span>
    </a>
  );
}
