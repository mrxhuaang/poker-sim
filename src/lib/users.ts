"use client";
// Perfil persistente de usuario (cuenta) + economia de monedas.
// Coleccion users/{uid}; subcoleccion users/{uid}/history para el historial.
//
// Modelo de integridad (sin backend): el buy-in descuenta del wallet via
// runTransaction y registra un escrow {code -> monto}. El cash-out lee el
// valor de lobby.chips (controlado por el host, no falsificable por el jugador)
// y lo devuelve al wallet, borrando el escrow. Las monedas se conservan.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getDb } from "./firebase";
import { randomSeed } from "./dicebear";
import {
  STARTING_COINS,
  applyBustRescue,
  applyDailyBonus,
} from "./economy";
import { addXp, levelFromXp, titleForLevel } from "./progression";

export type AuthProvider = "google" | "github" | "anonymous";

export type UserProfile = {
  uid: string;
  provider: AuthProvider;
  displayName: string;
  nickname: string;
  photoURL: string | null;
  avatarSeed: string;
  email: string | null;
  createdAt: number;
  // Economia
  coins: number;
  escrows: Record<string, number>;
  lastDailyBonus: number;
  // Progresion
  xp: number;
  level: number;
  title: string;
  // Stats de cuenta
  gamesPlayed: number;
  handsPlayed: number;
  handsWon: number;
  biggestPot: number;
};

export type HistoryRecord = {
  id: string;
  ts: number;
  code: string;
  roomName: string;
  handsPlayed: number;
  handsWon: number;
  net: number; // ganancia/perdida de fichas en la sesion
  xpGained: number;
};

const HISTORY_CAP = 100;

function userRef(uid: string) {
  return doc(getDb(), "users", uid);
}

function providerOf(user: User): AuthProvider {
  const pid = user.providerData[0]?.providerId ?? "";
  if (pid.includes("google")) return "google";
  if (pid.includes("github")) return "github";
  return "anonymous";
}

function defaultProfile(user: User): UserProfile {
  const provider = providerOf(user);
  return {
    uid: user.uid,
    provider,
    displayName: user.displayName ?? "Jugador",
    nickname: user.displayName ?? "Jugador",
    photoURL: user.photoURL ?? null,
    avatarSeed: randomSeed(),
    email: user.email ?? null,
    createdAt: Date.now(),
    coins: STARTING_COINS,
    escrows: {},
    lastDailyBonus: 0,
    xp: 0,
    level: 1,
    title: titleForLevel(1),
    gamesPlayed: 0,
    handsPlayed: 0,
    handsWon: 0,
    biggestPot: 0,
  };
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export function subscribeUserProfile(
  uid: string,
  cb: (profile: UserProfile | null) => void,
): () => void {
  return onSnapshot(
    userRef(uid),
    (snap) => cb(snap.exists() ? (snap.data() as UserProfile) : null),
    () => cb(null),
  );
}

// Crea el perfil si no existe (grant inicial). Si existe, refresca los datos
// del proveedor (foto/nombre al enlazar cuenta) y aplica bono diario + rescate.
// Idempotente; seguro de llamar en cada login.
export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const ref = userRef(user.uid);
  const snap = await getDoc(ref);
  const now = Date.now();

  if (!snap.exists()) {
    const profile = defaultProfile(user);
    // Bono diario inmediato no aplica en el primer dia (lastDailyBonus=now).
    profile.lastDailyBonus = now;
    await setDoc(ref, profile);
    return profile;
  }

  let profile = snap.data() as UserProfile;
  const provider = providerOf(user);
  const patch: Partial<UserProfile> = {};

  // Al enlazar una cuenta social sobre la anonima, traer datos del proveedor.
  if (provider !== "anonymous") {
    if (profile.provider === "anonymous") patch.provider = provider;
    if (user.photoURL && !profile.photoURL) patch.photoURL = user.photoURL;
    if (user.email && !profile.email) patch.email = user.email;
    if (
      user.displayName &&
      (profile.displayName === "Jugador" || !profile.displayName)
    ) {
      patch.displayName = user.displayName;
      if (profile.nickname === "Jugador" || !profile.nickname) {
        patch.nickname = user.displayName;
      }
    }
  }

  // Bono diario.
  const daily = applyDailyBonus(profile, now);
  if (daily.granted > 0) {
    profile = daily.wallet;
    patch.coins = profile.coins;
    patch.lastDailyBonus = profile.lastDailyBonus;
  }

  // Rescate por quiebra.
  const rescue = applyBustRescue(profile);
  if (rescue.granted > 0) {
    profile = rescue.wallet;
    patch.coins = profile.coins;
  }

  if (Object.keys(patch).length > 0) {
    await updateDoc(ref, patch as Record<string, unknown>);
    profile = { ...profile, ...patch };
  }
  return profile;
}

// Reclama el bono diario si el intervalo ya paso. Idempotente (la transaccion
// re-verifica el timestamp). Devuelve las monedas otorgadas (0 si no tocaba).
export async function claimDailyBonus(uid: string): Promise<number> {
  const ref = userRef(uid);
  return runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return 0;
    const p = snap.data() as UserProfile;
    const { wallet, granted } = applyDailyBonus(p, Date.now());
    if (granted > 0) {
      tx.update(ref, {
        coins: wallet.coins,
        lastDailyBonus: wallet.lastDailyBonus,
      });
    }
    return granted;
  });
}

// Campos editables por el usuario en su perfil.
export async function updateProfileFields(
  uid: string,
  fields: Partial<Pick<UserProfile, "nickname" | "displayName" | "avatarSeed">>,
): Promise<void> {
  await updateDoc(userRef(uid), fields as Record<string, unknown>);
}

// --- Economia: transacciones ---

// Descuenta `amount` del wallet y lo registra como escrow de la sala `code`.
// Lanza si el saldo es insuficiente. Devuelve el saldo restante.
export async function buyIn(
  uid: string,
  code: string,
  amount: number,
): Promise<number> {
  const amt = Math.floor(amount);
  if (amt <= 0) throw new Error("Monto invalido");
  const ref = userRef(uid);
  return runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Perfil inexistente");
    const p = snap.data() as UserProfile;
    const escrows = { ...(p.escrows ?? {}) };
    const already = escrows[code] ?? 0;
    if (p.coins < amt) throw new Error("Saldo insuficiente");
    escrows[code] = already + amt;
    const coins = p.coins - amt;
    tx.update(ref, { coins, escrows });
    return coins;
  });
}

// Revierte un buy-in fallido: devuelve `amount` al wallet y reduce el escrow
// de la sala SIN borrar el marcador si aun queda saldo comprometido.
export async function refundBuyIn(
  uid: string,
  code: string,
  amount: number,
): Promise<void> {
  const amt = Math.max(0, Math.floor(amount));
  if (amt === 0) return;
  const ref = userRef(uid);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const p = snap.data() as UserProfile;
    const escrows = { ...(p.escrows ?? {}) };
    const remaining = (escrows[code] ?? 0) - amt;
    if (remaining > 0) escrows[code] = remaining;
    else delete escrows[code];
    tx.update(ref, { coins: p.coins + amt, escrows });
  });
}

// Devuelve `finalChips` (valor de lobby.chips, controlado por host) al wallet
// y borra el escrow de la sala. Idempotente: si no hay escrow, no hace nada.
export async function cashOut(
  uid: string,
  code: string,
  finalChips: number,
): Promise<number | null> {
  const chips = Math.max(0, Math.floor(finalChips));
  const ref = userRef(uid);
  return runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return null;
    const p = snap.data() as UserProfile;
    const escrows = { ...(p.escrows ?? {}) };
    if (!(code in escrows)) return null; // ya liquidado
    delete escrows[code];
    const coins = p.coins + chips;
    tx.update(ref, { coins, escrows });
    return coins;
  });
}

// Reconcilia escrows huerfanos al iniciar sesion: si el jugador tiene monedas
// comprometidas en una sala donde ya NO esta sentado (cierre brusco de pestana,
// sala abandonada/borrada por el host, expulsion sin cash-out), devuelve el
// buy-in al wallet. Sustituye a un barrido server-side: cada usuario reconcilia
// su propio wallet en el siguiente inicio de sesion.
//
// Conservador: solo libera cuando NO esta en el lobby y NO tiene una solicitud
// PENDIENTE en esa sala — asi no rompe una sesion activa en otra pestana ni un
// join en curso. Devuelve el monto exacto del escrow (nunca acuna de mas).
export async function reconcileEscrows(uid: string): Promise<void> {
  const ref = userRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const p = snap.data() as UserProfile;
  const escrows = p.escrows ?? {};
  const codes = Object.keys(escrows).filter((c) => (escrows[c] ?? 0) > 0);
  if (codes.length === 0) return;

  const db = getDb();
  for (const code of codes) {
    try {
      // Sigo sentado en esa sala? => sesion activa (quiza otra pestana), no tocar.
      const lobbySnap = await getDoc(doc(db, "normalRooms", code, "lobby", uid));
      if (lobbySnap.exists()) continue;
      // Solicitud pendiente (join/rebuy en curso)? => no tocar.
      const reqSnap = await getDoc(doc(db, "normalRooms", code, "stackRequests", uid));
      if (reqSnap.exists() && (reqSnap.data() as { status?: string }).status === "pending") {
        continue;
      }
      // Escrow huerfano: devolver el monto exacto al wallet.
      const amt = escrows[code] ?? 0;
      if (amt > 0) await refundBuyIn(uid, code, amt);
    } catch {
      /* best-effort; se reintenta en el proximo inicio de sesion */
    }
  }
}

// --- Stats + XP + historial (escrito por el propio jugador al cerrar sesion) ---

export async function recordSession(
  uid: string,
  data: {
    code: string;
    roomName: string;
    handsPlayed: number;
    handsWon: number;
    net: number;
    biggestPot: number;
    xpGained: number;
  },
): Promise<void> {
  const ref = userRef(uid);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const p = snap.data() as UserProfile;
    const withXp = addXp(p, data.xpGained);
    tx.update(ref, {
      xp: withXp.xp,
      level: withXp.level,
      title: withXp.title,
      gamesPlayed: p.gamesPlayed + 1,
      handsPlayed: p.handsPlayed + Math.max(0, data.handsPlayed),
      handsWon: p.handsWon + Math.max(0, data.handsWon),
      biggestPot: Math.max(p.biggestPot, data.biggestPot),
    });
  });

  const id = `${data.code}-${Date.now().toString(36)}`;
  const rec: HistoryRecord = {
    id,
    ts: Date.now(),
    code: data.code,
    roomName: data.roomName,
    handsPlayed: data.handsPlayed,
    handsWon: data.handsWon,
    net: data.net,
    xpGained: data.xpGained,
  };
  await setDoc(doc(getDb(), "users", uid, "history", id), rec);
}

export async function getHistory(uid: string): Promise<HistoryRecord[]> {
  const q = query(
    collection(getDb(), "users", uid, "history"),
    orderBy("ts", "desc"),
    limit(HISTORY_CAP),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as HistoryRecord);
}

// Mantiene level/title consistentes si se migra xp manualmente (util/testing).
export function reconcileLevel(profile: UserProfile): UserProfile {
  const level = levelFromXp(profile.xp);
  return { ...profile, level, title: titleForLevel(level) };
}
