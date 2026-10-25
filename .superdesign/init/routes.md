# Routes (Next.js App Router, file-based)
- `/` → app/page.tsx — marketing home: Three.js globe hero, tracking-style 5-step journey, 3 lane cards (Germany/France/Netherlands, prices from rate card), 3 ways to book, how-it-works note
- `/chat` → app/chat/page.tsx — chat (left) + live booking card + result panel (right)
- `/upload` → app/upload/page.tsx — dropzone + conveyor loader + summary table + booking detail (ResultPanel)
- `/rates` → app/rates/page.tsx — any-shipment live rates (Shippo) with plain-words fill, checks, rate table
- API: /api/chat, /api/analyze, /api/shippo, /api/shippo/parse
Layout for all pages: app/layout.tsx
