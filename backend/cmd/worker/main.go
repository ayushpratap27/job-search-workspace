package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/hibiken/asynq"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/ai"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/config"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/db"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/email"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/tasks"
)

func main() {
	cfg := config.Load()

	// Worker requires DB and Redis — fail fast with a clear error.
	if err := cfg.Validate(true); err != nil {
		log.Fatalf("worker: %v", err)
	}

	// DB + Redis connections
	pool, err := db.NewPostgresPool(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("worker: postgres unavailable: %v", err)
	}
	defer pool.Close()

	redisClient, err := db.NewRedisClient(cfg.RedisAddr, cfg.RedisPassword)
	if err != nil {
		log.Fatalf("worker: redis unavailable: %v", err)
	}
	defer redisClient.Close()

	// Redis options for Asynq (uses its own connection internally)
	redisOpt := asynq.RedisClientOpt{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
	}

	// Start Asynq worker server
	srv := asynq.NewServer(redisOpt, asynq.Config{
		Concurrency: 5,
		Queues:      map[string]int{"default": 1},
		RetryDelayFunc: func(n int, _ error, _ *asynq.Task) time.Duration {
			return time.Duration(n*n) * time.Minute // exponential backoff
		},
	})

	// AI provider
	aiProvider := ai.New(cfg.AIProvider, cfg.OpenAIAPIKey, cfg.GeminiAPIKey, cfg.GroqAPIKey)

	// Email client
	emailClient := email.NewClient(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUser, cfg.SMTPPassword, cfg.SMTPFrom)

	// Register task handlers
	mux := asynq.NewServeMux()
	mux.HandleFunc(tasks.TypeTriggerJobSearch, tasks.NewJobSearchHandler(pool, redisClient).ProcessTask)
	mux.HandleFunc(tasks.TypeDailySummary, tasks.NewDailySummaryHandler(pool, aiProvider, emailClient, cfg.SummaryRecipient).ProcessTask)

	// Start scheduler for cron tasks
	scheduler := asynq.NewScheduler(redisOpt, nil)
	registerScheduledTasks(scheduler, pool, cfg)

	if err := scheduler.Start(); err != nil {
		log.Fatalf("worker: scheduler start failed: %v", err)
	}
	defer scheduler.Shutdown()

	log.Println("worker: started — listening for tasks")

	if err := srv.Run(mux); err != nil {
		log.Fatalf("worker: server error: %v", err)
	}
}

func registerScheduledTasks(scheduler *asynq.Scheduler, pool *pgxpool.Pool, _ *config.Config) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Load all active users and their schedule times
	rows, err := pool.Query(ctx, `
		SELECT user_id, search_start_time, summary_time
		FROM search_configs WHERE is_active = true`)
	if err != nil {
		log.Printf("worker: failed to load search configs: %v", err)
		return
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var userID string
		var searchTime, summaryTime string
		if err := rows.Scan(&userID, &searchTime, &summaryTime); err != nil {
			continue
		}

		// Parse HH:MM:SS → cron expression "M H * * *"
		searchCron := timeToCron(searchTime)
		summaryCron := timeToCron(summaryTime)

		searchTask, _ := tasks.NewTriggerJobSearchTask(userID)
		summaryTask, _ := tasks.NewDailySummaryTask(userID)

		if _, err := scheduler.Register(searchCron, searchTask); err != nil {
			log.Printf("worker: register search task for %s: %v", userID, err)
		}
		if _, err := scheduler.Register(summaryCron, summaryTask); err != nil {
			log.Printf("worker: register summary task for %s: %v", userID, err)
		}

		log.Printf("worker: scheduled search@%s summary@%s for user %s", searchCron, summaryCron, userID)
		count++
	}

	if count == 0 {
		log.Println("worker: no active search configs found — tasks will be registered when user configures settings")
	}
}

func timeToCron(t string) string {
	var h, m, s int
	_, _ = fmt.Sscanf(t, "%d:%d:%d", &h, &m, &s)
	return fmt.Sprintf("%d %d * * *", m, h)
}

func mustNewRedis(cfg *config.Config) *redis.Client {
	client, err := db.NewRedisClient(cfg.RedisAddr, cfg.RedisPassword)
	if err != nil {
		log.Fatalf("worker: redis unavailable: %v", err)
	}
	return client
}
