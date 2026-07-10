package tasks

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"
)

const TypeDailySummary = "task:daily_summary"

type DailySummaryPayload struct {
	UserID string `json:"userId"`
}

func NewDailySummaryTask(userID string) (*asynq.Task, error) {
	payload, err := json.Marshal(DailySummaryPayload{UserID: userID})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeDailySummary, payload), nil
}

// DailySummaryHandler compiles today's stats and stores the summary.
// Email sending and AI generation will be added in Phase 8 & 9.
type DailySummaryHandler struct {
	pool *pgxpool.Pool
}

func NewDailySummaryHandler(pool *pgxpool.Pool) *DailySummaryHandler {
	return &DailySummaryHandler{pool: pool}
}

func (h *DailySummaryHandler) ProcessTask(ctx context.Context, t *asynq.Task) error {
	var p DailySummaryPayload
	if err := json.Unmarshal(t.Payload(), &p); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	today := time.Now().Format("2006-01-02")
	log.Printf("[worker] generating daily summary for user %s date %s", p.UserID, today)

	// Aggregate stats for today
	stats := map[string]any{}

	rows, err := h.pool.Query(ctx, `
		SELECT application_status, COUNT(*)
		FROM applications
		WHERE user_id = $1 AND DATE(applied_at) = $2
		GROUP BY application_status`, p.UserID, today)
	if err != nil {
		return fmt.Errorf("query stats: %w", err)
	}
	var applied, skipped, attention int
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			rows.Close()
			return err
		}
		switch status {
		case "completed":
			applied = count
		case "skipped":
			skipped = count
		case "needs_attention":
			attention = count
		}
	}
	rows.Close()

	stats["applied"] = applied
	stats["skipped"] = skipped
	stats["needsAttention"] = attention
	stats["jobsFound"] = applied + skipped + attention

	var networkingPending int
	_ = h.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM applications
		WHERE user_id = $1 AND networking_status = 'pending'`, p.UserID,
	).Scan(&networkingPending)
	stats["networkingPending"] = networkingPending

	statsJSON, _ := json.Marshal(stats)

	// Upsert daily_summaries row
	_, err = h.pool.Exec(ctx, `
		INSERT INTO daily_summaries (user_id, date, stats)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id, date) DO UPDATE SET stats = EXCLUDED.stats`,
		p.UserID, today, statsJSON,
	)
	if err != nil {
		return fmt.Errorf("upsert summary: %w", err)
	}

	log.Printf("[worker] daily summary saved: applied=%d skipped=%d attention=%d", applied, skipped, attention)
	return nil
}
