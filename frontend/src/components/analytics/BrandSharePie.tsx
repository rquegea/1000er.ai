"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface BrandSharePieProps {
  ownShare: number;
  competitorShare: number;
}

const COLORS = ["#0066cc", "#e5e5ea"];

export default function BrandSharePie({
  ownShare,
  competitorShare,
}: BrandSharePieProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const data = [
    { name: "Nuestra marca", value: ownShare },
    { name: "Competidores", value: competitorShare },
  ];

  return (
    <div className="animate-fade-in">
      <p className="text-[11px] font-medium uppercase tracking-widest text-[#86868b]">
        Brand Share
      </p>
      <div className="mt-4 flex items-center gap-6">
        <div className="h-[160px] w-[160px]">
          {!mounted ? (
            <div className="flex h-full items-center justify-center rounded-full bg-[#fafafa]" />
          ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e5ea",
                  borderRadius: 12,
                  fontSize: 13,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
                formatter={(value) => [`${Number(value).toFixed(1)}%`]}
              />
            </PieChart>
          </ResponsiveContainer>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[#0066cc]" />
            <span className="text-[13px] text-[#1d1d1f]">
              Nuestra marca{" "}
              <span className="font-semibold">{ownShare.toFixed(1)}%</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[#e5e5ea]" />
            <span className="text-[13px] text-[#86868b]">
              Competidores{" "}
              <span className="font-medium">
                {competitorShare.toFixed(1)}%
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
