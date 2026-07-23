export interface GDriveFolder {
  id: string;
  name: string;
}

export function getPreviousMonthFolderInfo(date: Date = new Date()) {
  const INDONESIAN_MONTHS = [
    "JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI",
    "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"
  ];
  
  let month = date.getMonth() - 1; // 0-indexed, -1 is previous month
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
    folderName, // e.g. "JUNI 2026"
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

  // Extract file extension
  const extMatch = originalFileName.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? `.${extMatch[1]}` : ".pdf";

  return `${prefix}_${nip}_${monthName}_${year}${ext}`;
}

export function getDocTypeSubfolderName(docType: string): string {
  const upper = docType.toUpperCase();
  if (upper.includes("SPT") || upper.includes("TAHUNAN")) {
    return "SPT_Tahunan";
  }
  if (upper.includes("LKH") || upper.includes("HARIAN")) {
    return "LKH";
  }
  if (upper.includes("LKB") || upper.includes("BULANAN")) {
    return "LKB";
  }
  return "Arsip_Lainnya";
}

export async function getOrCreateGDriveFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<GDriveFolder> {
  if (!accessToken) {
    throw new Error("Token akses Google Drive tidak tersedia. Silakan hubungkan ulang Google Drive Anda.");
  }

  try {
    const safeName = folderName.replace(/'/g, "\\'");
    let query = `mimeType='application/vnd.google-apps.folder' and name='${safeName}' and trashed=false`;
    if (parentFolderId) {
      query += ` and '${parentFolderId}' in parents`;
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name)&pageSize=10`,
      {
        headers: {
          Authorization: `Bearer ${accessToken.trim()}`,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.files && data.files.length > 0) {
        return data.files[0];
      }
    } else if (response.status === 401) {
      throw new Error("Sesi Google Drive kedaluwarsa atau tidak sah. Silakan hubungkan ulang akun Google Anda.");
    }

    // Folder doesn't exist yet, create it
    const createBody: { name: string; mimeType: string; parents?: string[] } = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    };
    if (parentFolderId) {
      createBody.parents = [parentFolderId];
    }

    const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createBody),
    });

    if (!createRes.ok) {
      const errDetail = await createRes.text();
      throw new Error(`Gagal membuat folder '${folderName}' di Google Drive: ${errDetail}`);
    }

    return await createRes.json();
  } catch (error) {
    console.error("Error in getOrCreateGDriveFolder:", error);
    throw error;
  }
}

export async function uploadToGDrive(
  accessToken: string,
  file: File,
  metadata: { name: string; parents: string[]; description?: string }
): Promise<{ id: string; name: string }> {
  if (!accessToken) {
    throw new Error("Token akses Google Drive kosong. Pastikan Anda sudah menekan tombol 'Hubungkan Google Drive'.");
  }

  const boundary = "3d9f10a7bc2a5";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const reader = new FileReader();

  return new Promise<{ id: string; name: string }>((resolve, reject) => {
    reader.onload = async () => {
      try {
        const contentType = file.type || "application/octet-stream";
        const metadataPart = JSON.stringify(metadata);

        // Convert file ArrayBuffer to binary string then Base64
        const bytes = new Uint8Array(reader.result as ArrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);

        const body =
          delimiter +
          "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
          metadataPart +
          delimiter +
          "Content-Type: " + contentType + "\r\n" +
          "Content-Transfer-Encoding: base64\r\n\r\n" +
          base64Data +
          closeDelimiter;

        const response = await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken.trim()}`,
              "Content-Type": `multipart/related; boundary=${boundary}`,
            },
            body: body,
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Google Drive upload rejected (${response.status}): ${errText}`);
        }

        const data = await response.json();
        resolve({ id: data.id, name: data.name });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Gagal membaca berkas file lokal."));
    reader.readAsArrayBuffer(file);
  });
}

export async function listGDriveFolders(accessToken: string): Promise<GDriveFolder[]> {
  if (!accessToken) return [];
  try {
    const response = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id, name)&pageSize=100",
      {
        headers: {
          Authorization: `Bearer ${accessToken.trim()}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Gagal memuat folder dari Google Drive: ${response.statusText}`);
    }

    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error("Error listing folders:", error);
    return [];
  }
}

export async function createGDriveFolder(
  accessToken: string,
  folderName: string
): Promise<GDriveFolder> {
  if (!accessToken) {
    throw new Error("Token akses Google Drive tidak tersedia.");
  }
  try {
    const response = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      }),
    });

    if (!response.ok) {
      throw new Error(`Gagal membuat folder Google Drive: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating folder:", error);
    throw error;
  }
}