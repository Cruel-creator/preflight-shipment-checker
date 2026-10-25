import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { BRAND } from "@/lib/brand";
import { Logo } from "@/components/Logo";
import { Ticker } from "@/components/Ticker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const display = Space_Grotesk({ variable: "--font-display", subsets: ["latin"], weight: ["500", "700"] });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${BRAND.name} — PreFlight booking checker`,
  description: "Book UK-to-EU pallet shipments by chat or spreadsheet, with pre-flight error checks and a carrier recommendation.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Ticker />
        <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5">
            <Logo />
            <nav className="flex w-full justify-between gap-1 text-sm font-medium sm:w-auto sm:justify-end">
              {[['/chat', 'Book by chat'], ['/upload', 'Upload a file'], ['/rates', 'Live rates']].map(([h, l]) => (
                <a key={h} href={h} className="rounded-full px-2.5 py-1.5 text-muted sm:px-3 transition hover:bg-surface2 hover:text-fg">{l}</a>
              ))}
            </nav>
          </div>
          <div className="tape" />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <footer className="mt-8 border-t border-line bg-[var(--navy)] text-white/70">
          <div className="tape" />
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs">
            <span className="font-display text-sm font-bold text-white">{BRAND.name}</span>
            <span>{BRAND.tagline}. Prototype with a placeholder brand — advice is guidance, not customs or legal advice.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
