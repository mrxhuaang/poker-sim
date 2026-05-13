"use client";
import { useState } from "react";
import {
  Check,
  X,
  Lock,
  Unlock,
  UserX,
  ChevronUp,
  ChevronDown,
  Coins,
  RefreshCw,
} from "lucide-react";
import { Avatar } from "@/components/players/Avatar";
import { formatChips } from "@/lib/betting";
import type { NormalLobbyPlayer } from "@/lib/normalRooms";
import {
  approveJoin,
  patchLobbyPlayer,
  setTableLocked,
  patchNormalRoom,
} from "@/lib/normalRooms";
import {
  rejectStackRequest,
  dismissStackRequest,
  type StackRequest,
} from "@/lib/stackRequests";
import type { NormalSeat } from "@/lib/betting";
import type { RoomConfig } from "@/lib/betting";

type Props = {
  code: string;
  requests: StackRequest[];
  lobby: NormalLobbyPlayer[];
  gameSeats: NormalSeat[] | null;
  config: RoomConfig;
  locked: boolean;
  onAdjustChips: (uid: string, delta: number) => void;
  onSetAllChips: (amount: number) => void;
  onKick: (uid: string) => Promise<void>;
};

function ApproveRow({
  code,
  req,
  config,
}: {
  code: string;
  req: StackRequest;
  config: RoomConfig;
}) {
  const [amount, setAmount] = useState(req.requestedStack);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleApprove() {
    setLoading(true);
    try {
      if (req.type === "join") {
        await approveJoin(code, req.uid, req.name, req.seed, amount);
      } else {
        // rebuy: add to pendingRebuys
        await patchNormalRoom(code, {
          [`pendingRebuys.${req.uid}`]: amount,
        });
      }
      await dismissStackRequest(code, req.uid);
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    setLoading(true);
    try {
      await rejectStackRequest(code, req.uid, rejectReason || undefined);
    } finally {
      setLoading(false);
    }
  }

  const isRebuy = req.type === "rebuy";

  return (
    <li className="flex flex-col gap-2 p-3 rounded-xl glass ring-1 ring-white/8">
      <div className="flex items-center gap-2">
        <Avatar seed={req.seed} size={28} />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-zinc-100 truncate font-medium">
            {req.name}
          </div>
          <div className="text-[11px] text-zinc-500 flex items-center gap-1">
            {isRebuy ? (
              <RefreshCw className="w-3 h-3" />
            ) : (
              <Coins className="w-3 h-3" />
            )}
            {isRebuy ? "Rebuy" : "Entrada"} ·{" "}
            {formatChips(req.requestedStack)} solicitados
          </div>
        </div>
      </div>

      {showReject ? (
        <div className="flex flex-col gap-1.5">
          <input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Razón (opcional)"
            className="px-2.5 py-1.5 rounded-lg bg-black/40 ring-1 ring-white/10 text-zinc-100 text-xs outline-none focus:ring-rose-400/40"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleReject}
              disabled={loading}
              className="flex-1 px-3 py-1.5 rounded-lg bg-rose-500/20 ring-1 ring-rose-400/30 text-rose-200 text-xs hover:bg-rose-500/30 disabled:opacity-40 transition"
            >
              Confirmar rechazo
            </button>
            <button
              type="button"
              onClick={() => setShowReject(false)}
              className="px-3 py-1.5 rounded-lg glass ring-1 ring-white/10 text-zinc-400 text-xs hover:bg-white/10 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
            min={1}
            step={100}
            className="w-24 px-2.5 py-1.5 rounded-lg bg-black/40 ring-1 ring-white/10 text-zinc-100 text-xs outline-none focus:ring-emerald-400/40 tabular-nums"
          />
          <button
            type="button"
            onClick={() => setAmount(config.startingStack)}
            className="px-2 py-1.5 rounded-lg glass ring-1 ring-white/8 text-zinc-400 text-[10px] hover:bg-white/10 transition"
          >
            Std
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setShowReject(true)}
            disabled={loading}
            className="p-1.5 rounded-lg glass ring-1 ring-white/8 text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={loading}
            className="p-1.5 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-400/30 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-40 transition"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </li>
  );
}

function PlayerRow({
  seat,
  lobbyPlayer,
  code,
  onAdjust,
  onKick,
}: {
  seat: NormalSeat | null;
  lobbyPlayer: NormalLobbyPlayer;
  code: string;
  onAdjust: (uid: string, delta: number) => void;
  onKick: (uid: string) => Promise<void>;
}) {
  const [customDelta, setCustomDelta] = useState(500);
  const [setAmount, setSetAmount] = useState(
    seat?.chips ?? lobbyPlayer.chips,
  );
  const [showSet, setShowSet] = useState(false);
  const chips = seat?.chips ?? lobbyPlayer.chips;
  const isOut = seat?.status === "out";

  async function handleKick() {
    await onKick(lobbyPlayer.uid);
  }

  async function handleToggleSitOut() {
    await patchLobbyPlayer(code, lobbyPlayer.uid, {
      sittingOut: !lobbyPlayer.sittingOut,
    }).catch(() => {});
  }

  function handleSetChips() {
    if (!seat) {
      patchLobbyPlayer(code, lobbyPlayer.uid, { chips: setAmount }).catch(
        () => {},
      );
    } else {
      onAdjust(lobbyPlayer.uid, setAmount - chips);
    }
    setShowSet(false);
  }

  return (
    <li
      className={`flex flex-col gap-2 p-3 rounded-xl ring-1 transition ${
        isOut ? "glass ring-white/5 opacity-40" : "glass ring-white/8"
      }`}
    >
      <div className="flex items-center gap-2">
        <Avatar seed={lobbyPlayer.seed} size={28} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-zinc-100 truncate">
              {lobbyPlayer.name}
            </span>
            {lobbyPlayer.sittingOut && (
              <span className="text-[9px] uppercase tracking-widest text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded-full">
                Away
              </span>
            )}
            {seat?.status === "all-in" && (
              <span className="text-[9px] uppercase tracking-widest text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded-full">
                All-in
              </span>
            )}
          </div>
          <div className="text-xs tabular-nums text-emerald-300 font-medium">
            {formatChips(chips)}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleToggleSitOut}
            title={lobbyPlayer.sittingOut ? "Reactivar" : "Sentar fuera"}
            className="p-1.5 rounded-lg glass ring-1 ring-white/8 text-zinc-400 hover:bg-white/10 transition text-[10px]"
          >
            {lobbyPlayer.sittingOut ? "▶" : "⏸"}
          </button>
          <button
            type="button"
            onClick={handleKick}
            title="Expulsar"
            className="p-1.5 rounded-lg glass ring-1 ring-white/8 text-rose-400/60 hover:bg-rose-500/10 hover:text-rose-400 transition"
          >
            <UserX className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!isOut && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onAdjust(lobbyPlayer.uid, -customDelta)}
            className="px-2 py-1 rounded-lg glass ring-1 ring-white/8 text-xs text-rose-300 hover:bg-rose-500/10 transition tabular-nums"
          >
            -{formatChips(customDelta)}
          </button>
          <input
            type="number"
            value={customDelta}
            onChange={(e) => setCustomDelta(Math.max(1, Number(e.target.value)))}
            min={1}
            step={100}
            className="w-16 px-2 py-1 rounded-lg bg-black/40 ring-1 ring-white/10 text-zinc-300 text-xs outline-none text-center tabular-nums"
          />
          <button
            type="button"
            onClick={() => onAdjust(lobbyPlayer.uid, customDelta)}
            className="px-2 py-1 rounded-lg glass ring-1 ring-white/8 text-xs text-emerald-300 hover:bg-emerald-500/10 transition tabular-nums"
          >
            +{formatChips(customDelta)}
          </button>
          <button
            type="button"
            onClick={() => setShowSet((v) => !v)}
            className="ml-auto px-2 py-1 rounded-lg glass ring-1 ring-white/8 text-xs text-zinc-400 hover:bg-white/10 transition"
          >
            Set
          </button>
        </div>
      )}

      {showSet && !isOut && (
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={setAmount}
            onChange={(e) => setSetAmount(Math.max(0, Number(e.target.value)))}
            min={0}
            step={100}
            className="flex-1 px-2 py-1.5 rounded-lg bg-black/40 ring-1 ring-white/10 text-zinc-100 text-xs outline-none tabular-nums"
          />
          <button
            type="button"
            onClick={handleSetChips}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 ring-1 ring-emerald-400/30 text-emerald-300 text-xs hover:bg-emerald-500/30 transition"
          >
            Aplicar
          </button>
        </div>
      )}
    </li>
  );
}

export function StackRequestPanel({
  code,
  requests,
  lobby,
  gameSeats,
  config,
  locked,
  onAdjustChips,
  onSetAllChips,
  onKick,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [setAllAmount, setSetAllAmount] = useState(config.startingStack);

  const pending = requests.filter((r) => r.status === "pending");
  const hasNotifs = pending.length > 0;

  return (
    <div className="rounded-2xl glass overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-200 font-medium">Jugadores</span>
          {hasNotifs && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-bold">
              {pending.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setTableLocked(code, !locked).catch(() => {});
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] ring-1 transition ${
              locked
                ? "bg-rose-500/20 ring-rose-400/30 text-rose-300 hover:bg-rose-500/30"
                : "glass ring-white/10 text-zinc-400 hover:bg-white/10"
            }`}
          >
            {locked ? (
              <>
                <Lock className="w-3 h-3" /> Cerrada
              </>
            ) : (
              <>
                <Unlock className="w-3 h-3" /> Abierta
              </>
            )}
          </button>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-4">
          {/* Pending requests */}
          {pending.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-amber-400">
                Solicitudes pendientes
              </span>
              <ul className="flex flex-col gap-2">
                {pending.map((req) => (
                  <ApproveRow
                    key={req.uid}
                    code={code}
                    req={req}
                    config={config}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* Active players */}
          {lobby.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                En sala ({lobby.length})
              </span>
              <ul className="flex flex-col gap-2">
                {lobby.map((p) => (
                  <PlayerRow
                    key={p.uid}
                    seat={gameSeats?.find((s) => s.id === p.uid) ?? null}
                    lobbyPlayer={p}
                    code={code}
                    onAdjust={onAdjustChips}
                    onKick={onKick}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* Set all chips */}
          {lobby.length > 0 && (
            <div className="flex items-center gap-2 pt-1 border-t border-white/8">
              <span className="text-xs text-zinc-500 shrink-0">Igualar a</span>
              <input
                type="number"
                value={setAllAmount}
                onChange={(e) =>
                  setSetAllAmount(Math.max(1, Number(e.target.value)))
                }
                min={1}
                step={100}
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-black/40 ring-1 ring-white/10 text-zinc-100 text-xs outline-none tabular-nums"
              />
              <button
                type="button"
                onClick={() => onSetAllChips(setAllAmount)}
                className="px-3 py-1.5 rounded-full glass ring-1 ring-white/10 text-xs text-zinc-200 hover:bg-white/10 transition whitespace-nowrap"
              >
                Igualar todos
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
