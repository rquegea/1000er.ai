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
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="py-20 text-center">
        <p className="text-red-600">{error || "Análisis no encontrado"}</p>
        <Link
          href="/uploads"
          className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Volver
        </Link>
      </div>
    );
  }

  const summary = analysis.summary;
  const products = analysis.products || [];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Resultado del Análisis
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {new Date(analysis.created_at).toLocaleString("es-ES")} — ID:{" "}
            {analysis.id.slice(0, 8)}
          </p>
        </div>
        <Link
          href="/uploads"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          Analizar otra imagen
        </Link>
      </div>

      {/* KPIs */}
      {summary && (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Productos" value={summary.total_products} />
          <KpiCard label="Total Facings" value={summary.total_facings} />
          <KpiCard
            label="Fuera de Stock"
            value={summary.oos_count}
            accent={summary.oos_count > 0}
          />
          <KpiCard
            label="Confianza Promedio"
            value={`${(summary.avg_confidence * 100).toFixed(0)}%`}
          />
        </div>
      )}

      {/* Products table */}
      <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3">Marca</th>
                <th className="px-4 py-3 text-center">Facings</th>
                <th className="px-4 py-3 text-right">Precio</th>
                <th className="px-4 py-3 text-center">Posición</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Confianza</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p, i) => (
                <tr
                  key={p.id}
                  className="transition-colors hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {p.product_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.brand || "—"}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-slate-900">
                    {p.facings}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-900">
                    {p.price != null ? `$${p.price.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-xs text-slate-500">
                    {p.position_x != null && p.position_y != null
                      ? `(${p.position_x.toFixed(2)}, ${p.position_y.toFixed(2)})`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.is_oos ? (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                        Fuera de Stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        En Stock
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">
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
          <div className="py-12 text-center text-sm text-slate-400">
            No se detectaron productos
          </div>
        )}
      </div>
    </div>
  );
}
