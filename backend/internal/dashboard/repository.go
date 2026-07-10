package dashboard

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type TodayStats struct {
	Date             string `json:"date"`
	JobsFound        int    `json:"jobsFound"`
	Applied          int    `json:"applied"`
	NeedsAttention   int    `json:"needsAttention"`
	Skipped          int    `json:"skipped"`
	RecentHiresFound int    `json:"recentHiresFound"`
}

type CityBreakdown struct {
	Bangalore  int `json:"bangalore"`
	Remote     int `json:"remote"`
	Hyderabad  int `json:"hyderabad"`
	Pune       int `json:"pune"`
	Noida      int `json:"noida"`
	Gurugram   int `json:"gurugram"`
	Chennai    int `json:"chennai"`
	Other      int `json:"other"`
}

type NetworkingStats struct {
	Pending   int `json:"pending"`
	Completed int `json:"completed"`
}

type PeriodStats struct {
	Applied int `json:"applied"`
}

type ActiveSession struct {
	ID          string    `json:"id"`
	Status      string    `json:"status"`
	JobsApplied int       `json:"jobsApplied"`
	StartedAt   time.Time `json:"startedAt"`
}

type Stats struct {
	Today         TodayStats      `json:"today"`
	CityBreakdown CityBreakdown   `json:"cityBreakdown"`
	Networking    NetworkingStats `json:"networking"`
	ThisWeek      PeriodStats     `json:"thisWeek"`
	ThisMonth     PeriodStats     `json:"thisMonth"`
	ActiveSession *ActiveSession  `json:"activeSession"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) GetStats(ctx context.Context, userID string) (*Stats, error) {
	today := time.Now().Format("2006-01-02")
	stats := &Stats{}
	stats.Today.Date = today

	// Today's application counts by status
	rows, err := r.pool.Query(ctx, `
		SELECT application_status, COUNT(*)
		FROM applications
		WHERE user_id = $1 AND DATE(applied_at) = $2
		GROUP BY application_status`, userID, today)
	if err != nil {
		return nil, fmt.Errorf("today stats: %w", err)
	}
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			rows.Close()
			return nil, err
		}
		switch status {
		case "completed":
			stats.Today.Applied = count
		case "needs_attention":
			stats.Today.NeedsAttention = count
		case "skipped":
			stats.Today.Skipped = count
		}
	}
	rows.Close()
	stats.Today.JobsFound = stats.Today.Applied + stats.Today.NeedsAttention + stats.Today.Skipped

	// Today's recent hires count
	if err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM recent_hires rh
		JOIN applications a ON a.id = rh.application_id
		WHERE a.user_id = $1 AND DATE(rh.created_at) = $2`, userID, today,
	).Scan(&stats.Today.RecentHiresFound); err != nil {
		return nil, fmt.Errorf("recent hires today: %w", err)
	}

	// City breakdown for today
	cityRows, err := r.pool.Query(ctx, `
		SELECT LOWER(location), COUNT(*)
		FROM applications
		WHERE user_id = $1 AND DATE(applied_at) = $2 AND location IS NOT NULL
		GROUP BY LOWER(location)`, userID, today)
	if err != nil {
		return nil, fmt.Errorf("city breakdown: %w", err)
	}
	for cityRows.Next() {
		var loc string
		var count int
		if err := cityRows.Scan(&loc, &count); err != nil {
			cityRows.Close()
			return nil, err
		}
		switch {
		case contains(loc, "bangalore", "bengaluru"):
			stats.CityBreakdown.Bangalore += count
		case contains(loc, "remote"):
			stats.CityBreakdown.Remote += count
		case contains(loc, "hyderabad"):
			stats.CityBreakdown.Hyderabad += count
		case contains(loc, "pune"):
			stats.CityBreakdown.Pune += count
		case contains(loc, "noida"):
			stats.CityBreakdown.Noida += count
		case contains(loc, "gurugram", "gurgaon"):
			stats.CityBreakdown.Gurugram += count
		case contains(loc, "chennai"):
			stats.CityBreakdown.Chennai += count
		default:
			stats.CityBreakdown.Other += count
		}
	}
	cityRows.Close()

	// Networking stats (all time)
	netRows, err := r.pool.Query(ctx, `
		SELECT networking_status, COUNT(*)
		FROM applications WHERE user_id = $1
		GROUP BY networking_status`, userID)
	if err != nil {
		return nil, fmt.Errorf("networking stats: %w", err)
	}
	for netRows.Next() {
		var status string
		var count int
		if err := netRows.Scan(&status, &count); err != nil {
			netRows.Close()
			return nil, err
		}
		if status == "pending" {
			stats.Networking.Pending = count
		} else if status != "ignored" {
			stats.Networking.Completed += count
		}
	}
	netRows.Close()

	// This week
	if err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM applications
		WHERE user_id = $1 AND applied_at >= date_trunc('week', NOW())`,
		userID,
	).Scan(&stats.ThisWeek.Applied); err != nil {
		return nil, fmt.Errorf("week stats: %w", err)
	}

	// This month
	if err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM applications
		WHERE user_id = $1 AND applied_at >= date_trunc('month', NOW())`,
		userID,
	).Scan(&stats.ThisMonth.Applied); err != nil {
		return nil, fmt.Errorf("month stats: %w", err)
	}

	// Active session
	var s ActiveSession
	err = r.pool.QueryRow(ctx, `
		SELECT id, status, jobs_applied, started_at
		FROM job_search_sessions
		WHERE user_id = $1 AND status IN ('running', 'paused')
		ORDER BY started_at DESC LIMIT 1`, userID,
	).Scan(&s.ID, &s.Status, &s.JobsApplied, &s.StartedAt)
	if err == nil {
		stats.ActiveSession = &s
	}

	return stats, nil
}

func contains(s string, substrings ...string) bool {
	for _, sub := range substrings {
		if len(s) >= len(sub) {
			for i := 0; i <= len(s)-len(sub); i++ {
				if s[i:i+len(sub)] == sub {
					return true
				}
			}
		}
	}
	return false
}
