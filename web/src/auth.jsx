import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./services/supabase.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s ?? null);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const value = {
    session,
    loading,
    user: session?.user ?? null,
    signIn: (email, password) =>
      supabase.auth.signInWithPassword({ email: email.trim(), password }),
    signOut: () => supabase.auth.signOut(),
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
