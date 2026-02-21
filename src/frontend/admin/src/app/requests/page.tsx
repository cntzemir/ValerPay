"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Drawer from "../../components/Drawer";
import RequestDetails from "../../components/RequestDetails";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type Row = {
  id: string;
  userEmail: string;
  method: string;
  type: string;
  asset: string;
  amountMinor: string;
  status: string;
  updatedAt: string;
  assignedTo: string | null;
  memo: string | null;
};

type Tab = "all" | "mine";

function money(minor: string) {
  const n = Number(minor);
  if (!Number.isFinite(n)) return "-";
  return `${(n / 100).toFixed(2)} TL`;
}

function badgeClass(status: string) {
  const base =
    "inline-flex items-center px-2 py-1 rounded text-xs border";
  switch (status) {
    case "NEW":
      return `${base} border-blue-400/30 text-blue-200 bg-blue-500/10`;
    case "ASSIGNED":
      return `${base} border-yellow-400/30 text-yellow-200 bg-yellow-500/10`;
    case "APPROVED":
      return `${base} border-green-400/30 text-green-200 bg-green-500/10`;
    case "REJECTED":
      return `${base} border-red-400/30 text-red-200 bg-red-500/10`;
    case "SENT":
      return `${base} border-purple-400/30 text-purple-200 bg-purple-500/10`;
    case "COMPLETED":
      return `${base} border-white/20 text-white/70 bg-white/5`;
    default:
      return `${base} border-white/10 text-white/50 bg-white/5`;
  }
}

export default function RequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [token, setToken] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [activityLog, setActivityLog] = useState<string[]>([]);

  const selected = useMemo(
    () => (selectedId ? rows.find((r) => r.id === selectedId) ?? null : null),
    [rows, selectedId],
  );


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


  useEffect(() => {
    const mine = searchParams.get("mine");
    setTab(mine === "1" ? "mine" : "all");
  }, [searchParams]);


  async function loadRequests(opts?: {
    append?: boolean;
    cursor?: string | null;
  }) {
    if (!token) return;

    const append = opts?.append ?? false;
    const cursor = opts?.cursor ?? null;

    try {
      setError(null);
      if (!append) setLoading(true);

      const params = new URLSearchParams();
      params.set("tab", tab);
      if (q.trim()) params.set("q", q.trim());
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(`${API}/admin/requests?` + params.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Talepler yüklenemedi");
      }

      const data = await res.json();
      const list: Row[] = Array.isArray(data.value) ? data.value : data;

      if (append) {
        setRows((prev) => [...prev, ...list]);
      } else {
        setRows(list);
      }

      setNextCursor(data.nextCursor ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Talepler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;

    loadRequests();

    const interval = setInterval(() => {
      if (!drawerOpen) {
        loadRequests();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [token, tab, q, drawerOpen]);

  function handleLoadMore() {
    if (!token || !nextCursor) return;
    loadRequests({ append: true, cursor: nextCursor });
  }

  function handleOpenRow(id: string) {
    setSelectedId(id);
    setDrawerOpen(true);
  }

  function handleDrawerClose() {
    setDrawerOpen(false);
    setSelectedId(null);
  }

  function handleLogout() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("adminAccessToken");
      window.localStorage.removeItem("adminEmail");
    }
    router.push("/login");
  }

  function handleClaimed() {
    setTab("mine");
    router.push("/requests?mine=1");
  }

  function pushLog(msg: string) {
    const line =
      new Date().toLocaleTimeString("tr-TR", { hour12: false }) +
      " • " +
      msg;
    setActivityLog((prev) => [line, ...prev].slice(0, 10));
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05080c] text-white">
        <div className="text-sm text-white/60">Yönlendiriliyor...</div>
      </div>
    );
  }

  const title = tab === "all" ? "Tüm Yeni Talepler" : "İşlemlerim";

  return (
    <div className="min-h-screen bg-[#05080c] text-white">
      <main className="w-full px-0 py-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* SOL SİDEBAR */}
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
                onClick={() => {
                  setTab("all");
                  router.push("/requests");
                }}
              >
                Talepler
              </button>

              <button
                className="w-full text-left px-3 py-2 rounded border border-white/10 text-sm hover:bg-white/5"
                onClick={() => {
                  router.push("/settings");
                }}
              >
                Ödeme Ayarları
              </button>

              <button
                className="w-full text-left px-3 py-2 rounded border border-white/10 text-sm hover:bg-white/5"
                onClick={() => {
                  router.push("/dashboard");
                }}
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

            {/* Küçük log özeti */}
            <div className="mt-4 text-[11px] text-white/60">
              <div className="font-semibold mb-1">Bildirimler / Log</div>
              {activityLog.length === 0 ? (
                <p>
                  Bu oturumda yapılan Claim / Onay / Reddet / Gönderildi /
                  Tamamla işlemleri burada kısaca görünecek. Detay için
                  &quot;Loglar&quot; ekranını kullanın.
                </p>
              ) : (
                <ul className="space-y-1 max-h-40 overflow-auto pr-1">
                  {activityLog.map((line, idx) => (
                    <li key={idx} className="truncate">
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          {/* SAĞ ANA İÇERİK */}
          <section className="flex-1 flex flex-col gap-4 px-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl">{title}</h1>
              </div>

              <div className="flex items-center gap-3">
                <button
                  className={`px-3 py-1.5 rounded border text-sm ${
                    tab === "all"
                      ? "border-white bg-white/10"
                      : "border-white/20 hover:bg-white/5"
                  }`}
                  onClick={() => {
                    setTab("all");
                    router.push("/requests");
                  }}
                >
                  Talepler
                </button>

                <button
                  className={`px-3 py-1.5 rounded border text-sm ${
                    tab === "mine"
                      ? "border-white bg-white/10"
                      : "border-white/20 hover:bg-white/5"
                  }`}
                  onClick={() => {
                    setTab("mine");
                    router.push("/requests?mine=1");
                  }}
                >
                  İşlemlerim
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-2 text-sm text-red-300 border border-red-400/30 bg-red-500/10 p-3 rounded">
                {error}
              </div>
            )}

            <table className="w-full text-sm border border-white/10 rounded overflow-hidden">
              <thead className="bg-white/5">
                <tr className="border-b border-white/10 text-white/60">
                  <th className="text-left py-2 px-3">ID</th>
                  <th className="text-left py-2 px-3">Kullanıcı</th>
                  <th className="text-left py-2 px-3">Yöntem</th>
                  <th className="text-left py-2 px-3">Tip</th>
                  <th className="text-left py-2 px-3">Tutar</th>
                  <th className="text-left py-2 px-3">Durum</th>
                  <th className="text-left py-2 px-3">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="py-6 px-3 text-white/50">
                      Yükleniyor...
                    </td>
                  </tr>
                )}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 px-3 text-white/50">
                      Kayıt yok
                    </td>
                  </tr>
                )}

                {!loading &&
                  rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-white/5 hover:bg-white/[0.03]"
                    >
                      <td className="py-2 px-3">{r.id}</td>
                      <td className="py-2 px-3">{r.userEmail}</td>
                      <td className="py-2 px-3">{r.method}</td>
                      <td className="py-2 px-3">{r.type}</td>
                      <td className="py-2 px-3">{money(r.amountMinor)}</td>
                      <td className="py-2 px-3">
                        <span className={badgeClass(r.status)}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <button
                          className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                          onClick={() => handleOpenRow(r.id)}
                        >
                          İŞLEMİ AÇ
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {!loading && nextCursor && (
              <div className="mt-4 flex justify-center">
                <button
                  className="px-4 py-2 text-sm rounded border border-white/20 hover:bg-white/5"
                  onClick={handleLoadMore}
                >
                  Daha fazla yükle
                </button>
              </div>
            )}
          </section>
        </div>

        {/* Drawer */}
        <Drawer
          open={drawerOpen}
          onClose={handleDrawerClose}
          title={
            selected ? `İşlem Detayı • ${selected.id}` : "İşlem Detayı"
          }
        >
          {selected ? (
            <RequestDetails
              row={selected}
              onChanged={() => loadRequests()}
              onClaimed={handleClaimed}
              onLogged={pushLog}
            />
          ) : (
            <div className="text-white/50 text-sm">Kayıt seçilmedi.</div>
          )}
        </Drawer>
      </main>
    </div>
  );
}
