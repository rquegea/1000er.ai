"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listAnalyses } from "@/lib/api";
import type { Analysis } from "@/types";
import Spinner from "@/components/Spinner";

export default function HistoryPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAnalyses(50, 0)
      .then((res) => {
        setAnalyses(res.data);
        setTotal(res.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statusLabel = (status: string) => {
    const map: Record<string, { text: string; color: string }> = {
      completed: { text: "Completado", color: "text-[#34c759]" },
      processing: { text: "Procesando", color: "text-[#ff9500]" },
      pending: { text: "Pendiente", color: "text-[#86868b]" },
      failed: { text: "Fallido", color: "text-[#ff3b30]" },
    };
    const s = map[status] || map.pending;
    return (
      <span className={`text-[12px] font-medium ${s.color}`}>{s.text}</span>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-48px)] items-center justify-center pt-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 pt-24 pb-20">
      {/* Header */}
      <div className="animate-fade-in flex items-end justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#1d1d1f]">
            Historial
          </h1>
          <p className="mt-1 text-[13px] text-[#86868b]">
            {total} {total === 1 ? "análisis" : "análisis"}
          </p>
        </div>
        <Link
          href="/analysis/analytics"
          className="inline-flex rounded-full bg-[#1d1d1f] px-6 py-2.5 text-[13px] font-medium text-white transition-all duration-300 hover:bg-[#000] hover:shadow-lg active:scale-[0.98]"
        >
          Nuevo análisis
        </Link>
      </div>

      <div className="mt-10 h-px bg-[#e5e5ea]" />

      {/* Empty state */}
      {analyses.length === 0 && (
        <div className="animate-fade-in py-24 text-center">
          <p className="text-[15px] text-[#86868b]">
            Aún no hay análisis
          </p>
          <Link
            href="/analysis/analytics"
            className="mt-2 inline-block text-[15px] font-medium text-[#0066cc] hover:text-[#004499]"
          >
            Analiza tu primer lineal
          </Link>
        </div>
      )}

      {/* List */}
      {analyses.length > 0 && (
        <div className="animate-fade-in">
          {analyses.map((a) => (
            <Link
              key={a.id}
              href={`/analysis/${a.id}`}
              className="group flex items-center justify-between border-b border-[#f5f5f7] py-4 transition-colors duration-150 hover:bg-[#fafafa] -mx-3 px-3 rounded-lg"
            >
              <div>
                <p className="text-[14px] font-medium text-[#1d1d1f] transition-colors duration-150 group-hover:text-[#0066cc]">
                  {new Date(a.created_at).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  <span className="ml-3 font-normal text-[#86868b]">
                    {new Date(a.created_at).toLocaleTimeString("es-ES", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-[#d2d2d7]">
                  {a.id.slice(0, 8)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {statusLabel(a.status)}
                <svg
                  className="h-4 w-4 text-[#d2d2d7] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[#86868b]"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m8.25 4.5 7.5 7.5-7.5 7.5"
                  />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
