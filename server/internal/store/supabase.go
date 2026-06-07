// Package store persists authoritative hand records to Supabase Postgres.
// Configured via env vars SUPABASE_URL and SUPABASE_SERVICE_KEY.
// When either is unset the store is a no-op — the game still runs normally.
package store

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// WinnerRecord is a compact winner entry safe to serialise.
type WinnerRecord struct {
	ID     string `json:"id"`
	Amount int    `json:"amount"`
}

// HandRecord is the payload written to online_hand_records.
type HandRecord struct {
	Room       string            `json:"room"`
	HandNum    int               `json:"hand_num"`
	PlayedAt   time.Time         `json:"played_at"`
	Pot        int               `json:"pot"`
	Community  []string          `json:"community"`
	Winners    []WinnerRecord    `json:"winners"`
	Reveals    map[string][]string `json:"reveals,omitempty"`
	Categories map[string]int    `json:"categories,omitempty"`
	SeatIDs    []string          `json:"seat_ids"`
	SeatNames  map[string]string `json:"seat_names"`
}

// SupabaseStore posts hand records to Supabase via the REST API.
// A nil receiver is valid and silently no-ops.
type SupabaseStore struct {
	url        string
	serviceKey string
	client     *http.Client
}

// New returns a configured store, or nil when env vars are missing.
func New() *SupabaseStore {
	url := os.Getenv("SUPABASE_URL")
	key := os.Getenv("SUPABASE_SERVICE_KEY")
	if url == "" || key == "" {
		return nil
	}
	return &SupabaseStore{
		url:        url,
		serviceKey: key,
		client:     &http.Client{Timeout: 8 * time.Second},
	}
}

// RecordHand persists a hand record. Fire-and-forget: call in a goroutine.
// A nil receiver is a no-op.
func (s *SupabaseStore) RecordHand(rec HandRecord) error {
	if s == nil {
		return nil
	}
	b, err := json.Marshal(rec)
	if err != nil {
		return err
	}
	endpoint := s.url + "/rest/v1/online_hand_records"
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", s.serviceKey)
	req.Header.Set("Authorization", "Bearer "+s.serviceKey)
	req.Header.Set("Prefer", "return=minimal")

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("supabase: status %d", resp.StatusCode)
	}
	return nil
}
