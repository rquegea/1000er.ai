"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { listStores, createStore, updateStore, deleteStore, getMe } from "@/lib/api";
import type { Store, StoreCreatePayload, StoreUpdatePayload } from "@/types";
import Spinner from "@/components/Spinner";
import CreatableSelect from "@/components/CreatableSelect";

const LocationPicker = dynamic(() => import("@/components/LocationPicker"), {
  ssr: false,
});
const StoresMapView = dynamic(() => import("@/components/StoresMapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[500px] items-center justify-center rounded-2xl bg-[#fafafa]">
      <p className="text-[13px] text-[#86868b]">Cargando mapa...</p>
    </div>
  ),
});

type ModalMode = "create" | "edit" | null;

const EMPTY_FORM = {
  name: "",
  address: "",
  chain: "",
  region: "",
  area: "",
  contact_name: "",
  phone_section_manager: "",
  email_section_manager: "",
  phone_sector_manager: "",
  email_sector_manager: "",
  latitude: null as number | null,
  longitude: null as number | null,
};

export default function SettingsStoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Unique options derived from existing stores
  const chainOptions = useMemo(
    () => [...new Set(stores.map((s) => s.chain).filter(Boolean))] as string[],
    [stores]
  );
  const regionOptions = useMemo(
    () => [...new Set(stores.map((s) => s.region).filter(Boolean))] as string[],
    [stores]
  );
  const areaOptions = useMemo(
    () => [...new Set(stores.map((s) => s.area).filter(Boolean))] as string[],
    [stores]
  );

  // View mode
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  // Delete
  const [deletingStore, setDeletingStore] = useState<Store | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [storesRes, me] = await Promise.all([listStores(), getMe()]);
      setStores(storesRes.data);
      setIsAdmin(me.role === "admin");
    } catch {
      setError("Error al cargar tiendas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const set = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const openCreate = () => {
    setFormData({ ...EMPTY_FORM });
    setFormError(null);
    setEditingStore(null);
    setModalMode("create");
  };

  const openEdit = (store: Store) => {
    setFormData({
      name: store.name,
      address: store.address || "",
      chain: store.chain || "",
      region: store.region || "",
      area: store.area || "",
      contact_name: store.contact_name || "",
      phone_section_manager: store.phone_section_manager || "",
      email_section_manager: store.email_section_manager || "",
      phone_sector_manager: store.phone_sector_manager || "",
      email_sector_manager: store.email_sector_manager || "",
      latitude: store.latitude,
      longitude: store.longitude,
    });
    setFormError(null);
    setEditingStore(store);
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingStore(null);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      if (modalMode === "create") {
        const payload: StoreCreatePayload = {
          name: formData.name,
          address: formData.address || undefined,
          chain: formData.chain || undefined,
          region: formData.region || undefined,
          area: formData.area || undefined,
          contact_name: formData.contact_name || undefined,
          phone_section_manager: formData.phone_section_manager || undefined,
          email_section_manager: formData.email_section_manager || undefined,
          phone_sector_manager: formData.phone_sector_manager || undefined,
          email_sector_manager: formData.email_sector_manager || undefined,
          latitude: formData.latitude ?? undefined,
          longitude: formData.longitude ?? undefined,
        };
        await createStore(payload);
      } else if (modalMode === "edit" && editingStore) {
        const payload: StoreUpdatePayload = {};
        if (formData.name !== editingStore.name) payload.name = formData.name;
        if (formData.address !== (editingStore.address || "")) payload.address = formData.address;
        if (formData.chain !== (editingStore.chain || "")) payload.chain = formData.chain;
        if (formData.region !== (editingStore.region || "")) payload.region = formData.region;
        if (formData.area !== (editingStore.area || "")) payload.area = formData.area;
        if (formData.contact_name !== (editingStore.contact_name || ""))
          payload.contact_name = formData.contact_name;
        if (formData.phone_section_manager !== (editingStore.phone_section_manager || ""))
          payload.phone_section_manager = formData.phone_section_manager;
        if (formData.email_section_manager !== (editingStore.email_section_manager || ""))
          payload.email_section_manager = formData.email_section_manager;
        if (formData.phone_sector_manager !== (editingStore.phone_sector_manager || ""))
          payload.phone_sector_manager = formData.phone_sector_manager;
        if (formData.email_sector_manager !== (editingStore.email_sector_manager || ""))
          payload.email_sector_manager = formData.email_sector_manager;
        if (formData.latitude !== editingStore.latitude) payload.latitude = formData.latitude;
        if (formData.longitude !== editingStore.longitude) payload.longitude = formData.longitude;
        await updateStore(editingStore.id, payload);
      }
      closeModal();
      await fetchData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingStore) return;
    setDeleteLoading(true);
    try {
      await deleteStore(deletingStore.id);
      setDeletingStore(null);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-48px)] items-center justify-center pt-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 pt-24 pb-20">
      <div className="animate-fade-in flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#1d1d1f]">
            Tiendas
          </h1>
          <p className="mt-1 text-[15px] text-[#86868b]">
            {stores.length} {stores.length === 1 ? "tienda" : "tiendas"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded-full border border-[#e5e5ea]">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`px-4 py-2 text-[13px] font-medium transition-colors ${
                viewMode === "list"
                  ? "bg-[#1d1d1f] text-white"
                  : "text-[#86868b] hover:text-[#1d1d1f]"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="inline-block mr-1.5 -mt-0.5">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Lista
            </button>
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`px-4 py-2 text-[13px] font-medium transition-colors ${
                viewMode === "map"
                  ? "bg-[#1d1d1f] text-white"
                  : "text-[#86868b] hover:text-[#1d1d1f]"
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="inline-block mr-1.5 -mt-0.5">
                <path d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5c0-2.5-2-4.5-4.5-4.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              Mapa
            </button>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={openCreate}
              className="rounded-full bg-[#1d1d1f] px-5 py-2.5 text-[13px] font-medium text-white transition-all duration-300 hover:bg-[#000000] hover:shadow-lg active:scale-[0.98]"
            >
              Nueva tienda
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-4 text-[13px] text-[#ff3b30]">{error}</p>
      )}

      {/* Stores list or map */}
      {viewMode === "list" ? (
        <div className="mt-8 overflow-hidden rounded-2xl border border-[#e5e5ea]">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#e5e5ea] bg-[#f5f5f7]">
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                  Nombre
                </th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                  Cadena
                </th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                  Dirección
                </th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                  Región
                </th>
                {isAdmin && (
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {stores.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-[#f5f5f7] last:border-0 transition-colors hover:bg-[#fafafa]"
                >
                  <td className="px-5 py-3.5 text-[13px] font-medium text-[#1d1d1f]">
                    {s.name}
                  </td>
                  <td className="px-5 py-3.5 text-[13px] text-[#86868b]">
                    {s.chain || "—"}
                  </td>
                  <td className="px-5 py-3.5 text-[13px] text-[#86868b]">
                    {s.address || "—"}
                  </td>
                  <td className="px-5 py-3.5 text-[13px] text-[#86868b]">
                    {[s.region, s.area].filter(Boolean).join(" / ") || "—"}
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="text-[13px] text-[#0066cc] transition-colors hover:text-[#004499]"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingStore(s)}
                          className="text-[13px] text-[#ff3b30] transition-colors hover:text-[#cc0000]"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {stores.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin ? 5 : 4}
                    className="px-5 py-10 text-center text-[13px] text-[#86868b]"
                  >
                    No hay tiendas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-8">
          <StoresMapView stores={stores} />
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="animate-fade-in w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">
              {modalMode === "create" ? "Nueva tienda" : "Editar tienda"}
            </h2>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => set("name", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#d2d2d7] px-3 py-2.5 text-[14px] outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                  Cadena
                </label>
                <CreatableSelect
                  value={formData.chain}
                  onChange={(v) => set("chain", v)}
                  options={chainOptions}
                  placeholder="Selecciona o crea una cadena"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                  Dirección / Ubicación
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="Escribe una dirección para buscar en el mapa..."
                  className="mt-1 w-full rounded-xl border border-[#d2d2d7] px-3 py-2.5 text-[14px] outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
                />
                <LocationPicker
                  address={formData.address}
                  latitude={formData.latitude}
                  longitude={formData.longitude}
                  onLocationChange={(lat, lng) =>
                    setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                    Región
                  </label>
                  <CreatableSelect
                    value={formData.region}
                    onChange={(v) => set("region", v)}
                    options={regionOptions}
                    placeholder="Selecciona o crea"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                    Área
                  </label>
                  <CreatableSelect
                    value={formData.area}
                    onChange={(v) => set("area", v)}
                    options={areaOptions}
                    placeholder="Selecciona o crea"
                  />
                </div>
              </div>

              <p className="text-[11px] font-medium uppercase tracking-wider text-[#86868b] pt-2">
                Contactos de tienda
              </p>

              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                  Nombre del contacto
                </label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => set("contact_name", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#d2d2d7] px-3 py-2.5 text-[14px] outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                    Tel. jefe sección
                  </label>
                  <input
                    type="tel"
                    value={formData.phone_section_manager}
                    onChange={(e) => set("phone_section_manager", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#d2d2d7] px-3 py-2.5 text-[14px] outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                    Email jefe sección
                  </label>
                  <input
                    type="email"
                    value={formData.email_section_manager}
                    onChange={(e) => set("email_section_manager", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#d2d2d7] px-3 py-2.5 text-[14px] outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                    Tel. jefe sector
                  </label>
                  <input
                    type="tel"
                    value={formData.phone_sector_manager}
                    onChange={(e) => set("phone_sector_manager", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#d2d2d7] px-3 py-2.5 text-[14px] outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                    Email jefe sector
                  </label>
                  <input
                    type="email"
                    value={formData.email_sector_manager}
                    onChange={(e) => set("email_sector_manager", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#d2d2d7] px-3 py-2.5 text-[14px] outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
                  />
                </div>
              </div>

              {formError && (
                <p className="text-[13px] text-[#ff3b30]">{formError}</p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-full px-5 py-2.5 text-[13px] font-medium text-[#86868b] transition-colors hover:text-[#1d1d1f]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="rounded-full bg-[#1d1d1f] px-5 py-2.5 text-[13px] font-medium text-white transition-all duration-300 hover:bg-[#000000] hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
                >
                  {formLoading
                    ? "Guardando..."
                    : modalMode === "create"
                      ? "Crear tienda"
                      : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deletingStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="animate-fade-in w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">
              Eliminar tienda
            </h2>
            <p className="mt-2 text-[14px] text-[#86868b]">
              ¿Estás seguro de que quieres eliminar{" "}
              <span className="font-medium text-[#1d1d1f]">
                {deletingStore.name}
              </span>
              ? Se eliminarán también las visitas y análisis asociados.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingStore(null)}
                className="rounded-full px-5 py-2.5 text-[13px] font-medium text-[#86868b] transition-colors hover:text-[#1d1d1f]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="rounded-full bg-[#ff3b30] px-5 py-2.5 text-[13px] font-medium text-white transition-all duration-300 hover:bg-[#cc0000] active:scale-[0.98] disabled:opacity-50"
              >
                {deleteLoading ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
