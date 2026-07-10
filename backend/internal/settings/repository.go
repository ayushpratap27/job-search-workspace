package settings

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type SearchConfig struct {
	ID                  string          `json:"id"`
	UserID              string          `json:"userId"`
	Keywords            []string        `json:"keywords"`
	Filters             json.RawMessage `json:"filters"`
	PriorityOrder       json.RawMessage `json:"priorityOrder"`
	SearchStartTime     string          `json:"searchStartTime"`
	SummaryTime         string          `json:"summaryTime"`
	MaxJobsPerSession   int             `json:"maxJobsPerSession"`
	AIProvider          string          `json:"aiProvider"`
	IsActive            bool            `json:"isActive"`
	Platform            string          `json:"platform"`
	CreatedAt           time.Time       `json:"createdAt"`
	UpdatedAt           time.Time       `json:"updatedAt"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) GetOrCreate(ctx context.Context, userID string) (*SearchConfig, error) {
	var cfg SearchConfig
	err := r.pool.QueryRow(ctx, `
		SELECT id, user_id, keywords, filters, priority_order, search_start_time,
		       summary_time, max_jobs_per_session, ai_provider, is_active, platform,
		       created_at, updated_at
		FROM search_configs WHERE user_id = $1 AND is_active = true LIMIT 1`, userID,
	).Scan(&cfg.ID, &cfg.UserID, &cfg.Keywords, &cfg.Filters, &cfg.PriorityOrder,
		&cfg.SearchStartTime, &cfg.SummaryTime, &cfg.MaxJobsPerSession,
		&cfg.AIProvider, &cfg.IsActive, &cfg.Platform, &cfg.CreatedAt, &cfg.UpdatedAt)

	if err != nil {
		// Create default config
		defaultFilters, _ := json.Marshal(map[string]any{
			"timeRange": "24h", "jobTypes": []string{"full_time", "internship"},
			"easyApplyOnly": false, "under10Applicants": false,
		})
		defaultPriority, _ := json.Marshal([]string{"bangalore", "remote", "hyderabad", "pune", "noida", "gurugram", "chennai", "other"})

		err2 := r.pool.QueryRow(ctx, `
			INSERT INTO search_configs (user_id, keywords, filters, priority_order)
			VALUES ($1, $2, $3, $4)
			RETURNING id, user_id, keywords, filters, priority_order, search_start_time,
			          summary_time, max_jobs_per_session, ai_provider, is_active, platform,
			          created_at, updated_at`,
			userID,
			[]string{"Software Engineer", "SDE"},
			defaultFilters,
			defaultPriority,
		).Scan(&cfg.ID, &cfg.UserID, &cfg.Keywords, &cfg.Filters, &cfg.PriorityOrder,
			&cfg.SearchStartTime, &cfg.SummaryTime, &cfg.MaxJobsPerSession,
			&cfg.AIProvider, &cfg.IsActive, &cfg.Platform, &cfg.CreatedAt, &cfg.UpdatedAt)
		if err2 != nil {
			return nil, fmt.Errorf("create default config: %w", err2)
		}
	}
	return &cfg, nil
}

type UpdateParams struct {
	Keywords          []string
	Filters           json.RawMessage
	PriorityOrder     json.RawMessage
	SearchStartTime   string
	SummaryTime       string
	MaxJobsPerSession int
	AIProvider        string
}

func (r *Repository) Update(ctx context.Context, userID string, p UpdateParams) (*SearchConfig, error) {
	filtersJSON, _ := json.Marshal(p.Filters)
	priorityJSON, _ := json.Marshal(p.PriorityOrder)

	keywordsJSON, _ := json.Marshal(p.Keywords)

	_, err := r.pool.Exec(ctx, `
		UPDATE search_configs SET
			keywords = $1, filters = $2, priority_order = $3,
			search_start_time = $4, summary_time = $5,
			max_jobs_per_session = $6, ai_provider = $7
		WHERE user_id = $8 AND is_active = true`,
		keywordsJSON, filtersJSON, priorityJSON,
		p.SearchStartTime, p.SummaryTime,
		p.MaxJobsPerSession, p.AIProvider, userID,
	)
	if err != nil {
		return nil, fmt.Errorf("update config: %w", err)
	}
	return r.GetOrCreate(ctx, userID)
}
