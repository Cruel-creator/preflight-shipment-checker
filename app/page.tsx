import Link from 'next/link';
import { QuoteBento } from '@/components/home/QuoteBento';
import { HeroScene } from '@/components/three/Lazy';
import { InvoicePreview, PreflightPreview } from '@/components/home/PreflightPreview';
import { CARRIERS } from '@/lib/data/reference';

export default function Home() {
  const from = Math.min(...CARRIERS.map((c) => c.pricePerPallet));

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
      {/* hero tile */}
      <section className="card relative isolate order-1 min-h-[520px] overflow-hidden bg-[var(--navy)] text-white md:col-span-7">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_100%_0%,rgba(255,106,26,0.32),transparent_60%),radial-gradient(50%_60%_at_0%_100%,rgba(70,120,220,0.25),transparent_70%)]" />
        <HeroScene framing="tile" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--navy)] via-[var(--navy)]/70 via-45% to-transparent md:bg-gradient-to-r md:via-[var(--navy)]/40 md:via-40%" />
        <div className="relative z-10 flex h-full min-h-[520px] max-w-md flex-col md:max-w-[64%] justify-end gap-4 p-6 pt-64 sm:p-8 md:justify-center md:pt-8">
          <span className="label-tag inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1"><span className="truckbob">🚚</span> UK → Germany · France · Netherlands</span>
          <h1 className="font-display text-4xl font-bold leading-[1.04] tracking-tight sm:text-5xl">Ship it right <span className="text-[var(--orange)]">the first time.</span></h1>
          <p className="text-white/75">Book pallets across the Channel and see every mistake — box counts, values, customs codes, weights — before it becomes a customs hold.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/chat" className="btn btn-primary">💬 Book by chat</Link>
            <Link href="/upload" className="btn border-white/30 bg-white/10 text-white hover:bg-white/20">📄 Upload a file</Link>
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-3 border-t border-white/15 pt-4">
            <div><dt className="label-tag text-white/60">Lanes from</dt><dd className="font-display text-2xl font-bold">£{from}</dd></div>
            <div><dt className="label-tag text-white/60">Transit</dt><dd className="font-display text-2xl font-bold">2–5d</dd></div>
            <div><dt className="label-tag text-white/60">On time up to</dt><dd className="font-display text-2xl font-bold">98%</dd></div>
          </dl>
        </div>
      </section>

      <QuoteBento />

      <PreflightPreview />
      <InvoicePreview />

      <Link href="/chat" className="card lift order-6 p-5 md:col-span-4">
        <div className="text-3xl">💬</div>
        <h3 className="font-display mt-2 text-lg font-bold">Book by chat</h3>
        <div className="mt-3 space-y-2 text-sm">
          <div className="w-fit max-w-[92%] rounded-2xl bg-[var(--navy)] px-3 py-2 text-white">1,080 mugs to Frankfurt, 3 pallets</div>
          <div className="w-fit max-w-[92%] rounded-2xl bg-surface2 px-3 py-2">Got it. When will they be ready?</div>
        </div>
      </Link>
      <Link href="/upload" className="card lift order-7 p-5 md:col-span-4">
        <div className="text-3xl">📄</div>
        <h3 className="font-display mt-2 text-lg font-bold">Upload a file</h3>
        <p className="mt-1 text-sm text-muted">Every booking in a spreadsheet gets issues, fixes and a carrier.</p>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-semibold"><span className="tone-green rounded-full border px-2 py-1">✅ Ready</span><span className="tone-amber rounded-full border px-2 py-1">⚠️ Warnings</span><span className="tone-red rounded-full border px-2 py-1">⛔ Blocked</span></div>
      </Link>
      <Link href="/rates" className="card lift relative order-8 overflow-hidden bg-[var(--navy)] p-5 text-white md:col-span-4">
        <div className="text-3xl">🌍</div>
        <h3 className="font-display mt-2 text-lg font-bold">Shipping elsewhere?</h3>
        <p className="mt-1 text-sm text-white/70">Live rates for any parcel, any address — in the currency and under the rules of the country you ship from.</p>
        <svg className="absolute -bottom-8 -right-8 h-36 w-36 opacity-30" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="none" stroke="#fff" /><ellipse cx="50" cy="50" rx="20" ry="44" fill="none" stroke="#fff" /><path d="M6 50h88M14 28h72M14 72h72" stroke="#fff" fill="none" /></svg>
      </Link>

      <p className="card order-9 p-4 text-sm text-muted md:col-span-12">
        <b className="text-fg">How it works:</b> every rule check and price calculation is plain, deterministic code — the AI only helps with language. <b className="text-fg">Red</b> = must fix before shipping. <b className="text-fg">Amber</b> = risky, should be fixed or checked. The quote above uses the same recommender as the booking flows.
      </p>
    </div>
  );
}
