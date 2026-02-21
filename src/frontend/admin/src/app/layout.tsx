import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "ValerPay Admin",
  description: "ValerPay admin paneli",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="bg-[#05080c] text-white">
        {/* Üst bar */}
        <header className="border-b border-white/10 bg-[#05080c]/95 backdrop-blur sticky top-0 z-50">
          <div className="mx-auto px-6 h-14 flex items-center justify-between">
            <div className="font-semibold tracking-wide">
              ValerPay Admin
            </div>
          </div>
        </header>

        {/* İçerik */}
        <main className="mx-auto px-6 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
