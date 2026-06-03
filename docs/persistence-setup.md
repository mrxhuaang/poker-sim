# Durable persistence setup (F2)

Moves important state off host-device `localStorage` into Supabase Postgres so it
survives device switches and is visible to all seats. Auth stays Firebase; Supabase
is data-only.

## Supabase project

- Project: **poker-sim** — ref `fpbmrxfcrphrjwwegqsn`, region `us-east-1`, free tier.
- URL: `https://fpbmrxfcrphrjwwegqsn.supabase.co`
- Same Supabase project also backs the voice signaling (Realtime Broadcast/Presence).

## Schema (migration `f2_durable_stats_and_hand_history`)

| Table | Keyed by | Purpose |
|-------|----------|---------|
| `player_stats` | `uid` (Firebase) | Per-player lifetime stats for `/perfil`: hands played/won, showdowns won, biggest pot, net profit. Accumulates across rooms. |
| `hand_history` | `id` (uuid), indexed `(room_code, created_at desc)` | Per-room hand timeline. All seats read it. In the `supabase_realtime` publication so phones get new hands live. |

## Security model

- **RLS enabled on both tables. Public SELECT only.** Play-money; the room code is
  the access capability (same posture as the current Firestore test rules).
- **No anon write policy** → the anon key cannot insert/update/delete.
- **All writes go through the server** (route handler) using the `service_role` key,
  which bypasses RLS. The server verifies the Firebase `idToken` first and derives the
  uid from it — identical to the `/api/economy` pattern. Clients never write directly.
- Security advisor after migration: clean (no lints).

## Required env vars

Public (bundle, read-only): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
Server-only (never `NEXT_PUBLIC`, never commit): `SUPABASE_SERVICE_ROLE_KEY` — copy from
Supabase Dashboard → Project Settings → API → `service_role`. Add all three to
`.env.local` and to Vercel env. See `.env.example`.

## Status / next steps

- [x] Project created, schema + RLS + Realtime applied live, advisor clean.
- [ ] Paste env vars (`.env.local` + Vercel). Service-role key is a manual copy.
- [ ] Server write path: route handler `recordHand` + extend stats recording.
- [ ] Client reads: `usePlayerStats(uid)` for `/perfil`; `useRoomHistory(code)` with
      Realtime subscription.
- [ ] Dual-read migration: prefer Supabase, fall back to `localStorage`; drop the local
      path only after parity is confirmed.
