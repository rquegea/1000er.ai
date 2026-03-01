"use client";

import { Visit } from "@/types";
import { format } from "date-fns";

const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  scheduled:   { bg: "bg-[#007aff]/10", text: "text-[#007aff]", dot: "bg-[#007aff]" },
  in_progress: { bg: "bg-[#ff9500]/10", text: "text-[#ff9500]", dot: "bg-[#ff9500]" },
  completed:   { bg: "bg-[#34c759]/10", text: "text-[#34c759]", dot: "bg-[#34c759]" },
  cancelled:   { bg: "bg-[#ff3b30]/10", text: "text-[#ff3b30]", dot: "bg-[#ff3b30]" },
  missed:      { bg: "bg-[#ff3b30]/10", text: "text-[#ff3b30]", dot: "bg-[#ff3b30]" },
};

interface VisitChipProps {
  visit: Visit;
  onClick?: (visit: Visit) => void;
}

export default function VisitChip({ visit, onClick }: VisitChipProps) {
  const colors = statusColors[visit.status] || statusColors.scheduled;
  const time = format(new Date(visit.scheduledAt), "HH:mm");

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(visit);
      }}
      className={`group flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-all duration-200 hover:scale-[1.02] ${colors.bg}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colors.dot}`} />
      <span className={`truncate text-[11px] font-medium ${colors.text}`}>
        {time} {visit.storeName}
      </span>
    </button>
  );
}
