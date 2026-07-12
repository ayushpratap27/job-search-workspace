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

type openAIProvider struct {
	apiKey  string
	baseURL string
	model   string
	client  *http.Client
}

// NewOpenAI creates a provider targeting the official OpenAI API.
func NewOpenAI(apiKey string) Provider {
	return &openAIProvider{
		apiKey:  apiKey,
		baseURL: "https://api.openai.com/v1",
		model:   "gpt-4o-mini",
		client:  &http.Client{Timeout: 30 * time.Second},
	}
}

// NewOpenAICompatible creates a provider for any OpenAI-compatible endpoint (e.g. Groq).
func NewOpenAICompatible(apiKey, baseURL, model string) Provider {
	return &openAIProvider{
		apiKey:  apiKey,
		baseURL: baseURL,
		model:   model,
		client:  &http.Client{Timeout: 30 * time.Second},
	}
}

func (p *openAIProvider) ExpandJobTitles(ctx context.Context, keywords []string) ([]string, error) {
	prompt := fmt.Sprintf(
		`You are a job search assistant. Given these job search keywords: %s
Suggest all related job titles that mean similar things or have overlapping responsibilities.
Return ONLY a JSON object with key "titles" containing an array of strings.
Include the original keywords plus 5-8 related titles. No explanation, just JSON.`,
		strings.Join(keywords, ", "),
	)

	body, err := p.call(ctx, prompt)
	if err != nil {
		return nil, err
	}

	var result struct {
		Titles []string `json:"titles"`
	}
	if err := json.Unmarshal([]byte(body), &result); err != nil {
		return keywords, nil // fallback: return originals
	}
	if len(result.Titles) == 0 {
		return keywords, nil
	}
	return result.Titles, nil
}

func (p *openAIProvider) GenerateSummary(ctx context.Context, stats map[string]any) (string, error) {
	statsJSON, _ := json.Marshal(stats)
	prompt := fmt.Sprintf(
		`You are a concise job search assistant. Write a professional 2-3 sentence summary of today's job search activity based on these stats: %s
Be direct, specific with the numbers, and end with a brief motivating note. No bullet points, just plain text.`,
		string(statsJSON),
	)

	return p.call(ctx, prompt)
}

func (p *openAIProvider) call(ctx context.Context, prompt string) (string, error) {
	reqBody, _ := json.Marshal(map[string]any{
		"model": p.model,
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		p.baseURL+"/chat/completions",
		bytes.NewReader(reqBody),
	)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("openai request: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("openai status %d: %s", resp.StatusCode, raw)
	}

	var response struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(raw, &response); err != nil || len(response.Choices) == 0 {
		return "", fmt.Errorf("openai parse error")
	}
	return response.Choices[0].Message.Content, nil
}
