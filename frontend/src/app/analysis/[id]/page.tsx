"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getAnalysis } from "@/lib/api";
import type { Analysis } from "@/types";
import Spinner from "@/components/Spinner";
import KpiCard from "@/components/KpiCard";

export default function AnalysisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAnalysis(id)
      .then(setAnalysis)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

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
        <Link
          href="/analysis"
          className="inline-flex shrink-0 rounded-full bg-[#1d1d1f] px-6 py-2.5 text-[13px] font-medium text-white transition-all duration-300 hover:bg-[#000] hover:shadow-lg active:scale-[0.98]"
        >
          Nuevo análisis
        </Link>
      </div>

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
                    {p.product_name}
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
