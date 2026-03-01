"use client";

import { Visit, VisitStatus } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useRef } from "react";

const statusConfig: Record<VisitStatus, { label: string; color: string; bgColor: string }> = {
  scheduled:   { label: "Programada",  color: "#007aff", bgColor: "rgba(0,122,255,0.1)" },
  in_progress: { label: "En curso",    color: "#ff9500", bgColor: "rgba(255,149,0,0.1)" },
  completed:   { label: "Completada",  color: "#34c759", bgColor: "rgba(52,199,89,0.1)" },
  cancelled:   { label: "Cancelada",   color: "#ff3b30", bgColor: "rgba(255,59,48,0.1)" },
  missed:      { label: "No realizada", color: "#ff3b30", bgColor: "rgba(255,59,48,0.1)" },
};

interface VisitModalProps {
  visit: Visit;
  storeName: string;
  userName: string;
  onClose: () => void;
  onUpdateStatus: (visitId: string, status: VisitStatus) => void;
  onDelete: (visitId: string) => void;
  loading?: boolean;
}

export default function VisitModal({ visit, storeName, userName, onClose, onUpdateStatus, onDelete, loading }: VisitModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const config = statusConfig[visit.status];

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const scheduledDate = visit.scheduled_at ? new Date(visit.scheduled_at) : null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm"
    >
      <div className="animate-fade-up mx-4 w-full max-w-md rounded-2xl bg-white p-0 shadow-2xl shadow-black/10">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#f5f5f7] p-6 pb-4">
          <div className="min-w-0 flex-1">
            <div
              className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
              style={{ backgroundColor: config.bgColor, color: config.color }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              {config.label}
            </div>
            <h3 className="text-[17px] font-semibold text-[#1d1d1f]">
              {storeName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#86868b] transition-colors hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-6">
          {scheduledDate && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5f5f7]">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="1" y="2" width="14" height="13" rx="2" stroke="#86868b" strokeWidth="1.2" />
                    <path d="M1 6H15" stroke="#86868b" strokeWidth="1.2" />
                    <path d="M5 1V3" stroke="#86868b" strokeWidth="1.2" strokeLinecap="round" />
                    <path d="M11 1V3" stroke="#86868b" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868b]">Fecha</p>
                  <p className="text-[14px] text-[#1d1d1f]">
                    {format(scheduledDate, "EEEE d 'de' MMMM, yyyy", { locale: es })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5f5f7]">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="#86868b" strokeWidth="1.2" />
                    <path d="M8 4V8L10.5 10.5" stroke="#86868b" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868b]">Hora</p>
                  <p className="text-[14px] text-[#1d1d1f]">
                    {format(scheduledDate, "HH:mm")} h
                  </p>
                </div>
              </div>
            </>
          )}

          {userName && (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5f5f7]">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="5.5" r="3" stroke="#86868b" strokeWidth="1.2" />
                  <path d="M2 14.5C2 11.5 4.5 10 8 10C11.5 10 14 11.5 14 14.5" stroke="#86868b" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868b]">GPV</p>
                <p className="text-[14px] text-[#1d1d1f]">{userName}</p>
              </div>
            </div>
          )}

          {visit.notes && (
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f5f5f7]">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3H13M3 6.5H13M3 10H9" stroke="#86868b" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868b]">Notas</p>
                <p className="text-[14px] leading-relaxed text-[#1d1d1f]">{visit.notes}</p>
              </div>
            </div>
          )}

          {visit.duration_minutes != null && (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5f5f7]">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="#86868b" strokeWidth="1.2" />
                  <path d="M8 4V8L10.5 10.5" stroke="#86868b" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868b]">Duración</p>
                <p className="text-[14px] text-[#1d1d1f]">{visit.duration_minutes} min</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-[#f5f5f7] p-6 pt-4">
          <div className="flex gap-2">
            {visit.status === "scheduled" && (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => onUpdateStatus(visit.id, "in_progress")}
                  className="flex-1 rounded-full bg-[#007aff] px-4 py-2.5 text-[13px] font-medium text-white transition-all duration-200 hover:bg-[#0066cc] active:scale-[0.98] disabled:opacity-50"
                >
                  Iniciar visita
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => onUpdateStatus(visit.id, "cancelled")}
                  className="rounded-full px-4 py-2.5 text-[13px] font-medium text-[#ff3b30] transition-all duration-200 hover:bg-[#ff3b30]/10 active:scale-[0.98] disabled:opacity-50"
                >
                  Cancelar
                </button>
              </>
            )}
            {visit.status === "in_progress" && (
              <button
                type="button"
                disabled={loading}
                onClick={() => onUpdateStatus(visit.id, "completed")}
                className="flex-1 rounded-full bg-[#34c759] px-4 py-2.5 text-[13px] font-medium text-white transition-all duration-200 hover:bg-[#2db84e] active:scale-[0.98] disabled:opacity-50"
              >
                Completar visita
              </button>
            )}
            {(visit.status === "completed" || visit.status === "cancelled" || visit.status === "missed") && (
              <button
                type="button"
                disabled={loading}
                onClick={() => onUpdateStatus(visit.id, "scheduled")}
                className="flex-1 rounded-full bg-[#f5f5f7] px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f] transition-all duration-200 hover:bg-[#e5e5ea] active:scale-[0.98] disabled:opacity-50"
              >
                Reprogramar
              </button>
            )}
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => onDelete(visit.id)}
            className="mt-2 w-full rounded-full px-4 py-2 text-[12px] font-medium text-[#ff3b30] transition-colors hover:bg-[#ff3b30]/10 disabled:opacity-50"
          >
            Eliminar visita
          </button>
        </div>
      </div>
    </div>
  );
}
