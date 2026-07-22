import { AppNotification } from "../types";
import { Bell, BellOff, CheckCircle, Info, AlertTriangle, Trash2, ShieldCheck } from "lucide-react";

interface NotificationCenterProps {
  notifications: AppNotification[];
  onClear: () => void;
}

export default function NotificationCenter({ notifications, onClear }: NotificationCenterProps) {
  return (
    <div id="notification-center" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4 border-b border-slate-150 dark:border-slate-850 pb-3">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Log Notifikasi & Sinkronisasi</h4>
        </div>
        {notifications.length > 0 && (
          <button
            id="btn-clear-notifications"
            onClick={onClear}
            className="flex items-center gap-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Hapus Semua
          </button>
        )}
      </div>

      <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
        {notifications.length > 0 ? (
          notifications.map((notif) => {
            const notifIcons = {
              info: <Info className="h-4 w-4 text-blue-500" />,
              success: <CheckCircle className="h-4 w-4 text-emerald-500" />,
              warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
            };

            const bgClasses = {
              info: "bg-blue-50/50 dark:bg-blue-950/10 border-blue-100/50 dark:border-blue-950/30",
              success: "bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100/50 dark:border-emerald-950/30",
              warning: "bg-amber-50/50 dark:bg-amber-950/10 border-amber-100/50 dark:border-amber-950/30",
            };

            return (
              <div
                key={notif.id}
                id={`notif-${notif.id}`}
                className={`flex gap-3 p-3 rounded-xl border transition-all ${bgClasses[notif.type]}`}
              >
                <div className="mt-0.5 flex-shrink-0">{notifIcons[notif.type]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800 dark:text-slate-100 text-xs truncate">
                      {notif.title}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                      {new Date(notif.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {notif.body}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div id="no-notifications" className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
            <BellOff className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            Belum ada notifikasi push yang tercatat.
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          FCM Client: Terhubung
        </span>
        <span className="font-mono">Server Status: Online</span>
      </div>
    </div>
  );
}
