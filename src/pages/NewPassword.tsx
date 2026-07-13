import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Loader2, Eye, EyeOff, CheckCircle2, AlertTriangle, ArrowRight, Mail, Sparkles, Sun, Moon, User, Lock, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export default function NewPassword() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [countdown, setCountdown] = useState(4);

  // Form Fields
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
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

  // URL Hash Parsing for token authentication
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
    document.title = "Create New Password — Cashbook Charm";
  }, []);

  useEffect(() => {
    // 1. Check for token expiration error in URL
    const errorDescription = params.get("error_description") || params.get("error");
    if (errorDescription) {
      setErrorMsg("The password reset link is invalid or has expired. Please request a new one.");
      setReady(true);
      return;
    }

    // 2. Load the user's information from current session
    const loadUserInfo = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setEmail(session.user.email || "");
        setName(session.user.user_metadata?.full_name || session.user.user_metadata?.name || "");
        setReady(true);
      }
    };
    
    loadUserInfo();

    // Listen to changes to detect password recovery session
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setEmail(session.user.email || "");
        setName(session.user.user_metadata?.full_name || session.user.user_metadata?.name || "");
        setReady(true);
      }
    });

    // Timeout fallback if no session is active/restored
    const timer = setTimeout(() => {
      setReady(true);
    }, 1500);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccessToken]);

  // Handle auto redirect to login
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

  const handleSaveNewPassword = async (e: React.FormEvent) => {
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
      // 1. Update Password and User Metadata in Supabase
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
        data: {
          full_name: name || undefined,
        }
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

      // 2. Sign out the user to force logging in with the brand new credentials
      await supabase.auth.signOut();

      setBusy(false);
      setSuccess(true);
      toast({
        title: "Password Saved!",
        description: "Your new password has been set successfully.",
      });
    } catch (err: any) {
      setBusy(false);
      setErrorMsg("An unexpected error occurred. Please try again.");
      toast({
        title: "Error",
        description: err.message || "An error occurred while saving.",
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
          
          {/* Main Logo & Header */}
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] text-white shadow-lg shadow-[#3B82F6]/40">
              <BookOpen className="h-7 w-7" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-white">Create New Password</h1>
            <p className="mt-1 text-sm text-muted-foreground dark:text-white/60">
              Please enter your details to set your secure password.
            </p>
          </div>

          {!ready ? (
            <div className="mt-8 flex flex-col items-center gap-3 text-muted-foreground dark:text-white/60 py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary dark:text-[#60A5FA]" />
              <p className="text-sm font-medium">Validating recovery request...</p>
            </div>
          ) : success ? (
            /* ================= SUCCESS REDIRECT STATE ================= */
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
            /* ================= CREATE PASSWORD FORM ================= */
            <form onSubmit={handleSaveNewPassword} className="mt-6 space-y-4">
              {errorMsg && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-200 text-xs leading-relaxed animate-fadeIn">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Email (Read Only or Editable) */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-foreground/80 dark:text-white/80 font-medium text-xs">Email Address</Label>
                <div className="relative">
                  <Input 
                    id="email"
                    type="email" 
                    required 
                    placeholder="your-email@example.com"
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-input bg-background/50 text-foreground placeholder:text-muted-foreground/50 dark:border-white/10 dark:bg-white/5 dark:text-white pl-10 h-10 rounded-xl focus-visible:ring-1 focus-visible:ring-[#3B82F6]" 
                    // Set as readOnly if loaded from recovery session, but keep fully functional
                    readOnly={!!email}
                  />
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 dark:text-white/40" />
                </div>
              </div>

              {/* Name Field */}
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-foreground/80 dark:text-white/80 font-medium text-xs">Full Name</Label>
                <div className="relative">
                  <Input 
                    id="name"
                    type="text" 
                    required 
                    placeholder="Enter your name"
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    className="border-input bg-background text-foreground placeholder:text-muted-foreground/50 dark:border-white/10 dark:bg-white/5 dark:text-white pl-10 h-10 rounded-xl focus-visible:ring-1 focus-visible:ring-[#3B82F6]" 
                  />
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 dark:text-white/40" />
                </div>
              </div>

              {/* New Password Field */}
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

              {/* Confirm Password Field */}
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
                    <span className={hasNumberOrSpec ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground dark:text-white/60"}>One number/special character</span>
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

              {/* Save Button */}
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
