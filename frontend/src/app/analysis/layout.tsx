"use client";

import { usePathname } from "next/navigation";
import SubNav from "@/components/SubNav";

const tabs = [
  { href: "/analysis/analytics", label: "Analytics" },
  { href: "/analysis/history", label: "Historial" },
];

export default function AnalysisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isTabbed =
    pathname === "/analysis/history" || pathname === "/analysis/analytics";

  return (
    <>
      {isTabbed && <SubNav tabs={tabs} />}
      <div className={isTabbed ? "pt-10" : ""}>{children}</div>
    </>
  );
}
