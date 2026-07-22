import React, { useState } from "react";
import { MessageSquare, ExternalLink, X, Send, ShieldCheck, CheckCircle, UserCheck } from "lucide-react";
import { ADMIN_WA_CONTACTS, createUploadWaMessage, openWhatsApp, getWhatsAppUrl } from "../lib/whatsapp";

interface WhatsAppNotifModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeName?: string;
  nip?: string;
  docType?: string;
  fileName?: string;
  description?: string;
  customMessage?: string;
  title?: string;
}

export default function WhatsAppNotifModal({
  isOpen,
  onClose,
  employeeName = "Pegawai",
  nip = "-",
  docType = "LKH",
  fileName = "Laporan_Dokumen.pdf",
  description = "",
  customMessage,
  title = "Pemberitahuan WhatsApp ke Admin Verifikator"
}: WhatsAppNotifModalProps) {
  const [selectedAdmin, setSelectedAdmin] = useState<string>("all");

  if (!isOpen) return null;

  const defaultMsg = customMessage || createUploadWaMessage({
    employeeName,
    nip,
    docType,
    fileName,
    description
  });

  const [messageText, setMessageText] = useState(defaultMsg);
  const [copied, setCopied] = useState(false);

  const handleSendWA = (phone: string) => {
    openWhatsApp(phone, messageText);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(messageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-full transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">{title}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Kirim pesan langsung melalui WhatsApp ke Admin Verifikator
            </p>
          </div>
        </div>

        {/* Admin Contacts list */}
        <div className="space-y-2.5 pt-2">
          <label className="block text-xs font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            Pilih Admin Verifikator WhatsApp:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {ADMIN_WA_CONTACTS.map((admin) => {
              const waUrl = getWhatsAppUrl(admin.phone, messageText);
              return (
                <div
                  key={admin.phone}
                  className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 rounded-xl p-3 flex flex-col justify-between space-y-2 hover:border-emerald-400 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-600 text-white rounded-lg font-bold text-xs shrink-0">
                      WA
                    </div>
                    <div>
                      <h5 className="font-bold text-xs text-slate-800 dark:text-slate-100">{admin.name}</h5>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono block">
                        {admin.displayPhone}
                      </span>
                    </div>
                  </div>

                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleSendWA(admin.phone)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Kirim WA</span>
                    <ExternalLink className="h-3 w-3 opacity-80" />
                  </a>
                </div>
              );
            })}
          </div>
        </div>

        {/* Message preview / edit area */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Pratinjau Pesan WhatsApp:
            </label>
            <button
              onClick={handleCopyText}
              className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              {copied ? "✓ Teks Menyalin!" : "Salin Pesan"}
            </button>
          </div>
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            rows={6}
            className="w-full bg-slate-950 text-slate-100 font-mono text-xs p-3 rounded-xl border border-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed"
          />
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 text-xs">
          <span className="text-[11px] text-slate-400">
            Terhubung otomatis ke aplikasi WhatsApp
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
