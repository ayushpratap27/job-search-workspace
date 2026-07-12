package config

import (
	"fmt"
	"log"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	Port                string `mapstructure:"PORT"`
	Env                 string `mapstructure:"ENV"`
	DatabaseURL         string `mapstructure:"DATABASE_URL"`
	RedisAddr           string `mapstructure:"REDIS_ADDR"`
	RedisPassword       string `mapstructure:"REDIS_PASSWORD"`
	JWTSecret           string `mapstructure:"JWT_SECRET"`
	JWTAccessTTLMinutes int    `mapstructure:"JWT_ACCESS_TTL_MINUTES"`
	JWTRefreshTTLDays   int    `mapstructure:"JWT_REFRESH_TTL_DAYS"`
	AllowedOrigin  string `mapstructure:"ALLOWED_ORIGIN"`
	// Comma-separated list of additional allowed origins (e.g. Vercel URL)
	AllowedOrigins string `mapstructure:"ALLOWED_ORIGINS"`
	// AI
	AIProvider   string `mapstructure:"AI_PROVIDER"`   // openai | gemini | groq | none
	OpenAIAPIKey string `mapstructure:"OPENAI_API_KEY"`
	GeminiAPIKey string `mapstructure:"GEMINI_API_KEY"`
	GroqAPIKey   string `mapstructure:"GROQ_API_KEY"`
	// SMTP
	SMTPHost      string `mapstructure:"SMTP_HOST"`
	SMTPPort      int    `mapstructure:"SMTP_PORT"`
	SMTPUser      string `mapstructure:"SMTP_USER"`
	SMTPPassword  string `mapstructure:"SMTP_PASSWORD"`
	SMTPFrom      string `mapstructure:"SMTP_FROM"`
	SummaryRecipient string `mapstructure:"SUMMARY_RECIPIENT_EMAIL"`
}

func Load() *Config {
	viper.SetConfigFile(".env")
	viper.AutomaticEnv()

	viper.SetDefault("PORT", "8080")
	viper.SetDefault("ENV", "development")
	viper.SetDefault("ALLOWED_ORIGIN", "http://localhost:5173")
	viper.SetDefault("JWT_ACCESS_TTL_MINUTES", 15)
	viper.SetDefault("JWT_REFRESH_TTL_DAYS", 7)
	viper.SetDefault("AI_PROVIDER", "none")
	viper.SetDefault("SMTP_PORT", 587)

	if err := viper.ReadInConfig(); err != nil {
		log.Printf("no .env file found, reading from environment: %v", err)
	}

	cfg := &Config{}
	if err := viper.Unmarshal(cfg); err != nil {
		log.Fatalf("failed to unmarshal config: %v", err)
	}

	return cfg
}

// Validate checks that all required fields are set.
// Call this during startup to fail fast with a clear error instead of
// crashing silently on the first DB or auth operation.
func (c *Config) Validate(requireDB bool) error {
	var missing []string

	if c.JWTSecret == "" {
		missing = append(missing, "JWT_SECRET")
	}

	if requireDB {
		if c.DatabaseURL == "" {
			missing = append(missing, "DATABASE_URL")
		}
		if c.RedisAddr == "" {
			missing = append(missing, "REDIS_ADDR")
		}
	}

	if len(missing) > 0 {
		return fmt.Errorf("missing required environment variables: %s — copy backend/.env.example to backend/.env and fill in the values",
			strings.Join(missing, ", "))
	}
	return nil
}
