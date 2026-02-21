import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ValerPay Cüzdan",
  description: "Kullanıcı cüzdan paneli",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className="bg-[#05080c] text-white">
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-white/10 bg-[#05080c]/95 backdrop-blur sticky top-0 z-50">
            <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
              <div className="font-semibold tracking-wide">
                ValerPay Cüzdan
              </div>
            </div>
          </header>

          <main className="flex-1 max-w-4xl mx-auto px-4 py-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
