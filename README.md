# ✈️ PreFlight — conversational shipment booking & error checker

**Shiprocket for cross-border freight, with a pre-flight checker.** UK sellers book pallets to Germany, France or the Netherlands by chatting or uploading a spreadsheet; every booking gets Red/Amber issues with exact fixes, a recommended carrier with the reasoning shown, a confirmation with next steps, and a draft commercial invoice.

## Using the live link
No login. Open the site, then either **Book by chat** (try the clickable example, then change a detail such as "add a pallet") or **Upload a file** (use "Download a sample file to try", or the case template). Click any booking row to see its full detail.

## Architecture

```
 chat message ──► LLM extracts fields ─┐
                                        ├─► Booking ─► runChecks() ─► recommendCarrier() ─► buildConfirmation() ─► UI + invoice
 .xlsx upload ──► parse.ts (no LLM) ───┘                (R-01…R-10        (feasibility,          (status, next steps)
                                                         + DATA checks)    ranking, ETA)
```
Both flows produce the same `Booking` object and go through the same pipeline (`lib/rules`, `lib/recommend.ts`, `lib/confirm.ts`).

### Principle: code checks the rules, AI handles language
All rule results and carrier maths are deterministic TypeScript (`lib/rules`, `lib/recommend.ts`). The Anthropic API (server routes only; key never reaches the browser) is used only to: extract fields from chat, write friendly replies, flag dangerous goods from free text as a backstop, and *suggest* HS codes (always labelled "Suggested — please confirm"). In chat the reply writer is given the engine's results and told not to contradict them. If the API is down or unconfigured, uploads still work completely (keyword-only dangerous goods, no HS suggestions) and chat shows an "assistant unavailable" banner.

## Judgement calls (and why)
- **R-05 is evaluated against the recommended carrier.** The rule says weight per pallet must not exceed *the chosen carrier's* limit. If the seller's priority would pick a carrier the weight rules out (e.g. Fastest → Carrier C at 450 kg/pallet, limit 400), we don't raise a Red; we show an Info note and recommend the best feasible carrier instead (B). A Red is raised only if *no* carrier can take it (> 750 kg/pallet), with the minimum pallets needed and what would unlock A (÷500) and C (÷400).
- **Balanced = 40% cost, 30% speed, 30% reliability**, each min-max normalised over the *feasible* carriers. With equal weights Balanced collapses into "Fastest" (C 0.667 vs B 0.639 for Germany). Cost gets slightly more weight because of diminishing returns: A→B costs ~£40/pallet more for 2 days saved; B→C costs ~£120/pallet more for 1 more day. Result: Balanced picks B (0.65 vs C 0.60). The score table is shown under "How we chose".
- **Leading-zero HS codes.** Excel turns `090111` into `90111`. Exactly 5 digits → the message says so and offers the zero-padded code to confirm. HS codes are always handled as strings.
- **Dangerous goods = keywords OR AI.** Keywords (plus HS headings 8506/8507) catch the obvious cases deterministically; negations ("lithium-free", "battery not included") are stripped first to avoid false positives. The AI backstop (one batched call to the fast model) catches things like "rechargeable desk fan". Either hit → Red with the reason. Perfume is flagged as "check".
- **Delivery estimate = ready date + transit days, in calendar days** (no weekends/customs modelled). Stated in the UI.
- **Blocked bookings still get a recommendation**, labelled "Recommended once the issues above are fixed".
- **R-03/R-04 grouping.** If fixing an item's box count makes the booking's carton total add up, R-04 names it as the root cause.
- **Input problems are separate** from the rulebook: `DATA-xx` issues (Lyon + Germany, unsupported city, no items, orphan items, duplicate IDs, non-numeric/negative values, zero pallets, unreadable dates).
- **Dates** are parsed strictly day-first (`05-11-2026` is 5 November). "Today" is computed at request time in Europe/London.
- **Chat state lives in the browser**; the server is stateless. Carton total and declared value are computed from items if not stated, flagged "calculated — please confirm".

## Known limitations
- CSV upload is not supported (a booking needs two sheets); `.xlsx` only.
- Chat needs `ANTHROPIC_API_KEY`; without it chat cannot read messages (upload is unaffected).
- Rate limiting is in-memory per server instance, so it's best-effort on serverless.
- Customs paperwork and the invoice "To complete" fields are advisory guidance, outside the scored rulebook.
- Supabase share links (`/result/[id]`) are not implemented; everything works without Supabase.

## Run it
```bash
cp .env.example .env.local   # add ANTHROPIC_API_KEY
npm install
npm run dev                  # http://localhost:3000
npm test                     # Vitest: rules, recommender, parser, chat merge
npm run make-sample          # regenerates public/sample-test-data.xlsx (dates relative to today)
```
Env: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`), `ANTHROPIC_FAST_MODEL` (default `claude-haiku-5-5`).

Reference material is in `docs/` (case brief and template workbook).
