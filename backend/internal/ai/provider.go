package ai

import "context"

// Provider expands job titles and generates daily summaries.
type Provider interface {
	ExpandJobTitles(ctx context.Context, keywords []string) ([]string, error)
	GenerateSummary(ctx context.Context, stats map[string]any) (string, error)
}
