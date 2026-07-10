package sessions

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Session struct {
	ID             string          `json:"id"`
	UserID         string          `json:"userId"`
	Status         string          `json:"status"`
	JobsFound      int             `json:"jobsFound"`
	JobsApplied    int             `json:"jobsApplied"`
	JobsSkipped    int             `json:"jobsSkipped"`
	JobsAttention  int             `json:"jobsAttention"`
	CheckpointData json.RawMessage `json:"checkpointData,omitempty"`
	Platform       string          `json:"platform"`
	StartedAt      time.Time       `json:"startedAt"`
	CompletedAt    *time.Time      `json:"completedAt"`
	CreatedAt      time.Time       `json:"createdAt"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) Create(ctx context.Context, userID, platform string) (*Session, error) {
	var s Session
	err := r.pool.QueryRow(ctx, `
		INSERT INTO job_search_sessions (user_id, platform)
		VALUES ($1, $2)
		RETURNING id, user_id, status, jobs_found, jobs_applied, jobs_skipped,
		          jobs_attention, checkpoint_data, platform, started_at, completed_at, created_at`,
		userID, platform,
	).Scan(&s.ID, &s.UserID, &s.Status, &s.JobsFound, &s.JobsApplied, &s.JobsSkipped,
		&s.JobsAttention, &s.CheckpointData, &s.Platform, &s.StartedAt, &s.CompletedAt, &s.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create session: %w", err)
	}
	return &s, nil
}

func (r *Repository) GetActive(ctx context.Context, userID string) (*Session, error) {
	var s Session
	err := r.pool.QueryRow(ctx, `
		SELECT id, user_id, status, jobs_found, jobs_applied, jobs_skipped,
		       jobs_attention, checkpoint_data, platform, started_at, completed_at, created_at
		FROM job_search_sessions
		WHERE user_id = $1 AND status IN ('running', 'paused')
		ORDER BY started_at DESC LIMIT 1`, userID,
	).Scan(&s.ID, &s.UserID, &s.Status, &s.JobsFound, &s.JobsApplied, &s.JobsSkipped,
		&s.JobsAttention, &s.CheckpointData, &s.Platform, &s.StartedAt, &s.CompletedAt, &s.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, pgx.ErrNoRows
		}
		return nil, fmt.Errorf("get active session: %w", err)
	}
	return &s, nil
}

func (r *Repository) GetByID(ctx context.Context, id, userID string) (*Session, error) {
	var s Session
	err := r.pool.QueryRow(ctx, `
		SELECT id, user_id, status, jobs_found, jobs_applied, jobs_skipped,
		       jobs_attention, checkpoint_data, platform, started_at, completed_at, created_at
		FROM job_search_sessions WHERE id = $1 AND user_id = $2`, id, userID,
	).Scan(&s.ID, &s.UserID, &s.Status, &s.JobsFound, &s.JobsApplied, &s.JobsSkipped,
		&s.JobsAttention, &s.CheckpointData, &s.Platform, &s.StartedAt, &s.CompletedAt, &s.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) UpdateStatus(ctx context.Context, id, status string) error {
	var completedAt *time.Time
	if status == "completed" || status == "failed" {
		now := time.Now()
		completedAt = &now
	}
	_, err := r.pool.Exec(ctx,
		`UPDATE job_search_sessions SET status = $1, completed_at = $2 WHERE id = $3`,
		status, completedAt, id)
	return err
}

type StatsUpdate struct {
	JobsFound     *int
	JobsApplied   *int
	JobsSkipped   *int
	JobsAttention *int
}

func (r *Repository) IncrementStat(ctx context.Context, id, field string) error {
	validFields := map[string]bool{
		"jobs_found": true, "jobs_applied": true,
		"jobs_skipped": true, "jobs_attention": true,
	}
	if !validFields[field] {
		return fmt.Errorf("invalid stat field: %s", field)
	}
	_, err := r.pool.Exec(ctx,
		fmt.Sprintf(`UPDATE job_search_sessions SET %s = %s + 1 WHERE id = $1`, field, field), id)
	return err
}

type ListParams struct {
	UserID   string
	Status   string
	Page     int
	PageSize int
}

func (r *Repository) List(ctx context.Context, p ListParams) ([]*Session, int, error) {
	if p.Page < 1 {
		p.Page = 1
	}
	if p.PageSize < 1 || p.PageSize > 50 {
		p.PageSize = 20
	}

	where := "WHERE user_id = $1"
	args := []any{p.UserID}
	if p.Status != "" {
		where += " AND status = $2"
		args = append(args, p.Status)
	}

	var total int
	if err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM job_search_sessions `+where, args...,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (p.Page - 1) * p.PageSize
	args = append(args, p.PageSize, offset)
	n := len(args)

	rows, err := r.pool.Query(ctx, fmt.Sprintf(`
		SELECT id, user_id, status, jobs_found, jobs_applied, jobs_skipped,
		       jobs_attention, checkpoint_data, platform, started_at, completed_at, created_at
		FROM job_search_sessions %s
		ORDER BY started_at DESC LIMIT $%d OFFSET $%d`, where, n-1, n), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []*Session
	for rows.Next() {
		var s Session
		if err := rows.Scan(&s.ID, &s.UserID, &s.Status, &s.JobsFound, &s.JobsApplied, &s.JobsSkipped,
			&s.JobsAttention, &s.CheckpointData, &s.Platform, &s.StartedAt, &s.CompletedAt, &s.CreatedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, &s)
	}
	if list == nil {
		list = []*Session{}
	}
	return list, total, rows.Err()
}
