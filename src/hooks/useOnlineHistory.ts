"use client";
// Subscribes to hand history for an online room from Supabase Postgres.
// The Go server writes records at showdown; this hook polls on mount and
// re-fetches whenever the phase transitions to "showdown" (via statePhase).
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";

export type OnlineHandRecord = {
  id: number;
  room: string;
  hand_num: number;
  played_at: string;
  pot: number;
  community: string[];
  winners: { id: string; amount: number }[];
  reveals: Record<string, string[]> | null;
  categories: Record<string, number> | null;
  seat_ids: string[];
  seat_names: Record<string, string>;
};

const HAND_CATEGORY_LABEL = [
  "Carta alta",
  "Par",
  "Doble par",
  "Trío",
  "Escalera",
  "Color",
  "Full house",
  "Póker",
  "Escalera de color",
] as const;

export function categoryLabel(cat: number): string {
  return HAND_CATEGORY_LABEL[cat] ?? "—";
}

// triggerKey should be bumped by the caller whenever new records are expected
// (e.g. pass state.handNum when state.phase === "showdown", else 0).
export function useOnlineHistory(
  room: string | null,
  triggerKey: number | string = 0,
): { records: OnlineHandRecord[]; loading: boolean } {
  const [records, setRecords] = useState<OnlineHandRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!room) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const sb = getSupabase();
        const { data, error } = await sb
          .from("online_hand_records")
          .select("*")
          .eq("room", room)
          .order("played_at", { ascending: false })
          .limit(50);
        if (!cancelled && !error && data) {
          setRecords(data as OnlineHandRecord[]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [room, triggerKey]);

  return { records, loading };
}
