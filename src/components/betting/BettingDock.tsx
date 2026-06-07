"use client";
import type { ReactNode } from "react";
import { Battery, BatteryLow } from "lucide-react";
import { Avatar } from "@/components/players/Avatar";
import { TurnTimer } from "@/components/betting/TurnTimer";
import { BettingControls } from "@/components/betting/BettingControls";
import type { BettingAction, BettingRound, NormalSeat } from "@/lib/betting";
import { formatChips } from "@/lib/betting";
import type { Card } from "@/lib/poker";
import { describeHand } from "@/lib/handLabel";

type Props = {
  seat: NormalSeat | null;
  name: string;
  seed: string;
  betting: BettingRound | null;
  holeCards: [Card, Card] | null;
  community?: Card[];
  isMyTurn: boolean;
  turnTimeMs: number;
  hasResult: boolean;
  onAction: (action: BettingAction, amount?: number) => void;
  extra?: ReactNode;
  useTimeBank?: boolean;
  onToggleTimeBank?: () => void;
};

export function BettingDock({
  seat,
  name,
  seed,
  betting,
  holeCards,
  community = [],
  isMyTurn,
  turnTimeMs,
  hasResult,
  onAction,
  extra,
  useTimeBank = true,
  onToggleTimeBank,
}: Props) {
  if (!seat && !name) return null;

  const handLabel = holeCards ? describeHand([...holeCards, ...community]) : null;

  return (
    <div className="glass-panel relative w-[min(360px,90vw)] overflow-hidden rounded-[28px] p-3">
      {isMyTurn && (
        <div className="pointer-events-none absolute inset-0 animate-pulse bg-accent-500/8" />
      )}

      <div className="relative z-10 mb-2 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar seed={seed} size={28} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[12px] font-black uppercase leading-tight tracking-tight text-white">
              {name}
            </span>
            {seat && (
              <span className="font-mono text-[10px] font-bold leading-none text-accent">
                {formatChips(seat.chips)}
              </span>
            )}
          </div>
        </div>
        {seat && seat.bet > 0 && (
          <div className="flex flex-col items-end leading-tight">
            <span className="text-[8px] font-black uppercase leading-none tracking-[0.18em] text-zinc-500">
              Apuesta
            </span>
            <span className="text-[12px] font-black leading-tight text-accent tabular-nums">
              {formatChips(seat.bet)}
            </span>
          </div>
        )}
      </div>

      {handLabel && holeCards && (
        <div className="glass mb-2 flex items-center justify-between rounded-2xl px-2.5 py-1.5">
          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">
            Mano
          </span>
          <span className="ml-2 truncate text-[11px] font-black tracking-tight text-accent">
            {handLabel}
          </span>
        </div>
      )}

      {seat && betting && isMyTurn && seat.status === "active" && !hasResult && (
        <div className="animate-in fade-in zoom-in duration-300">
          {seat.turnDeadline && (
            <div className="mb-2">
              <TurnTimer
                deadline={seat.turnDeadline}
                turnTime={turnTimeMs}
                timeBank={seat.timeBank}
                useBank={useTimeBank}
              />
            </div>
          )}
          <BettingControls seat={seat} betting={betting} onAction={onAction} />
        </div>
      )}

      {seat && onToggleTimeBank && (
        <div className="mt-2 flex items-center justify-end">
          <button
            type="button"
            onClick={onToggleTimeBank}
            title={useTimeBank ? "Desactivar timebank" : "Activar timebank"}
            className={`glass-chip btn-press inline-flex items-center gap-1 px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${
              useTimeBank
                ? "glass-button-accent text-accent-100"
                : "glass-button-ghost text-zinc-400"
            }`}
          >
            {useTimeBank ? (
              <Battery className="h-2.5 w-2.5" />
            ) : (
              <BatteryLow className="h-2.5 w-2.5" />
            )}
            TB {useTimeBank ? "ON" : "OFF"}
          </button>
        </div>
      )}

      {extra}
    </div>
  );
}
