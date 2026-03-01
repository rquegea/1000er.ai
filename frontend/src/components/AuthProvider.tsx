"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session, User } from "@supabase/supabase-js";
import supabase from "@/lib/supabase";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const PUBLIC_PATHS = ["/login", "/signup"];

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Use onAuthStateChange as the single source of truth.
    // It fires INITIAL_SESSION first, then SIGNED_IN / SIGNED_OUT.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setLoading(false);

      // Only redirect on explicit user-initiated sign-out,
      // never on INITIAL_SESSION with null session.
      if (event === "SIGNED_OUT") {
        router.replace("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Redirect to login if initial load resolves with no session
  useEffect(() => {
    if (loading) return;
    if (session) return;
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
    if (!isPublic) {
      router.replace("/login");
    }
  }, [session, loading, pathname, router]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, loading, signOut }}
    >
      {loading && !isPublic ? (
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[1.5px] border-[#e5e5ea] border-t-[#1d1d1f]" />
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}
