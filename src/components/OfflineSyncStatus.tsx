import { useEffect, useState, useCallback } from "react";
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  getOfflineMutations,
  syncOfflineMutations,
} from "@/lib/offlineSync";

export function OfflineSyncStatus() {
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const updateStatus = useCallback(() => {
    setIsOnline(navigator.onLine);
    setPendingCount(getOfflineMutations().length);
  }, []);

  const handleSync = useCallback(async () => {
    if (!navigator.onLine) {
      toast({
        title: "Cannot sync",
        description: "You are currently offline. Please check your internet connection.",
        variant: "destructive",
      });
      return;
    }

    const mutations = getOfflineMutations();
    if (mutations.length === 0) {
      toast({
        title: "Up to date",
        description: "All transactions are fully synchronized with the cloud.",
      });
      return;
    }

    setSyncing(true);
    try {
      const res = await syncOfflineMutations();
      updateStatus();
      if (res.success) {
        toast({
          title: "Synchronization complete",
          description: `Successfully uploaded ${res.syncedCount} queued change(s).`,
        });
        window.dispatchEvent(new Event("offline_mutations_changed"));
      } else {
        toast({
          title: "Sync partially completed",
          description: `Synced ${res.syncedCount} item(s). ${res.errors.length} item(s) failed.`,
          variant: "destructive",
        });
      }
    } catch (e) {
      console.error("Sync error", e);
      toast({
        title: "Sync failed",
        description: "An unexpected error occurred during database synchronization.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }, [updateStatus]);

  useEffect(() => {
    updateStatus();

    const handleOnline = async () => {
      setIsOnline(true);
      toast({
        title: "Internet restored",
        description: "Attempting to synchronize your offline changes...",
      });
      await handleSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "Working offline",
        description: "Your changes will be saved locally and synced when you reconnect.",
        variant: "destructive",
      });
    };

    const handleMutationsChanged = () => {
      setPendingCount(getOfflineMutations().length);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("offline_mutations_changed", handleMutationsChanged);

    const interval = setInterval(updateStatus, 15000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("offline_mutations_changed", handleMutationsChanged);
      clearInterval(interval);
    };
  }, [updateStatus, handleSync]);

  if (pendingCount === 0 && isOnline) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        <span>Cloud Synced</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50/50 p-2.5 text-xs dark:border-amber-900/30 dark:bg-amber-950/10">
      <div className="flex items-center gap-2 font-medium">
        {isOnline ? (
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <Wifi className="h-3.5 w-3.5" />
            <span>Online</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500">
            <WifiOff className="h-3.5 w-3.5" />
            <span>Offline Fallback</span>
          </div>
        )}
        
        {pendingCount > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            {pendingCount} pending
          </span>
        )}
      </div>

      <div className="flex-1 text-muted-foreground text-right max-sm:hidden">
        {pendingCount > 0 
          ? "Unstable connection. Changes are cached." 
          : "Local cache is active for offline browsing."}
      </div>

      <Button
        onClick={handleSync}
        disabled={syncing || !isOnline}
        size="sm"
        variant="outline"
        className="h-7 gap-1.5 rounded-lg border-amber-200 bg-white px-2.5 text-xs font-semibold text-amber-800 shadow-sm hover:bg-amber-100/50 hover:text-amber-900 disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400 dark:border-amber-900 dark:bg-zinc-900 dark:text-amber-300 dark:hover:bg-amber-900/30"
      >
        <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Syncing..." : "Sync Now"}
      </Button>
    </div>
  );
}
