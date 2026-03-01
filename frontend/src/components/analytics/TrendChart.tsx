"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface TrendDataPoint {
  date: string;
  brandShare: number;
  oosRate: number;
}

interface TrendChartProps {
  data: TrendDataPoint[];
  dateRange?: string;
}

export default function TrendChart({ data, dateRange }: TrendChartProps) {
  return (
    <div className="animate-fade-in">
      <div className="flex items-end justify-between">
        <p className="text-[11px] font-medium uppercase tracking-widest text-[#86868b]">
          Tendencias
        </p>
        {dateRange && (
          <p className="text-[12px] text-[#86868b]">{dateRange}</p>
        )}
      </div>
      <div className="mt-4 h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          >
            <CartesianGrid stroke="#f5f5f7" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#86868b" }}
              axisLine={{ stroke: "#e5e5ea" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#86868b" }}
              axisLine={{ stroke: "#e5e5ea" }}
              tickLine={false}
              unit="%"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e5e5ea",
                borderRadius: 12,
                fontSize: 13,
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
              formatter={(value, name) => [
                `${Number(value).toFixed(1)}%`,
                name === "brandShare" ? "Brand Share" : "OOS Rate",
              ]}
            />
            <Legend
              formatter={(value: string) =>
                value === "brandShare" ? "Brand Share" : "OOS Rate"
              }
              wrapperStyle={{ fontSize: 12, color: "#86868b" }}
            />
            <Line
              type="monotone"
              dataKey="brandShare"
              stroke="#0066cc"
              strokeWidth={2}
              dot={{ r: 3, fill: "#0066cc" }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="oosRate"
              stroke="#ff3b30"
              strokeWidth={2}
              dot={{ r: 3, fill: "#ff3b30" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
