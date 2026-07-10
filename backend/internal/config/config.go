package config

import (
	"log"

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
	AllowedOrigin       string `mapstructure:"ALLOWED_ORIGIN"`
}

func Load() *Config {
	viper.SetConfigFile(".env")
	viper.AutomaticEnv()

	viper.SetDefault("PORT", "8080")
	viper.SetDefault("ENV", "development")
	viper.SetDefault("ALLOWED_ORIGIN", "http://localhost:5173")
	viper.SetDefault("JWT_ACCESS_TTL_MINUTES", 15)
	viper.SetDefault("JWT_REFRESH_TTL_DAYS", 7)

	if err := viper.ReadInConfig(); err != nil {
		log.Printf("no .env file found, reading from environment: %v", err)
	}

	cfg := &Config{}
	if err := viper.Unmarshal(cfg); err != nil {
		log.Fatalf("failed to unmarshal config: %v", err)
	}

	return cfg
}
