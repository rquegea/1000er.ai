"use client";

import { Store, User, Visit } from "@/types";
import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";

interface NewVisitFormProps {
  stores: Store[];
  users: User[];
  initialDate: Date;
  visit?: Visit;
  onSubmit: (data: { storeId: string; userId?: string; scheduledAt: string; notes: string }) => void;
  onClose: () => void;
}

export default function NewVisitForm({ stores, users, initialDate, visit, onSubmit, onClose }: NewVisitFormProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const isEdit = !!visit;

  const [storeId, setStoreId] = useState(visit?.store_id || "");
  const [userId, setUserId] = useState(visit?.user_id || "");
  const [date, setDate] = useState(
    visit?.scheduled_at
      ? format(new Date(visit.scheduled_at), "yyyy-MM-dd")
      : format(initialDate, "yyyy-MM-dd")
  );
  const [time, setTime] = useState(
    visit?.scheduled_at
      ? format(new Date(visit.scheduled_at), "HH:mm")
      : "09:00"
  );
  const [notes, setNotes] = useState(visit?.notes || "");
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedStore = stores.find((s) => s.id === storeId);
  const filteredStores = stores.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) return;
    const scheduledAt = `${date}T${time}:00`;
    onSubmit({ storeId, userId: userId || undefined, scheduledAt, notes });
  };

  const userName = (u: User) =>
    [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => e.target === overlayRef.current && onClose()}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-sm"
    >
      <div className="animate-fade-up mx-4 w-full max-w-md rounded-2xl bg-white shadow-2xl shadow-black/10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#f5f5f7] p-6 pb-4">
          <h3 className="text-[17px] font-semibold text-[#1d1d1f]">
            {isEdit ? "Editar visita" : "Nueva visita"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#86868b] transition-colors hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-5">
            {/* Store selector */}
            <div ref={dropdownRef} className="relative">
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                Tienda
              </label>
              <button
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex w-full items-center justify-between rounded-xl border border-[#e5e5ea] bg-white px-4 py-3 text-left text-[14px] transition-colors hover:border-[#86868b] focus:border-[#007aff] focus:outline-none focus:ring-2 focus:ring-[#007aff]/20"
              >
                <span className={selectedStore ? "text-[#1d1d1f]" : "text-[#86868b]"}>
                  {selectedStore?.name || "Seleccionar tienda..."}
                </span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${showDropdown ? "rotate-180" : ""}`}>
                  <path d="M2 4L6 8L10 4" stroke="#86868b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {showDropdown && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-hidden rounded-xl border border-[#e5e5ea] bg-white shadow-lg shadow-black/5">
                  <div className="border-b border-[#f5f5f7] p-2">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar tienda..."
                      className="w-full rounded-lg bg-[#f5f5f7] px-3 py-2 text-[13px] text-[#1d1d1f] placeholder:text-[#86868b] focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-36 overflow-y-auto">
                    {filteredStores.map((store) => (
                      <button
                        key={store.id}
                        type="button"
                        onClick={() => {
                          setStoreId(store.id);
                          setShowDropdown(false);
                          setSearch("");
                        }}
                        className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-[#f5f5f7] ${
                          store.id === storeId ? "bg-[#007aff]/5 text-[#007aff]" : "text-[#1d1d1f]"
                        }`}
                      >
                        {store.name}
                        {store.chain && (
                          <span className="text-[11px] text-[#86868b]">{store.chain}</span>
                        )}
                      </button>
                    ))}
                    {filteredStores.length === 0 && (
                      <p className="px-4 py-3 text-center text-[13px] text-[#86868b]">
                        Sin resultados
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* GPV selector */}
            {users.length > 0 && (
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                  GPV Responsable
                </label>
                <select
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full rounded-xl border border-[#e5e5ea] bg-white px-4 py-3 text-[14px] text-[#1d1d1f] transition-colors hover:border-[#86868b] focus:border-[#007aff] focus:outline-none focus:ring-2 focus:ring-[#007aff]/20"
                >
                  <option value="">Yo mismo</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {userName(u)} — {u.role}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                  Fecha
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-[#e5e5ea] bg-white px-4 py-3 text-[14px] text-[#1d1d1f] transition-colors hover:border-[#86868b] focus:border-[#007aff] focus:outline-none focus:ring-2 focus:ring-[#007aff]/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                  Hora
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-xl border border-[#e5e5ea] bg-white px-4 py-3 text-[14px] text-[#1d1d1f] transition-colors hover:border-[#86868b] focus:border-[#007aff] focus:outline-none focus:ring-2 focus:ring-[#007aff]/20"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                Notas
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas opcionales..."
                rows={3}
                className="w-full resize-none rounded-xl border border-[#e5e5ea] bg-white px-4 py-3 text-[14px] text-[#1d1d1f] placeholder:text-[#86868b] transition-colors hover:border-[#86868b] focus:border-[#007aff] focus:outline-none focus:ring-2 focus:ring-[#007aff]/20"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full bg-[#f5f5f7] px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f] transition-all duration-200 hover:bg-[#e5e5ea] active:scale-[0.98]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!storeId}
              className="flex-1 rounded-full bg-[#1d1d1f] px-4 py-2.5 text-[13px] font-medium text-white transition-all duration-200 hover:bg-[#333336] active:scale-[0.98] disabled:opacity-40"
            >
              {isEdit ? "Guardar cambios" : "Crear visita"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
