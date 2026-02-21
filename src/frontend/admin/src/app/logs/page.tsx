"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Drawer from "../../components/Drawer";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type LogRow = {
  id: string;
  createdAt: string;
  adminEmail: string;
  action: string;
  requestId: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  userEmail: string | null;
  requestType: string | null;
  requestMethod: string | null;
  requestStatusAtLogTime: string | null;
  requestAmountMinor?: string | null;
  requestAsset?: string | null;
};

type StatusFilter =
  | "ALL"
  | "NEW"
  | "ASSIGNED"
  | "APPROVED"
  | "REJECTED"
  | "SENT"
  | "COMPLETED";

type ActionFilter =
  | "ALL"
  | "CLAIM"
  | "APPROVE"
  | "REJECT"
  | "SEND"
  | "COMPLETE";

function statusBadgeClass(status: string | null | undefined) {
  const base =
    "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border";
  switch (status) {
    case "NEW":
      return `${base} border-blue-400/40 text-blue-200 bg-blue-500/10`;
    case "ASSIGNED":
      return `${base} border-yellow-400/40 text-yellow-200 bg-yellow-500/10`;
    case "APPROVED":
      return `${base} border-emerald-400/40 text-emerald-200 bg-emerald-500/10`;
    case "REJECTED":
      return `${base} border-red-400/40 text-red-200 bg-red-500/10`;
    case "SENT":
      return `${base} border-purple-400/40 text-purple-200 bg-purple-500/10`;
    case "COMPLETED":
      return `${base} border-white/30 text-white/80 bg-white/10`;
    default:
      return `${base} border-white/15 text-white/50 bg-white/5`;
  }
}

function actionBadgeClass(action: string) {
  const base =
    "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border";
  switch (action) {
    case "CLAIM":
      return `${base} border-sky-400/40 text-sky-200 bg-sky-500/10`;
    case "APPROVE":
      return `${base} border-emerald-400/40 text-emerald-200 bg-emerald-500/10`;
    case "REJECT":
      return `${base} border-red-400/40 text-red-200 bg-red-500/10`;
    case "SEND":
      return `${base} border-orange-400/40 text-orange-200 bg-orange-500/10`;
    case "COMPLETE":
      return `${base} border-indigo-400/40 text-indigo-200 bg-indigo-500/10`;
    default:
      return `${base} border-white/15 text-white/60 bg-white/5`;
  }
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

export default function AdminLogsPage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [onlyMine, setOnlyMine] = useState(true);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [action, setAction] = useState<ActionFilter>("ALL");
  const [q, setQ] = useState("");

  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
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

  async function loadLogs(opts?: { append?: boolean; cursor?: string | null }) {
    if (!token) return;

    const append = opts?.append ?? false;
    const cursor = opts?.cursor ?? null;

    try {
      setLoading(!append);
      setError(null);

      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (q.trim()) params.set("q", q.trim());
      if (onlyMine) params.set("my", "1");
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(`${API}/admin/logs?` + params.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Loglar yüklenemedi");
      }

      const data = await res.json();
      const list: LogRow[] = Array.isArray(data.value) ? data.value : [];

      if (append) {
        setRows((prev) => [...prev, ...list]);
      } else {
        setRows(list);
      }

      setNextCursor(data.nextCursor ?? data.nextcursor ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Loglar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const currentStatus =
        r.requestStatusAtLogTime ?? r.toStatus ?? r.fromStatus ?? null;

      const statusOk =
        status === "ALL" ? true : currentStatus === status;

      const actionOk =
        action === "ALL" ? true : r.action === action;

      return statusOk && actionOk;
    });
  }, [rows, status, action]);

  useEffect(() => {
    if (!token) return;
    loadLogs();
  }, [token, from, to, onlyMine]);

  function handleApplyFilters() {
    if (!token) return;
    loadLogs();
  }

  function handleLoadMore() {
    if (!token || !nextCursor) return;
    loadLogs({ append: true, cursor: nextCursor });
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
        {/* SOL SİDEBAR */}
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
              className="w-full text-left px-3 py-2 rounded border border-white/10 text-xs hover:bg-white/5"
              onClick={() => router.push("/requests")}
            >
              Ödeme Ayarları 
            </button>

            <button
              className="w-full text-left px-3 py-2 rounded border border-white/10 text-xs hover:bg-white/5"
              onClick={() => router.push("/dashboard")}
            >
              DashBoard 
            </button>

            <button
              className="w-full text-left px-3 py-2 rounded border border-white/10 text-xs bg-white/10"
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
          {/* Başlık */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl">Admin Logları</h1>
              <div className="text-xs text-white/50">
                Giriş yapan admin: {adminEmail ?? "-"}
              </div>
            </div>
          </div>

          {/* FİLTRE BAR */}
          <div className="mb-4 space-y-3 rounded border border-white/10 bg-white/[0.02] p-3 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-white/50">Başlangıç</span>
                <input
                  type="date"
                  className="bg-transparent border border-white/15 rounded px-2 py-1 text-xs"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-white/50">Bitiş</span>
                <input
                  type="date"
                  className="bg-transparent border border-white/15 rounded px-2 py-1 text-xs"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-white/50">Durum</span>
                <select
                  className="bg-transparent border border-white/15 rounded px-2 py-1 text-xs"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StatusFilter)}
                >
                  <option value="ALL">Tümü</option>
                  <option value="NEW">NEW</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="SENT">SENT</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="REJECTED">REJECTED</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-white/50">Action</span>
                <select
                  className="bg-transparent border border-white/15 rounded px-2 py-1 text-xs"
                  value={action}
                  onChange={(e) => setAction(e.target.value as ActionFilter)}
                >
                  <option value="ALL">Tümü</option>
                  <option value="CLAIM">CLAIM</option>
                  <option value="APPROVE">APPROVE</option>
                  <option value="REJECT">REJECT</option>
                  <option value="SEND">SEND</option>
                  <option value="COMPLETE">COMPLETE</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <label className="inline-flex items-center gap-2 text-[11px] text-white/70">
                <input
                  type="checkbox"
                  className="h-3 w-3 rounded border-white/30 bg-transparent"
                  checked={onlyMine}
                  onChange={(e) => setOnlyMine(e.target.checked)}
                />
                Sadece benim loglarım
              </label>

              <div className="flex-1">
                <input
                  className="w-full bg-transparent border border-white/15 rounded px-3 py-2 text-xs"
                  placeholder="Action / Not / RequestId / Admin email ara..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleApplyFilters();
                  }}
                />
              </div>

              <button
                className="px-4 py-2 rounded border border-white/25 text-xs hover:bg-white/10"
                onClick={handleApplyFilters}
              >
                Filtreyi Uygula
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-3 text-sm text-red-300 border border-red-400/30 bg-red-500/10 p-3 rounded">
              {error}
            </div>
          )}

          {/* TABLO */}
          <div className="border border-white/10 rounded overflow-hidden text-xs">
            <table className="w-full">
              <thead className="bg-white/[0.04] text-white/60">
                <tr>
                  <th className="text-left py-2 px-3 w-40">Zaman</th>
                  <th className="text-left py-2 px-3">Admin</th>
                  <th className="text-left py-2 px-3">Action</th>
                  <th className="text-left py-2 px-3">Request</th>
                  <th className="text-left py-2 px-3">Durum</th>
                  <th className="text-left py-2 px-3">Kullanıcı</th>
                  <th className="text-left py-2 px-3">Not</th>
                  <th className="text-left py-2 px-3 w-24 text-center">
                    İşlem
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-6 px-3 text-white/50 text-center"
                    >
                      Yükleniyor...
                    </td>
                  </tr>
                )}

                {!loading && filteredRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-6 px-3 text-white/50 text-center"
                    >
                      Kayıt yok
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredRows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-white/5 hover:bg-white/[0.03]"
                    >
                      <td className="py-2 px-3 whitespace-nowrap">
                        {formatDateTime(r.createdAt)}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {r.adminEmail}
                      </td>
                      <td className="py-2 px-3">
                        <span className={actionBadgeClass(r.action)}>
                          {r.action}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-[11px] text-white/80 truncate">
                            {r.requestId ?? "-"}
                          </span>
                          <span className="text-[10px] text-white/50">
                            {r.requestType ?? "-"} • {r.requestMethod ?? "-"}
                          </span>
                          {r.requestAmountMinor && (
                            <span className="text-[10px] text-white/50">
                              {r.requestAmountMinor} {r.requestAsset ?? ""}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={statusBadgeClass(
                            r.requestStatusAtLogTime ?? r.toStatus,
                          )}
                        >
                          {r.requestStatusAtLogTime ??
                            r.toStatus ??
                            r.fromStatus ??
                            "-"}
                        </span>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {r.userEmail ?? "-"}
                      </td>
                      <td className="py-2 px-3 max-w-xs">
                        <span className="line-clamp-2 text-[11px] text-white/70">
                          {r.note ?? "-"}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          className="inline-flex items-center justify-center gap-1 px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] font-medium"
                          onClick={() => handleOpenRow(r.id)}
                        >
                          İncele
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {!loading && nextCursor && (
            <div className="mt-4 flex justify-center">
              <button
                className="px-4 py-2 text-xs rounded border border-white/20 hover:bg-white/5"
                onClick={handleLoadMore}
              >
                Daha fazla yükle
              </button>
            </div>
          )}
        </main>
      </div>

      {/* LOG DETAY DRAWER */}
      <Drawer
        open={drawerOpen}
        onClose={handleDrawerClose}
        title={
          selected
            ? `Log Detayı • ${formatDateTime(selected.createdAt)}`
            : "Log Detayı"
        }
      >
        {selected ? (
          <div className="space-y-3 text-xs text-white/80">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-white/40 text-[11px]">Admin</div>
                <div>{selected.adminEmail}</div>
              </div>
              <div>
                <div className="text-white/40 text-[11px]">Action</div>
                <div>
                  <span className={actionBadgeClass(selected.action)}>
                    {selected.action}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-white/40 text-[11px]">Request ID</div>
                <div className="font-mono break-all">
                  {selected.requestId ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-white/40 text-[11px]">Kullanıcı</div>
                <div>{selected.userEmail ?? "-"}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-white/40 text-[11px]">Önceki Durum</div>
                <div>{selected.fromStatus ?? "-"}</div>
              </div>
              <div>
                <div className="text-white/40 text-[11px]">Yeni Durum</div>
                <div>{selected.toStatus ?? "-"}</div>
              </div>
              <div>
                <div className="text-white/40 text-[11px]">
                  Log Anındaki Durum
                </div>
                <div>
                  {selected.requestStatusAtLogTime ??
                    selected.toStatus ??
                    selected.fromStatus ??
                    "-"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-white/40 text-[11px]">Tip</div>
                <div>{selected.requestType ?? "-"}</div>
              </div>
              <div>
                <div className="text-white/40 text-[11px]">Yöntem</div>
                <div>{selected.requestMethod ?? "-"}</div>
              </div>
              <div>
                <div className="text-white/40 text-[11px]">Tutar</div>
                <div>
                  {selected.requestAmountMinor
                    ? `${selected.requestAmountMinor} ${
                        selected.requestAsset ?? ""
                      }`
                    : "-"}
                </div>
              </div>
            </div>

            <div>
              <div className="text-white/40 text-[11px] mb-1">Not</div>
              <div className="whitespace-pre-wrap">
                {selected.note ?? "-"}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-white/50 text-sm">Log seçilmedi.</div>
        )}
      </Drawer>
    </div>
  );
}
