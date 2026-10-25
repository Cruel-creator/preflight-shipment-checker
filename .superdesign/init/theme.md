# Theme

## Compact token summary
- Fonts: Space Grotesk (display headings, 500/700) via --font-display; Geist (body); Geist Mono (labels `.label-tag`)
- Light: bg #f3efe6 (cream/cardboard), surface #fffdf8, surface-2 #f1ece0, fg #101c2e, muted #5d6677, border #ded6c5, brand #12284c (navy), orange #ff6a1a, navy #12284c
- Dark: bg #0a111f, surface #111a2d, surface-2 #17223a, fg #e9edf5, muted #9aa6ba, border #25324c, brand #ff8a4c, navy #0b1730
- Status tones (bg/fg/border): red #fde8e8/#9b1c1c/#f5b5b5, amber #fff1cf/#7d4a00/#f0cf86, green #dff3e7/#146c3a/#a4dbbb, blue #e1ebfb/#17356f/#b0c6ef (dark variants exist)
- Radius: cards 12px, buttons 10px, hero 24px (rounded-3xl). Shadows: soft navy-tinted `0 8px 24px -16px`.
- Signature motifs: diagonal orange/navy "tape" stripe (.tape), perforated divider (.perf), mono uppercase label tags, parcel/truck emoji accents, dashed route lines with riding truck, scrolling lane ticker.
- Motion: ticker marquee, truck bobbing, route dash flow, offset-path truck ride, staggered .reveal; WebGL hero (Three.js globe) honours prefers-reduced-motion.

## globals.css
```css
@import "tailwindcss";

:root {
  --navy: #12284c;
  --orange: #ff6a1a;
  --bg: #f3efe6;
  --surface: #fffdf8;
  --surface-2: #f1ece0;
  --fg: #101c2e;
  --muted: #5d6677;
  --border: #ded6c5;
  --brand: #12284c;
  --brand-fg: #ffffff;
  --red-bg: #fde8e8; --red-fg: #9b1c1c; --red-bd: #f5b5b5;
  --amber-bg: #fff1cf; --amber-fg: #7d4a00; --amber-bd: #f0cf86;
  --green-bg: #dff3e7; --green-fg: #146c3a; --green-bd: #a4dbbb;
  --blue-bg: #e1ebfb; --blue-fg: #17356f; --blue-bd: #b0c6ef;
}
@media (prefers-color-scheme: dark) {
  :root {
    --navy: #0b1730;
    --bg: #0a111f;
    --surface: #111a2d;
    --surface-2: #17223a;
    --fg: #e9edf5;
    --muted: #9aa6ba;
    --border: #25324c;
    --brand: #ff8a4c;
    --brand-fg: #0a111f;
    --red-bg: #3a1618; --red-fg: #ff9b9b; --red-bd: #6b2a2d;
    --amber-bg: #3a2b10; --amber-fg: #ffcb6b; --amber-bd: #6b5020;
    --green-bg: #12301f; --green-fg: #7fe0a5; --green-bd: #25563a;
    --blue-bg: #15264a; --blue-fg: #a9c5ff; --blue-bd: #2c4680;
  }
}

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface2: var(--surface-2);
  --color-fg: var(--fg);
  --color-muted: var(--muted);
  --color-line: var(--border);
  --color-brand: var(--brand);
  --color-brandfg: var(--brand-fg);
  --font-sans: var(--font-geist-sans);
  --font-display: var(--font-display);
}

body { background: var(--bg); color: var(--fg); font-family: var(--font-geist-sans), system-ui, sans-serif; }
.tone-red { background: var(--red-bg); color: var(--red-fg); border-color: var(--red-bd); }
.tone-amber { background: var(--amber-bg); color: var(--amber-fg); border-color: var(--amber-bd); }
.tone-green { background: var(--green-bg); color: var(--green-fg); border-color: var(--green-bd); }
.tone-blue { background: var(--blue-bg); color: var(--blue-fg); border-color: var(--blue-bd); }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; border-radius: 10px; padding: .6rem 1rem; font-weight: 600; font-size: .9rem; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--fg); }
.btn:hover { background: var(--surface-2); }
.btn-primary { background: var(--orange); color: #101c2e; border-color: var(--orange); box-shadow: 0 2px 0 rgba(0,0,0,.18); }
.btn-primary:hover { background: var(--orange); filter: brightness(1.07); transform: translateY(-1px); }
.btn { transition: transform .15s ease, filter .15s ease, background .15s ease; }
.btn-navy { background: var(--navy); color: #fff; border-color: var(--navy); }
.font-display { font-family: var(--font-display), var(--font-geist-sans), system-ui, sans-serif; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
details > summary { cursor: pointer; }

/* ---- shipping-company look: tape stripe, labels, ticker, route line ---- */
.tape { height: 6px; background: repeating-linear-gradient(135deg, var(--orange) 0 12px, var(--navy) 12px 24px); }
.label-tag { font-family: var(--font-geist-mono), ui-monospace, monospace; font-size: .68rem; letter-spacing: .12em; text-transform: uppercase; }
.card { box-shadow: 0 1px 0 rgba(16,28,46,.04), 0 8px 24px -16px rgba(16,28,46,.25); }
.lift { transition: transform .2s ease, box-shadow .2s ease; }
.lift:hover { transform: translateY(-3px); box-shadow: 0 14px 30px -14px rgba(16,28,46,.4); }
@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.ticker-track { animation: ticker 60s linear infinite; }
.ticker:hover .ticker-track { animation-play-state: paused; }
@keyframes drive { from { left: 0%; } to { left: 100%; } }
@keyframes dash { to { stroke-dashoffset: -24; } }
@keyframes pop { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.reveal { animation: pop .6s ease both; }
.perf { background-image: radial-gradient(circle, var(--border) 1.5px, transparent 1.6px); background-size: 14px 6px; background-repeat: repeat-x; height: 6px; }
@media (prefers-reduced-motion: reduce) {
  .ticker-track, .reveal { animation: none !important; }
}
@keyframes ride { from { offset-distance: 0%; } to { offset-distance: 100%; } }
.ride { offset-rotate: auto; animation: ride 7s linear infinite; }
.dashflow { stroke-dasharray: 5 7; animation: dash 1.2s linear infinite; }
@keyframes truckbob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1.5px); } }
.truckbob { animation: truckbob .5s ease-in-out infinite; display: inline-block; }
@media (prefers-reduced-motion: reduce) { .ride, .dashflow, .truckbob { animation: none !important; } }
```

## Tailwind
Tailwind v4 (CSS-first, `@import "tailwindcss"` + `@theme inline` mapping in globals.css; no tailwind.config file).
