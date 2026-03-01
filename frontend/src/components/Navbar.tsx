"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const links = [
  { href: "/uploads", label: "Analizar" },
  { href: "/dashboard", label: "Historial" },
  { href: "/calendar", label: "Calendario" },
  { href: "/analytics", label: "Analytics" },
  { href: "/stores", label: "Tiendas" },
  { href: "/users", label: "Equipo" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { session, signOut } = useAuth();

  // Don't show navbar on login page
  if (pathname.startsWith("/login")) return null;

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
          {session && (
            <button
              onClick={signOut}
              className="text-[13px] text-[#86868b] transition-colors duration-200 hover:text-[#ff3b30]"
            >
              Salir
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
