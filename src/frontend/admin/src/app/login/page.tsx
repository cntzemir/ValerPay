"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@local.test");
  const [password, setPassword] = useState("Admin123!");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Email ve şifre zorunlu.");
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch(`${API}/auth/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        try {
          const json = JSON.parse(txt);
          throw new Error((json.message ?? txt) || "Giriş başarısız.");
        } catch {
          throw new Error(txt || "Giriş başarısız.");
        }
      }

      const data = await res.json();

      if (!data?.accessToken) {
        throw new Error("Sunucudan token alınamadı.");
      }

      window.localStorage.setItem("adminAccessToken", data.accessToken);
      window.localStorage.setItem("adminEmail", email);

      router.push("/requests");
    } catch (e: any) {
      setError(e?.message ?? "Giriş başarısız.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05080c] text-white">
      <div className="w-full max-w-sm border border-white/10 rounded-lg p-6 bg-black/60">
        <h1 className="text-xl mb-1">ValerPay Admin</h1>
        <p className="text-xs text-white/50 mb-4">Admin panel girişi (dev)</p>

        {error && (
          <div className="mb-3 text-xs text-red-300 border border-red-400/40 bg-red-500/10 rounded px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <div>
            <label className="block text-xs text-white/60 mb-1">Email</label>
            <input
              className="w-full bg-black/40 border border-white/15 rounded px-3 py-2 text-sm"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">Şifre</label>
            <input
              className="w-full bg-black/40 border border-white/15 rounded px-3 py-2 text-sm"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold disabled:bg-emerald-900/60 disabled:cursor-not-allowed"
          >
            {submitting ? "Giriş yapılıyor..." : "Giriş Yap"}
          </button>
        </form>

        <div className="mt-3 text-[10px] text-white/40">
          Dev admin: admin@local.test / Admin123!
        </div>
      </div>
    </div>
  );
}
