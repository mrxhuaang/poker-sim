// Logica de economia/progresion del lado SERVIDOR (Admin SDK).
// Es la unica autoridad que escribe coins/escrows/xp/stats. Replica las
// transacciones que antes corrian en el cliente (users.ts), pero ahora con
// privilegios de servidor, derivando el uid del idToken verificado.
//
// Reglas de integridad reforzadas aqui (no en el cliente):
//   - buy-in: descuenta solo si hay saldo; monto acotado.
//   - cash-out: lee lobby.chips (autoridad del host), NO un valor del cliente.
//   - record-session: el XP se RECALCULA server-side con sessionXp(); el cliente
//     no puede inflarlo. handsPlayed/handsWon se acotan.
import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "./firebaseAdmin";
import {
  STARTING_COINS,
  applyBustRescue,
  applyDailyBonus,
  cappedCredit,
} from "./economy";
import { addXp, titleForLevel, sessionXp } from "./progression";

const MAX_BUYIN = 1_000_000; // coherente con el tope de stackRequests
const MAX_HANDS_PER_SESSION = 10_000; // cota anti-inflado de XP/stats
const HISTORY_CAP = 100;

type AuthProvider = "google" | "github" | "anonymous";

export type UserProfile = {
  uid: string;
  provider: AuthProvider;
  displayName: string;
  nickname: string;
  photoURL: string | null;
  avatarSeed: string;
  // El email NO se guarda en Firestore (vive solo en el Auth record, accesible
  // por el dueno via user.email). Evita exponerlo a otros usuarios.
  createdAt: number;
  coins: number;
  escrows: Record<string, number>;
  lastDailyBonus: number;
  xp: number;
  level: number;
  title: string;
  gamesPlayed: number;
  handsPlayed: number;
  handsWon: number;
  biggestPot: number;
};

function userRef(uid: string) {
  return adminDb().collection("users").doc(uid);
}

// Libro de la sala (autoridad del servidor; el cliente no puede leerlo ni
// escribirlo, ver firestore.rules). Hace cumplir la suma cero: el total pagado
// (cash-outs) nunca excede el total comprometido (buy-ins) de la sala.
type RoomLedger = { totalIn: number; totalOut: number };

function ledgerRef(code: string) {
  return adminDb().collection("roomLedgers").doc(code);
}

function readLedger(snap: FirebaseFirestore.DocumentSnapshot): RoomLedger {
  const d = (snap.exists ? snap.data() : null) as Partial<RoomLedger> | null;
  return {
    totalIn: Math.max(0, Math.floor(d?.totalIn ?? 0)),
    totalOut: Math.max(0, Math.floor(d?.totalOut ?? 0)),
  };
}

function randomSeed(): string {
  // Semilla de avatar simple, server-side (no depende de crypto del browser).
  return Math.floor(Math.random() * 1e9).toString(36) + Date.now().toString(36);
}

function providerOf(providerId: string): AuthProvider {
  if (providerId.includes("google")) return "google";
  if (providerId.includes("github")) return "github";
  return "anonymous";
}

// Crea el perfil si no existe (grant inicial) y aplica bono diario + rescate.
// Idempotente; el cliente lo invoca en cada login. Devuelve el perfil vigente.
export async function ensureProfile(uid: string): Promise<UserProfile> {
  const ref = userRef(uid);
  const userRecord = await adminAuth().getUser(uid);
  const providerId = userRecord.providerData[0]?.providerId ?? "";
  const provider = providerOf(providerId);
  const now = Date.now();

  const snap = await ref.get();
  if (!snap.exists) {
    const profile: UserProfile = {
      uid,
      provider,
      displayName: userRecord.displayName ?? "Jugador",
      nickname: userRecord.displayName ?? "Jugador",
      photoURL: userRecord.photoURL ?? null,
      avatarSeed: randomSeed(),
      createdAt: now,
      coins: STARTING_COINS,
      escrows: {},
      lastDailyBonus: now, // el bono no aplica el primer dia
      xp: 0,
      level: 1,
      title: titleForLevel(1),
      gamesPlayed: 0,
      handsPlayed: 0,
      handsWon: 0,
      biggestPot: 0,
    };
    await ref.set(profile);
    return profile;
  }

  const raw = snap.data() as Record<string, unknown>;
  let profile = snap.data() as UserProfile;
  const patch: Record<string, unknown> = {};

  // Migracion: borrar el email de docs antiguos (antes vivia en el doc
  // publico, legible por terceros). Ahora el email solo vive en el Auth record.
  if ("email" in raw) {
    patch.email = FieldValue.delete();
  }

  // Al enlazar cuenta social sobre la anonima, traer datos del proveedor.
  if (provider !== "anonymous") {
    if (profile.provider === "anonymous") patch.provider = provider;
    if (userRecord.photoURL && !profile.photoURL) patch.photoURL = userRecord.photoURL;
    if (
      userRecord.displayName &&
      (profile.displayName === "Jugador" || !profile.displayName)
    ) {
      patch.displayName = userRecord.displayName;
      if (profile.nickname === "Jugador" || !profile.nickname) {
        patch.nickname = userRecord.displayName;
      }
    }
  }

  const daily = applyDailyBonus(profile, now);
  if (daily.granted > 0) {
    profile = daily.wallet;
    patch.coins = profile.coins;
    patch.lastDailyBonus = profile.lastDailyBonus;
  }

  const rescue = applyBustRescue(profile);
  if (rescue.granted > 0) {
    profile = rescue.wallet;
    patch.coins = profile.coins;
  }

  if (Object.keys(patch).length > 0) {
    await ref.update(patch);
    // No reflejar el FieldValue.delete() sentinel en el objeto devuelto.
    const { email: _drop, ...rest } = patch as Record<string, unknown> & { email?: unknown };
    void _drop;
    profile = { ...profile, ...rest } as UserProfile;
  }
  return profile;
}

export async function claimDailyBonus(uid: string): Promise<number> {
  const ref = userRef(uid);
  return adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return 0;
    const p = snap.data() as UserProfile;
    const { wallet, granted } = applyDailyBonus(p, Date.now());
    if (granted > 0) {
      tx.update(ref, { coins: wallet.coins, lastDailyBonus: wallet.lastDailyBonus });
    }
    return granted;
  });
}

export async function buyIn(uid: string, code: string, amount: number): Promise<number> {
  const amt = Math.floor(amount);
  if (!(amt > 0) || amt > MAX_BUYIN) throw new Error("Monto invalido");
  const ref = userRef(uid);
  const lref = ledgerRef(code);
  return adminDb().runTransaction(async (tx) => {
    // Lecturas antes de escrituras (requisito de las transacciones Firestore).
    const [snap, lsnap] = await Promise.all([tx.get(ref), tx.get(lref)]);
    if (!snap.exists) throw new Error("Perfil inexistente");
    const p = snap.data() as UserProfile;
    const escrows = { ...(p.escrows ?? {}) };
    if (p.coins < amt) throw new Error("Saldo insuficiente");
    escrows[code] = (escrows[code] ?? 0) + amt;
    const coins = p.coins - amt;
    const ledger = readLedger(lsnap);
    // El buy-in entra al bote de la sala.
    tx.set(lref, { totalIn: ledger.totalIn + amt, totalOut: ledger.totalOut }, { merge: true });
    tx.update(ref, { coins, escrows });
    return coins;
  });
}

export async function refundBuyIn(uid: string, code: string, amount: number): Promise<void> {
  const amt = Math.max(0, Math.floor(amount));
  if (amt === 0) return;
  const ref = userRef(uid);
  const lref = ledgerRef(code);
  await adminDb().runTransaction(async (tx) => {
    const [snap, lsnap] = await Promise.all([tx.get(ref), tx.get(lref)]);
    if (!snap.exists) return;
    const p = snap.data() as UserProfile;
    const escrows = { ...(p.escrows ?? {}) };
    const current = escrows[code] ?? 0;
    if (current <= 0) return; // nada comprometido: no acunar
    // No devolver mas de lo que realmente esta en escrow para esta sala.
    const give = Math.min(amt, current);
    const remaining = current - give;
    if (remaining > 0) escrows[code] = remaining;
    else delete escrows[code];
    // El reembolso saca esas monedas del bote: nunca jugaron.
    const ledger = readLedger(lsnap);
    tx.set(lref, { totalIn: Math.max(0, ledger.totalIn - give) }, { merge: true });
    tx.update(ref, { coins: p.coins + give, escrows });
  });
}

// Cash-out autoritativo. lobby.chips lo controla el host (autoridad de stacks),
// pero NO puede acunar monedas: el credito se recorta al bote real de la sala
// (totalIn - totalOut) via cappedCredit. Asi el host puede repartir quien gana
// o pierde, pero el total que sale de la sala jamas supera lo que entro. Si la
// sala no tiene libro (creada antes de esta version), el tope conservador es el
// propio escrow del jugador: nunca paga mas de lo que ese jugador aporto.
export async function cashOut(uid: string, code: string): Promise<number | null> {
  const db = adminDb();
  const lobbySnap = await db
    .collection("normalRooms").doc(code)
    .collection("lobby").doc(uid)
    .get();
  const lobbyChips = lobbySnap.exists
    ? Math.max(0, Math.floor((lobbySnap.data() as { chips?: number }).chips ?? 0))
    : null;

  const ref = userRef(uid);
  const lref = ledgerRef(code);
  return db.runTransaction(async (tx) => {
    const [snap, lsnap] = await Promise.all([tx.get(ref), tx.get(lref)]);
    if (!snap.exists) return null;
    const p = snap.data() as UserProfile;
    const escrows = { ...(p.escrows ?? {}) };
    if (!(code in escrows)) return null; // ya liquidado
    const ownEscrow = Math.max(0, escrows[code] ?? 0);
    // Si hay lobby, la verdad del host manda; si no, devolver el escrow.
    const desired = lobbyChips ?? ownEscrow;

    let credit: number;
    if (lsnap.exists) {
      const ledger = readLedger(lsnap);
      credit = cappedCredit(desired, ledger.totalIn, ledger.totalOut);
      tx.set(lref, { totalOut: ledger.totalOut + credit }, { merge: true });
    } else {
      // Sala legacy sin libro: tope conservador al propio aporte del jugador.
      credit = Math.min(Math.max(0, Math.floor(desired)), ownEscrow);
    }

    delete escrows[code];
    const coins = p.coins + credit;
    tx.update(ref, { coins, escrows });
    return coins;
  });
}

// Libera escrows huerfanos: salas donde el jugador ya no esta en el lobby ni
// tiene una solicitud pendiente. Devuelve el monto EXACTO del escrow.
export async function reconcileEscrows(uid: string): Promise<void> {
  const db = adminDb();
  const ref = userRef(uid);
  const snap = await ref.get();
  if (!snap.exists) return;
  const p = snap.data() as UserProfile;
  const escrows = p.escrows ?? {};
  const codes = Object.keys(escrows).filter((c) => (escrows[c] ?? 0) > 0);
  for (const code of codes) {
    try {
      const lobbySnap = await db
        .collection("normalRooms").doc(code).collection("lobby").doc(uid).get();
      if (lobbySnap.exists) continue;
      const reqSnap = await db
        .collection("normalRooms").doc(code).collection("stackRequests").doc(uid).get();
      if (reqSnap.exists && (reqSnap.data() as { status?: string }).status === "pending") {
        continue;
      }
      const amt = escrows[code] ?? 0;
      if (amt > 0) await refundBuyIn(uid, code, amt);
    } catch {
      /* best-effort */
    }
  }
}

// Registra una sesion: stats + XP + historial. El XP se RECALCULA aqui
// (sessionXp) — el cliente no lo decide. handsPlayed/handsWon acotados.
export async function recordSession(
  uid: string,
  data: {
    code: string;
    roomName: string;
    handsPlayed: number;
    handsWon: number;
    net: number;
    biggestPot: number;
  },
): Promise<void> {
  const code = String(data.code ?? "").slice(0, 64);
  const roomName = String(data.roomName ?? "").slice(0, 120);
  const handsPlayed = Math.min(MAX_HANDS_PER_SESSION, Math.max(0, Math.floor(data.handsPlayed ?? 0)));
  const handsWon = Math.min(handsPlayed, Math.max(0, Math.floor(data.handsWon ?? 0)));
  const net = Math.floor(Number.isFinite(data.net) ? data.net : 0);
  const biggestPot = Math.max(0, Math.floor(Number.isFinite(data.biggestPot) ? data.biggestPot : 0));
  const xpGained = sessionXp(handsPlayed, handsWon); // server-authoritative

  const db = adminDb();
  const ref = userRef(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const p = snap.data() as UserProfile;
    const withXp = addXp(p, xpGained);
    tx.update(ref, {
      xp: withXp.xp,
      level: withXp.level,
      title: withXp.title,
      gamesPlayed: p.gamesPlayed + 1,
      handsPlayed: p.handsPlayed + handsPlayed,
      handsWon: p.handsWon + handsWon,
      biggestPot: Math.max(p.biggestPot, biggestPot),
    });
  });

  const id = `${code}-${Date.now().toString(36)}`;
  await ref.collection("history").doc(id).set({
    id,
    ts: Date.now(),
    code,
    roomName,
    handsPlayed,
    handsWon,
    net,
    xpGained,
  });

  // Recorta historial al cap (borra los mas viejos).
  const old = await ref.collection("history").orderBy("ts", "desc").offset(HISTORY_CAP).get();
  if (!old.empty) {
    const batch = db.batch();
    old.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}
