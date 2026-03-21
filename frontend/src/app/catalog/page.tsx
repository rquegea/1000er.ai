"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  listCatalogProducts,
  createCatalogProduct,
  updateCatalogProduct,
  deleteCatalogProduct,
  getCatalogSuggestions,
  rematchCatalog,
} from "@/lib/api";
import type {
  CatalogProduct,
  CatalogProductCreatePayload,
  CatalogProductUpdatePayload,
  CatalogSuggestion,
} from "@/types";
import Spinner from "@/components/Spinner";

export default function CatalogPage() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterOwn, setFilterOwn] = useState<boolean | undefined>(undefined);

  // Add/Edit modal
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);
  const [formData, setFormData] = useState<CatalogProductCreatePayload>({
    name: "",
    brand: "",
    category: "",
    is_own: false,
    ean: "",
    aliases: [],
  });
  const [saving, setSaving] = useState(false);
  const [aliasInput, setAliasInput] = useState("");

  // Suggestions
  const [suggestions, setSuggestions] = useState<CatalogSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Rematch
  const [rematching, setRematching] = useState(false);
  const [rematchResult, setRematchResult] = useState<{ matched: number; unmatched: number } | null>(null);

  // URL params for auto-open from analysis page
  const searchParams = useSearchParams();
  const autoOpenedRef = useRef(false);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listCatalogProducts({
        q: search || undefined,
        is_own: filterOwn,
        limit: 100,
      });
      setProducts(res.data);
      setTotal(res.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al cargar catálogo");
    } finally {
      setLoading(false);
    }
  }, [search, filterOwn]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Auto-open modal if ?add=1&name=...&brand=... in URL
  useEffect(() => {
    if (autoOpenedRef.current) return;
    if (searchParams.get("add") === "1") {
      autoOpenedRef.current = true;
      const name = searchParams.get("name") || "";
      const brand = searchParams.get("brand") || "";
      openAddForm({ name, brand });
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const data = await getCatalogSuggestions();
      setSuggestions(data);
    } catch {
      // Non-critical, ignore
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const openAddForm = (prefill?: { name: string; brand: string }) => {
    setEditingProduct(null);
    setFormData({
      name: prefill?.name || "",
      brand: prefill?.brand || "",
      category: "",
      is_own: false,
      ean: "",
      aliases: [],
    });
    setAliasInput("");
    setShowForm(true);
    fetchSuggestions();
  };

  const openEditForm = (product: CatalogProduct) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      brand: product.brand || "",
      category: product.category || "",
      is_own: product.is_own,
      ean: product.ean || "",
      aliases: product.aliases,
    });
    setAliasInput("");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.brand) return;
    setSaving(true);
    setError(null);
    try {
      if (editingProduct) {
        const payload: CatalogProductUpdatePayload = { ...formData };
        await updateCatalogProduct(editingProduct.id, payload);
      } else {
        await createCatalogProduct(formData);
      }
      setShowForm(false);
      await fetchProducts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCatalogProduct(id);
      await fetchProducts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  const addAlias = () => {
    const trimmed = aliasInput.trim();
    if (trimmed && !formData.aliases?.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        aliases: [...(prev.aliases || []), trimmed],
      }));
      setAliasInput("");
    }
  };

  const handleRematch = async () => {
    setRematching(true);
    setRematchResult(null);
    setError(null);
    try {
      const result = await rematchCatalog();
      setRematchResult(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al recalcular matching");
    } finally {
      setRematching(false);
    }
  };

  const removeAlias = (alias: string) => {
    setFormData((prev) => ({
      ...prev,
      aliases: (prev.aliases || []).filter((a) => a !== alias),
    }));
  };

  return (
    <div className="mx-auto max-w-5xl px-6 pt-8 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-[#86868b]">
            Gestión
          </p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-[#1d1d1f]">
            Catálogo de productos
          </h1>
          <p className="mt-1 text-[13px] text-[#86868b]">
            {total} productos registrados
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <button
            onClick={handleRematch}
            disabled={rematching}
            className="inline-flex items-center gap-2 rounded-full border border-[#d2d2d7] px-5 py-2.5 text-[13px] font-medium text-[#1d1d1f] transition-all duration-300 hover:bg-[#f5f5f7] active:scale-[0.98] disabled:opacity-50"
          >
            {rematching ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#86868b] border-t-transparent" />
                Recalculando...
              </>
            ) : (
              "Recalcular matching"
            )}
          </button>
          <button
            onClick={() => openAddForm()}
            className="inline-flex shrink-0 rounded-full bg-[#1d1d1f] px-6 py-2.5 text-[13px] font-medium text-white transition-all duration-300 hover:bg-[#000] hover:shadow-lg active:scale-[0.98]"
          >
            Añadir producto
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-xl bg-[#ff3b30]/10 px-4 py-3 text-[13px] text-[#ff3b30]">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">
            Cerrar
          </button>
        </div>
      )}

      {/* Rematch result */}
      {rematchResult && (
        <div className="mt-4 rounded-xl bg-[#34c759]/10 px-4 py-3 text-[13px] text-[#1d1d1f]">
          Matching recalculado: <strong>{rematchResult.matched}</strong> productos vinculados,{" "}
          <strong>{rematchResult.unmatched}</strong> sin coincidencia.
          <button
            onClick={() => setRematchResult(null)}
            className="ml-2 font-medium text-[#34c759] underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto..."
          className="flex-1 rounded-xl border border-[#e5e5ea] bg-white px-4 py-2.5 text-[14px] text-[#1d1d1f] placeholder-[#86868b] outline-none transition-colors focus:border-[#1d1d1f]"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setFilterOwn(undefined)}
            className={`rounded-full px-4 py-2 text-[12px] font-medium transition-colors ${
              filterOwn === undefined
                ? "bg-[#1d1d1f] text-white"
                : "bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#e5e5ea]"
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterOwn(true)}
            className={`rounded-full px-4 py-2 text-[12px] font-medium transition-colors ${
              filterOwn === true
                ? "bg-[#34c759] text-white"
                : "bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#e5e5ea]"
            }`}
          >
            Nuestros
          </button>
          <button
            onClick={() => setFilterOwn(false)}
            className={`rounded-full px-4 py-2 text-[12px] font-medium transition-colors ${
              filterOwn === false
                ? "bg-[#86868b] text-white"
                : "bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#e5e5ea]"
            }`}
          >
            Competencia
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="mt-16 flex justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] font-medium uppercase tracking-widest text-[#86868b]">
                <th className="pb-3 pr-4 font-medium">Producto</th>
                <th className="pb-3 pr-4 font-medium">Marca</th>
                <th className="pb-3 pr-4 font-medium">Categoría</th>
                <th className="pb-3 pr-4 text-center font-medium">Tipo</th>
                <th className="hidden pb-3 pr-4 font-medium sm:table-cell">EAN</th>
                <th className="pb-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-[#f5f5f7] transition-colors duration-150 hover:bg-[#fafafa]"
                >
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          p.is_own ? "bg-[#34c759]" : "bg-[#86868b]"
                        }`}
                      />
                      <span className="text-[14px] font-medium text-[#1d1d1f]">
                        {p.name}
                      </span>
                    </div>
                    {p.aliases.length > 0 && (
                      <p className="ml-4 mt-0.5 text-[11px] text-[#86868b]">
                        {p.aliases.join(", ")}
                      </p>
                    )}
                  </td>
                  <td className="py-3.5 pr-4 text-[14px] text-[#86868b]">
                    {p.brand || "—"}
                  </td>
                  <td className="py-3.5 pr-4 text-[14px] text-[#86868b]">
                    {p.category || "—"}
                  </td>
                  <td className="py-3.5 pr-4 text-center">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        p.is_own
                          ? "bg-[#34c759]/10 text-[#34c759]"
                          : "bg-[#86868b]/10 text-[#86868b]"
                      }`}
                    >
                      {p.is_own ? "Nuestro" : "Competencia"}
                    </span>
                  </td>
                  <td className="hidden py-3.5 pr-4 font-mono text-[12px] text-[#86868b] sm:table-cell">
                    {p.ean || "—"}
                  </td>
                  <td className="py-3.5 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEditForm(p)}
                        className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#007aff] transition-colors hover:bg-[#007aff]/10"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#ff3b30] transition-colors hover:bg-[#ff3b30]/10"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && (
            <p className="py-16 text-center text-[14px] text-[#86868b]">
              No hay productos en el catálogo
            </p>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[18px] font-semibold text-[#1d1d1f]">
              {editingProduct ? "Editar producto" : "Añadir producto"}
            </h2>

            {/* Suggestions from detected products */}
            {!editingProduct && suggestions.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                  Productos detectados sin catalogar
                </p>
                <div className="max-h-36 space-y-1.5 overflow-y-auto">
                  {suggestions.map((s) => (
                    <button
                      key={`${s.product_name}-${s.brand}`}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          name: s.product_name,
                          brand: s.brand,
                        }))
                      }
                      className="flex w-full items-center gap-2 rounded-xl border border-[#e5e5ea] px-3 py-2 text-left transition-colors hover:border-[#007aff] hover:bg-[#007aff]/5"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[#ff9f0a]" />
                      <span className="flex-1 truncate text-[13px] text-[#1d1d1f]">
                        {s.product_name}
                        {s.brand && (
                          <span className="text-[#86868b]"> — {s.brand}</span>
                        )}
                      </span>
                      <span className="shrink-0 rounded-full bg-[#f5f5f7] px-2 py-0.5 text-[10px] font-medium text-[#86868b]">
                        {s.times_detected}x
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!editingProduct && loadingSuggestions && (
              <div className="mt-4 flex justify-center py-3">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#86868b] border-t-transparent" />
              </div>
            )}

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#86868b]">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-[#e5e5ea] px-4 py-2.5 text-[14px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f]"
                  placeholder="Nombre del producto"
                />
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#86868b]">
                  Marca *
                </label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => setFormData((prev) => ({ ...prev, brand: e.target.value }))}
                  className="w-full rounded-xl border border-[#e5e5ea] px-4 py-2.5 text-[14px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f]"
                  placeholder="Marca"
                />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-[12px] font-medium text-[#86868b]">
                    Categoría
                  </label>
                  <input
                    type="text"
                    value={formData.category || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, category: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[#e5e5ea] px-4 py-2.5 text-[14px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f]"
                    placeholder="Ej: Galletas"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-[12px] font-medium text-[#86868b]">
                    EAN
                  </label>
                  <input
                    type="text"
                    value={formData.ean || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, ean: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[#e5e5ea] px-4 py-2.5 text-[14px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f]"
                    placeholder="8400000000000"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#86868b]">
                  Tipo
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, is_own: true }))}
                    className={`flex-1 rounded-xl border py-2.5 text-[13px] font-medium transition-colors ${
                      formData.is_own
                        ? "border-[#34c759] bg-[#34c759]/10 text-[#34c759]"
                        : "border-[#e5e5ea] text-[#86868b] hover:border-[#1d1d1f]"
                    }`}
                  >
                    Nuestro
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, is_own: false }))}
                    className={`flex-1 rounded-xl border py-2.5 text-[13px] font-medium transition-colors ${
                      !formData.is_own
                        ? "border-[#86868b] bg-[#86868b]/10 text-[#86868b]"
                        : "border-[#e5e5ea] text-[#86868b] hover:border-[#1d1d1f]"
                    }`}
                  >
                    Competencia
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#86868b]">
                  Alias (nombres alternativos para matching IA)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aliasInput}
                    onChange={(e) => setAliasInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addAlias();
                      }
                    }}
                    className="flex-1 rounded-xl border border-[#e5e5ea] px-4 py-2.5 text-[14px] text-[#1d1d1f] outline-none focus:border-[#1d1d1f]"
                    placeholder="Ej: Digestive Original"
                  />
                  <button
                    type="button"
                    onClick={addAlias}
                    className="rounded-xl bg-[#f5f5f7] px-4 py-2.5 text-[13px] font-medium text-[#1d1d1f] hover:bg-[#e5e5ea]"
                  >
                    Añadir
                  </button>
                </div>
                {(formData.aliases || []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {formData.aliases!.map((alias) => (
                      <span
                        key={alias}
                        className="inline-flex items-center gap-1 rounded-full bg-[#f5f5f7] px-3 py-1 text-[12px] text-[#1d1d1f]"
                      >
                        {alias}
                        <button
                          type="button"
                          onClick={() => removeAlias(alias)}
                          className="ml-0.5 text-[#86868b] hover:text-[#ff3b30]"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-full border border-[#d2d2d7] px-5 py-2.5 text-[13px] font-medium text-[#1d1d1f] transition-colors hover:bg-[#f5f5f7]"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.name || !formData.brand}
                className="flex-1 rounded-full bg-[#1d1d1f] px-5 py-2.5 text-[13px] font-medium text-white transition-all hover:bg-[#000] disabled:opacity-50"
              >
                {saving ? "Guardando..." : editingProduct ? "Guardar cambios" : "Crear producto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
