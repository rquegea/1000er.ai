"use client";

import { Visit } from "@/types";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import VisitChip from "./VisitChip";

const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

interface CalendarGridProps {
  currentDate: Date;
  visits: Visit[];
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onDayClick: (date: Date) => void;
  onVisitClick: (visit: Visit) => void;
}

export default function CalendarGrid({
  currentDate,
  visits,
  onPreviousMonth,
  onNextMonth,
  onDayClick,
  onVisitClick,
}: CalendarGridProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getVisitsForDay = (day: Date) =>
    visits
      .filter((v) => isSameDay(new Date(v.scheduledAt), day))
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  return (
    <div className="animate-fade-in">
      {/* Month Navigation */}
      <div className="mb-8 flex items-center justify-between">
        <button
          onClick={onPreviousMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#86868b] transition-all duration-200 hover:bg-[#f5f5f7] hover:text-[#1d1d1f] active:scale-95"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h2 className="text-[20px] font-semibold text-[#1d1d1f]">
          {format(currentDate, "MMMM yyyy", { locale: es })}
        </h2>
        <button
          onClick={onNextMonth}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#86868b] transition-all duration-200 hover:bg-[#f5f5f7] hover:text-[#1d1d1f] active:scale-95"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="mb-2 grid grid-cols-7 gap-px">
        {weekDays.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-[11px] font-medium uppercase tracking-wider text-[#86868b]"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-[#f5f5f7] bg-[#f5f5f7]">
        {days.map((day) => {
          const dayVisits = getVisitsForDay(day);
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={`group relative flex min-h-[100px] flex-col bg-white p-2 text-left transition-colors duration-150 hover:bg-[#fafafa] sm:min-h-[120px] ${
                !inMonth ? "opacity-40" : ""
              }`}
            >
              {/* Day number */}
              <span
                className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-medium ${
                  today
                    ? "bg-[#1d1d1f] text-white"
                    : "text-[#1d1d1f] group-hover:bg-[#f5f5f7]"
                }`}
              >
                {format(day, "d")}
              </span>

              {/* Visit chips */}
              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                {dayVisits.slice(0, 3).map((visit) => (
                  <VisitChip key={visit.id} visit={visit} onClick={onVisitClick} />
                ))}
                {dayVisits.length > 3 && (
                  <span className="mt-0.5 text-[10px] font-medium text-[#86868b]">
                    +{dayVisits.length - 3} más
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
