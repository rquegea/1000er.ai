"use client";

import { useEffect, useState } from "react";
import { getMe } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import type { User } from "@/types";
import Spinner from "@/components/Spinner";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  key_account: "Key Account",
  gpv: "GPV",
};

export default function SettingsAccountPage() {
  const { signOut } = useAuth();
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMe()
      .then(setMe)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-6 pt-8 pb-20">
      <div className="animate-fade-in">
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1d1d1f]">
          Cuenta
        </h1>
        <p className="mt-1 text-[15px] text-[#86868b]">
          Información de tu cuenta
        </p>
      </div>

      {me && (
        <div className="animate-fade-in animate-delay-1 mt-8 rounded-2xl border border-[#e5e5ea] bg-white">
          <div className="p-6">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1d1d1f] text-[18px] font-semibold text-white">
                {me.first_name
                  ? me.first_name[0].toUpperCase()
                  : me.email[0].toUpperCase()}
              </div>
              <div>
                <p className="text-[17px] font-semibold text-[#1d1d1f]">
                  {[me.first_name, me.last_name].filter(Boolean).join(" ") || "Sin nombre"}
                </p>
                <p className="text-[13px] text-[#86868b]">{me.email}</p>
              </div>
            </div>

            {/* Info rows */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#f5f5f7] pb-4">
                <span className="text-[13px] text-[#86868b]">Email</span>
                <span className="text-[13px] font-medium text-[#1d1d1f]">{me.email}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#f5f5f7] pb-4">
                <span className="text-[13px] text-[#86868b]">Rol</span>
                <span className="inline-flex rounded-full bg-[#f5f5f7] px-3 py-1 text-[12px] font-medium text-[#1d1d1f]">
                  {ROLE_LABELS[me.role] || me.role}
                </span>
              </div>
              {me.phone && (
                <div className="flex items-center justify-between border-b border-[#f5f5f7] pb-4">
                  <span className="text-[13px] text-[#86868b]">Teléfono</span>
                  <span className="text-[13px] font-medium text-[#1d1d1f]">{me.phone}</span>
                </div>
              )}
              <div className="flex items-center justify-between pb-2">
                <span className="text-[13px] text-[#86868b]">Miembro desde</span>
                <span className="text-[13px] font-medium text-[#1d1d1f]">
                  {new Date(me.created_at).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sign out */}
      <div className="mt-8">
        <button
          onClick={signOut}
          className="w-full rounded-full border border-[#ff3b30] px-6 py-3 text-[14px] font-medium text-[#ff3b30] transition-all duration-200 hover:bg-[#ff3b30] hover:text-white active:scale-[0.98]"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
