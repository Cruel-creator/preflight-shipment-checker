import type { Metadata } from "next";
import { Archivo, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { Logo } from "@/components/Logo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const display = Archivo({ variable: "--font-display", subsets: ["latin"], weight: ["600", "700", "800"] });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${BRAND.name} — PreFlight booking checker`,
  description: "Book UK-to-EU pallet shipments by chat or spreadsheet, with pre-flight error checks and a carrier recommendation.",
};

const NAV: [string, string][] = [['/#services', 'Services'], ['/chat', 'Book by chat'], ['/upload', 'Upload bookings'], ['/rates', 'Parcel rates']];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="site-header">
          <div className="mx-auto flex max-w-[75rem] items-center justify-between gap-4 px-5 py-3">
            <Logo />
            <nav className="site-nav hidden gap-0.5 lg:flex" aria-label="Main">
              {NAV.map(([h, l]) => <Link key={h} href={h}>{l}</Link>)}
            </nav>
            <Link href="/#quote" className="btn btn-primary whitespace-nowrap px-4 py-2.5 text-sm">Get an estimate</Link>
          </div>
          <nav className="site-nav flex justify-between gap-1 overflow-x-auto border-t border-line px-3 py-1.5 lg:hidden" aria-label="Main (mobile)">
            {NAV.slice(1).map(([h, l]) => <Link key={h} href={h}>{l}</Link>)}
          </nav>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="bg-[#070f22] text-sm text-white/65">
          <div className="mx-auto grid max-w-[75rem] gap-8 px-5 py-12 md:grid-cols-[2fr_1fr_1fr]">
            <div>
              <Logo dark />
              <p className="mt-4 max-w-[46ch]">{BRAND.tagline}. Prototype with a placeholder brand: guidance, not customs or legal advice. Photography from Unsplash.</p>
            </div>
            <div>
              <h4 className="label-tag mb-3 text-white">Book</h4>
              {[['/chat', 'Book by chat'], ['/upload', 'Upload bookings'], ['/rates', 'Parcel rates']].map(([h, l]) => <Link key={h} href={h} className="block py-1 hover:text-white">{l}</Link>)}
            </div>
            <div>
              <h4 className="label-tag mb-3 text-white">Learn</h4>
              {[['/#checks', 'What we check'], ['/#sea', 'Channel crossing'], ['/#quote', 'Get an estimate']].map(([h, l]) => <Link key={h} href={h} className="block py-1 hover:text-white">{l}</Link>)}
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
