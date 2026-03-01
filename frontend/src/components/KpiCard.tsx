interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}

export default function KpiCard({ label, value, sub, accent }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          accent ? "text-red-600" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
