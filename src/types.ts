export type FileCategory = "PDF" | "Word" | "Excel" | "Foto" | "Video";
export type DocType = "LKH" | "LKB" | "SPT" | "Umum";

export interface Employee {
  id: string;
  name: string;
  nip: string;
  position: string;
  avatar?: string;
  role?: "admin" | "verifikator" | "pegawai";
  lkhStatus: "uploaded" | "pending";
  lkbStatus: "uploaded" | "pending";
  sptStatus: "uploaded" | "pending";
  lkhCancelNote?: string;
  lkbCancelNote?: string;
  sptCancelNote?: string;
  lastLkhUpload: string | null;
  lastLkbUpload: string | null;
  lastSptUpload: string | null;
}

export interface ArchiveFile {
  id: string;
  name: string;
  category: FileCategory;
  fileSize: string;
  uploadedBy: string;
  nip: string;
  gdriveId: string;
  description: string; // Contains metadata structure
  createdAt: string;
  type: DocType;
}

export interface SyncItem {
  id: string;
  action: "upload" | "toggle_status";
  payload: any;
  timestamp: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: "info" | "success" | "warning";
  createdAt: string;
}

export interface AnalyticsStats {
  totalEmployees: number;
  completedLkhToday: number;
  pendingLkhToday: number;
  completedLkbMonth: number;
  pendingLkbMonth: number;
  totalArchives: number;
  categoryDistribution: {
    PDF: number;
    Word: number;
    Excel: number;
    Foto: number;
    Video: number;
  };
  monthlyUploadTrend: {
    label: string;
    count: number;
  }[];
}
