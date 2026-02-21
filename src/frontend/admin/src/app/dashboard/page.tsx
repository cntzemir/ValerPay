"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type DailyReport = {
  generatedAt: string;
  totalDepositsMinor: string;
  totalWithdrawsMinor: string;
  pendingCount: number;
  completedCount: number;
  systemCashMinor: string;
};

type LedgerLine = {
  dc: string; 
  amountMinor: string;
  accountType: string; 
  asset: string;
  userEmail: string | null;
};

type LedgerEntryRow = {
  id: string;
  requestId: string | null;
  memo: string | null;
  createdAt: string;
  lines: LedgerLine[];
};

function moneyFromMinor(minor: string | null | undefined, suffix = "TL") {
  if (!minor) return "-";
  const n = Number(minor);
  if (!Number.isFinite(n)) return "-";
  return `${(n / 100).toFixed(2)} ${suffix}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function userSignedAmount(entry: LedgerEntryRow): string {
  const line = entry.lines.find((l) => l.accountType === "USER_WALLET");
  if (!line) return "-";

  const n = Number(line.amountMinor);
  if (!Number.isFinite(n)) return "-";

  const sign = line.dc === "DEBIT" ? "+" : "-";
  return `${sign}${(n / 100).toFixed(2)} ${line.asset}`;
}

function userEmailFromEntry(entry: LedgerEntryRow): string {
  const line = entry.lines.find((l) => !!l.userEmail);
  return line?.userEmail ?? "-";
}

export default function ReportsPage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  const [daily, setDaily] = useState<DailyReport | null>(null);
  const [ledgerRows, setLedgerRows] = useState<LedgerEntryRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  async function loadData() {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const [dailyRes, ledgerRes] = await Promise.all([
        fetch(`${API}/admin/reports/daily`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API}/admin/ledger/entries?limit=30`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!dailyRes.ok) {
        const txt = await dailyRes.text().catch(() => "");
        throw new Error(txt || "Günlük özet yüklenemedi");
      }
      if (!ledgerRes.ok) {
        const txt = await ledgerRes.text().catch(() => "");
        throw new Error(txt || "Ledger hareketleri yüklenemedi");
      }

      const dailyJson = (await dailyRes.json()) as DailyReport;
      const ledgerJson = await ledgerRes.json();
      const ledgerList: LedgerEntryRow[] = Array.isArray(ledgerJson.value)
        ? ledgerJson.value
        : [];

      setDaily(dailyJson);
      setLedgerRows(ledgerList);
    } catch (e: any) {
      setError(e?.message ?? "Raporlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadData();
  }, [token]);

  function handleLogout() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("adminAccessToken");
      window.localStorage.removeItem("adminEmail");
    }
    router.push("/login");
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
      <main className="w-full px-0 py-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* SOL SİDEBAR – RequestsPage ile aynı stil */}
          <aside className="w-full md:w-72 lg:w-80 flex flex-col gap-4 border-r border-white/10 px-6">
            {/* Profil */}
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

            {/* Menü */}
            <div className="flex flex-col gap-2">
              <button
                className="w-full text-left px-3 py-2 rounded border border-white/10 text-sm hover:bg-white/5"
                onClick={() => router.push("/requests")}
              >
                Talepler
              </button>
              <button
                className="w-full text-left px-3 py-2 rounded border border-white/10 text-sm hover:bg-white/5"
                onClick={() => router.push("/settings")}
              >
                Ödeme Ayarları
              </button>

              <button
                className="w-full text-left px-3 py-2 rounded border border-white/10 bg-white/10 text-sm"
                onClick={() => router.push("/dashboard")}
              >
                Dashboard
              </button>
              <button
                className="w-full text-left px-3 py-2 rounded border border-white/10 text-sm hover:bg-white/5"
                onClick={() => router.push("/logs")}
              >
                Loglar
              </button>



              <button
                className="w-full text-left px-3 py-2 rounded border border-white/10 text-sm hover:bg-white/5"
                onClick={handleLogout}
              >
                Çıkış
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-2 text-[11px] text-white/50">
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

          {/* SAĞ ANA İÇERİK – DASHBOARD */}
          <section className="flex-1 flex flex-col gap-4 px-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-2xl">Raporlar / Dashboard</h1>
                <div className="text-xs text-white/50">
                  Giriş yapan admin: {adminEmail ?? "-"}
                </div>
              </div>

              <button
                className="px-3 py-2 rounded border border-white/20 text-sm hover:bg-white/5"
                onClick={loadData}
              >
                Yenile
              </button>
            </div>

            {error && (
              <div className="mb-2 text-sm text-red-300 border border-red-400/30 bg-red-500/10 p-3 rounded">
                {error}
              </div>
            )}

            {/* ÖZET KARTLAR */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
                <div className="text-[11px] text-white/50 mb-1">
                  Bugün Toplam Yatırılan (DEPOSIT)
                </div>
                <div className="text-lg font-semibold">
                  {daily
                    ? moneyFromMinor(daily.totalDepositsMinor, "TL")
                    : "-"}
                </div>
              </div>

              <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
                <div className="text-[11px] text-white/50 mb-1">
                  Bugün Toplam Çekilen (WITHDRAW)
                </div>
                <div className="text-lg font-semibold">
                  {daily
                    ? moneyFromMinor(daily.totalWithdrawsMinor, "TL")
                    : "-"}
                </div>
              </div>

              <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
                <div className="text-[11px] text-white/50 mb-1">
                  Bekleyen Talepler
                </div>
                <div className="text-lg font-semibold">
                  {daily ? daily.pendingCount : "-"}
                </div>
              </div>

              <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
                <div className="text-[11px] text-white/50 mb-1">
                  Tamamlanan Talepler (Tümü)
                </div>
                <div className="text-lg font-semibold">
                  {daily ? daily.completedCount : "-"}
                </div>
              </div>

              <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02] md:col-span-2">
                <div className="text-[11px] text-white/50 mb-1">
                  Sistem Kasası
                </div>
                <div className="text-lg font-semibold">
                  {daily
                    ? moneyFromMinor(daily.systemCashMinor, "TL")
                    : "-"}
                </div>
                {daily && (
                  <div className="text-[11px] text-white/40 mt-1">
                    generated: {formatDateTime(daily.generatedAt)}
                  </div>
                )}
              </div>
            </div>

            {/* SON LEDGER HAREKETLERİ */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg">Son Ledger Hareketleri</h2>
                <span className="text-[11px] text-white/40">
                  Kullanıcıya yansıyan tutar üzerinden özet.
                </span>
              </div>

              <div className="border border-white/10 rounded overflow-hidden text-xs">
                <table className="w-full">
                  <thead className="bg-white/[0.04] text-white/60">
                    <tr>
                      <th className="text-left py-2 px-3 w-40">Zaman</th>
                      <th className="text-left py-2 px-3">Kullanıcı</th>
                      <th className="text-left py-2 px-3">Tutar</th>
                      <th className="text-left py-2 px-3">Memo</th>
                      <th className="text-left py-2 px-3">Request ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-6 px-3 text-white/50 text-center"
                        >
                          Yükleniyor...
                        </td>
                      </tr>
                    )}

                    {!loading && ledgerRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-6 px-3 text-white/50 text-center"
                        >
                          Kayıt yok
                        </td>
                      </tr>
                    )}

                    {!loading &&
                      ledgerRows.map((e) => (
                        <tr
                          key={e.id}
                          className="border-t border-white/5 hover:bg-white/[0.03]"
                        >
                          <td className="py-2 px-3 whitespace-nowrap">
                            {formatDateTime(e.createdAt)}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {userEmailFromEntry(e)}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {userSignedAmount(e)}
                          </td>
                          <td className="py-2 px-3 max-w-xs">
                            <span className="line-clamp-2 text-[11px] text-white/80">
                              {e.memo ?? "-"}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px]">
                            {e.requestId ?? "-"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
