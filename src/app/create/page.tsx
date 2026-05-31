"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Globe, Lock, Loader2, Spade, ArrowRight } from "lucide-react";
import { BorderGlow } from "@/components/ui/BorderGlow";
import { useAuth } from "@/hooks/useAuth";
import { createNormalRoom } from "@/lib/normalRooms";
import { DEFAULT_CONFIG } from "@/lib/betting";

const GLOW = "0 0 82";
const GLOW_COLORS = ["#ededf2", "#c4c4cc", "#8a8a93", "#52525b"];

export default function CreateRoom() {
  const { uid, loading } = useAuth();
  const router = useRouter();

  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!uid || creating) return;
    setCreating(true);
    setError(null);
    try {
      const c = await createNormalRoom(
        uid,
        { ...DEFAULT_CONFIG, mode: "normal" },
        { isPublic, maxPlayers: 9 },
      );
      setCode(c);
    } catch {
      setError("No se pudo crear la mesa. Reintenta.");
      setCreating(false);
    }
  }

  return (
    <div className="relative z-[2] w-full max-w-md mx-auto px-4 py-12 flex flex-col gap-7">
      <div className="flex items-center gap-3">
        <Link
          href="/lobby"
          className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-zinc-100 transition"
          aria-label="Volver al lobby"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Crear mesa
          </h1>
          <p className="text-sm text-zinc-500">
            Las ciegas, stack y tiempo se ajustan dentro de la sala.
          </p>
        </div>
      </div>

      {code ? (
        /* Success: show the generated code */
        <BorderGlow
          className="w-full"
          glowColor={GLOW}
          colors={GLOW_COLORS}
          backgroundColor="rgba(11,11,13,0.85)"
          borderRadius={22}
          glowRadius={34}
          glowIntensity={1.05}
          coneSpread={22}
          fillOpacity={0.42}
          animated
        >
          <div className="flex flex-col items-center gap-5 p-8 text-center">
            <span className="text-[10px] uppercase tracking-[0.4em] text-zinc-500 font-bold">
              {isPublic ? "Mesa pública creada" : "Mesa privada creada"}
            </span>
            <span className="text-5xl font-mono font-black tracking-[0.25em] text-zinc-50">
              {code}
            </span>
            <p className="text-xs text-zinc-500">
              {isPublic
                ? "Ya aparece en el lobby. Comparte el código o el QR."
                : "Comparte este código: solo con él pueden entrar."}
            </p>
            <button
              type="button"
              onClick={() => router.push(`/host/normal?code=${code}`)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-bold text-sm uppercase tracking-widest hover:bg-zinc-200 transition btn-press"
            >
              Entrar a la mesa
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </BorderGlow>
      ) : (
        <>
          {/* Visibility choice */}
          <div className="grid grid-cols-2 gap-3">
            <VisToggle
              active={isPublic}
              onClick={() => setIsPublic(true)}
              icon={<Globe className="w-5 h-5" />}
              title="Pública"
              sub="Aparece en el lobby"
            />
            <VisToggle
              active={!isPublic}
              onClick={() => setIsPublic(false)}
              icon={<Lock className="w-5 h-5" />}
              title="Privada"
              sub="Solo con código"
            />
          </div>

          {error ? (
            <p className="text-sm text-rose-400 text-center">{error}</p>
          ) : null}

          <button
            type="button"
            onClick={handleCreate}
            disabled={loading || !uid || creating}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-white text-black font-bold text-sm uppercase tracking-widest hover:bg-zinc-200 disabled:opacity-40 transition btn-press shadow-lg"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Spade className="w-4 h-4 fill-current" />
            )}
            {creating ? "Creando…" : "Crear mesa"}
          </button>
        </>
      )}
    </div>
  );
}

function VisToggle({
  active,
  onClick,
  icon,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <button type="button" onClick={onClick} className="block text-left btn-press">
      <BorderGlow
        className="w-full"
        glowColor={GLOW}
        colors={GLOW_COLORS}
        backgroundColor={active ? "rgba(24,24,27,0.9)" : "rgba(10,10,12,0.85)"}
        borderRadius={18}
        glowRadius={26}
        glowIntensity={active ? 1.1 : 0.7}
        coneSpread={24}
        fillOpacity={0.4}
        animated={active}
      >
        <div className="flex flex-col gap-1.5 p-4">
          <span className={active ? "text-zinc-50" : "text-zinc-500"}>{icon}</span>
          <span
            className={`text-sm font-semibold ${active ? "text-zinc-50" : "text-zinc-300"}`}
          >
            {title}
          </span>
          <span className="text-[11px] text-zinc-500">{sub}</span>
        </div>
      </BorderGlow>
    </button>
  );
}
