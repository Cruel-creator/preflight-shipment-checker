# Layouts

Root layout renders: Ticker (scrolling lane-rate strip) → sticky header (Logo + nav pills + tape stripe) → <main max-w-6xl> → navy footer with tape stripe.

### `app/layout.tsx`
```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { BRAND } from "@/lib/brand";
import { Logo } from "@/components/Logo";
import { Ticker } from "@/components/Ticker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const display = Space_Grotesk({ variable: "--font-display", subsets: ["latin"], weight: ["500", "700"] });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${BRAND.name} — PreFlight booking checker`,
  description: "Book UK-to-EU pallet shipments by chat or spreadsheet, with pre-flight error checks and a carrier recommendation.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Ticker />
        <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5">
            <Logo />
            <nav className="flex w-full justify-between gap-1 text-sm font-medium sm:w-auto sm:justify-end">
              {[['/chat', 'Book by chat'], ['/upload', 'Upload a file'], ['/rates', 'Live rates']].map(([h, l]) => (
                <a key={h} href={h} className="rounded-full px-2.5 py-1.5 text-muted sm:px-3 transition hover:bg-surface2 hover:text-fg">{l}</a>
              ))}
            </nav>
          </div>
          <div className="tape" />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <footer className="mt-8 border-t border-line bg-[var(--navy)] text-white/70">
          <div className="tape" />
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs">
            <span className="font-display text-sm font-bold text-white">{BRAND.name}</span>
            <span>{BRAND.tagline}. Prototype with a placeholder brand — advice is guidance, not customs or legal advice.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}

```

### `components/Logo.tsx`
```tsx
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

```

### `components/Ticker.tsx`
```tsx
import { CARRIERS } from '@/lib/data/reference';
import { DESTINATIONS } from '@/lib/data/reference';

// Real lane data from the fixed rate card: cheapest price/pallet and fastest transit per lane.
const lanes = Object.keys(DESTINATIONS).map((country) => {
  const c = CARRIERS.filter((x) => x.destination === country);
  return `UK → ${country}  ·  from £${Math.min(...c.map((x) => x.pricePerPallet))}/pallet  ·  ${Math.min(...c.map((x) => x.transitDays))}–${Math.max(...c.map((x) => x.transitDays))} days  ·  up to ${Math.max(...c.map((x) => x.onTimePct))}% on time`;
});

export function Ticker() {
  const items = [...lanes, ...lanes, ...lanes, ...lanes];
  return (
    <div className="ticker overflow-hidden border-b border-white/10 bg-[var(--navy)] text-[0.72rem] text-white/80" aria-label="Lane rates from the rate card">
      <div className="ticker-track flex w-max gap-10 py-1.5">
        {items.map((t, i) => (
          <span key={i} className="flex items-center gap-10 whitespace-pre"><span>🚚 {t}</span><span className="text-[var(--orange)]">✦</span></span>
        ))}
      </div>
    </div>
  );
}

```

