package applications

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CompanySummary struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	LinkedInURL   *string `json:"linkedinUrl"`
	CareerPageURL *string `json:"careerPageUrl"`
}

type Application struct {
	ID                string          `json:"id"`
	UserID            string          `json:"userId"`
	CompanyID         string          `json:"companyId"`
	SessionID         *string         `json:"sessionId"`
	Company           CompanySummary  `json:"company"`
	Role              string          `json:"role"`
	Location          *string         `json:"location"`
	Priority          int             `json:"priority"`
	JobURL            string          `json:"jobUrl"`
	ApplicationStatus string          `json:"applicationStatus"`
	AttentionReason   *string         `json:"attentionReason"`
	NetworkingStatus  string          `json:"networkingStatus"`
	Notes             *string         `json:"notes"`
	Platform          string          `json:"platform"`
	AppliedAt         *time.Time      `json:"appliedAt"`
	RecentHiresCount  int             `json:"recentHiresCount"`
	CreatedAt         time.Time       `json:"createdAt"`
	UpdatedAt         time.Time       `json:"updatedAt"`
}

type TimelineEvent struct {
	ID            string          `json:"id"`
	ApplicationID string          `json:"applicationId"`
	EventType     string          `json:"eventType"`
	EventData     json.RawMessage `json:"eventData"`
	CreatedAt     time.Time       `json:"createdAt"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// Pool exposes the underlying pool for direct queries in the automation bridge.
func (r *Repository) Pool() *pgxpool.Pool { return r.pool }

type ListParams struct {
	UserID           string
	Company          string
	Role             string
	Location         string
	Status           string
	NetworkingStatus string
	Priority         int
	DateFrom         string
	DateTo           string
	SortBy           string
	SortDir          string
	Page             int
	PageSize         int
}

func (r *Repository) List(ctx context.Context, p ListParams) ([]*Application, int, error) {
	if p.Page < 1 {
		p.Page = 1
	}
	if p.PageSize < 1 || p.PageSize > 100 {
		p.PageSize = 20
	}

	conds := []string{"a.user_id = $1"}
	args := []any{p.UserID}
	n := 2

	add := func(cond string, val any) {
		conds = append(conds, fmt.Sprintf(cond, n))
		args = append(args, val)
		n++
	}

	if p.Company != "" {
		add("c.name ILIKE $%d", "%"+p.Company+"%")
	}
	if p.Role != "" {
		add("a.role ILIKE $%d", "%"+p.Role+"%")
	}
	if p.Location != "" {
		add("a.location ILIKE $%d", "%"+p.Location+"%")
	}
	if p.Status != "" {
		add("a.application_status = $%d", p.Status)
	}
	if p.NetworkingStatus != "" {
		add("a.networking_status = $%d", p.NetworkingStatus)
	}
	if p.Priority > 0 {
		add("a.priority = $%d", p.Priority)
	}
	if p.DateFrom != "" {
		add("a.applied_at >= $%d", p.DateFrom)
	}
	if p.DateTo != "" {
		add("a.applied_at <= $%d", p.DateTo)
	}

	where := strings.Join(conds, " AND ")

	// Whitelist sort columns
	sortCol := "a.applied_at"
	switch p.SortBy {
	case "company":
		sortCol = "c.name"
	case "priority":
		sortCol = "a.priority"
	case "role":
		sortCol = "a.role"
	}
	sortDir := "DESC"
	if strings.EqualFold(p.SortDir, "asc") {
		sortDir = "ASC"
	}

	base := fmt.Sprintf(`
		FROM applications a
		JOIN companies c ON c.id = a.company_id
		WHERE %s`, where)

	var total int
	if err := r.pool.QueryRow(ctx, "SELECT COUNT(*) "+base, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count applications: %w", err)
	}

	offset := (p.Page - 1) * p.PageSize
	args = append(args, p.PageSize, offset)

	query := fmt.Sprintf(`
		SELECT a.id, a.user_id, a.company_id, a.session_id,
		       c.id, c.name, c.linkedin_url, c.career_page_url,
		       a.role, a.location, a.priority, a.job_url,
		       a.application_status, a.attention_reason, a.networking_status,
		       a.notes, a.platform, a.applied_at,
		       (SELECT COUNT(*) FROM recent_hires rh WHERE rh.application_id = a.id),
		       a.created_at, a.updated_at
		%s ORDER BY %s %s LIMIT $%d OFFSET $%d`, base, sortCol, sortDir, n, n+1)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list applications: %w", err)
	}
	defer rows.Close()

	var apps []*Application
	for rows.Next() {
		var a Application
		if err := rows.Scan(
			&a.ID, &a.UserID, &a.CompanyID, &a.SessionID,
			&a.Company.ID, &a.Company.Name, &a.Company.LinkedInURL, &a.Company.CareerPageURL,
			&a.Role, &a.Location, &a.Priority, &a.JobURL,
			&a.ApplicationStatus, &a.AttentionReason, &a.NetworkingStatus,
			&a.Notes, &a.Platform, &a.AppliedAt,
			&a.RecentHiresCount, &a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan application: %w", err)
		}
		apps = append(apps, &a)
	}
	if apps == nil {
		apps = []*Application{}
	}
	return apps, total, rows.Err()
}

func (r *Repository) GetByID(ctx context.Context, id, userID string) (*Application, error) {
	var a Application
	err := r.pool.QueryRow(ctx, `
		SELECT a.id, a.user_id, a.company_id, a.session_id,
		       c.id, c.name, c.linkedin_url, c.career_page_url,
		       a.role, a.location, a.priority, a.job_url,
		       a.application_status, a.attention_reason, a.networking_status,
		       a.notes, a.platform, a.applied_at,
		       (SELECT COUNT(*) FROM recent_hires rh WHERE rh.application_id = a.id),
		       a.created_at, a.updated_at
		FROM applications a
		JOIN companies c ON c.id = a.company_id
		WHERE a.id = $1 AND a.user_id = $2`, id, userID,
	).Scan(
		&a.ID, &a.UserID, &a.CompanyID, &a.SessionID,
		&a.Company.ID, &a.Company.Name, &a.Company.LinkedInURL, &a.Company.CareerPageURL,
		&a.Role, &a.Location, &a.Priority, &a.JobURL,
		&a.ApplicationStatus, &a.AttentionReason, &a.NetworkingStatus,
		&a.Notes, &a.Platform, &a.AppliedAt,
		&a.RecentHiresCount, &a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, pgx.ErrNoRows
		}
		return nil, fmt.Errorf("get application: %w", err)
	}
	return &a, nil
}

type UpdateParams struct {
	Notes             *string
	NetworkingStatus  *string
	ApplicationStatus *string
}

func (r *Repository) Update(ctx context.Context, id, userID string, p UpdateParams) error {
	var sets []string
	var args []any
	n := 1

	if p.Notes != nil {
		sets = append(sets, fmt.Sprintf("notes = $%d", n))
		args = append(args, *p.Notes)
		n++
	}
	if p.NetworkingStatus != nil {
		sets = append(sets, fmt.Sprintf("networking_status = $%d", n))
		args = append(args, *p.NetworkingStatus)
		n++
	}
	if p.ApplicationStatus != nil {
		sets = append(sets, fmt.Sprintf("application_status = $%d", n))
		args = append(args, *p.ApplicationStatus)
		n++
	}
	if len(sets) == 0 {
		return nil
	}

	args = append(args, id, userID)
	query := fmt.Sprintf("UPDATE applications SET %s WHERE id = $%d AND user_id = $%d",
		strings.Join(sets, ", "), n, n+1)

	tag, err := r.pool.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("update application: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (r *Repository) GetTimeline(ctx context.Context, applicationID, userID string) ([]*TimelineEvent, error) {
	// Verify ownership first
	var count int
	if err := r.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM applications WHERE id = $1 AND user_id = $2`,
		applicationID, userID,
	).Scan(&count); err != nil {
		return nil, err
	}
	if count == 0 {
		return nil, pgx.ErrNoRows
	}

	rows, err := r.pool.Query(ctx, `
		SELECT id, application_id, event_type, event_data, created_at
		FROM application_timelines
		WHERE application_id = $1
		ORDER BY created_at ASC`, applicationID)
	if err != nil {
		return nil, fmt.Errorf("get timeline: %w", err)
	}
	defer rows.Close()

	var events []*TimelineEvent
	for rows.Next() {
		var e TimelineEvent
		if err := rows.Scan(&e.ID, &e.ApplicationID, &e.EventType, &e.EventData, &e.CreatedAt); err != nil {
			return nil, err
		}
		events = append(events, &e)
	}
	if events == nil {
		events = []*TimelineEvent{}
	}
	return events, rows.Err()
}

func (r *Repository) AddTimelineEvent(ctx context.Context, applicationID, eventType string, eventData map[string]any) error {
	data, err := json.Marshal(eventData)
	if err != nil {
		return fmt.Errorf("marshal event data: %w", err)
	}
	_, err = r.pool.Exec(ctx, `
		INSERT INTO application_timelines (application_id, event_type, event_data)
		VALUES ($1, $2, $3)`, applicationID, eventType, data)
	return err
}
