# Extractable components
## Logo
- Source: `components/Logo.tsx`
- Category: layout
- Description: Parcel-in-orbit mark + 'Meridian Freight' wordmark + 'PREFLIGHT · BOOKING CHECKER' subline
- Extractable props: none
- Hardcoded: SVG mark, text, classes

## Ticker
- Source: `components/Ticker.tsx`
- Category: layout
- Description: Navy scrolling strip of lane prices/transit/on-time
- Extractable props: none
- Hardcoded: lane text, marquee animation

## SiteHeader (inline in app/layout.tsx)
- Source: `app/layout.tsx`
- Category: layout
- Description: Sticky header with Logo, nav pills (Book by chat / Upload a file / Live rates), tape stripe
- Extractable props: activeItem (string, default: "home")
- Hardcoded: nav labels, classes

## SiteFooter (inline in app/layout.tsx)
- Source: `app/layout.tsx`
- Category: layout
- Description: Navy footer with tape stripe and brand line
- Extractable props: none
- Hardcoded: copy, classes
