import { useEffect, useState } from "react";
import { LogOut, Settings as SettingsIcon, CreditCard, User as UserIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type Props = {
  variant?: "compact" | "full";
  className?: string;
};

export function ProfileMenu({ variant = "full", className }: Props) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const d = data as { display_name?: string | null; avatar_url?: string | null } | null;
      setDisplayName(d?.display_name || user.email?.split("@")[0] || "");
      setAvatarUrl(d?.avatar_url || null);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Refresh on cross-component updates (e.g. Settings avatar save)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { avatar_url?: string | null; display_name?: string | null } | undefined;
      if (detail?.avatar_url !== undefined) setAvatarUrl(detail.avatar_url);
      if (detail?.display_name) setDisplayName(detail.display_name);
    };
    window.addEventListener("profile:updated", handler);
    return () => window.removeEventListener("profile:updated", handler);
  }, []);

  const initials = (displayName || user?.email || "?")
    .split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const handleLogout = async () => { await signOut(); navigate("/auth"); };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 rounded-xl transition-colors",
            variant === "full"
              ? "w-full p-2 hover:bg-secondary"
              : "p-1 hover:bg-secondary",
            className,
          )}
          aria-label="Open profile menu"
        >
          <Avatar className="h-8 w-8 shrink-0">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
              {initials || <UserIcon className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
          {variant === "full" && (
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-semibold leading-tight">{displayName || "You"}</p>
              <p className="truncate text-[11px] text-muted-foreground leading-tight">{user?.email}</p>
            </div>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{displayName || user?.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/settings")}>
          <SettingsIcon className="mr-2 h-4 w-4" /> Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/settings?tab=billing")}>
          <CreditCard className="mr-2 h-4 w-4" /> Billing
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
