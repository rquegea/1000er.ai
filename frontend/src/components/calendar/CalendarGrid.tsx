"use client";

import { Store, Visit } from "@/types";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import VisitChip from "./VisitChip";

export type ViewMode = "month" | "week" | "day";

const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00 – 20:00

interface CalendarGridProps {
  currentDate: Date;
  visits: Visit[];
  stores: Store[];
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onPrevious: () => void;
  onNext: () => void;
  onDayClick: (date: Date) => void;
  onVisitClick: (visit: Visit) => void;
}

export default function CalendarGrid({
  currentDate,
  visits,
  stores,
  viewMode,
  onViewModeChange,
  onPrevious,
  onNext,
  onDayClick,
  onVisitClick,
}: CalendarGridProps) {
  const storeMap = new Map(stores.map((s) => [s.id, s.name]));
  const chainMap = new Map(stores.map((s) => [s.id, s.chain || ""]));

  const getVisitsForDay = (day: Date) =>
    visits
      .filter((v) => v.scheduled_at && isSameDay(new Date(v.scheduled_at), day))
      .sort((a, b) => (a.scheduled_at || "").localeCompare(b.scheduled_at || ""));

  /* ── Title text per view ──────────────────────────────── */
  const getTitle = () => {
    if (viewMode === "month") {
      return format(currentDate, "MMMM yyyy", { locale: es });
    }
    if (viewMode === "week") {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 6);
      const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
      if (sameMonth) {
        return `${format(weekStart, "d")} – ${format(weekEnd, "d 'de' MMMM yyyy", { locale: es })}`;
      }
      return `${format(weekStart, "d MMM", { locale: es })} – ${format(weekEnd, "d MMM yyyy", { locale: es })}`;
    }
    return format(currentDate, "EEEE d 'de' MMMM, yyyy", { locale: es });
  };

  /* ── Navigation arrows ────────────────────────────────── */
  const ArrowLeft = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const ArrowRight = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  /* ── Month view (existing) ────────────────────────────── */
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
      <>
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
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-[#f5f5f7] bg-[#f5f5f7]">
          {days.map((day) => {
            const dayVisits = getVisitsForDay(day);
            const inMonth = isSameMonth(day, currentDate);
            const today = isToday(day);

            return (
              <div
                key={day.toISOString()}
                onClick={() => {
                  onDayClick(day);
                  onViewModeChange("day");
                }}
                className={`group relative flex min-h-[100px] cursor-pointer flex-col bg-white p-2 text-left transition-colors duration-150 hover:bg-[#fafafa] sm:min-h-[120px] ${
                  !inMonth ? "opacity-40" : ""
                }`}
              >
                <span
                  className={`mb-1 flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-medium ${
                    today
                      ? "bg-[#1d1d1f] text-white"
                      : "text-[#1d1d1f] group-hover:bg-[#f5f5f7]"
                  }`}
                >
                  {format(day, "d")}
                </span>
                <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                  {dayVisits.slice(0, 3).map((visit) => (
                    <VisitChip
                      key={visit.id}
                      visit={visit}
                      storeName={storeMap.get(visit.store_id) || "—"}
                      storeChain={chainMap.get(visit.store_id) || ""}
                      onClick={onVisitClick}
                    />
                  ))}
                  {dayVisits.length > 3 && (
                    <span className="mt-0.5 text-[10px] font-medium text-[#86868b]">
                      +{dayVisits.length - 3} más
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  /* ── Week view ────────────────────────────────────────── */
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });

    return (
      <>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-[#f5f5f7] bg-[#f5f5f7]">
          {days.map((day) => {
            const dayVisits = getVisitsForDay(day);
            const today = isToday(day);

            return (
              <div
                key={day.toISOString()}
                onClick={() => {
                  onDayClick(day);
                  onViewModeChange("day");
                }}
                className="group flex min-h-[350px] cursor-pointer flex-col bg-white p-3 text-left transition-colors duration-150 hover:bg-[#fafafa]"
              >
                {/* Day header */}
                <div className="mb-3 text-center">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                    {weekDays[days.indexOf(day)]}
                  </p>
                  <span
                    className={`mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-semibold ${
                      today
                        ? "bg-[#1d1d1f] text-white"
                        : "text-[#1d1d1f] group-hover:bg-[#f5f5f7]"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                {/* Visits */}
                <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
                  {dayVisits.length === 0 && (
                    <p className="mt-4 text-center text-[11px] text-[#c7c7cc]">—</p>
                  )}
                  {dayVisits.map((visit) => (
                    <VisitChip
                      key={visit.id}
                      visit={visit}
                      storeName={storeMap.get(visit.store_id) || "—"}
                      storeChain={chainMap.get(visit.store_id) || ""}
                      onClick={onVisitClick}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  /* ── Day view (timeline) ──────────────────────────────── */
  const renderDayView = () => {
    const dayVisits = getVisitsForDay(currentDate);

    return (
      <div className="overflow-hidden rounded-2xl border border-[#f5f5f7]">
        {dayVisits.length === 0 && (
          <div className="flex h-48 items-center justify-center">
            <p className="text-[13px] text-[#86868b]">Sin visitas programadas</p>
          </div>
        )}
        {dayVisits.length > 0 && (
          <div className="divide-y divide-[#f5f5f7]">
            {hours.map((hour) => {
              const hourVisits = dayVisits.filter((v) => {
                if (!v.scheduled_at) return false;
                return new Date(v.scheduled_at).getHours() === hour;
              });

              return (
                <div key={hour} className="flex min-h-[56px]">
                  {/* Hour label */}
                  <div className="flex w-16 shrink-0 items-start justify-end border-r border-[#f5f5f7] bg-[#fafafa] px-3 py-2">
                    <span className="text-[12px] font-medium text-[#86868b]">
                      {String(hour).padStart(2, "0")}:00
                    </span>
                  </div>
                  {/* Visits in this hour */}
                  <div className="flex flex-1 flex-col gap-1 p-2">
                    {hourVisits.map((visit) => (
                      <VisitChip
                        key={visit.id}
                        visit={visit}
                        storeName={storeMap.get(visit.store_id) || "—"}
                      storeChain={chainMap.get(visit.store_id) || ""}
                        onClick={onVisitClick}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  /* ── Render ───────────────────────────────────────────── */
  return (
    <div className="animate-fade-in">
      {/* Navigation + View Selector */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Prev / Title / Next */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPrevious}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#86868b] transition-all duration-200 hover:bg-[#f5f5f7] hover:text-[#1d1d1f] active:scale-95"
          >
            {ArrowLeft}
          </button>
          <h2 className="min-w-0 text-[20px] font-semibold capitalize text-[#1d1d1f]">
            {getTitle()}
          </h2>
          <button
            type="button"
            onClick={onNext}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#86868b] transition-all duration-200 hover:bg-[#f5f5f7] hover:text-[#1d1d1f] active:scale-95"
          >
            {ArrowRight}
          </button>
        </div>

        {/* View mode selector */}
        <div className="flex items-center rounded-full bg-[#f5f5f7] p-1">
          {(["day", "week", "month"] as const).map((mode) => {
            const labels: Record<ViewMode, string> = {
              day: "Día",
              week: "Semana",
              month: "Mes",
            };
            const active = viewMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onViewModeChange(mode)}
                className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-200 ${
                  active
                    ? "bg-[#1d1d1f] text-white shadow-sm"
                    : "text-[#86868b] hover:text-[#1d1d1f]"
                }`}
              >
                {labels[mode]}
              </button>
            );
          })}
        </div>
      </div>

      {/* View content */}
      {viewMode === "month" && renderMonthView()}
      {viewMode === "week" && renderWeekView()}
      {viewMode === "day" && renderDayView()}
    </div>
  );
}
