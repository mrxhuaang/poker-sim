"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { NormalGameState, RoomConfig } from "@/lib/betting";
import {
  handleAction,
  startHand,
  computeSidePots,
} from "@/lib/betting";
import type { NormalRoomDoc, PendingAction, NormalLobbyPlayer } from "@/lib/normalRooms";
import {
  lobbyToSeats,
  patchNormalRoom,
  kickFromLobby,
  writeNormalDealt,
} from "@/lib/normalRooms";
import { showdown } from "@/lib/handEval";
import type { Card } from "@/lib/poker";

type UseNormalGameReturn = {
  gameState: NormalGameState | null;
  startNewHand: () => Promise<void>;
  resolveShowdown: () => Promise<void>;
  adjustPlayerChips: (uid: string, delta: number) => void;
  setAllChips: (amount: number) => void;
  kickPlayer: (uid: string) => Promise<void>;
  isProcessing: boolean;
};

export function useNormalGame(
  code: string | null,
  room: NormalRoomDoc | null,
  lobby: NormalLobbyPlayer[],
  uid: string | null,
  holeCards: Record<string, [Card, Card]>,
): UseNormalGameReturn {
  const [gameState, setGameState] = useState<NormalGameState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const handNumRef = useRef(0);
  const dealerIdxRef = useRef(-1);
  const isAdminRef = useRef(false);

  useEffect(() => {
    isAdminRef.current = !!(uid && room?.adminUid === uid);
  }, [uid, room?.adminUid]);

  // Sync state from Firestore → local (non-admin clients just read)
  useEffect(() => {
    if (!room?.state) return;
    if (isAdminRef.current) return; // admin owns local state
    const { deckCount: _dc, ...rest } = room.state;
    void _dc;
    setGameState({ ...rest, deck: [] } as NormalGameState);
  }, [room?.state]);

  // Admin: process pending actions from players
  useEffect(() => {
    if (!isAdminRef.current || !code || !room?.pendingAction || !gameState)
      return;
    const pa: PendingAction = room.pendingAction;
    if (Date.now() - pa.ts > 30_000) return; // stale

    setIsProcessing(true);
    const newState = handleAction(
      gameState,
      pa.seatId,
      pa.action,
      pa.amount ?? 0,
    );
    setGameState(newState);
    patchNormalRoom(code, {
      state: toPublicState(newState),
      pendingAction: null,
    })
      .catch(() => {})
      .finally(() => setIsProcessing(false));
  }, [room?.pendingAction, code, gameState]);

  // Admin: auto-fold on turn timer expiry
  useEffect(() => {
    if (!isAdminRef.current || !gameState || !code) return;
    const toActId = gameState.betting.toActId;
    if (!toActId) return;
    const seat = gameState.seats.find((s) => s.id === toActId);
    if (!seat?.turnDeadline) return;

    const delay = seat.turnDeadline - Date.now() + seat.timeBank;
    if (delay <= 0) return;

    const timer = setTimeout(() => {
      if (!gameState) return;
      const newState = handleAction(gameState, toActId, "fold");
      setGameState(newState);
      if (code) {
        patchNormalRoom(code, {
          state: toPublicState(newState),
          pendingAction: null,
        }).catch(() => {});
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [gameState, code]);

  // Admin: write state to Firestore when it changes
  const lastStateRef = useRef<NormalGameState | null>(null);
  useEffect(() => {
    if (!isAdminRef.current || !code || !gameState) return;
    if (lastStateRef.current === gameState) return;
    lastStateRef.current = gameState;
    patchNormalRoom(code, { state: toPublicState(gameState) }).catch(() => {});
  }, [gameState, code]);

  const startNewHand = useCallback(async () => {
    if (!code || !isAdminRef.current) return;
    const ownersMap: Record<string, string | null> = {};
    for (const p of lobby) ownersMap[p.uid] = p.uid;

    const seats = gameState
      ? gameState.seats.map((s) => ({
          ...s,
          bet: 0,
          totalBet: 0,
          revealed: false,
          turnDeadline: null,
        }))
      : lobbyToSeats(
          lobby,
          room?.config ?? { mode: "normal", startingStack: 1000, smallBlind: 5, bigBlind: 10, ante: 0, turnTime: 30000, timeBankInit: 60000 },
          ownersMap,
        );

    const config: RoomConfig = room?.config ?? {
      mode: "normal",
      startingStack: 1000,
      smallBlind: 5,
      bigBlind: 10,
      ante: 0,
      turnTime: 30_000,
      timeBankInit: 60_000,
    };

    // Apply pending rebuys from approved requests
    const pendingRebuys = room?.pendingRebuys ?? {};
    const seatsWithRebuys = seats.map((s) => {
      const rebuy = pendingRebuys[s.id];
      if (rebuy && rebuy > 0) return { ...s, chips: s.chips + rebuy, status: "active" as const };
      return s;
    });
    if (Object.keys(pendingRebuys).length > 0) {
      patchNormalRoom(code, { pendingRebuys: {} }).catch(() => {});
    }

    handNumRef.current += 1;
    const newState = startHand(
      seatsWithRebuys,
      config,
      handNumRef.current,
      dealerIdxRef.current,
    );
    dealerIdxRef.current = newState.betting.dealerIdx;

    // Deal hole cards from the new deck
    const newHoleCards: Record<string, [Card, Card]> = {};
    const deck = newState.deck.slice();
    for (const seat of newState.seats) {
      if (seat.status === "active" || seat.status === "all-in") {
        newHoleCards[seat.id] = [deck.shift()!, deck.shift()!];
      }
    }
    const finalState: NormalGameState = {
      ...newState,
      deck,
    };

    setGameState(finalState);
    await writeNormalDealt(code, finalState, newHoleCards, ownersMap);
  }, [code, gameState, lobby, room?.config]);

  const resolveShowdown = useCallback(async () => {
    if (!gameState || !code) return;

    const activeSeatIds = gameState.seats
      .filter((s) => s.status !== "folded" && s.status !== "out")
      .map((s) => s.id);

    const handShodownSeats = activeSeatIds
      .map((id) => {
        const seat = gameState.seats.find((s) => s.id === id)!;
        const cards = holeCards[id];
        if (!cards) return null;
        return { player: { id }, hole: cards, folded: seat.status === "folded" };
      })
      .filter(Boolean) as { player: { id: string }; hole: [Card, Card]; folded: boolean }[];

    const result = showdown(handShodownSeats, gameState.community);
    if (!result) return;

    // Distribute pots
    const sidePots = computeSidePots(
      gameState.seats,
      gameState.betting.pot,
    );
    const newChips: Record<string, number> = {};
    for (const seat of gameState.seats) {
      newChips[seat.id] = seat.chips;
    }

    for (const pot of sidePots) {
      const eligibleWinners = result.winners.filter((w) =>
        pot.eligibleIds.includes(w),
      );
      if (eligibleWinners.length === 0) {
        // Fallback: give to best hand among eligible
        const bestEligible = pot.eligibleIds.find((id) =>
          result.winners.includes(id),
        );
        if (bestEligible) {
          newChips[bestEligible] = (newChips[bestEligible] ?? 0) + pot.amount;
        }
      } else {
        const share = Math.floor(pot.amount / eligibleWinners.length);
        const remainder = pot.amount - share * eligibleWinners.length;
        for (let i = 0; i < eligibleWinners.length; i++) {
          newChips[eligibleWinners[i]] =
            (newChips[eligibleWinners[i]] ?? 0) + share + (i === 0 ? remainder : 0);
        }
      }
    }

    // Reveal all non-folded seats
    const newSeats = gameState.seats.map((s) => ({
      ...s,
      chips: newChips[s.id] ?? s.chips,
      revealed: s.status !== "folded",
      bet: 0,
      totalBet: 0,
      status: (newChips[s.id] ?? s.chips) === 0 ? ("out" as const) : ("waiting" as const),
    }));

    const newState: NormalGameState = {
      ...gameState,
      seats: newSeats,
      phase: "showdown",
    };
    setGameState(newState);

    await patchNormalRoom(code, {
      state: toPublicState(newState),
      result: { ...result, chips: newChips },
    });
  }, [gameState, code, holeCards]);

  const adjustPlayerChips = useCallback(
    (playerId: string, delta: number) => {
      if (!code) return;
      setGameState((prev) => {
        if (!prev) return prev;
        const seats = prev.seats.map((s) =>
          s.id === playerId
            ? { ...s, chips: Math.max(0, s.chips + delta) }
            : s,
        );
        const next = { ...prev, seats };
        patchNormalRoom(code, { state: toPublicState(next) }).catch(() => {});
        return next;
      });
    },
    [code],
  );

  const setAllChips = useCallback(
    (amount: number) => {
      if (!code) return;
      setGameState((prev) => {
        if (!prev) return prev;
        const seats = prev.seats.map((s) =>
          s.status !== "out" && s.status !== "sitting-out"
            ? { ...s, chips: amount }
            : s,
        );
        const next = { ...prev, seats };
        patchNormalRoom(code, { state: toPublicState(next) }).catch(() => {});
        return next;
      });
    },
    [code],
  );

  const kickPlayer = useCallback(
    async (playerId: string) => {
      if (!code) return;
      setGameState((prev) => {
        if (!prev) return prev;
        const seats = prev.seats.map((s) =>
          s.id === playerId ? { ...s, status: "out" as const } : s,
        );
        const next = { ...prev, seats };
        patchNormalRoom(code, { state: toPublicState(next) }).catch(() => {});
        return next;
      });
      await kickFromLobby(code, playerId).catch(() => {});
    },
    [code],
  );

  return {
    gameState,
    startNewHand,
    resolveShowdown,
    adjustPlayerChips,
    setAllChips,
    kickPlayer,
    isProcessing,
  };
}

function toPublicState(gs: NormalGameState) {
  const { deck, ...rest } = gs;
  return { ...rest, deckCount: deck.length };
}
