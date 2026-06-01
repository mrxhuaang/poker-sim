"use client";
import { useEffect, useRef } from "react";
import { X, Lock, Check } from "lucide-react";
import { TITLES } from "@/lib/progression";
import type { Title } from "@/lib/progression";

const RANK_META: Record<string, { color: string; glow: string; border: string; bg: string; flavor: string }> = {
  Peon: {
    color: "text-zinc-400",
    glow: "rgba(113,113,122,0.25)",
    border: "rgba(113,113,122,0.25)",
    bg: "rgba(39,39,42,0.6)",
    flavor: "Todo empieza aqui. La mesa te desconoce.",
  },
  Fullero: {
    color: "text-amber-500",
    glow: "rgba(217,119,6,0.3)",
    border: "rgba(217,119,6,0.3)",
    bg: "rgba(41,27,8,0.7)",
    flavor: "Aprendes los trucos. Las cartas empiezan a obedecerte.",
  },
  Sicario: {
    color: "text-slate-300",
    glow: "rgba(148,163,184,0.3)",
    border: "rgba(148,163,184,0.25)",
    bg: "rgba(15,20,30,0.8)",
    flavor: "Frio. Preciso. No dejas huellas en la mesa.",
  },
  Capo: {
    color: "text-yellow-400",
    glow: "rgba(234,179,8,0.35)",
    border: "rgba(234,179,8,0.3)",
    bg: "rgba(28,22,0,0.8)",
    flavor: "Los demas jugadores te reconocen. Tienes una silla reservada.",
  },
  Verdugo: {
    color: "text-red-400",
    glow: "rgba(239,68,68,0.35)",
    border: "rgba(239,68,68,0.25)",
    bg: "rgba(30,5,5,0.85)",
    flavor: "Tu presencia en la mesa cambia el juego. Todos lo saben.",
  },
  Espectro: {
    color: "text-violet-300",
    glow: "rgba(167,139,250,0.45)",
    border: "rgba(167,139,250,0.35)",
    bg: "rgba(20,10,40,0.9)",
    flavor: "Pocos llegan aqui. Eres una leyenda que aun no ha terminado.",
  },
  Noir: {
    color: "text-white",
    glow: "rgba(167,139,250,0.7)",
    border: "rgba(167,139,250,0.6)",
    bg: "rgba(14,6,30,0.95)",
    flavor: "El apice. El nombre del juego mismo te pertenece.",
  },
};

export function RankTowerModal({
  currentLevel,
  onClose,
}: {
  currentLevel: number;
  onClose: () => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const reversed = [...TITLES].reverse();

  function rankStatus(t: Title): "achieved" | "current" | "locked" {
    const isCurrentRank = (idx: number) => {
      const next = reversed[idx - 1];
      return t.level <= currentLevel && (!next || next.level > currentLevel);
    };
    const i = reversed.indexOf(t);
    if (isCurrentRank(i)) return "current";
    if (t.level <= currentLevel) return "achieved";
    return "locked";
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl"
        style={{
          background: "linear-gradient(180deg, #09041a 0%, #0d0818 40%, #060410 100%)",
          border: "1px solid rgba(167,139,250,0.15)",
          boxShadow: "0 0 80px rgba(167,139,250,0.08), inset 0 1px 0 rgba(167,139,250,0.1)",
        }}
      >
        {/* Estrellas de fondo */}
        <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
          {STARS.map((s, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{ left: s.x, top: s.y, width: s.size, height: s.size, opacity: s.opacity }}
            />
          ))}
        </div>

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 pt-6 pb-4"
          style={{ background: "linear-gradient(to bottom, #09041a 70%, transparent)" }}
        >
          <div>
            <h2 className="text-base font-bold text-zinc-50 tracking-tight">Torre de rangos</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">Nivel {currentLevel} actual</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-zinc-500 hover:text-zinc-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Torre */}
        <div className="px-5 pb-8 flex flex-col">
          {reversed.map((t, i) => {
            const status = rankStatus(t);
            const meta = RANK_META[t.name] ?? RANK_META.Peon;
            const isLast = i === reversed.length - 1;
            const isFirst = i === 0;

            return (
              <div key={t.name} className="flex gap-3">
                {/* Línea vertical + nodo */}
                <div className="flex flex-col items-center w-6 shrink-0">
                  {/* Línea arriba */}
                  {!isFirst && (
                    <div
                      className="w-0.5 flex-1 min-h-[12px]"
                      style={{
                        background: status === "locked"
                          ? "rgba(255,255,255,0.05)"
                          : `linear-gradient(to top, ${meta.glow}, rgba(255,255,255,0.04))`,
                      }}
                    />
                  )}
                  {/* Nodo */}
                  <div
                    className="w-2 h-2 rounded-full shrink-0 my-1"
                    style={{
                      background: status === "locked" ? "rgba(255,255,255,0.1)" : meta.glow,
                      boxShadow: status !== "locked" ? `0 0 8px ${meta.glow}` : "none",
                    }}
                  />
                  {/* Línea abajo */}
                  {!isLast && (
                    <div
                      className="w-0.5 flex-1 min-h-[12px]"
                      style={{
                        background: status === "achieved"
                          ? `linear-gradient(to bottom, ${meta.glow}, rgba(255,255,255,0.04))`
                          : "rgba(255,255,255,0.05)",
                      }}
                    />
                  )}
                </div>

                {/* Card del rango */}
                <div
                  className="flex-1 mb-2 rounded-2xl p-3.5 transition-all"
                  style={{
                    background: status === "locked" ? "rgba(255,255,255,0.02)" : meta.bg,
                    border: `1px solid ${status === "locked" ? "rgba(255,255,255,0.05)" : meta.border}`,
                    boxShadow: status === "current"
                      ? `0 0 24px ${meta.glow}, inset 0 1px 0 rgba(255,255,255,0.06)`
                      : status === "achieved"
                        ? `0 0 10px ${meta.glow}40`
                        : "none",
                    opacity: status === "locked" ? 0.45 : 1,
                  }}
                >
                  <div className="flex items-center gap-3">
                    {/* Escudo */}
                    <div className="relative shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={t.emblem}
                        alt={t.name}
                        className="object-contain"
                        style={{
                          width: status === "current" ? 56 : 44,
                          height: status === "current" ? 56 : 44,
                          filter: status === "locked"
                            ? "grayscale(1) brightness(0.4)"
                            : status === "current"
                              ? `drop-shadow(0 0 12px ${meta.glow})`
                              : `drop-shadow(0 0 6px ${meta.glow})`,
                          transition: "all 0.2s",
                        }}
                      />
                      {status === "achieved" && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-zinc-900 ring-1 ring-zinc-700 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                        </div>
                      )}
                      {status === "locked" && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-zinc-900 ring-1 ring-zinc-800 flex items-center justify-center">
                          <Lock className="w-2.5 h-2.5 text-zinc-500" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold tracking-tight ${status === "locked" ? "text-zinc-600" : meta.color}`}
                          style={{ fontSize: status === "current" ? 17 : 14 }}
                        >
                          {t.name}
                        </span>
                        {status === "current" && (
                          <span
                            className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                            style={{ background: meta.glow, color: "white" }}
                          >
                            Actual
                          </span>
                        )}
                      </div>
                      <div className={`text-[11px] mt-0.5 ${status === "locked" ? "text-zinc-700" : "text-zinc-500"}`}>
                        {status === "locked" ? `Nivel ${t.level} requerido` : meta.flavor}
                      </div>
                    </div>

                    {/* Nivel */}
                    <div
                      className={`text-[10px] font-black tabular-nums shrink-0 ${status === "locked" ? "text-zinc-700" : meta.color}`}
                    >
                      Nv. {t.level}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Estrellas generadas de forma determinista (sin Date.now / Math.random)
const STARS = Array.from({ length: 40 }, (_, i) => {
  const x = ((i * 137.508) % 100).toFixed(2) + "%";
  const y = ((i * 97.3 + 13) % 100).toFixed(2) + "%";
  const size = i % 3 === 0 ? 2 : 1;
  const opacity = 0.08 + (i % 5) * 0.04;
  return { x, y, size, opacity };
});
