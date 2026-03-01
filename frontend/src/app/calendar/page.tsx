"use client";

import { useEffect, useState, useCallback } from "react";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import NewVisitForm from "@/components/calendar/NewVisitForm";
import VisitModal from "@/components/calendar/VisitModal";
import Spinner from "@/components/Spinner";
import { Store, Visit, VisitStatus } from "@/types";
import {
  listVisits,
  createVisit,
  startVisit,
  endVisit,
  updateVisit,
  deleteVisit,
  listStores,
} from "@/lib/api";
import { addMonths, subMonths } from "date-fns";

/* ── Status Legend ──────────────────────────────────────── */

const legend = [
  { label: "Programada", color: "#007aff" },
  { label: "En curso", color: "#ff9500" },
  { label: "Completada", color: "#34c759" },
  { label: "Cancelada", color: "#ff3b30" },
];

/* ── Page Component ────────────────────────────────────── */

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [visits, setVisits] = useState<Visit[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [newVisitDate, setNewVisitDate] = useState<Date | null>(null);

  const storeMap = new Map(stores.map((s) => [s.id, s.name]));

  const fetchData = useCallback(async () => {
    try {
      const [visitsRes, storesRes] = await Promise.all([
        listVisits(200),
        listStores(200),
      ]);
      setVisits(visitsRes.data);
      setStores(storesRes.data);
    } catch {
      setError("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePreviousMonth = () => setCurrentDate((d) => subMonths(d, 1));
  const handleNextMonth = () => setCurrentDate((d) => addMonths(d, 1));

  const handleDayClick = (date: Date) => {
    setNewVisitDate(date);
  };

  const handleVisitClick = (visit: Visit) => {
    setSelectedVisit(visit);
  };

  const handleUpdateStatus = async (visitId: string, status: VisitStatus) => {
    setActionLoading(true);
    try {
      if (status === "in_progress") {
        await startVisit(visitId);
      } else if (status === "completed") {
        await endVisit(visitId);
      } else {
        await updateVisit(visitId, { status });
      }
      setSelectedVisit(null);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteVisit = async (visitId: string) => {
    setActionLoading(true);
    try {
      await deleteVisit(visitId);
      setSelectedVisit(null);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateVisit = async (data: { storeId: string; scheduledAt: string; notes: string }) => {
    try {
      await createVisit({
        store_id: data.storeId,
        scheduled_at: data.scheduledAt,
        notes: data.notes || undefined,
      });
      setNewVisitDate(null);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear visita");
    }
  };

  // Stats for current month
  const monthVisits = visits.filter((v) => {
    if (!v.scheduled_at) return false;
    const d = new Date(v.scheduled_at);
    return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
  });
  const completedCount = monthVisits.filter((v) => v.status === "completed").length;
  const scheduledCount = monthVisits.filter((v) => v.status === "scheduled").length;
  const totalCount = monthVisits.length;

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-48px)] items-center justify-center pt-12">
        <Spinner size="lg" />
      </div>
    );
  }

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
          type="button"
          onClick={() => setNewVisitDate(new Date())}
          className="inline-flex items-center gap-2 rounded-full bg-[#1d1d1f] px-6 py-2.5 text-[13px] font-medium text-white transition-all duration-200 hover:bg-[#333336] active:scale-[0.97]"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Nueva visita
        </button>
      </div>

      {error && (
        <p className="mb-4 text-[13px] text-[#ff3b30]">{error}</p>
      )}

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
        stores={stores}
        onPreviousMonth={handlePreviousMonth}
        onNextMonth={handleNextMonth}
        onDayClick={handleDayClick}
        onVisitClick={handleVisitClick}
      />

      {/* Visit Detail Modal */}
      {selectedVisit && (
        <VisitModal
          visit={selectedVisit}
          storeName={storeMap.get(selectedVisit.store_id) || "—"}
          onClose={() => setSelectedVisit(null)}
          onUpdateStatus={handleUpdateStatus}
          onDelete={handleDeleteVisit}
          loading={actionLoading}
        />
      )}

      {/* New Visit Modal */}
      {newVisitDate && (
        <NewVisitForm
          stores={stores}
          initialDate={newVisitDate}
          onSubmit={handleCreateVisit}
          onClose={() => setNewVisitDate(null)}
        />
      )}
    </div>
  );
}
