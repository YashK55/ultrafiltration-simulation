interface StatCardProps {
  label: string;
  value: number | string;
  unit: string;
  description: string;
}

export function StatCard({ label, value, unit, description }: StatCardProps) {
  return (
    <div className="bg-slate-900/80 rounded-2xl border border-slate-800 px-4 py-3 shadow-md">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <div className="text-xl font-semibold text-white">{value}</div>
        <div className="text-[11px] text-slate-400">{unit}</div>
      </div>
      <p className="text-[11px] text-slate-500">{description}</p>
    </div>
  );
}
