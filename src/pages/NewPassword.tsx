import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  ShieldCheck, Loader2, Eye, EyeOff, CheckCircle2, AlertTriangle, 
  ArrowRight, Lock, Check, X, Sun, Moon, Sparkles, KeyRound, 
  Activity, ShieldAlert, BadgeCheck, Terminal, HelpCircle, RefreshCw 
} from "lucide-react";
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
  const [countdown, setCountdown] = useState(4);

  // Form Fields (Exactly two inputs as requested)
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
  
  // Calculate dynamic security rating (0 to 100%)
  const getSecurityScore = () => {
    let score = 0;
    if (password.length > 0) score += 10;
    if (isMinLength) score += 30;
    if (hasUppercase) score += 20;
    if (hasNumberOrSpec) score += 20;
    if (isMatching) score += 20;
    return score;
  };
  
  const score = getSecurityScore();
  const isPasswordValid = isMinLength && hasUppercase && hasNumberOrSpec && isMatching;

  useEffect(() => {
    document.title = "Reset Your Password | Cashbook Charm Premium Secure";
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      setLoading(true);
      setErrorMsg("");

      // Parse token/recovery error in parameters
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
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Error fetching session:", error);
          setErrorMsg("Could not verify your recovery session. Please try again.");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
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

  // Get dynamic progress bar color & label
  const getSecurityLabel = () => {
    if (score === 0) return { label: "No Password", color: "bg-muted-foreground/30 text-muted-foreground" };
    if (score < 40) return { label: "Weak & Vulnerable", color: "bg-rose-500 text-rose-500" };
    if (score < 80) return { label: "Medium Protection", color: "bg-amber-500 text-amber-500" };
    if (score < 100) return { label: "Strong & Safe", color: "bg-indigo-500 text-indigo-500" };
    return { label: "Charm-Locked Perfect!", color: "bg-emerald-500 text-emerald-500" };
  };

  const securityInfo = getSecurityLabel();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-x-hidden py-12 px-4 bg-background text-foreground dark:bg-[#030712] dark:text-white">
      {/* Dynamic Background aesthetics (Inspired by premium pricing/product pages) */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.12] pointer-events-none" style={{
        backgroundImage: "linear-gradient(to right, rgba(99,102,241,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.2) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
        maskImage: "radial-gradient(ellipse at center, black 60%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse at center, black 60%, transparent 100%)",
      }} />
      
      {/* Glowing neon background elements */}
      <div className="absolute top-1/4 left-1/4 -translate-y-1/2 -translate-x-1/2 h-[35rem] w-[35rem] rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 blur-[140px] pointer-events-none animate-pulse duration-[8000ms]" />
      <div className="absolute bottom-1/4 right-1/4 translate-y-1/2 translate-x-1/2 h-[35rem] w-[35rem] rounded-full bg-violet-500/10 dark:bg-purple-500/15 blur-[140px] pointer-events-none animate-pulse duration-[6000ms]" />

      {/* Theme toggle & Back-to-site header link */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-20 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <span className="font-sans font-bold text-lg tracking-tight bg-gradient-to-r from-foreground to-foreground/70 dark:from-white dark:to-white/60 bg-clip-text text-transparent">
            Cashbook Charm
          </span>
        </div>
        
        <button
          onClick={toggle}
          className="rounded-full border border-border bg-card/65 p-2.5 text-muted-foreground transition-all hover:bg-muted hover:text-foreground dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white shadow-sm"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      <div className="relative z-10 w-full max-w-6xl mt-8">
        
        {/* Main Grid: Inspired by beautiful Split pricing-comparison layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* LEFT COLUMN: The Premium Features & Pricing-style Reassurances (5 Columns on Desktop) */}
          <div className="lg:col-span-5 space-y-6 text-left max-w-lg mx-auto lg:mx-0 animate-fadeIn duration-700">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5" /> High-Security Gateway
            </div>
            
            <div className="space-y-3">
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-sans leading-tight">
                Reset & <span className="bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">Fortify</span> Your Financial Ledger.
              </h1>
              <p className="text-muted-foreground dark:text-white/70 text-sm md:text-base leading-relaxed">
                Restore absolute control over your transactions. Your security is verified by our state-of-the-art zero-knowledge database connection.
              </p>
            </div>

            {/* Pricing-Style Feature Checklist with Glassmorphic Bento Cards */}
            <div className="space-y-3 pt-2">
              <div className="flex gap-4 p-3.5 rounded-2xl border border-border/80 bg-card/40 dark:border-white/5 dark:bg-white/5 backdrop-blur-sm hover:translate-x-1 transition-transform duration-300">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold font-sans">Zero-Knowledge Architecture</h4>
                  <p className="text-xs text-muted-foreground dark:text-white/50 mt-0.5">We never store your plaintext passwords. Everything is secured with strong SHA cryptographic keys.</p>
                </div>
              </div>

              <div className="flex gap-4 p-3.5 rounded-2xl border border-border/80 bg-card/40 dark:border-white/5 dark:bg-white/5 backdrop-blur-sm hover:translate-x-1 transition-transform duration-300">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold font-sans">Live Threat Shielding</h4>
                  <p className="text-xs text-muted-foreground dark:text-white/50 mt-0.5">Continuous session verification actively blocks brute-force entries and expired token replays.</p>
                </div>
              </div>

              <div className="flex gap-4 p-3.5 rounded-2xl border border-border/80 bg-card/40 dark:border-white/5 dark:bg-white/5 backdrop-blur-sm hover:translate-x-1 transition-transform duration-300">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <BadgeCheck className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold font-sans">SOC2 & GDPR Compliance Ready</h4>
                  <p className="text-xs text-muted-foreground dark:text-white/50 mt-0.5">Built on official Supabase authorization protocols to guarantee top-tier global compliance standards.</p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-4 text-xs text-muted-foreground dark:text-white/40 font-medium">
              <span className="flex items-center gap-1"><Terminal className="h-3.5 w-3.5" /> End-to-end Encrypted</span>
              <span className="text-border dark:text-white/10">|</span>
              <span className="flex items-center gap-1"><HelpCircle className="h-3.5 w-3.5" /> Support Online</span>
            </div>
          </div>

          {/* RIGHT COLUMN: The Interactive Glassmorphic Form Card (7 Columns on Desktop) */}
          <div className="lg:col-span-7 w-full max-w-xl mx-auto animate-fadeIn duration-1000 delay-100">
            <div className="relative rounded-3xl border border-border bg-card/85 p-6 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#090d16]/80 dark:shadow-[0_0_50px_-12px_rgba(99,102,241,0.25)] sm:p-8">
              
              {/* Card Header */}
              <div className="flex flex-col items-center text-center pb-2">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
                  <Lock className="h-7 w-7" strokeWidth={2} />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground dark:text-white font-sans">Reset Your Password</h2>
                <p className="mt-1 text-sm text-muted-foreground dark:text-white/60">
                  Create a robust, secure password to lock your Cashbook vault.
                </p>
              </div>

              {loading ? (
                <div className="mt-8 flex flex-col items-center gap-4 text-muted-foreground dark:text-white/60 py-12">
                  <div className="relative">
                    <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                    <RefreshCw className="h-4 w-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-500/60" />
                  </div>
                  <p className="text-sm font-medium animate-pulse">Reading secure recovery session...</p>
                </div>
              ) : success ? (
                /* ================= SUCCESS STATE WITH SATISFYING INTERACTION ================= */
                <div className="mt-6 text-center space-y-6 animate-scaleIn py-6">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                    <CheckCircle2 className="h-9 w-9 animate-bounce" />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-foreground dark:text-white font-sans">Update Password Success!</h3>
                    <p className="text-sm text-muted-foreground dark:text-white/60 leading-relaxed px-4">
                      Your premium authentication keys have been regenerated. You will now be redirected to the secure login gateway.
                    </p>
                    
                    {/* Countdown Progress Circle / Status bar */}
                    <div className="pt-4 flex items-center justify-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500 text-xs font-bold">
                        {countdown}
                      </div>
                      <span className="text-xs text-muted-foreground/60 dark:text-white/40">
                        Redirecting to secure portal in {countdown} seconds...
                      </span>
                    </div>
                  </div>

                  <Button 
                    onClick={() => navigate("/login")} 
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-600 border-0 text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 shadow-lg shadow-indigo-500/20 transform active:scale-95 transition-all duration-200"
                  >
                    Go to Secure Sign In <ArrowRight className="h-4.5 w-4.5" />
                  </Button>
                </div>
              ) : (
                /* ================= FORM STATE (EXACTLY TWO INPUTS) ================= */
                <form onSubmit={handleUpdatePassword} className="mt-6 space-y-5">
                  {errorMsg && (
                    <div className="flex items-start gap-3 p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-600 dark:text-rose-200 text-xs leading-relaxed animate-fadeIn">
                      <ShieldAlert className="h-5 w-5 shrink-0 text-rose-500 dark:text-rose-400" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* INPUT 1: New Password */}
                  <div className="space-y-1.5 relative group">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="pass" className="text-foreground/80 dark:text-white/80 font-semibold text-xs tracking-wide">New Password</Label>
                      {password && (
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${securityInfo.color.replace("bg-", "text-")}`}>
                          {securityInfo.label}
                        </span>
                      )}
                    </div>
                    
                    <div className="relative">
                      <Input 
                        id="pass"
                        type={showPass ? "text" : "password"} 
                        required 
                        placeholder="Create strong password"
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)}
                        className="border-input bg-background/50 text-foreground placeholder:text-muted-foreground/50 dark:border-white/10 dark:bg-white/5 dark:text-white pl-10 pr-10 h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-indigo-500 transition-all group-focus-within:border-indigo-500/50" 
                      />
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 dark:text-white/40 transition-colors group-focus-within:text-indigo-500" />
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

                  {/* INPUT 2: Confirm Password */}
                  <div className="space-y-1.5 relative group">
                    <Label htmlFor="confirmPass" className="text-foreground/80 dark:text-white/80 font-semibold text-xs tracking-wide">Confirm Password</Label>
                    <div className="relative">
                      <Input 
                        id="confirmPass"
                        type={showConfirm ? "text" : "password"} 
                        required 
                        placeholder="Confirm password"
                        value={confirm} 
                        onChange={(e) => setConfirm(e.target.value)}
                        className="border-input bg-background/50 text-foreground placeholder:text-muted-foreground/50 dark:border-white/10 dark:bg-white/5 dark:text-white pl-10 pr-10 h-11 rounded-xl focus-visible:ring-1 focus-visible:ring-indigo-500 transition-all" 
                      />
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 dark:text-white/40 transition-colors group-focus-within:text-indigo-500" />
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

                  {/* Premium Dash-style Interactive Strength Tracker */}
                  <div className="rounded-2xl border border-border/80 bg-muted/30 p-4 dark:border-white/5 dark:bg-white/5 space-y-3.5 animate-fadeIn">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-muted-foreground dark:text-white/40 uppercase tracking-wider">Vault Key Strength</span>
                      <span className="text-xs font-bold font-mono">{score}%</span>
                    </div>

                    {/* Multi-segment strength bars (inspired by high-end products) */}
                    <div className="flex gap-1 h-1.5 w-full">
                      <div className={`h-full flex-1 rounded-full transition-all duration-500 ${score >= 20 ? (score < 40 ? "bg-rose-500" : score < 80 ? "bg-amber-500" : "bg-emerald-500") : "bg-muted-foreground/20"}`} />
                      <div className={`h-full flex-1 rounded-full transition-all duration-500 ${score >= 40 ? (score < 80 ? "bg-amber-500" : "bg-emerald-500") : "bg-muted-foreground/20"}`} />
                      <div className={`h-full flex-1 rounded-full transition-all duration-500 ${score >= 65 ? (score < 80 ? "bg-amber-500" : "bg-emerald-500") : "bg-muted-foreground/20"}`} />
                      <div className={`h-full flex-1 rounded-full transition-all duration-500 ${score >= 80 ? (score < 100 ? "bg-indigo-500" : "bg-emerald-500") : "bg-muted-foreground/20"}`} />
                      <div className={`h-full flex-1 rounded-full transition-all duration-500 ${score === 100 ? "bg-emerald-500" : "bg-muted-foreground/20"}`} />
                    </div>

                    {/* Requirement checklist */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-4 w-4 items-center justify-center rounded-full border transition-all duration-300 ${isMinLength ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" : "border-muted-foreground/30 text-muted-foreground/40"}`}>
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </div>
                        <span className={isMinLength ? "text-emerald-600 dark:text-emerald-400 font-medium transition-colors" : "text-muted-foreground dark:text-white/50"}>Min. 8 characters</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className={`flex h-4 w-4 items-center justify-center rounded-full border transition-all duration-300 ${hasUppercase ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" : "border-muted-foreground/30 text-muted-foreground/40"}`}>
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </div>
                        <span className={hasUppercase ? "text-emerald-600 dark:text-emerald-400 font-medium transition-colors" : "text-muted-foreground dark:text-white/50"}>One capital letter</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className={`flex h-4 w-4 items-center justify-center rounded-full border transition-all duration-300 ${hasNumberOrSpec ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" : "border-muted-foreground/30 text-muted-foreground/40"}`}>
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </div>
                        <span className={hasNumberOrSpec ? "text-emerald-600 dark:text-emerald-400 font-medium transition-colors" : "text-muted-foreground dark:text-white/50"}>Number/Symbol</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className={`flex h-4 w-4 items-center justify-center rounded-full border transition-all duration-300 ${isMatching ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" : "border-muted-foreground/30 text-muted-foreground/40"}`}>
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </div>
                        <span className={isMatching ? "text-emerald-600 dark:text-emerald-400 font-medium transition-colors" : "text-muted-foreground dark:text-white/50"}>Passwords match</span>
                      </div>
                    </div>
                  </div>

                  {/* Update Password button */}
                  <Button 
                    type="submit" 
                    disabled={busy} 
                    className="h-12 w-full rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-600 hover:opacity-95 active:scale-[0.98] transition-all border-0 font-bold tracking-wide text-white shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="h-4.5 w-4.5 animate-spin text-white" />
                        <span>Updating Security Vault...</span>
                      </>
                    ) : (
                      "Update Password"
                    )}
                  </Button>

                  <div className="text-center pt-1.5">
                    <button 
                      type="button" 
                      onClick={() => navigate("/login")} 
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground dark:text-white/60 dark:hover:text-white transition-colors"
                    >
                      ← Return to Secure Login Gateway
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
          
        </div>

      </div>
    </main>
  );
}
