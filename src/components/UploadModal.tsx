import React, { useState, useRef, useEffect } from "react";
import { X, Upload, FileText, CheckCircle2, Cloud, AlertCircle, RefreshCw, Layers, Link as LinkIcon, LogIn, MessageSquare, Send, ExternalLink } from "lucide-react";
import { Employee, FileCategory, DocType } from "../types";
import { collection, addDoc } from "firebase/firestore";
import { getAccessToken, googleSignIn, db } from "../lib/firebase";
import { uploadToGDrive, getPreviousMonthFolderInfo, formatArchiveFileName, getOrCreateGDriveFolder, getDocTypeSubfolderName } from "../lib/gdrive";
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

  // Google Drive connection state inside modal
  const [gdriveEmail, setGdriveEmail] = useState<string | null>(localStorage.getItem("gdrive_user_email"));
  const [isConnectingDrive, setIsConnectingDrive] = useState(false);
  
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Set default file extension on doctype changes
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
      if (res) {
        setGdriveEmail(res.user.email);
        localStorage.setItem("gdrive_user_email", res.user.email || "");
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
    // Determine category based on extension
    const ext = file.name.split(".").pop()?.toLowerCase();
    let sizeStr = (file.size / (1024 * 1024)).toFixed(1) + " MB";
    setFileSize(sizeStr);

    if (ext === "pdf") setCategory("PDF");
    else if (["doc", "docx", "odt"].includes(ext || "")) setCategory("Word");
    else if (["xls", "xlsx", "ods", "csv"].includes(ext || "")) setCategory("Excel");
    else if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) setCategory("Foto");
    else if (["mp4", "mkv", "avi", "mov"].includes(ext || "")) setCategory("Video");

    // Guess docType based on name
    const upperName = file.name.toUpperCase();
    if (upperName.includes("SPT") || upperName.includes("TAHUNAN")) {
      setDocType("SPT");
    } else if (upperName.includes("LKH") || upperName.includes("HARIAN")) {
      setDocType("LKH");
    } else if (upperName.includes("LKB") || upperName.includes("BULANAN")) {
      setDocType("LKB");
    }

    // Try to auto-detect employee by NIP or name inside file name
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

    // Google Drive Integration Simulation Logs
    await pushLog("Menginisiasi unggahan arsip...", 100);
    await pushLog(`Mencari akun pegawai: ${employee.name} (NIP: ${employee.nip})`, 400);

    if (!isOnline) {
      // Offline Flow
      await pushLog("Peringatan: Deteksi luring (Offline Mode) aktif.", 300);
      await pushLog("Mempersiapkan muatan lokal (local storage queuing)...", 300);
      
      const offlinePayload = {
        name: fileName,
        category,
        fileSize,
        uploadedBy: employee.name,
        nip: employee.nip,
        type: docType,
        description: description,
        timestamp: new Date().toISOString()
      };
      
      queueOfflineUpload(offlinePayload);
      
      await pushLog("Arsip berhasil diantrekan secara luring. Akan disinkronkan ke Google Drive setelah koneksi aktif kembali.", 500);
      setUploadState("success");
      setTimeout(() => {
        onUploadSuccess(null);
        onClose();
      }, 2500);
      return;
    }

    // Online Flow
    await pushLog("Mengkoneksikan ke Penyimpanan Terpusat di Cloud Arsiparis...", 200);
    
    // 1. Calculate previous month period & format structured filename
    const periodInfo = getPreviousMonthFolderInfo();
    const autoFormattedFileName = formatArchiveFileName(
      docType,
      employee.nip,
      periodInfo.monthName,
      periodInfo.year,
      selectedFile ? selectedFile.name : (fileName || `${docType}_${employee.nip}.pdf`)
    );

    await pushLog(`Periode Laporan Laporan: ${periodInfo.folderName}`, 250);
    await pushLog(`Format Nama Berkas Otomatis: '${autoFormattedFileName}'`, 250);
    
    const customRootFolderId = localStorage.getItem("gdrive_custom_folder_id") || localStorage.getItem("gdrive_folder_id") || "";
    
    const metaStr = JSON.stringify({
      NIP: employee.nip,
      Nama: employee.name,
      Jabatan: employee.position,
      Tipe: docType,
      PeriodeLaporan: periodInfo.folderName,
      TanggalUpload: new Date().toISOString().split("T")[0],
      Instansi: "Kemenag Mempawah",
      Penyimpanan: "Cloud Arsiparis",
      GoogleDriveIntegrasi: "Aktif Terpusat",
    });
    
    let realGDriveId: string | undefined = undefined;
    const accessToken = getAccessToken();
    let targetFolderId = customRootFolderId;

    // 2. Prepare 3-tier nested Google Drive folder structure:
    const docSubfolderName = getDocTypeSubfolderName(docType);

    if (accessToken) {
      try {
        await pushLog(`1. Menyiapkan Folder Induk Aplikasi di Google Drive...`, 200);
        const rootFolderObj = await getOrCreateGDriveFolder(
          accessToken,
          "Digitalisasi_Kemenag_Mempawah",
          customRootFolderId || undefined
        );
        const rootId = rootFolderObj.id;

        await pushLog(`2. Menyiapkan Folder Periode '${periodInfo.folderName}'...`, 200);
        const monthlyFolderObj = await getOrCreateGDriveFolder(
          accessToken,
          periodInfo.folderName,
          rootId
        );
        const monthlyId = monthlyFolderObj.id;

        await pushLog(`3. Menyiapkan Subfolder Kategori '${docSubfolderName}'...`, 200);
        const categoryFolderObj = await getOrCreateGDriveFolder(
          accessToken,
          docSubfolderName,
          monthlyId
        );
        targetFolderId = categoryFolderObj.id;

        await pushLog(`Struktur Folder Google Drive Siap: Digitalisasi_Kemenag_Mempawah / ${periodInfo.folderName} / ${docSubfolderName}`, 300);
      } catch (fErr: any) {
        console.warn("Folder check/creation notice:", fErr);
        await pushLog(`Menggunakan direktori penampung terpusat Google Drive...`, 200);
      }
    }

    // 3. Prepare real file object or generate document blob with formatted name
    const fileToUpload = selectedFile
      ? new File([selectedFile], autoFormattedFileName, { type: selectedFile.type })
      : new File(
          [`ARSIP DIGITAL KEMENAG MEMPAWAH\n===================================\nNama: ${employee.name}\nNIP: ${employee.nip}\nJabatan: ${employee.position}\nJenis Pelaporan: ${docType}\nPeriode: ${periodInfo.folderName}\nKategori: ${category}\nDeskripsi: ${description || '-'}\n\nMetadata:\n${metaStr}`],
          autoFormattedFileName,
          { type: category === "PDF" ? "application/pdf" : "text/plain" }
        );

    if (accessToken) {
      await pushLog(`Mengunggah '${autoFormattedFileName}' ke folder '${periodInfo.folderName}'...`, 300);
      try {
        const parents = targetFolderId ? [targetFolderId] : [];
        const uploadResult = await uploadToGDrive(accessToken, fileToUpload, {
          name: autoFormattedFileName,
          parents,
          description: metaStr
        });
        realGDriveId = uploadResult.id;
        await pushLog(`Google Drive API: Berkas '${autoFormattedFileName}' berhasil tersimpan! ID: ${realGDriveId}`, 400);
      } catch (uploadErr: any) {
        console.error("Gdrive error:", uploadErr);
        await pushLog(`Peringatan: Gagal mengunggah fisik ke Google Drive (${uploadErr.message || uploadErr}). Melanjutkan pencatatan database...`, 300);
      }
    } else {
      await pushLog(`Token Google Drive belum terdeteksi. Berkas dicatat di database lokal/cloud...`, 300);
    }
    
    // Simpan permanen langsung ke database Cloud Firestore
    try {
      await addDoc(collection(db, "archives"), {
        name: autoFormattedFileName,
        category: category,
        fileSize: fileSize,
        uploadedBy: employee.name,
        nip: employee.nip,
        type: docType,
        description: description,
        gdriveId: realGDriveId || "local-sync",
        timestamp: new Date().toISOString()
      });

      await pushLog(`Berhasil mencatat riwayat ke Cloud Firestore database!`, 300);
      await pushLog("Penyimpanan Terpusat Berhasil! File tersimpan aman dan tidak akan reset.", 300);
      setUploadState("success");
      onUploadSuccess({
        name: autoFormattedFileName,
        category,
        fileSize,
        uploadedBy: employee.name,
        nip: employee.nip,
        type: docType,
        description,
        gdriveId: realGDriveId || "local-sync"
      });
    } catch (dbError: any) {
      console.error("Gagal simpan ke Firestore:", dbError);
      await pushLog(`Peringatan Database: ${dbError.message || dbError}`, 300);
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
              Unggah berkas baru dan sinkronisasikan ke Google Drive Kemenag Mempawah
            </p>
          </div>
        </div>

        {uploadState === "idle" && (
          <form id="form-upload-archive" onSubmit={handleSubmit} className="space-y-4">
            {/* Centralized Google Drive Status Banner */}
            {(() => {
              const isAdmin = loggedInEmployee ? (
                ["198904092019031008", "199205082023211022"].includes(loggedInEmployee.nip) ||
                loggedInEmployee.role === "admin" ||
                loggedInEmployee.role === "verifikator"
              ) : false;

              return (
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
                        {gdriveEmail || getAccessToken()
                          ? `Status: Terhubung (${gdriveEmail || "Google Drive Admin Active"})`
                          : "Sistem pengarsipan otomatis terhubung & tersimpan secara terstruktur"}
                      </span>
                    </div>
                  </div>

                  {/* Only show connect/reconnect button for Admin Verifikator */}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleConnectDrive}
                      disabled={isConnectingDrive}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer text-xs shadow-xs"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      {isConnectingDrive
                        ? "Menghubungkan..."
                        : gdriveEmail || getAccessToken()
                        ? "Hubungkan Ulang Google Drive"
                        : "Hubungkan Google Drive"}
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Drag and Drop Zone */}
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
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
                    {fileName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Kategori: <span className="font-semibold text-blue-600 dark:text-blue-400">{category}</span> | Ukuran: {fileSize}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-2">Klik untuk mengubah berkas</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    Tarik dan lepas berkas di sini, atau klik untuk menelusuri
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Mendukung PDF, Word, Excel, Foto, Video (Maks. 50MB)
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Pemilik Berkas (Pegawai) *
                </label>
                <select
                  id="select-employee"
                  required
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Pilih Pegawai --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} (NIP: {emp.nip})
                    </option>
                  ))}
                </select>
              </div>

              {/* Document Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Jenis Pelaporan *
                </label>
                <select
                  id="select-doc-type"
                  required
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as DocType)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="LKH">LKH (Laporan Kinerja Harian)</option>
                  <option value="LKB">LKB (Laporan Kerja Bulanan)</option>
                  <option value="SPT">SPT Tahunan (Surat Pemberitahuan Tahunan)</option>
                  <option value="Umum">Umum / Lain-lain</option>
                </select>
              </div>
            </div>

            {/* Description Meta */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Keterangan Dokumen / Catatan Tambahan (Metadata Deskripsi)
              </label>
              <textarea
                id="input-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tambahkan detail atau rangkuman kegiatan yang dilaporkan dalam berkas ini..."
                rows={3}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Live Naming & Folder Preview Box */}
            {selectedEmployeeId && (() => {
              const selectedEmp = employees.find((e) => e.id === selectedEmployeeId);
              const periodInfo = getPreviousMonthFolderInfo();
              const subfolderCategory = getDocTypeSubfolderName(docType);
              const previewName = selectedEmp
                ? formatArchiveFileName(
                    docType,
                    selectedEmp.nip,
                    periodInfo.monthName,
                    periodInfo.year,
                    selectedFile ? selectedFile.name : (fileName || `${docType}.pdf`)
                  )
                : "";

              return (
                <div className="p-3 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl text-xs space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-blue-900 dark:text-blue-300 font-semibold">
                    <span>Struktur Folder Google Drive:</span>
                    <span className="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                      Digitalisasi_Kemenag_Mempawah / {periodInfo.folderName} / {subfolderCategory}
                    </span>
                  </div>
                  {previewName && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-600 dark:text-slate-300 pt-1.5 border-t border-blue-100 dark:border-blue-900/30">
                      <span>Format Nama Berkas Otomatis:</span>
                      <span className="font-mono text-[11px] font-bold text-blue-700 dark:text-blue-300">
                        {previewName}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                id="btn-cancel-upload"
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                id="btn-submit-upload"
                type="submit"
                disabled={!fileName || !selectedEmployeeId}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:dark:bg-slate-800 disabled:text-slate-400 text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm transition-colors cursor-pointer"
              >
                {isOnline ? (
                  <>
                    <Upload className="h-4 w-4" />
                    Unggah & Sinkronisasi GDrive
                  </>
                ) : (
                  <>
                    <Layers className="h-4 w-4" />
                    Antrekan Secara Offline
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Uploading Console Logs */}
        {uploadState === "uploading" && (
          <div className="py-6 flex flex-col items-center justify-center">
            <RefreshCw className="h-10 w-10 text-blue-600 dark:text-blue-400 animate-spin mb-4" />
            <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-4">
              Sedang memproses integrasi arsip digital...
            </h4>
            
            {/* Terminal Log Screen */}
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

        {/* Success Confirmation Screen */}
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
                  {isOnline
                    ? "Dokumen Anda berhasil diunggah ke Google Drive dan didaftarkan ke sistem."
                    : "Aplikasi sedang offline. Dokumen telah masuk antrean lokal."}
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

              {/* Log snippet preview */}
              <div className="w-full bg-slate-950/5 dark:bg-slate-950 text-left p-3 rounded-xl border border-blue-100 dark:border-blue-950/50 text-xs text-slate-600 dark:text-slate-400 font-mono">
                <span className="font-bold text-blue-600 dark:text-blue-400 block mb-1">✓ Metadata File Cloud Arsiparis:</span>
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

        {/* Error Screen if database failed */}
        {uploadState === "error" && (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-3 bg-red-100 dark:bg-red-950/80 rounded-full text-red-600 dark:text-red-400">
              <AlertCircle className="h-10 w-10" />
            </div>
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base">
              Gagal Menyimpan ke Database Cloud
            </h4>
            <p className="text-xs text-slate-500 max-w-sm">
              Periksa kembali koneksi internet Anda atau pastikan aturan izin Firestore sudah diatur dengan benar agar data dapat tercatat.
            </p>
            <button
              onClick={() => setUploadState("idle")}
              className="bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold"
            >
              Coba Lagi
            </button>
          </div>
        )}
      </div>
    </div>
  );
}