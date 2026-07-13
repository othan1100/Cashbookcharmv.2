import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Loader2, Eye, EyeOff, CheckCircle2, AlertTriangle, ArrowRight, Lock, Check, X, Sun, Moon, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export default function NewPassword() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  
  // Loading & Action states
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [countdown, setCountdown] = useState(3);

  // Form Fields (exactly two as requested)
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  
  // Visibility Toggles
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Password Validation States
  const isMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumberOrSpec = /[0-9!@#$%^&*(),.?":{}|<>]/.test(password);
  const isMatching = password && password === confirm;
  const isPasswordValid = isMinLength && hasUppercase && hasNumberOrSpec && isMatching;

  useEffect(() => {
    document.title = "Create New Password — Cashbook Charm";
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      setLoading(true);
      setErrorMsg("");

      // 1. Check for token/recovery error in current URL parameters
      const hash = window.location.hash || "";
      const search = window.location.search || "";
      const params = new URLSearchParams(hash.replace("#", "?") || search);
      const errorDescription = params.get("error_description") || params.get("error");
      
      if (errorDescription) {
        setErrorMsg("The password recovery link is invalid or has expired. Please request a new one.");
        setLoading(false);
        return;
      }

      try {
        // 2. Read the recovery session from Supabase Auth
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Error fetching session:", error);
          setErrorMsg("Could not verify your recovery session. Please try again.");
        } else if (!session) {
          // If no session but hash exists, wait a short moment for auth state change
          console.log("No active session found on initial load.");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen to changes to detect password recovery session
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        console.log("Auth session detected on state change:", event);
        setLoading(false);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  // Handle countdown and auto redirect to /login
  useEffect(() => {
    if (!success) return;
    if (countdown <= 0) {
      navigate("/login");
      return;
    }
    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [success, countdown, navigate]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!isPasswordValid) {
      setErrorMsg("Please satisfy all password validation requirements.");
      toast({
        title: "Validation Error",
        description: "Please fulfill all password requirements before saving.",
        variant: "destructive"
      });
      return;
    }

    setBusy(true);

    try {
      // Use supabase.auth.updateUser({ password: newPassword })
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        setBusy(false);
        setErrorMsg(updateError.message);
        toast({
          title: "Update Failed",
          description: updateError.message,
          variant: "destructive"
        });
        return;
      }

      // Explicitly sign out to clean up recovery session before redirecting to login
      await supabase.auth.signOut();

      setBusy(false);
      setSuccess(true);
      toast({
        title: "Password Updated!",
        description: "Your password has been changed successfully.",
      });
    } catch (err: any) {
      setBusy(false);
      setErrorMsg("An unexpected error occurred. Please try again.");
      toast({
        title: "Error",
        description: err.message || "An error occurred while updating.",
        variant: "destructive"
      });
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-4 bg-background text-foreground dark:bg-[#06122B] dark:text-white">
      {/* Background aesthetics */}
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
          
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white shadow-lg shadow-[#3B82F6]/40">
              <BookOpen className="h-7 w-7" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-white font-sans">Create New Password</h1>
            <p className="mt-1 text-sm text-muted-foreground dark:text-white/60">
              Please enter your new secure password below.
            </p>
          </div>

          {loading ? (
            <div className="mt-8 flex flex-col items-center gap-3 text-muted-foreground dark:text-white/60 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary dark:text-[#60A5FA]" />
              <p className="text-sm font-medium">Reading recovery session...</p>
            </div>
          ) : success ? (
            /* ================= SUCCESS STATE ================= */
            <div className="mt-6 text-center space-y-6 animate-fadeIn">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <CheckCircle2 className="h-6 w-6 animate-pulse" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-foreground dark:text-white font-sans">Password updated!</h2>
                <p className="text-sm text-muted-foreground dark:text-white/60 leading-relaxed px-2">
                  Your new password has been saved. Please sign in again using your new credentials.
                </p>
                <p className="text-xs text-muted-foreground/60 dark:text-white/40">
                  Redirecting to the login screen in <span className="font-bold text-primary dark:text-[#60A5FA]">{countdown}s</span>...
                </p>
              </div>

              <Button 
                onClick={() => navigate("/login")} 
                className="w-full h-11 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] border-0 text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 shadow-lg shadow-[#3B82F6]/20"
              >
                Go to Sign In <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            /* ================= FORM STATE (Exactly Two Inputs) ================= */
            <form onSubmit={handleUpdatePassword} className="mt-6 space-y-4">
              {errorMsg && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-200 text-xs leading-relaxed animate-fadeIn">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 1. New Password Input */}
              <div className="space-y-1.5">
                <Label htmlFor="pass" className="text-foreground/80 dark:text-white/80 font-medium text-xs">New Password</Label>
                <div className="relative">
                  <Input 
                    id="pass"
                    type={showPass ? "text" : "password"} 
                    required 
                    placeholder="Minimum 8 characters"
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    className="border-input bg-background text-foreground placeholder:text-muted-foreground/50 dark:border-white/10 dark:bg-white/5 dark:text-white pl-10 pr-10 h-10 rounded-xl focus-visible:ring-1 focus-visible:ring-[#3B82F6]" 
                  />
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 dark:text-white/40" />
                  <button 
                    type="button" 
                    onClick={() => setShowPass((v) => !v)} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground/60 hover:text-foreground dark:text-white/50 dark:hover:text-white transition-colors"
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* 2. Confirm Password Input */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPass" className="text-foreground/80 dark:text-white/80 font-medium text-xs">Confirm New Password</Label>
                <div className="relative">
                  <Input 
                    id="confirmPass"
                    type={showConfirm ? "text" : "password"} 
                    required 
                    placeholder="Re-enter password"
                    value={confirm} 
                    onChange={(e) => setConfirm(e.target.value)}
                    className="border-input bg-background text-foreground placeholder:text-muted-foreground/50 dark:border-white/10 dark:bg-white/5 dark:text-white pl-10 pr-10 h-10 rounded-xl focus-visible:ring-1 focus-visible:ring-[#3B82F6]" 
                  />
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 dark:text-white/40" />
                  <button 
                    type="button" 
                    onClick={() => setShowConfirm((v) => !v)} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground/60 hover:text-foreground dark:text-white/50 dark:hover:text-white transition-colors"
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Real-time Password Checklist Validator */}
              <div className="rounded-xl border border-border bg-muted/40 p-3 dark:border-white/5 dark:bg-white/5 space-y-2 animate-fadeIn">
                <p className="text-[11px] font-semibold text-muted-foreground dark:text-white/40 uppercase tracking-wider">Password Requirements</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    {isMinLength ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500 stroke-[3]" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-rose-500 stroke-[3]" />
                    )}
                    <span className={isMinLength ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground dark:text-white/60"}>At least 8 characters</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {hasUppercase ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500 stroke-[3]" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-rose-500 stroke-[3]" />
                    )}
                    <span className={hasUppercase ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground dark:text-white/60"}>One uppercase letter</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {hasNumberOrSpec ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500 stroke-[3]" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-rose-500 stroke-[3]" />
                    )}
                    <span className={hasNumberOrSpec ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground dark:text-white/60"}>One number/spec char</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isMatching ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500 stroke-[3]" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-rose-500 stroke-[3]" />
                    )}
                    <span className={isMatching ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground dark:text-white/60"}>Passwords match</span>
                  </div>
                </div>
              </div>

              {/* Update Password Button */}
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
                  "Update Password"
                )}
              </Button>

              <div className="text-center pt-2">
                <button 
                  type="button" 
                  onClick={() => navigate("/login")} 
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground dark:text-white/60 dark:hover:text-white transition-colors"
                >
                  ← Back to Login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
