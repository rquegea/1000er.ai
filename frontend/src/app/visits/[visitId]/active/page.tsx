"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  getVisit,
  startVisit,
  endVisit,
  getStore,
  listVisitPhotos,
  uploadVisitPhoto,
  deleteVisitPhoto,
  getVisitSummary,
  updateVisit,
} from "@/lib/api";
import type {
  Visit,
  Store,
  VisitPhoto,
  VisitSummary,
  PhotoCategory,
} from "@/types";
import ChainLogo from "@/components/ChainLogo";

// ── Constants ──────────────────────────────────────────────

const CATEGORIES: {
  key: PhotoCategory;
  label: string;
  icon: string;
  desc: string;
}[] = [
  {
    key: "shelf",
    label: "Lineal",
    icon: "🗄️",
    desc: "Fotos de estantería — análisis IA automático",
  },
  {
    key: "promotion",
    label: "Promoción",
    icon: "🏷️",
    desc: "Materiales promocionales y PLV",
  },
  {
    key: "activity",
    label: "Actividad",
    icon: "📋",
    desc: "Fotos de actividad en tienda",
  },
];

const STEP_LABELS = ["Briefing", "Fotos", "Resumen"];

// ── Helpers ────────────────────────────────────────────────

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// ── Main Component ─────────────────────────────────────────

export default function ActiveVisitPage() {
  const params = useParams();
  const router = useRouter();
  const visitId = params.visitId as string;

  // State
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [photos, setPhotos] = useState<VisitPhoto[]>([]);
  const [summary, setSummary] = useState<VisitSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingCategory, setUploadingCategory] =
    useState<PhotoCategory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [visitNotes, setVisitNotes] = useState("");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRefs = useRef<Record<PhotoCategory, HTMLInputElement | null>>({
    shelf: null,
    promotion: null,
    activity: null,
  });
  const startTimeRef = useRef<Date | null>(null);

  // ── Load visit data ────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const visitData = await getVisit(visitId);
        setVisit(visitData);
        setVisitNotes(visitData.notes || "");

        const storeData = await getStore(visitData.store_id);
        setStore(storeData);

        const photosRes = await listVisitPhotos(visitId);
        setPhotos(photosRes.data);

        if (visitData.status === "in_progress" && visitData.started_at) {
          startTimeRef.current = new Date(visitData.started_at);
          const now = new Date();
          setElapsed(
            Math.floor(
              (now.getTime() - startTimeRef.current.getTime()) / 1000
            )
          );
          setStep(2);
        }

        if (visitData.status === "completed") {
          const summaryData = await getVisitSummary(visitId);
          setSummary(summaryData);
          if (visitData.started_at && visitData.ended_at) {
            const start = new Date(visitData.started_at);
            const end = new Date(visitData.ended_at);
            setElapsed(Math.floor((end.getTime() - start.getTime()) / 1000));
          }
          setStep(3);
        }
      } catch {
        setError("Error cargando datos de la visita");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [visitId]);

  // ── Chronometer ────────────────────────────────────────

  useEffect(() => {
    if (visit?.status === "in_progress" && startTimeRef.current) {
      timerRef.current = setInterval(() => {
        const now = new Date();
        setElapsed(
          Math.floor(
            (now.getTime() - startTimeRef.current!.getTime()) / 1000
          )
        );
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visit?.status]);

  // ── Actions ────────────────────────────────────────────

  const handleStartVisit = useCallback(async () => {
    try {
      setLoading(true);
      const updated = await startVisit(visitId);
      setVisit(updated);
      startTimeRef.current = new Date(updated.started_at!);
      setElapsed(0);
      setStep(2);
    } catch {
      setError("Error al iniciar la visita");
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  const handleEndVisit = useCallback(async () => {
    try {
      setLoading(true);

      if (visitNotes !== (visit?.notes || "")) {
        await updateVisit(visitId, { notes: visitNotes });
      }

      const updated = await endVisit(visitId);
      setVisit(updated);

      if (timerRef.current) clearInterval(timerRef.current);

      const summaryData = await getVisitSummary(visitId);
      setSummary(summaryData);
      setStep(3);
    } catch {
      setError("Error al finalizar la visita");
    } finally {
      setLoading(false);
    }
  }, [visitId, visitNotes, visit?.notes]);

  const handleUploadPhoto = useCallback(
    async (category: PhotoCategory, e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setUploadingCategory(category);
      setError(null);

      try {
        for (const file of Array.from(files)) {
          const photo = await uploadVisitPhoto(visitId, file, category);
          setPhotos((prev) => [...prev, photo]);
        }
      } catch {
        setError("Error al subir la foto");
      } finally {
        setUploadingCategory(null);
        const ref = fileInputRefs.current[category];
        if (ref) ref.value = "";
      }
    },
    [visitId]
  );

  const handleDeletePhoto = useCallback(
    async (photoId: string) => {
      try {
        await deleteVisitPhoto(visitId, photoId);
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      } catch {
        setError("Error al eliminar la foto");
      }
    },
    [visitId]
  );

  // ── Derived ────────────────────────────────────────────

  const photosByCategory = (cat: PhotoCategory) =>
    photos.filter((p) => p.category === cat);

  // ── Loading state ──────────────────────────────────────

  if (loading && !visit) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1d1d1f] border-t-transparent" />
      </div>
    );
  }

  if (error && !visit) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-[15px] text-[#ff3b30]">{error}</p>
        <button
          onClick={() => router.push("/calendar")}
          className="rounded-full bg-[#f5f5f7] px-6 py-2.5 text-[13px] font-medium text-[#1d1d1f] transition-colors hover:bg-[#e5e5ea]"
        >
          Volver al calendario
        </button>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────

  return (
    <div className="mx-auto max-w-lg px-5 pb-32 pt-8">
      {/* Error toast */}
      {error && (
        <div className="mb-6 rounded-xl bg-[#ff3b30]/10 px-4 py-3 text-[13px] text-[#ff3b30]">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 font-medium underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* ── Sticky header with chronometer (step 2 only) ── */}
      {step === 2 && visit?.status === "in_progress" && (
        <div className="fixed left-0 right-0 top-12 z-40 border-b border-black/[0.04] bg-white/90 backdrop-blur-xl">
          <div className="mx-auto flex h-11 max-w-lg items-center justify-between px-5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff3b30]" />
              {store?.chain && <ChainLogo chain={store.chain} size={16} className="rounded-sm" />}
              <span className="text-[13px] font-medium text-[#1d1d1f]">
                {store?.name}
              </span>
            </div>
            <span className="font-mono text-[15px] font-semibold tabular-nums text-[#1d1d1f]">
              {formatDuration(elapsed)}
            </span>
          </div>
        </div>
      )}

      {/* ── Step indicator ─────────────────────────────────── */}
      <div className={`mb-10 flex items-center gap-1 ${step === 2 ? "mt-12" : ""}`}>
        {[1, 2, 3].map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-1">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold transition-all ${
                  step === s
                    ? "bg-[#1d1d1f] text-white"
                    : step > s
                    ? "bg-[#1d1d1f] text-white"
                    : "bg-[#f5f5f7] text-[#86868b]"
                }`}
              >
                {step > s ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                  >
                    <path
                      d="M2 6L5 9L10 3"
                      stroke="white"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  s
                )}
              </div>
              <span
                className={`text-[10px] font-medium ${
                  step >= s ? "text-[#1d1d1f]" : "text-[#86868b]"
                }`}
              >
                {STEP_LABELS[i]}
              </span>
            </div>
            {s < 3 && (
              <div
                className={`mb-5 h-[2px] flex-1 rounded-full ${
                  step > s ? "bg-[#1d1d1f]" : "bg-[#e5e5ea]"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Briefing ──────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-8">
          {/* Title */}
          <div>
            <h2 className="text-[24px] font-bold tracking-tight text-[#1d1d1f]">
              Briefing de visita
            </h2>
            <p className="mt-1 text-[14px] text-[#86868b]">
              Revisa la información antes de comenzar
            </p>
          </div>

          {/* Store info card */}
          <div className="space-y-4 rounded-2xl bg-[#f5f5f7] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm">
                {store?.chain ? (
                  <ChainLogo chain={store.chain} size={28} className="rounded-lg" />
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path
                      d="M2 9L10 2L18 9V18H2V9Z"
                      stroke="#1d1d1f"
                      strokeWidth="1.3"
                      strokeLinejoin="round"
                    />
                    <rect
                      x="8"
                      y="12"
                      width="4"
                      height="6"
                      stroke="#1d1d1f"
                      strokeWidth="1.3"
                    />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-[16px] font-semibold text-[#1d1d1f]">
                  {store?.name}
                </p>
                {store?.chain && (
                  <p className="text-[12px] text-[#86868b]">{store.chain}</p>
                )}
                {store?.address && (
                  <p className="text-[12px] text-[#86868b]">{store.address}</p>
                )}
              </div>
            </div>

            {(store?.contact_name || store?.phone_section_manager) && (
              <div className="border-t border-black/[0.04] pt-3 space-y-2">
                {store?.contact_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#86868b]">
                      Contacto
                    </span>
                    <span className="text-[13px] font-medium text-[#1d1d1f]">
                      {store.contact_name}
                    </span>
                  </div>
                )}
                {store?.phone_section_manager && (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#86868b]">
                      Jefe de sección
                    </span>
                    <span className="text-[13px] font-medium text-[#1d1d1f]">
                      {store.phone_section_manager}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Visit notes */}
          {visit?.notes && (
            <div className="rounded-2xl border border-[#e5e5ea] p-5">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                Notas de visita
              </p>
              <p className="text-[14px] leading-relaxed text-[#1d1d1f]">
                {visit.notes}
              </p>
            </div>
          )}

          {/* Checklist: what to photograph */}
          <div>
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
              Tareas a realizar
            </p>
            <div className="flex gap-2">
              {CATEGORIES.map((cat) => (
                <div
                  key={cat.key}
                  className="flex flex-1 flex-col items-center gap-2 rounded-2xl border border-[#e5e5ea] bg-white p-4"
                >
                  <span className="text-[24px]">{cat.icon}</span>
                  <span className="text-[12px] font-semibold text-[#1d1d1f]">
                    {cat.label}
                  </span>
                  <span className="text-center text-[10px] leading-tight text-[#86868b]">
                    {cat.desc.split("—")[0].trim()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Start button */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleStartVisit}
              disabled={loading}
              className="w-full rounded-full bg-[#1d1d1f] px-8 py-4 text-[15px] font-medium text-white transition-all duration-300 hover:bg-[#000] hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Iniciando...
                </span>
              ) : (
                "Iniciar visita"
              )}
            </button>

            <button
              onClick={() => router.push("/calendar")}
              className="w-full rounded-full px-6 py-3 text-[13px] font-medium text-[#86868b] transition-colors hover:text-[#1d1d1f]"
            >
              Volver al calendario
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Photo Upload ──────────────────────────── */}
      {step === 2 && (
        <div className="space-y-8">
          {/* Title */}
          <div>
            <h2 className="text-[24px] font-bold tracking-tight text-[#1d1d1f]">
              Captura de fotos
            </h2>
            <p className="mt-1 text-[14px] text-[#86868b]">
              Toca cada categoría para subir fotos
            </p>
          </div>

          {/* Category cards — large, tactile, mobile-first */}
          <div className="space-y-3">
            {CATEGORIES.map((cat) => {
              const count = photosByCategory(cat.key).length;
              const isShelf = cat.key === "shelf";

              return (
                <div
                  key={cat.key}
                  className="overflow-hidden rounded-2xl border border-[#e5e5ea] bg-white"
                >
                  {/* Card header */}
                  <div className="flex items-center gap-4 p-5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#f5f5f7] text-[28px]">
                      {cat.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[16px] font-semibold text-[#1d1d1f]">
                          {cat.label}
                        </h3>
                        {isShelf && (
                          <span className="rounded-full bg-[#1d1d1f] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
                            IA
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[12px] text-[#86868b]">
                        {cat.desc}
                      </p>
                    </div>
                    {count > 0 && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1d1d1f] text-[12px] font-semibold text-white">
                        {count}
                      </div>
                    )}
                  </div>

                  {/* Photo thumbnails */}
                  {count > 0 && (
                    <div className="flex gap-2 overflow-x-auto px-5 pb-3">
                      {photosByCategory(cat.key).map((photo) => (
                        <div
                          key={photo.id}
                          className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#f5f5f7]"
                        >
                          <img
                            src={photo.image_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                          {photo.analysis_id && (
                            <div className="absolute left-1 top-1 rounded-full bg-[#34c759] px-1.5 py-0.5 text-[8px] font-bold text-white">
                              IA
                            </div>
                          )}
                          <button
                            onClick={() => handleDeletePhoto(photo.id)}
                            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                          >
                            <svg
                              width="8"
                              height="8"
                              viewBox="0 0 8 8"
                              fill="none"
                            >
                              <path
                                d="M1 1L7 7M1 7L7 1"
                                stroke="white"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                              />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload button */}
                  <input
                    ref={(el) => {
                      fileInputRefs.current[cat.key] = el;
                    }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={(e) => handleUploadPhoto(cat.key, e)}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRefs.current[cat.key]?.click()}
                    disabled={uploadingCategory !== null}
                    className="flex w-full items-center justify-center gap-2 border-t border-[#f5f5f7] px-5 py-3.5 text-[14px] font-medium text-[#1d1d1f] transition-colors hover:bg-[#f5f5f7] active:bg-[#e5e5ea] disabled:opacity-50"
                  >
                    {uploadingCategory === cat.key ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1d1d1f] border-t-transparent" />
                        Subiendo...
                      </>
                    ) : (
                      <>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          fill="none"
                        >
                          <path
                            d="M8 3V13M3 8H13"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                        {count > 0 ? "Añadir foto" : "Tomar foto"}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Notes */}
          <div>
            <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
              Notas de visita
            </label>
            <textarea
              value={visitNotes}
              onChange={(e) => setVisitNotes(e.target.value)}
              placeholder="Observaciones, incidencias..."
              rows={3}
              className="w-full rounded-xl border border-[#e5e5ea] bg-white px-4 py-3 text-[14px] text-[#1d1d1f] placeholder-[#86868b] outline-none transition-colors focus:border-[#1d1d1f]"
            />
          </div>

          {/* End visit button */}
          <div className="pt-2">
            <button
              onClick={handleEndVisit}
              disabled={loading}
              className="w-full rounded-full bg-[#1d1d1f] px-8 py-4 text-[15px] font-medium text-white transition-all duration-300 hover:bg-[#000] hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Finalizando...
                </span>
              ) : (
                "Finalizar visita"
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Summary ───────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-8">
          {/* Success hero */}
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#34c759]/10">
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
              >
                <path
                  d="M8 16L14 22L24 10"
                  stroke="#34c759"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2 className="text-[24px] font-bold tracking-tight text-[#1d1d1f]">
              Visita completada
            </h2>
            <p className="mt-1 text-[14px] text-[#86868b]">
              {store?.name}
              {elapsed > 0 && <> &middot; {formatDuration(elapsed)}</>}
            </p>
          </div>

          {/* Stats grid */}
          {summary && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#f5f5f7] p-5 text-center">
                <p className="text-[28px] font-bold text-[#1d1d1f]">
                  {summary.total_products}
                </p>
                <p className="mt-1 text-[11px] font-medium text-[#86868b]">
                  Productos detectados
                </p>
              </div>
              <div className="rounded-2xl bg-[#f5f5f7] p-5 text-center">
                <p className="text-[28px] font-bold text-[#1d1d1f]">
                  {summary.total_facings}
                </p>
                <p className="mt-1 text-[11px] font-medium text-[#86868b]">
                  Facings totales
                </p>
              </div>
              <div className="rounded-2xl bg-[#ff3b30]/5 p-5 text-center">
                <p className="text-[28px] font-bold text-[#ff3b30]">
                  {summary.oos_count}
                </p>
                <p className="mt-1 text-[11px] font-medium text-[#86868b]">
                  Roturas de stock
                </p>
              </div>
              <div className="rounded-2xl bg-[#f5f5f7] p-5 text-center">
                <p className="text-[28px] font-bold text-[#1d1d1f]">
                  {summary.avg_confidence != null
                    ? `${Math.round(summary.avg_confidence * 100)}%`
                    : "—"}
                </p>
                <p className="mt-1 text-[11px] font-medium text-[#86868b]">
                  Confianza IA
                </p>
              </div>
            </div>
          )}

          {/* Photos breakdown */}
          {summary && (
            <div className="rounded-2xl bg-[#f5f5f7] p-5">
              <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                Fotos capturadas
              </p>
              <div className="space-y-2.5">
                {CATEGORIES.map((cat) => (
                  <div
                    key={cat.key}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-[16px]">{cat.icon}</span>
                      <span className="text-[13px] text-[#1d1d1f]">
                        {cat.label}
                      </span>
                    </div>
                    <span className="text-[13px] font-semibold text-[#1d1d1f]">
                      {summary.photos_count[cat.key] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Duration */}
          {visit?.duration_minutes != null && (
            <div className="rounded-2xl bg-[#f5f5f7] p-5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#86868b]">
                  Duración total
                </span>
                <span className="text-[15px] font-semibold text-[#1d1d1f]">
                  {visit.duration_minutes} min
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2">
            <button
              onClick={() => router.push("/calendar")}
              className="w-full rounded-full bg-[#1d1d1f] px-8 py-4 text-[15px] font-medium text-white transition-all duration-300 hover:bg-[#000] hover:shadow-lg active:scale-[0.98]"
            >
              Volver al calendario
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
