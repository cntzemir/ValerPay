"use client";

export default function Drawer({
  open,
  onClose,
  title = "İşlem Detayı",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* RIGHT DRAWER */}
      <div className="absolute right-0 top-0 h-full w-[520px] bg-[#0b0f14] border-l border-white/10 p-4 overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold text-white">{title}</div>

          <button
            onClick={onClose}
            className="px-2 py-1 text-white/70 hover:text-white border border-white/10 rounded"
          >
            X
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
