// Autoridad server-side del historial por mano (modo online). El uid se deriva
// del idToken de Firebase; recordHand verifica que sea el host de la sala.
// Runtime Node (Admin SDK no corre en Edge).
import { NextResponse } from "next/server";
import { verifyBearerUid } from "@/lib/firebaseAdmin";
import { recordHand, type HandRecord } from "@/lib/handHistoryServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const uid = await verifyBearerUid(req);
  if (!uid) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  try {
    await recordHand(uid, (body.hand ?? {}) as HandRecord);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno";
    const known = ["Falta code", "Sala inexistente", "No autorizado"];
    const status = known.includes(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
