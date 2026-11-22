import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { AuthContext, type AuthContextValue } from "./AuthContext";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRevision, setAuthRevision] = useState(0);

  useEffect(() => {
    let active = true;
    function updateSession(sessionUser: User | null) {
      setUser(sessionUser);
      setIsAdmin(false);
      setError(null);
      setLoading(Boolean(sessionUser));
      setAuthRevision((revision) => revision + 1);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        updateSession(session?.user ?? null);
      }
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        updateSession(null);
        setError("Unable to restore your sign-in session. Please try signing in again.");
      } else {
        updateSession(data.session?.user ?? null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (user) {
      void (async () => {
        try {
          const { data, error: roleError } = await supabase.rpc("is_store_admin");
          if (!active) return;
          setIsAdmin(!roleError && data === true);
          setError(
            roleError
              ? "Unable to verify your account access. Admin features are unavailable."
              : null,
          );
          setLoading(false);
        } catch {
          if (!active) return;
          setIsAdmin(false);
          setError("Unable to verify your account access. Admin features are unavailable.");
          setLoading(false);
        }
      })();
    }

    return () => {
      active = false;
    };
  }, [user, authRevision]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAdmin,
      loading,
      error,
      signOut: async () => {
        const { error: signOutError } = await supabase.auth.signOut();
        return signOutError
          ? "Unable to sign out. Please try again."
          : null;
      },
    }),
    [user, isAdmin, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
