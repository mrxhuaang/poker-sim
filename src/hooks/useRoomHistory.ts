"use client";
// Historial por mano de una sala online, leido desde Supabase (anon, solo
// lectura via RLS) + suscripcion Realtime para recibir manos nuevas en vivo.
// La escritura es server-only (POST /api/history). Ver docs/persistence-setup.md.
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import type { Card } from "@/lib/poker";

export type RoomHandEntry = {
  id: string;
  roomCode: string;
  handNum: number | null;
  players: { id: string; name: string; seed: string }[];
  community: Card[];
  winners: string[];
  category: number;
  runIndex: number | null;
  runTotal: number | null;
  createdAt: string;
};

type Row = {
  id: string;
  room_code: string;
  hand_num: number | null;
  players: RoomHandEntry["players"];
  community: Card[];
  winners: string[];
  category: number;
  run_index: number | null;
  run_total: number | null;
  created_at: string;
};

function fromRow(r: Row): RoomHandEntry {
  return {
    id: r.id,
    roomCode: r.room_code,
    handNum: r.hand_num,
    players: r.players ?? [],
    community: r.community ?? [],
    winners: r.winners ?? [],
    category: r.category,
    runIndex: r.run_index,
    runTotal: r.run_total,
    createdAt: r.created_at,
  };
}

export function useRoomHistory(code: string | null, limit = 50): RoomHandEntry[] {
  const [entries, setEntries] = useState<RoomHandEntry[]>([]);

  useEffect(() => {
    if (!code) {
      setEntries([]);
      return;
    }
    const supabase = getSupabase();
    let active = true;

    supabase
      .from("hand_history")
      .select("*")
      .eq("room_code", code)
      .order("created_at", { ascending: false })
      .limit(limit)
      .then(({ data }) => {
        if (active && data) setEntries((data as Row[]).map(fromRow));
      });

    const ch = supabase
      .channel(`history:${code}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "hand_history",
          filter: `room_code=eq.${code}`,
        },
        (payload) => {
          setEntries((prev) => [fromRow(payload.new as Row), ...prev].slice(0, limit));
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [code, limit]);

  return entries;
}
