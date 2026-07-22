import { useEffect, useState } from "react";
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { SyncItem } from "../types";

interface OfflineSyncIndicatorProps {
  onSyncComplete: () => void;
  pendingCount: number;
  triggerSync: () => Promise<void>;
  isSyncing: boolean;
}

export default function OfflineSyncIndicator({
  onSyncComplete,
  pendingCount,
  triggerSync,
  isSyncing,
}: OfflineSyncIndicatorProps) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState("");

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setNotificationMsg("Koneksi internet terhubung kembali! Menyinkronkan data...");
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 5000);
      
      // Auto-sync
      await triggerSync();
      onSyncComplete();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setNotificationMsg("Koneksi terputus. Bekerja dalam Mode Offline (Luring).");
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 5000);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [triggerSync, onSyncComplete]);

  return (
    <div id="offline-sync-indicator" className="fixed bottom-[115px] sm:bottom-[108px] right-4 sm:right-6 z-50 flex flex-col gap-2 items-end pointer-events-auto">
      {/* Toast Notification */}
      {showNotification && (
        <div
          id="connection-toast"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium transition-all duration-300 animate-bounce ${
            isOnline
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
          }`}
        >
          {isOnline ? (
            <Wifi className="h-5 w-5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
          ) : (
            <WifiOff className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          )}
          <span>{notificationMsg}</span>
        </div>
      )}

      {/* Connection Status & Pending Sync Floating Badge */}
      <div
        id="sync-status-badge"
        className={`flex items-center gap-3 px-4 py-2.5 rounded-full shadow-lg border text-sm font-semibold transition-all duration-300 bg-white dark:bg-slate-900 ${
          isOnline
            ? "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
            : "border-amber-400 dark:border-amber-700 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20"
        }`}
      >
        <span className="flex h-2.5 w-2.5 relative">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isOnline ? "bg-emerald-400" : "bg-amber-400"
            }`}
          ></span>
          <span
            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              isOnline ? "bg-emerald-500" : "bg-amber-500"
            }`}
          ></span>
        </span>

        <span>{isOnline ? "Online" : "Offline Mode"}</span>

        {pendingCount > 0 && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
            <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
              {pendingCount} Antrean
            </span>
            {isOnline && (
              <button
                id="btn-manual-sync"
                onClick={async () => {
                  await triggerSync();
                  onSyncComplete();
                }}
                disabled={isSyncing}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-emerald-600 disabled:opacity-50"
                title="Sinkronisasikan Sekarang"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
