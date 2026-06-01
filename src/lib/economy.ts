// Economia de monedas finitas. Wallet en users/{uid}.coins.
// Las transacciones de buy-in / cash-out viven en users.ts (necesitan Firestore).
// Aqui: constantes + helpers puros de reposicion (grant inicial, bono diario, rescate).

export const STARTING_COINS = 10_000;
export const DAILY_BONUS = 2_000;
export const DAILY_BONUS_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const BUST_RESCUE_THRESHOLD = 1_000;
export const BUST_RESCUE_TARGET = 1_000;

type Wallet = {
  coins: number;
  lastDailyBonus: number;
  escrows: Record<string, number>;
};

// Total bloqueado en salas activas (no disponible para nuevos buy-ins).
export function escrowedTotal(escrows: Record<string, number> | undefined): number {
  if (!escrows) return 0;
  return Object.values(escrows).reduce((s, n) => s + (n > 0 ? n : 0), 0);
}

// Saldo gastable = monedas libres (los escrows ya estan descontados de coins).
export function availableCoins(wallet: Pick<Wallet, "coins">): number {
  return Math.max(0, Math.floor(wallet.coins));
}

export function dailyBonusReady(lastDailyBonus: number, now: number): boolean {
  return now - lastDailyBonus >= DAILY_BONUS_INTERVAL_MS;
}

// Aplica el bono diario si toca. Devuelve el wallet (posiblemente sin cambios).
export function applyDailyBonus<T extends Pick<Wallet, "coins" | "lastDailyBonus">>(
  wallet: T,
  now: number,
): { wallet: T; granted: number } {
  if (!dailyBonusReady(wallet.lastDailyBonus, now)) {
    return { wallet, granted: 0 };
  }
  return {
    wallet: { ...wallet, coins: wallet.coins + DAILY_BONUS, lastDailyBonus: now },
    granted: DAILY_BONUS,
  };
}

// Rescate por quiebra: solo si el saldo libre esta por debajo del umbral
// Y no hay monedas atrapadas en escrows (no rescatamos a quien tiene stack en juego).
export function applyBustRescue<T extends Wallet>(
  wallet: T,
): { wallet: T; granted: number } {
  const locked = escrowedTotal(wallet.escrows);
  if (locked > 0 || wallet.coins >= BUST_RESCUE_THRESHOLD) {
    return { wallet, granted: 0 };
  }
  const granted = BUST_RESCUE_TARGET - wallet.coins;
  return { wallet: { ...wallet, coins: BUST_RESCUE_TARGET }, granted };
}
