import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Loader2, Eye, EyeOff, CheckCircle2, AlertTriangle, ArrowRight, Mail, Sparkles, Sun, Moon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

type ResetMode = "verifying" | "request" | "reset";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [mode, setMode] = useState<ResetMode>("verifying");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [countdown, setCountdown] = useState(3);

  // Parse URL hash/search params
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  const params = new URLSearchParams(hash.replace("#", "?") || search);
  const hasAccessToken = 
    params.has("access_token") || 
    params.has("refresh_token") || 
    params.has("code") ||
    params.get("type") === "recovery" ||
    hash.includes("type=recovery") ||
    search.includes("type=recovery") ||
    hash.includes("access_token") ||
    search.includes("code=");

  useEffect(() => {
    document.title = mode === "reset" ? "Set new password — Cashbook Charm" : "Reset your password — Cashbook Charm";
  }, [mode]);

  useEffect(() => {
    // 1. Check for error parameters in URL (expired/invalid token)
    const errorDescription = params.get("error_description") || params.get("error");
    if (errorDescription) {
      setErrorMsg("Invalid or expired reset link. Please request a new one.");
      setMode("request");
      setReady(true);
      return;
    }

    // 2. If access_token or recovery type is in the URL, go straight to reset mode
    if (hasAccessToken) {
      setMode("reset");
      setReady(true);
      return;
    }

    // 3. Otherwise, check if user is already logged in or handle PASSWORD_RECOVERY event
    let hasSessionOrRecovery = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        hasSessionOrRecovery = true;
        setMode("reset");
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        hasSessionOrRecovery = true;
        setMode("reset");
        setReady(true);
      } else {
        // Add a small timeout to allow onAuthStateChange event to trigger if coming from URL redirect
        setTimeout(() => {
          if (!hasSessionOrRecovery) {
            // No recovery session, show request email mode
            setMode("request");
            setReady(true);
          }
        }, 1200);
      }
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccessToken]);

  // Countdown timer for automatic redirect on password success
  useEffect(() => {
    if (!success) return;
    if (countdown <= 0) {
      navigate("/login");
      return;
    }
    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [success, countdown, navigate]);

  // Handle requesting the password reset email
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg("Email is required.");
      return toast({ title: "Validation Error", description: "Email is required.", variant: "destructive" });
    }

    setBusy(true);
    setErrorMsg("");

    try {
      const redirectUrl = window.location.origin.includes("localhost") || window.location.origin.includes("run.app") || window.location.origin.includes("vercel.app")
        ? `${window.location.origin}/new-password`
        : "https://app.cashbookcharm.online/new-password";

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      setBusy(false);
      if (error) {
        setErrorMsg(error.message);
        return toast({ title: "Couldn't send email", description: error.message, variant: "destructive" });
      }

      setEmailSent(true);
      toast({ 
        title: "Check your inbox", 
        description: "We sent you a password reset link." 
      });
    } catch (err: any) {
      setBusy(false);
      setErrorMsg("Unable to request reset. Please try again.");
      toast({ 
        title: "Request Failed", 
        description: err.message || "Unable to request password reset. Please try again.", 
        variant: "destructive" 
      });
    }
  };

  // Handle setting the new password
  const handleSubmitNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // Validation checks
    if (!password) {
      setErrorMsg("New Password is required.");
      toast({ title: "Validation Error", description: "New Password is required.", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.");
      toast({ title: "Validation Error", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (!confirm) {
      setErrorMsg("Confirm Password is required.");
      toast({ title: "Validation Error", description: "Confirm Password is required.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      setErrorMsg("Passwords do not match.");
      toast({ title: "Validation Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      // 1. Update the user's password in Auth database
      const { error: updateError } = await supabase.auth.updateUser({ password });
      
      if (updateError) {
        setBusy(false);
        if (updateError.message.toLowerCase().includes("network") || updateError.status === 0) {
          setErrorMsg("Network error. Please try again later.");
          toast({ title: "Network Error", description: "Network error. Please try again later.", variant: "destructive" });
        } else {
          setErrorMsg(updateError.message);
          toast({ title: "Reset Failed", description: updateError.message, variant: "destructive" });
        }
        return;
      }

      // 2. Invalidate current session
      await supabase.auth.signOut();
      
      setBusy(false);
      setSuccess(true);
      toast({ 
        title: "Success", 
        description: "Your password has been reset successfully.",
      });
    } catch (err: any) {
      setBusy(false);
      setErrorMsg("Unable to reset password. Please try again.");
      toast({ 
        title: "Reset Failed", 
        description: err.message || "Unable to reset password. Please try again.", 
        variant: "destructive" 
      });
    }
  };

  // Header content depending on active mode
  const heading = mode === "reset" ? "Set a new password" : "Reset your password";
  const subheading = mode === "reset" 
    ? "Choose a strong password you'll remember." 
    : "We'll email you a secure link to reset your password.";

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

        <div className="rounded-3xl border border-border bg-card/95 p-6 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-[#0B1B3D]/80 dark:shadow-[0_20px_60px_-15px_rgba(59,130,246,0.5)] sm:p-8 animate-fadeIn duration-500">
          
          {/* Main Logo & Header */}
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white shadow-lg shadow-[#3B82F6]/40">
              <BookOpen className="h-7 w-7" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-white">{heading}</h1>
            <p className="mt-1 text-sm text-muted-foreground dark:text-white/60">{subheading}</p>
          </div>

          {!ready ? (
            <div className="mt-8 flex flex-col items-center gap-3 text-muted-foreground dark:text-white/60 py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary dark:text-[#60A5FA]" />
              <p className="text-sm">Verifying your link...</p>
            </div>
          ) : mode === "request" ? (
            /* ================= REQUEST EMAIL MODE ================= */
            emailSent ? (
              <div className="mt-6 text-center space-y-6 animate-fadeIn">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-lg font-bold text-foreground dark:text-white font-sans">Check your inbox</h2>
                  <p className="text-sm text-muted-foreground dark:text-white/60 leading-relaxed px-2">
                    We've sent a password reset link to <span className="font-semibold text-foreground dark:text-white">{email}</span>.
                  </p>
                </div>

                <Button 
                  onClick={() => navigate("/login")} 
                  className="w-full h-11 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] border-0 text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 shadow-lg shadow-[#3B82F6]/20"
                >
                  Back to Sign In <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <form onSubmit={handleRequestReset} className="mt-6 space-y-5">
                {errorMsg && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-200 text-xs leading-relaxed animate-fadeIn">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-foreground/80 dark:text-white/80 font-medium">Email Address</Label>
                  <div className="relative">
                    <Input 
                      id="reset-email"
                      type="email" 
                      required 
                      placeholder="you@example.com"
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)}
                      className="border-input bg-background text-foreground placeholder:text-muted-foreground/50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 pl-10 h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-[#3B82F6]" 
                    />
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 dark:text-white/40" />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={busy} 
                  className="h-11 w-full rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] hover:opacity-95 border-0 font-bold tracking-wide text-white shadow-lg shadow-[#1D4ED8]/20 flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>Sending link...</span>
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>

                <div className="text-center pt-2">
                  <button 
                    type="button" 
                    onClick={() => navigate("/login")} 
                    className="text-sm font-semibold text-primary hover:underline dark:text-[#60A5FA]"
                  >
                    ← Back to Sign In
                  </button>
                </div>
              </form>
            )
          ) : (
            /* ================= SET NEW PASSWORD MODE ================= */
            success ? (
              <div className="mt-6 text-center space-y-6 animate-fadeIn">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-lg font-bold text-foreground dark:text-white">Your password has been reset successfully.</h2>
                  <p className="text-xs text-muted-foreground dark:text-white/50">
                    Redirecting to the login screen in <span className="font-bold text-primary dark:text-[#60A5FA]">{countdown}s</span>...
                  </p>
                </div>

                <Button 
                  onClick={() => navigate("/login")} 
                  className="w-full h-11 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] border-0 text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 shadow-lg shadow-[#3B82F6]/20"
                >
                  Go to Login <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmitNewPassword} className="mt-6 space-y-5">
                {errorMsg && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-200 text-xs leading-relaxed animate-fadeIn">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-foreground/80 dark:text-white/80 font-medium">New password</Label>
                  <div className="relative">
                    <Input 
                      type={show ? "text" : "password"} 
                      required 
                      minLength={8}
                      placeholder="At least 8 characters"
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)}
                      className="border-input bg-background text-foreground placeholder:text-muted-foreground/50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 pr-10 h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-[#3B82F6]" 
                    />
                    <button 
                      type="button" 
                      onClick={() => setShow((v) => !v)} 
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground/60 hover:text-foreground dark:text-white/50 dark:hover:text-white transition-colors"
                      aria-label={show ? "Hide password" : "Show password"}
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-foreground/80 dark:text-white/80 font-medium">Confirm password</Label>
                  <Input 
                    type={show ? "text" : "password"} 
                    required 
                    minLength={8}
                    placeholder="Re-enter new password"
                    value={confirm} 
                    onChange={(e) => setConfirm(e.target.value)}
                    className="border-input bg-background text-foreground placeholder:text-muted-foreground/50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-[#3B82F6]" 
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={busy} 
                  className="h-11 w-full rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] hover:opacity-95 border-0 font-bold tracking-wide text-white shadow-lg shadow-[#1D4ED8]/20 flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </form>
            )
          )}
        </div>
      </div>
    </main>
  );
}
