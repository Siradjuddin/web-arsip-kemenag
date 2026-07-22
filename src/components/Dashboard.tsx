import React, { useState } from "react";
import { FileText, Users, FolderCheck, Calendar, ArrowRight, BellRing, Smartphone, Info, AlertTriangle } from "lucide-react";
import { AnalyticsStats, Employee } from "../types";

interface DashboardProps {
  stats: AnalyticsStats;
  onNavigate: (tab: string) => void;
  onTriggerNotification: (title: string, body: string, type: "info" | "success" | "warning") => void;
  currentUser?: Employee | null;
}

export default function Dashboard({ stats, onNavigate, onTriggerNotification, currentUser }: DashboardProps) {
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);
  const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);
  const [customNotifTitle, setCustomNotifTitle] = useState("");
  const [customNotifBody, setCustomNotifBody] = useState("");

  const lkhPercentage = stats.totalEmployees > 0 
    ? Math.round((stats.completedLkhToday / stats.totalEmployees) * 100) 
    : 0;

  const lkbPercentage = stats.totalEmployees > 0 
    ? Math.round((stats.completedLkbMonth / stats.totalEmployees) * 100) 
    : 0;

  // Render SVG Area/Line Chart for last 7 days upload trend
  const renderTrendChart = () => {
    const data = stats.monthlyUploadTrend;
    const maxVal = Math.max(...data.map(d => d.count), 4);
    const width = 500;
    const height = 150;
    const padding = 25;

    // Map data points
    const points = data.map((d, i) => {
      const x = padding + (i * (width - padding * 2)) / (data.length - 1);
      const y = height - padding - (d.count / maxVal) * (height - padding * 2);
      return { x, y, label: d.label, count: d.count };
    });

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    
    // Create closed path for area fill
    const areaPath = points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
      : "";

    return (
      <div id="trend-chart-container" className="relative w-full h-[180px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          {/* Grid lines */}
          {[0, 0.5, 1].map((ratio, idx) => {
            const y = padding + ratio * (height - padding * 2);
            const gridVal = Math.round(maxVal * (1 - ratio));
            return (
              <g key={idx}>
                <line
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  className="stroke-slate-100 dark:stroke-slate-800"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding - 5}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-400 dark:fill-slate-500 font-mono text-[9px]"
                >
                  {gridVal}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          {areaPath && (
            <path
              d={areaPath}
              className="fill-blue-500/10 dark:fill-blue-500/5"
            />
          )}

          {/* Line Path */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              className="stroke-blue-600 dark:stroke-blue-400"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Nodes */}
          {points.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={hoveredLineIndex === i ? "6" : "4"}
                className="fill-blue-600 dark:fill-blue-400 stroke-white dark:stroke-slate-900 transition-all cursor-pointer"
                strokeWidth="1.5"
                onMouseEnter={() => setHoveredLineIndex(i)}
                onMouseLeave={() => setHoveredLineIndex(null)}
              />
              <text
                x={p.x}
                y={height - 5}
                textAnchor="middle"
                className="fill-slate-500 dark:fill-slate-400 text-[10px]"
              >
                {p.label}
              </text>
            </g>
          ))}
        </svg>

        {/* Dynamic Tooltip */}
        {hoveredLineIndex !== null && (
          <div
            id="trend-chart-tooltip"
            className="absolute bg-slate-950 text-white text-[10px] px-2.5 py-1.5 rounded-lg shadow-md font-mono border border-slate-800 transition-all pointer-events-none"
            style={{
              left: `${(hoveredLineIndex / (data.length - 1)) * 82 + 8}%`,
              top: `${points[hoveredLineIndex].y - 35}px`,
            }}
          >
            <span className="font-bold">{data[hoveredLineIndex].label}</span>
            <span className="block text-blue-400">{data[hoveredLineIndex].count} Arsip</span>
          </div>
        )}
      </div>
    );
  };

  // Render SVG Horizontal Bar Chart for file categories
  const renderCategoryChart = () => {
    const categories = Object.keys(stats.categoryDistribution) as (keyof typeof stats.categoryDistribution)[];
    const values = categories.map(cat => stats.categoryDistribution[cat]);
    const maxVal = Math.max(...values, 1);

    return (
      <div id="category-chart" className="space-y-3.5">
        {categories.map((cat, idx) => {
          const val = stats.categoryDistribution[cat];
          const pct = Math.max((val / maxVal) * 100, 3); // Minimum bar length

          // Dynamic category colors
          const barColors: Record<string, string> = {
            PDF: "bg-rose-500 dark:bg-rose-600",
            Word: "bg-blue-500 dark:bg-blue-600",
            Excel: "bg-emerald-500 dark:bg-emerald-600",
            Foto: "bg-amber-500 dark:bg-amber-600",
            Video: "bg-indigo-500 dark:bg-indigo-600",
          };

          return (
            <div key={idx} className="flex items-center gap-3">
              <span className="w-12 text-xs font-semibold text-slate-600 dark:text-slate-400 text-left font-mono">{cat}</span>
              <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-6 rounded-md overflow-hidden relative">
                <div
                  className={`h-full ${barColors[cat]} rounded-r-sm transition-all duration-1000 ease-out`}
                  style={{ width: `${pct}%` }}
                  onMouseEnter={() => setHoveredBar(cat)}
                  onMouseLeave={() => setHoveredBar(null)}
                />
                
                {/* Embedded count label */}
                <span className="absolute right-2 top-0.5 font-bold font-mono text-[11px] text-slate-700 dark:text-slate-300">
                  {val} Berkas
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const isAdmin = currentUser
    ? ["198904092019031008", "199205082023211022"].includes(currentUser.nip) ||
      currentUser.role === "admin" ||
      currentUser.role === "verifikator"
    : false;

  const handleSimulateFcm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customNotifTitle || !customNotifBody) return;
    onTriggerNotification(customNotifTitle, customNotifBody, "info");
    setCustomNotifTitle("");
    setCustomNotifBody("");
  };

  return (
    <div id="dashboard-tab-content" className="space-y-6">
      {/* Cancellation Notice Banner for Logged In Employee */}
      {currentUser && (
        (currentUser.lkhStatus === "pending" && currentUser.lkhCancelNote) ||
        (currentUser.lkbStatus === "pending" && currentUser.lkbCancelNote) ||
        (currentUser.sptStatus === "pending" && currentUser.sptCancelNote)
      ) && (
        <div id="cancellation-alert-banner" className="bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 p-4 rounded-2xl text-rose-900 dark:text-rose-200 shadow-md flex flex-col sm:flex-row items-start gap-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2.5 bg-rose-600 text-white rounded-xl shrink-0 shadow-xs">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1.5 flex-1">
            <h3 className="font-extrabold text-sm text-rose-800 dark:text-rose-300 flex items-center gap-2">
              <span>Perhatian: Verifikasi Laporan Anda Dibatalkan oleh Admin</span>
            </h3>
            {currentUser.lkhStatus === "pending" && currentUser.lkhCancelNote && (
              <div className="text-xs bg-white/90 dark:bg-slate-900/90 p-3 rounded-xl border border-rose-200 dark:border-rose-900/50 space-y-0.5">
                <span className="font-bold text-rose-700 dark:text-rose-400 block">Catatan Pembatalan Verifikasi LKH (Harian):</span>
                <p className="italic font-medium text-slate-800 dark:text-slate-200">"{currentUser.lkhCancelNote}"</p>
              </div>
            )}
            {currentUser.lkbStatus === "pending" && currentUser.lkbCancelNote && (
              <div className="text-xs bg-white/90 dark:bg-slate-900/90 p-3 rounded-xl border border-rose-200 dark:border-rose-900/50 space-y-0.5">
                <span className="font-bold text-rose-700 dark:text-rose-400 block">Catatan Pembatalan Verifikasi LKB (Bulanan):</span>
                <p className="italic font-medium text-slate-800 dark:text-slate-200">"{currentUser.lkbCancelNote}"</p>
              </div>
            )}
            {currentUser.sptStatus === "pending" && currentUser.sptCancelNote && (
              <div className="text-xs bg-white/90 dark:bg-slate-900/90 p-3 rounded-xl border border-rose-200 dark:border-rose-900/50 space-y-0.5">
                <span className="font-bold text-rose-700 dark:text-rose-400 block">Catatan Pembatalan Verifikasi SPT Tahunan:</span>
                <p className="italic font-medium text-slate-800 dark:text-slate-200">"{currentUser.sptCancelNote}"</p>
              </div>
            )}
            <p className="text-[11px] text-rose-700 dark:text-rose-300 font-semibold pt-0.5">
              Silakan lakukan perbaikan berkas dan unggah ulang laporan revisi Anda melalui menu "Digitalisasi Berkas".
            </p>
          </div>
        </div>
      )}

      {/* 1. Bento Grid Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pegawai Card */}
        <div id="stat-card-total-employees" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Total Pegawai</span>
            <span className="text-3xl font-black text-slate-800 dark:text-slate-100 mt-1 block font-sans">{stats.totalEmployees}</span>
            <p className="text-[11px] text-slate-400 mt-1">Aktif di Kemenag Mempawah</p>
          </div>
          <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400">
            <Users className="h-6 w-6" />
          </div>
        </div>

        {/* LKH Today Card */}
        <div id="stat-card-lkh" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between border-l-4 border-l-green-500">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">LKH Terverifikasi</span>
            <span className="text-3xl font-black text-slate-800 dark:text-slate-100 mt-1 block font-sans">
              {stats.completedLkhToday} <span className="text-sm font-medium text-slate-400">/ {stats.totalEmployees}</span>
            </span>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">{lkhPercentage}% Terverifikasi hari ini</span>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400">
            <FolderCheck className="h-6 w-6" />
          </div>
        </div>

        {/* LKB This Month Card */}
        <div id="stat-card-lkb" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between border-l-4 border-l-blue-500">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">LKB Terverifikasi</span>
            <span className="text-3xl font-black text-slate-800 dark:text-slate-100 mt-1 block font-sans">
              {stats.completedLkbMonth} <span className="text-sm font-medium text-slate-400">/ {stats.totalEmployees}</span>
            </span>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold">{lkbPercentage}% Terverifikasi bulan ini</span>
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400">
            <Calendar className="h-6 w-6" />
          </div>
        </div>

        {/* Total Archives Card */}
        <div id="stat-card-total-archives" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Total Arsip</span>
            <span className="text-3xl font-black text-slate-800 dark:text-slate-100 mt-1 block font-sans">{stats.totalArchives}</span>
            <p className="text-[11px] text-slate-400 mt-1">Berkas tersinkronisasi</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            <FileText className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* 2. Visual Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Google Drive Upload Trend Chart */}
        <div id="chart-panel-uploads" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Tren Sinkronisasi Google Drive</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">Aktivitas unggahan berkas dalam 7 hari terakhir</p>
            </div>
          </div>
          {renderTrendChart()}
        </div>

        {/* Categories Distribution Bar Chart */}
        <div id="chart-panel-categories" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs lg:col-span-2">
          <div className="mb-4">
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Statistik Kategori Dokumen</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Distribusi arsip berdasarkan tipe format file</p>
          </div>
          {renderCategoryChart()}
        </div>
      </div>

      {/* 3. Real-Time Push Notification (FCM Broadcast Panel for Admin) & Fast Nav */}
      <div className={`grid grid-cols-1 ${isAdmin ? "lg:grid-cols-2" : ""} gap-6`}>
        {/* FCM Push Notification Broadcast (Khusus Admin Verifikator) */}
        {isAdmin && (
          <div id="fcm-broadcast-panel" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">Pusat Siaran Notifikasi FCM (Admin Verifikator)</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Kirim pemberitahuan siaran resmi secara real-time ke seluruh pengguna & running text footer</p>
              </div>
            </div>

            <form id="form-fcm-broadcast" onSubmit={handleSimulateFcm} className="space-y-3.5">
              <div>
                <input
                  id="fcm-title"
                  type="text"
                  required
                  value={customNotifTitle}
                  onChange={(e) => setCustomNotifTitle(e.target.value)}
                  placeholder="Judul Siaran (cth: Batas Akhir Pelaporan LKH Hari Ini)"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <textarea
                  id="fcm-body"
                  required
                  value={customNotifBody}
                  onChange={(e) => setCustomNotifBody(e.target.value)}
                  placeholder="Tuliskan isi siaran notifikasi yang akan ditampilkan pada running text footer dan seluruh akun pengguna..."
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex justify-end">
                <button
                  id="btn-send-fcm"
                  type="submit"
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  <BellRing className="h-3.5 w-3.5" />
                  Kirim Siaran Notifikasi FCM
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Fast Action Board */}
        <div id="fast-actions-panel" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1.5">Akses Navigasi Terpadu</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Lakukan monitoring kedisiplinan pelaporan secara real-time atau unggah berkas fisik ke awan.
            </p>

            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-teal-50/50 dark:bg-teal-950/10 border border-teal-100 dark:border-teal-950/40 text-xs">
                <Info className="h-4 w-4 text-teal-600 dark:text-teal-400 flex-shrink-0 mt-0.5" />
                <span className="text-teal-800 dark:text-teal-300">
                  Data yang Anda perbarui di sini akan langsung disinkronkan ke Google Drive API dan database pusat Kemenag.
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              id="btn-nav-monitoring"
              onClick={() => onNavigate("monitoring")}
              className="flex-1 flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-bold text-xs py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              Monitor Kedisiplinan
              <ArrowRight className="h-3 w-3" />
            </button>
            <button
              id="btn-nav-archives"
              onClick={() => onNavigate("arsip")}
              className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              Buka Riwayat Arsip
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
