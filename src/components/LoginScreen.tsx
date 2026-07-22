import React, { useState } from "react";
import { BookOpen, User, Lock, Eye, EyeOff, AlertCircle, LogIn } from "lucide-react";
import { Employee } from "../types";
import { motion } from "motion/react";

interface LoginScreenProps {
  employees: Employee[];
  onLoginSuccess: (employee: Employee) => void;
}

export default function LoginScreen({ employees, onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setError("NIP dan Kata Sandi wajib diisi.");
      return;
    }

    // Find employee by NIP (username)
    const employee = employees.find((emp) => emp.nip === cleanUsername);

    if (!employee) {
      setError("NIP tidak ditemukan dalam database pegawai.");
      return;
    }

    // Check custom passwords if set, or default to NIP matching
    const customPasswords = JSON.parse(localStorage.getItem("kemenag_custom_passwords") || "{}");
    const expectedPassword = customPasswords[employee.nip] || employee.nip;

    if (cleanPassword !== expectedPassword) {
      setError("Kata sandi salah. Silakan periksa kembali kata sandi Anda.");
      return;
    }

    // Login success
    onLoginSuccess(employee);
  };

  return (
    <div id="login-container" className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-xl space-y-6"
      >
        {/* Brand/Header */}
        <div className="flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-full bg-emerald-800 dark:bg-emerald-750 flex items-center justify-center mb-4 text-amber-400 font-extrabold text-lg border border-amber-500 shadow-md">
            <BookOpen className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
            Arsip Digital Kemenag Mempawah
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
            Kantor Kementerian Agama Kabupaten Mempawah. Masuk dengan NIP Pegawai Anda.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-150 dark:border-red-900/30 rounded-xl text-red-600 dark:text-red-400 text-xs flex items-start gap-2.5"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              NIP / Nomor Induk Pegawai
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <User className="h-4 w-4" />
              </span>
              <input
                id="login-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan NIP Pegawai"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Kata Sandi Login
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock className="h-4 w-4" />
              </span>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan Kata Sandi"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            id="btn-submit-login"
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all text-sm cursor-pointer"
          >
            <LogIn className="h-4 w-4" />
            Masuk ke Aplikasi
          </button>
        </form>

        <div className="border-t border-slate-100 dark:border-slate-800 pt-3 text-center">
          <p className="text-[11px] text-slate-400">
            Kata sandi default adalah NIP Anda (dapat diubah di menu Profil).
          </p>
        </div>
      </motion.div>
    </div>
  );
}
