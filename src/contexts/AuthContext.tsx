/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";
import { authService } from "@/features/auth/auth-service";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  recoveryMode: boolean;
  signUp: (email: string, password: string, fullName: string, captchaToken: string) => Promise<{ error: Error | null; session: Session | null }>;
  signIn: (email: string, password: string, captchaToken: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  clearRecoveryMode: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const RECOVERY_MODE_KEY = "vapt_password_recovery_mode";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(
    () => sessionStorage.getItem(RECOVERY_MODE_KEY) === "true",
  );

  useEffect(() => {
    // 1. Fetch existing session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        sessionStorage.removeItem(RECOVERY_MODE_KEY);
        setRecoveryMode(false);
      }
      setLoading(false);
    });

    // 2. Listen for future changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (event === "PASSWORD_RECOVERY" && session) {
          sessionStorage.setItem(RECOVERY_MODE_KEY, "true");
          setRecoveryMode(true);
        } else if (!session || event === "SIGNED_OUT") {
          sessionStorage.removeItem(RECOVERY_MODE_KEY);
          setRecoveryMode(false);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string, captchaToken: string) => {
    const { data, error } = await authService.signUp(email, password, fullName, captchaToken);
    return { error: error as Error | null, session: data.session };
  };

  const signIn = async (email: string, password: string, captchaToken: string) => {
    const { error } = await authService.signIn(email, password, captchaToken);
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await authService.signOut();
    clearRecoveryMode();
  };

  const clearRecoveryMode = () => {
    sessionStorage.removeItem(RECOVERY_MODE_KEY);
    setRecoveryMode(false);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, recoveryMode, signUp, signIn, signOut, clearRecoveryMode }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
