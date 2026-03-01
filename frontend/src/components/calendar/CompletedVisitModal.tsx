"use client";

import { useEffect, useRef, useState } from "react";
import { Visit, VisitSummary, VisitPhoto } from "@/types";
import { getVisitSummary, listVisitPhotos } from "@/lib/api";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Spinner from "@/components/Spinner";
import ChainLogo from "@/components/ChainLogo";

interface CompletedVisitModalProps {
  visit: Visit;
  storeName: string;
  userName: string;
  onClose: () => void;
  onDelete: (visitId: string) => void;
  onReschedule: (visitId: string) => void;
  loading?: boolean;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

const categoryLabels: Record<string, { emoji: string; label: string }> = {
  shelf:     { emoji: "\uD83D\uDCE6", label: "Lineal" },
  promotion: { emoji: "\uD83C\uDFF7\uFE0F", label: "Promociones" },
  activity:  { emoji: "\uD83C\uDFDD\uFE0F", label: "Actividades" },
};

export default function CompletedVisitModal({
  visit,
  storeName,
  userName,
  onClose,
  onDelete,
  onReschedule,
  loading: actionLoading,
}: CompletedVisitModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState<VisitSummary | null>(null);
  const [photos, setPhotos] = useState<VisitPhoto[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    async function fetchSummary() {
      try {
        const [summaryData, photosData] = await Promise.all([
          getVisitSummary(visit.id),
          listVisitPhotos(visit.id),
        ]);
        setSummary(summaryData);
        setPhotos(photosData.data);
      } catch {
        // Fail silently — we still show basic visit info
      } finally {
        setLoadingSummary(false);
      }
    }
    fetchSummary();
  }, [visit.id]);

  const startedAt = visit.started_at ? new Date(visit.started_at) : null;
  const endedAt = visit.ended_at ? new Date(visit.ended_at) : null;
  const scheduledDate = visit.scheduled_at ? new Date(visit.scheduled_at) : null;

  const displayStoreName = summary?.store_name || storeName;
  const displayAddress = summary?.store_address;

  const totalPhotos = summary
    ? Object.values(summary.photos_count).reduce((a, b) => a + b, 0)
    : photos.length;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm"
    >
      <div className="animate-fade-up mx-4 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl shadow-black/10">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-[#f5f5f7] p-6 pb-4 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div
                className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
                style={{ backgroundColor: "rgba(52,199,89,0.1)", color: "#34c759" }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5L4.5 7.5L8 3" stroke="#34c759" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Completada
              </div>
              <h3 className="flex items-center gap-2 text-[17px] font-semibold text-[#1d1d1f]">
                {summary?.store_chain && (
                  <ChainLogo chain={summary.store_chain} size={22} className="rounded-md" />
                )}
                {displayStoreName}
              </h3>
              {displayAddress && (
                <p className="mt-0.5 text-[13px] text-[#86868b]">{displayAddress}</p>
              )}
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
        </div>

        {loadingSummary ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="md" />
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Time & Duration */}
            <div className="space-y-3">
              {/* Date */}
              {(scheduledDate || startedAt) && (
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
                      {format(scheduledDate || startedAt!, "EEEE d 'de' MMMM, yyyy", { locale: es })}
                    </p>
                  </div>
                </div>
              )}

              {/* Start → End time */}
              {startedAt && endedAt && (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5f5f7]">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" stroke="#86868b" strokeWidth="1.2" />
                      <path d="M8 4V8L10.5 10.5" stroke="#86868b" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868b]">Horario</p>
                    <p className="text-[14px] text-[#1d1d1f]">
                      {format(startedAt, "HH:mm")} → {format(endedAt, "HH:mm")}
                    </p>
                  </div>
                </div>
              )}

              {/* Duration */}
              {visit.duration_minutes != null && (
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#34c759]/10">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" stroke="#34c759" strokeWidth="1.2" />
                      <path d="M8 4V8L10.5 10.5" stroke="#34c759" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868b]">Duracion</p>
                    <p className="text-[14px] font-medium text-[#1d1d1f]">
                      {formatDuration(visit.duration_minutes)}
                    </p>
                  </div>
                </div>
              )}

              {/* GPV */}
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
            </div>

            {/* Photos by category */}
            {totalPhotos > 0 && (
              <div>
                <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[#86868b]">
                  Fotos ({totalPhotos})
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {(["shelf", "promotion", "activity"] as const).map((cat) => {
                    const count = summary?.photos_count[cat] ?? 0;
                    const { emoji, label } = categoryLabels[cat];
                    return (
                      <div
                        key={cat}
                        className="flex flex-col items-center rounded-xl bg-[#f5f5f7] p-3"
                      >
                        <span className="text-[18px]">{emoji}</span>
                        <span className="mt-1 text-[20px] font-semibold text-[#1d1d1f]">{count}</span>
                        <span className="text-[11px] text-[#86868b]">{label}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Photo thumbnails */}
                {photos.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {photos.slice(0, 6).map((photo) => (
                      <img
                        key={photo.id}
                        src={photo.image_url}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded-lg object-cover border border-[#f5f5f7]"
                      />
                    ))}
                    {photos.length > 6 && (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#f5f5f7] text-[12px] font-medium text-[#86868b]">
                        +{photos.length - 6}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Analysis results */}
            {summary && summary.total_products > 0 && (
              <div>
                <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-[#86868b]">
                  Resultados del analisis
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center rounded-xl bg-[#007aff]/5 p-3">
                    <span className="text-[22px] font-bold text-[#007aff]">{summary.total_products}</span>
                    <span className="text-[11px] text-[#86868b]">Productos</span>
                  </div>
                  <div className="flex flex-col items-center rounded-xl bg-[#ff3b30]/5 p-3">
                    <span className="text-[22px] font-bold text-[#ff3b30]">{summary.oos_count}</span>
                    <span className="text-[11px] text-[#86868b]">Fuera de stock</span>
                  </div>
                  <div className="flex flex-col items-center rounded-xl bg-[#34c759]/5 p-3">
                    <span className="text-[22px] font-bold text-[#34c759]">
                      {summary.avg_confidence != null ? `${Math.round(summary.avg_confidence * 100)}%` : "—"}
                    </span>
                    <span className="text-[11px] text-[#86868b]">Confianza</span>
                  </div>
                </div>

                {/* OOS Products list */}
                {summary.oos_products && summary.oos_products.length > 0 && (
                  <div className="mt-3 rounded-xl bg-[#ff3b30]/5 p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#ff3b30]">
                      Productos fuera de stock
                    </p>
                    <div className="space-y-1">
                      {summary.oos_products.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 text-[13px] text-[#1d1d1f]">
                          <span className="h-1 w-1 shrink-0 rounded-full bg-[#ff3b30]" />
                          <span>{p.product_name}</span>
                          {p.brand && (
                            <span className="text-[#86868b]">({p.brand})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Link to full analysis */}
                <a
                  href="/analysis"
                  className="mt-3 flex items-center justify-center gap-1.5 rounded-full bg-[#007aff]/10 px-4 py-2.5 text-[13px] font-medium text-[#007aff] transition-all duration-200 hover:bg-[#007aff]/20 active:scale-[0.98]"
                >
                  Ver analisis completo
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5 3L10 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </div>
            )}

            {/* Notes */}
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
          </div>
        )}

        {/* Actions */}
        <div className="sticky bottom-0 bg-white border-t border-[#f5f5f7] p-6 pt-4 rounded-b-2xl">
          <div className="flex gap-2">
            <button
              type="button"
              disabled={actionLoading}
              onClick={() => onReschedule(visit.id)}
              className="flex-1 rounded-full bg-[#f5f5f7] px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f] transition-all duration-200 hover:bg-[#e5e5ea] active:scale-[0.98] disabled:opacity-50"
            >
              Reprogramar
            </button>
          </div>
          <button
            type="button"
            disabled={actionLoading}
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
