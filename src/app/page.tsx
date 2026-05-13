"use client";
import Link from "next/link";
import { Spade, MonitorPlay, Smartphone, Users } from "lucide-react";

export default function Home() {
  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-16 flex flex-col items-center gap-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <Spade className="w-10 h-10 text-emerald-400" />
        <h1 className="text-3xl tracking-tight text-zinc-100">Poker Sim</h1>
        <p className="text-sm text-zinc-400 max-w-md">
          Mesa de Texas Hold&apos;em multi-dispositivo. Big screen muestra la
          mesa. Cada jugador ve sus cartas en su teléfono.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        <Link
          href="/host"
          className="group flex flex-col items-start gap-3 p-6 rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-400/30 hover:bg-emerald-500/15 transition"
        >
          <MonitorPlay className="w-6 h-6 text-emerald-300" />
          <div>
            <div className="text-lg text-emerald-100">Crear sala</div>
            <p className="text-xs text-emerald-200/80 mt-1">
              Big screen / laptop. Reparte y controla la mesa.
            </p>
          </div>
        </Link>
        <Link
          href="/join"
          className="group flex flex-col items-start gap-3 p-6 rounded-2xl bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition"
        >
          <Smartphone className="w-6 h-6 text-zinc-200" />
          <div>
            <div className="text-lg text-zinc-100">Unirse</div>
            <p className="text-xs text-zinc-400 mt-1">
              Phone. Entra con código o escanea QR.
            </p>
          </div>
        </Link>
      </div>

      <Link
        href="/players"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100 transition"
      >
        <Users className="w-4 h-4" />
        Administrar jugadores locales
      </Link>
    </div>
  );
}
