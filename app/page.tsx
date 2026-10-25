import Link from 'next/link';

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 py-6">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Book cross-border pallets — with a pre-flight checker</h1>
        <p className="text-muted">
          UK → Germany, France or the Netherlands. Catch box-count, value, customs-code and weight mistakes <i>before</i> they become customs holds or &quot;missing units&quot;, get a recommended carrier with the reasoning shown, and a draft commercial invoice.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/chat" className="card block p-6 transition hover:shadow-md">
          <div className="text-3xl">💬</div>
          <h2 className="mt-2 text-xl font-semibold">Book by chat</h2>
          <p className="mt-1 text-sm text-muted">Describe your shipment in plain language. We only ask for what&apos;s missing, and re-check everything when you change a detail.</p>
        </Link>
        <Link href="/upload" className="card block p-6 transition hover:shadow-md">
          <div className="text-3xl">📄</div>
          <h2 className="mt-2 text-xl font-semibold">Upload a file</h2>
          <p className="mt-1 text-sm text-muted">Drop in an Excel sheet of many bookings. Every booking gets issues (Red/Amber), fixes, and a carrier recommendation.</p>
        </Link>
      </div>
      <Link href="/rates" className="card block p-4 text-sm transition hover:shadow-md">
        <b>🌍 Shipping something else?</b> Get live carrier rates for any parcel between any two addresses worldwide. <span className="text-brand underline">Open live rates →</span>
      </Link>
      <p className="text-center text-sm">
        <a className="text-brand underline" href="/sample-test-data.xlsx" download>Download a sample file to try</a>
      </p>
      <div className="card p-4 text-sm text-muted">
        <b className="text-fg">How it works:</b> every rule check and price calculation is plain, deterministic code — the AI only helps with language (understanding chat, writing replies, spotting dangerous goods in descriptions, suggesting HS codes). Red = must fix before shipping. Amber = risky, should be fixed or checked.
      </div>
    </div>
  );
}
