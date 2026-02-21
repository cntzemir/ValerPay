"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type PaymentConfigDto = {
  depositsEnabled: boolean;
  withdrawsEnabled: boolean;
  bankDepositEnabled: boolean;
  cardDepositEnabled: boolean;
  cryptoDepositEnabled: boolean;
  bankWithdrawEnabled: boolean;
  cardWithdrawEnabled: boolean;
  cryptoWithdrawEnabled: boolean;
  bankIban: string | null;
  bankRecipient: string | null;
  bankDescription: string | null;
  cryptoNetwork: string | null;
  cryptoAddress: string | null;
  cryptoMemo: string | null;
};

export function usePaymentConfig(token: string | null) {
  const [data, setData] = useState<PaymentConfigDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    if (!token) return;
    try {
      setError(null);
      setLoading(true);

      const res = await fetch(`${API}/user/config/payments`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store", // tarayıcı cache'ini iptal
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || "Ödeme ayarları alınamadı");
      }

      const json = await res.json();
      setData(json.value as PaymentConfigDto);
    } catch (e: any) {
      setError(e?.message ?? "Ödeme ayarları alınamadı");
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
