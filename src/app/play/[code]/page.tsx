"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Crown, Eye, EyeOff, Flame, RotateCcw, Shuffle, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useHole, useRoom, useLobby } from "@/hooks/useRoom";
import { useCardBack } from "@/hooks/useCardBack";
import { joinLobby, phoneSetSeatFlag } from "@/lib/rooms";
import { randomSeed } from "@/lib/dicebear";
import { Avatar } from "@/components/players/Avatar";
import { PlayingCard } from "@/components/cards/PlayingCard";
import { CardBackPicker } from "@/components/themes/CardBackPicker";
import { BorderGlow } from "@/components/ui/BorderGlow";
import { bestHand, categoryLabel } from "@/lib/handEval";
import type { Card, Rank } from "@/lib/poker";

const RANK_FULL: Record<Rank, string> = {
  "2": "Doses",
  "3": "Treses",
  "4": "Cuatros",
  "5": "Cincos",
  "6": "Seises",
  "7": "Sietes",
  "8": "Ochos",
  "9": "Nueves",
  T: "Dieces",
  J: "Jotas",
  Q: "Reinas",
  K: "Reyes",
  A: "Ases",
};

export default function PlayPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code || "").toUpperCase();
  const { uid, loading } = useAuth();
  const room = useRoom(code);
  const lobby = useLobby(code);

  const inLobby = useMemo(
    () => (uid ? lobby.find((p) => p.uid === uid) : null),
    [uid, lobby],
  );
  const mySeat = uid && room?.state
    ? room.state.seats.find((s) => s.id === uid)
    : null;
  const hole = useHole(code, mySeat?.id ?? null);

  if (loading || room === undefined) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-10 text-center text-zinc-500 text-sm">
        Conectando…
      </div>
    );
  }
  if (room === null) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-10 text-center">
        <p className="text-zinc-300">Sala no encontrada.</p>
        <p className="text-xs text-zinc-500 mt-2">Código: {code}</p>
      </div>
    );
  }

  if (!mySeat) {
    if (!inLobby) {
      return <LobbyForm code={code} uid={uid} />;
    }
    return (
      <div className="w-full max-w-md mx-auto px-4 py-10 flex flex-col items-center gap-4 text-center">
        <Avatar seed={inLobby.seed} size={72} />
        <h1 className="text-xl text-zinc-100">Hola, {inLobby.name}</h1>
        <p className="text-sm text-zinc-400">
          Estás en la sala <span className="font-mono">{code}</span>. Esperando
          que el host reparta.
        </p>
        <p className="text-[11px] text-zinc-500">
          {lobby.length} jugador{lobby.length === 1 ? "" : "es"} conectado
          {lobby.length === 1 ? "" : "s"}.
        </p>
      </div>
    );
  }

  return (
    <PhoneGameView
      code={code}
      mySeat={mySeat}
      room={room}
      hole={hole?.cards}
    />
  );
}

function LobbyForm({ code, uid }: { code: string; uid: string | null }) {
  const [name, setName] = useState("");
  const [seed, setSeed] = useState(() => randomSeed());
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!uid || !name.trim() || submitting) return;
    setSubmitting(true);
    try {
      await joinLobby(code, uid, name.trim(), seed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="w-full max-w-md mx-auto px-4 py-10 flex flex-col gap-6"
    >
      <header className="text-center">
        <h1 className="text-xl text-zinc-100">Sala {code}</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Elige tu apodo y avatar.
        </p>
      </header>

      <BorderGlow
        className="w-full"
        edgeSensitivity={26}
        glowColor="152 68 48"
        backgroundColor="rgba(8, 10, 16, 0.9)"
        borderRadius={20}
        glowRadius={30}
        glowIntensity={1}
        coneSpread={24}
        animated={false}
        colors={["#34d399", "#38bdf8", "#c4b5fd"]}
        fillOpacity={0.45}
      >
        <div className="flex flex-col gap-6 p-5">
          <div className="flex flex-col items-center gap-3">
            <Avatar seed={seed} size={120} />
            <button
              type="button"
              onClick={() => setSeed(randomSeed())}
              className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/10 btn-press"
            >
              <Shuffle className="w-3.5 h-3.5" />
              Otro avatar
            </button>
          </div>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu apodo"
            maxLength={20}
            autoFocus
            className="rounded-2xl bg-black/40 px-5 py-4 text-center text-lg text-zinc-100 outline-none ring-1 ring-white/10 focus:ring-emerald-400/40"
          />

          <button
            type="submit"
            disabled={!name.trim() || submitting}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/90 px-5 py-3 font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-30 btn-press"
          >
            Entrar a la mesa
          </button>
        </div>
      </BorderGlow>
    </form>
  );
}

function handLabel(hole: [Card, Card], community: Card[]): string | null {
  const all: Card[] = [...hole, ...community];
  if (all.length >= 5) return categoryLabel(bestHand(all));
  if (hole[0].rank === hole[1].rank) return `Par de ${RANK_FULL[hole[0].rank]}`;
  return null;
}

function PhoneGameView({
  code,
  mySeat,
  room,
  hole,
}: {
  code: string;
  mySeat: NonNullable<NonNullable<ReturnType<typeof useRoom>>["state"]>["seats"][number];
  room: NonNullable<ReturnType<typeof useRoom>>;
  hole?: [Card, Card];
}) {
  const winners = room.result?.winners ?? [];
  const isWinner = winners.includes(mySeat.id);
  const seats = room.state!.seats;
  const activeCount = seats.filter((s) => !s.folded).length;
  const [revealing, setRevealing] = useState(false);
  const { cardBack, setCardBack } = useCardBack();
  const [folding, setFolding] = useState(false);
  const [showCardBackPicker, setShowCardBackPicker] = useState(false);

  useEffect(() => {
    if (room.result) setRevealing(true);
  }, [room.result]);

  const label = hole ? handLabel(hole, room.state!.community) : null;

  async function onFoldToggle() {
    if (folding) return;
    setFolding(true);
    try {
      await phoneSetSeatFlag(code, mySeat.id, "folded", !mySeat.folded);
    } catch {
      /* ignore */
    } finally {
      setFolding(false);
    }
  }

  async function onRevealToggle() {
    try {
      await phoneSetSeatFlag(code, mySeat.id, "revealed", !mySeat.revealed);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="w-full max-w-md mx-auto px-4 py-6 flex flex-col gap-5">
      <header className="flex items-center justify-between p-3 rounded-2xl glass elevate">
        <div className="flex items-center gap-2">
          <Avatar seed={mySeat.seed} size={36} />
          <div className="flex flex-col">
            <span className="text-sm text-zinc-100">{mySeat.name}</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
              Sala {code}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            Calle
          </div>
          <div className="text-sm text-zinc-100">{room.state!.street}</div>
        </div>
      </header>

      {room.result ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-amber-300/10 ring-1 ring-amber-300/40 text-amber-100">
          <Crown className="w-4 h-4 text-amber-300" />
          <span className="text-sm">
            {isWinner
              ? "¡Ganas esta mano!"
              : `Gana: ${seats
                  .filter((s) => winners.includes(s.id))
                  .map((s) => s.name)
                  .join(" · ")}`}
          </span>
        </div>
      ) : null}

      {/* All-in Negotiation */}
      {room.state?.phase === 'all-in-negotiation' && !mySeat.folded && (
        <div className="animate-in zoom-in fade-in duration-300 px-4 py-5 rounded-3xl bg-emerald-500/10 ring-1 ring-emerald-400/40 text-center flex flex-col gap-4">
          <div>
            <h3 className="text-lg font-bold text-emerald-100">¡All-in!</h3>
            <p className="text-xs text-emerald-200/60 uppercase tracking-widest mt-1">¿Cuántas veces quieres tirar el resto?</p>
          </div>
          <div className="flex items-center gap-2 justify-center">
            {[1, 2, 3].map(n => (
              <button
                key={n}
                onClick={() => {
                  phoneSetSeatFlag(code, mySeat.id, 'vote' as any, n);
                }}
                className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg transition btn-press ${
                  (room.state?.allInNegotiation?.votes?.[mySeat.id] === n)
                  ? 'bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/30'
                  : 'bg-white/5 text-zinc-300 hover:bg-white/10 ring-1 ring-white/10'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-zinc-500">La mesa esperará a que todos los implicados elijan.</p>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            Tus cartas
          </span>
          <button
            type="button"
            onClick={() => setShowCardBackPicker((v) => !v)}
            className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 hover:text-zinc-200 transition inline-flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            Dorso
          </button>
        </div>
        {showCardBackPicker ? (
          <div className="mt-2">
            <CardBackPicker value={cardBack} onChange={setCardBack} />
          </div>
        ) : null}
        <div className="mt-2 flex items-center gap-3 justify-center p-4 rounded-2xl glass">
          {hole ? (
            <>
              <PlayingCard
                card={hole[0]}
                faceUp={mySeat.revealed || revealing}
                size="lg"
                dealIn={false}
                cardBack={cardBack}
              />
              <PlayingCard
                card={hole[1]}
                faceUp={mySeat.revealed || revealing}
                size="lg"
                dealIn={false}
                cardBack={cardBack}
              />
            </>
          ) : (
            <div className="text-xs text-zinc-500 py-8">Sin cartas.</div>
          )}
        </div>
        {label && hole ? (
          <div className="mt-2 flex items-center justify-center">
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 ring-1 ring-emerald-400/30 text-emerald-200 text-xs">
              {label}
            </span>
          </div>
        ) : null}
        <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onRevealToggle}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 ring-1 ring-white/10 text-zinc-100 text-sm transition btn-press"
          >
            {mySeat.revealed ? (
              <>
                <EyeOff className="w-4 h-4" /> Ocultar
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" /> Mostrar a la mesa
              </>
            )}
          </button>
          {!room.result ? (
            <button
              type="button"
              onClick={onFoldToggle}
              disabled={folding}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ring-1 text-sm font-medium transition btn-press ${
                mySeat.folded
                  ? "bg-white/5 ring-white/10 text-zinc-200 hover:bg-white/10"
                  : "bg-rose-500/90 ring-rose-400/40 text-rose-950 hover:bg-rose-400"
              } ${folding ? "opacity-60" : ""}`}
            >
              {mySeat.folded ? (
                <>
                  <RotateCcw className="w-4 h-4" /> Reactivar
                </>
              ) : (
                <>
                  <Flame className="w-4 h-4" /> Foldear
                </>
              )}
            </button>
          ) : null}
        </div>
      </section>

      <section>
        <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          Comunitarias ({room.state!.community.length}/5)
        </span>
        <div className="mt-2 flex items-center gap-2 overflow-x-auto p-3 rounded-2xl glass">
          {room.state!.community.length === 0 ? (
            <span className="text-xs text-zinc-500 py-4 mx-auto">
              Pre-flop. Sin cartas comunitarias.
            </span>
          ) : (
            room.state!.community.map((c, i) => (
              <PlayingCard
                key={c.id + i}
                card={c}
                faceUp
                size="md"
                dealIn={false}
                cardBack={cardBack}
              />
            ))
          )}
        </div>
      </section>

      <section>
        <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          Otros jugadores ({activeCount} activos)
        </span>
        <ul className="mt-2 grid grid-cols-1 gap-2">
          {seats
            .filter((s) => s.id !== mySeat.id)
            .map((s) => (
              <li
                key={s.id}
                className={`flex items-center gap-3 p-2 rounded-xl ring-1 ${
                  winners.includes(s.id)
                    ? "bg-amber-300/10 ring-amber-300/40"
                    : s.folded
                      ? "bg-white/[0.01] ring-white/5 opacity-50"
                      : "bg-white/[0.02] ring-white/10"
                }`}
              >
                <Avatar seed={s.seed} size={32} />
                <span className="flex-1 text-sm text-zinc-100 truncate">
                  {s.name}
                </span>
                {s.folded ? (
                  <span className="text-[10px] uppercase tracking-[0.15em] text-rose-300">
                    Fold
                  </span>
                ) : winners.includes(s.id) ? (
                  <Crown className="w-4 h-4 text-amber-300" />
                ) : null}
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
