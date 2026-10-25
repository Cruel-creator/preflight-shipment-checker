import { ConveyorScene } from '@/components/three/Lazy';

/** Shown while an upload or rate lookup is running: parcels roll through a scanner. */
export function ScanLoader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="card overflow-hidden" role="status" aria-live="polite">
      <div className="h-36 bg-[var(--navy)] sm:h-44">
        <ConveyorScene className="h-full w-full" />
      </div>
      <div className="px-4 py-3">
        <div className="font-display font-bold">{label}</div>
        {sub && <div className="text-sm text-muted">{sub}</div>}
      </div>
    </div>
  );
}
