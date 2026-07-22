import { useState } from "react";
import { Search, Filter, FileText, Download, Eye, Calendar, User, ExternalLink, HardDrive, CheckCircle2, Lock, ShieldCheck, ShieldAlert } from "lucide-react";
import { ArchiveFile, FileCategory, DocType, Employee } from "../types";

interface ArchiveHistoryProps {
  archives: ArchiveFile[];
  currentUser?: Employee | null;
}

export default function ArchiveHistory({ archives, currentUser }: ArchiveHistoryProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"All" | FileCategory>("All");
  const [selectedDocType, setSelectedDocType] = useState<"All" | DocType>("All");
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  const isAdmin = currentUser ? (
    ["198904092019031008", "199205082023211022"].includes(currentUser.nip) ||
    currentUser.role === "admin" ||
    currentUser.role === "verifikator"
  ) : false;

  // Filter archives
  const filteredArchives = archives.filter((file) => {
    const matchesSearch =
      file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.uploadedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.nip.includes(searchQuery);

    const matchesCategory = selectedCategory === "All" || file.category === selectedCategory;
    const matchesDocType = selectedDocType === "All" || file.type === selectedDocType;

    return matchesSearch && matchesCategory && matchesDocType;
  });

  return (
    <div id="archive-history-tab" className="space-y-6">
      {/* Privacy Mode Info Banner */}
      <div className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 shadow-2xs ${
        isAdmin
          ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200"
          : "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl shrink-0 text-white ${isAdmin ? "bg-emerald-600" : "bg-amber-600"}`}>
            {isAdmin ? <ShieldCheck className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </div>
          <div>
            <h5 className="font-bold text-sm">
              {isAdmin ? "Mode Otorisasi Admin Verifikator" : "Aturan Privasi Dokumen Kearsipan"}
            </h5>
            <p className="mt-0.5 leading-relaxed text-[11px] opacity-90">
              {isAdmin
                ? "Sebagai Admin Verifikator, Anda memiliki otorisasi penuh untuk memeriksa, membuka, dan mengunduh seluruh arsip dokumen pegawai."
                : `Anda login sebagai ${currentUser?.name || "Pegawai"}. Anda hanya dapat membuka dan mengunduh berkas LKH/LKB milik Anda sendiri. Berkas milik pegawai lain dilindungi oleh sistem privasi.`}
            </p>
          </div>
        </div>
      </div>

      {/* 1. Filter Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-xs space-y-4">
        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
          <Filter className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
          Filter & Pencarian Arsip
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Text Search */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Cari Berkas</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                id="search-archives"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nama file, pegawai, NIP..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Format Berkas</label>
            <select
              id="filter-category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">Semua Format (PDF, Word, dll)</option>
              <option value="PDF">PDF (Dokumen)</option>
              <option value="Word">Word (Dokumen)</option>
              <option value="Excel">Excel (Tabel/Laporan)</option>
              <option value="Foto">Foto / JPG / PNG</option>
              <option value="Video">Video / MP4</option>
            </select>
          </div>

          {/* Doc Type Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Kategori Pelaporan</label>
            <select
              id="filter-doctype"
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value as any)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="All">Semua Jenis Laporan</option>
              <option value="LKH">LKH (Laporan Kinerja Harian)</option>
              <option value="LKB">LKB (Laporan Kerja Bulanan)</option>
              <option value="SPT">SPT Tahunan</option>
              <option value="Umum">Umum / Dokumentasi</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. File List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/10">
          <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
            Riwayat Digitalisasi Dokumen ({filteredArchives.length} Berkas)
          </h4>
          <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold px-2.5 py-1 rounded-full font-mono">
            PRIVACY & LOCK PROTECTED
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-850">
          {filteredArchives.length > 0 ? (
            filteredArchives.map((file) => {
              const fileColors: Record<string, string> = {
                PDF: "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50",
                Word: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50",
                Excel: "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50",
                Foto: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50",
                Video: "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/50",
              };

              const isOwner = currentUser
                ? (file.nip === currentUser.nip || file.uploadedBy.toLowerCase() === currentUser.name.toLowerCase())
                : false;

              const canAccessFile = isAdmin || isOwner;

              return (
                <div key={file.id} id={`archive-file-${file.id}`} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-all">
                  <div
                    onClick={() => setActiveFileId(activeFileId === file.id ? null : file.id)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      {/* Format tag circle */}
                      <div className={`h-11 w-11 rounded-xl border flex flex-col items-center justify-center font-black text-[10px] tracking-wide ${fileColors[file.category] || "bg-slate-50 text-slate-600"}`}>
                        <span>{file.category}</span>
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h5 className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm">
                            {file.name}
                          </h5>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-sm ${
                            file.type === "LKH"
                              ? "bg-blue-50 dark:bg-blue-950/45 text-blue-750 dark:text-blue-400"
                              : file.type === "LKB"
                              ? "bg-blue-50/70 dark:bg-blue-950 text-blue-700 dark:text-blue-400"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}>
                            {file.type}
                          </span>

                          {!canAccessFile && (
                            <span className="flex items-center gap-1 text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800">
                              <Lock className="h-3 w-3" /> Privasi Terkunci
                            </span>
                          )}
                          {isOwner && !isAdmin && (
                            <span className="text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                              Berkas Anda
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 dark:text-slate-400 text-xs font-medium">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3 text-slate-400" />
                            {file.uploadedBy}
                          </span>
                          <span className="hidden sm:inline font-mono text-[11px]">NIP: {file.nip}</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {new Date(file.createdAt).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric"
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-slate-500 dark:text-slate-400 font-mono">
                      <span>{file.fileSize}</span>
                      {canAccessFile ? (
                        <Eye className="h-4 w-4 text-slate-400 hover:text-blue-600 transition-colors" />
                      ) : (
                        <Lock className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                  </div>

                  {/* Google Drive detailed metadata preview or Privacy Locked Notice */}
                  {activeFileId === file.id && (
                    canAccessFile ? (
                      <div id={`gdrive-preview-${file.id}`} className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-150 grid grid-cols-1 md:grid-cols-5 gap-4">
                        {/* Left: Metadata details */}
                        <div className="md:col-span-3 space-y-3 bg-slate-50/50 dark:bg-slate-950/20 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <HardDrive className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <h6 className="font-bold text-xs text-slate-700 dark:text-slate-200">
                              Penyimpanan Terintegrasi Google Drive API
                            </h6>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">ID Berkas Google Drive</span>
                              <span className="font-mono text-slate-700 dark:text-slate-300 select-all font-bold text-[11px] block truncate" title={file.gdriveId}>
                                {file.gdriveId}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Status Sinkronisasi</span>
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                TER-SINKRONISASI
                              </span>
                            </div>
                          </div>

                          <div className="pt-2">
                            <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-1">Deksripsi File Metadata (Kemenag Schema)</span>
                            <div className="bg-slate-900 text-slate-300 p-3 rounded-lg font-mono text-[10px] overflow-x-auto leading-relaxed border border-slate-800">
                              {file.description}
                            </div>
                          </div>
                        </div>

                        {/* Right: Quick actions */}
                        <div className="md:col-span-2 flex flex-col justify-between border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
                          <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                            <span className="font-bold block text-slate-700 dark:text-slate-300">Aksi Dokumen</span>
                            <p>Gunakan tombol di bawah ini untuk mensimulasikan pratinjau langsung atau pengunduhan file dari server Google Drive.</p>
                          </div>

                          <div className="flex flex-col gap-2 pt-3">
                            <a
                              id="gdrive-preview-btn"
                              href={`https://drive.google.com/open?id=${file.gdriveId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 rounded-lg transition-colors shadow-3xs"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Buka di Google Drive
                            </a>
                            <button
                              id="download-preview-btn"
                              onClick={() => alert(`Simulasi Mengunduh file "${file.name}" dari API Google Drive.`)}
                              className="flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs py-2 rounded-lg transition-colors"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Simulasi Download
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 p-4 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs space-y-2 animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold">
                          <ShieldAlert className="h-4.5 w-4.5 text-amber-600 shrink-0" />
                          <span>Berkas Dibatasi Aturan Privasi Pegawai</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                          Dokumen ini diunggah oleh <strong>{file.uploadedBy}</strong> (NIP: {file.nip}). Demi menjaga privasi kearsipan laporan kinerja, berkas ini hanya dapat dibuka dan diunduh oleh <strong>Admin Verifikator</strong> atau pemilik berkas yang bersangkutan.
                        </p>
                      </div>
                    )
                  )}
                </div>
              );
            })
          ) : (
            <div id="no-archives" className="py-12 text-center">
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">Tidak Ada Arsip Ditemukan</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Ubah filter kata kunci atau tambahkan dokumen baru.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
