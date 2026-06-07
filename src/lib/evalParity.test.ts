import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";
import { bestHand, categoryFor } from "./handEval";
import { cardFromId } from "./poker";

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

interface ParityCase {
  cards: string[];
  category: number;
  desc: string;
}

const fixtures: ParityCase[] = JSON.parse(
  readFileSync(join(__dir, "../../testdata/eval-parity.json"), "utf-8"),
);

describe("eval parity — TS evaluator", () => {
  for (const { cards, category, desc } of fixtures) {
    it(desc, () => {
      const parsed = cards.map((id) => {
        const card = cardFromId(id);
        if (!card) throw new Error(`bad card id: ${id}`);
        return card;
      });
      expect(categoryFor(bestHand(parsed))).toBe(category);
    });
  }
});
