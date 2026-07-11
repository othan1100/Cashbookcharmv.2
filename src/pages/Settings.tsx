import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Save, Pencil, Trash2, Plus, MessageCircle, Mail, Camera, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SectionCard } from "@/components/SectionCard";
import { BillingTab } from "@/components/BillingTab";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { COUNTRIES } from "@/lib/countries";
import { CURRENCIES } from "@/lib/currencies";
import { useI18n } from "@/hooks/useI18n";
import { LANGUAGES, type Lang } from "@/i18n/translations";
import { usePlan } from "@/hooks/usePlan";

const DEFAULT_CATEGORIES = [
  "Sales", "Services", "Rent", "Utilities", "Salary",
  "Supplies", "Transport", "Food", "Marketing",
  "Construction", "Materials", "Equipment", "Labor",
  "Maintenance", "Other",
];
const HIDDEN_DEFAULTS_KEY = "cashbook.hiddenDefaultCategories";

type CustomCategory = { id: string; name: string; type: "income" | "expense" };

export default function Settings() {
  const { user } = useAuth();
  const { lang, setLang, t } = useI18n();
  const { plan } = usePlan();
  const isPaid = plan === "pro" || plan === "team";
  const [supportEmail, setSupportEmail] = useState<string | null>(null);
  const [supportWa, setSupportWa] = useState<string | null>(null);
  const [supportMsg, setSupportMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("app_settings").select("support_email,support_whatsapp,support_message").eq("id", 1).maybeSingle()
      .then(({ data }) => {
        const d = data as { support_email?: string | null; support_whatsapp?: string | null; support_message?: string | null } | null;
        setSupportEmail(d?.support_email ?? null);
        setSupportWa(d?.support_whatsapp ?? null);
        setSupportMsg(d?.support_message ?? null);
      });
  }, []);

  // Profile
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "profile";

  // Categories (stored locally for now)
  const [customCats, setCustomCats] = useState<CustomCategory[]>(() => {
    try { return JSON.parse(localStorage.getItem("cashbook.customCategories") || "[]"); } catch { return []; }
  });
  const [hiddenDefaults, setHiddenDefaults] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(HIDDEN_DEFAULTS_KEY) || "[]"); } catch { return []; }
  });
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<"income" | "expense">("expense");

  useEffect(() => {
    document.title = "Settings — CashBook";
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (data) {
        const display = data.display_name || "";
        const [first, ...rest] = display.split(" ");
        setFirstName(first || "");
        setLastName(rest.join(" "));
        setBusinessName(data.business_name || "");
        setCountry((data as { country?: string | null }).country || "");
        setCity((data as { city?: string | null }).city || "");
        setAvatarUrl((data as { avatar_url?: string | null }).avatar_url || null);
      }
      setLoading(false);
    })();
  }, [user]);

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) {
      return toast({ title: "File too large", description: "Please choose an image under 5 MB.", variant: "destructive" });
    }
    setUploadingAvatar(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploadingAvatar(false);
      return toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
    }
    const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
    const url = signed?.signedUrl ?? null;
    const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
    setUploadingAvatar(false);
    if (dbErr) return toast({ title: "Save failed", description: dbErr.message, variant: "destructive" });
    setAvatarUrl(url);
    window.dispatchEvent(new CustomEvent("profile:updated", { detail: { avatar_url: url } }));
    toast({ title: "Profile picture updated" });
  };

  const removeAvatar = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("user_id", user.id);
    if (error) return toast({ title: "Remove failed", description: error.message, variant: "destructive" });
    setAvatarUrl(null);
    window.dispatchEvent(new CustomEvent("profile:updated", { detail: { avatar_url: null } }));
    toast({ title: "Profile picture removed" });
  };

  useEffect(() => {
    localStorage.setItem("cashbook.customCategories", JSON.stringify(customCats));
  }, [customCats]);

  useEffect(() => {
    localStorage.setItem(HIDDEN_DEFAULTS_KEY, JSON.stringify(hiddenDefaults));
  }, [hiddenDefaults]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const display_name = [firstName, lastName].filter(Boolean).join(" ");
    const { error } = await supabase.from("profiles").update({ display_name, business_name: businessName, country: country || null, city: city || null }).eq("user_id", user.id);
    setSaving(false);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    window.dispatchEvent(new CustomEvent("profile:updated", { detail: { display_name } }));
    toast({ title: "Profile saved" });
  };

  const saveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ business_name: businessName }).eq("user_id", user.id);
    setSaving(false);
    localStorage.setItem("cashbook.currency", currency);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: "Business details saved" });
  };

  const addCategory = () => {
    if (!newCatName.trim()) return;
    setCustomCats([...customCats, { id: crypto.randomUUID(), name: newCatName.trim(), type: newCatType }]);
    setNewCatName("");
  };
  const deleteCategory = (id: string) => setCustomCats(customCats.filter((c) => c.id !== id));
  const hideDefault = (name: string) => setHiddenDefaults((h) => Array.from(new Set([...h, name])));
  const restoreDefaults = () => setHiddenDefaults([]);
  const deleteAllCategories = () => {
    if (!confirm("Delete ALL categories (including defaults)? You can restore defaults later.")) return;
    setCustomCats([]);
    setHiddenDefaults([...DEFAULT_CATEGORIES]);
  };
  const visibleDefaults = DEFAULT_CATEGORIES.filter((c) => !hiddenDefaults.includes(c));

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("settings")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your profile and preferences</p>
      </header>

      <Tabs value={initialTab} onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })} className="space-y-5">
        <TabsList className="flex w-full flex-wrap gap-1 rounded-xl bg-secondary p-1 h-auto">
          <TabsTrigger value="profile" className="flex-1 min-w-[90px] rounded-lg data-[state=active]:bg-card data-[state=active]:shadow">{t("profile")}</TabsTrigger>
          <TabsTrigger value="business" className="flex-1 min-w-[90px] rounded-lg data-[state=active]:bg-card data-[state=active]:shadow">{t("business")}</TabsTrigger>
          <TabsTrigger value="billing" className="flex-1 min-w-[90px] rounded-lg data-[state=active]:bg-card data-[state=active]:shadow">Billing</TabsTrigger>
          <TabsTrigger value="categories" className="flex-1 min-w-[100px] rounded-lg data-[state=active]:bg-card data-[state=active]:shadow">{t("categories")}</TabsTrigger>
          <TabsTrigger value="language" className="flex-1 min-w-[90px] rounded-lg data-[state=active]:bg-card data-[state=active]:shadow">{t("language")}</TabsTrigger>
          <TabsTrigger value="support" className="flex-1 min-w-[90px] rounded-lg data-[state=active]:bg-card data-[state=active]:shadow">{t("support")}</TabsTrigger>
        </TabsList>

        {/* PROFILE */}
        <TabsContent value="profile">
          <SectionCard>
            <div className="mb-5">
              <h2 className="text-base font-bold">Personal Information</h2>
              <p className="text-sm text-muted-foreground">Update your profile details</p>
            </div>

            {/* Avatar */}
            <div className="mb-6 flex items-center gap-4">
              <Avatar className="h-20 w-20 border border-border/60">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile picture" />}
                <AvatarFallback className="bg-primary/15 text-primary text-xl font-bold">
                  {(firstName[0] || user?.email?.[0] || "?").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadAvatar(file);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                />
                <Button type="button" variant="outline" size="sm" className="gap-2 rounded-xl"
                  onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}>
                  {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {avatarUrl ? "Change picture" : "Upload picture"}
                </Button>
                {avatarUrl && (
                  <Button type="button" variant="ghost" size="sm" className="gap-2 rounded-xl text-destructive hover:bg-destructive/10"
                    onClick={removeAvatar}>
                    <Trash2 className="h-4 w-4" /> Remove
                  </Button>
                )}
                <p className="w-full text-xs text-muted-foreground">
                  <Camera className="mr-1 inline h-3 w-3" /> JPG, PNG or WebP. Max 5&nbsp;MB.
                </p>
              </div>
            </div>

            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Enter your first name" />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Enter your last name" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger><SelectValue placeholder="Select your country" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.name}>{c.flag} {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Enter your city" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ""} disabled placeholder="you@example.com" />
                <p className="text-xs text-muted-foreground">Email is managed by your account.</p>
              </div>
              <Button type="submit" disabled={saving} className="gap-2 rounded-xl">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Profile
              </Button>
            </form>
          </SectionCard>
        </TabsContent>

        {/* BUSINESS */}
        <TabsContent value="business">
          <SectionCard>
            <div className="mb-5">
              <h2 className="text-base font-bold">Business Details</h2>
              <p className="text-sm text-muted-foreground">Your business info appears on statements and reports</p>
            </div>
            <form onSubmit={saveBusiness} className="space-y-5">
              <div className="space-y-2">
                <Label>Business Name</Label>
                <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Enter your business name" />
                <p className="text-xs text-muted-foreground">Business name is used in all PDF statements</p>
              </div>
              <div className="space-y-2">
                <Label>Default Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue placeholder="Select your currency" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} ({c.symbol}) – {c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Used as the default currency for new transactions</p>
              </div>
              <Button type="submit" disabled={saving} className="gap-2 rounded-xl">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Business
              </Button>
            </form>
          </SectionCard>
        </TabsContent>

        {/* BILLING */}
        <TabsContent value="billing">
          <BillingTab />
        </TabsContent>

        {/* CATEGORIES */}
        <TabsContent value="categories">
          <SectionCard>
            <div className="mb-5">
              <h2 className="text-base font-bold">Transaction Categories</h2>
              <p className="text-sm text-muted-foreground">Create, edit and manage custom categories</p>
            </div>

            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Default Categories</p>
              <div className="flex gap-2">
                {hiddenDefaults.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={restoreDefaults} className="h-7 px-2 text-xs">Restore defaults</Button>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={deleteAllCategories} className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10">Delete all</Button>
              </div>
            </div>
            <div className="mb-6 flex flex-wrap gap-2">
              {visibleDefaults.length === 0 ? (
                <p className="text-sm text-muted-foreground">All defaults removed. Click "Restore defaults" to bring them back.</p>
              ) : visibleDefaults.map((c) => (
                <span key={c} className="group inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium">
                  {c}
                  <button onClick={() => hideDefault(c)} className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive" aria-label={`Delete ${c}`}>
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>

            <div className="border-t border-border/60 pt-5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Your Custom Categories</p>
              {customCats.length === 0 ? (
                <p className="mb-4 text-sm text-muted-foreground">No custom categories yet. Add your first one below.</p>
              ) : (
                <ul className="mb-4 space-y-2">
                  {customCats.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${c.type === "income" ? "bg-[hsl(var(--cash-in)/0.15)] text-[hsl(var(--cash-in))]" : "bg-[hsl(var(--cash-out)/0.15)] text-[hsl(var(--cash-out))]"}`}>{c.type}</span>
                        <span className="text-sm font-medium">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => deleteCategory(c.id)} className="rounded-md p-1.5 text-destructive hover:bg-destructive/10" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Category name" className="flex-1 min-w-[180px]" />
                <Select value={newCatType} onValueChange={(v) => setNewCatType(v as "income" | "expense")}>
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" onClick={addCategory} className="gap-1 rounded-xl" aria-label="Add category">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        {/* LANGUAGE */}
        <TabsContent value="language">
          <SectionCard className="p-5 max-w-xl">
            <div className="mb-4">
              <h2 className="text-base font-bold">{t("language")}</h2>
              <p className="text-sm text-muted-foreground">{t("languageDesc")}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code as Lang)}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    lang === l.code
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border/60 bg-card hover:bg-secondary"
                  }`}
                >
                  <div className="text-base font-semibold">{l.nativeLabel}</div>
                  <div className="text-xs text-muted-foreground">{l.label}</div>
                </button>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        {/* SUPPORT */}
        <TabsContent value="support">
          <SectionCard className="p-5 max-w-xl space-y-4">
            <div>
              <h2 className="text-base font-bold">{t("support")}</h2>
              <p className="text-sm text-muted-foreground">{supportMsg || t("supportDesc")}</p>
            </div>

            {supportEmail && (
              <a href={`mailto:${supportEmail}`}
                 className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-4 hover:bg-secondary transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{t("supportEmail")}</div>
                    <div className="text-xs text-muted-foreground truncate">{supportEmail}</div>
                  </div>
                </div>
                <span className="text-xs text-primary font-medium shrink-0">{t("sendEmail")}</span>
              </a>
            )}

            {supportWa && (
              isPaid ? (
                <a href={`https://wa.me/${supportWa.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer"
                   className="flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4 hover:bg-primary/10 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{t("supportWhatsapp")}</div>
                      <div className="text-xs text-muted-foreground">{supportWa}</div>
                    </div>
                  </div>
                  <span className="text-xs text-primary font-medium shrink-0">{t("contactWhatsapp")}</span>
                </a>
              ) : (
                <div className="rounded-xl border border-dashed border-border/60 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{t("supportWhatsapp")}</div>
                      <div className="text-xs text-muted-foreground">Available on Pro & Team plans only.</div>
                    </div>
                  </div>
                  <a href="/pricing" className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">{t("upgrade")} →</a>
                </div>
              )
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
