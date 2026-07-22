import React, { useState } from "react";
import { User, Lock, Camera, CheckCircle2, AlertCircle, ShieldCheck, Key, Image as ImageIcon, Upload, FileText, Sparkles } from "lucide-react";
import { Employee } from "../types";

interface UserProfileProps {
  employee: Employee;
  onUpdateEmployee: (updated: Employee) => void;
  onTriggerNotification?: (title: string, body: string, type: "info" | "success" | "warning") => void;
}

export default function UserProfile({ employee, onUpdateEmployee, onTriggerNotification }: UserProfileProps) {
  // Photo update state
  const [avatarPreview, setAvatarPreview] = useState<string>(employee.avatar || "");
  const [photoSaved, setPhotoSaved] = useState<boolean>(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Handle local image file upload for profile photo
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    setPhotoSaved(false);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setPhotoError("Format berkas harus berupa gambar (JPG, PNG, WEBP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Ukuran gambar maksimal adalah 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Save new photo
  const handleSavePhoto = () => {
    setPhotoError(null);
    const updatedEmp: Employee = {
      ...employee,
      avatar: avatarPreview,
    };
    onUpdateEmployee(updatedEmp);
    setPhotoSaved(true);
    if (onTriggerNotification) {
      onTriggerNotification("Foto Profil Diperbarui", "Foto profil Anda berhasil disimpan secara lokal.", "success");
    }
    setTimeout(() => setPhotoSaved(false), 4000);
  };

  // Save new password
  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    const cleanCurrent = currentPassword.trim();
    const cleanNew = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanCurrent || !cleanNew || !cleanConfirm) {
      setPasswordError("Semua kolom kata sandi wajib diisi.");
      return;
    }

    // Check current password
    const customPasswords = JSON.parse(localStorage.getItem("kemenag_custom_passwords") || "{}");
    const storedPass = customPasswords[employee.nip] || employee.nip;

    if (cleanCurrent !== storedPass) {
      setPasswordError("Kata sandi saat ini tidak cocok.");
      return;
    }

    if (cleanNew.length < 4) {
      setPasswordError("Kata sandi baru minimal harus 4 karakter.");
      return;
    }

    if (cleanNew !== cleanConfirm) {
      setPasswordError("Konfirmasi kata sandi baru tidak cocok.");
      return;
    }

    // Save to localStorage custom passwords map
    customPasswords[employee.nip] = cleanNew;
    localStorage.setItem("kemenag_custom_passwords", JSON.stringify(customPasswords));

    setPasswordSuccess("Kata sandi berhasil diubah! Gunakan kata sandi baru untuk login selanjutnya.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");

    if (onTriggerNotification) {
      onTriggerNotification("Kata Sandi Diperbarui", "Kata sandi login Anda telah berhasil diubah.", "success");
    }
  };

  const isAdmin = ["198904092019031008", "199205082023211022"].includes(employee.nip) || employee.role === "admin";

  return (
    <div id="user-profile-tab" className="space-y-6">
      {/* 1. Header Card - Profile Info */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="absolute -right-10 -top-10 h-40 w-40 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar display */}
          <div className="relative group shrink-0">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt={employee.name}
                className="h-24 w-24 rounded-2xl object-cover border-2 border-blue-500 shadow-md"
              />
            ) : (
              <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-extrabold text-2xl shadow-md border-2 border-blue-400">
                {employee.name.charAt(0)}
              </div>
            )}
            <label
              htmlFor="avatar-file-input"
              className="absolute -bottom-2 -right-2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-xl shadow-md cursor-pointer transition-transform group-hover:scale-105"
              title="Ubah Foto Profil"
            >
              <Camera className="h-4 w-4" />
            </label>
          </div>

          {/* User Meta */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                {employee.name}
              </h2>
              {isAdmin ? (
                <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                  Admin Verifikator
                </span>
              ) : (
                <span className="bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-blue-300 dark:border-blue-800">
                  Pegawai Kemenag
                </span>
              )}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <p className="font-mono">
                <span className="font-semibold text-slate-700 dark:text-slate-300">NIP:</span> {employee.nip}
              </p>
              <p>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Jabatan:</span> {employee.position}
              </p>
              <p>
                <span className="font-semibold text-slate-700 dark:text-slate-300">Unit Kerja:</span> Kantor Kementerian Agama Kab. Mempawah
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 2. Photo Settings Box */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                Ubah Foto Profil
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Unggah pasfoto terbaru Anda untuk identitas akun.
              </p>
            </div>
          </div>

          {photoSaved && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Foto profil berhasil diperbarui!</span>
            </div>
          )}

          {photoError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{photoError}</span>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Preview"
                  className="h-16 w-16 rounded-xl object-cover border border-slate-300 dark:border-slate-700"
                />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                  <User className="h-8 w-8" />
                </div>
              )}

              <div className="flex-1 space-y-2">
                <label
                  htmlFor="avatar-file-input"
                  className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs px-3.5 py-2 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  <Upload className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>Pilih Berkas Foto</span>
                </label>
                <input
                  id="avatar-file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
                <p className="text-[10px] text-slate-400">
                  Format JPG, PNG, atau WEBP (Maksimal 5MB).
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                id="btn-save-photo"
                onClick={handleSavePhoto}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                Simpan Foto Profil
              </button>
            </div>
          </div>
        </div>

        {/* 3. Password Settings Box */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                Ubah Kata Sandi Login
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Perbarui kata sandi akun Anda demi keamanan data kearsipan.
              </p>
            </div>
          </div>

          {passwordSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {passwordError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleSavePassword} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Kata Sandi Saat Ini
              </label>
              <input
                id="profile-current-password"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Masukkan kata sandi lama / NIP"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Kata Sandi Baru
              </label>
              <input
                id="profile-new-password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Masukkan kata sandi baru (min. 4 karakter)"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Konfirmasi Kata Sandi Baru
              </label>
              <input
                id="profile-confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi kata sandi baru"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                id="btn-save-password"
                type="submit"
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Lock className="h-4 w-4" />
                Ubah Kata Sandi
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
