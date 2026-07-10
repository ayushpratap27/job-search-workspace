package ai

import (
	"context"
	"fmt"
	"strings"
)

// synonyms maps lowercase base keywords to related titles.
var synonyms = map[string][]string{
	"software engineer": {
		"Backend Engineer", "Platform Engineer", "Application Engineer",
		"Software Developer", "Full Stack Engineer", "Infrastructure Engineer",
		"Systems Engineer",
	},
	"sde": {
		"Software Development Engineer", "Software Engineer", "Backend Engineer",
		"Platform Engineer", "Software Developer",
	},
	"software development engineer": {
		"Software Engineer", "SDE", "Backend Engineer", "Platform Engineer",
		"Software Developer",
	},
	"frontend engineer": {
		"Frontend Developer", "UI Engineer", "React Developer",
		"JavaScript Developer", "Web Developer",
	},
	"backend engineer": {
		"Software Engineer", "Backend Developer", "Platform Engineer",
		"API Engineer", "Server-Side Engineer",
	},
	"full stack engineer": {
		"Full Stack Developer", "Software Engineer", "Web Engineer",
		"Frontend Engineer", "Backend Engineer",
	},
	"data engineer": {
		"Data Platform Engineer", "Analytics Engineer", "ETL Engineer",
		"Data Infrastructure Engineer", "Big Data Engineer",
	},
	"devops engineer": {
		"Site Reliability Engineer", "SRE", "Platform Engineer",
		"Infrastructure Engineer", "Cloud Engineer", "Systems Engineer",
	},
}

type fallbackProvider struct{}

func NewFallback() Provider {
	return &fallbackProvider{}
}

func (p *fallbackProvider) ExpandJobTitles(_ context.Context, keywords []string) ([]string, error) {
	seen := make(map[string]bool)
	var result []string

	for _, kw := range keywords {
		if !seen[kw] {
			seen[kw] = true
			result = append(result, kw)
		}
		if related, ok := synonyms[strings.ToLower(kw)]; ok {
			for _, r := range related {
				if !seen[r] {
					seen[r] = true
					result = append(result, r)
				}
			}
		}
	}
	return result, nil
}

func (p *fallbackProvider) GenerateSummary(_ context.Context, stats map[string]any) (string, error) {
	applied, _ := stats["applied"].(float64)
	skipped, _ := stats["skipped"].(float64)
	attention, _ := stats["needsAttention"].(float64)
	found := applied + skipped + attention

	return fmt.Sprintf(
		"Today's search found %.0f jobs and submitted %.0f applications. %.0f jobs need your attention.",
		found, applied, attention,
	), nil
}
