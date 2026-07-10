package ai

import "log"

// New returns the appropriate provider based on the provider name.
// Falls back to the static synonym map if the provider is unconfigured.
func New(provider, openAIKey, geminiKey string) Provider {
	switch provider {
	case "openai":
		if openAIKey == "" {
			log.Println("[ai] AI_PROVIDER=openai but OPENAI_API_KEY not set — using fallback")
			return NewFallback()
		}
		log.Println("[ai] using OpenAI provider")
		return NewOpenAI(openAIKey)
	case "gemini":
		if geminiKey == "" {
			log.Println("[ai] AI_PROVIDER=gemini but GEMINI_API_KEY not set — using fallback")
			return NewFallback()
		}
		log.Println("[ai] using Gemini provider")
		return NewGemini(geminiKey)
	default:
		log.Println("[ai] using fallback synonym map (set AI_PROVIDER=openai|gemini to enable AI)")
		return NewFallback()
	}
}
