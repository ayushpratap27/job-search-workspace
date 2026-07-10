package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type geminiProvider struct {
	apiKey string
	client *http.Client
}

func NewGemini(apiKey string) Provider {
	return &geminiProvider{
		apiKey: apiKey,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (p *geminiProvider) ExpandJobTitles(ctx context.Context, keywords []string) ([]string, error) {
	prompt := fmt.Sprintf(
		`Given these job search keywords: %s
Suggest related job titles with similar responsibilities.
Return ONLY a JSON object {"titles": ["title1", "title2", ...]} with 8-12 titles including the originals. No explanation.`,
		strings.Join(keywords, ", "),
	)

	body, err := p.call(ctx, prompt)
	if err != nil {
		return nil, err
	}

	var result struct {
		Titles []string `json:"titles"`
	}
	if err := json.Unmarshal([]byte(body), &result); err != nil || len(result.Titles) == 0 {
		return keywords, nil
	}
	return result.Titles, nil
}

func (p *geminiProvider) GenerateSummary(ctx context.Context, stats map[string]any) (string, error) {
	statsJSON, _ := json.Marshal(stats)
	prompt := fmt.Sprintf(
		`Write a 2-3 sentence professional summary of today's job search activity: %s
Be specific about numbers, no bullet points, end with brief encouragement.`,
		string(statsJSON),
	)
	return p.call(ctx, prompt)
}

func (p *geminiProvider) call(ctx context.Context, prompt string) (string, error) {
	reqBody, _ := json.Marshal(map[string]any{
		"contents": []map[string]any{
			{"parts": []map[string]string{{"text": prompt}}},
		},
	})

	url := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=%s",
		p.apiKey,
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(reqBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("gemini request: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("gemini status %d", resp.StatusCode)
	}

	var response struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(raw, &response); err != nil ||
		len(response.Candidates) == 0 || len(response.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("gemini parse error")
	}
	return response.Candidates[0].Content.Parts[0].Text, nil
}
