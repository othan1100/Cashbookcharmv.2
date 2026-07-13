import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { BookOpen, Loader2, Sparkles, Eye, EyeOff, Sun, Moon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { COUNTRIES } from "@/lib/countries";

type Mode = "signin" | "signup" | "forgot";

export default function Auth({ defaultMode }: { defaultMode?: "signin" | "signup" }) {
  const { user, loading } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>(defaultMode || "signin");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (defaultMode) {
      setMode(defaultMode);
    }
  }, [defaultMode]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [signupCountry, setSignupCountry] = useState("");
  const [signupCity, setSignupCity] = useState("");

  useEffect(() => {
    const titles: Record<Mode, string> = {
      signin: "Sign in — Cashbook Charm",
      signup: "Sign up — Cashbook Charm",
      forgot: "Reset password — Cashbook Charm",
    };
    document.title = titles[mode];
  }, [mode]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background dark:bg-[#06122B]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (user) return <Navigate to="/" replace />;

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || (mode !== "forgot" && password.length < 6)) {
      return toast({ title: "Check your details", description: "Email is required and password must be at least 6 characters.", variant: "destructive" });
    }
    setBusy(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return toast({ title: "Login failed", description: error.message, variant: "destructive" });
      navigate("/");
    } else if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/`, data: { display_name: displayName, business_name: businessName, country: signupCountry, city: signupCity } },
      });
      setBusy(false);
      if (error) return toast({ title: "Sign up failed", description: error.message, variant: "destructive" });
      toast({ title: "Welcome to CashBook!", description: "Your account has been created." });
      navigate("/");
    } else {
      const redirectUrl = window.location.origin.includes("localhost") || window.location.origin.includes("run.app") || window.location.origin.includes("vercel.app")
        ? `${window.location.origin}/reset-password`
        : "https://app.cashbookcharm.online/reset-password";
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      setBusy(false);
      if (error) return toast({ title: "Couldn't send email", description: error.message, variant: "destructive" });
      toast({ title: "Check your inbox", description: "We sent you a password reset link." });
      setMode("signin");
    }
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) toast({ title: "Google sign-in failed", description: error.message, variant: "destructive" });
  };

  const heading = mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password";
  const sub = mode === "signin" ? "Sign in to Cashbook Charm" : mode === "signup" ? "Start tracking your cash in seconds" : "We'll email you a secure link";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 bg-background text-foreground dark:bg-[#06122B] dark:text-white">
      <div className="absolute inset-0 opacity-[0.06] dark:opacity-[0.18]" style={{
        backgroundImage: "linear-gradient(to right, rgba(96,165,250,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(96,165,250,0.22) 1px, transparent 1px)",
        backgroundSize: "44px 44px",
        maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
      }} />
      <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-[#1D4ED8]/40 blur-[120px] hidden dark:block" />
      <div className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-[#3B82F6]/30 blur-[120px] hidden dark:block" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,#06122B_75%)] hidden dark:block" />

      {/* Theme toggle */}
      <button
        onClick={toggle}
        className="absolute top-4 right-4 z-20 rounded-full border border-border bg-muted p-2.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-4 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-[#60A5FA]">
            <Sparkles className="h-3 w-3" /> Cashbook Charm
          </span>
        </div>

        <div className="rounded-3xl border border-border bg-card/95 p-6 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-[#0B1B3D]/80 dark:shadow-[0_20px_60px_-15px_rgba(59,130,246,0.5)] sm:p-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white shadow-lg shadow-[#3B82F6]/40">
              <BookOpen className="h-7 w-7" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-white">{heading}</h1>
            <p className="mt-1 text-sm text-muted-foreground dark:text-white/60">{sub}</p>
          </div>

          {mode !== "forgot" && (
            <>
              <Button type="button" variant="outline" onClick={handleGoogle} className="mt-6 h-11 w-full gap-2 rounded-xl text-base border-border bg-secondary text-foreground hover:bg-secondary/80 hover:text-foreground dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-white">
                <GoogleIcon /> Continue with Google
              </Button>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-border dark:bg-white/10" />
                <span className="text-xs text-muted-foreground/60 dark:text-white/40">or continue with email</span>
                <div className="h-px flex-1 bg-border dark:bg-white/10" />
              </div>
            </>
          )}

          <form onSubmit={handleEmail} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-foreground/80 dark:text-white/80">Display name</Label>
                  <Input id="name" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Enter your full name" className="border-input bg-background text-foreground placeholder:text-muted-foreground/50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="biz" className="text-foreground/80 dark:text-white/80">Business name</Label>
                  <Input id="biz" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Enter your business name" className="border-input bg-background text-foreground placeholder:text-muted-foreground/50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-foreground/80 dark:text-white/80">Country</Label>
                    <Select value={signupCountry} onValueChange={setSignupCountry}>
                      <SelectTrigger className="border-input bg-background text-foreground dark:border-white/10 dark:bg-white/5 dark:text-white"><SelectValue placeholder="Select country" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.name}>
                            <span className="flex items-center gap-2"><span>{c.flag}</span><span>{c.name}</span></span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground/80 dark:text-white/80">City</Label>
                    <Input value={signupCity} onChange={(e) => setSignupCity(e.target.value)} placeholder="Your city" className="border-input bg-background text-foreground placeholder:text-muted-foreground/50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30" />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground/80 dark:text-white/80">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="border-input bg-background text-foreground placeholder:text-muted-foreground/50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30" />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-foreground/80 dark:text-white/80">Password</Label>
                  {mode === "signin" && (
                    <button type="button" onClick={() => navigate("/reset-password")} className="text-xs font-medium text-primary hover:underline dark:text-[#60A5FA]">
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} required minLength={6}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="border-input bg-background text-foreground placeholder:text-muted-foreground/50 pr-10 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30" />
                  <button type="button" onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
            <Button type="submit" className="h-11 w-full rounded-xl text-base bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] hover:from-[#1E40AF] hover:to-[#2563EB] text-white shadow-lg shadow-[#3B82F6]/30 border-0" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin" ? "Sign In" : mode === "signup" ? "Create Account" : "Send reset link"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground dark:text-white/60">
            {mode === "forgot" ? (
              <button onClick={() => { setMode("signin"); navigate("/login"); }} className="font-semibold text-primary hover:underline dark:text-[#60A5FA]">
                ← Back to sign in
              </button>
            ) : (
              <>
                {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
                <button onClick={() => {
                  const newMode = mode === "signin" ? "signup" : "signin";
                  setMode(newMode);
                  navigate(newMode === "signin" ? "/login" : "/register");
                }} className="font-semibold text-primary hover:underline dark:text-[#60A5FA]">
                  {mode === "signin" ? "Sign up" : "Sign in"}
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.3 0-9.7-3.4-11.3-8L6.2 32.8C9.6 39.3 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.2 5.2c-.4.4 6.7-4.9 6.7-14.9 0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  );
}