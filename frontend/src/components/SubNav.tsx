"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SubNavTab {
  href: string;
  label: string;
}

interface SubNavProps {
  tabs: SubNavTab[];
}

export default function SubNav({ tabs }: SubNavProps) {
  const pathname = usePathname();

  return (
    <div className="fixed top-12 z-40 w-full border-b border-[#e5e5ea] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-10 max-w-5xl items-center gap-6 px-6">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex h-full items-center text-[13px] transition-colors duration-200 ${
                active
                  ? "font-medium text-[#1d1d1f]"
                  : "text-[#86868b] hover:text-[#1d1d1f]"
              }`}
            >
              {tab.label}
              {active && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[#1d1d1f]" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
