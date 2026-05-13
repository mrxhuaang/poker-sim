# Poker Sim

A multi-device Texas Hold'em simulator for in-person games. The big screen runs the table; each player connects from their phone to see private hole cards and act. No betting — pure visual simulation with showdown evaluation, live equity, and tournament-style features.

---

## Overview

| Area              | Detail                                                                 |
| ----------------- | ---------------------------------------------------------------------- |
| Framework         | Next.js 16 (App Router, Turbopack), TypeScript                         |
| Styling           | Tailwind CSS v4                                                        |
| Animation         | GSAP 3 + `@gsap/react`, CSS 3D transforms                              |
| Avatars           | Dicebear (lorelei style)                                               |
| Real-time sync    | Firebase Firestore + Anonymous Auth                                    |
| Equity engine     | Web Worker (exact enumeration + Monte Carlo)                           |
| Persistence       | Firestore (rooms, lobby, hole cards) + localStorage (stats, history)   |

---

## Key Features

**Game flow**
- Create a room from a laptop or big screen, share the 5-character code or QR
- Players join from their phones, pick a nickname, regenerate avatar, enter the lobby
- Host deals when 2 to 9 players are connected
- Streets advance one card at a time with smooth deal-in animations
- Click hole cards to flip them with a 3D rotation
- Per-seat fold and reveal controls (host-side and phone-side)
- Showdown evaluates 7-card Texas Hold'em best hand and announces winner with confetti

**Equity (host only)**
- Live win percentages for every active seat, updated on every state change
- Hybrid solver: exact enumeration on flop and turn, Monte Carlo (4000 trials) preflop
- Hand category label, outs counter and draw odds on the turn
- Always rendered in the side panel, never on the table — players cannot read it across the room

**All-in with run it N times**
- One-click all-in selector (1, 2, 3, 5 or custom)
- Dramatic playback: each run replays the remaining streets, card by card, on the same table
- Aggregate winner summary plus per-run board, winner and category in a modal
- Skip button collapses delays for fast review
- Each run counts as a separate hand in stats and history

**Stats and history**
- Per-player win counter ranked in a side panel
- Collapsible hand history with the final board, winner and category for the last 50 hands
- Persists across sessions on the host device

**Privacy model**
- Phone never receives hole cards belonging to other seats
- Equity, outs and current-hand strength are visible to the host only
- Anonymous Firebase Auth maps a seat to a device UID

---

## Routes

```
/                    Landing — create room or join
/host                Big-screen host view (auto-creates room, shows code + QR)
/join                Code input screen (also accepts ?code= query)
/play/[code]         Phone view — lobby form, then private game state
/players             Local roster CRUD (used as a quick scratchpad)
```

---

## Tech stack

```
next@16              app router, turbopack build
react@19
typescript@5
tailwindcss@4
gsap@3 + @gsap/react react integration with cleanup
firebase@12          firestore + anonymous auth
canvas-confetti      showdown burst
@dicebear/core
@dicebear/collection lorelei avatar set
qrcode.react         host page QR
lucide-react         icon set
```

---

## Getting started

### Prerequisites

- Node.js 20 or later
- A Firebase project with Firestore and Anonymous Authentication enabled

### Install

```bash
npm install
```

### Configure environment

Create `.env.local` at the project root with your Firebase web config:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
```

### Firebase setup

1. **Authentication** → **Sign-in method** → enable **Anonymous**.
2. **Firestore Database** → create database. Test mode allows all reads/writes for 30 days, which is enough for development.
3. For production, deploy the included `firestore.rules`:

   ```bash
   firebase deploy --only firestore:rules
   ```

   The provided ruleset:
   - Permits any signed-in user to read room metadata
   - Limits write of room state to the host UID
   - Restricts hole card subdocs to the seat owner and host
   - Lets each phone manage only its own lobby entry

### Run

```bash
npm run dev      # http://localhost:3000
npm run build
npm run start
```

---

## Data model (Firestore)

```
rooms/{code}
  code            string
  hostUid         string
  createdAt       timestamp
  state           { seats[], community[], burns[], deckCount, street, dealId } | null
  result          { scores, winners, category } | null
  playback        { idx, total, community } | null
  runHighlight    string[]

rooms/{code}/lobby/{uid}
  uid, name, seed, joinedAt

rooms/{code}/holes/{seatId}
  ownerUid, cards: [Card, Card]
```

Hole cards live in a private subcollection so a phone never receives another seat's cards.

---

## Architecture notes

**Equity worker**
Implemented as a real Web Worker (`src/workers/equity.worker.ts`). The hook `useEquity` debounces state changes, posts to the worker, and renders results in the side panel. The worker handles two message types: `equity` (live odds + outs) and `run` (all-in batch simulation).

**Card flip animation**
`PlayingCard` wraps a CSS `perspective: 1200` container with a `transform-style: preserve-3d` flipper. Two `useGSAP` hooks: one mount-only deal-in (`y: -220, rotateZ: -15`), one flip on `faceUp` change (`rotateY: 180`). New cards mount in, existing cards stay still — no full-board re-animation when advancing streets.

**Multi-run playback**
Imperative `playRuns` async function drives the table state: reset community to the all-in baseline, reveal each remaining card with a 720 ms beat, pulse the winning seat for 1.5 s, advance to the next run. A ref-driven skip flag collapses delays without unwinding the loop.

**Animation key**
The felt receives `key={state.dealId}` so a new deal forces a clean remount (fresh mount tween for every card), while advancing streets keeps the same key — existing cards never re-animate.

---

## Project layout

```
src/
  app/
    layout.tsx              Root, font, Nav
    page.tsx                Landing (create / join)
    host/page.tsx           Host view (room + QR + table)
    join/page.tsx           Code input
    play/[code]/page.tsx    Phone view (lobby + private game)
    players/page.tsx        Local roster CRUD
  components/
    EquityPanel.tsx         Host-side odds, hand label, outs
    HistoryPanel.tsx        Collapsible hand log
    Nav.tsx
    StatsPanel.tsx          Wins ranking
    cards/PlayingCard.tsx   3D-flip card with mount tween
    players/
      Avatar.tsx, PlayerForm.tsx, PlayerList.tsx
    table/
      AllInModal.tsx        Run-count selector
      CommunityRow.tsx      Flop/turn/river slots, stagger on new cards
      DealControls.tsx      Advance, all-in, showdown, reset
      HoleCards.tsx         Click-to-flip pair
      PlayerPicker.tsx      Local mode picker
      PlayerSeat.tsx        Seat layout, fold control, winner crown
      PokerTable.tsx        Orchestrator
      RunResults.tsx        Multi-run summary modal
  hooks/
    useAuth.ts              Firebase anonymous auth
    useEquity.ts            Worker bridge
    useHistory.ts           localStorage hand log
    useLocalStorage.ts      SSR-safe persistence
    usePlayers.ts           Local roster
    useRoom.ts              Firestore subscriptions (room, lobby, hole)
    useStats.ts             Win counter
  lib/
    dicebear.ts             createAvatar(lorelei) wrapper
    firebase.ts             Lazy app/auth/firestore singletons
    handEval.ts             7-card evaluator + category labels
    poker.ts                Deck, shuffle, deal, advance, types
    rooms.ts                Firestore room helpers
    storage.ts              localStorage helpers
  workers/
    equity.worker.ts        Exact + MC equity, multi-run dealer
firestore.rules             Production-grade access policy
```

---

## Deployment

### Vercel

1. Push the repository to GitHub.
2. Import it on [vercel.com](https://vercel.com/new).
3. Add the `NEXT_PUBLIC_FIREBASE_*` environment variables under **Project Settings → Environment Variables**.
4. Deploy. Vercel detects Next.js automatically.

### Firebase rules

After confirming the app on Vercel, deploy production-ready rules:

```bash
npm install -g firebase-tools
firebase login
firebase use --add poker-sim-69129
firebase deploy --only firestore:rules
```

---

## Scripts

```bash
npm run dev       # local dev server (turbopack)
npm run build     # production build
npm run start     # serve built output
npm run lint      # eslint
```

---

## Roadmap

- Per-room stats and history synced to Firestore (currently host-local)
- Spectator role separate from host
- Tournament mode with knockouts and chip counts
- Side pots for proper all-in coverage
- Custom card backs and felt themes
- Replay mode for the last hand

---

## License

Private project. Not for redistribution.
