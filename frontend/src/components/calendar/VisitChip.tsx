"use client";

import { Visit } from "@/types";
import { format } from "date-fns";
import ChainLogo from "@/components/ChainLogo";

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  scheduled:   { bg: "bg-[#007aff]/10", text: "text-[#007aff]", dot: "bg-[#007aff]" },
  in_progress: { bg: "bg-[#ff9500]/10", text: "text-[#ff9500]", dot: "bg-[#ff9500]" },
  completed:   { bg: "bg-[#34c759]/10", text: "text-[#34c759]", dot: "bg-[#34c759]" },
  cancelled:   { bg: "bg-[#ff3b30]/10", text: "text-[#ff3b30]", dot: "bg-[#ff3b30]" },
  missed:      { bg: "bg-[#ff3b30]/10", text: "text-[#ff3b30]", dot: "bg-[#ff3b30]" },
};

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}min`;
  return `${m}min`;
}

interface VisitChipProps {
  visit: Visit;
  storeName: string;
  storeChain?: string;
  onClick?: (visit: Visit) => void;
}

export default function VisitChip({ visit, storeName, storeChain, onClick }: VisitChipProps) {
  const colors = statusColors[visit.status] || statusColors.scheduled;
  const time = visit.scheduled_at ? format(new Date(visit.scheduled_at), "HH:mm") : "--:--";

  const tooltipText =
    visit.status === "completed" && visit.duration_minutes != null
      ? `Duración: ${formatDuration(visit.duration_minutes)} — Click para ver resumen`
      : undefined;

  return (
    <div
      role="button"
      tabIndex={0}
      title={tooltipText}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(visit);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.stopPropagation();
          onClick?.(visit);
        }
      }}
      className={`group flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-all duration-200 hover:scale-[1.02] ${colors.bg}`}
    >
      {/* Chain favicon */}
      {storeChain && <ChainLogo chain={storeChain} size={14} className="rounded-sm" />}
      {/* Status indicator */}
      {!storeChain && (
        visit.status === "completed" ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
            <circle cx="6" cy="6" r="5.5" stroke="#34c759" strokeWidth="1" fill="rgba(52,199,89,0.15)" />
            <path d="M3.5 6L5.5 8L8.5 4" stroke="#34c759" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : visit.status === "in_progress" ? (
          <span className={`h-2 w-2 shrink-0 rounded-full ${colors.dot} animate-pulse`} />
        ) : (
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colors.dot}`} />
        )
      )}
      <span className={`truncate text-[11px] font-medium ${colors.text}`}>
        {time} {storeName}
      </span>
    </div>
  );
}
