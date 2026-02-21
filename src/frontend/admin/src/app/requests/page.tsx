"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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
  const base = "inline-flex items-center px-2 py-1 rounded text-xs border";
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

/**
 * ✅ Next.js build fix:
 * useSearchParams() client-side bailout -> MUST be wrapped with <Suspense>.
 */
export default function RequestsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-white p-6">Loading…</div>
      }
    >
      <RequestsPageInner />
    </Suspense>
  );
}

function RequestsPageInner() {
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

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return rows.find((r) => r.id === selectedId) ?? null;
  }, [rows, selectedId]);

  // auth bootstrap
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

  // query param -> tab
  useEffect(() => {
    const mine = searchParams.get("mine");
    setTab(mine === "1" ? "mine" : "all");
  }, [searchParams]);

  async function loadRequests(opts?: { append?: boolean; cursor?: string | null }) {
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

      setRows((prev) => (append ? [...prev, ...list] : list));
      setNextCursor(data.nextCursor ?? null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Talepler yüklenemedi";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // auto refresh
  useEffect(() => {
    if (!token) return;

    loadRequests();

    const interval = setInterval(() => {
      if (!drawerOpen) loadRequests();
    }, 10_000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      new Date().toLocaleTimeString("tr-TR", { hour12: false }) + " • " + msg;
    setActivityLog((prev) => [line, ...prev].slice(0, 10));
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white p-6">
        Yönlendiriliyor...
      </div>
    );
  }

  const title = tab === "all" ? "Tüm Yeni Talepler" : "İşlemlerim";

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-[280px] border-r border-white/10 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-white/10 grid place-items-center">
            {adminEmail ? adminEmail[0]?.toUpperCase() : "A"}
          </div>
          <div className="min-w-0">
            <div className="text-sm opacity-80">Admin</div>
            <div className="font-medium truncate">
              {adminEmail ?? "admin@local.test"}
            </div>
          </div>
        </div>

        <nav className="space-y-2">
          <button
            className="w-full text-left px-3 py-2 rounded bg-white/5 hover:bg-white/10"
            onClick={() => router.push("/requests")}
          >
            Talepler
          </button>
          <button
            className="w-full text-left px-3 py-2 rounded bg-white/5 hover:bg-white/10"
            onClick={() => router.push("/settings")}
          >
            Ödeme Ayarları
          </button>
          <button
            className="w-full text-left px-3 py-2 rounded bg-white/5 hover:bg-white/10"
            onClick={() => router.push("/dashboard")}
          >
            Dashboard
          </button>
          <button
            className="w-full text-left px-3 py-2 rounded bg-white/5 hover:bg-white/10"
            onClick={() => router.push("/logs")}
          >
            Loglar
          </button>
          <button
            className="w-full text-left px-3 py-2 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/20"
            onClick={handleLogout}
          >
            Çıkış
          </button>
        </nav>

        <div className="mt-6 border-t border-white/10 pt-4">
          <div className="text-sm font-semibold mb-2">Bildirimler / Log</div>
          {activityLog.length === 0 ? (
            <div className="text-xs opacity-70 leading-relaxed">
              Claim / Onay / Reddet / Gönderildi / Tamamla işlemlerinin kısa
              özeti burada görünecek. Detay için “Loglar” ekranını kullan.
            </div>
          ) : (
            <ul className="text-xs opacity-80 space-y-1">
              {activityLog.map((line, idx) => (
                <li key={idx}>• {line}</li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-semibold">{title}</h1>
            <div className="text-sm opacity-70">
              Tab: <span className="font-medium">{tab}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              className={`px-3 py-2 rounded border ${
                tab === "all"
                  ? "bg-white/10 border-white/20"
                  : "bg-white/5 border-white/10 hover:bg-white/10"
              }`}
              onClick={() => {
                setTab("all");
                router.push("/requests");
              }}
            >
              Talepler
            </button>
            <button
              className={`px-3 py-2 rounded border ${
                tab === "mine"
                  ? "bg-white/10 border-white/20"
                  : "bg-white/5 border-white/10 hover:bg-white/10"
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

        <div className="flex items-center gap-2 mb-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ara (email/id/memo)…"
            className="w-full max-w-md px-3 py-2 rounded bg-white/5 border border-white/10 outline-none focus:border-white/20"
          />
          <button
            className="px-3 py-2 rounded bg-white/10 border border-white/10 hover:bg-white/15"
            onClick={() => loadRequests()}
          >
            Yenile
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded border border-red-500/30 bg-red-500/10 text-red-200">
            {error}
          </div>
        )}

        <div className="border border-white/10 rounded overflow-hidden">
          <div className="grid grid-cols-[160px_1fr_120px_120px_120px_120px_140px] gap-0 bg-white/5 text-xs uppercase tracking-wide opacity-80">
            <div className="p-3">ID</div>
            <div className="p-3">Kullanıcı</div>
            <div className="p-3">Yöntem</div>
            <div className="p-3">Tip</div>
            <div className="p-3">Tutar</div>
            <div className="p-3">Durum</div>
            <div className="p-3">İşlem</div>
          </div>

          {loading && <div className="p-4 text-sm opacity-80">Yükleniyor…</div>}

          {!loading && rows.length === 0 && (
            <div className="p-4 text-sm opacity-80">Kayıt yok</div>
          )}

          {!loading &&
            rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[160px_1fr_120px_120px_120px_120px_140px] border-t border-white/10 hover:bg-white/[0.03]"
              >
                <div className="p-3 text-xs opacity-90 truncate">{r.id}</div>
                <div className="p-3 text-sm truncate">{r.userEmail}</div>
                <div className="p-3 text-sm">{r.method}</div>
                <div className="p-3 text-sm">{r.type}</div>
                <div className="p-3 text-sm">{money(r.amountMinor)}</div>
                <div className="p-3">
                  <span className={badgeClass(r.status)}>{r.status}</span>
                </div>
                <div className="p-3">
                  <button
                    className="px-3 py-2 text-xs rounded bg-white/10 border border-white/10 hover:bg-white/15"
                    onClick={() => handleOpenRow(r.id)}
                  >
                    İŞLEMİ AÇ
                  </button>
                </div>
              </div>
            ))}
        </div>

        {!loading && nextCursor && (
          <div className="mt-4">
            <button
              className="px-4 py-2 rounded bg-white/10 border border-white/10 hover:bg-white/15"
              onClick={handleLoadMore}
            >
              Daha fazla yükle
            </button>
          </div>
        )}

        <Drawer open={drawerOpen} onClose={handleDrawerClose} title="İşlem Detayı">
          {selected ? (
            <RequestDetails
              row={selected}
              onChanged={() => loadRequests()}
              onClaimed={handleClaimed}
              onLogged={pushLog}
            />
          ) : (
            <div className="text-sm opacity-80">Kayıt seçilmedi.</div>
          )}
        </Drawer>
      </main>
    </div>
  );
}