interface KpiCardProps {
  label: string;
  value: string | number;
  accent?: boolean;
}

export default function KpiCard({ label, value, accent }: KpiCardProps) {
  return (
    <div className="animate-fade-in">
      <p className="text-[11px] font-medium uppercase tracking-widest text-[#86868b]">
        {label}
      </p>
      <p
        className={`mt-1 text-3xl font-semibold tracking-tight ${
          accent ? "text-[#ff3b30]" : "text-[#1d1d1f]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
