import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Detect password recovery in URL hash/search and redirect to /reset-password immediately
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    const params = new URLSearchParams(hash.replace("#", "?") || search);
    const isRecovery = 
      params.get("type") === "recovery" || 
      hash.includes("type=recovery") || 
      search.includes("type=recovery") ||
      hash.includes("access_token") ||
      search.includes("code=");

    const currentPath = window.location.pathname.toLowerCase();
    const isAlreadyOnNewPassword = currentPath.includes("/new-password");
    const isAlreadyOnResetPassword = currentPath.includes("/reset-password") || currentPath.includes("/reset-your-password");

    if (isRecovery && !isAlreadyOnNewPassword && !isAlreadyOnResetPassword) {
      console.log("Detected password recovery in URL, redirecting to /New-Password");
      window.location.href = `/New-Password${hash || search}`;
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);

      if (event === "PASSWORD_RECOVERY") {
        console.log("PASSWORD_RECOVERY auth event, redirecting to /New-Password");
        const currentHash = window.location.hash || "";
        const currentSearch = window.location.search || "";
        const pathLower = window.location.pathname.toLowerCase();
        if (!pathLower.includes("/new-password") && !pathLower.includes("/reset-password") && !pathLower.includes("/reset-your-password")) {
          window.location.href = `/New-Password${currentHash || currentSearch}`;
        }
      }
    });

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
