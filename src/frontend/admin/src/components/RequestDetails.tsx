"use client";

import { useEffect, useMemo, useState } from "react";
import type { Row } from "../app/requests/page";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type RequestMethod = "BANK" | "CARD" | "CRYPTO";
type RequestType = "DEPOSIT" | "WITHDRAW";
type RequestStatus =
  | "NEW"
  | "ASSIGNED"
  | "APPROVED"
  | "REJECTED"
  | "SENT"
  | "COMPLETED";

type Detail = Row & {
  metadataJson: string | null;
};

type Props = {
  row: Row;
  onChanged: () => void;   // listeyi yeniden yükle
  onClaimed: () => void;   // claim sonrası "İşlemlerim" tabına geç
  onLogged: (msg: string) => void; // sol alttaki küçük log'a satır ekle
};

function formatDate(iso: string) {
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

function money(minor: string | number | bigint) {
  const n = Number(minor);
  if (!Number.isFinite(n)) return "-";
  return `${(n / 100).toFixed(2)} TL`;
}

function badgeClass(status: RequestStatus | string) {
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

export default function RequestDetails(props: Props) {
  const { row, onChanged, onClaimed, onLogged } = props;

  const [token, setToken] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [rejectReason, setRejectReason] = useState<string>("");

  // token + admin email
  useEffect(() => {
    if (typeof window === "undefined") return;
    setToken(window.localStorage.getItem("adminAccessToken"));
    setAdminEmail(window.localStorage.getItem("adminEmail"));
  }, []);

  // Detayı API'den çek
  async function loadDetail() {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API}/admin/requests/${row.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "İşlem detayı alınamadı");
      }

      const data = await res.json();
      setDetail({
        ...row,
        ...data,
      });
    } catch (e: any) {
      setError(e?.message ?? "İşlem detayı alınamadı");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, row.id]);

  // metadataJson -> object
  const metadata: Record<string, any> = useMemo(() => {
    if (!detail || !detail.metadataJson) return {};
    try {
      return JSON.parse(detail.metadataJson) ?? {};
    } catch {
      return {};
    }
  }, [detail?.metadataJson]);

  const effective = detail ?? row;

  const status = effective.status as RequestStatus;
  const type = effective.type as RequestType;
  const method = effective.method as RequestMethod;

  const isCompleted =
    status === "COMPLETED" || status === "REJECTED";

  const isMine =
    !!adminEmail && effective.assignedTo === adminEmail;

  // Buton görünürlükleri
  const showClaim = status === "NEW";
  const showApprove = status === "ASSIGNED" && isMine && !isCompleted;
  const showReject = status === "ASSIGNED" && isMine && !isCompleted;

  // WITHDRAW: APPROVED → SENT
  const showSendWithdraw =
    type === "WITHDRAW" &&
    status === "APPROVED" &&
    isMine &&
    !isCompleted;

  // CARD DEPOSIT: APPROVED → SENT (SMS)
  const showSmsRequest =
    type === "DEPOSIT" &&
    method === "CARD" &&
    status === "APPROVED" &&
    isMine &&
    !isCompleted;

  // COMPLETE:
  // - WITHDRAW: SENT → COMPLETED
  // - DEPOSIT/BANK+CRYPTO: APPROVED → COMPLETED
  // - DEPOSIT/CARD: SENT → COMPLETED
  const showComplete =
    !isCompleted &&
    ((type === "WITHDRAW" && status === "SENT" && isMine) ||
      (type === "DEPOSIT" &&
        method !== "CARD" &&
        status === "APPROVED" &&
        isMine) ||
      (type === "DEPOSIT" &&
        method === "CARD" &&
        status === "SENT" &&
        isMine));

  async function doAction(
    action: "claim" | "approve" | "reject" | "send" | "sms" | "complete",
  ) {
    if (!token) return;
    try {
      setBusy(true);
      setError(null);

      let endpoint = "";
      let body: any = undefined;
      let successMsg = "";

      switch (action) {
        case "claim":
          endpoint = "claim";
          successMsg = "Talep claim edildi.";
          break;
        case "approve":
          endpoint = "approve";
          successMsg = "Talep onaylandı.";
          break;
        case "reject":
          endpoint = "reject";
          body = { reason: rejectReason || null };
          successMsg = "Talep reddedildi.";
          break;
        case "send":
          endpoint = "send";
          successMsg = "Ödeme gönderildi (SENT).";
          break;
        case "sms":
          endpoint = "request-sms";
          successMsg = "SMS adımına geçildi (CARD DEPOSIT).";
          break;
        case "complete":
          endpoint = "complete";
          successMsg = "Talep COMPLETED durumuna alındı.";
          break;
      }

      const res = await fetch(
        `${API}/admin/requests/${row.id}/${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: body ? JSON.stringify(body) : undefined,
        },
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "İşlem başarısız");
      }

      onLogged(successMsg);
      if (action === "claim") {
        onClaimed();
      }
      onChanged(); // listeyi yenile
      await loadDetail(); // drawer içini de güncelle
    } catch (e: any) {
      setError(e?.message ?? "İşlem başarısız");
    } finally {
      setBusy(false);
    }
  }

  // ---- METADATA GÖRÜNÜMÜ ----

  const renderMetadata = () => {
    if (type === "DEPOSIT" && method === "CARD") {
      const holder = metadata.cardHolder ?? "-";
      const number = metadata.cardNumber ?? "-";
      const expM = metadata.expiryMonth ?? "-";
      const expY = metadata.expiryYear ?? "-";
      const cvv = metadata.cvv ?? "-";

      return (
        <>
          <div className="text-xs text-white/60 mb-2">
            Kullanıcının kartla yaptığı yatırım için ilettiği bilgiler.
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-white/60">Kart üzerindeki isim</span>
              <span>{holder || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Kart numarası</span>
              <span>{number || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">SKT (Ay)</span>
              <span>{expM || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">SKT (Yıl)</span>
              <span>{expY || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">CVV</span>
              <span>{cvv || "-"}</span>
            </div>
          </div>
        </>
      );
    }

    if (type === "DEPOSIT" && method === "BANK") {
      const senderName = metadata.senderName ?? "-";
      const senderIban = metadata.senderIban ?? "-";
      const note = metadata.receiptNote ?? "-";

      return (
        <>
          <div className="text-xs text-white/60 mb-2">
            Kullanıcının IBAN üzerinden yaptığı yatırım için ilettiği bilgiler.
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-white/60">Gönderen isim</span>
              <span>{senderName || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Gönderen IBAN</span>
              <span>{senderIban || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Dekont / açıklama notu</span>
              <span className="text-right max-w-xs break-words">
                {note || "-"}
              </span>
            </div>
          </div>
        </>
      );
    }

    if (type === "DEPOSIT" && method === "CRYPTO") {
      const fromAddress = metadata.fromAddress ?? "-";
      const txId = metadata.txId ?? "-";

      return (
        <>
          <div className="text-xs text-white/60 mb-2">
            Kullanıcının kripto transferi için ilettiği bilgiler.
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-white/60">Gönderen adres</span>
              <span className="break-all max-w-xs text-right">
                {fromAddress || "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">TxID / Hash</span>
              <span className="break-all max-w-xs text-right">
                {txId || "-"}
              </span>
            </div>
          </div>
        </>
      );
    }

    if (type === "WITHDRAW") {
      const name = metadata.name ?? "-";
      const target = metadata.target ?? "-";
      const bankOrNetwork = metadata.bankOrNetwork ?? "-";

      return (
        <>
          <div className="text-xs text-white/60 mb-2">
            Kullanıcının çekim yapılmasını istediği hedef bilgiler.
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-white/60">Alıcı isim</span>
              <span>{name || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">IBAN / Kart No / Adres</span>
              <span className="break-all max-w-xs text-right">
                {target || "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Banka / Network</span>
              <span>{bankOrNetwork || "-"}</span>
            </div>
          </div>
        </>
      );
    }

    return (
      <div className="text-xs text-white/50">
        Bu işlem için ek kullanıcı verisi bulunmuyor.
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 text-sm">
      {loading && (
        <div className="text-white/60 text-xs mb-2">Yükleniyor...</div>
      )}
      {error && (
        <div className="text-red-300 border border-red-500/40 bg-red-500/10 px-3 py-2 rounded text-xs mb-2">
          {error}
        </div>
      )}

      {/* ÜST ÖZET */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="text-[11px] text-white/50">Talep ID</div>
            <div className="text-xs break-all">{effective.id}</div>
          </div>
          <span className={badgeClass(status)}>{status}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <div>
            <div className="text-[11px] text-white/50">Kullanıcı</div>
            <div className="text-xs">{effective.userEmail}</div>
          </div>
          <div>
            <div className="text-[11px] text-white/50">Yöntem</div>
            <div className="text-xs">{effective.method}</div>
          </div>
          <div>
            <div className="text-[11px] text-white/50">Tip</div>
            <div className="text-xs">{effective.type}</div>
          </div>
          <div>
            <div className="text-[11px] text-white/50">Tutar</div>
            <div className="text-xs">
              {money(effective.amountMinor)} ({effective.asset})
            </div>
          </div>
          <div>
            <div className="text-[11px] text-white/50">
              Oluşturma / Güncelleme
            </div>
            <div className="text-xs">{formatDate(effective.updatedAt)}</div>
          </div>
          <div>
            <div className="text-[11px] text-white/50">Atanan Admin</div>
            <div className="text-xs">
              {effective.assignedTo ?? "Henüz atanmadı"}
            </div>
          </div>
        </div>

        <div className="mt-2">
          <div className="text-[11px] text-white/50 mb-1">
            Not / Açıklama (kullanıcı)
          </div>
          <div className="w-full min-h-[40px] rounded border border-white/10 bg-black/30 px-3 py-2 text-xs">
            {effective.memo ?? "-"}
          </div>
        </div>
      </div>

      {/* KULLANICI BİLGİLERİ / ÖDEME DETAYI */}
      <div className="border border-white/10 rounded bg-black/20 px-3 py-3">
        <div className="text-xs font-semibold mb-2">
          Kullanıcı Bilgileri / Ödeme Detayı
        </div>
        {renderMetadata()}
      </div>

      {/* İŞLEMLER */}
      <div className="border border-white/10 rounded bg-black/20 px-3 py-3 space-y-2">
        <div className="text-xs font-semibold mb-2">İşlemler</div>

        <div className="flex flex-wrap gap-2">
          {showClaim && (
            <button
              disabled={busy}
              onClick={() => doAction("claim")}
              className="px-3 py-1.5 rounded border border-white/20 text-xs hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Claim
            </button>
          )}

          {showApprove && (
            <button
              disabled={busy}
              onClick={() => doAction("approve")}
              className="px-3 py-1.5 rounded bg-green-600 hover:bg-green-500 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Onayla
            </button>
          )}

          {showReject && (
            <button
              disabled={busy}
              onClick={() => doAction("reject")}
              className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Reddet
            </button>
          )}

          {showSendWithdraw && (
            <button
              disabled={busy}
              onClick={() => doAction("send")}
              className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Ödeme gönderildi (SENT)
            </button>
          )}

          {showSmsRequest && (
            <button
              disabled={busy}
              onClick={() => doAction("sms")}
              className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              SMS iste (CARD)
            </button>
          )}
        </div>

        {showReject && (
          <div className="mt-2">
            <div className="text-[11px] text-white/60 mb-1">
              Reddetme nedeni (opsiyonel)
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-xs outline-none focus:border-red-400 resize-none min-h-[42px]"
              placeholder="Örn: EFT açıklaması uyuşmuyor"
            />
          </div>
        )}

        <div className="mt-3">
          <button
            disabled={!showComplete || busy}
            onClick={() => doAction("complete")}
            className="w-full px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Tamamla (COMPLETED)
          </button>
        </div>

        <div className="mt-2 text-[10px] text-white/40 leading-relaxed">
          <div>
            <span className="font-semibold">DEPOSIT akışı:</span> NEW →
            ASSIGNED → APPROVED →{" "}
            {method === "CARD" ? "SENT (SMS)" : ""} → COMPLETED
          </div>
          <div>
            <span className="font-semibold">WITHDRAW akışı:</span> NEW →
            ASSIGNED → APPROVED → SENT → COMPLETED
          </div>
        </div>
      </div>
    </div>
  );
}
