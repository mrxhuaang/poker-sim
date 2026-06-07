package poker

import (
	"encoding/json"
	"os"
	"testing"
)

type parityCase struct {
	Cards    []string `json:"cards"`
	Category uint32   `json:"category"`
	Desc     string   `json:"desc"`
}

// TestEvalParity verifies the Go evaluator agrees with the shared fixture at
// testdata/eval-parity.json. The same fixture is checked against the TS
// evaluator in src/lib/evalParity.test.ts, keeping all three evaluators in
// sync (TS / Rust / Go). If this test and the TS test pass in CI with the same
// fixture, the category rankings are equivalent.
func TestEvalParity(t *testing.T) {
	// Go tests run from the package directory (server/internal/poker/);
	// three levels up reaches the repo root where testdata/ lives.
	data, err := os.ReadFile("../../../testdata/eval-parity.json")
	if err != nil {
		t.Fatalf("open fixture: %v", err)
	}
	var cases []parityCase
	if err := json.Unmarshal(data, &cases); err != nil {
		t.Fatalf("parse fixture: %v", err)
	}
	for _, tc := range cases {
		t.Run(tc.Desc, func(t *testing.T) {
			if len(tc.Cards) != 7 {
				t.Fatalf("fixture must have 7 cards, got %d", len(tc.Cards))
			}
			var cards [7]Card
			for i, id := range tc.Cards {
				c, ok := ParseCard(id)
				if !ok {
					t.Fatalf("bad card id %q", id)
				}
				cards[i] = c
			}
			score := Best7(cards)
			// pack() stores 6 nibbles (4 bits each) in 24 bits.
			// Nibble 0 (the category) occupies bits 23-20, so shift right 20.
			got := score >> 20
			if got != tc.Category {
				t.Errorf("category = %d, want %d (score = 0x%06X)", got, tc.Category, score)
			}
		})
	}
}
