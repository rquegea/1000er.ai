"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  Home,
  Camera,
  Calendar,
  ClipboardList,
  BarChart3,
  Store,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const mainNav = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/analysis/analytics", label: "Analizar", icon: Camera },
  { href: "/calendar", label: "Calendario", icon: Calendar },
];

const analysisNav = [
  { href: "/analysis/history", label: "Historial", icon: ClipboardList },
  { href: "/analysis/analytics", label: "Analytics", icon: BarChart3 },
];

const managementNav = [
  { href: "/settings/stores", label: "Tiendas", icon: Store },
  { href: "/settings/team", label: "Equipo", icon: Users },
];

function isActive(
  pathname: string,
  href: string,
  exact?: boolean,
): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-md px-3 py-[6px] text-[14px] transition-colors duration-150 ${
        active
          ? "bg-[#f5f5f7] font-medium text-[#1d1d1f]"
          : "text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
      }`}
    >
      <Icon size={20} strokeWidth={1.8} />
      {label}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-3 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
      {children}
    </span>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { signOut } = useAuth();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="px-4 pb-4 pt-5">
        <Link href="/" className="text-[14px] font-semibold text-[#1d1d1f]">
          1000er.ai
        </Link>
        <p className="mt-0.5 text-[12px] text-[#86868b]">Mi Empresa</p>
      </div>

      {/* Main nav */}
      <nav className="flex flex-col gap-0.5 px-2">
        {mainNav.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={isActive(pathname, item.href, item.exact)}
            onClick={onNavigate}
          />
        ))}
      </nav>

      {/* Separator */}
      <div className="mx-4 my-3 h-px bg-[#e5e5ea]" />

      {/* Analysis section */}
      <div className="flex flex-col gap-0.5 px-2">
        <SectionLabel>Análisis</SectionLabel>
        {analysisNav.map((item) => (
          <NavItem
            key={item.href + "-analysis"}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={isActive(pathname, item.href)}
            onClick={onNavigate}
          />
        ))}
      </div>

      {/* Management section */}
      <div className="flex flex-col gap-0.5 px-2">
        <SectionLabel>Gestión</SectionLabel>
        {managementNav.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={isActive(pathname, item.href)}
            onClick={onNavigate}
          />
        ))}
      </div>

      {/* Separator */}
      <div className="mx-4 my-3 h-px bg-[#e5e5ea]" />

      {/* Bottom section */}
      <div className="mt-auto flex flex-col gap-0.5 px-2 pb-4">
        <NavItem
          href="/settings/account"
          label="Configuración"
          icon={Settings}
          active={isActive(pathname, "/settings/account")}
          onClick={onNavigate}
        />
        <button
          onClick={() => {
            onNavigate?.();
            signOut();
          }}
          className="flex items-center gap-3 rounded-md px-3 py-[6px] text-[14px] text-[#6e6e73] transition-colors duration-150 hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
        >
          <LogOut size={20} strokeWidth={1.8} />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAuthPage =
    pathname.startsWith("/login") || pathname.startsWith("/signup");
  if (isAuthPage) return null;

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-50 rounded-md p-1.5 text-[#1d1d1f] hover:bg-[#f5f5f7] md:hidden"
        aria-label="Abrir menú"
      >
        <Menu size={22} strokeWidth={1.8} />
      </button>

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[240px] overflow-y-auto border-r border-[#e5e5e5] bg-white md:block">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="absolute left-0 top-0 h-full w-[240px] overflow-y-auto border-r border-[#e5e5e5] bg-white shadow-xl"
            style={{ animation: "slideInLeft 200ms ease-out" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-md p-1 text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
              aria-label="Cerrar menú"
            >
              <X size={18} strokeWidth={1.8} />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
