import type { OverallStatus, Severity } from '@/lib/types';

export function StatusBadge({ status, label }: { status: OverallStatus; label?: string }) {
  const m = {
    Blocked: ['tone-red', '🔴', label ?? 'Blocked'],
    Warnings: ['tone-amber', '🟠', label ?? 'Warnings'],
    Ready: ['tone-green', '✅', label ?? 'Ready'],
  }[status];
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${m[0]}`}>{m[1]} {m[2]}</span>;
}

export function SeverityBadge({ s }: { s: Severity }) {
  const m = { Red: ['tone-red', '⛔'], Amber: ['tone-amber', '⚠️'], Info: ['tone-blue', 'ℹ️'] }[s];
  return <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-bold ${m[0]}`}>{m[1]} {s}</span>;
}
