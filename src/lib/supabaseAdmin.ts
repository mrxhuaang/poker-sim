// Supabase service-role client — SOLO servidor. Salta RLS, por eso es la
// autoridad de escritura de datos durables (p. ej. hand_history). El cliente
// NUNCA escribe directo; pasa por una API Route que verifica el idToken de
// Firebase (mismo patron que firebaseAdmin.ts / economyServer.ts).
//
// NO importar desde codigo de cliente. La clave vive en una variable de entorno
// server-only (sin prefijo NEXT_PUBLIC):
//   SUPABASE_SERVICE_ROLE_KEY
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (server-only).",
    );
  }
  _client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
