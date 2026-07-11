import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useBusinessName() {
  const { user } = useAuth();
  const [name, setName] = useState("My Business");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("business_name, display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.business_name) setName(data.business_name);
      else if (data?.display_name) setName(data.display_name);
    })();
  }, [user]);

  return name;
}
