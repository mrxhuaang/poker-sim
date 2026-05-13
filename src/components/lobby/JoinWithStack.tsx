"use client";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

type Props = {
  defaultName?: string;
  suggestedStack?: number;
  mode?: "join" | "rebuy";
  locked?: boolean;
  onSubmit: (name: string, stack: number) => Promise<void>;
};

export function JoinWithStack({
  defaultName = "",
  suggestedStack = 1000,
  mode = "join",
  locked = false,
  onSubmit,
}: Props) {
  const [name, setName] = useState(defaultName);
  const [stack, setStack] = useState(suggestedStack);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || stack <= 0 || locked) return;
    setLoading(true);
    try {
      await onSubmit(name.trim(), stack);
    } finally {
      setLoading(false);
    }
  }

  const isRebuy = mode === "rebuy";

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 p-6 rounded-2xl glass"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-zinc-100">
          {isRebuy ? "Solicitar rebuy" : "Unirse a la sala"}
        </h2>
        {locked && !isRebuy && (
          <p className="text-xs text-rose-300">
            Mesa cerrada · No se aceptan nuevos jugadores.
          </p>
        )}
      </div>

      {!isRebuy && (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">
            Tu nombre
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Apodo o nombre"
            maxLength={20}
            autoFocus={!isRebuy}
            disabled={loading || locked}
            className="px-3 py-2.5 rounded-xl bg-black/40 ring-1 ring-white/10 text-zinc-100 text-sm outline-none focus:ring-emerald-400/40 disabled:opacity-40"
          />
        </label>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-[0.15em] text-zinc-500">
          {isRebuy ? "Cantidad de fichas" : "Stack de entrada"}
        </span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={stack}
            onChange={(e) => setStack(Math.max(1, Number(e.target.value)))}
            min={1}
            step={100}
            disabled={loading || locked}
            className="flex-1 px-3 py-2.5 rounded-xl bg-black/40 ring-1 ring-white/10 text-zinc-100 text-sm outline-none focus:ring-emerald-400/40 tabular-nums disabled:opacity-40"
          />
          {suggestedStack > 0 && (
            <button
              type="button"
              onClick={() => setStack(suggestedStack)}
              className="px-3 py-2 rounded-xl text-xs text-zinc-400 glass ring-1 ring-white/8 hover:bg-white/10 transition"
            >
              ×1
            </button>
          )}
        </div>
        <p className="text-[11px] text-zinc-600">
          El dueño puede ajustar el monto antes de aceptar.
        </p>
      </label>

      <button
        type="submit"
        disabled={!name.trim() || stack <= 0 || loading || locked}
        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500/90 hover:bg-emerald-400 disabled:opacity-30 text-emerald-950 font-medium text-sm btn-press transition"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            {isRebuy ? "Solicitar" : "Solicitar entrada"}
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}
