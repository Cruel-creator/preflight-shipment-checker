# Page dependency trees
## / (Home)
Entry: app/page.tsx
- components/three/Lazy.tsx → components/three/HeroScene.tsx (client WebGL, Three.js; not needed for static design)
- lib/brand.ts, lib/data/reference.ts (lane prices: Germany from £180, France £170, Netherlands £160; 2–5 days; up to 98% on time)
- app/layout.tsx → components/Logo.tsx, components/Ticker.tsx
- app/globals.css

## /chat
Entry: app/chat/page.tsx → components/BookingCard.tsx, components/ResultPanel.tsx, components/ui.tsx

## /upload
Entry: app/upload/page.tsx → components/ResultPanel.tsx, components/ScanLoader.tsx, components/ui.tsx

## /rates
Entry: app/rates/page.tsx → components/ResultPanel.tsx (IssueCard), components/ScanLoader.tsx
