export interface AdminWaContact {
  name: string;
  phone: string;
  displayPhone: string;
  role: string;
}

export const ADMIN_WA_CONTACTS: AdminWaContact[] = [
  {
    name: "Siradjuddin",
    phone: "6282251392492",
    displayPhone: "082251392492",
    role: "Admin Verifikator"
  },
  {
    name: "Imanuddin",
    phone: "6282149814580",
    displayPhone: "082149814580",
    role: "Admin Verifikator"
  }
];

export function createUploadWaMessage(data: {
  employeeName: string;
  nip: string;
  docType: string;
  fileName: string;
  uploadTime?: string;
  description?: string;
}): string {
  const timeStr = data.uploadTime || new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  
  let msg = `*PEMBERITAHUAN UNGGAH DOKUMEN* 📄\n*Portal Arsip Kemenag Mempawah*\n\nHalo Admin Verifikator,\n\nPegawai berikut telah mengunggah dokumen baru dan memerlukan verifikasi:\n\n👤 *Nama*: ${data.employeeName}\n🆔 *NIP*: ${data.nip}\n📑 *Jenis Laporan*: ${data.docType}\n📁 *Nama Berkas*: ${data.fileName}\n⏰ *Waktu Upload*: ${timeStr}`;

  if (data.description) {
    msg += `\n📝 *Keterangan*: ${data.description}`;
  }

  msg += `\n\nMohon segera dapat diperiksa dan ditindaklanjuti verifikasinya melalui Portal Arsip Kemenag Mempawah.\nTerima kasih.`;
  return msg;
}

export function createCancellationWaMessage(data: {
  employeeName: string;
  nip: string;
  docType: string;
  cancelNote: string;
}): string {
  return `*PEMBERITAHUAN PERBAIKAN BERKAS* ⚠️\n*Portal Arsip Kemenag Mempawah*\n\nHalo ${data.employeeName} (NIP: ${data.nip}),\n\nStatus verifikasi dokumen *${data.docType}* Anda membutuhkan perbaikan oleh Admin Verifikator.\n\n📌 *Catatan Perbaikan*:\n"${data.cancelNote}"\n\nMohon segera melengkapi/memperbaiki berkas dan mengunggah ulang di Portal Arsip Kemenag Mempawah.\nTerima kasih.`;
}

export function getWhatsAppUrl(phoneNumber: string, message: string): string {
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, "");
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

export function openWhatsApp(phoneNumber: string, message: string): void {
  const url = getWhatsAppUrl(phoneNumber, message);
  window.open(url, "_blank");
}
