package tasks

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/hibiken/asynq"
	"github.com/redis/go-redis/v9"
	"github.com/jackc/pgx/v5/pgxpool"
)

const TypeTriggerJobSearch = "task:trigger_job_search"

type TriggerJobSearchPayload struct {
	UserID string `json:"userId"`
}

func NewTriggerJobSearchTask(userID string) (*asynq.Task, error) {
	payload, err := json.Marshal(TriggerJobSearchPayload{UserID: userID})
	if err != nil {
		return nil, err
	}
	return asynq.NewTask(TypeTriggerJobSearch, payload), nil
}

// JobSearchHandler publishes a start command to Redis, which the automation
// service picks up to begin the LinkedIn job search.
type JobSearchHandler struct {
	pool  *pgxpool.Pool
	redis *redis.Client
}

func NewJobSearchHandler(pool *pgxpool.Pool, redisClient *redis.Client) *JobSearchHandler {
	return &JobSearchHandler{pool: pool, redis: redisClient}
}

func (h *JobSearchHandler) ProcessTask(ctx context.Context, t *asynq.Task) error {
	var p TriggerJobSearchPayload
	if err := json.Unmarshal(t.Payload(), &p); err != nil {
		return fmt.Errorf("unmarshal payload: %w", err)
	}

	log.Printf("[worker] triggering job search for user %s", p.UserID)

	// Read search config for the user
	var keywords []byte
	var maxJobs int
	err := h.pool.QueryRow(ctx, `
		SELECT keywords, max_jobs_per_session
		FROM search_configs
		WHERE user_id = $1 AND is_active = true
		LIMIT 1`, p.UserID,
	).Scan(&keywords, &maxJobs)
	if err != nil {
		return fmt.Errorf("load search config: %w", err)
	}

	// Create a session record
	var sessionID string
	if err := h.pool.QueryRow(ctx, `
		INSERT INTO job_search_sessions (user_id, platform)
		VALUES ($1, 'linkedin') RETURNING id`, p.UserID,
	).Scan(&sessionID); err != nil {
		return fmt.Errorf("create session: %w", err)
	}

	// Set session lock
	lockKey := "automation:session_lock:" + p.UserID
	_ = h.redis.Set(ctx, lockKey, sessionID, 12*time.Hour).Err()

	// Publish start command
	cmd := map[string]any{
		"cmd":       "start",
		"sessionId": sessionID,
		"userId":    p.UserID,
		"config":    map[string]any{"keywords": json.RawMessage(keywords), "maxJobs": maxJobs},
	}
	payload, _ := json.Marshal(cmd)
	return h.redis.Publish(ctx, "automation:commands:"+p.UserID, payload).Err()
}
