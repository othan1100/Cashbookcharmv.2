import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LANGUAGES, T, type Lang, type TKey } from "@/i18n/translations";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => Promise<void>;
  t: (k: TKey) => string;
  dir: "ltr" | "rtl";
};

const I18nContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "cashbook.lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    return saved && ["en", "ar", "so"].includes(saved) ? saved : "en";
  });

  // Load from profile when user logs in
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("language").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        const dbLang = (data as { language?: Lang } | null)?.language;
        if (dbLang && ["en", "ar", "so"].includes(dbLang)) {
          setLangState(dbLang);
          localStorage.setItem(STORAGE_KEY, dbLang);
        }
      });
  }, [user]);

  // Apply dir + lang to <html>
  useEffect(() => {
    const dir = LANGUAGES.find((l) => l.code === lang)?.dir ?? "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang]);

  const setLang = useCallback(async (l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
    if (user) {
      await supabase.from("profiles").update({ language: l }).eq("user_id", user.id);
    }
  }, [user]);

  const t = useCallback((k: TKey) => T[lang][k] ?? T.en[k] ?? k, [lang]);
  const dir = LANGUAGES.find((l) => l.code === lang)?.dir ?? "ltr";

  const value = useMemo(() => ({ lang, setLang, t, dir }), [lang, setLang, t, dir]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
