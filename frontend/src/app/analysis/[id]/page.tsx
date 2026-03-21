"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAnalysis, exportAnalysisCsv, retryAnalysis } from "@/lib/api";
import type { Analysis } from "@/types";
import Spinner from "@/components/Spinner";
import KpiCard from "@/components/KpiCard";

export default function AnalysisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    getAnalysis(id)
      .then(setAnalysis)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleRetry = async () => {
    setRetrying(true);
    setError(null);
    try {
      const result = await retryAnalysis(id);
      setAnalysis(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al reintentar");
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-[15px] text-[#86868b]">
          {error || "Análisis no encontrado"}
        </p>
        <Link
          href="/analysis"
          className="text-[15px] font-medium text-[#0066cc] hover:text-[#004499]"
        >
          Volver
        </Link>
      </div>
    );
  }

  const summary = analysis.summary;
  const products = analysis.products || [];

  return (
    <div className="mx-auto max-w-5xl px-6 pt-8 pb-20">
      {/* Header */}
      <div className="animate-fade-in flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-[#86868b]">
            Resultado
          </p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">
            Análisis completado
          </h1>
          <p className="mt-1 text-[13px] text-[#86868b]">
            {new Date(analysis.created_at).toLocaleDateString("es-ES", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}{" "}
            &middot; {analysis.id.slice(0, 8)}
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <button
            onClick={() => exportAnalysisCsv(id)}
            className="inline-flex rounded-full border border-[#d2d2d7] px-5 py-2.5 text-[13px] font-medium text-[#1d1d1f] transition-all duration-300 hover:bg-[#f5f5f7] active:scale-[0.98]"
          >
            Exportar CSV
          </button>
          <Link
            href="/analysis"
            className="inline-flex rounded-full bg-[#1d1d1f] px-6 py-2.5 text-[13px] font-medium text-white transition-all duration-300 hover:bg-[#000] hover:shadow-lg active:scale-[0.98]"
          >
            Nuevo análisis
          </Link>
        </div>
      </div>

      {/* Failed state */}
      {analysis.status === "failed" && (
        <div className="mt-8 rounded-2xl border border-[#ff3b30]/20 bg-[#ff3b30]/5 p-6 text-center">
          <p className="text-[15px] font-medium text-[#ff3b30]">
            El análisis ha fallado
          </p>
          <p className="mt-1 text-[13px] text-[#86868b]">
            Puedes reintentar el análisis con la imagen original
          </p>
          {error && (
            <p className="mt-2 text-[13px] text-[#ff3b30]">{error}</p>
          )}
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="mt-4 inline-flex rounded-full bg-[#ff3b30] px-6 py-2.5 text-[13px] font-medium text-white transition-all duration-300 hover:bg-[#e0342b] active:scale-[0.98] disabled:opacity-50"
          >
            {retrying ? "Reintentando..." : "Reintentar análisis"}
          </button>
        </div>
      )}

      {/* Shelf image */}
      {analysis.image_url && (
        <div className="mt-8 overflow-hidden rounded-2xl border border-[#e5e5ea]">
          <img
            src={analysis.image_url}
            alt="Imagen del lineal"
            className="w-full object-contain"
          />
        </div>
      )}

      {/* KPIs */}
      {summary && (
        <div className="mt-12 grid grid-cols-2 gap-x-12 gap-y-8 sm:grid-cols-4">
          <KpiCard label="Productos" value={summary.total_products} />
          <KpiCard label="Facings" value={summary.total_facings} />
          <KpiCard
            label="Fuera de stock"
            value={summary.oos_count}
            accent={summary.oos_count > 0}
          />
          <KpiCard
            label="Confianza"
            value={`${(summary.avg_confidence * 100).toFixed(0)}%`}
          />
        </div>
      )}

      {/* Share of Shelf */}
      {(() => {
        const ownFacings = products.filter((p) => p.is_own === true).reduce((s, p) => s + p.facings, 0);
        const compFacings = products.filter((p) => p.is_own === false).reduce((s, p) => s + p.facings, 0);
        const unkFacings = products.filter((p) => p.is_own === null || p.is_own === undefined).reduce((s, p) => s + p.facings, 0);
        const totalF = ownFacings + compFacings + unkFacings;
        if (totalF === 0 || (ownFacings === 0 && compFacings === 0)) return null;
        const ownPct = totalF > 0 ? Math.round((ownFacings / totalF) * 100) : 0;
        return (
          <div className="mt-8 rounded-2xl bg-[#f5f5f7] p-5">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
              Share of Shelf
            </p>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-3 overflow-hidden rounded-full bg-[#e5e5ea]">
                  <div
                    className="h-full rounded-full bg-[#34c759] transition-all"
                    style={{ width: `${ownPct}%` }}
                  />
                </div>
              </div>
              <span className="text-[20px] font-bold text-[#1d1d1f]">{ownPct}%</span>
            </div>
            <div className="mt-2 flex gap-4 text-[12px] text-[#86868b]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#34c759]" /> Nuestros: {ownFacings}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#86868b]" /> Competencia: {compFacings}
              </span>
              {unkFacings > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#ff9f0a]" /> Sin catalogar: {unkFacings}
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Divider */}
      <div className="mt-12 h-px bg-[#e5e5ea]" />

      {/* Table */}
      <div className="mt-8 animate-fade-in">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] font-medium uppercase tracking-widest text-[#86868b]">
                <th className="pb-3 pr-6 font-medium">Producto</th>
                <th className="pb-3 pr-6 font-medium">Marca</th>
                <th className="pb-3 pr-6 text-right font-medium">Facings</th>
                <th className="pb-3 pr-6 text-right font-medium">Precio</th>
                <th className="hidden pb-3 pr-6 text-center font-medium sm:table-cell">
                  Posición
                </th>
                <th className="pb-3 pr-6 text-center font-medium">Estado</th>
                <th className="pb-3 text-right font-medium">Conf.</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-[#f5f5f7] transition-colors duration-150 hover:bg-[#fafafa]"
                >
                  <td className="py-3.5 pr-6 text-[14px] font-medium text-[#1d1d1f]">
                    <span className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          p.is_own === true
                            ? "bg-[#34c759]"
                            : p.is_own === false
                            ? "bg-[#86868b]"
                            : "bg-[#ff9f0a]"
                        }`}
                        title={
                          p.is_own === true
                            ? "Nuestro"
                            : p.is_own === false
                            ? "Competencia"
                            : "Sin catalogar"
                        }
                      />
                      {p.product_name}
                      {p.catalog_product_id === null && (
                        <button
                          onClick={() => {
                            const params = new URLSearchParams({
                              add: "1",
                              name: p.product_name,
                              brand: p.brand || "",
                            });
                            router.push(`/catalog?${params.toString()}`);
                          }}
                          className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#007aff] transition-colors hover:bg-[#007aff]/10"
                          title="Añadir al catálogo"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M6 2V10M2 6H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      )}
                    </span>
                  </td>
                  <td className="py-3.5 pr-6 text-[14px] text-[#86868b]">
                    {p.brand || "—"}
                  </td>
                  <td className="py-3.5 pr-6 text-right font-mono text-[14px] text-[#1d1d1f]">
                    {p.facings}
                  </td>
                  <td className="py-3.5 pr-6 text-right font-mono text-[14px] text-[#1d1d1f]">
                    {p.price != null ? p.price.toFixed(2) : "—"}
                  </td>
                  <td className="hidden py-3.5 pr-6 text-center font-mono text-[12px] text-[#86868b] sm:table-cell">
                    {p.position_x != null && p.position_y != null
                      ? `${p.position_x.toFixed(2)}, ${p.position_y.toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="py-3.5 pr-6 text-center">
                    {p.is_oos ? (
                      <span className="text-[12px] font-medium text-[#ff3b30]">
                        Sin stock
                      </span>
                    ) : (
                      <span className="text-[12px] text-[#86868b]">
                        OK
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 text-right font-mono text-[12px] text-[#86868b]">
                    {p.confidence != null
                      ? `${(p.confidence * 100).toFixed(0)}%`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {products.length === 0 && (
          <p className="py-16 text-center text-[14px] text-[#86868b]">
            No se detectaron productos
          </p>
        )}
      </div>
    </div>
  );
}
