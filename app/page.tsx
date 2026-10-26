import Image from 'next/image';
import Link from 'next/link';
import { BookingBar } from '@/components/home/BookingBar';
import { CtaNet } from '@/components/home/CtaNet';
import { HomeMotion } from '@/components/home/HomeMotion';
import { LanesMap } from '@/components/home/LanesMap';
import { SeaScene } from '@/components/home/SeaScene';
import { SpotlightCard } from '@/components/ui/SpotlightCard';
import { PHOTOS } from '@/lib/media';
import '@/components/home/home.css';

const SERVICES = [
  { href: '#quote', photo: PHOTOS.road, title: 'Road freight', text: 'Pallets collected in the UK and delivered to the door.' },
  { href: '#sea', photo: PHOTOS.sea, title: 'Across the Channel', text: 'Trailers cross with their paperwork already right.', pos: '30% 50%' },
  { href: '#rail', photo: PHOTOS.rail, title: 'Rail links', text: "Freight on Europe's rail network for the long legs.", pos: '25% 50%' },
  { href: '#air', photo: PHOTOS.air, title: 'Parcels by air', text: 'Live rates for parcels to any address.' },
];

const STEPS = [
  ['Describe it', 'Tell us in plain words, or upload the Bookings and Items sheets. We only ask for what is missing.'],
  ['We check it', 'Customs codes, values, carton counts, pallet weights and dangerous goods, each with the exact fix.'],
  ['It ships', 'The right carrier for your priority, a draft commercial invoice and a clear list of what happens next.'],
];

const CHECKS = [
  ['Customs paperwork', 'Commodity codes, values and origins that match your invoice, so nothing is held at the border.'],
  ['Counts and weights', 'Cartons, units and weights that add up, so the warehouse receives exactly what you sent.'],
  ['Safe to carry', 'Goods that can travel on a standard pallet service, on pallets the carrier will accept.'],
  ['Ready to deliver', 'A realistic collection date and a delivery slot, so the truck is not turned away.'],
];

const icon = (d: string, accent: string) => (
  <svg viewBox="0 0 40 40" fill="none" stroke="#0a1024" strokeWidth="2.2" aria-hidden="true"><path d={d} /><path d={accent} stroke="#c41f2e" /></svg>
);

export default function Home() {
  return (
    <div className="home">
      <HomeMotion />

      <section className="hero" id="quote">
        <div className="wrap hero-grid">
          <div>
            <span className="tag eyebrow hero-in">Road freight to Europe</span>
            <h1 className="hero-in">Reliable <em>pallet freight</em> from the UK to Europe.</h1>
            <p className="lede hero-in">Describe your shipment or drop in your bookings file. We check every customs code, count and weight, then put it on the right truck.</p>
            <div className="ctas hero-in">
              <Link className="btn btn-primary" href="/chat">Book by chat</Link>
              <Link className="btn" href="/upload">Upload a bookings file</Link>
            </div>
            <div className="points hero-in"><span>Customs checks</span><span>Carrier matched to your priority</span><span>Draft invoice</span></div>
          </div>
          <div className="frame hero-in">
            <Image id="heroImg" src={PHOTOS.road.src} alt={PHOTOS.road.alt} fill priority sizes="(max-width: 900px) 100vw, 55vw" />
            <span className="badge"><i />Checked and ready to ship</span>
          </div>
        </div>
        <div className="wrap bookwrap hero-in"><BookingBar /></div>
      </section>

      <section className="band" id="services">
        <div className="wrap">
          <span className="tag eyebrow rv">Services</span>
          <h2 className="rv">Every leg of the trip, <em>checked once</em>.</h2>
          <div className="modes">
            {SERVICES.map((s) => (
              <a key={s.title} className="mode rv" href={s.href}>
                <Image src={s.photo.src} alt="" fill sizes="(max-width: 900px) 50vw, 25vw" style={s.pos ? { objectPosition: s.pos } : undefined} />
                <span className="txt"><h3>{s.title}</h3><p>{s.text}</p></span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="sea" id="sea">
        <SeaScene />
        <div className="wrap copy">
          <span className="tag eyebrow on-dark rv">Across the Channel</span>
          <h2 className="rv">Your goods cross <em>with the paperwork</em> already right.</h2>
          <p className="sub rv">Customs codes, values and origins are checked before anything reaches the port, so nothing waits at the border for a correction.</p>
        </div>
      </section>

      <section className="band">
        <div className="wrap">
          <span className="tag eyebrow rv">How a booking moves</span>
          <h2 className="rv">From your description to a truck, <em>checked on the way</em>.</h2>
          <div className="journey">
            <svg className="route" viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
              <path id="routeLine" d="M10 20 C 250 20, 300 4, 500 20 S 760 36, 990 20" fill="none" stroke="#0a1024" strokeWidth="2.5" strokeDasharray="7 7" />
              <g id="rider"><rect x="-14" y="-8" width="20" height="12" rx="1.5" fill="#c41f2e" /><rect x="6" y="-5" width="8" height="9" rx="1.5" fill="#0a1024" /></g>
            </svg>
            <div className="steps">
              {STEPS.map(([h, p]) => <div key={h} className="step rv"><div className="dot" /><h3>{h}</h3><p>{p}</p></div>)}
            </div>
          </div>
        </div>
      </section>

      <section className="rail" id="rail">
        <div className="wrap rail-grid">
          <div>
            <span className="tag eyebrow on-dark rv">Rail links</span>
            <h2 className="rv">Long legs across Europe, <em>on the rails</em>.</h2>
            <p className="sub rv">Once your goods are across the Channel, the longer runs into Germany can go by rail freight, with the same paperwork travelling with them.</p>
          </div>
          <div className="shot rv"><Image id="trainImg" src={PHOTOS.rail.src} alt={PHOTOS.rail.alt} fill sizes="(max-width: 900px) 100vw, 55vw" /></div>
        </div>
      </section>

      <section className="band mapband">
        <div className="wrap mapgrid">
          <div>
            <span className="tag eyebrow rv">Where we go</span>
            <h2 className="rv">From the UK to the <em>heart of Europe</em>.</h2>
            <ul className="rv">{['Berlin', 'Frankfurt', 'Hamburg', 'Paris', 'Lyon', 'Amsterdam', 'Rotterdam'].map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
          <LanesMap />
        </div>
      </section>

      <section className="air" id="air">
        <div className="photo"><Image id="planeImg" src={PHOTOS.air.src} alt={PHOTOS.air.alt} fill sizes="100vw" /></div>
        <div className="wrap">
          <span className="tag eyebrow rv" style={{ color: '#ffd0d4' }}>Parcels further afield</span>
          <h2 className="rv" style={{ maxWidth: '14ch' }}>Sending a parcel <em>beyond Europe</em>?</h2>
          <p className="sub rv">Live carrier rates for any address, priced in the currency of the country you ship from and checked against its export rules.</p>
          <Link className="btn btn-white rv mt-6" href="/rates">Price a parcel</Link>
        </div>
      </section>

      <section className="band" id="checks">
        <div className="wrap">
          <span className="tag eyebrow rv">Pre-flight checks</span>
          <h2 className="rv">Problems found <em>before your pallet leaves</em> the dock.</h2>
          <p className="sub rv">Every booking is looked over before it is handed to a carrier, and anything that needs changing comes back with a plain-English fix.</p>
          <div className="checks">
            {CHECKS.map(([h, p]) => <div key={h} className="col rv"><h3>{h}</h3><p>{p}</p></div>)}
          </div>
        </div>
      </section>

      <section className="band" id="ways" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <span className="tag eyebrow rv">Ways to book</span>
          <h2 className="rv">Book the way your shipment <em>already lives</em>.</h2>
          <div className="ways">
            <SpotlightCard href="/chat" className="rv">
              <span className="ico">{icon('M6 9h28v17H17l-7 6v-6H6z', 'M12 16h16M12 21h10')}</span>
              <h3>Book by chat</h3><p>Describe the shipment like you would to a forwarder. Change a detail mid-way and the checks update.</p><span className="more">Start a booking →</span>
            </SpotlightCard>
            <SpotlightCard href="/upload" className="rv">
              <span className="ico">{icon('M10 5h14l7 7v23H10zM24 5v7h7', 'M15 20h11M15 25h11M15 30h7')}</span>
              <h3>Upload bookings</h3><p>Drop in the Bookings and Items sheets. Every booking comes back with its issues, fixes and a carrier.</p><span className="more">Check a file →</span>
            </SpotlightCard>
            <SpotlightCard href="/rates" className="rv">
              <span className="ico">{icon('M8 14l12-7 12 7v13l-12 7-12-7z', 'M8 14l12 7 12-7M20 21v13')}</span>
              <h3>Parcel rates</h3><p>Live carrier rates for any address, checked against the export rules of the country you ship from.</p><span className="more">Price a parcel →</span>
            </SpotlightCard>
          </div>
        </div>
      </section>

      <section className="cta">
        <CtaNet />
        <div className="wrap">
          <h2>Ready to book? <em>Start with an estimate.</em></h2>
          <a className="btn btn-primary" href="#quote">Get an estimate</a>
        </div>
      </section>
    </div>
  );
}
