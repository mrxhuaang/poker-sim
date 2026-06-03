# Durable persistence setup (F2)

Moves important state off host-device `localStorage` into Supabase Postgres so it
survives device switches and is visible to all seats. Auth stays Firebase; Supabase
is data-only.

## Supabase project

- Project: **poker-sim** — ref `fpbmrxfcrphrjwwegqsn`, region `us-east-1`, free tier.
- URL: `https://fpbmrxfcrphrjwwegqsn.supabase.co`
- Same Supabase project also backs the voice signaling (Realtime Broadcast/Presence).

## Scope correction (important)

Investigation found **per-player stats are ALREADY durable + server-authoritative
in Firestore** (`users/{uid}`: `gamesPlayed/handsPlayed/handsWon/biggestPot/xp/level`,
written by `recordSession` in `economyServer.ts`, with a per-session `users/{uid}/history`
subcollection capped at 100). A Supabase `player_stats` table would duplicate that and
create a second source of truth, so it was **dropped** (migration
`drop_redundant_player_stats`). Stats need no migration.

The `useStats` / `useHistory` localStorage hooks are **presencial-mode only** (the
shared-screen `/host` sim with local, account-less players) — a local sandbox by design.
The online/normal game (real rooms + authenticated host) records **no per-hand detail at
all** today. So the genuinely valuable, net-new piece is per-hand history for the **online
mode**, which `hand_history` provides (and which enables a future replayer + live feed).

## Schema (migration `f2_durable_stats_and_hand_history`, minus the dropped table)

| Table | Keyed by | Purpose |
|-------|----------|---------|
| `hand_history` | `id` (uuid), indexed `(room_code, created_at desc)` | Per-room hand timeline for ONLINE rooms. All seats read it. In the `supabase_realtime` publication so phones get new hands live. |

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
- [x] Redundant `player_stats` dropped (stats already durable in Firestore).
- [x] Env vars in `.env.local` (URL + anon + service-role) and Vercel (manual).
- [x] Server write path: `src/lib/supabaseAdmin.ts` (service-role client) +
      `src/lib/handHistoryServer.ts` `recordHand` (host-only authz vs
      `normalRooms/{code}.hostUid`) + `POST /api/history`. Shared auth helper
      `verifyBearerUid` extracted into `firebaseAdmin.ts` (economy route now uses it too).
- [x] Client read: `src/hooks/useRoomHistory(code)` — Supabase select + Realtime INSERT
      subscription, snake→camel mapped.
- [x] DB model smoke-tested (insert/select/delete a sample hand at the SQL level).
- [ ] **Call site (delicate, next):** host POSTs `/api/history` after each online hand
      resolves, from the normal-game flow (`useNormalGame` / host page). Left for a
      reviewed step since it touches the protected game loop and needs the live
      multiplayer flow to verify (host plays a hand → row appears → phone sees it live).
- [ ] UI: a hand replayer / live history panel consuming `useRoomHistory` (feature phase).
