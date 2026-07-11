import { BookOpen, LayoutGrid, ArrowLeftRight, Users, BarChart3, Settings, Shield, Crown, UsersRound } from "lucide-react";
import { useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { usePlan } from "@/hooks/usePlan";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { cn } from "@/lib/utils";
import { ProfileMenu } from "@/components/ProfileMenu";

const mainItems = [
  { to: "/", label: "Dashboard", icon: LayoutGrid },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/reports", label: "Reports", icon: BarChart3 },
];

const pricingItem = { to: "/pricing", label: "Pricing", icon: Crown };
const settingsOnly = [{ to: "/settings", label: "Settings", icon: Settings }];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { canAccessAdmin } = useIsAdmin();
  const { plan } = usePlan();

  const isActive = (path: string) => location.pathname === path;

  const renderItem = (item: { to: string; label: string; icon: typeof LayoutGrid }) => {
    const Icon = item.icon;
    const active = isActive(item.to);
    return (
      <SidebarMenuItem key={item.to}>
        <SidebarMenuButton asChild tooltip={item.label}>
          <NavLink
            to={item.to}
            className={cn(
              "flex items-center gap-3 rounded-lg transition-all px-3 py-2",
              active ? "bg-[#163BB4] text-white font-bold shadow-md shadow-blue-900/40" : "text-slate-200 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-white/5 bg-[#0B1E4E] text-slate-200">
      <SidebarHeader className="border-b border-white/5 p-3 bg-[#0B1E4E]">
        <NavLink to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/20">
            <BookOpen className="h-5 w-5" strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <div className="leading-none text-white">
              <div className="text-base font-bold tracking-tight">Cashbook</div>
              <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">Charm</div>
            </div>
          )}
        </NavLink>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3 bg-[#0B1E4E]">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">Workspace</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>{mainItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">System</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {(plan === "pro" || plan === "team") && renderItem({ to: "/team", label: "Team", icon: UsersRound })}
              {plan === "starter" && renderItem(pricingItem)}
              {settingsOnly.map(renderItem)}
              {canAccessAdmin && renderItem({ to: "/admin", label: "Admin", icon: Shield })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/5 p-2 bg-[#0B1E4E]">
        <ProfileMenu variant={collapsed ? "compact" : "full"} className="text-slate-200 hover:bg-white/10 hover:text-white" />
      </SidebarFooter>
    </Sidebar>
  );
}
