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

/* ── Mock data (demo) ──────────────────────────────────────── */

function generateMockData(): AnalyticsSummary {
  const today = new Date();
  const trend: AnalyticsSummary["trend"] = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    return {
      date: d.toISOString().slice(0, 10),
      analyses_count: Math.floor(Math.random() * 5) + 2,
      total_facings: Math.floor(Math.random() * 80) + 120,
      oos_rate: +(Math.random() * 6 + 1).toFixed(1),
      brand_share: +(Math.random() * 12 + 28).toFixed(1),
    };
  });

  const stores: AnalyticsSummary["stores"] = [
    { id: "s1", name: "Mercadona Gran Vía", chain: "Mercadona", lat: 40.4200, lng: -3.7025, total_facings: 186, oos_count: 7, oos_rate: 3.8, brand_share: 34.2, last_visit: "2026-03-20", share_of_shelf: { own_facings: 64, competitor_facings: 115, unknown_facings: 7, own_share_pct: 34.2 } },
    { id: "s2", name: "Carrefour Castellana", chain: "Carrefour", lat: 40.4312, lng: -3.6900, total_facings: 210, oos_count: 12, oos_rate: 5.7, brand_share: 28.5, last_visit: "2026-03-19", share_of_shelf: { own_facings: 60, competitor_facings: 140, unknown_facings: 10, own_share_pct: 28.5 } },
    { id: "s3", name: "Dia Atocha", chain: "Dia", lat: 40.4065, lng: -3.6930, total_facings: 145, oos_count: 5, oos_rate: 3.4, brand_share: 38.6, last_visit: "2026-03-21", share_of_shelf: { own_facings: 56, competitor_facings: 82, unknown_facings: 7, own_share_pct: 38.6 } },
    { id: "s4", name: "Mercadona Princesa", chain: "Mercadona", lat: 40.4280, lng: -3.7145, total_facings: 172, oos_count: 9, oos_rate: 5.2, brand_share: 31.0, last_visit: "2026-03-18", share_of_shelf: { own_facings: 53, competitor_facings: 112, unknown_facings: 7, own_share_pct: 31.0 } },
    { id: "s5", name: "Alcampo La Vaguada", chain: "Alcampo", lat: 40.4795, lng: -3.7105, total_facings: 230, oos_count: 15, oos_rate: 6.5, brand_share: 25.2, last_visit: "2026-03-17", share_of_shelf: { own_facings: 58, competitor_facings: 160, unknown_facings: 12, own_share_pct: 25.2 } },
    { id: "s6", name: "Lidl Fuencarral", chain: "Lidl", lat: 40.4450, lng: -3.7020, total_facings: 120, oos_count: 3, oos_rate: 2.5, brand_share: 41.7, last_visit: "2026-03-21", share_of_shelf: { own_facings: 50, competitor_facings: 65, unknown_facings: 5, own_share_pct: 41.7 } },
    { id: "s7", name: "Carrefour Express Sol", chain: "Carrefour", lat: 40.4168, lng: -3.7038, total_facings: 98, oos_count: 8, oos_rate: 8.2, brand_share: 22.4, last_visit: "2026-03-16", share_of_shelf: { own_facings: 22, competitor_facings: 70, unknown_facings: 6, own_share_pct: 22.4 } },
    { id: "s8", name: "Eroski Salamanca", chain: "Eroski", lat: 40.4255, lng: -3.6790, total_facings: 155, oos_count: 6, oos_rate: 3.9, brand_share: 36.1, last_visit: "2026-03-20", share_of_shelf: { own_facings: 56, competitor_facings: 92, unknown_facings: 7, own_share_pct: 36.1 } },
  ];

  const totalFacings = stores.reduce((s, st) => s + st.total_facings, 0);
  const totalOos = stores.reduce((s, st) => s + st.oos_count, 0);

  return {
    total_analyses: 87,
    total_products: 342,
    total_facings: totalFacings,
    total_oos: totalOos,
    avg_confidence: 0.82,
    stores,
    trend,
    chains: ["Mercadona", "Carrefour", "Dia", "Alcampo", "Lidl", "Eroski"],
    share_of_shelf: { own_facings: 419, competitor_facings: 836, unknown_facings: 61, own_share_pct: 31.8 },
  };
}

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
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    if (demoMode) {
      setData(generateMockData());
      setLoading(false);
      setError(null);
      return;
    }
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
  }, [days, activeTab, selectedChain, demoMode]);

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
      <div className="animate-fade-in flex items-start justify-between">
        <div>
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
        <button
          onClick={() => setDemoMode((v) => !v)}
          className={`mt-1 flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all duration-200 ${
            demoMode
              ? "border-[#0066cc] bg-[#0066cc]/5 text-[#0066cc]"
              : "border-[#e5e5ea] text-[#86868b] hover:border-[#86868b]"
          }`}
        >
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              demoMode ? "bg-[#0066cc]" : "bg-[#e5e5ea]"
            }`}
          />
          {demoMode ? "Demo activo" : "Ver demo"}
        </button>
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
                  <BrandSharePie
                  ownShare={data?.share_of_shelf?.own_share_pct ?? 0}
                  competitorShare={100 - (data?.share_of_shelf?.own_share_pct ?? 0)}
                />
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
