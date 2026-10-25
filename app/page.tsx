import Link from 'next/link';
import { HeroScene } from '@/components/three/Lazy';
import { BRAND } from '@/lib/brand';
import { CARRIERS, DESTINATIONS } from '@/lib/data/reference';

const lanes = Object.entries(DESTINATIONS).map(([country, cities]) => {
  const c = CARRIERS.filter((x) => x.destination === country);
  return {
    country, cities,
    from: Math.min(...c.map((x) => x.pricePerPallet)),
    fastest: Math.min(...c.map((x) => x.transitDays)),
    slowest: Math.max(...c.map((x) => x.transitDays)),
    onTime: Math.max(...c.map((x) => x.onTimePct)),
    flag: { Germany: '🇩🇪', France: '🇫🇷', Netherlands: '🇳🇱' }[country],
  };
});

const steps = [
  ['💬', 'Describe it', 'Chat in plain words or drop in a spreadsheet.'],
  ['🔎', 'Pre-flight check', 'Ten rules catch box counts, values, customs codes and weights.'],
  ['⚖️', 'Carrier match', 'Priced and ranked for your priority — with the reasoning shown.'],
  ['📦', 'Confirm & collect', 'Plain-English confirmation, labels and a draft invoice.'],
  ['🏁', 'Delivered', 'Estimated delivery date, appointment and paperwork ready.'],
];

export default function Home() {
  return (
    <div className="space-y-12">
      {/* hero */}
      <section className="relative isolate overflow-hidden rounded-3xl bg-[var(--navy)] text-white shadow-xl">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_80%_40%,rgba(255,106,26,0.22),transparent_60%),radial-gradient(50%_60%_at_20%_100%,rgba(70,120,220,0.25),transparent_70%)]" />
        <HeroScene />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--navy)] via-[var(--navy)]/85 via-55% to-transparent md:bg-gradient-to-r md:via-[var(--navy)]/15 md:via-35%" />
        <div className="relative z-10 flex min-h-[560px] max-w-xl flex-col justify-end gap-5 px-6 pb-10 pt-72 sm:px-10 md:min-h-[540px] md:justify-center md:py-12 md:pt-12">
          <span className="label-tag inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-white/90">
            <span className="truckbob">🚚</span> UK → Germany · France · Netherlands
          </span>
          <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            Ship it right <span className="text-[var(--orange)]">the first time.</span>
          </h1>
          <p className="max-w-md text-base text-white/80">
            {BRAND.name} books your pallets across the Channel — and checks every booking <i>before</i> it leaves, so mistakes never turn into customs holds or missing units.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/chat" className="btn btn-primary">💬 Book by chat</Link>
            <Link href="/upload" className="btn border-white/30 bg-white/10 text-white hover:bg-white/20">📄 Upload a file</Link>
          </div>
          <a className="w-fit text-sm text-white/70 underline underline-offset-4 hover:text-white" href="/sample-test-data.xlsx" download>Download a sample file to try</a>
          <dl className="mt-2 grid max-w-md grid-cols-3 gap-3 border-t border-white/15 pt-4 text-sm">
            <div><dt className="label-tag text-white/60">Lanes from</dt><dd className="font-display text-xl font-bold">£{Math.min(...lanes.map((l) => l.from))}<span className="text-xs font-normal text-white/60"> /pallet</span></dd></div>
            <div><dt className="label-tag text-white/60">Transit</dt><dd className="font-display text-xl font-bold">2–5<span className="text-xs font-normal text-white/60"> days</span></dd></div>
            <div><dt className="label-tag text-white/60">On time up to</dt><dd className="font-display text-xl font-bold">{Math.max(...lanes.map((l) => l.onTime))}%</dd></div>
          </dl>
        </div>
      </section>

      {/* tracking-style journey */}
      <section aria-labelledby="journey">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <div className="label-tag text-muted">Tracking</div>
            <h2 id="journey" className="font-display text-2xl font-bold tracking-tight">Your booking, tracked like a parcel</h2>
          </div>
        </div>
        <div className="card relative overflow-hidden p-5">
          <div className="absolute left-[10%] right-[10%] top-[2.9rem] hidden h-px bg-line md:block" />
          <div className="absolute left-[10%] right-[10%] top-[2.1rem] hidden md:block"><span className="ride-x relative block"><span className="truckbob absolute text-xl" style={{ animation: 'drive 9s linear infinite, truckbob .5s ease-in-out infinite' }}>🚚</span></span></div>
          <ol className="relative grid gap-5 md:grid-cols-5">
            {steps.map(([icon, t, d], i) => (
              <li key={t} className="reveal flex gap-3 md:flex-col md:items-center md:text-center" style={{ animationDelay: `${i * 90}ms` }}>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-[var(--orange)] bg-surface text-xl shadow-sm md:mt-6">{icon}</span>
                <span>
                  <span className="label-tag block text-muted">Step {i + 1}</span>
                  <span className="font-display block font-bold">{t}</span>
                  <span className="block text-sm text-muted">{d}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* lanes */}
      <section aria-labelledby="lanes">
        <div className="mb-5">
          <div className="label-tag text-muted">Our lanes</div>
          <h2 id="lanes" className="font-display text-2xl font-bold tracking-tight">Three lanes out of the UK</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {lanes.map((l) => (
            <Link key={l.country} href="/chat" className="card lift block overflow-hidden">
              <div className="relative h-24 bg-[var(--navy)]">
                <svg viewBox="0 0 240 96" className="absolute inset-0 h-full w-full" aria-hidden="true">
                  <path d="M24 70 Q 120 -6 216 62" fill="none" stroke="#ff6a1a" strokeWidth="2" className="dashflow" />
                  <circle cx="24" cy="70" r="5" fill="#ff6a1a" /><circle cx="216" cy="62" r="5" fill="#fff" />
                </svg>
                <span className="ride absolute left-0 top-0 text-lg" style={{ offsetPath: "path('M24 70 Q 120 -6 216 62')" }}>🚚</span>
                <span className="label-tag absolute bottom-2 left-3 text-white/70">UK</span>
                <span className="label-tag absolute bottom-2 right-3 text-white/70">{l.country.slice(0, 3).toUpperCase()}</span>
              </div>
              <div className="perf" />
              <div className="space-y-2 p-4">
                <h3 className="font-display flex items-center gap-2 text-lg font-bold">{l.flag} {l.country}</h3>
                <p className="text-sm text-muted">{l.cities.join(' · ')}</p>
                <dl className="grid grid-cols-3 gap-2 pt-1 text-sm">
                  <div><dt className="label-tag text-muted">From</dt><dd className="font-bold">£{l.from}</dd></div>
                  <div><dt className="label-tag text-muted">Transit</dt><dd className="font-bold">{l.fastest}–{l.slowest}d</dd></div>
                  <div><dt className="label-tag text-muted">On time</dt><dd className="font-bold">{l.onTime}%</dd></div>
                </dl>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* modes */}
      <section className="grid gap-4 md:grid-cols-3" aria-label="Ways to book">
        {[
          ['/chat', '💬', 'Book by chat', 'Describe your shipment in plain language. We only ask for what’s missing, and re-check everything when you change a detail.'],
          ['/upload', '📄', 'Upload a file', 'Drop in an Excel sheet of many bookings. Every booking gets Red/Amber issues, fixes and a carrier recommendation.'],
          ['/rates', '🌍', 'Shipping elsewhere?', 'Live carrier rates for any parcel between any two addresses worldwide, with the rules of the country you ship from.'],
        ].map(([h, i, t, d]) => (
          <Link key={h} href={h} className="card lift block p-5">
            <div className="text-3xl">{i}</div>
            <h3 className="font-display mt-2 text-xl font-bold">{t}</h3>
            <p className="mt-1 text-sm text-muted">{d}</p>
            <span className="mt-3 inline-block text-sm font-semibold text-brand">Open →</span>
          </Link>
        ))}
      </section>

      <p className="card p-4 text-sm text-muted">
        <b className="text-fg">How it works:</b> every rule check and price calculation is plain, deterministic code — the AI only helps with language (understanding chat, writing replies, spotting dangerous goods in descriptions, suggesting HS codes). <b className="text-fg">Red</b> = must fix before shipping. <b className="text-fg">Amber</b> = risky, should be fixed or checked.
      </p>
    </div>
  );
}
