"use client";

import { useEffect, useState, useMemo } from "react";
import { getAnalyticsSummary } from "@/lib/api";
import type { AnalyticsSummary } from "@/types";
import KpiCard from "@/components/KpiCard";
import TrendChart from "@/components/analytics/TrendChart";
import BrandSharePie from "@/components/analytics/BrandSharePie";
import StoreMap from "@/components/analytics/StoreMap";
import StoreRankingTable from "@/components/analytics/StoreRankingTable";
import Spinner from "@/components/Spinner";

/* ── Tabs ───────────────────────────────────────────────────── */

type FilterTab = "all" | "chain" | "store" | "gpv";

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "chain", label: "Por Cadena" },
  { key: "store", label: "Por Tienda" },
  { key: "gpv", label: "Por GPV Manager" },
];

/* ── Page ───────────────────────────────────────────────────── */

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selectedChain, setSelectedChain] = useState<string>("Todas");
  const [days] = useState(30);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params: { days: number; chain?: string } = { days };
    if (activeTab === "chain" && selectedChain !== "Todas") {
      params.chain = selectedChain;
    }
    getAnalyticsSummary(params)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [days, activeTab, selectedChain]);

  const chains = useMemo(
    () => ["Todas", ...(data?.chains || [])],
    [data?.chains]
  );

  const filteredStores = useMemo(() => {
    if (!data) return [];
    if (activeTab === "chain" && selectedChain !== "Todas") {
      return data.stores.filter((s) => s.chain === selectedChain);
    }
    return data.stores;
  }, [data, activeTab, selectedChain]);

  // Map store data to component props
  const mapStores = useMemo(
    () =>
      filteredStores
        .filter((s) => s.lat != null && s.lng != null)
        .map((s) => ({
          id: s.id,
          name: s.name,
          chain: s.chain || "",
          lat: s.lat!,
          lng: s.lng!,
          brandShare: s.brand_share,
          oosRate: s.oos_rate,
        })),
    [filteredStores]
  );

  const rankingStores = useMemo(
    () =>
      filteredStores.map((s) => ({
        id: s.id,
        name: s.name,
        chain: s.chain || "",
        brandShare: s.brand_share,
        oosRate: s.oos_rate,
        lastVisit: s.last_visit || "",
      })),
    [filteredStores]
  );

  const trendData = useMemo(
    () =>
      (data?.trend || []).map((t) => ({
        date: new Date(t.date).toLocaleDateString("es-ES", {
          day: "2-digit",
          month: "2-digit",
        }),
        brandShare: t.brand_share,
        oosRate: t.oos_rate,
      })),
    [data?.trend]
  );

  // Compute KPIs
  const avgOosRate = useMemo(() => {
    if (!data || data.total_products === 0) return 0;
    return (data.total_oos / data.total_products) * 100;
  }, [data]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <p className="text-[15px] text-[#ff3b30]">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full bg-[#1d1d1f] px-6 py-2.5 text-[13px] font-medium text-white"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const isEmpty = !data || data.total_analyses === 0;

  return (
    <div className="mx-auto max-w-5xl px-6 pt-8 pb-20">
      {/* Header */}
      <div className="animate-fade-in">
        <p className="text-[11px] font-medium uppercase tracking-widest text-[#86868b]">
          Analytics
        </p>
        <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">
          Panel de rendimiento
        </h1>
        <p className="mt-1 text-[13px] text-[#86868b]">
          Últimos {days} días
        </p>
      </div>

      {/* Filter tabs */}
      <div className="mt-8 flex gap-1 rounded-full bg-[#f5f5f7] p-1">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              if (tab.key !== "chain") setSelectedChain("Todas");
            }}
            className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-200 ${
              activeTab === tab.key
                ? "bg-white text-[#1d1d1f] shadow-sm"
                : "text-[#86868b] hover:text-[#1d1d1f]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Chain selector */}
      {activeTab === "chain" && (
        <div className="mt-4 flex gap-2 animate-fade-in">
          {chains.map((chain) => (
            <button
              key={chain}
              onClick={() => setSelectedChain(chain)}
              className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-all duration-150 ${
                selectedChain === chain
                  ? "border-[#0066cc] bg-[#0066cc]/5 text-[#0066cc]"
                  : "border-[#e5e5ea] text-[#86868b] hover:border-[#86868b]"
              }`}
            >
              {chain}
            </button>
          ))}
        </div>
      )}

      {isEmpty ? (
        <div className="mt-16 text-center">
          <p className="text-[15px] text-[#86868b]">
            No hay datos de análisis en los últimos {days} días
          </p>
          <p className="mt-2 text-[13px] text-[#86868b]">
            Sube fotos de lineales para ver estadísticas aquí
          </p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="mt-10 grid grid-cols-2 gap-x-12 gap-y-8 sm:grid-cols-4">
            <KpiCard label="Análisis" value={data!.total_analyses} />
            <KpiCard label="Productos" value={data!.total_products} />
            <KpiCard label="Facings" value={data!.total_facings} />
            <KpiCard
              label="OOS Rate"
              value={`${avgOosRate.toFixed(1)}%`}
              accent={avgOosRate > 5}
            />
          </div>

          <div className="mt-12 h-px bg-[#e5e5ea]" />

          {/* Trend chart + Brand share pie */}
          {trendData.length > 0 && (
            <>
              <div className="mt-12 grid gap-12 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <TrendChart data={trendData} dateRange={`Últimos ${days} días`} />
                </div>
                <div>
                  <BrandSharePie ownShare={0} competitorShare={100} />
                </div>
              </div>
              <div className="mt-12 h-px bg-[#e5e5ea]" />
            </>
          )}

          {/* Map */}
          {mapStores.length > 0 && (
            <>
              <div className="mt-12">
                <StoreMap stores={mapStores} />
              </div>
              <div className="mt-12 h-px bg-[#e5e5ea]" />
            </>
          )}

          {/* Ranking table */}
          {rankingStores.length > 0 && (
            <div className="mt-12">
              <StoreRankingTable stores={rankingStores} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
