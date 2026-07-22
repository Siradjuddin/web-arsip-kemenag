import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { Employee, ArchiveFile, AppNotification, AnalyticsStats, FileCategory, DocType } from "./src/types";
import { INITIAL_EMPLOYEES } from "./src/data/initialEmployees";

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "db.json");

app.use(express.json());

// --- DATABASE STATE INITIALIZATION ---
interface DatabaseSchema {
  employees: Employee[];
  archives: ArchiveFile[];
  notifications: AppNotification[];
}

const INITIAL_ARCHIVES: ArchiveFile[] = [];

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: "notif-1",
    title: "Sistem Terhubung",
    body: "Arsip Digital Kemenag Mempawah siap digunakan. Mode Sinkronisasi Otomatis Aktif.",
    type: "info",
    createdAt: new Date().toISOString()
  }
];

// Load Database from file or save initial
function getDB(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading database file, using in-memory:", error);
  }
  
  // Create file if it doesn't exist
  const initialData = {
    employees: INITIAL_EMPLOYEES,
    archives: INITIAL_ARCHIVES,
    notifications: INITIAL_NOTIFICATIONS
  };
  saveDB(initialData);
  return initialData;
}

function saveDB(data: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing database file:", error);
  }
}

// Ensure database is initialized
let db = getDB();

const ADMIN_VERIFIKATOR_NIPS = ["198904092019031008", "199205082023211022"];

// Sync employees' status with existing archives on boot to ensure correct real-time counters and status displays
db.employees.forEach(emp => {
  emp.lkhStatus = emp.lkhStatus || "pending";
  emp.lkbStatus = emp.lkbStatus || "pending";
  emp.sptStatus = emp.sptStatus || "pending";
  emp.lastLkhUpload = emp.lastLkhUpload || null;
  emp.lastLkbUpload = emp.lastLkbUpload || null;
  emp.lastSptUpload = emp.lastSptUpload || null;
  if (ADMIN_VERIFIKATOR_NIPS.includes(emp.nip)) {
    emp.role = "admin";
  } else {
    emp.role = emp.role || "pegawai";
  }
});

db.archives.forEach(archive => {
  const employee = db.employees.find(e => e.nip === archive.nip);
  if (employee) {
    if (archive.type === "LKH" || archive.type === "Umum") {
      employee.lkhStatus = "uploaded";
      if (!employee.lastLkhUpload || archive.createdAt > employee.lastLkhUpload) {
        employee.lastLkhUpload = archive.createdAt;
      }
    } else if (archive.type === "LKB") {
      employee.lkbStatus = "uploaded";
      if (!employee.lastLkbUpload || archive.createdAt > employee.lastLkbUpload) {
        employee.lastLkbUpload = archive.createdAt;
      }
    } else if (archive.type === "SPT") {
      employee.sptStatus = "uploaded";
      if (!employee.lastSptUpload || archive.createdAt > employee.lastSptUpload) {
        employee.lastSptUpload = archive.createdAt;
      }
    }
  }
});
saveDB(db);

// --- helper to recalculate stats ---
function calculateStats(): AnalyticsStats {
  const totalEmployees = db.employees.length;
  const completedLkhToday = db.employees.filter(e => e.lkhStatus === "uploaded").length;
  const pendingLkhToday = totalEmployees - completedLkhToday;

  const completedLkbMonth = db.employees.filter(e => e.lkbStatus === "uploaded").length;
  const pendingLkbMonth = totalEmployees - completedLkbMonth;

  const totalArchives = db.archives.length;

  const categoryDistribution = {
    PDF: db.archives.filter(a => a.category === "PDF").length,
    Word: db.archives.filter(a => a.category === "Word").length,
    Excel: db.archives.filter(a => a.category === "Excel").length,
    Foto: db.archives.filter(a => a.category === "Foto").length,
    Video: db.archives.filter(a => a.category === "Video").length,
  };

  // Group uploads by last 7 dates for visualization trend
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().split("T")[0];
  }).reverse();

  const monthlyUploadTrend = last7Days.map(dateStr => {
    const count = db.archives.filter(a => a.createdAt.startsWith(dateStr)).length;
    // Format to e.g. "21 Jul"
    const [, m, d] = dateStr.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const monthLabel = months[parseInt(m) - 1];
    return {
      label: `${parseInt(d)} ${monthLabel}`,
      count
    };
  });

  return {
    totalEmployees,
    completedLkhToday,
    pendingLkhToday,
    completedLkbMonth,
    pendingLkbMonth,
    totalArchives,
    categoryDistribution,
    monthlyUploadTrend
  };
}

// --- API ENDPOINTS ---

// 1. Get Employees
app.get("/api/pegawai", (req, res) => {
  res.json(db.employees);
});

// 2. Toggle Status (Direct simulation from monitoring board)
app.post("/api/pegawai/toggle", (req, res) => {
  const { employeeId, type, cancelNote } = req.body as {
    employeeId: string;
    type: "LKH" | "LKB" | "SPT";
    cancelNote?: string;
  };
  const employee = db.employees.find(e => e.id === employeeId);

  if (!employee) {
    return res.status(404).json({ error: "Pegawai tidak ditemukan." });
  }

  const timestamp = new Date().toISOString();
  let actionTitle = "";
  let actionBody = "";

  if (type === "LKH") {
    const prevStatus = employee.lkhStatus;
    employee.lkhStatus = prevStatus === "uploaded" ? "pending" : "uploaded";
    employee.lastLkhUpload = employee.lkhStatus === "uploaded" ? timestamp : null;

    if (employee.lkhStatus === "uploaded") {
      delete employee.lkhCancelNote;
      actionTitle = "LKH Terverifikasi";
      actionBody = `Laporan Kinerja Harian ${employee.name} ditandai Terverifikasi.`;
      
      const fileId = `file-${Date.now()}`;
      const newFile: ArchiveFile = {
        id: fileId,
        name: `LKH_${employee.name.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().getDate()}_Juli_2026.pdf`,
        category: "PDF",
        fileSize: "1.4 MB",
        uploadedBy: employee.name,
        nip: employee.nip,
        gdriveId: `gdrive-${fileId}-sync`,
        description: `Metadata: { NIP: '${employee.nip}', Nama: '${employee.name}', Jabatan: '${employee.position}', Tipe: 'LKH', Tanggal: '2026-07-21', Instansi: 'Kemenag Mempawah', Status: 'DISINKRONKAN_OTOMATIS' }`,
        createdAt: timestamp,
        type: "LKH"
      };
      db.archives.unshift(newFile);
    } else {
      employee.lkhCancelNote = cancelNote || "Verifikasi dibatalkan oleh Admin Verifikator. Mohon perbaiki berkas LKH Anda.";
      actionTitle = "Verifikasi LKH Dibatalkan";
      actionBody = `Verifikasi LKH ${employee.name} dibatalkan. Catatan: "${employee.lkhCancelNote}"`;
      const idx = db.archives.findIndex(a => a.nip === employee.nip && a.type === "LKH");
      if (idx !== -1) {
        db.archives.splice(idx, 1);
      }
    }
  } else if (type === "LKB") {
    const prevStatus = employee.lkbStatus;
    employee.lkbStatus = prevStatus === "uploaded" ? "pending" : "uploaded";
    employee.lastLkbUpload = employee.lkbStatus === "uploaded" ? timestamp : null;

    if (employee.lkbStatus === "uploaded") {
      delete employee.lkbCancelNote;
      actionTitle = "LKB Terverifikasi";
      actionBody = `Laporan Kerja Bulanan ${employee.name} ditandai Terverifikasi.`;
      
      const fileId = `file-${Date.now()}`;
      const newFile: ArchiveFile = {
        id: fileId,
        name: `LKB_${employee.name.replace(/[^a-zA-Z0-9]/g, "_")}_Juli_2026.xlsx`,
        category: "Excel",
        fileSize: "2.1 MB",
        uploadedBy: employee.name,
        nip: employee.nip,
        gdriveId: `gdrive-${fileId}-sync`,
        description: `Metadata: { NIP: '${employee.nip}', Nama: '${employee.name}', Jabatan: '${employee.position}', Tipe: 'LKB', Tanggal: '2026-07-21', Instansi: 'Kemenag Mempawah', Status: 'DISINKRONKAN_OTOMATIS' }`,
        createdAt: timestamp,
        type: "LKB"
      };
      db.archives.unshift(newFile);
    } else {
      employee.lkbCancelNote = cancelNote || "Verifikasi dibatalkan oleh Admin Verifikator. Mohon perbaiki berkas LKB Anda.";
      actionTitle = "Verifikasi LKB Dibatalkan";
      actionBody = `Verifikasi LKB ${employee.name} dibatalkan. Catatan: "${employee.lkbCancelNote}"`;
      const idx = db.archives.findIndex(a => a.nip === employee.nip && a.type === "LKB");
      if (idx !== -1) {
        db.archives.splice(idx, 1);
      }
    }
  } else if (type === "SPT") {
    const prevStatus = employee.sptStatus;
    employee.sptStatus = prevStatus === "uploaded" ? "pending" : "uploaded";
    employee.lastSptUpload = employee.sptStatus === "uploaded" ? timestamp : null;

    if (employee.sptStatus === "uploaded") {
      delete employee.sptCancelNote;
      actionTitle = "SPT Tahunan Terverifikasi";
      actionBody = `Laporan SPT Tahunan ${employee.name} ditandai Terverifikasi.`;
      
      const fileId = `file-${Date.now()}`;
      const newFile: ArchiveFile = {
        id: fileId,
        name: `SPT_${employee.name.replace(/[^a-zA-Z0-9]/g, "_")}_2026.pdf`,
        category: "PDF",
        fileSize: "1.8 MB",
        uploadedBy: employee.name,
        nip: employee.nip,
        gdriveId: `gdrive-${fileId}-sync`,
        description: `Metadata: { NIP: '${employee.nip}', Nama: '${employee.name}', Jabatan: '${employee.position}', Tipe: 'SPT', Tanggal: '2026-07-21', Instansi: 'Kemenag Mempawah', Status: 'DISINKRONKAN_OTOMATIS' }`,
        createdAt: timestamp,
        type: "SPT"
      };
      db.archives.unshift(newFile);
    } else {
      employee.sptCancelNote = cancelNote || "Verifikasi dibatalkan oleh Admin Verifikator. Mohon perbaiki berkas SPT Tahunan Anda.";
      actionTitle = "Verifikasi SPT Tahunan Dibatalkan";
      actionBody = `Verifikasi SPT Tahunan ${employee.name} dibatalkan. Catatan: "${employee.sptCancelNote}"`;
      const idx = db.archives.findIndex(a => a.nip === employee.nip && a.type === "SPT");
      if (idx !== -1) {
        db.archives.splice(idx, 1);
      }
    }
  }

  // Push FCM notification
  const newNotif: AppNotification = {
    id: `notif-${Date.now()}`,
    title: actionTitle,
    body: actionBody,
    type: actionTitle.includes("Dibatalkan") ? "warning" : "success",
    createdAt: timestamp
  };
  db.notifications.unshift(newNotif);

  // Trim notifications to prevent overflow
  if (db.notifications.length > 50) {
    db.notifications.pop();
  }

  saveDB(db);
  res.json({ success: true, employee, archives: db.archives });
});

// 3. Get Archives
app.get("/api/arsip", (req, res) => {
  res.json(db.archives);
});

// 4. Manual / Direct Upload Document (With strict Google Drive integration simulation)
app.post("/api/arsip/upload", (req, res) => {
  const { name, category, fileSize, uploadedBy, nip, type, description, gdriveId: customGDriveId } = req.body as {
    name: string;
    category: FileCategory;
    fileSize: string;
    uploadedBy: string;
    nip: string;
    type: DocType;
    description: string;
    gdriveId?: string;
  };

  if (!name || !uploadedBy || !nip) {
    return res.status(400).json({ error: "Nama berkas, nama pegawai, dan NIP wajib diisi." });
  }

  const timestamp = new Date().toISOString();
  const fileId = `file-${Date.now()}`;
  const gdriveId = customGDriveId || `1gDrV_userUpload_${Math.random().toString(36).substring(2, 15)}`;

  // Construct structured metadata that gets pushed to Google Drive file Description field
  const structuredDescription = `Metadata: { NIP: '${nip}', Nama: '${uploadedBy}', Tipe: '${type}', Kategori: '${category}', Tanggal: '${timestamp.split("T")[0]}', GDriveID: '${gdriveId}', Integrasi: 'Google Drive API (Kemenag Mempawah)', DeskripsiUser: '${description || ""}' }`;

  const newFile: ArchiveFile = {
    id: fileId,
    name,
    category,
    fileSize: fileSize || "1.2 MB",
    uploadedBy,
    nip,
    gdriveId,
    description: structuredDescription,
    createdAt: timestamp,
    type
  };

  // Add to archives
  db.archives.unshift(newFile);

  // Sync back to employee status if LKH/LKB/SPT/Umum is uploaded
  const employee = db.employees.find(e => e.nip === nip);
  if (employee) {
    if (type === "LKH" || type === "Umum") {
      employee.lkhStatus = "uploaded";
      employee.lastLkhUpload = timestamp;
      delete employee.lkhCancelNote;
    } else if (type === "LKB") {
      employee.lkbStatus = "uploaded";
      employee.lastLkbUpload = timestamp;
      delete employee.lkbCancelNote;
    } else if (type === "SPT") {
      employee.sptStatus = "uploaded";
      employee.lastSptUpload = timestamp;
      delete employee.sptCancelNote;
    }
  }

  // Add Notification (Simulating FCM notification)
  const newNotif: AppNotification = {
    id: `notif-${Date.now()}`,
    title: `Digitalisasi Arsip Sukses (${type})`,
    body: `Dokumen "${name}" milik ${uploadedBy} tersimpan di Google Drive dengan ID berkas ${gdriveId}.`,
    type: "success",
    createdAt: timestamp
  };
  db.notifications.unshift(newNotif);

  saveDB(db);
  res.json({ success: true, file: newFile, employee });
});

// 5. Offline bulk sync endpoint
app.post("/api/sync", (req, res) => {
  const { syncItems } = req.body as { syncItems: any[] };
  
  if (!syncItems || !Array.isArray(syncItems)) {
    return res.status(400).json({ error: "Item sinkronisasi tidak valid." });
  }

  const timestamp = new Date().toISOString();
  let syncCount = 0;

  syncItems.forEach((item) => {
    if (item.action === "toggle_status") {
      const { employeeId, type } = item.payload;
      const employee = db.employees.find(e => e.id === employeeId);
      if (employee) {
        if (type === "LKH") {
          employee.lkhStatus = "uploaded";
          employee.lastLkhUpload = timestamp;
          
          // Add archive entry
          const fileId = `file-${Date.now()}-${syncCount}`;
          db.archives.unshift({
            id: fileId,
            name: `LKH_Offline_${employee.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
            category: "PDF",
            fileSize: "1.0 MB",
            uploadedBy: employee.name,
            nip: employee.nip,
            gdriveId: `gdrive-offline-${fileId}`,
            description: `Metadata: { NIP: '${employee.nip}', Nama: '${employee.name}', Tipe: 'LKH', Tanggal: '${timestamp.split("T")[0]}', Sync: 'Offline Caching Engine' }`,
            createdAt: timestamp,
            type: "LKH"
          });
        } else {
          employee.lkbStatus = "uploaded";
          employee.lastLkbUpload = timestamp;

          // Add archive entry
          const fileId = `file-${Date.now()}-${syncCount}`;
          db.archives.unshift({
            id: fileId,
            name: `LKB_Offline_${employee.name.replace(/[^a-zA-Z0-9]/g, "_")}.xlsx`,
            category: "Excel",
            fileSize: "1.8 MB",
            uploadedBy: employee.name,
            nip: employee.nip,
            gdriveId: `gdrive-offline-${fileId}`,
            description: `Metadata: { NIP: '${employee.nip}', Nama: '${employee.name}', Tipe: 'LKB', Tanggal: '${timestamp.split("T")[0]}', Sync: 'Offline Caching Engine' }`,
            createdAt: timestamp,
            type: "LKB"
          });
        }
        syncCount++;
      }
    } else if (item.action === "upload") {
      const { name, category, fileSize, uploadedBy, nip, type, description } = item.payload;
      const fileId = `file-${Date.now()}-${syncCount}`;
      const gdriveId = `1gDrV_offlineUpload_${Math.random().toString(36).substring(2, 12)}`;
      
      const structuredDescription = `Metadata: { NIP: '${nip}', Nama: '${uploadedBy}', Tipe: '${type}', Kategori: '${category}', GDriveID: '${gdriveId}', Sync: 'Offline Sync Engine' }`;

      db.archives.unshift({
        id: fileId,
        name: name || "Dokumen_Offline.pdf",
        category: category || "PDF",
        fileSize: fileSize || "1.0 MB",
        uploadedBy: uploadedBy,
        nip: nip,
        gdriveId,
        description: structuredDescription,
        createdAt: item.timestamp || timestamp,
        type: type || "Umum"
      });

      // Update employee too
      const employee = db.employees.find(e => e.nip === nip);
      if (employee) {
        if (type === "LKH") {
          employee.lkhStatus = "uploaded";
          employee.lastLkhUpload = item.timestamp || timestamp;
        } else if (type === "LKB") {
          employee.lkbStatus = "uploaded";
          employee.lastLkbUpload = item.timestamp || timestamp;
        }
      }
      syncCount++;
    }
  });

  if (syncCount > 0) {
    const syncNotif: AppNotification = {
      id: `notif-${Date.now()}`,
      title: "Sinkronisasi Berhasil",
      body: `Berhasil mensinkronkan ${syncCount} arsip data luring (offline) ke Google Drive Kemenag Mempawah.`,
      type: "success",
      createdAt: timestamp
    };
    db.notifications.unshift(syncNotif);
    saveDB(db);
  }

  res.json({ success: true, syncedCount: syncCount, employees: db.employees, archives: db.archives });
});

// 6. Get Notifications
app.get("/api/notifications", (req, res) => {
  res.json(db.notifications);
});

// 7. Clear Notifications
app.post("/api/notifications/clear", (req, res) => {
  db.notifications = [];
  saveDB(db);
  res.json({ success: true });
});

// 8. Trigger manual FCM notification for simulation
app.post("/api/notifications/trigger", (req, res) => {
  const { title, body, type } = req.body as { title: string; body: string; type: "info" | "success" | "warning" };
  const newNotif: AppNotification = {
    id: `notif-${Date.now()}`,
    title: title || "Pemberitahuan Sistem",
    body: body || "Pesan push notification FCM disimulasikan.",
    type: type || "info",
    createdAt: new Date().toISOString()
  };
  db.notifications.unshift(newNotif);
  saveDB(db);
  res.json({ success: true, notification: newNotif });
});

// 9. Get Stats
app.get("/api/stats", (req, res) => {
  res.json(calculateStats());
});

// --- VITE MIDDLEWARE SETUP ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
