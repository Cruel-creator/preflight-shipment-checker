import Link from 'next/link';
import { BRAND } from '@/lib/brand';

/** A pallet-load mark: red tile with a white crate. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="8" fill="var(--red)" />
      <rect x="10" y="13" width="20" height="13" rx="1.5" fill="none" stroke="#fff" strokeWidth="2.6" />
      <path d="M10 17.5h20" stroke="#fff" strokeWidth="2.6" />
      <path d="M12 29.5h16" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 no-underline ${dark ? 'text-white' : 'text-fg'}`} aria-label={`${BRAND.name} home`}>
      <LogoMark />
      <span className="font-display whitespace-nowrap text-[1.15rem] font-extrabold">{BRAND.name}</span>
    </Link>
  );
}
