"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { listUsers, createUser, updateUser, deleteUser, getMe, listStores, listVisits } from "@/lib/api";
import type { User, UserRole, UserCreatePayload, UserUpdatePayload, Store, Visit } from "@/types";
import Spinner from "@/components/Spinner";
import OrgChart from "@/components/OrgChart";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  key_account: "Key Account",
  gpv: "GPV",
};

const ROLE_STYLES: Record<UserRole, string> = {
  admin: "bg-[#1d1d1f] text-white",
  key_account: "bg-[#0066cc] text-white",
  gpv: "bg-[#34c759] text-white",
};

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${ROLE_STYLES[role] || "bg-[#f5f5f7] text-[#86868b]"}`}
    >
      {ROLE_LABELS[role] || role}
    </span>
  );
}

type ModalMode = "create" | "edit" | null;
type ViewMode = "list" | "orgchart";

export default function SettingsTeamPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    role: "gpv" as UserRole,
    first_name: "",
    last_name: "",
    phone: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Delete confirmation
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, me, storesRes, visitsRes] = await Promise.all([
        listUsers(),
        getMe(),
        listStores(),
        listVisits(),
      ]);
      setUsers(usersRes.data);
      setCurrentUser(me);
      setIsAdmin(me.role === "admin");
      setStores(storesRes.data);
      setVisits(visitsRes.data);
    } catch {
      setError("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Stats for admin
  const stats = useMemo(() => {
    const roleCounts: Record<string, number> = {};
    for (const u of users) {
      roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;
    }

    // Visits completed this week
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
    weekStart.setHours(0, 0, 0, 0);

    const completedThisWeek = visits.filter((v) => {
      if (v.status !== "completed") return false;
      const endedAt = v.ended_at ? new Date(v.ended_at) : null;
      return endedAt && endedAt >= weekStart && endedAt <= now;
    }).length;

    return { total: users.length, roleCounts, completedThisWeek };
  }, [users, visits]);

  const openCreate = () => {
    setFormData({ email: "", password: "", role: "gpv", first_name: "", last_name: "", phone: "" });
    setFormError(null);
    setEditingUser(null);
    setModalMode("create");
  };

  const openEdit = (user: User) => {
    setFormData({
      email: user.email,
      password: "",
      role: user.role,
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      phone: user.phone || "",
    });
    setFormError(null);
    setEditingUser(user);
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingUser(null);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      if (modalMode === "create") {
        const payload: UserCreatePayload = {
          email: formData.email,
          password: formData.password,
          role: formData.role,
          first_name: formData.first_name || undefined,
          last_name: formData.last_name || undefined,
          phone: formData.phone || undefined,
        };
        await createUser(payload);
      } else if (modalMode === "edit" && editingUser) {
        const payload: UserUpdatePayload = {};
        if (formData.email !== editingUser.email) payload.email = formData.email;
        if (formData.role !== editingUser.role) payload.role = formData.role;
        if (formData.first_name !== (editingUser.first_name || ""))
          payload.first_name = formData.first_name;
        if (formData.last_name !== (editingUser.last_name || ""))
          payload.last_name = formData.last_name;
        if (formData.phone !== (editingUser.phone || ""))
          payload.phone = formData.phone;
        await updateUser(editingUser.id, payload);
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
    if (!deletingUser) return;
    setDeleteLoading(true);
    try {
      await deleteUser(deletingUser.id);
      setDeletingUser(null);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 pt-8 pb-20">
      {/* Header */}
      <div className="animate-fade-in flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[#1d1d1f]">
            Equipo
          </h1>
          <p className="mt-1 text-[15px] text-[#86868b]">
            {users.length} {users.length === 1 ? "miembro" : "miembros"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-full border border-[#e5e5ea] bg-[#f5f5f7] p-0.5">
            <button
              onClick={() => setViewMode("list")}
              className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-200 ${
                viewMode === "list"
                  ? "bg-white text-[#1d1d1f] shadow-sm"
                  : "text-[#86868b] hover:text-[#1d1d1f]"
              }`}
            >
              Lista
            </button>
            <button
              onClick={() => setViewMode("orgchart")}
              className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-200 ${
                viewMode === "orgchart"
                  ? "bg-white text-[#1d1d1f] shadow-sm"
                  : "text-[#86868b] hover:text-[#1d1d1f]"
              }`}
            >
              Organigrama
            </button>
          </div>

          {isAdmin && (
            <button
              onClick={openCreate}
              className="rounded-full bg-[#1d1d1f] px-5 py-2.5 text-[13px] font-medium text-white transition-all duration-300 hover:bg-[#000000] hover:shadow-lg active:scale-[0.98]"
            >
              Nuevo usuario
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-4 text-[13px] text-[#ff3b30]">{error}</p>
      )}

      {/* Admin Stats */}
      {isAdmin && (
        <div className="animate-fade-in animate-delay-1 mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
              Total equipo
            </p>
            <p className="mt-1 text-[24px] font-semibold text-[#1d1d1f]">
              {stats.total}
            </p>
          </div>
          <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
              Admins
            </p>
            <p className="mt-1 text-[24px] font-semibold text-[#1d1d1f]">
              {stats.roleCounts["admin"] || 0}
            </p>
          </div>
          <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
              Key Accounts
            </p>
            <p className="mt-1 text-[24px] font-semibold text-[#0066cc]">
              {stats.roleCounts["key_account"] || 0}
            </p>
          </div>
          <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
              GPVs
            </p>
            <p className="mt-1 text-[24px] font-semibold text-[#34c759]">
              {stats.roleCounts["gpv"] || 0}
            </p>
          </div>
        </div>
      )}

      {/* View: List */}
      {viewMode === "list" && (
        <div className="mt-8 overflow-hidden rounded-2xl border border-[#e5e5ea]">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#e5e5ea] bg-[#f5f5f7]">
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                  Nombre
                </th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                  Email
                </th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                  Rol
                </th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                  Teléfono
                </th>
                {isAdmin && (
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-[#f5f5f7] last:border-0 transition-colors hover:bg-[#fafafa]"
                >
                  <td className="px-5 py-3.5 text-[13px] font-medium text-[#1d1d1f]">
                    {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td className="px-5 py-3.5 text-[13px] text-[#86868b]">
                    {u.email}
                  </td>
                  <td className="px-5 py-3.5">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-5 py-3.5 text-[13px] text-[#86868b]">
                    {u.phone || "—"}
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="text-[13px] text-[#0066cc] transition-colors hover:text-[#004499]"
                        >
                          Editar
                        </button>
                        {u.id !== currentUser?.id && (
                          <button
                            type="button"
                            onClick={() => setDeletingUser(u)}
                            className="text-[13px] text-[#ff3b30] transition-colors hover:text-[#cc0000]"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={isAdmin ? 5 : 4}
                    className="px-5 py-10 text-center text-[13px] text-[#86868b]"
                  >
                    No hay usuarios
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* View: Org Chart */}
      {viewMode === "orgchart" && (
        <div className="mt-8 overflow-hidden rounded-2xl border border-[#e5e5ea] bg-[#fafafa]">
          <OrgChart users={users} stores={stores} />
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="animate-fade-in w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">
              {modalMode === "create" ? "Nuevo usuario" : "Editar usuario"}
            </h2>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) =>
                      setFormData({ ...formData, first_name: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-[#d2d2d7] px-3 py-2.5 text-[14px] outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                    Apellido
                  </label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) =>
                      setFormData({ ...formData, last_name: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-[#d2d2d7] px-3 py-2.5 text-[14px] outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-[#d2d2d7] px-3 py-2.5 text-[14px] outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
                />
              </div>

              {modalMode === "create" && (
                <div>
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="mt-1 w-full rounded-xl border border-[#d2d2d7] px-3 py-2.5 text-[14px] outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                  Rol
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value as UserRole })
                  }
                  className="mt-1 w-full rounded-xl border border-[#d2d2d7] px-3 py-2.5 text-[14px] outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
                >
                  <option value="admin">Admin</option>
                  <option value="key_account">Key Account</option>
                  <option value="gpv">GPV</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium uppercase tracking-wider text-[#86868b]">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-[#d2d2d7] px-3 py-2.5 text-[14px] outline-none focus:border-[#0066cc] focus:ring-1 focus:ring-[#0066cc]"
                />
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
                      ? "Crear usuario"
                      : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="animate-fade-in w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">
              Eliminar usuario
            </h2>
            <p className="mt-2 text-[14px] text-[#86868b]">
              ¿Estás seguro de que quieres eliminar a{" "}
              <span className="font-medium text-[#1d1d1f]">
                {deletingUser.email}
              </span>
              ? Esta acción no se puede deshacer.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingUser(null)}
                className="rounded-full px-5 py-2.5 text-[13px] font-medium text-[#86868b] transition-colors hover:text-[#1d1d1f]"
              >
                Cancelar
              </button>
              <button
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
