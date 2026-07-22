import React, { useState } from "react";
import { Search, CheckCircle2, AlertCircle, FileSpreadsheet, User, Building, Clock, Lock, X, AlertTriangle, Send, FileText, MessageSquare } from "lucide-react";
import { Employee } from "../types";
import WhatsAppNotifModal from "./WhatsAppNotifModal";
import { createUploadWaMessage, createCancellationWaMessage } from "../lib/whatsapp";

interface EmployeeMonitoringProps {
  employees: Employee[];
  onToggleStatus: (employeeId: string, type: "LKH" | "LKB" | "SPT", cancelNote?: string) => Promise<void>;
  isSyncing: boolean;
  currentUser?: Employee | null;
  initialReportType?: "LKH" | "LKB" | "SPT";
  allowedReportTypes?: ("LKH" | "LKB" | "SPT")[];
  title?: string;
}

export default function EmployeeMonitoring({
  employees,
  onToggleStatus,
  isSyncing,
  currentUser,
  initialReportType = "LKH",
  allowedReportTypes = ["LKH", "LKB"],
  title,
}: EmployeeMonitoringProps) {
  const [reportType, setReportType] = useState<"LKH" | "LKB" | "SPT">(initialReportType);
  const [filterStatus, setFilterStatus] = useState<"all" | "uploaded" | "pending" | "canceled">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeEmployeeId, setActiveEmployeeId] = useState<string | null>(null);

  // Cancellation Note Modal State
  const [cancelingTarget, setCancelingTarget] = useState<{ id: string; name: string; type: "LKH" | "LKB" | "SPT" } | null>(null);
  const [cancelNoteText, setCancelNoteText] = useState("");
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // WhatsApp Modal State
  const [waModalTarget, setWaModalTarget] = useState<{
    employeeName: string;
    nip: string;
    docType: string;
    customMessage?: string;
  } | null>(null);

  const isAdmin = currentUser
    ? ["198904092019031008", "199205082023211022"].includes(currentUser.nip) ||
      currentUser.role === "admin" ||
      currentUser.role === "verifikator"
    : false;

  const getEmpStatus = (emp: Employee, type: "LKH" | "LKB" | "SPT") => {
    if (type === "LKH") return emp.lkhStatus;
    if (type === "LKB") return emp.lkbStatus;
    return emp.sptStatus;
  };

  const getEmpLastUpload = (emp: Employee, type: "LKH" | "LKB" | "SPT") => {
    if (type === "LKH") return emp.lastLkhUpload;
    if (type === "LKB") return emp.lastLkbUpload;
    return emp.lastSptUpload;
  };

  const getEmpCancelNote = (emp: Employee, type: "LKH" | "LKB" | "SPT") => {
    if (type === "LKH") return emp.lkhCancelNote;
    if (type === "LKB") return emp.lkbCancelNote;
    return emp.sptCancelNote;
  };

  // Statistics calculation
  const totalCount = employees.length;
  const uploadedCount = employees.filter(e => getEmpStatus(e, reportType) === "uploaded").length;
  const canceledCount = employees.filter(e => {
    const status = getEmpStatus(e, reportType);
    const note = getEmpCancelNote(e, reportType);
    return status === "pending" && Boolean(note);
  }).length;
  const pendingCount = totalCount - uploadedCount - canceledCount;

  // Filter employees
  const filteredEmployees = employees.filter((emp) => {
    // Search filter
    const matchesSearch =
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.nip.includes(searchQuery);

    // Status filter
    const status = getEmpStatus(emp, reportType);
    const cancelNote = getEmpCancelNote(emp, reportType);
    const isCanceled = status === "pending" && Boolean(cancelNote);

    let matchesStatus = true;
    if (filterStatus === "uploaded") {
      matchesStatus = status === "uploaded";
    } else if (filterStatus === "pending") {
      matchesStatus = status === "pending" && !cancelNote;
    } else if (filterStatus === "canceled") {
      matchesStatus = isCanceled;
    }

    return matchesSearch && matchesStatus;
  });

  const handleOpenCancelModal = (empId: string, empName: string) => {
    setCancelingTarget({ id: empId, name: empName, type: reportType });
    setCancelNoteText(`Berkas ${reportType} belum lengkap / tidak sesuai ketentuan format. Silakan revisi dan unggah ulang.`);
  };

  const handleConfirmCancellation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelingTarget) return;

    setIsSubmittingCancel(true);
    const note = cancelNoteText.trim() || `Verifikasi dibatalkan oleh Admin Verifikator. Mohon perbaiki berkas ${cancelingTarget.type} Anda.`;
    
    await onToggleStatus(cancelingTarget.id, cancelingTarget.type, note);
    
    setIsSubmittingCancel(false);
    setCancelingTarget(null);
    setCancelNoteText("");
  };

  return (
    <div id="employee-monitoring-tab" className="space-y-6">
      {!isAdmin && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3.5 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2.5 shadow-2xs">
          <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            <strong>Akses Khusus Verifikator:</strong> Anda masuk sebagai Pegawai. Verifikasi dan pembatalan verifikasi laporan ({allowedReportTypes.join("/")}) hanya dapat dilakukan oleh <strong>Admin Verifikator</strong>.
          </span>
        </div>
      )}

      {/* 1. Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs">
        {/* Toggle LKH/LKB/SPT selection */}
        {allowedReportTypes.length > 1 ? (
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
            {allowedReportTypes.includes("LKH") && (
              <button
                id="btn-switch-lkh"
                onClick={() => setReportType("LKH")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  reportType === "LKH"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Clock className="h-4 w-4" />
                LKH (Harian)
              </button>
            )}
            {allowedReportTypes.includes("LKB") && (
              <button
                id="btn-switch-lkb"
                onClick={() => setReportType("LKB")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  reportType === "LKB"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <FileSpreadsheet className="h-4 w-4" />
                LKB (Bulanan)
              </button>
            )}
            {allowedReportTypes.includes("SPT") && (
              <button
                id="btn-switch-spt"
                onClick={() => setReportType("SPT")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  reportType === "SPT"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <FileText className="h-4 w-4" />
                SPT Tahunan
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 rounded-xl">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">{title || "Monitoring SPT Tahunan"}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Verifikasi & Penataan Surat Pemberitahuan Tahunan Pegawai</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {["all", "uploaded", "pending", "canceled"].map((status) => {
            const labels = {
              all: "Semua Status",
              uploaded: "Sudah Verifikasi",
              pending: "Belum Verifikasi",
              canceled: "Batal Verifikasi / Perlu Perbaikan",
            };
            const btnStyles = {
              all: "bg-slate-100 dark:bg-slate-800 border-slate-200 text-slate-700 dark:text-slate-300",
              uploaded: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-400",
              pending: "bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/50 text-amber-800 dark:text-amber-400",
              canceled: "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-400 font-bold",
            };
            const activeStyles = {
              all: "ring-2 ring-slate-400 bg-slate-200 text-slate-900",
              uploaded: "ring-2 ring-emerald-400 bg-emerald-100 text-emerald-900",
              pending: "ring-2 ring-amber-400 bg-amber-100 text-amber-900",
              canceled: "ring-2 ring-rose-500 bg-rose-100 text-rose-900",
            };

            return (
              <button
                key={status}
                id={`filter-${status}`}
                onClick={() => setFilterStatus(status as any)}
                className={`border text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  filterStatus === status ? activeStyles[status as keyof typeof activeStyles] : btnStyles[status as keyof typeof btnStyles]
                }`}
              >
                {labels[status as keyof typeof labels]}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Mini Statistics Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Pegawai</span>
          <span className="block text-xl font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">{totalCount}</span>
        </div>
        <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-950/30 p-3.5 rounded-xl text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Sudah Verifikasi</span>
          <span className="block text-xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5">{uploadedCount}</span>
        </div>
        <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-950/30 p-3.5 rounded-xl text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Belum Verifikasi</span>
          <span className="block text-xl font-extrabold text-amber-700 dark:text-amber-400 mt-0.5">{pendingCount}</span>
        </div>
        <div className="bg-rose-50/50 dark:bg-rose-950/10 border border-rose-200 dark:border-rose-900/40 p-3.5 rounded-xl text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Batal / Perlu Perbaikan</span>
          <span className="block text-xl font-extrabold text-rose-700 dark:text-rose-400 mt-0.5">{canceledCount}</span>
        </div>
      </div>

      {/* 3. Search Bar */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
          <Search className="h-4.5 w-4.5" />
        </span>
        <input
          id="search-pegawai"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari pegawai berdasarkan Nama atau NIP..."
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs placeholder-slate-400"
        />
      </div>

      {/* 4. Employee List Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredEmployees.length > 0 ? (
          filteredEmployees.map((emp) => {
            const isUploaded = getEmpStatus(emp, reportType) === "uploaded";
            const lastUpload = getEmpLastUpload(emp, reportType);
            const cancelNote = getEmpCancelNote(emp, reportType);

            return (
              <div
                key={emp.id}
                id={`peg-card-${emp.id}`}
                onClick={() => setActiveEmployeeId(activeEmployeeId === emp.id ? null : emp.id)}
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-2xs transition-all cursor-pointer hover:shadow-xs relative ${
                  isUploaded 
                    ? "border-emerald-200 dark:border-emerald-950 hover:border-emerald-300" 
                    : cancelNote
                    ? "border-rose-300 dark:border-rose-900 hover:border-rose-400 bg-rose-50/30 dark:bg-rose-950/20"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                }`}
              >
                {/* Colored Left Bar Indicator */}
                <div className={`absolute top-0 bottom-0 left-0 w-1.5 rounded-l-2xl ${
                  isUploaded ? "bg-emerald-500" : cancelNote ? "bg-rose-600" : "bg-amber-500"
                }`} />

                <div className="flex items-start justify-between">
                  <div className="space-y-1 pl-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-1.5">
                        {emp.name}
                        {(["198904092019031008", "199205082023211022"].includes(emp.nip) || emp.role === "admin") && (
                          <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700">
                            Admin Verifikator
                          </span>
                        )}
                      </h4>
                      {isUploaded ? (
                        <span className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900">
                          <CheckCircle2 className="h-3 w-3" />
                          Sudah Verifikasi
                        </span>
                      ) : cancelNote ? (
                        <span className="flex items-center gap-1 bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-300 dark:border-rose-800 animate-pulse">
                          <AlertTriangle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
                          Batal Verifikasi / Perlu Perbaikan
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900">
                          <AlertCircle className="h-3 w-3" />
                          Belum Verifikasi
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">NIP: {emp.nip}</p>
                    
                    {emp.position && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                        <Building className="h-3.5 w-3.5 text-slate-400" />
                        <span>{emp.position}</span>
                      </div>
                    )}

                    {lastUpload ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>Diunggah: {new Date(lastUpload).toLocaleTimeString("id-ID")} WIB</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-rose-500 font-medium">
                        Belum ada verifikasi {reportType} periode ini.
                      </div>
                    )}
                  </div>

                  {/* Manual Override & WhatsApp Action Buttons */}
                  <div className="flex flex-col items-end gap-2">
                    {isAdmin ? (
                      <button
                        id={`btn-toggle-status-${emp.id}`}
                        onClick={async (e) => {
                          e.stopPropagation(); // Stop details toggle
                          if (isUploaded) {
                            handleOpenCancelModal(emp.id, emp.name);
                          } else {
                            await onToggleStatus(emp.id, reportType);
                          }
                        }}
                        disabled={isSyncing}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border shadow-3xs transition-all flex items-center gap-1.5 cursor-pointer ${
                          isUploaded
                            ? "bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-800"
                            : "bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800"
                        }`}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        {isUploaded ? "Batal Verifikasi" : "Verifikasi Manual"}
                      </button>
                    ) : (
                      <div
                        className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60"
                        title="Khusus Admin Verifikator"
                      >
                        <Lock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        <span>Khusus Verifikator</span>
                      </div>
                    )}

                    {/* Quick WhatsApp Notification Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setWaModalTarget({
                          employeeName: emp.name,
                          nip: emp.nip,
                          docType: reportType,
                        });
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                      title="Kirim Notifikasi WhatsApp ke Admin Verifikator"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span>Notif WA Admin</span>
                    </button>
                  </div>
                </div>

                {/* Display Cancellation Note if present when status is unverified / pending */}
                {!isUploaded && cancelNote && (
                  <div className="mt-3 pl-2 p-3 bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 rounded-xl text-xs text-rose-800 dark:text-rose-300 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-400 text-[11px]">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                        <span>Catatan Pembatalan Verifikasi Admin:</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setWaModalTarget({
                            employeeName: emp.name,
                            nip: emp.nip,
                            docType: reportType,
                            customMessage: createCancellationWaMessage({
                              employeeName: emp.name,
                              nip: emp.nip,
                              docType: reportType,
                              cancelNote: cancelNote
                            })
                          });
                        }}
                        className="text-[10px] bg-rose-600 hover:bg-rose-700 text-white px-2 py-0.5 rounded font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <MessageSquare className="h-3 w-3" />
                        <span>Notif WA Perbaikan</span>
                      </button>
                    </div>
                    <p className="italic pl-5 font-medium text-slate-700 dark:text-slate-200 text-[11px]">
                      "{cancelNote}"
                    </p>
                  </div>
                )}

                {/* Expanded employee card details */}
                {activeEmployeeId === emp.id && (
                  <div id={`details-${emp.id}`} className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-2.5 pl-2 animate-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300">NIP Lengkap:</span>
                      <span className="font-mono">{emp.nip}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Unit Satker:</span>
                      <span>Kementerian Agama Kabupaten Mempawah</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Status LKH (Harian):</span>
                      <span className={emp.lkhStatus === "uploaded" ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-rose-500 font-semibold"}>
                        {emp.lkhStatus === "uploaded" ? "Sudah Verifikasi" : "Belum Verifikasi"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Status LKB (Bulanan):</span>
                      <span className={emp.lkbStatus === "uploaded" ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-rose-500 font-semibold"}>
                        {emp.lkbStatus === "uploaded" ? "Sudah Verifikasi" : "Belum Verifikasi"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Status SPT Tahunan:</span>
                      <span className={emp.sptStatus === "uploaded" ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-rose-500 font-semibold"}>
                        {emp.sptStatus === "uploaded" ? "Sudah Verifikasi" : "Belum Verifikasi"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div id="no-pegawai" className="col-span-2 py-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <User className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">Tidak Ada Pegawai Ditemukan</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Gunakan kata kunci pencarian atau ganti filter status di atas.</p>
          </div>
        )}
      </div>

      {/* Modal Prompt: Catatan Pembatalan Verifikasi */}
      {cancelingTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
                <AlertTriangle className="h-5 w-5" />
                <span>Pembatalan Verifikasi {cancelingTarget.type}</span>
              </div>
              <button
                onClick={() => setCancelingTarget(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Anda akan membatalkan status terverifikasi untuk <strong className="text-slate-900 dark:text-slate-100">{cancelingTarget.name}</strong>.
              Pegawai ini akan dipindahkan ke kategori <strong className="text-rose-600 dark:text-rose-400">Belum Verifikasi (Merah)</strong>.
            </p>

            <form onSubmit={handleConfirmCancellation} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Catatan Pembatalan untuk Pegawai:
                </label>
                <textarea
                  id="input-cancel-note"
                  rows={3}
                  required
                  value={cancelNoteText}
                  onChange={(e) => setCancelNoteText(e.target.value)}
                  placeholder="Tuliskan alasan pembatalan (misal: Berkas belum lengkap / perlu tanda tangan basah)..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCancelingTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  id="btn-confirm-cancel-verification"
                  type="submit"
                  disabled={isSubmittingCancel}
                  className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {isSubmittingCancel ? "Memproses..." : "Konfirmasi Pembatalan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* WhatsApp Notification Modal */}
      {waModalTarget && (
        <WhatsAppNotifModal
          isOpen={!!waModalTarget}
          onClose={() => setWaModalTarget(null)}
          employeeName={waModalTarget.employeeName}
          nip={waModalTarget.nip}
          docType={waModalTarget.docType}
          customMessage={waModalTarget.customMessage}
        />
      )}
    </div>
  );
}
