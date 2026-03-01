"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listAnalyses } from "@/lib/api";
import type { Analysis } from "@/types";
import Spinner from "@/components/Spinner";

export default function DashboardPage() {
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

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: "bg-green-50 text-green-700",
      processing: "bg-amber-50 text-amber-700",
      pending: "bg-slate-100 text-slate-600",
      failed: "bg-red-50 text-red-700",
    };
    const labels: Record<string, string> = {
      completed: "Completado",
      processing: "Procesando",
      pending: "Pendiente",
      failed: "Fallido",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || styles.pending}`}
      >
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            {total} {total === 1 ? "análisis realizado" : "análisis realizados"}
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
          Nuevo Análisis
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {!loading && analyses.length === 0 && (
        <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-slate-300 py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <svg
              className="h-6 w-6 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
              />
            </svg>
          </div>
          <p className="text-sm text-slate-500">
            Aún no hay análisis.{" "}
            <Link
              href="/uploads"
              className="font-medium text-indigo-600 hover:text-indigo-700"
            >
              Sube tu primera imagen
            </Link>
          </p>
        </div>
      )}

      {!loading && analyses.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-medium uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analyses.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/analysis/${a.id}`}
                      className="font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {new Date(a.created_at).toLocaleString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    <Link href={`/analysis/${a.id}`}>
                      {a.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link href={`/analysis/${a.id}`}>{statusBadge(a.status)}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
