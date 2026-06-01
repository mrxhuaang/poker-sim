import { describe, it, expect } from "vitest";
import {
  BUST_RESCUE_TARGET,
  DAILY_BONUS,
  DAILY_BONUS_INTERVAL_MS,
  applyBustRescue,
  applyDailyBonus,
  availableCoins,
  dailyBonusReady,
  escrowedTotal,
} from "./economy";

describe("economy", () => {
  it("escrowedTotal sums positive escrows", () => {
    expect(escrowedTotal({ a: 100, b: 250 })).toBe(350);
    expect(escrowedTotal(undefined)).toBe(0);
    expect(escrowedTotal({})).toBe(0);
  });

  it("availableCoins floors and clamps", () => {
    expect(availableCoins({ coins: 1234.9 })).toBe(1234);
    expect(availableCoins({ coins: -5 })).toBe(0);
  });

  it("dailyBonusReady respects the 24h interval", () => {
    const now = DAILY_BONUS_INTERVAL_MS * 10;
    expect(dailyBonusReady(now - DAILY_BONUS_INTERVAL_MS, now)).toBe(true);
    expect(dailyBonusReady(now - 1000, now)).toBe(false);
  });

  it("applyDailyBonus grants once and updates timestamp", () => {
    const now = DAILY_BONUS_INTERVAL_MS * 5;
    const fresh = applyDailyBonus({ coins: 100, lastDailyBonus: 0 }, now);
    expect(fresh.granted).toBe(DAILY_BONUS);
    expect(fresh.wallet.coins).toBe(100 + DAILY_BONUS);
    expect(fresh.wallet.lastDailyBonus).toBe(now);
    // Segunda llamada inmediata: sin bono.
    const again = applyDailyBonus(fresh.wallet, now);
    expect(again.granted).toBe(0);
  });

  it("bust rescue tops up only when broke and no escrows", () => {
    const r = applyBustRescue({ coins: 200, escrows: {}, lastDailyBonus: 0 });
    expect(r.wallet.coins).toBe(BUST_RESCUE_TARGET);
    expect(r.granted).toBe(BUST_RESCUE_TARGET - 200);
  });

  it("no rescue when coins locked in escrow", () => {
    const r = applyBustRescue({ coins: 0, escrows: { room1: 5000 }, lastDailyBonus: 0 });
    expect(r.granted).toBe(0);
    expect(r.wallet.coins).toBe(0);
  });

  it("no rescue when above threshold", () => {
    const r = applyBustRescue({ coins: 5000, escrows: {}, lastDailyBonus: 0 });
    expect(r.granted).toBe(0);
  });
});
