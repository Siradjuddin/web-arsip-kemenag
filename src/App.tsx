import { useEffect, useState, useCallback, useRef } from "react";
import { LayoutDashboard, Users, User, Archive, Settings, Plus, Sun, Moon, Bell, ShieldCheck, BookOpen, Fingerprint, Cloud, LogIn, LogOut, CheckCircle2, Folder, FolderPlus, HelpCircle, Clock, Timer, FileText, MessageSquare } from "lucide-react";
import { Employee, ArchiveFile, AppNotification, AnalyticsStats } from "./types";

import Dashboard from "./components/Dashboard";
import EmployeeMonitoring from "./components/EmployeeMonitoring";
import ArchiveHistory from "./components/ArchiveHistory";
import BiometricAuth from "./components/BiometricAuth";
import OfflineSyncIndicator from "./components/OfflineSyncIndicator";
import UploadModal from "./components/UploadModal";
import NotificationCenter from "./components/NotificationCenter";
import LoginScreen from "./components/LoginScreen";
import UserProfile from "./components/UserProfile";
import WhatsAppNotifModal from "./components/WhatsAppNotifModal";

import { clearGDriveToken, googleSignIn, logout as googleSignOut, getAccessToken } from "./lib/firebase";
import { listGDriveFolders, createGDriveFolder, GDriveFolder } from "./lib/gdrive";

import { collection, onSnapshot, addDoc, query, orderBy } from "firebase/firestore";
import { db } from "./lib/firebase";
export default function App() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [archives, setArchives] = useState<ArchiveFile[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [stats, setStats] = useState<AnalyticsStats>({
    totalEmployees: 0,
    completedLkhToday: 0,
    pendingLkhToday: 0,
    completedLkbMonth: 0,
    pendingLkbMonth: 0,
    totalArchives: 0,
    categoryDistribution: { PDF: 0, Word: 0, Excel: 0, Foto: 0, Video: 0 },
    monthlyUploadTrend: []
  });

  const [isUnlocked, setIsUnlocked] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isWaHeaderModalOpen, setIsWaHeaderModalOpen] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  const [darkMode, setDarkMode] = useState(false);// ==========================================
  // PENDENGAR OTOMATIS DATABASE FIRESTORE
  // ==========================================
  useEffect(() => {
    const q = query(collection(db, "archives"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const archivesData: ArchiveFile[] = [];
      snapshot.forEach((doc) => {
        archivesData.push({ id: doc.id, ...doc.data() } as ArchiveFile);
      });
      
      // 1. Mengisi daftar arsip dari database
      setArchives(archivesData);
      
      // 2. Mengubah angka 0 di statistik menjadi hitungan asli dari database
      setStats((prevStats) => ({
        ...prevStats,
        totalArchives: archivesData.length,
        completedLkhToday: archivesData.filter(a => a.type === 'LKH').length,
        completedLkbMonth: archivesData.filter(a => a.type === 'LKB').length,
      }));
    });

    return () => unsubscribe();
  }, []);

  // Employee Login & Session Management States
  const [loggedInEmployee, setLoggedInEmployee] = useState<Employee | null>(() => {
    const saved = localStorage.getItem("kemenag_logged_in_employee");
    return saved ? JSON.parse(saved) : null;
  });
  const [autoLogoutTime, setAutoLogoutTime] = useState<number>(() => {
    const saved = localStorage.getItem("kemenag_auto_logout_time");
    return saved ? parseInt(saved, 10) : 300; // default 5 minutes (300s)
  });
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    const savedTime = localStorage.getItem("kemenag_auto_logout_time");
    return savedTime ? parseInt(savedTime, 10) : 300;
  });
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());

  // Google Drive integration states
  const [gdriveUserEmail, setGdriveUserEmail] = useState<string | null>(localStorage.getItem("gdrive_user_email"));
  const [gdriveFolders, setGdriveFolders] = useState<GDriveFolder[]>([]);
  const [gdriveFolderId, setGdriveFolderId] = useState<string>(localStorage.getItem("gdrive_folder_id") || "");
  const [gdriveFolderName, setGdriveFolderName] = useState<string>(localStorage.getItem("gdrive_folder_name") || "");
  const [gdriveCustomFolderId, setGdriveCustomFolderId] = useState<string>(localStorage.getItem("gdrive_custom_folder_id") || "");
  const [isFetchingFolders, setIsFetchingFolders] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>("");
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);

  // Load and apply dark mode
  useEffect(() => {
    const savedDark = localStorage.getItem("kemenag_dark_mode") === "true";
    setDarkMode(savedDark);
    if (savedDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Load offline queue
    const queued = localStorage.getItem("kemenag_offline_queue");
    if (queued) {
      setOfflineQueue(JSON.parse(queued));
    }

    // Check biometric lock
    const biometricLockEnabled = localStorage.getItem("kemenag_biometric_enabled") === "true";
    if (biometricLockEnabled) {
      setIsUnlocked(false);
    } else {
      setIsUnlocked(true);
    }

    // Handle online/offline event detection
    const handleOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", handleOnlineStatus);
    window.addEventListener("offline", handleOnlineStatus);

    return () => {
      window.removeEventListener("online", handleOnlineStatus);
      window.removeEventListener("offline", handleOnlineStatus);
    };
  }, []);

  const toggleDarkMode = () => {
    const newVal = !darkMode;
    setDarkMode(newVal);
    localStorage.setItem("kemenag_dark_mode", String(newVal));
    if (newVal) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Fetch full state from backend
  const fetchData = useCallback(async () => {
    try {
      const empRes = await fetch("/api/pegawai");
      const empData = await empRes.json();
      setEmployees(empData);

      const archRes = await fetch("/api/arsip");
      const archData = await archRes.json();
      setArchives(archData);

      const notifRes = await fetch("/api/notifications");
      const notifData = await notifRes.json();
      setNotifications(notifData);

      const statsRes = await fetch("/api/stats");
      const statsData = await statsRes.json();
      setStats(statsData);
    } catch (err) {
      console.error("Gagal mengambil data dari server:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Google Drive Action Handlers
  const loadGDriveFolders = useCallback(async (token?: string) => {
    const activeToken = token || getAccessToken();
    if (!activeToken) return;
    setIsFetchingFolders(true);
    try {
      const list = await listGDriveFolders(activeToken);
      setGdriveFolders(list);
    } catch (err) {
      console.error("Gagal memuat folder Google Drive:", err);
    } finally {
      setIsFetchingFolders(false);
    }
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      clearGDriveToken();
      const res = await googleSignIn();
      if (res) {
        setGdriveUserEmail(res.user.email);
        localStorage.setItem("gdrive_user_email", res.user.email || "");
        handleTriggerFcm("Google Drive Terhubung", `Akun ${res.user.email} berhasil diotentikasi.`, "success");
        await loadGDriveFolders(res.accessToken);
      }
    } catch (err: any) {
      console.error("Sign in error:", err);
      handleTriggerFcm("Otentikasi Gagal", `Gagal menghubungkan Google Drive: ${err.message || err}`, "warning");
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await googleSignOut();
      clearGDriveToken();
      setGdriveUserEmail(null);
      setGdriveFolders([]);
      localStorage.removeItem("gdrive_user_email");
      handleTriggerFcm("Google Drive Terputus", "Koneksi Google Drive telah diputus.", "info");
    } catch (err: any) {
      console.error("Sign out error:", err);
    }
  };

  const handleCreateFolder = async () => {
    const token = getAccessToken();
    if (!token || !newFolderName.trim()) return;
    setIsCreatingFolder(true);
    try {
      const folder = await createGDriveFolder(token, newFolderName.trim());
      setGdriveFolderId(folder.id);
      setGdriveFolderName(folder.name);
      localStorage.setItem("gdrive_folder_id", folder.id);
      localStorage.setItem("gdrive_folder_name", folder.name);
      setNewFolderName("");
      handleTriggerFcm("Folder Baru Dibuat", `Folder '${folder.name}' berhasil dibuat di Google Drive.`, "success");
      await loadGDriveFolders(token);
    } catch (err: any) {
      console.error("Create folder error:", err);
      handleTriggerFcm("Gagal Membuat Folder", err.message || "Terjadi kesalahan", "warning");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  useEffect(() => {
    const token = getAccessToken();
    if (token && gdriveUserEmail) {
      loadGDriveFolders(token);
    }
  }, [gdriveUserEmail, loadGDriveFolders]);

  // Bulk sync offline changes to server
  const triggerSync = useCallback(async () => {
    if (offlineQueue.length === 0 || !navigator.onLine) return;
    setIsSyncing(true);
    
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncItems: offlineQueue })
      });

      if (res.ok) {
        // Clear offline queue
        setOfflineQueue([]);
        localStorage.removeItem("kemenag_offline_queue");
        await fetchData();
      }
    } catch (err) {
      console.error("Kesalahan sinkronisasi luring:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [offlineQueue, fetchData]);

  // Queue upload/toggle operations offline
  const queueOfflineUpload = (payload: any) => {
    const updatedQueue = [...offlineQueue, { id: `offline-${Date.now()}`, action: "upload", payload, timestamp: new Date().toISOString() }];
    setOfflineQueue(updatedQueue);
    localStorage.setItem("kemenag_offline_queue", JSON.stringify(updatedQueue));
    
    // Optimistic UI updates
    const tempFile: ArchiveFile = {
      id: `offline-temp-${Date.now()}`,
      name: payload.name,
      category: payload.category,
      fileSize: payload.fileSize,
      uploadedBy: payload.uploadedBy,
      nip: payload.nip,
      gdriveId: "PENDING_OFFLINE_SYNC",
      description: "Menunggu koneksi internet aktif...",
      createdAt: payload.timestamp || new Date().toISOString(),
      type: payload.type
    };
    setArchives(prev => [tempFile, ...prev]);

    // Update stats optimistically
    setStats(prev => ({
      ...prev,
      totalArchives: prev.totalArchives + 1,
      categoryDistribution: {
        ...prev.categoryDistribution,
        [payload.category]: prev.categoryDistribution[payload.category as keyof typeof prev.categoryDistribution] + 1
      }
    }));

    // Update Employee optimistically
    setEmployees(prev => prev.map(emp => {
      if (emp.nip === payload.nip) {
        return {
          ...emp,
          lkhStatus: payload.type === "LKH" ? "uploaded" : emp.lkhStatus,
          lkbStatus: payload.type === "LKB" ? "uploaded" : emp.lkbStatus,
          sptStatus: payload.type === "SPT" ? "uploaded" : emp.sptStatus,
          lkhCancelNote: payload.type === "LKH" ? undefined : emp.lkhCancelNote,
          lkbCancelNote: payload.type === "LKB" ? undefined : emp.lkbCancelNote,
          sptCancelNote: payload.type === "SPT" ? undefined : emp.sptCancelNote,
          lastLkhUpload: payload.type === "LKH" ? new Date().toISOString() : emp.lastLkhUpload,
          lastLkbUpload: payload.type === "LKB" ? new Date().toISOString() : emp.lastLkbUpload,
          lastSptUpload: payload.type === "SPT" ? new Date().toISOString() : emp.lastSptUpload,
        };
      }
      return emp;
    }));
  };

  // Toggle Employee Upload Status
  const handleToggleStatus = async (employeeId: string, type: "LKH" | "LKB" | "SPT", cancelNote?: string) => {
    // Permission check: only admin/verifikator can alter verification status
    const isUserAdmin = loggedInEmployee ? (
      ["198904092019031008", "199205082023211022"].includes(loggedInEmployee.nip) ||
      loggedInEmployee.role === "admin" ||
      loggedInEmployee.role === "verifikator"
    ) : false;

    if (!isUserAdmin) {
      alert("Akses Dibatasi: Hanya Admin Verifikator yang berhak mengubah atau membatalkan status verifikasi.");
      return;
    }

    if (!isOnline) {
      // Queue toggle action offline
      const employee = employees.find(e => e.id === employeeId);
      if (!employee) return;

      const updatedQueue = [...offlineQueue, {
        id: `offline-${Date.now()}`,
        action: "toggle_status",
        payload: { employeeId, type, cancelNote },
        timestamp: new Date().toISOString()
      }];
      setOfflineQueue(updatedQueue);
      localStorage.setItem("kemenag_offline_queue", JSON.stringify(updatedQueue));

      // Optimistic status update
      setEmployees(prev => prev.map(emp => {
        if (emp.id === employeeId) {
          let isUploaded = false;
          if (type === "LKH") isUploaded = emp.lkhStatus === "uploaded";
          else if (type === "LKB") isUploaded = emp.lkbStatus === "uploaded";
          else if (type === "SPT") isUploaded = emp.sptStatus === "uploaded";

          const newStatus = isUploaded ? "pending" : "uploaded";
          return {
            ...emp,
            lkhStatus: type === "LKH" ? newStatus : emp.lkhStatus,
            lkbStatus: type === "LKB" ? newStatus : emp.lkbStatus,
            sptStatus: type === "SPT" ? newStatus : emp.sptStatus,
            lkhCancelNote: type === "LKH" ? (newStatus === "pending" ? cancelNote : undefined) : emp.lkhCancelNote,
            lkbCancelNote: type === "LKB" ? (newStatus === "pending" ? cancelNote : undefined) : emp.lkbCancelNote,
            sptCancelNote: type === "SPT" ? (newStatus === "pending" ? cancelNote : undefined) : emp.sptCancelNote,
            lastLkhUpload: type === "LKH" ? (newStatus === "uploaded" ? new Date().toISOString() : null) : emp.lastLkhUpload,
            lastLkbUpload: type === "LKB" ? (newStatus === "uploaded" ? new Date().toISOString() : null) : emp.lastLkbUpload,
            lastSptUpload: type === "SPT" ? (newStatus === "uploaded" ? new Date().toISOString() : null) : emp.lastSptUpload,
          };
        }
        return emp;
      }));
      return;
    }

    try {
      const res = await fetch("/api/pegawai/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, type, cancelNote })
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error("Gagal memperbarui status pegawai:", err);
    }
  };

  // Simulate pushing notifications from FCM
  const handleTriggerFcm = async (title: string, body: string, type: "info" | "success" | "warning") => {
    try {
      const res = await fetch("/api/notifications/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, type })
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error("Gagal mengirimkan notifikasi FCM:", err);
    }
  };

  const handleLogout = useCallback(() => {
    setLoggedInEmployee(null);
    localStorage.removeItem("kemenag_logged_in_employee");
    clearGDriveToken();
    setGdriveUserEmail(null);
    setGdriveFolders([]);
    setShowInactivityWarning(false);
    handleTriggerFcm("Sesi Berakhir", "Sesi Anda telah ditutup secara aman.", "info");
  }, [handleTriggerFcm]);

  // User Inactivity Tracker & Auto Logout (Silent Tracking)
  useEffect(() => {
    if (!loggedInEmployee) {
      setShowInactivityWarning(false);
      return;
    }

    lastActivityRef.current = Date.now();
    setShowInactivityWarning(false);

    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart", "mousedown"];

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      setShowInactivityWarning((prev) => {
        if (prev) return false;
        return prev;
      });
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, updateActivity);
    });

    const intervalId = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const remaining = autoLogoutTime - elapsedSeconds;

      if (remaining <= 0) {
        clearInterval(intervalId);
        setLoggedInEmployee(null);
        localStorage.removeItem("kemenag_logged_in_employee");
        setShowInactivityWarning(false);
        handleTriggerFcm(
          "Sesi Kedaluwarsa",
          "Sesi Anda berakhir otomatis karena tidak ada aktivitas.",
          "warning"
        );
      } else if (remaining <= 30) {
        setSecondsRemaining(remaining);
        setShowInactivityWarning(true);
      } else {
        setShowInactivityWarning(false);
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [loggedInEmployee, autoLogoutTime, handleTriggerFcm]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleClearNotifications = async () => {
    try {
      const res = await fetch("/api/notifications/clear", { method: "POST" });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error("Gagal menghapus log notifikasi:", err);
    }
  };

  // Login Barrier Screen
  if (!loggedInEmployee) {
    return (
      <LoginScreen
        employees={employees}
        onLoginSuccess={(emp) => {
          setLoggedInEmployee(emp);
          localStorage.setItem("kemenag_logged_in_employee", JSON.stringify(emp));
          handleTriggerFcm(
            "Berhasil Masuk",
            `Selamat datang kembali, ${emp.name}! Sesi Anda telah aktif.`,
            "success"
          );
          setSecondsRemaining(autoLogoutTime);
        }}
      />
    );
  }

  // Secure entry barrier for biometric lock
  if (!isUnlocked) {
    return (
      <div id="biometric-lockscreen" className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6">
          <div className="flex flex-col items-center">
            {/* Elegant Kemenag Logo Simulation */}
            <div className="h-14 w-14 rounded-full bg-emerald-800 flex items-center justify-center mb-4 text-amber-400 font-extrabold text-lg border border-amber-500 shadow-lg">
              <BookOpen className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
              Arsip Digital Kemenag Mempawah
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Kementerian Agama RI Kabupaten Mempawah
            </p>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
            <BiometricAuth
              isUnlocked={isUnlocked}
              setIsUnlocked={setIsUnlocked}
              onAuthSuccess={fetchData}
            />
          </div>
        </div>
      </div>
    );
  }

  const handleUpdateEmployee = (updatedEmp: Employee) => {
    setLoggedInEmployee(updatedEmp);
    localStorage.setItem("kemenag_logged_in_employee", JSON.stringify(updatedEmp));
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === updatedEmp.id ? updatedEmp : emp))
    );
  };

  const isAdmin = loggedInEmployee ? (
    ["198904092019031008", "199205082023211022"].includes(loggedInEmployee.nip) ||
    loggedInEmployee.role === "admin" ||
    loggedInEmployee.role === "verifikator"
  ) : false;

  return (
    <div id="app-root-container" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col transition-colors duration-300">
      
      {/* 1. Header Navigation Bar */}
      <header id="app-header" className="bg-white dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800/80 backdrop-blur-md text-slate-800 dark:text-slate-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Kemenag Logo Badge */}
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-md">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight">
                Arsip Digital Kemenag Mempawah
              </h1>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold tracking-wider uppercase">
                Kantor Kementerian Agama Kabupaten Mempawah
              </p>
            </div>
          </div>

          {/* Quick Toolbar */}
          <div className="flex items-center gap-2.5">
            <button
              id="btn-toggle-theme"
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors focus:outline-none cursor-pointer"
              title="Ganti Tema"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Logged in employee profile button & session badge */}
            {loggedInEmployee && (
              <div className="hidden md:flex items-center gap-2.5 border-l border-slate-200 dark:border-slate-800 pl-3">
                <button
                  id="btn-header-profile"
                  onClick={() => setActiveTab("profile")}
                  className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-xl transition-colors cursor-pointer text-right"
                  title="Buka Profil Saya"
                >
                  {loggedInEmployee.avatar ? (
                    <img
                      src={loggedInEmployee.avatar}
                      alt={loggedInEmployee.name}
                      className="h-8 w-8 rounded-full object-cover border border-blue-500 shadow-2xs"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                      {loggedInEmployee.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1.5">
                      {["198904092019031008", "199205082023211022"].includes(loggedInEmployee.nip) || loggedInEmployee.role === "admin" ? (
                        <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                          Admin Verifikator
                        </span>
                      ) : null}
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-none">
                        {loggedInEmployee.name}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                      NIP: {loggedInEmployee.nip}
                    </span>
                  </div>
                </button>
                
                {/* Secure Session Badge */}
                <div 
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-850/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-semibold"
                  title="Keamanan Sesi Aktif"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>Sesi Aman</span>
                </div>
              </div>
            )}

            {isAdmin && (
              <button
                id="btn-connect-gdrive-header"
                onClick={handleGoogleSignIn}
                className="hidden sm:flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3 py-2 rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
                title="Otentikasi Akun Google Drive Admin"
              >
                <Cloud className="h-4 w-4" />
                <span>{gdriveUserEmail ? "Google Drive Terhubung" : "Hubungkan Google Drive"}</span>
              </button>
            )}

            <button
              id="btn-open-wa-modal"
              onClick={() => setIsWaHeaderModalOpen(true)}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-2 rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
              title="Hubungi Admin Verifikator via WhatsApp"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden md:inline">WA Admin</span>
            </button>

            <button
              id="btn-open-upload-modal"
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Digitalisasi Berkas
            </button>

            {/* Logout Button */}
            {loggedInEmployee && (
              <button
                id="btn-logout"
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-955/20 text-red-500 hover:text-red-600 transition-colors cursor-pointer"
                title="Keluar dari Akun"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. Primary Navigation Rail / Subheader */}
      <div id="sub-navigation" className="bg-slate-50/50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14 overflow-x-auto">
          <nav className="flex space-x-2 py-1.5">
            {[
              { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
              { id: "monitoring", label: "Monitoring LKH/LKB", icon: <Users className="h-4 w-4" /> },
              { id: "spt", label: "SPT Tahunan", icon: <FileText className="h-4 w-4" /> },
              { id: "arsip", label: "Riwayat Arsip", icon: <Archive className="h-4 w-4" /> },
              { id: "profile", label: "Profil Saya", icon: <User className="h-4 w-4" /> },
              { id: "settings", label: "Keamanan", icon: <Settings className="h-4 w-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-slate-200/65 dark:bg-slate-900 text-blue-600 dark:text-blue-400 border border-slate-300 dark:border-slate-800"
                    : "border border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Quick Sync Tracker */}
          <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-mono">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Integrasi Google Drive API Aktif
          </span>
        </div>
      </div>

      {/* 3. Main Body */}
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Main Workspace Frame */}
          <div className="lg:col-span-3 space-y-6">
            {activeTab === "dashboard" && (
              <Dashboard
                stats={stats}
                onNavigate={setActiveTab}
                onTriggerNotification={handleTriggerFcm}
                currentUser={loggedInEmployee}
              />
            )}

            {activeTab === "monitoring" && (
              <EmployeeMonitoring
                employees={employees}
                onToggleStatus={handleToggleStatus}
                isSyncing={isSyncing}
                currentUser={loggedInEmployee}
                initialReportType="LKH"
                allowedReportTypes={["LKH", "LKB"]}
                title="Monitoring Pelaporan LKH & LKB"
              />
            )}

            {activeTab === "spt" && (
              <EmployeeMonitoring
                employees={employees}
                onToggleStatus={handleToggleStatus}
                isSyncing={isSyncing}
                currentUser={loggedInEmployee}
                initialReportType="SPT"
                allowedReportTypes={["SPT"]}
                title="Monitoring SPT Tahunan"
              />
            )}

            {activeTab === "arsip" && (
              <ArchiveHistory archives={archives} currentUser={loggedInEmployee} />
            )}

            {activeTab === "profile" && loggedInEmployee && (
              <UserProfile
                employee={loggedInEmployee}
                onUpdateEmployee={handleUpdateEmployee}
                onTriggerNotification={handleTriggerFcm}
              />
            )}

            {activeTab === "settings" && (
              <div className="space-y-6">
                <BiometricAuth
                  isUnlocked={isUnlocked}
                  setIsUnlocked={setIsUnlocked}
                  onAuthSuccess={fetchData}
                />

                {/* Auto Logout & Session Settings Panel */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400">
                        <Timer className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">Otomatis Keluar (Auto-Logout)</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Atur durasi keamanan ketidakaktifan sesi pengguna</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping"></span>
                      Pemantau Aktif
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Pilih Durasi Auto-Logout:
                      </label>
                      <select
                        id="select-auto-logout"
                        value={autoLogoutTime}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setAutoLogoutTime(val);
                          setSecondsRemaining(val);
                          localStorage.setItem("kemenag_auto_logout_time", String(val));
                          handleTriggerFcm(
                            "Durasi Sesi Diperbarui",
                            `Waktu auto-logout berhasil diatur ke ${e.target.options[e.target.selectedIndex].text}.`,
                            "info"
                          );
                        }}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="10">10 Detik (Durasi Singkat)</option>
                        <option value="30">30 Detik</option>
                        <option value="60">1 Menit</option>
                        <option value="300">5 Menit (Saran Sistem)</option>
                        <option value="900">15 Menit</option>
                        <option value="1800">30 Menit</option>
                        <option value="3600">1 Jam</option>
                      </select>
                      <p className="text-[10px] text-slate-400 leading-normal">
                        Sistem akan mengukur gerakan kursor mouse, ketukan keyboard, dan gulir halaman. Jika tidak ada aktivitas dalam batas waktu di atas, sesi Anda akan ditutup otomatis demi mencegah penyalahgunaan berkas.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl flex flex-col justify-between text-xs space-y-4">
                      <div className="space-y-2">
                        <span className="font-bold text-slate-700 dark:text-slate-300 block">Status Sesi Pengguna:</span>
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <User className="h-4 w-4 text-blue-500" />
                          <span><strong>Akun:</strong> {loggedInEmployee?.name} (NIP {loggedInEmployee?.nip})</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                          <Clock className="h-4 w-4 text-amber-500" />
                          <span><strong>Maksimal Tidak Aktif:</strong> <span className="font-semibold text-slate-800 dark:text-slate-200">{autoLogoutTime / 60} Menit</span></span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            lastActivityRef.current = Date.now();
                            handleTriggerFcm("Sesi Diperbarui", "Sensor gerakan/aktivitas Anda telah dicheck dan diperbarui.", "success");
                          }}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 rounded-lg transition-colors cursor-pointer"
                        >
                          Segarkan Sensor Sesi
                        </button>
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="px-3 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-955/20 dark:hover:bg-red-950/30 font-bold text-xs py-2 rounded-lg transition-colors cursor-pointer"
                        >
                          Keluar Sekarang
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Real Google Drive Integration Settings Panel */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400">
                        <Cloud className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">Integrasi Google Drive</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Konfigurasi folder dan akun penyimpanan file digitalisasi Anda</p>
                      </div>
                    </div>
                    {gdriveUserEmail ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Terhubung
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        Belum Terhubung
                      </span>
                    )}
                  </div>

                  {!isAdmin ? (
                    <div className="p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs text-amber-900 dark:text-amber-300 flex items-center gap-3">
                      <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div>
                        <span className="font-bold block text-sm mb-0.5">Pengaturan Google Drive Dibatasi</span>
                        <span className="leading-relaxed block">
                          Otentikasi dan pengelolaan folder penyimpanan Google Drive dikelola secara terpusat oleh Admin Verifikator. Seluruh berkas yang Anda unggah akan otomatis tersimpan dengan aman di repositori Cloud Arsiparis.
                        </span>
                      </div>
                    </div>
                  ) : !gdriveUserEmail ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 rounded-xl">
                        <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                          Hubungkan akun Google Drive Anda untuk mulai menyimpan seluruh dokumen <strong>LKH</strong> dan <strong>LKB</strong> pegawai langsung ke folder target yang Anda siapkan.
                        </p>
                      </div>

                      <div className="flex items-center justify-center py-4">
                        <button
                          onClick={handleGoogleSignIn}
                          className="gsi-material-button flex items-center justify-center gap-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-750 hover:bg-slate-50 dark:hover:bg-slate-700 px-6 py-2.5 rounded-xl shadow-xs transition-all text-slate-700 dark:text-slate-200 text-sm font-semibold cursor-pointer"
                        >
                          <svg className="h-5 w-5 animate-bounce" version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block" }}>
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                          </svg>
                          Hubungkan Akun Google Drive
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-emerald-50/20 dark:bg-emerald-950/10 border border-emerald-150 dark:border-emerald-900/20 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center font-bold text-emerald-700 dark:text-emerald-300">
                            {gdriveUserEmail?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Akun Terhubung</span>
                            <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">{gdriveUserEmail}</span>
                          </div>
                        </div>
                        <button
                          onClick={handleGoogleSignOut}
                          className="flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/25 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          Putus Koneksi
                        </button>
                      </div>

                      {/* Folder configurations */}
                      <div className="space-y-4">
                        <h4 className="font-bold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">Pengaturan Folder Penyimpanan</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Folder list selector */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Pilih Folder Google Drive:</label>
                            <select
                              value={gdriveFolderId}
                              onChange={(e) => {
                                const val = e.target.value;
                                setGdriveFolderId(val);
                                const selectedObj = gdriveFolders.find(f => f.id === val);
                                const name = selectedObj ? selectedObj.name : "";
                                setGdriveFolderName(name);
                                if (val) {
                                  localStorage.setItem("gdrive_folder_id", val);
                                  localStorage.setItem("gdrive_folder_name", name);
                                } else {
                                  localStorage.removeItem("gdrive_folder_id");
                                  localStorage.removeItem("gdrive_folder_name");
                                }
                              }}
                              disabled={isFetchingFolders}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-750 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="">-- Gunakan Folder Kemenag (Default) --</option>
                              {gdriveFolders.map((f) => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                              ))}
                            </select>
                            {isFetchingFolders && <span className="text-[10px] text-slate-400 mt-1 block">Memuat daftar folder...</span>}
                          </div>

                          {/* Manual Folder ID input */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">ID Folder Kustom (Sudah Disiapkan):</label>
                            <input
                              type="text"
                              value={gdriveCustomFolderId}
                              onChange={(e) => {
                                const val = e.target.value.trim();
                                setGdriveCustomFolderId(val);
                                if (val) {
                                  localStorage.setItem("gdrive_custom_folder_id", val);
                                } else {
                                  localStorage.removeItem("gdrive_custom_folder_id");
                                }
                              }}
                              placeholder="Tempel ID Folder Anda (Contoh: 1gDrV_...)"
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                              Salin string panjang dari URL folder Google Drive yang sudah disiapkan.
                            </p>
                          </div>
                        </div>

                        {/* Create folder component inside setting */}
                        <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">Atau Buat Folder Baru Langsung:</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newFolderName}
                              onChange={(e) => setNewFolderName(e.target.value)}
                              placeholder="Masukkan nama folder (misal: Digitalisasi_Kemenag_Mempawah)"
                              className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button
                              onClick={handleCreateFolder}
                              disabled={isCreatingFolder || !newFolderName.trim()}
                              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:dark:bg-slate-800 disabled:text-slate-400 text-white font-bold text-xs px-4 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              <FolderPlus className="h-3.5 w-3.5" />
                              {isCreatingFolder ? "Membuat..." : "Buat Folder"}
                            </button>
                          </div>
                        </div>

                        {/* Target Display Summary */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850/70 rounded-xl space-y-2 text-xs">
                          <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Status Target Penyimpanan Aktif:</span>
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Folder className="h-4 w-4 text-blue-500" />
                            <span>
                              <strong>Folder:</strong>{" "}
                              {gdriveCustomFolderId
                                ? `Folder Kustom (ID: ${gdriveCustomFolderId})`
                                : gdriveFolderName
                                ? `${gdriveFolderName} (ID: ${gdriveFolderId})`
                                : "Root Folder (Default App)"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            <span>
                              Seluruh berkas yang diunggah akan otomatis disimpan langsung ke folder Google Drive di atas.
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base mb-2">Informasi Integrasi Aplikasi</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Sistem Arsip Digital Kemenag Mempawah dirancang untuk menjembatani sistem pelaporan berkas LKH (Laporan Kinerja Harian) dan LKB (Laporan Kerja Bulanan) langsung ke dalam infrastruktur awan Google Drive API yang aman. 
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                    <div>
                      <span className="font-bold block text-slate-700 dark:text-slate-300">Google Drive API</span>
                      Simpan bita arsip dokumen asli & deskripsi metadata.
                    </div>
                    <div>
                      <span className="font-bold block text-slate-700 dark:text-slate-300">Firebase Cloud Messaging</span>
                      Sinkronisasi instan & push pemberitahuan real-time.
                    </div>
                    <div>
                      <span className="font-bold block text-slate-700 dark:text-slate-300">Offline Caching</span>
                      Data tersimpan lokal & sinkron otomatis saat daring.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar: Notification Tray / System Log */}
          <div className="lg:col-span-1 space-y-6">
            <NotificationCenter
              notifications={notifications}
              onClear={handleClearNotifications}
            />
          </div>

        </div>
      </main>

      {/* 4. Footer Website with Running Text (Fixed/Sticky at Bottom) */}
      <footer id="app-footer" className="sticky bottom-0 z-40 bg-slate-900 text-slate-200 border-t border-slate-800 shadow-2xl backdrop-blur-md">
        {/* Running Text Marquee Bar */}
        <div className="bg-emerald-950/90 border-b border-emerald-800/60 py-2.5 px-4 overflow-hidden relative shadow-inner flex items-center">
          {/* Badge Label */}
          <div className="z-10 bg-emerald-600 text-white font-extrabold text-[11px] uppercase tracking-wider px-3 py-1 rounded-md shadow-xs flex items-center gap-1.5 shrink-0 mr-3">
            <span className="h-2 w-2 rounded-full bg-amber-300 animate-pulse" />
            <span>PEMBERITAHUAN SIARAN</span>
          </div>

          {/* Scrolling Container */}
          <div className="overflow-hidden relative w-full flex items-center">
            <div className="animate-marquee whitespace-nowrap flex items-center gap-8 text-xs font-semibold tracking-wide text-emerald-100">
              {(() => {
                const baseList = [
                  "Selamat Datang Di Portal Arsip Kemenag Mempawah — Dokumen Aman & Terintegrasi",
                  ...(notifications.length > 0
                    ? notifications.slice(0, 5).map(n => `📢 [SIARAN PUSAT] ${n.title}: ${n.body}`)
                    : [])
                ];
                const displayList = baseList.length < 4 ? [...baseList, ...baseList, ...baseList] : [...baseList, ...baseList];
                return displayList.map((msg, i) => (
                  <span key={i} className="flex items-center gap-3">
                    <span className={msg.includes("📢") ? "text-amber-200 font-bold" : "text-emerald-100"}>{msg}</span>
                    <span className="text-amber-400 font-bold">✦</span>
                  </span>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* Main Footer Copyright & Info */}
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-slate-400">
          <div className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left">
            <span className="font-bold text-slate-200">
              © 2026 Kantor Kementerian Agama Kabupaten Mempawah
            </span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <span className="text-slate-400 text-[11px]">
              Portal Digitalisasi Dokumen & Monitoring LKH / LKB / SPT Tahunan
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px] text-slate-400 shrink-0">
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              Sistem Aktif
            </span>
            <span>v1.2.0 (Stable)</span>
          </div>
        </div>
      </footer>

      {/* Floating Offline Sync Indicator */}
      <OfflineSyncIndicator
        onSyncComplete={fetchData}
        pendingCount={offlineQueue.length}
        triggerSync={triggerSync}
        isSyncing={isSyncing}
      />

      {/* Document Upload Dialog */}
      {isUploadModalOpen && (
        <UploadModal
          onClose={() => setIsUploadModalOpen(false)}
          onUploadSuccess={async () => {
            await fetchData();
          }}
          employees={employees}
          isOnline={isOnline}
          queueOfflineUpload={queueOfflineUpload}
          loggedInEmployee={loggedInEmployee}
        />
      )}

      {/* WhatsApp Header Admin Contact Modal */}
      {isWaHeaderModalOpen && (
        <WhatsAppNotifModal
          isOpen={isWaHeaderModalOpen}
          onClose={() => setIsWaHeaderModalOpen(false)}
          title="Kontak Admin Verifikator WhatsApp"
        />
      )}

      {/* Dynamic Inactivity Auto-Logout warning modal */}
      {showInactivityWarning && (
        <div id="inactivity-warning-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/40 rounded-2xl p-6 shadow-2xl max-w-sm w-full space-y-4 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-red-50 dark:bg-red-950/20 flex items-center justify-center text-red-500 animate-pulse">
              <Timer className="h-6 w-6" />
            </div>
            
            <div className="space-y-1.5">
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">Peringatan Keamanan Sesi!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sesi Anda akan berakhir otomatis karena tidak ada aktivitas dalam:
              </p>
              <div className="font-mono text-3xl font-extrabold text-red-600 dark:text-red-400 py-1.5">
                {formatTime(secondsRemaining)}
              </div>
            </div>

            <p className="text-[10px] text-slate-400 leading-normal">
              Gerakkan mouse, ketik tombol pada keyboard, atau klik tombol di bawah ini untuk mengaktifkan kembali sesi Anda saat ini.
            </p>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSecondsRemaining(autoLogoutTime);
                  setShowInactivityWarning(false);
                  handleTriggerFcm("Sesi Diperpanjang", "Sesi berhasil diperpanjang melalui interaksi modal.", "success");
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Lanjutkan Sesi
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-bold text-xs py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
              >
                Keluar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
