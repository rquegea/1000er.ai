"use client";

import type { User, UserRole } from "@/types";
import type { Store } from "@/types";

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

const ROLE_BORDER: Record<UserRole, string> = {
  admin: "border-[#1d1d1f]",
  key_account: "border-[#0066cc]",
  gpv: "border-[#34c759]",
};

function getFullName(u: User): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;
}

function getInitials(u: User): string {
  if (u.first_name && u.last_name) {
    return `${u.first_name[0]}${u.last_name[0]}`.toUpperCase();
  }
  if (u.first_name) return u.first_name[0].toUpperCase();
  return u.email[0].toUpperCase();
}

const AVATAR_COLORS: Record<UserRole, string> = {
  admin: "bg-[#1d1d1f] text-white",
  key_account: "bg-[#0066cc] text-white",
  gpv: "bg-[#34c759] text-white",
};

interface UserNodeProps {
  user: User;
  storeCount?: number;
}

function UserNode({ user, storeCount }: UserNodeProps) {
  return (
    <div
      className={`relative rounded-2xl border-2 ${ROLE_BORDER[user.role]} bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md min-w-[200px] max-w-[240px]`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${AVATAR_COLORS[user.role]}`}
        >
          {getInitials(user)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-[#1d1d1f]">
            {getFullName(user)}
          </p>
          <p className="truncate text-[12px] text-[#86868b]">{user.email}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_STYLES[user.role]}`}
            >
              {ROLE_LABELS[user.role]}
            </span>
            {user.role === "gpv" && storeCount !== undefined && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f5f5f7] px-2 py-0.5 text-[10px] font-medium text-[#86868b]">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="shrink-0"
                >
                  <path
                    d="M2 6L8 2L14 6V13C14 13.55 13.55 14 13 14H3C2.45 14 2 13.55 2 13V6Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {storeCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ConnectorLineProps {
  isLast: boolean;
  isFirst: boolean;
  total: number;
}

function ConnectorTop({ isLast, isFirst, total }: ConnectorLineProps) {
  if (total <= 1) {
    return (
      <div className="flex justify-center">
        <div className="h-6 w-px bg-[#d2d2d7]" />
      </div>
    );
  }

  return (
    <div className="relative h-6">
      {/* Vertical line going up */}
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[#d2d2d7]" />
      {/* Horizontal line connecting siblings */}
      {!isFirst && (
        <div className="absolute right-1/2 top-0 h-px w-1/2 bg-[#d2d2d7]" />
      )}
      {!isLast && (
        <div className="absolute left-1/2 top-0 h-px w-1/2 bg-[#d2d2d7]" />
      )}
    </div>
  );
}

interface OrgChartProps {
  users: User[];
  stores: Store[];
}

export default function OrgChart({ users, stores }: OrgChartProps) {
  const admins = users.filter((u) => u.role === "admin");
  const keyAccounts = users.filter((u) => u.role === "key_account");
  const gpvs = users.filter((u) => u.role === "gpv");

  // Count stores assigned to each GPV
  const storeCountByUser: Record<string, number> = {};
  for (const store of stores) {
    if (store.responsible_user_id) {
      storeCountByUser[store.responsible_user_id] =
        (storeCountByUser[store.responsible_user_id] || 0) + 1;
    }
  }

  const midLevel = [...keyAccounts, ...gpvs.filter(() => keyAccounts.length === 0 ? false : false)];
  const hasMiddle = keyAccounts.length > 0;
  const hasGPV = gpvs.length > 0;

  return (
    <div className="animate-fade-in w-full overflow-x-auto py-6">
      <div className="inline-flex min-w-full flex-col items-center">
        {/* Level 1: Admins */}
        {admins.length > 0 && (
          <div className="flex flex-col items-center">
            <div className="mb-2 rounded-full bg-[#f5f5f7] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
              Dirección
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              {admins.map((user) => (
                <UserNode key={user.id} user={user} />
              ))}
            </div>
          </div>
        )}

        {/* Connector from Admins down */}
        {admins.length > 0 && (hasMiddle || hasGPV) && (
          <div className="flex justify-center py-1">
            <div className="h-8 w-px bg-[#d2d2d7]" />
          </div>
        )}

        {/* Level 2: Key Accounts */}
        {hasMiddle && (
          <div className="flex flex-col items-center">
            <div className="mb-2 rounded-full bg-[#f5f5f7] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
              Key Accounts
            </div>
            {/* Horizontal rail connecting all mid-level nodes */}
            {keyAccounts.length > 1 && (
              <div className="relative w-full">
                <div className="mx-auto flex justify-center gap-4">
                  {keyAccounts.map((user, i) => (
                    <div key={user.id} className="flex flex-col items-center">
                      <ConnectorTop
                        isFirst={i === 0}
                        isLast={i === keyAccounts.length - 1}
                        total={keyAccounts.length}
                      />
                      <UserNode user={user} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {keyAccounts.length === 1 && (
              <div className="flex justify-center">
                <UserNode user={keyAccounts[0]} />
              </div>
            )}
          </div>
        )}

        {/* Connector from Key Accounts to GPV */}
        {hasMiddle && hasGPV && (
          <div className="flex justify-center py-1">
            <div className="h-8 w-px bg-[#d2d2d7]" />
          </div>
        )}

        {/* Connector from Admins directly to GPV when no Key Accounts */}
        {!hasMiddle && admins.length > 0 && hasGPV && null /* already drawn above */}

        {/* Level 3: GPVs */}
        {hasGPV && (
          <div className="flex flex-col items-center">
            <div className="mb-2 rounded-full bg-[#f5f5f7] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#86868b]">
              Promotores (GPV)
            </div>
            {gpvs.length > 1 && (
              <div className="flex justify-center gap-4">
                {gpvs.map((user, i) => (
                  <div key={user.id} className="flex flex-col items-center">
                    <ConnectorTop
                      isFirst={i === 0}
                      isLast={i === gpvs.length - 1}
                      total={gpvs.length}
                    />
                    <UserNode
                      user={user}
                      storeCount={storeCountByUser[user.id] || 0}
                    />
                  </div>
                ))}
              </div>
            )}
            {gpvs.length === 1 && (
              <div className="flex justify-center">
                <UserNode
                  user={gpvs[0]}
                  storeCount={storeCountByUser[gpvs[0].id] || 0}
                />
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {users.length === 0 && (
          <p className="py-10 text-center text-[13px] text-[#86868b]">
            No hay usuarios en el equipo
          </p>
        )}
      </div>
    </div>
  );
}
