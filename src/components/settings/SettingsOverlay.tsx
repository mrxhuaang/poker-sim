"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export type SettingsTab = {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
  badge?: number;
};

// Full-screen, tabbed settings page (PokerNow-style). Generic shell: pages pass
// their own tab set. Covers the viewport over the table; Escape / « Volver close.
export function SettingsOverlay({
  title,
  tabs,
  initialTab,
  onClose,
}: {
  title: string;
  tabs: SettingsTab[];
  initialTab?: string;
  onClose: () => void;
}) {
  const [active, setActive] = useState<string>(initialTab ?? tabs[0]?.id ?? "");
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-[#0a0a0c]/97 backdrop-blur-xl animate-in fade-in duration-200">
      {/* Top bar: back + title + tabs */}
      <header className="flex items-center gap-2 px-3 sm:px-5 py-3 border-b border-white/[0.07] shrink-0 overflow-x-auto custom-scrollbar">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold uppercase tracking-wider text-zinc-300 hover:text-white hover:bg-white/5 transition btn-press shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <span className="text-sm font-semibold tracking-tight text-zinc-100 hidden md:block shrink-0 mr-2">
          {title}
        </span>
        <nav className="flex items-center gap-1 ml-auto">
          {tabs.map((t) => {
            const on = t.id === active;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActive(t.id)}
                className={`relative inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-wider transition btn-press shrink-0 ring-1 ${
                  on
                    ? "bg-accent/15 text-accent ring-accent/30"
                    : "text-zinc-500 ring-transparent hover:text-zinc-300 hover:bg-white/5"
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
                {t.badge ? (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent text-black text-[9px] font-black flex items-center justify-center">
                    {t.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto max-w-3xl w-full px-4 py-6 sm:py-8">
          {current?.content}
        </div>
      </main>
    </div>
  );
}
