export interface GDriveFolder {
  id: string;
  name: string;
}

export function getPreviousMonthFolderInfo(date: Date = new Date()) {
  const INDONESIAN_MONTHS = [
    "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
    "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"
  ];
  
  let month = date.getMonth() - 1;
  let year = date.getFullYear();
  if (month < 0) {
    month = 11;
    year -= 1;
  }
  
  const monthName = INDONESIAN_MONTHS[month];
  const folderName = `${monthName} ${year}`;
  
  return {
    monthIndex: month + 1,
    monthName,
    year,
    folderName,
  };
}

export function formatArchiveFileName(
  docType: string,
  nip: string,
  monthName: string,
  year: number,
  originalFileName: string
): string {
  let prefix = "LKH";
  const upperDoc = docType.toUpperCase();
  if (upperDoc.includes("SPT") || upperDoc.includes("TAHUNAN")) {
    prefix = "SPT";
  } else if (upperDoc.includes("LKB") || upperDoc.includes("BULANAN")) {
    prefix = "LKB";
  } else if (upperDoc.includes("LKH") || upperDoc.includes("HARIAN")) {
    prefix = "LKH";
  } else {
    prefix = docType.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
  }

  const extMatch = originalFileName.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? `.${extMatch[1]}` : ".pdf";

  return `${prefix}_${nip}_${monthName}_${year}${ext}`;
}

export function getDocTypeSubfolderName(docType: string): string {
  return docType.toUpperCase();
}

// Dilewati langsung ke root Drive untuk menghindari error 403 Forbidden
export async function getOrCreateGDriveFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<GDriveFolder> {
  if (!accessToken) {
    throw new Error("Token akses Google Drive kosong. Silakan masuk ulang.");
  }

  const body: any = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };

  if (parentFolderId) {
    body.parents = [parentFolderId];
  }

  const response = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gagal membuat folder Google Drive (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return { id: data.id, name: data.name };
}

export async function uploadToGDrive(
  accessToken: string,
  file: File,
  metadata: { name: string; parents: string[]; description?: string }
): Promise<{ id: string; name: string }> {
  if (!accessToken) {
    throw new Error("Token akses Google Drive kosong. Silakan hubungkan ulang Google Drive.");
  }

  const boundary = "-------314159265358979323846";
  const contentType = file.type || "application/octet-stream";
  const cleanMetadata: { name: string; description?: string; parents?: string[] } = {
    name: metadata.name,
  };

  if (metadata.description) {
    cleanMetadata.description = metadata.description;
  }

  if (metadata.parents?.length) {
    cleanMetadata.parents = metadata.parents;
  }

  const metadataPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(cleanMetadata)}\r\n`;
  const fileHeader = `--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body = new Blob([
    metadataPart,
    fileHeader,
    file,
    closeDelimiter,
  ]);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name&supportsAllDrives=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Drive upload rejected (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return { id: data.id, name: data.name };
}

export async function verifyGDriveFolder(
  accessToken: string,
  folderId: string
): Promise<{ id: string; name: string }> {
  if (!accessToken) {
    throw new Error("Token akses Google Drive kosong. Silakan hubungkan ulang Google Drive.");
  }

  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name&supportsAllDrives=true`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Folder Google Drive tidak dapat diakses (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return { id: data.id, name: data.name };
}

export async function listGDriveFolders(accessToken: string): Promise<GDriveFolder[]> {
  if (!accessToken) {
    throw new Error("Token akses Google Drive kosong. Silakan masuk ulang.");
  }

  const query = encodeURIComponent("mimeType = 'application/vnd.google-apps.folder' and trashed = false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=200&supportsAllDrives=true`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gagal mengambil folder Google Drive (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return (data.files || []).map((file: any) => ({ id: file.id, name: file.name }));
}

export async function createGDriveFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<GDriveFolder> {
  if (!accessToken) {
    throw new Error("Token akses Google Drive kosong. Silakan masuk ulang.");
  }

  const body: any = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };

  if (parentFolderId) {
    body.parents = [parentFolderId];
  }

  const response = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gagal membuat folder Google Drive (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return { id: data.id, name: data.name };
}