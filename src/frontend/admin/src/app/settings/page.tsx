"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type PaymentConfig = {
  depositEnabled: boolean;
  withdrawEnabled: boolean;
  depositMethods: {
    BANK: boolean;
    CARD: boolean;
    CRYPTO: boolean;
  };
  withdrawMethods: {
    BANK: boolean;
    CARD: boolean;
    CRYPTO: boolean;
  };
  bank: {
    iban: string;
    beneficiaryName: string;
  };
  crypto: {
    address: string;
    network: string;
  };
};

export default function AdminSettingsPage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const t = window.localStorage.getItem("adminAccessToken");
    const email = window.localStorage.getItem("adminEmail");

    if (!t) {
      router.push("/login");
      return;
    }

    setToken(t);
    setAdminEmail(email);
  }, [router]);

  async function loadConfig() {
    if (!token) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${API}/admin/config/payments`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Ödeme ayarları alınamadı");
      }

      const data = await res.json();

      const cfg: PaymentConfig = data.value ?? data;
      setConfig(cfg);
    } catch (e: any) {
      setError(e?.message ?? "Ödeme ayarları alınamadı");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadConfig();
  }, [token]);

  function handleLogout() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("adminAccessToken");
      window.localStorage.removeItem("adminEmail");
    }
    router.push("/login");
  }

  function updateConfig<K extends keyof PaymentConfig>(
    key: K,
    value: PaymentConfig[K],
  ) {
    if (!config) return;
    setConfig({ ...config, [key]: value });
  }

  function toggleDepositMethod(method: "BANK" | "CARD" | "CRYPTO") {
    if (!config) return;
    updateConfig("depositMethods", {
      ...config.depositMethods,
      [method]: !config.depositMethods[method],
    });
  }

  function toggleWithdrawMethod(method: "BANK" | "CARD" | "CRYPTO") {
    if (!config) return;
    updateConfig("withdrawMethods", {
      ...config.withdrawMethods,
      [method]: !config.withdrawMethods[method],
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !config) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${API}/admin/config/payments`, {
        method: "POST", // backend PUT yapıyorsan burayı PUT yap
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Ayarlar kaydedilemedi");
      }

      setSuccess("Ödeme ayarları kaydedildi.");
    } catch (e: any) {
      setError(e?.message ?? "Ayarlar kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05080c] text-white">
        <div className="text-sm text-white/60">Yönlendiriliyor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05080c] text-white">
      <div className="flex">
        {/* SOL SİDEBAR – Requests/Logs ile aynı stil */}
        <aside className="hidden md:flex md:w-72 lg:w-80 flex-col gap-4 border-r border-white/10 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold">
              {adminEmail ? adminEmail[0]?.toUpperCase() : "A"}
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-white/50">Admin</span>
              <span className="text-xs font-medium">
                {adminEmail ?? "admin@local.test"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-4">
            <button
              className="w-full text-left px-3 py-2 rounded border border-white/10 text-xs hover:bg-white/5"
              onClick={() => router.push("/requests")}
            >
              Talepler
            </button>
            <button
              className="w-full text-left px-3 py-2 rounded border border-white/10 text-xs bg-white/10"
              onClick={() => router.push("/settings")}
            >
              Ödeme Ayarları
            </button>
            <button
              className="w-full text-left px-3 py-2 rounded border border-white/10 text-xs hover:bg-white/5"
              onClick={() => router.push("/dashboard")}
            >
              Dashboard
            </button>
            <button
              className="w-full text-left px-3 py-2 rounded border border-white/10 text-xs hover:bg-white/5"
              onClick={() => router.push("/logs")}
            >
              Loglar
            </button>

            <button
              className="w-full text-left px-3 py-2 rounded border border-white/10 text-xs hover:bg-white/5"
              onClick={handleLogout}
            >
              Çıkış
            </button>
          </div>

          <div className="mt-6 text-[11px] text-white/50 space-y-2">
            <div>
              <span className="font-semibold text-white/70">
                Bağlantı durumu:
              </span>{" "}
              Online
            </div>
            <div className="flex items-center justify-between">
              <span>Karanlık mod</span>
              <span className="px-2 py-1 rounded-full border border-white/15 text-[10px]">
                Aktif
              </span>
            </div>
          </div>
        </aside>

        {/* SAĞ ANA İÇERİK */}
        <main className="flex-1 px-4 md:px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl">Ödeme Ayarları</h1>
              <div className="text-xs text-white/50">
                Yatırım / çekim işlemlerini aç / kapa ve IBAN / kripto
                bilgilerini güncelle.
              </div>
            </div>

            <button
              onClick={loadConfig}
              className="px-3 py-2 rounded border border-white/20 text-xs hover:bg-white/5"
            >
              Yenile
            </button>
          </div>

          {error && (
            <div className="mb-3 text-xs text-red-200 border border-red-400/40 bg-red-500/10 p-3 rounded">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-3 text-xs text-emerald-200 border border-emerald-400/40 bg-emerald-500/10 p-3 rounded">
              {success}
            </div>
          )}

          {loading && !config && (
            <div className="text-sm text-white/60">Yükleniyor...</div>
          )}

          {config && (
            <form
              onSubmit={handleSave}
              className="space-y-6 text-xs max-w-3xl"
            >
              {/* Genel aç/kapa */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-sm font-semibold mb-3">
                  Genel Durum & Limitler
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex items-center justify-between gap-3 text-[11px]">
                    <span>Yatırım işlemleri aktif</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-white/40 bg-transparent"
                      checked={config.depositEnabled}
                      onChange={(e) =>
                        updateConfig("depositEnabled", e.target.checked)
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-[11px]">
                    <span>Çekim işlemleri aktif</span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-white/40 bg-transparent"
                      checked={config.withdrawEnabled}
                      onChange={(e) =>
                        updateConfig("withdrawEnabled", e.target.checked)
                      }
                    />
                  </label>
                </div>
              </section>

              {/* Yatırım yöntemleri */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-sm font-semibold mb-2">
                  Yatırım Yöntemleri
                </h2>
                <p className="text-[11px] text-white/50 mb-3">
                  Kullanıcının göreceği yatırım seçenekleri. Kapalı olan
                  yöntemler kullanıcıya uyarı ile gösterilir.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => toggleDepositMethod("BANK")}
                    className={[
                      "px-3 py-1.5 rounded-full border text-[11px] transition-colors",
                      config.depositMethods.BANK
                        ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                        : "border-white/20 bg-white/5 text-white/70",
                    ].join(" ")}
                  >
                    Banka
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleDepositMethod("CARD")}
                    className={[
                      "px-3 py-1.5 rounded-full border text-[11px] transition-colors",
                      config.depositMethods.CARD
                        ? "border-sky-400/60 bg-sky-500/15 text-sky-100"
                        : "border-white/20 bg-white/5 text-white/70",
                    ].join(" ")}
                  >
                    Kart
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleDepositMethod("CRYPTO")}
                    className={[
                      "px-3 py-1.5 rounded-full border text-[11px] transition-colors",
                      config.depositMethods.CRYPTO
                        ? "border-purple-400/60 bg-purple-500/15 text-purple-100"
                        : "border-white/20 bg-white/5 text-white/70",
                    ].join(" ")}
                  >
                    Kripto
                  </button>
                </div>
              </section>

              {/* Çekim yöntemleri */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-sm font-semibold mb-2">
                  Çekim Yöntemleri
                </h2>
                <p className="text-[11px] text-white/50 mb-3">
                  Bakiyenin çekilebileceği yöntemler. Kapalı yöntemler kullanıcı
                  tarafında kullanılamaz.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => toggleWithdrawMethod("BANK")}
                    className={[
                      "px-3 py-1.5 rounded-full border text-[11px] transition-colors",
                      config.withdrawMethods.BANK
                        ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                        : "border-white/20 bg-white/5 text-white/70",
                    ].join(" ")}
                  >
                    Banka
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleWithdrawMethod("CARD")}
                    className={[
                      "px-3 py-1.5 rounded-full border text-[11px] transition-colors",
                      config.withdrawMethods.CARD
                        ? "border-sky-400/60 bg-sky-500/15 text-sky-100"
                        : "border-white/20 bg-white/5 text-white/70",
                    ].join(" ")}
                  >
                    Kart
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleWithdrawMethod("CRYPTO")}
                    className={[
                      "px-3 py-1.5 rounded-full border text-[11px] transition-colors",
                      config.withdrawMethods.CRYPTO
                        ? "border-purple-400/60 bg-purple-500/15 text-purple-100"
                        : "border-white/20 bg-white/5 text-white/70",
                    ].join(" ")}
                  >
                    Kripto
                  </button>
                </div>
              </section>

              {/* Banka bilgileri */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-sm font-semibold mb-2">
                  Banka Bilgileri (Yatırım)
                </h2>
                <p className="text-[11px] text-white/50 mb-3">
                  Kullanıcılar yatırım ekranında bu IBAN ve alıcı adını görür.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-white/60 mb-1">
                      IBAN
                    </label>
                    <input
                      className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs outline-none focus:border-white/70 font-mono"
                      value={config.bank.iban}
                      onChange={(e) =>
                        updateConfig("bank", {
                          ...config.bank,
                          iban: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-white/60 mb-1">
                      Alıcı Ad Soyad
                    </label>
                    <input
                      className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs outline-none focus:border-white/70"
                      value={config.bank.beneficiaryName}
                      onChange={(e) =>
                        updateConfig("bank", {
                          ...config.bank,
                          beneficiaryName: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </section>

              {/* Kripto bilgileri */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h2 className="text-sm font-semibold mb-2">
                  Kripto Bilgileri (Yatırım)
                </h2>
                <p className="text-[11px] text-white/50 mb-3">
                  Kullanıcılar kripto ile yatırım yaparken bu adres ve ağı
                  kullanır.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-white/60 mb-1">
                      Cüzdan Adresi
                    </label>
                    <input
                      className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs outline-none focus:border-white/70 font-mono"
                      value={config.crypto.address}
                      onChange={(e) =>
                        updateConfig("crypto", {
                          ...config.crypto,
                          address: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-white/60 mb-1">
                      Ağ (Network)
                    </label>
                    <input
                      className="w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs outline-none focus:border-white/70"
                      value={config.crypto.network}
                      onChange={(e) =>
                        updateConfig("crypto", {
                          ...config.crypto,
                          network: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </section>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-black shadow-md shadow-emerald-900/60 disabled:opacity-50"
                >
                  {saving ? "Kaydediliyor..." : "Ayarları Kaydet"}
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
