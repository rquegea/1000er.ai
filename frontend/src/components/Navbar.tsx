"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/uploads", label: "Analizar" },
  { href: "/dashboard", label: "Historial" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-black/[0.04] bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="text-[15px] font-semibold tracking-tight text-[#1d1d1f]"
        >
          1000er.ai
        </Link>
        <div className="flex items-center gap-6">
          {links.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-[13px] transition-colors duration-200 ${
                  active
                    ? "font-medium text-[#1d1d1f]"
                    : "text-[#86868b] hover:text-[#1d1d1f]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
