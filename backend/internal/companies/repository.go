package companies

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Company struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	LinkedInURL   *string   `json:"linkedinUrl"`
	CareerPageURL *string   `json:"careerPageUrl"`
	Website       *string   `json:"website"`
	Platform      string    `json:"platform"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

func (r *Repository) FindOrCreate(ctx context.Context, name string, linkedInURL *string) (*Company, error) {
	if linkedInURL != nil && *linkedInURL != "" {
		c, err := r.findByLinkedInURL(ctx, *linkedInURL)
		if err == nil {
			return c, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}

	row := r.pool.QueryRow(ctx, `
		INSERT INTO companies (name, linkedin_url)
		VALUES ($1, $2)
		ON CONFLICT (linkedin_url) DO UPDATE SET name = EXCLUDED.name
		RETURNING id, name, linkedin_url, career_page_url, website, platform, created_at, updated_at`,
		name, linkedInURL,
	)
	return scanOne(row)
}

func (r *Repository) GetByID(ctx context.Context, id string) (*Company, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, name, linkedin_url, career_page_url, website, platform, created_at, updated_at
		FROM companies WHERE id = $1`, id)

	c, err := scanOne(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, pgx.ErrNoRows
		}
		return nil, fmt.Errorf("get company: %w", err)
	}
	return c, nil
}

type ListParams struct {
	Name     string
	Page     int
	PageSize int
}

func (r *Repository) List(ctx context.Context, p ListParams) ([]*Company, int, error) {
	if p.Page < 1 {
		p.Page = 1
	}
	if p.PageSize < 1 || p.PageSize > 100 {
		p.PageSize = 20
	}

	var total int
	var companies []*Company
	offset := (p.Page - 1) * p.PageSize

	if p.Name != "" {
		like := "%" + p.Name + "%"
		if err := r.pool.QueryRow(ctx,
			`SELECT COUNT(*) FROM companies WHERE name ILIKE $1`, like,
		).Scan(&total); err != nil {
			return nil, 0, err
		}

		rows, err := r.pool.Query(ctx, `
			SELECT id, name, linkedin_url, career_page_url, website, platform, created_at, updated_at
			FROM companies WHERE name ILIKE $1
			ORDER BY name LIMIT $2 OFFSET $3`, like, p.PageSize, offset)
		if err != nil {
			return nil, 0, err
		}
		defer rows.Close()
		companies, err = scanRows(rows)
		if err != nil {
			return nil, 0, err
		}
	} else {
		if err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM companies`).Scan(&total); err != nil {
			return nil, 0, err
		}
		rows, err := r.pool.Query(ctx, `
			SELECT id, name, linkedin_url, career_page_url, website, platform, created_at, updated_at
			FROM companies ORDER BY name LIMIT $1 OFFSET $2`, p.PageSize, offset)
		if err != nil {
			return nil, 0, err
		}
		defer rows.Close()
		companies, err = scanRows(rows)
		if err != nil {
			return nil, 0, err
		}
	}

	return companies, total, nil
}

func scanOne(row pgx.Row) (*Company, error) {
	var c Company
	err := row.Scan(&c.ID, &c.Name, &c.LinkedInURL, &c.CareerPageURL, &c.Website, &c.Platform, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *Repository) findByLinkedInURL(ctx context.Context, url string) (*Company, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, name, linkedin_url, career_page_url, website, platform, created_at, updated_at
		FROM companies WHERE linkedin_url = $1`, url)
	return scanOne(row)
}

func scanRows(rows pgx.Rows) ([]*Company, error) {
	var companies []*Company
	for rows.Next() {
		var c Company
		if err := rows.Scan(&c.ID, &c.Name, &c.LinkedInURL, &c.CareerPageURL, &c.Website, &c.Platform, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, err
		}
		companies = append(companies, &c)
	}
	return companies, rows.Err()
}
