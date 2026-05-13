"use client";
import { useEffect, useState } from "react";
import { subscribeRoom, subscribeHole, type RoomDoc, type HoleDoc } from "@/lib/rooms";

export function useRoom(code: string | null) {
  const [room, setRoom] = useState<RoomDoc | null | undefined>(undefined);
  useEffect(() => {
    if (!code) {
      setRoom(null);
      return;
    }
    const unsub = subscribeRoom(code, (r) => setRoom(r));
    return () => unsub();
  }, [code]);
  return room;
}

export function useHole(code: string | null, seatId: string | null) {
  const [hole, setHole] = useState<HoleDoc | null | undefined>(undefined);
  useEffect(() => {
    if (!code || !seatId) {
      setHole(null);
      return;
    }
    const unsub = subscribeHole(code, seatId, (h) => setHole(h));
    return () => unsub();
  }, [code, seatId]);
  return hole;
}
