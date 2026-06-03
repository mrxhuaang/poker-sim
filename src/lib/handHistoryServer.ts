// Escritura server-authoritative del historial por mano (modo online).
// Solo el HOST de la sala puede grabar su historial: se verifica que el uid del
// idToken == normalRooms/{code}.hostUid antes de insertar con la service-role
// key de Supabase (que salta RLS). Los clientes leen via anon + Realtime.
import "server-only";
import { adminDb } from "./firebaseAdmin";
import { supabaseAdmin } from "./supabaseAdmin";
import type { Card } from "./poker";

export type HandRecord = {
  code: string;
  handNum?: number;
  players: { id: string; name: string; seed: string }[];
  community: Card[];
  winners: string[];
  category: number;
  runIndex?: number;
  runTotal?: number;
};

export async function recordHand(uid: string, hand: HandRecord): Promise<void> {
  const code = String(hand?.code ?? "").slice(0, 64);
  if (!code) throw new Error("Falta code");

  // Autoridad: solo el host de la sala escribe su historial.
  const roomSnap = await adminDb().collection("normalRooms").doc(code).get();
  if (!roomSnap.exists) throw new Error("Sala inexistente");
  const hostUid = (roomSnap.data() as { hostUid?: string }).hostUid;
  if (hostUid !== uid) throw new Error("No autorizado");

  const players = Array.isArray(hand.players)
    ? hand.players.slice(0, 10).map((p) => ({
        id: String(p?.id ?? "").slice(0, 64),
        name: String(p?.name ?? "").slice(0, 60),
        seed: String(p?.seed ?? "").slice(0, 64),
      }))
    : [];
  const community = Array.isArray(hand.community) ? hand.community.slice(0, 5) : [];
  const winners = Array.isArray(hand.winners)
    ? hand.winners.slice(0, 10).map((w) => String(w).slice(0, 64))
    : [];
  const category = Math.max(0, Math.min(8, Math.floor(Number(hand.category ?? 0))));
  const handNum = Number.isFinite(hand.handNum) ? Math.floor(hand.handNum as number) : null;
  const runIndex = Number.isFinite(hand.runIndex) ? Math.floor(hand.runIndex as number) : null;
  const runTotal = Number.isFinite(hand.runTotal) ? Math.floor(hand.runTotal as number) : null;

  const { error } = await supabaseAdmin().from("hand_history").insert({
    room_code: code,
    hand_num: handNum,
    players,
    community,
    winners,
    category,
    run_index: runIndex,
    run_total: runTotal,
  });
  if (error) throw new Error(error.message);
}
