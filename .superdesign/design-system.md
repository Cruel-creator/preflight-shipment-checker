# Design system — Meridian Freight (PreFlight booking checker)

## Product
Placeholder UK-based cross-border freight company. Sellers book pallets UK → Germany/France/Netherlands by chat or spreadsheet; the app pre-checks every booking (Red = must fix, Amber = risky), recommends a carrier with reasoning shown, and drafts the commercial invoice. A separate "Live rates" mode prices parcels anywhere. Audience: small UK e-commerce sellers and ops people. Tone: confident, plain-English, trustworthy logistics.

## Pages
Home (hero + journey + lanes + modes), Book by chat, Upload a file, Live rates.

## Brand & style
- Palette (light): cream background #f3efe6, surface #fffdf8, surface-2 #f1ece0, text navy #101c2e, muted #5d6677, border #ded6c5, navy #12284c, courier orange #ff6a1a. Dark mode: bg #0a111f, surface #111a2d, text #e9edf5, orange-light #ff8a4c.
- Status tones: Red #9b1c1c on #fde8e8, Amber #7d4a00 on #fff1cf, Green #146c3a on #dff3e7, Blue #17356f on #e1ebfb. Never rely on colour alone: always icon + word.
- Type: Space Grotesk (headings, bold, tight tracking), Geist (body), Geist Mono uppercase tracked for small "label-tag" captions.
- Shape: cards 12px radius with hairline border and soft navy shadow; hero 24px radius; buttons 10px; primary button = orange fill with navy text (never white text on orange).
- Signature motifs: diagonal orange/navy "tape" stripe under the header and above the footer; perforated divider like a shipping-label tear line; mono uppercase label tags; parcel/truck glyphs; dashed route arcs with a truck riding them; scrolling lane ticker (real rate-card data: Germany from £180/pallet, France £170, Netherlands £160; 2–5 days; up to 98% on time).
- Imagery: dark navy hero with a dotted globe, orange lanes UK → Europe, trucks, a plane, and cardboard parcels with printed labels (WebGL in production). Everything visual must be about shipping, couriers, delivery, freight.

## Motion
Tracking-style progress with a moving truck, ticker marquee, dash-flow on routes, truck bobbing, staggered reveal; 3D scene uses keyframe clips, springs and gentle sway. All motion respects prefers-reduced-motion.

## Layout
max-width 1152px content column, 16px mobile gutter, sticky header (logo left, nav pills right), mobile-first.
