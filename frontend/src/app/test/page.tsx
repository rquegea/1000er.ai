"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DetectionItem {
  index: number;
  box_normalized: [number, number, number, number]; // [y_min, x_min, y_max, x_max]
  confidence: number;
  area: number;
}

interface ShelfLevelInfo {
  level: number;
  y_center: number;
  count: number;
}

interface YoloResult {
  raw_count: number;
  filtered_count: number;
  deduped_count: number;
  capped_count: number;
  final_count: number;
  detections: DetectionItem[];
  shelf_levels: ShelfLevelInfo[];
  time_ms: number;
}

interface ProductResult {
  product_name: string;
  brand: string | null;
  facings: number;
  price: number | null;
  currency: string | null;
  confidence: number;
  is_oos: boolean;
  position_x: number;
  position_y: number;
}

interface FullResult {
  detections: Array<{ index: number; box_normalized: [number, number, number, number]; label: string }>;
  products: ProductResult[];
  summary: {
    total_products: number;
    total_facings: number;
    oos_count: number;
    avg_confidence: number;
  };
  reasoning: string;
  time_ms: number;
}

// ── Color helpers ─────────────────────────────────────────────────────────────

const PRODUCT_COLORS = [
  "#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#f7dc6f",
  "#bb8fce", "#82e0aa", "#f0b27a", "#85c1e9", "#f1948a",
  "#a3e4d7", "#d2b4de", "#fad7a0", "#a9cce3", "#a9dfbf",
];

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiYoloDetect(
  file: File,
  confidence: number,
  iou: number
): Promise<YoloResult> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("confidence", confidence.toString());
  fd.append("iou_threshold", iou.toString());

  const res = await fetch(`${API_URL}/api/v1/test/yolo-detect`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

async function apiV5Full(file: File): Promise<FullResult> {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`${API_URL}/api/v1/test/v5-full`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-36 text-[13px] text-[#1d1d1f] shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-[#1d1d1f] cursor-pointer disabled:opacity-40"
      />
      <span className="w-12 text-right text-[13px] font-mono text-[#1d1d1f]">
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function StatPill({ label, value, color = "#1d1d1f" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border border-[#d2d2d7] bg-white px-4 py-2">
      <span className="text-[11px] text-[#86868b] uppercase tracking-wide">{label}</span>
      <span className="text-[20px] font-semibold" style={{ color }}>{value}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function VisionTestPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [confidence, setConfidence] = useState(0.25);
  const [iou, setIou] = useState(0.45);

  const [yoloResult, setYoloResult] = useState<YoloResult | null>(null);
  const [fullResult, setFullResult] = useState<FullResult | null>(null);
  const [loadingYolo, setLoadingYolo] = useState(false);
  const [loadingFull, setLoadingFull] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jsonExpanded, setJsonExpanded] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Which result's detections are shown on the image
  const activeDetections: DetectionItem[] = fullResult
    ? fullResult.detections.map((d) => ({
        index: d.index,
        box_normalized: d.box_normalized,
        confidence: 1,
        area: 0,
      }))
    : yoloResult?.detections ?? [];

  const getBoxColor = (idx: number): string => {
    if (fullResult) return PRODUCT_COLORS[idx % PRODUCT_COLORS.length];
    return "#00c800";
  };

  // ── File handling ───────────────────────────────────────────────────────────

  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setYoloResult(null);
    setFullResult(null);
    setError(null);
  }, [imageUrl]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) loadFile(file);
    },
    [loadFile]
  );

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleYoloDetect = async () => {
    if (!imageFile) return;
    setLoadingYolo(true);
    setError(null);
    setFullResult(null);
    try {
      const result = await apiYoloDetect(imageFile, confidence, iou);
      setYoloResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoadingYolo(false);
    }
  };

  const handleFullPipeline = async () => {
    if (!imageFile) return;
    setLoadingFull(true);
    setError(null);
    try {
      const result = await apiV5Full(imageFile);
      setFullResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoadingFull(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-[#d2d2d7] bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-[13px] text-[#007aff] hover:underline"
            >
              <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
                <path d="M6 1L1 6L6 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Dashboard
            </Link>
            <span className="text-[#d2d2d7]">/</span>
            <span className="text-[13px] font-medium text-[#1d1d1f]">Vision V5 Test</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#f5f5f7] px-3 py-1 text-[11px] font-medium text-[#86868b]">
              YOLO + Gemini
            </span>
            <span className="rounded-full bg-[#1d1d1f] px-3 py-1 text-[11px] font-medium text-white">
              Dev Tool
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">

        {/* ── Upload / Image area ────────────────────────────────────────── */}
        <div className="rounded-2xl border border-[#d2d2d7] bg-white overflow-hidden">
          {!imageUrl ? (
            /* Drop zone */
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 cursor-pointer px-8 py-20 transition-colors ${
                isDragging ? "bg-[#f0f7ff] border-[#007aff]" : "hover:bg-[#fafafa]"
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f5f7]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#86868b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-[15px] font-medium text-[#1d1d1f]">Sube una foto de lineal</p>
                <p className="mt-1 text-[13px] text-[#86868b]">Arrastra aquí o haz click · JPG, PNG, WEBP</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }}
              />
            </div>
          ) : (
            /* Image + box overlay */
            <div>
              <div className="relative select-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Shelf"
                  className="block w-full"
                  draggable={false}
                />

                {/* Bounding boxes overlay */}
                {activeDetections.length > 0 && (
                  <div className="absolute inset-0">
                    {activeDetections.map((det, i) => {
                      const [y1, x1, y2, x2] = det.box_normalized;
                      const color = getBoxColor(i);
                      const isHovered = hoveredIdx === i;

                      // Build tooltip text
                      let tooltipText = `#${i + 1} · conf ${det.confidence.toFixed(2)}`;
                      if (fullResult) {
                        const label = fullResult.detections[i]?.label;
                        if (label) tooltipText = label;
                      }

                      return (
                        <div
                          key={i}
                          onMouseEnter={() => setHoveredIdx(i)}
                          onMouseLeave={() => setHoveredIdx(null)}
                          style={{
                            position: "absolute",
                            top: `${y1 / 10}%`,
                            left: `${x1 / 10}%`,
                            width: `${(x2 - x1) / 10}%`,
                            height: `${(y2 - y1) / 10}%`,
                            border: `2px solid ${color}`,
                            backgroundColor: isHovered ? `${color}30` : `${color}18`,
                            cursor: "pointer",
                            zIndex: isHovered ? 10 : 1,
                          }}
                        >
                          <span
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              backgroundColor: color,
                              color: "white",
                              fontSize: "10px",
                              fontWeight: 700,
                              lineHeight: "16px",
                              padding: "0 3px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {i + 1}
                          </span>

                          {/* Tooltip */}
                          {isHovered && (
                            <div
                              style={{
                                position: "absolute",
                                bottom: "calc(100% + 4px)",
                                left: "50%",
                                transform: "translateX(-50%)",
                                backgroundColor: "#1d1d1f",
                                color: "white",
                                fontSize: "11px",
                                fontWeight: 500,
                                padding: "4px 8px",
                                borderRadius: "6px",
                                whiteSpace: "nowrap",
                                pointerEvents: "none",
                                zIndex: 20,
                              }}
                            >
                              {tooltipText}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Re-upload button */}
              <div className="flex items-center justify-between border-t border-[#f2f2f2] px-4 py-2">
                <span className="truncate text-[12px] text-[#86868b]">{imageFile?.name}</span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="ml-4 shrink-0 text-[12px] text-[#007aff] hover:underline"
                >
                  Cambiar imagen
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Controls ──────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-[#d2d2d7] bg-white px-6 py-5 space-y-4">
          <p className="text-[13px] font-semibold text-[#1d1d1f]">Parámetros YOLO</p>

          <SliderRow
            label={`Confidence`}
            value={confidence}
            min={0.1}
            max={0.5}
            step={0.05}
            onChange={setConfidence}
            disabled={loadingYolo || loadingFull}
          />
          <SliderRow
            label={`IoU Threshold`}
            value={iou}
            min={0.2}
            max={0.7}
            step={0.05}
            onChange={setIou}
            disabled={loadingYolo || loadingFull}
          />

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              onClick={handleYoloDetect}
              disabled={!imageFile || loadingYolo || loadingFull}
              className="inline-flex items-center gap-2 rounded-full bg-[#1d1d1f] px-6 py-2 text-[13px] font-medium text-white transition-all hover:bg-[#333336] active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loadingYolo ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Detectando…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M4 10L6 7L8 9L10 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Detectar con YOLO
                </>
              )}
            </button>

            {yoloResult && (
              <button
                onClick={handleFullPipeline}
                disabled={loadingFull || loadingYolo}
                className="inline-flex items-center gap-2 rounded-full border border-[#1d1d1f] px-6 py-2 text-[13px] font-medium text-[#1d1d1f] transition-all hover:bg-[#f5f5f7] active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loadingFull ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#1d1d1f]/30 border-t-[#1d1d1f]" />
                    Clasificando…
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M4.5 7L6.5 9L9.5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Clasificar con Gemini
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* ── Error ─────────────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-xl border border-[#ff3b30]/30 bg-[#fff5f5] px-5 py-3">
            <p className="text-[13px] text-[#ff3b30]">⚠️ {error}</p>
          </div>
        )}

        {/* ── YOLO Stats ────────────────────────────────────────────────────── */}
        {yoloResult && (
          <div className="rounded-2xl border border-[#d2d2d7] bg-white px-6 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-[#1d1d1f]">Detección YOLO</p>
              <span className="text-[12px] text-[#86868b]">{yoloResult.time_ms} ms</span>
            </div>

            {/* Pipeline funnel */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { label: "Raw YOLO", value: yoloResult.raw_count, color: "#86868b" },
                { label: "Filtrados", value: yoloResult.filtered_count, color: "#007aff" },
                { label: "Dedup depth", value: yoloResult.deduped_count, color: "#ff9500" },
                { label: "Capped", value: yoloResult.capped_count, color: "#34c759" },
              ].map((s, i, arr) => (
                <div key={s.label} className="flex items-center gap-2">
                  <StatPill label={s.label} value={s.value} color={s.color} />
                  {i < arr.length - 1 && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6H10M10 6L7 3M10 6L7 9" stroke="#d2d2d7" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              ))}
            </div>

            {/* Shelf levels */}
            {yoloResult.shelf_levels.length > 0 && (
              <div>
                <p className="mb-2 text-[12px] font-medium text-[#86868b] uppercase tracking-wide">
                  Shelf levels ({yoloResult.shelf_levels.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {yoloResult.shelf_levels.map((lvl) => (
                    <div
                      key={lvl.level}
                      className="flex items-center gap-1.5 rounded-full bg-[#f5f5f7] px-3 py-1"
                    >
                      <span className="text-[11px] font-medium text-[#1d1d1f]">
                        Nivel {lvl.level}
                      </span>
                      <span className="text-[11px] text-[#86868b]">
                        {lvl.count} facings · y≈{lvl.y_center}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Full Pipeline Results ──────────────────────────────────────────── */}
        {fullResult && (
          <div className="rounded-2xl border border-[#d2d2d7] bg-white px-6 py-5 space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-[#1d1d1f]">Pipeline Completo (V5)</p>
              <span className="text-[12px] text-[#86868b]">{fullResult.time_ms} ms</span>
            </div>

            {/* Summary KPIs */}
            <div className="flex flex-wrap gap-3">
              <StatPill label="Total Facings" value={fullResult.summary.total_facings} color="#1d1d1f" />
              <StatPill label="Productos" value={fullResult.summary.total_products} color="#007aff" />
              <StatPill label="OOS" value={fullResult.summary.oos_count} color={fullResult.summary.oos_count > 0 ? "#ff3b30" : "#34c759"} />
              <StatPill label="Avg Conf" value={fullResult.summary.avg_confidence.toFixed(2)} color="#34c759" />
            </div>

            {/* Products table */}
            <div>
              <p className="mb-2 text-[12px] font-medium text-[#86868b] uppercase tracking-wide">Productos detectados</p>
              <div className="divide-y divide-[#f2f2f2] rounded-xl border border-[#e8e8ed] overflow-hidden">
                {fullResult.products.length === 0 ? (
                  <p className="px-4 py-6 text-center text-[13px] text-[#86868b]">Sin productos</p>
                ) : (
                  fullResult.products
                    .sort((a, b) => b.facings - a.facings)
                    .map((p, i) => (
                      <div key={i} className="flex items-center gap-3 bg-white px-4 py-3 hover:bg-[#fafafa]">
                        {/* Color dot */}
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: PRODUCT_COLORS[i % PRODUCT_COLORS.length] }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-[#1d1d1f]">
                            {p.product_name}
                          </p>
                          <p className="truncate text-[11px] text-[#86868b]">
                            {p.brand ?? "—"}
                            {p.price != null && (
                              <> · <span className="text-[#1d1d1f]">{p.price} {p.currency ?? ""}</span></>
                            )}
                            {p.is_oos && (
                              <> · <span className="text-[#ff3b30]">OOS</span></>
                            )}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[15px] font-semibold text-[#1d1d1f]">{p.facings}</p>
                          <p className="text-[11px] text-[#86868b]">conf {p.confidence.toFixed(2)}</p>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Reasoning */}
            {fullResult.reasoning && (
              <div>
                <p className="mb-1 text-[12px] font-medium text-[#86868b] uppercase tracking-wide">Reasoning</p>
                <p className="whitespace-pre-wrap text-[12px] text-[#86868b] leading-relaxed">
                  {fullResult.reasoning}
                </p>
              </div>
            )}

            {/* JSON expandible */}
            <div>
              <button
                onClick={() => setJsonExpanded((v) => !v)}
                className="flex items-center gap-1.5 text-[12px] text-[#007aff] hover:underline"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  className={`transition-transform ${jsonExpanded ? "rotate-90" : ""}`}
                >
                  <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {jsonExpanded ? "Ocultar" : "Ver"} JSON completo
              </button>
              {jsonExpanded && (
                <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-[#f5f5f7] p-4 text-[11px] text-[#1d1d1f] font-mono leading-relaxed">
                  {JSON.stringify(fullResult, null, 2)}
                </pre>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
