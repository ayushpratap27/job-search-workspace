package recent_hires

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type RecentHire struct {
	ID            string    `json:"id"`
	CompanyID     string    `json:"companyId"`
	CompanyName   string    `json:"companyName"`
	ApplicationID *string   `json:"applicationId"`
	Name          string    `json:"name"`
	Designation   *string   `json:"designation"`
	JoinedAt      *string   `json:"joinedAt"`
	ProfileURL    *string   `json:"profileUrl"`
	Platform      string    `json:"platform"`
	CreatedAt     time.Time `json:"createdAt"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

type ListParams struct {
	CompanyID     string
	ApplicationID string
	Page          int
	PageSize      int
}

func (r *Repository) List(ctx context.Context, p ListParams) ([]*RecentHire, int, error) {
	if p.Page < 1 {
		p.Page = 1
	}
	if p.PageSize < 1 || p.PageSize > 100 {
		p.PageSize = 20
	}

	conds := []string{"1=1"}
	args := []any{}
	n := 1

	if p.CompanyID != "" {
		conds = append(conds, fmt.Sprintf("rh.company_id = $%d", n))
		args = append(args, p.CompanyID)
		n++
	}
	if p.ApplicationID != "" {
		conds = append(conds, fmt.Sprintf("rh.application_id = $%d", n))
		args = append(args, p.ApplicationID)
		n++
	}

	where := fmt.Sprintf("WHERE %s", joinAnd(conds))

	var total int
	if err := r.pool.QueryRow(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM recent_hires rh %s`, where), args...,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (p.Page - 1) * p.PageSize
	args = append(args, p.PageSize, offset)

	rows, err := r.pool.Query(ctx, fmt.Sprintf(`
		SELECT rh.id, rh.company_id, c.name, rh.application_id,
		       rh.name, rh.designation, rh.joined_at, rh.profile_url,
		       rh.platform, rh.created_at
		FROM recent_hires rh
		JOIN companies c ON c.id = rh.company_id
		%s
		ORDER BY rh.created_at DESC
		LIMIT $%d OFFSET $%d`, where, n, n+1), args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list recent hires: %w", err)
	}
	defer rows.Close()

	var hires []*RecentHire
	for rows.Next() {
		var h RecentHire
		if err := rows.Scan(
			&h.ID, &h.CompanyID, &h.CompanyName, &h.ApplicationID,
			&h.Name, &h.Designation, &h.JoinedAt, &h.ProfileURL,
			&h.Platform, &h.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		hires = append(hires, &h)
	}
	if hires == nil {
		hires = []*RecentHire{}
	}
	return hires, total, rows.Err()
}

func joinAnd(parts []string) string {
	result := ""
	for i, p := range parts {
		if i > 0 {
			result += " AND "
		}
		result += p
	}
	return result
}
