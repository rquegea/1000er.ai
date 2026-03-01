"use client";

import { useState } from "react";
import KpiCard from "@/components/KpiCard";
import TrendChart from "@/components/analytics/TrendChart";
import BrandSharePie from "@/components/analytics/BrandSharePie";
import StoreMap from "@/components/analytics/StoreMap";
import StoreRankingTable from "@/components/analytics/StoreRankingTable";

/* ── Mock data ──────────────────────────────────────────────── */

const mockStores = [
  {
    id: "1",
    name: "Mercadona Sanchinarro",
    chain: "Mercadona",
    lat: 40.4978,
    lng: -3.6606,
    brandShare: 24,
    oosRate: 3,
    lastVisit: "2026-02-27",
  },
  {
    id: "2",
    name: "Carrefour Arturo Soria",
    chain: "Carrefour",
    lat: 40.4521,
    lng: -3.6401,
    brandShare: 18,
    oosRate: 7,
    lastVisit: "2026-02-25",
  },
  {
    id: "3",
    name: "Mercadona Pintor Gris",
    chain: "Mercadona",
    lat: 40.4123,
    lng: -3.7034,
    brandShare: 8,
    oosRate: 12,
    lastVisit: "2026-02-20",
  },
  {
    id: "4",
    name: "Dia Castellana",
    chain: "Dia",
    lat: 40.4312,
    lng: -3.6892,
    brandShare: 22,
    oosRate: 2,
    lastVisit: "2026-02-28",
  },
  {
    id: "5",
    name: "Carrefour Express Goya",
    chain: "Carrefour",
    lat: 40.4247,
    lng: -3.6729,
    brandShare: 15,
    oosRate: 4,
    lastVisit: "2026-02-26",
  },
  {
    id: "6",
    name: "Mercadona Bravo Murillo",
    chain: "Mercadona",
    lat: 40.4456,
    lng: -3.7045,
    brandShare: 28,
    oosRate: 1,
    lastVisit: "2026-02-28",
  },
  {
    id: "7",
    name: "Alcampo La Vaguada",
    chain: "Alcampo",
    lat: 40.4798,
    lng: -3.7105,
    brandShare: 11,
    oosRate: 6,
    lastVisit: "2026-02-22",
  },
];

const mockTrendData = Array.from({ length: 30 }, (_, i) => {
  const d = new Date("2026-02-01");
  d.setDate(d.getDate() + i);
  return {
    date: d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }),
    brandShare: 18 + Math.sin(i / 4) * 4 + Math.random() * 2,
    oosRate: 5 + Math.cos(i / 3) * 3 + Math.random() * 1.5,
  };
});

const chains = ["Todas", ...Array.from(new Set(mockStores.map((s) => s.chain)))];

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
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selectedChain, setSelectedChain] = useState<string>("Todas");

  const filteredStores =
    activeTab === "chain" && selectedChain !== "Todas"
      ? mockStores.filter((s) => s.chain === selectedChain)
      : mockStores;

  const avgBrandShare =
    filteredStores.reduce((acc, s) => acc + s.brandShare, 0) /
    filteredStores.length;
  const avgOosRate =
    filteredStores.reduce((acc, s) => acc + s.oosRate, 0) /
    filteredStores.length;
  const totalVisits = filteredStores.length;
  const activeStores = filteredStores.length;

  return (
    <div className="mx-auto max-w-5xl px-6 pt-24 pb-20">
      {/* Header */}
      <div className="animate-fade-in">
        <p className="text-[11px] font-medium uppercase tracking-widest text-[#86868b]">
          Analytics
        </p>
        <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">
          Panel de rendimiento
        </h1>
        <p className="mt-1 text-[13px] text-[#86868b]">
          Marzo 2026
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

      {/* KPIs */}
      <div className="mt-10 grid grid-cols-2 gap-x-12 gap-y-8 sm:grid-cols-4">
        <KpiCard
          label="Brand Share"
          value={`${avgBrandShare.toFixed(1)}%`}
        />
        <KpiCard
          label="OOS Rate"
          value={`${avgOosRate.toFixed(1)}%`}
          accent={avgOosRate > 5}
        />
        <KpiCard label="Visitas (mes)" value={totalVisits} />
        <KpiCard label="Tiendas activas" value={activeStores} />
      </div>

      <div className="mt-12 h-px bg-[#e5e5ea]" />

      {/* Trend chart + Brand share pie */}
      <div className="mt-12 grid gap-12 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendChart data={mockTrendData} dateRange="Ultimos 30 dias" />
        </div>
        <div>
          <BrandSharePie
            ownShare={avgBrandShare}
            competitorShare={100 - avgBrandShare}
          />
        </div>
      </div>

      <div className="mt-12 h-px bg-[#e5e5ea]" />

      {/* Map */}
      <div className="mt-12">
        <StoreMap stores={filteredStores} />
      </div>

      <div className="mt-12 h-px bg-[#e5e5ea]" />

      {/* Ranking table */}
      <div className="mt-12">
        <StoreRankingTable stores={filteredStores} />
      </div>
    </div>
  );
}
