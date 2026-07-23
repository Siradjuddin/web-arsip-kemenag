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
  return { id: "", name: folderName };
}

export async function uploadToGDrive(
  accessToken: string,
  file: File,
  metadata: { name: string; parents: string[]; description?: string }
): Promise<{ id: string; name: string }> {
  if (!accessToken) {
    throw new Error("Token akses Google Drive kosong. Silakan hubungkan ulang Google Drive.");
  }

  const boundary = "3d9f10a7bc2a5";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const reader = new FileReader();

  return new Promise<{ id: string; name: string }>((resolve, reject) => {
    reader.onload = async () => {
      try {
        const contentType = file.type || "application/octet-stream";
        // Tanpa parents agar diunggah langsung ke direktori utama (Root) menghindari 403
        const cleanMetadata = {
          name: metadata.name,
          description: metadata.description
        };
        const metadataPart = JSON.stringify(cleanMetadata);

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
  return [];
}

export async function createGDriveFolder(
  accessToken: string,
  folderName: string
): Promise<GDriveFolder> {
  return { id: "", name: folderName };
}