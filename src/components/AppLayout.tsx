import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutGrid, ArrowLeftRight, Users, BarChart3, Settings, Sun, Moon, Shield, MessageSquare, Crown, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

import { useTheme } from "@/hooks/useTheme";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePlan } from "@/hooks/usePlan";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ActiveCashbookProvider } from "@/hooks/useActiveCashbook";
import { CashbookSwitcher } from "@/components/CashbookSwitcher";
import { TrialBanner } from "@/components/TrialBanner";
import { ProfileMenu } from "@/components/ProfileMenu";

const baseNav = [
  { to: "/", label: "Dashboard", icon: LayoutGrid },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export default function AppLayout() {
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const { canAccessAdmin } = useIsAdmin();
  const { plan } = usePlan();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const showTeam = plan === "pro" || plan === "team";
  const navItems = [
    ...baseNav,
    ...(showTeam ? [{ to: "/team", label: "Team", icon: UsersRound }] : []),
    ...(canAccessAdmin ? [{ to: "/admin", label: "Admin", icon: Shield }] : []),
  ];

  return (
    <SidebarProvider defaultOpen>
      <ActiveCashbookProvider>
      <div className="flex min-h-screen w-full bg-background">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
            <div className="flex h-16 items-center justify-between gap-2 px-3 md:px-6">
              <div className="flex min-w-0 items-center gap-2">
                <SidebarTrigger className="hidden md:flex" />
                <h1 className="hidden sm:block text-sm font-semibold capitalize text-muted-foreground md:text-base md:text-foreground truncate">
                  {location.pathname === "/" ? "Dashboard" : location.pathname.slice(1).replace("-", " ")}
                </h1>
                <CashbookSwitcher />
              </div>

              <div className="flex items-center gap-1">
                {plan === "starter" && (
                  <NavLink
                    to="/pricing"
                    className={({ isActive }) => cn(
                      "flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs sm:text-sm font-semibold transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground hover:opacity-90",
                    )}
                    aria-label="Upgrade plan"
                  >
                    <Crown className="h-4 w-4" />
                    <span className="hidden xs:inline sm:inline">Upgrade</span>
                  </NavLink>
                )}
                <button onClick={() => setFeedbackOpen(true)} className="hidden md:flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                  <MessageSquare className="h-4 w-4" /> Feedback
                </button>
                <button onClick={() => setFeedbackOpen(true)} className="md:hidden rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Send feedback">
                  <MessageSquare className="h-4 w-4" />
                </button>
                <button onClick={toggle} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Toggle theme">
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <div className="md:hidden">
                  <ProfileMenu variant="compact" />
                </div>
              </div>
            </div>
          </header>

          <TrialBanner />
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-3 py-4 md:px-6 md:py-6 pb-28 md:pb-8 animate-fade-in">
            <Outlet />
          </main>
        </div>

        {/* Mobile bottom nav — with Logout entry & safe-area padding */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 px-1 py-3 text-[10px] font-medium",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>
        <div className="h-20 md:hidden" />
        <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      </div>
      </ActiveCashbookProvider>
    </SidebarProvider>
  );
}
