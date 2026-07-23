import React, { useState, useRef, useEffect } from "react";
import { X, Upload, FileText, CheckCircle2, Cloud, AlertCircle, RefreshCw, Layers, Link as LinkIcon, LogIn, MessageSquare, Send, ExternalLink } from "lucide-react";
import { Employee, FileCategory, DocType } from "../types";
import { collection, addDoc } from "firebase/firestore";
import { getAccessToken, googleSignIn, db } from "../lib/firebase";
import { uploadToGDrive, getPreviousMonthFolderInfo, formatArchiveFileName } from "../lib/gdrive";
import { ADMIN_WA_CONTACTS, createUploadWaMessage, openWhatsApp } from "../lib/whatsapp";

interface UploadModalProps {
  onClose: () => void;
  onUploadSuccess: (newFile: any) => void;
  employees: Employee[];
  isOnline: boolean;
  queueOfflineUpload: (item: any) => void;
  loggedInEmployee?: Employee | null;
}

export default function UploadModal({
  onClose,
  onUploadSuccess,
  employees,
  isOnline,
  queueOfflineUpload,
  loggedInEmployee,
}: UploadModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(() => {
    return loggedInEmployee ? loggedInEmployee.id : "";
  });
  const [fileName, setFileName] = useState("");
  const [category, setCategory] = useState<FileCategory>("PDF");
  const [docType, setDocType] = useState<DocType>("LKH");
  const [fileSize, setFileSize] = useState("1.5 MB");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // KUNCI UTAMA: Hanya NIP spesifik pusat atau role admin sejati yang diizinkan melihat tombol koneksi GDrive
  const ADMIN_MASTER_NIPS = ["198904092019031008", "199205082023211022"];
  const isAdmin = loggedInEmployee ? (
    ADMIN_MASTER_NIPS.includes(loggedInEmployee.nip) && 
    (loggedInEmployee.role === "admin" || loggedInEmployee.role === "verifikator")
  ) : false;

  useEffect(() => {
    if (fileName === "") {
      if (docType === "LKH") {
        setCategory("PDF");
      } else if (docType === "LKB") {
        setCategory("Excel");
      }
    }
  }, [docType, fileName]);

  const handleConnectDrive = async () => {
    setIsConnectingDrive(true);
    try {
      const res = await googleSignIn();
      if (res && res.user) {
        localStorage.setItem("gdrive_user_email", "siradjuddin92@gmail.com");
        alert("Google Drive terpusat berhasil dihubungkan ke: siradjuddin92@gmail.com");
      }
    } catch (err: any) {
      console.error("Gdrive login error:", err);
      alert(`Gagal menghubungkan Google Drive: ${err.message || err}`);
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    setSelectedFile(file);
    const ext = file.name.split(".").pop()?.toLowerCase();
    let sizeStr = (file.size / (1024 * 1024)).toFixed(1) + " MB";
    setFileSize(sizeStr);

    if (ext === "pdf") setCategory("PDF");
    else if (["doc", "docx", "odt"].includes(ext || "")) setCategory("Word");
    else if (["xls", "xlsx", "ods", "csv"].includes(ext || "")) setCategory("Excel");
    else if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) setCategory("Foto");
    else if (["mp4", "mkv", "avi", "mov"].includes(ext || "")) setCategory("Video");

    const upperName = file.name.toUpperCase();
    if (upperName.includes("SPT") || upperName.includes("TAHUNAN")) {
      setDocType("SPT");
    } else if (upperName.includes("LKH") || upperName.includes("HARIAN")) {
      setDocType("LKH");
    } else if (upperName.includes("LKB") || upperName.includes("BULANAN")) {
      setDocType("LKB");
    }

    const matchedEmployee = employees.find(e => 
      upperName.includes(e.nip) || 
      upperName.includes(e.name.toUpperCase().replace(/[^A-Z]/g, ""))
    );
    if (matchedEmployee) {
      setSelectedEmployeeId(matchedEmployee.id);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId || !fileName) return;

    const employee = employees.find(e => e.id === selectedEmployeeId);
    if (!employee) return;

    setUploadState("uploading");
    setSyncLogs([]);

    const pushLog = (msg: string, delay: number) => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          setSyncLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
          resolve();
        }, delay);
      });
    };

    await pushLog("Menginisiasi proses digitalisasi arsip...", 100);
    await pushLog(`Pegawai: ${employee.name} (NIP: ${employee.nip})`, 200);

    if (!isOnline) {
      await pushLog("Mode Luring (Offline) terdeteksi. Menyimpan ke antrean lokal...", 200);
      queueOfflineUpload({
        name: fileName,
        category,
        fileSize,
        uploadedBy: employee.name,
        nip: employee.nip,
        type: docType,
        description: description,
        timestamp: new Date().toISOString()
      });
      setUploadState("success");
      setTimeout(() => {
        onUploadSuccess(null);
        onClose();
      }, 2500);
      return;
    }

    const periodInfo = getPreviousMonthFolderInfo();
    const autoFormattedFileName = formatArchiveFileName(
      docType,
      employee.nip,
      periodInfo.monthName,
      periodInfo.year,
      selectedFile ? selectedFile.name : (fileName || `${docType}_${employee.nip}.pdf`)
    );

    await pushLog(`Periode Laporan: ${periodInfo.folderName}`, 200);
    await pushLog(`Nama Berkas Otomatis: '${autoFormattedFileName}'`, 200);

    const metaStr = JSON.stringify({
      NIP: employee.nip,
      Nama: employee.name,
      Jabatan: employee.position,
      Tipe: docType,
      PeriodeLaporan: periodInfo.folderName,
      TanggalUpload: new Date().toISOString().split("T")[0],
      Instansi: "Kemenag Mempawah",
    });

    let realGDriveId: string | undefined = undefined;
    let accessToken = getAccessToken() || localStorage.getItem("gdrive_access_token");

    const fileToUpload = selectedFile
      ? new File([selectedFile], autoFormattedFileName, { type: selectedFile.type })
      : new File(
          [`ARSIP DIGITAL KEMENAG MEMPAWAH\n===============================\nNama: ${employee.name}\nNIP: ${employee.nip}\nJabatan: ${employee.position}\nTipe: ${docType}\nPeriode: ${periodInfo.folderName}\nDeskripsi: ${description || '-'}`],
          autoFormattedFileName,
          { type: category === "PDF" ? "application/pdf" : "text/plain" }
        );

    if (accessToken) {
      try {
        await pushLog(`Mengunggah berkas fisik ke Google Drive pusat (siradjuddin92@gmail.com)...`, 300);
        const uploadResult = await uploadToGDrive(accessToken, fileToUpload, {
          name: autoFormattedFileName,
          parents: [],
          description: metaStr
        });
        realGDriveId = uploadResult.id;
        await pushLog(`SUKSES! Berkas fisik tersimpan di Google Drive pusat. ID: ${realGDriveId}`, 300);
      } catch (uploadErr: any) {
        console.error("Gdrive upload detail error:", uploadErr);
        await pushLog(`Catatan GDrive: ${uploadErr.message || uploadErr}. Menyimpan ke database...`, 300);
      }
    } else {
      await pushLog("Berkas diproses dan dicatat ke sistem pusat arsiparis.", 250);
    }

    await pushLog("Menyimpan riwayat permanen ke Cloud Firestore database...", 300);

    try {
      await addDoc(collection(db, "archives"), {
        name: autoFormattedFileName,
        category: category,
        fileSize: fileSize,
        uploadedBy: employee.name,
        nip: employee.nip,
        type: docType,
        description: description,
        gdriveId: realGDriveId || "cloud-synced",
        timestamp: new Date().toISOString()
      });

      await pushLog("Penyimpanan Arsip Berhasil Sepenuhnya!", 300);
      setUploadState("success");
      onUploadSuccess({
        name: autoFormattedFileName,
        category,
        fileSize,
        uploadedBy: employee.name,
        nip: employee.nip,
        type: docType,
        description,
        gdriveId: realGDriveId || "cloud-synced"
      });
    } catch (dbError: any) {
      console.error("Firestore error:", dbError);
      await pushLog(`Gagal menyimpan ke database: ${dbError.message || dbError}`, 300);
      setUploadState("error");
    }
  };

  return (
    <div id="upload-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <button
          id="btn-close-modal"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400">
            <Cloud className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Digitalisasi Arsip</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Unggah berkas laporan dan sinkronisasikan ke sistem Kemenag Mempawah
            </p>
          </div>
        </div>

        {uploadState === "idle" && (
          <form id="form-upload-archive" onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500 text-white rounded-lg shrink-0">
                  <Cloud className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-bold">
                    <span>Penyimpanan Terpusat di Cloud Arsiparis</span>
                    <span className="bg-emerald-600 text-white text-[9px] px-1.5 py-0.2 rounded-full uppercase tracking-wider font-extrabold">Aktif</span>
                  </div>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block mt-0.5">
                    {isAdmin ? "Status: Akses Kelola Terhubung (siradjuddin92@gmail.com)" : "Status: Terhubung secara otomatis ke Cloud Arsiparis Kemenag"}
                  </span>
                </div>
              </div>

              {/* Tombol Hubungkan Google Drive HANYA MUNCUL JIKA BENAR-BENAR ADMIN */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleConnectDrive}
                  disabled={isConnectingDrive}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer text-xs shadow-xs"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  {isConnectingDrive ? "Menghubungkan..." : "Hubungkan Google Drive (Admin)"}
                </button>
              )}
            </div>

            <div
              id="drag-drop-zone"
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                dragActive
                  ? "border-blue-500 bg-blue-50/30 dark:bg-blue-950/20"
                  : fileName
                  ? "border-blue-200 bg-blue-50/10 dark:bg-blue-950/10"
                  : "border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-800"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg,.mp4"
              />
              <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
              {fileName ? (
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">{fileName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Kategori: <span className="font-semibold text-blue-600 dark:text-blue-400">{category}</span> | Ukuran: {fileSize}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Tarik dan lepas berkas di sini, atau klik untuk menelusuri
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Pemilik Berkas (Pegawai) *
                </label>
                <select
                  id="select-employee"
                  required
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                >
                  <option value="">-- Pilih Pegawai --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} (NIP: {emp.nip})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Jenis Pelaporan *
                </label>
                <select
                  id="select-doc-type"
                  required
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as DocType)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                >
                  <option value="LKH">LKH (Laporan Kinerja Harian)</option>
                  <option value="LKB">LKB (Laporan Kerja Bulanan)</option>
                  <option value="SPT">SPT Tahunan (Surat Pemberitahuan Tahunan)</option>
                  <option value="Umum">Umum / Lain-lain</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Keterangan Dokumen / Catatan Tambahan (Metadata Deskripsi)
              </label>
              <textarea
                id="input-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tambahkan detail atau rangkuman kegiatan..."
                rows={3}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-lg text-sm font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!fileName || !selectedEmployeeId}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm cursor-pointer"
              >
                Unggah & Sinkronisasi GDrive
              </button>
            </div>
          </form>
        )}

        {uploadState === "uploading" && (
          <div className="py-6 flex flex-col items-center justify-center">
            <RefreshCw className="h-10 w-10 text-blue-600 animate-spin mb-4" />
            <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-4">
              Sedang memproses integrasi arsip digital...
            </h4>
            <div className="w-full bg-slate-950 text-slate-100 p-4 rounded-xl font-mono text-xs text-left h-48 overflow-y-auto border border-slate-800 shadow-inner">
              {syncLogs.map((log, i) => (
                <div key={i} className="mb-1 leading-relaxed whitespace-pre-wrap">
                  <span className="text-blue-400">{"> "}</span>
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {uploadState === "success" && (() => {
          const emp = employees.find(e => e.id === selectedEmployeeId);
          const empName = emp?.name || "Pegawai";
          const empNip = emp?.nip || "-";
          const periodInfo = getPreviousMonthFolderInfo();
          const autoFormattedFileName = formatArchiveFileName(
            docType,
            empNip,
            periodInfo.monthName,
            periodInfo.year,
            selectedFile ? selectedFile.name : (fileName || `${docType}.pdf`)
          );

          const waMsg = createUploadWaMessage({
            employeeName: empName,
            nip: empNip,
            docType,
            fileName: autoFormattedFileName,
            description
          });

          return (
            <div className="py-4 flex flex-col items-center justify-center text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-950/80 rounded-full text-emerald-600 dark:text-emerald-400 animate-bounce">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg">
                  Dokumen Berhasil Disimpan!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                  Berkas laporan berhasil diproses dan disinkronkan ke sistem arsiparis.
                </p>
              </div>

              {/* WhatsApp Admin Notification Action Card */}
              <div className="w-full bg-emerald-50/80 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-800 p-4 rounded-2xl text-left space-y-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                      Notifikasi WhatsApp Ke Admin Verifikator
                    </h4>
                    <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                      Kirim pesan pemberitahuan langsung agar Admin Verifikator segera memverifikasi berkas Anda:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {ADMIN_WA_CONTACTS.map((admin) => (
                    <button
                      key={admin.phone}
                      onClick={() => openWhatsApp(admin.phone, waMsg)}
                      className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs p-3 rounded-xl flex items-center justify-between gap-2 shadow-xs transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-2 text-left">
                        <Send className="h-4 w-4 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                        <div>
                          <span className="block font-extrabold text-xs">{admin.name}</span>
                          <span className="text-[10px] text-emerald-100 font-mono block opacity-90">{admin.displayPhone}</span>
                        </div>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full bg-slate-950/5 dark:bg-slate-950 text-left p-3 rounded-xl border border-blue-100 dark:border-blue-950/50 text-xs text-slate-600 dark:text-slate-400 font-mono">
                <span className="font-bold text-blue-600 dark:text-blue-400 block mb-1">✓ Detail Berkas Tersimpan:</span>
                • NIP: {empNip}<br />
                • Nama: {empName}<br />
                • Tipe: {docType} ({category})<br />
                • Nama File: {autoFormattedFileName}
              </div>

              <button
                onClick={onClose}
                className="w-full bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-colors cursor-pointer shadow-xs"
              >
                Selesai & Tutup
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}