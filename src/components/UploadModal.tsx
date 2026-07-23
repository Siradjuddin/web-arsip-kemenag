import React, { useState, useRef, useEffect } from "react";
import { X, Upload, FileText, CheckCircle2, Cloud, AlertCircle, RefreshCw, Layers, Link as LinkIcon, LogIn, MessageSquare, Send, ExternalLink } from "lucide-react";
import { Employee, FileCategory, DocType } from "../types";
import { collection, addDoc } from "firebase/firestore";
import { clearGDriveToken, getAccessToken, googleSignIn, db } from "../lib/firebase";
import { uploadToGDrive, verifyGDriveFolder, getPreviousMonthFolderInfo, formatArchiveFileName } from "../lib/gdrive";
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
  const [driveUserEmail, setDriveUserEmail] = useState<string | null>(() => localStorage.getItem("gdrive_user_email"));
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(() => getAccessToken());
  const [driveError, setDriveError] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDriveConnected = Boolean(driveAccessToken);

  useEffect(() => {
    const storedEmail = localStorage.getItem("gdrive_user_email");
    const storedToken = getAccessToken();
    if (storedEmail) setDriveUserEmail(storedEmail);
    if (storedToken) setDriveAccessToken(storedToken);
  }, []);

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
    setDriveError(null);
    try {
      const res = await googleSignIn();
      if (res && res.user) {
        const email = res.user.email || "";
        const token = res.accessToken || "";
        localStorage.setItem("gdrive_user_email", email);
        localStorage.setItem("gdrive_access_token", token);
        setDriveUserEmail(email);
        setDriveAccessToken(token);
        alert(`Google Drive terpusat berhasil dihubungkan ke: ${email}`);
      }
    } catch (err: any) {
      console.error("Gdrive login error:", err);
      const message = err?.message || String(err) || "Terjadi kesalahan saat menghubungkan Google Drive.";
      setDriveError(message);
      alert(`Gagal menghubungkan Google Drive: ${message}`);
    } finally {
      setIsConnectingDrive(false);
    }
  };

  const verifyDriveAccess = async (token: string) => {
    const response = await fetch(
      "https://www.googleapis.com/drive/v3/about?fields=user&supportsAllDrives=true",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Verifikasi Google Drive gagal (${response.status}): ${errText}`);
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
    setDriveError(null);
    setSyncLogs([]);

    const pushLog = (msg: string, delay: number) => {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          setSyncLogs((prev: string[]) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
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

    let realGDriveId: string | undefined = undefined;
    const parentFolderId =
      localStorage.getItem("gdrive_custom_folder_id") ||
      localStorage.getItem("gdrive_folder_id") ||
      undefined;
    let accessToken = driveAccessToken || getAccessToken() || localStorage.getItem("gdrive_access_token");

    await pushLog(`Periode Laporan: ${periodInfo.folderName}`, 200);
    await pushLog(`Nama Berkas Otomatis: '${autoFormattedFileName}'`, 200);
    await pushLog(`Folder target Google Drive: ${parentFolderId || "(root/default)"}`, 200);

    const metaStr = JSON.stringify({
      NIP: employee.nip,
      Nama: employee.name,
      Jabatan: employee.position,
      Tipe: docType,
      PeriodeLaporan: periodInfo.folderName,
      TanggalUpload: new Date().toISOString().split("T")[0],
      Instansi: "Kemenag Mempawah",
    });

    const fileToUpload = selectedFile
      ? new File([selectedFile], autoFormattedFileName, { type: selectedFile.type })
      : new File(
          [`ARSIP DIGITAL KEMENAG MEMPAWAH\n===============================\nNama: ${employee.name}\nNIP: ${employee.nip}\nJabatan: ${employee.position}\nTipe: ${docType}\nPeriode: ${periodInfo.folderName}\nDeskripsi: ${description || '-'}`],
          autoFormattedFileName,
          { type: category === "PDF" ? "application/pdf" : "text/plain" }
        );

    if (accessToken) {
      try {
        await verifyDriveAccess(accessToken);
      } catch (verifyErr: any) {
        console.error("Gdrive verify error:", verifyErr);
        const errMessage = verifyErr?.message || String(verifyErr) || "Token Google Drive tidak valid.";
        clearGDriveToken();
        setDriveUserEmail(null);
        setDriveAccessToken(null);
        setDriveError("Token Google Drive tidak valid atau sudah kedaluwarsa. Silakan hubungkan ulang akun admin.");
        await pushLog(`Verifikasi token gagal: ${errMessage}`, 300);
        setUploadState("error");
        return;
      }

      if (parentFolderId) {
        try {
          const folderInfo = await verifyGDriveFolder(accessToken, parentFolderId);
          await pushLog(`Folder target berhasil diverifikasi: ${folderInfo.name} (${folderInfo.id})`, 300);
        } catch (folderErr: any) {
          console.error("Gdrive folder verify error:", folderErr);
          const errMessage = folderErr?.message || String(folderErr) || "Folder tidak dapat diakses.";
          await pushLog(`Verifikasi folder gagal: ${errMessage}`, 300);
          setDriveError(`Folder target Google Drive tidak dapat diakses. ${errMessage}`);
          setUploadState("error");
          return;
        }
      }

      try {
        const activeEmail = driveUserEmail || localStorage.getItem("gdrive_user_email") || "Akun Google Drive";
        await pushLog(`Mengunggah berkas fisik ke Google Drive pusat (${activeEmail})...`, 300);
        const uploadResult = await uploadToGDrive(accessToken, fileToUpload, {
          name: autoFormattedFileName,
          parents: parentFolderId ? [parentFolderId] : [],
          description: metaStr,
        });
        realGDriveId = uploadResult.id;
        await pushLog(`SUKSES! Berkas fisik tersimpan di Google Drive pusat. ID: ${realGDriveId}`, 300);
      } catch (uploadErr: any) {
        console.error("Gdrive upload detail error:", uploadErr);
        const errMessage = uploadErr?.message || String(uploadErr) || "Unknown error";
        await pushLog(`Catatan GDrive: ${errMessage}. Proses dihentikan.`, 300);
        if (/401|403/.test(errMessage)) {
          clearGDriveToken();
          setDriveUserEmail(null);
          setDriveAccessToken(null);
          setDriveError("Token Google Drive kedaluwarsa atau tidak valid. Silakan hubungkan ulang akun admin.");
        } else {
          setDriveError(errMessage);
        }
        setUploadState("error");
        return;
      }
    } else {
      await pushLog("Google Drive belum terhubung. Data akan tetap dicatat, tetapi tidak akan diunggah ke Drive.", 250);
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
                    <span className={`text-white text-[9px] px-1.5 py-0.2 rounded-full uppercase tracking-wider font-extrabold ${isDriveConnected ? "bg-emerald-600" : "bg-amber-600"}`}>
                      {isDriveConnected ? "Aktif" : "Tidak Terhubung"}
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block mt-0.5">
                    {isDriveConnected
                      ? `Status: Terhubung sebagai ${driveUserEmail || "Akun Google Drive"}`
                      : isAdmin
                      ? "Status: Google Drive belum terhubung. Silakan hubungkan akun admin."
                      : "Status: Google Drive tidak tersambung. Gunakan akun admin yang terhubung terlebih dahulu."}
                  </span>
                  {driveError && (
                    <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50/80 p-3 text-[11px] text-amber-900 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-200">
                      <div className="font-semibold mb-1">Masalah Google Drive:</div>
                      <div className="whitespace-pre-wrap text-[11px]">{driveError}</div>
                    </div>
                  )}
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

        {uploadState === "error" && (
          <div className="py-6 flex flex-col items-center justify-center gap-4 text-center">
            <AlertCircle className="h-10 w-10 text-amber-500" />
            <div>
              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-2">Terjadi kesalahan saat upload Google Drive</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Pastikan akun Google Drive terhubung dan berikan izin akses Drive. Silakan coba lagi atau hubungi admin jika masalah berlanjut.
              </p>
            </div>
            {driveError && (
              <div className="w-full rounded-xl border border-amber-300 bg-amber-50/80 p-3 text-left text-[11px] text-amber-900 dark:border-amber-700 dark:bg-amber-950/20 dark:text-amber-200">
                <div className="font-semibold mb-1">Detail error:</div>
                <div className="whitespace-pre-wrap">{driveError}</div>
              </div>
            )}
            <div className="w-full bg-slate-950 text-slate-100 p-4 rounded-xl font-mono text-xs text-left h-48 overflow-y-auto border border-slate-800 shadow-inner">
              {syncLogs.map((log, i) => (
                <div key={i} className="mb-1 leading-relaxed whitespace-pre-wrap">
                  <span className="text-amber-400">{"> "}</span>
                  {log}
                </div>
              ))}
            </div>
            <button
              onClick={() => setUploadState("idle")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-bold"
            >
              Tutup dan Coba Lagi
            </button>
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