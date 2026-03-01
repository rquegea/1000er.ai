"use client";

import CalendarGrid from "@/components/calendar/CalendarGrid";
import NewVisitForm from "@/components/calendar/NewVisitForm";
import VisitModal from "@/components/calendar/VisitModal";
import { Store, Visit, VisitStatus } from "@/types";
import { addMonths, subMonths } from "date-fns";
import { useState } from "react";

/* ── Mock Data ─────────────────────────────────────────── */

const mockStores = [
  { id: "1", name: "Mercadona Sanchinarro", chain: "Mercadona", address: "C/ Sanchinarro 12" },
  { id: "2", name: "Carrefour Arturo Soria", chain: "Carrefour", address: "Av. Arturo Soria 56" },
  { id: "3", name: "Mercadona Pintor Gris", chain: "Mercadona", address: "C/ Pintor Gris 8" },
  { id: "4", name: "Lidl Gran Vía", chain: "Lidl", address: "Gran Vía 32" },
  { id: "5", name: "Dia Las Tablas", chain: "Dia", address: "Av. Las Tablas 14" },
] as Store[];

const initialVisits: Visit[] = [
  { id: "1", storeId: "1", storeName: "Mercadona Sanchinarro", scheduledAt: "2026-03-05T09:00:00", status: "completed", notes: "Revisar lineal de cereales" },
  { id: "2", storeId: "2", storeName: "Carrefour Arturo Soria", scheduledAt: "2026-03-05T11:30:00", status: "scheduled" },
  { id: "3", storeId: "3", storeName: "Mercadona Pintor Gris", scheduledAt: "2026-03-07T10:00:00", status: "scheduled" },
  { id: "4", storeId: "4", storeName: "Lidl Gran Vía", scheduledAt: "2026-03-10T09:30:00", status: "scheduled" },
  { id: "5", storeId: "1", storeName: "Mercadona Sanchinarro", scheduledAt: "2026-03-12T14:00:00", status: "in_progress" },
  { id: "6", storeId: "5", storeName: "Dia Las Tablas", scheduledAt: "2026-03-15T08:30:00", status: "scheduled" },
  { id: "7", storeId: "2", storeName: "Carrefour Arturo Soria", scheduledAt: "2026-03-18T10:00:00", status: "cancelled", notes: "Tienda cerrada por reformas" },
  { id: "8", storeId: "3", storeName: "Mercadona Pintor Gris", scheduledAt: "2026-03-20T11:00:00", status: "missed" },
  { id: "9", storeId: "4", storeName: "Lidl Gran Vía", scheduledAt: "2026-03-22T09:00:00", status: "scheduled" },
  { id: "10", storeId: "1", storeName: "Mercadona Sanchinarro", scheduledAt: "2026-03-25T16:00:00", status: "scheduled" },
  { id: "11", storeId: "5", storeName: "Dia Las Tablas", scheduledAt: "2026-03-28T10:30:00", status: "scheduled" },
];

/* ── Status Legend ──────────────────────────────────────── */

const legend = [
  { label: "Programada", color: "#007aff" },
  { label: "En curso", color: "#ff9500" },
  { label: "Completada", color: "#34c759" },
  { label: "Cancelada", color: "#ff3b30" },
];

/* ── Page Component ────────────────────────────────────── */

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 1)); // March 2026
  const [visits, setVisits] = useState<Visit[]>(initialVisits);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [newVisitDate, setNewVisitDate] = useState<Date | null>(null);

  const handlePreviousMonth = () => setCurrentDate((d) => subMonths(d, 1));
  const handleNextMonth = () => setCurrentDate((d) => addMonths(d, 1));

  const handleDayClick = (date: Date) => {
    setNewVisitDate(date);
  };

  const handleVisitClick = (visit: Visit) => {
    setSelectedVisit(visit);
  };

  const handleUpdateStatus = (visitId: string, status: VisitStatus) => {
    setVisits((prev) =>
      prev.map((v) => (v.id === visitId ? { ...v, status } : v))
    );
    setSelectedVisit(null);
  };

  const handleCreateVisit = (data: { storeId: string; scheduledAt: string; notes: string }) => {
    const store = mockStores.find((s) => s.id === data.storeId);
    if (!store) return;
    const newVisit: Visit = {
      id: crypto.randomUUID(),
      storeId: data.storeId,
      storeName: store.name,
      scheduledAt: data.scheduledAt,
      status: "scheduled",
      notes: data.notes || undefined,
    };
    setVisits((prev) => [...prev, newVisit]);
    setNewVisitDate(null);
  };

  // Stats
  const monthVisits = visits.filter((v) => {
    const d = new Date(v.scheduledAt);
    return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
  });
  const completedCount = monthVisits.filter((v) => v.status === "completed").length;
  const scheduledCount = monthVisits.filter((v) => v.status === "scheduled").length;
  const totalCount = monthVisits.length;

  return (
    <div className="mx-auto max-w-5xl px-6 pb-20 pt-24">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#1d1d1f]">
            Calendario
          </h1>
          <p className="mt-1 text-[13px] text-[#86868b]">
            {totalCount} visitas este mes &middot; {completedCount} completadas &middot; {scheduledCount} pendientes
          </p>
        </div>
        <button
          onClick={() => setNewVisitDate(new Date())}
          className="inline-flex items-center gap-2 rounded-full bg-[#1d1d1f] px-6 py-2.5 text-[13px] font-medium text-white transition-all duration-200 hover:bg-[#333336] active:scale-[0.97]"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Nueva visita
        </button>
      </div>

      {/* Legend */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {legend.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[11px] text-[#86868b]">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <CalendarGrid
        currentDate={currentDate}
        visits={visits}
        onPreviousMonth={handlePreviousMonth}
        onNextMonth={handleNextMonth}
        onDayClick={handleDayClick}
        onVisitClick={handleVisitClick}
      />

      {/* Visit Detail Modal */}
      {selectedVisit && (
        <VisitModal
          visit={selectedVisit}
          onClose={() => setSelectedVisit(null)}
          onUpdateStatus={handleUpdateStatus}
        />
      )}

      {/* New Visit Modal */}
      {newVisitDate && (
        <NewVisitForm
          stores={mockStores}
          initialDate={newVisitDate}
          onSubmit={handleCreateVisit}
          onClose={() => setNewVisitDate(null)}
        />
      )}
    </div>
  );
}
