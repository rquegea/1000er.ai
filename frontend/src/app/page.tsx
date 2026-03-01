"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getMe,
  listVisits,
  listAnalyses,
  listStores,
  startVisit,
} from "@/lib/api";
import { User, Visit, Analysis, Store } from "@/types";
import {
  format,
  isToday,
  startOfWeek,
  endOfWeek,
  subDays,
  isWithinInterval,
} from "date-fns";
import { es } from "date-fns/locale";
import Spinner from "@/components/Spinner";

/* ── Helpers ───────────────────────────────────────────────── */

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

const visitStatusConfig: Record<string, { label: string; bg: string; text: string }> = {
  scheduled:   { label: "Pendiente",  bg: "bg-[#f5f5f7]",       text: "text-[#86868b]" },
  in_progress: { label: "En curso",   bg: "bg-[#ff9500]/10",    text: "text-[#ff9500]" },
  completed:   { label: "Completada", bg: "bg-[#34c759]/10",    text: "text-[#34c759]" },
  cancelled:   { label: "Cancelada",  bg: "bg-[#ff3b30]/10",    text: "text-[#ff3b30]" },
  missed:      { label: "No realizada", bg: "bg-[#ff3b30]/10",  text: "text-[#ff3b30]" },
};

/* ── Page ──────────────────────────────────────────────────── */

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [me, visitsRes, analysesRes, storesRes] = await Promise.all([
          getMe(),
          listVisits(200),
          listAnalyses(50),
          listStores(200),
        ]);
        setUser(me);
        setVisits(visitsRes.data);
        setAnalyses(analysesRes.data);
        setStores(storesRes.data);
      } catch {
        // If not authed, redirect to login
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* ── Derived data ─────────────────────────────────── */

  const storeMap = useMemo(
    () => new Map(stores.map((s) => [s.id, s])),
    [stores]
  );

  const todayVisits = useMemo(
    () =>
      visits
        .filter((v) => v.scheduled_at && isToday(new Date(v.scheduled_at)))
        .sort((a, b) => (a.scheduled_at || "").localeCompare(b.scheduled_at || "")),
    [visits]
  );

  const weekInterval = useMemo(() => {
    const now = new Date();
    return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
  }, []);

  const weekVisits = useMemo(
    () =>
      visits.filter(
        (v) =>
          v.scheduled_at &&
          isWithinInterval(new Date(v.scheduled_at), weekInterval)
      ),
    [visits, weekInterval]
  );

  const weekCompleted = weekVisits.filter((v) => v.status === "completed").length;

  const recentAnalysesCount = useMemo(() => {
    const sevenDaysAgo = subDays(new Date(), 7);
    return analyses.filter((a) => new Date(a.created_at) >= sevenDaysAgo).length;
  }, [analyses]);

  const recentAnalyses = analyses.slice(0, 5);

  /* ── Actions ──────────────────────────────────────── */

  const handleStartVisit = async (visitId: string) => {
    setActionLoading(visitId);
    try {
      await startVisit(visitId);
      router.push(`/visits/${visitId}/active`);
    } catch {
      // fallback: reload
      setActionLoading(null);
    }
  };

  /* ── Loading ──────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const displayName =
    user?.first_name || user?.email?.split("@")[0] || "usuario";

  return (
    <div className="mx-auto max-w-5xl px-6 pb-20 pt-8">
      {/* ── Greeting ─────────────────────────────────── */}
      <div className="mb-10">
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1d1d1f]">
          {getGreeting()}, {displayName}
        </h1>
        <p className="mt-1 text-[15px] capitalize text-[#86868b]">
          {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
        </p>
      </div>

      {/* ── Today's Visits ───────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-4 text-[17px] font-semibold text-[#1d1d1f]">
          Visitas de hoy
        </h2>

        {todayVisits.length === 0 ? (
          <div className="rounded-2xl border border-[#d2d2d7] p-8 text-center">
            <p className="text-[15px] text-[#86868b]">
              No tienes visitas programadas para hoy
            </p>
            <Link
              href="/calendar"
              className="mt-4 inline-block rounded-full bg-[#1d1d1f] px-6 py-2.5 text-[13px] font-medium text-white transition-all duration-200 hover:bg-[#333336] active:scale-[0.97]"
            >
              Ir al calendario
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {todayVisits.map((visit) => {
              const store = storeMap.get(visit.store_id);
              const status = visitStatusConfig[visit.status] || visitStatusConfig.scheduled;
              const time = visit.scheduled_at
                ? format(new Date(visit.scheduled_at), "HH:mm")
                : null;

              return (
                <div
                  key={visit.id}
                  className="flex items-center gap-4 rounded-2xl border border-[#d2d2d7] bg-white p-4 transition-colors duration-150 hover:bg-[#fafafa]"
                >
                  {/* Time */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#f5f5f7]">
                    <span className="text-[13px] font-semibold text-[#1d1d1f]">
                      {time || "--:--"}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-[#1d1d1f]">
                      {store?.name || "Tienda"}
                    </p>
                    {store?.address && (
                      <p className="truncate text-[13px] text-[#86868b]">
                        {store.address}
                      </p>
                    )}
                  </div>

                  {/* Status badge */}
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${status.bg} ${status.text}`}
                  >
                    {status.label}
                  </span>

                  {/* Action */}
                  {visit.status === "scheduled" && (
                    <button
                      type="button"
                      disabled={actionLoading === visit.id}
                      onClick={() => handleStartVisit(visit.id)}
                      className="shrink-0 rounded-full bg-[#007aff] px-4 py-2 text-[13px] font-medium text-white transition-all duration-200 hover:bg-[#0066cc] active:scale-[0.97] disabled:opacity-50"
                    >
                      {actionLoading === visit.id ? "..." : "Iniciar"}
                    </button>
                  )}
                  {visit.status === "in_progress" && (
                    <Link
                      href={`/visits/${visit.id}/active`}
                      className="shrink-0 rounded-full bg-[#ff9500] px-4 py-2 text-[13px] font-medium text-white transition-all duration-200 hover:bg-[#e68600] active:scale-[0.97]"
                    >
                      Continuar
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Quick Summary ────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-4 text-[17px] font-semibold text-[#1d1d1f]">
          Resumen rápido
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Week visits */}
          <div className="rounded-2xl border border-[#d2d2d7] bg-white p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
              Visitas esta semana
            </p>
            <p className="mt-2 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">
              {weekVisits.length}
            </p>
            <p className="mt-1 text-[13px] text-[#86868b]">
              {weekCompleted} completadas
            </p>
          </div>

          {/* Recent analyses */}
          <div className="rounded-2xl border border-[#d2d2d7] bg-white p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
              Análisis recientes
            </p>
            <p className="mt-2 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">
              {recentAnalysesCount}
            </p>
            <p className="mt-1 text-[13px] text-[#86868b]">
              últimos 7 días
            </p>
          </div>

          {/* Stores */}
          <div className="rounded-2xl border border-[#d2d2d7] bg-white p-5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
              Tiendas
            </p>
            <p className="mt-2 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">
              {stores.length}
            </p>
            <p className="mt-1 text-[13px] text-[#86868b]">
              total del tenant
            </p>
          </div>
        </div>
      </section>

      {/* ── Recent Activity ──────────────────────────── */}
      {recentAnalyses.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">
              Actividad reciente
            </h2>
            <Link
              href="/analysis/history"
              className="text-[13px] font-medium text-[#007aff] transition-colors hover:text-[#0055cc]"
            >
              Ver todo
            </Link>
          </div>
          <div className="divide-y divide-[#f5f5f7] rounded-2xl border border-[#d2d2d7] bg-white">
            {recentAnalyses.map((analysis) => {
              const store = storeMap.get(
                analysis.summary ? analysis.shelf_upload_id : ""
              );
              const totalProducts = analysis.summary?.total_products ?? 0;
              const oosCount = analysis.summary?.oos_count ?? 0;

              return (
                <Link
                  key={analysis.id}
                  href={`/analysis/${analysis.id}`}
                  className="flex items-center gap-4 p-4 transition-colors duration-150 hover:bg-[#fafafa]"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f5f5f7]">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2 2h12v12H2z" stroke="#86868b" strokeWidth="1.2" rx="2" />
                      <path d="M5 10V7" stroke="#86868b" strokeWidth="1.2" strokeLinecap="round" />
                      <path d="M8 10V5" stroke="#86868b" strokeWidth="1.2" strokeLinecap="round" />
                      <path d="M11 10V8" stroke="#86868b" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium text-[#1d1d1f]">
                      Análisis{store ? ` en ${store.name}` : ` #${analysis.id.slice(0, 8)}`}
                    </p>
                    <p className="text-[12px] text-[#86868b]">
                      {timeAgo(analysis.created_at)}
                      {totalProducts > 0 &&
                        ` — ${totalProducts} productos, ${oosCount} OOS`}
                    </p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-[#c7c7cc]">
                    <path d="M5 2L10 7L5 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
