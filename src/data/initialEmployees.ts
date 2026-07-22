import { Employee } from "../types";
import { RAW_EMPLOYEES_DATA } from "./rawEmployees";

export function cleanName(rawName: string): string {
  // 1. Strip the numbering prefix, e.g., "1. "
  let name = rawName.replace(/^\d+\.\s*/, "").trim();

  // 2. Strip standard front academic/religious titles (gelar depan) - loops to catch nested ones
  const prefixRegex = /^(H\.|Hj\.|Drs\.|Dra\.|H\s+|Hj\s+|Drs\s+|Dra\s+|Drs\.\s+|Dra\.\s+|Hj\.\s+Hj\.\s*)/gi;
  let prevName = "";
  while (prevName !== name) {
    prevName = name;
    name = name.replace(prefixRegex, "").trim();
  }

  // 3. Strip suffix academic/professional titles (gelar belakang)
  const suffixPatterns = [
    /,\s*M\.Pd\.?\s*K/gi,
    /,\s*S\.Pd\.?\s*K/gi,
    /,\s*M\.Pd\.?\s*I/gi,
    /,\s*S\.Pd\.?\s*I/gi,
    /,\s*S\.Pd\.?\s*SD/gi,
    /,\s*S\.Pd\.?\s*B/gi,
    /,\s*S\.Pd\.?\s*Ing/gi,
    /,\s*S\.S\.T\.Ars/gi,
    /,\s*A\.Md\.A\.Pkt/gi,
    /,\s*S\.E\.Sy/gi,
    /,\s*S\.I\.Pust/gi,
    /,\s*S\.Kom\.I/gi,
    /,\s*S\.Sos\.I/gi,
    /,\s*S\.Th\.I/gi,
    /,\s*S\.H\.I/gi,
    /,\s*S\.A\.P/gi,
    /,\s*S\.Pd/gi,
    /,\s*M\.Pd/gi,
    /,\s*S\.Ag/gi,
    /,\s*S\.H/gi,
    /,\s*S\.E/gi,
    /,\s*S\.P/gi,
    /,\s*M\.E/gi,
    /,\s*BCF/gi,
    /,\s*S\.Sos/gi,
    /,\s*A\.Md/gi,
    /,\s*S\.Th/gi,
    /,\s*S\.S/gi,
    /,\s*A\.Ma/gi,
    /,\s*M\.Si/gi,
    /,\s*MM/gi,
    /,\s*M\.A/gi,
    /,\s*S\.Mn/gi,
    /,\s*S\.T/gi,
    // Space separated patterns (without comma) at the end of string
    /\s+M\.Pd\.?\s*K$/gi,
    /\s+S\.Pd\.?\s*K$/gi,
    /\s+M\.Pd\.?\s*I$/gi,
    /\s+S\.Pd\.?\s*I$/gi,
    /\s+S\.Pd\.?\s*SD$/gi,
    /\s+S\.Pd\.?\s*B$/gi,
    /\s+S\.Pd\.?\s*Ing$/gi,
    /\s+S\.S\.T\.Ars$/gi,
    /\s+A\.Md\.A\.Pkt$/gi,
    /\s+S\.E\.Sy$/gi,
    /\s+S\.I\.Pust$/gi,
    /\s+S\.Kom\.I$/gi,
    /\s+S\.Sos\.I$/gi,
    /\s+S\.Th\.I$/gi,
    /\s+S\.H\.I$/gi,
    /\s+S\.A\.P\.?$/gi,
    /\s+S\.Pd$/gi,
    /\s+M\.Pd$/gi,
    /\s+S\.Ag$/gi,
    /\s+S\.H$/gi,
    /\s+S\.E$/gi,
    /\s+S\.P$/gi,
    /\s+M\.E$/gi,
    /\s+BCF$/gi,
    /\s+S\.Sos$/gi,
    /\s+A\.Md$/gi,
    /\s+S\.Th$/gi,
    /\s+S\.S$/gi,
    /\s+A\.Ma$/gi,
    /\s+M\.Si$/gi,
    /\s+MM$/gi,
    /\s+M\.A$/gi,
    /\s+S\.Mn$/gi,
    /\s+S\.T$/gi,
    // Catch-all patterns for common variations
    /\s+S\.Pd\.?$/gi,
    /\s+M\.Pd\.?$/gi,
    /\s+S\.Ag\.?$/gi,
    /\s+S\.H\.?$/gi,
    /\s+S\.E\.?l?\.?$/gi, // handles S.E.l.
    /\s+S\.P\.?$/gi,
    /\s+S\.A\.P\.?$/gi,
    /\s+S\.Sos\.?$/gi,
    /\s+S\.Kom\.?$/gi,
    /\s+S\.Th\.?$/gi,
    /\s+A\.Md\.?$/gi,
    /\s+A\.Ma\.?$/gi,
    /\s+S\.I\.P\.?$/gi,
    /\s+S\.S\.?$/gi,
    /\s+M\.Si\.?$/gi,
    /\s+M\.E\.?$/gi,
    /\s+M\.A\.?$/gi,
    /\s+S\.Mn\.?$/gi,
    /\s+BCF\.?$/gi,
    /\s+SE$/gi,
    /\s+SH$/gi,
    /\s+SI\.P$/gi,
    /\s+ST$/gi,
  ];

  prevName = "";
  while (prevName !== name) {
    prevName = name;
    for (const pat of suffixPatterns) {
      name = name.replace(pat, "").trim();
    }
    // Clean trailing commas, spaces, or dots that are left over
    name = name.replace(/[,\s.]+$/, "").trim();
  }

  // Final collapse of multiple spaces
  name = name.replace(/\s+/g, " ");

  return name;
}

export function getDynamicPosition(rawLine: string): string {
  return "";
}

export const ADMIN_VERIFIKATOR_NIPS = ["198904092019031008", "199205082023211022"];

export function generateInitialEmployees(): Employee[] {
  return RAW_EMPLOYEES_DATA.map((line, index) => {
    const parts = line.split(":");
    const rawLeft = parts[0]?.trim() || "";
    const nip = parts[1]?.trim() || "";

    // Extract name (without the number prefix e.g. "1. ")
    const rawName = rawLeft.replace(/^\d+\.\s*/, "").trim();
    const cleanedName = cleanName(rawName);
    const position = getDynamicPosition(rawLeft);

    // Seed statuses deterministically to start completely clean for real archive tracking
    const isLkhUploaded = false;
    const isLkbUploaded = false;

    const lastLkhUpload = null;
    const lastLkbUpload = null;

    const isAdminVerifikator = ADMIN_VERIFIKATOR_NIPS.includes(nip);

    return {
      id: `peg-${index + 1}`,
      name: cleanedName,
      nip,
      position,
      role: isAdminVerifikator ? "admin" : "pegawai",
      lkhStatus: isLkhUploaded ? "uploaded" : "pending",
      lkbStatus: isLkbUploaded ? "uploaded" : "pending",
      sptStatus: "pending",
      lastLkhUpload,
      lastLkbUpload,
      lastSptUpload: null
    };
  });
}

export const INITIAL_EMPLOYEES: Employee[] = generateInitialEmployees();
