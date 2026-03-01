"use client";

import { useState } from "react";

interface StoreRow {
  id: string;
  name: string;
  chain: string;
  brandShare: number;
  oosRate: number;
  lastVisit: string;
}

interface StoreRankingTableProps {
  stores: StoreRow[];
}

type SortKey = "name" | "chain" | "brandShare" | "oosRate" | "lastVisit";

export default function StoreRankingTable({ stores }: StoreRankingTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("brandShare");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "name" || key === "chain");
    }
  };

  const sorted = [...stores].sort((a, b) => {
    const valA = a[sortKey];
    const valB = b[sortKey];
    if (typeof valA === "string" && typeof valB === "string") {
      return sortAsc
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    }
    return sortAsc
      ? (valA as number) - (valB as number)
      : (valB as number) - (valA as number);
  });

  const hasIssue = (store: StoreRow) =>
    store.brandShare < 10 || store.oosRate > 5;

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return null;
    return (
      <span className="ml-1 text-[10px]">{sortAsc ? "\u2191" : "\u2193"}</span>
    );
  };

  const thClass =
    "pb-3 pr-6 font-medium cursor-pointer select-none transition-colors duration-150 hover:text-[#1d1d1f]";

  return (
    <div className="animate-fade-in">
      <p className="text-[11px] font-medium uppercase tracking-widest text-[#86868b]">
        Ranking de tiendas
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11px] font-medium uppercase tracking-widest text-[#86868b]">
              <th className={thClass} onClick={() => handleSort("name")}>
                Tienda{sortIcon("name")}
              </th>
              <th
                className={`${thClass} hidden sm:table-cell`}
                onClick={() => handleSort("chain")}
              >
                Cadena{sortIcon("chain")}
              </th>
              <th
                className={`${thClass} text-right`}
                onClick={() => handleSort("brandShare")}
              >
                Brand Share{sortIcon("brandShare")}
              </th>
              <th
                className={`${thClass} text-right`}
                onClick={() => handleSort("oosRate")}
              >
                OOS{sortIcon("oosRate")}
              </th>
              <th
                className={`${thClass} hidden text-right sm:table-cell`}
                onClick={() => handleSort("lastVisit")}
              >
                Ultima Visita{sortIcon("lastVisit")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((store) => (
              <tr
                key={store.id}
                className={`border-t transition-colors duration-150 hover:bg-[#fafafa] ${
                  hasIssue(store)
                    ? "border-[#ff3b30]/10 bg-[#ff3b30]/[0.02]"
                    : "border-[#f5f5f7]"
                }`}
              >
                <td className="py-3.5 pr-6 text-[14px] font-medium text-[#1d1d1f]">
                  {store.name}
                </td>
                <td className="hidden py-3.5 pr-6 text-[14px] text-[#86868b] sm:table-cell">
                  {store.chain}
                </td>
                <td
                  className={`py-3.5 pr-6 text-right font-mono text-[14px] ${
                    store.brandShare < 10
                      ? "font-semibold text-[#ff3b30]"
                      : "text-[#1d1d1f]"
                  }`}
                >
                  {store.brandShare}%
                </td>
                <td
                  className={`py-3.5 pr-6 text-right font-mono text-[14px] ${
                    store.oosRate > 5
                      ? "font-semibold text-[#ff3b30]"
                      : "text-[#1d1d1f]"
                  }`}
                >
                  {store.oosRate}%
                </td>
                <td className="hidden py-3.5 text-right text-[13px] text-[#86868b] sm:table-cell">
                  {new Date(store.lastVisit).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
