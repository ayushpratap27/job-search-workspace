package email

import (
	"bytes"
	"context"
	"embed"
	"fmt"
	"html/template"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed templates/daily_summary.html
var templateFS embed.FS

type SummaryStats struct {
	JobsFound         int
	Applied           int
	NeedsAttention    int
	Skipped           int
	NetworkingPending int
	RecentHiresFound  int
}

type CompanyRow struct {
	Company       string
	Role          string
	Location      string
	Status        string
	JobURL        string
	LinkedInURL   string
	CareerPageURL string
}

type SummaryData struct {
	Date      string
	AISummary string
	Stats     SummaryStats
	Companies []CompanyRow
}

// BuildSummaryData queries the DB for today's data and returns a template-ready struct.
func BuildSummaryData(ctx context.Context, pool *pgxpool.Pool, userID, aiSummary string) (*SummaryData, error) {
	today := time.Now().Format("2006-01-02")

	data := &SummaryData{
		Date:      time.Now().Format("Monday, January 2, 2006"),
		AISummary: aiSummary,
	}

	// Stats from daily_summaries
	var statsJSON []byte
	_ = pool.QueryRow(ctx,
		`SELECT stats FROM daily_summaries WHERE user_id = $1 AND date = $2`,
		userID, today,
	).Scan(&statsJSON)

	// Per-company rows
	rows, err := pool.Query(ctx, `
		SELECT c.name, a.role, COALESCE(a.location,''),
		       a.application_status, a.job_url,
		       COALESCE(c.linkedin_url,''), COALESCE(c.career_page_url,''),
		       (SELECT COUNT(*) FROM recent_hires rh WHERE rh.application_id = a.id)
		FROM applications a
		JOIN companies c ON c.id = a.company_id
		WHERE a.user_id = $1 AND DATE(a.applied_at) = $2
		ORDER BY a.priority, a.applied_at`, userID, today)
	if err != nil {
		return nil, fmt.Errorf("query companies: %w", err)
	}
	defer rows.Close()

	var applied, skipped, attention, hiresTotal int
	for rows.Next() {
		var row CompanyRow
		var hiresCount int
		if err := rows.Scan(&row.Company, &row.Role, &row.Location, &row.Status,
			&row.JobURL, &row.LinkedInURL, &row.CareerPageURL, &hiresCount); err != nil {
			continue
		}
		data.Companies = append(data.Companies, row)
		hiresTotal += hiresCount
		switch row.Status {
		case "completed":
			applied++
		case "needs_attention":
			attention++
		case "skipped":
			skipped++
		}
	}

	var networkingPending int
	_ = pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM applications WHERE user_id = $1 AND networking_status = 'pending'`,
		userID,
	).Scan(&networkingPending)

	data.Stats = SummaryStats{
		JobsFound:         applied + skipped + attention,
		Applied:           applied,
		NeedsAttention:    attention,
		Skipped:           skipped,
		NetworkingPending: networkingPending,
		RecentHiresFound:  hiresTotal,
	}

	return data, nil
}

// RenderSummaryHTML renders the daily_summary.html template.
func RenderSummaryHTML(data *SummaryData) (string, error) {
	tmplBytes, err := templateFS.ReadFile("templates/daily_summary.html")
	if err != nil {
		return "", fmt.Errorf("read template: %w", err)
	}

	tmpl, err := template.New("summary").Parse(string(tmplBytes))
	if err != nil {
		return "", fmt.Errorf("parse template: %w", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("render template: %w", err)
	}
	return buf.String(), nil
}
