"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type AuthResponse = {
  accessToken: string;
  email: string;
};

export default function UserRegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Zaten login ise burada durma
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = window.localStorage.getItem("userAccessToken");
    if (token) {
      router.replace("/");
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || !password2) {
      setError("Tüm alanlar zorunludur.");
      return;
    }
    if (password !== password2) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalıdır.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`${API}/auth/user/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Kayıt işlemi başarısız.");
      }

      const data = (await res.json()) as AuthResponse;

      if (typeof window !== "undefined") {
        window.localStorage.setItem("userAccessToken", data.accessToken);
        window.localStorage.setItem("userEmail", data.email ?? email);
      }

      router.replace("/");
    } catch (e: any) {
      setError(e?.message ?? "Kayıt sırasında hata oluştu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#02040a] via-[#050814] to-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-wide">
            ValerPay Hesap Oluştur
          </h1>
          <p className="text-xs text-white/60">
            Cüzdan oluşturmak ve TL bakiyesi tutmak için hızlıca kayıt ol.
          </p>
        </div>

        <div className="rounded-2xl border border-white/15 bg-black/50 backdrop-blur px-6 py-5 shadow-xl shadow-black/60">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1 text-xs">
              <label className="block text-white/70">E-posta</label>
              <input
                type="email"
                className="w-full rounded-md bg-black/60 border border-white/20 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@mail.com"
                autoComplete="email"
              />
            </div>

            <div className="space-y-1 text-xs">
              <label className="block text-white/70">Şifre</label>
              <input
                type="password"
                className="w-full rounded-md bg-black/60 border border-white/20 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1 text-xs">
              <label className="block text-white/70">Şifre (Tekrar)</label>
              <input
                type="password"
                className="w-full rounded-md bg-black/60 border border-white/20 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="text-[11px] text-red-200 border border-red-500/40 bg-red-500/10 rounded px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-xs font-semibold px-3 py-2 shadow-md shadow-emerald-600/40 transition"
            >
              {busy ? "Kayıt olunuyor..." : "Kayıt Ol"}
            </button>
          </form>

          <div className="mt-4 text-[11px] text-white/60 text-center">
            Zaten hesabın var mı?{" "}
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
            >
              Giriş yap
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
