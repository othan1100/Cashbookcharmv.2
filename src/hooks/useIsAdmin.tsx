import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isViewer, setIsViewer] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setIsAdmin(false); setIsViewer(false); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "viewer"]);
      if (!cancelled) {
        const roles = (data || []).map((r) => r.role);
        setIsAdmin(roles.includes("admin"));
        setIsViewer(roles.includes("viewer"));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // canAccessAdmin: either full admin or read-only viewer
  return { isAdmin, isViewer, canAccessAdmin: isAdmin || isViewer, loading };
}
