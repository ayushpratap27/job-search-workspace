package automation

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/ai"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/auth"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/response"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/sessions"
)

const sessionLockPrefix = "automation:session_lock:"
const sessionLockTTL = 12 * time.Hour

type Handler struct {
	sessionRepo *sessions.Repository
	redis       *redis.Client
	pool        *pgxpool.Pool
	ai          ai.Provider
}

func NewHandler(sessionRepo *sessions.Repository, redisClient *redis.Client, pool *pgxpool.Pool, aiProvider ai.Provider) *Handler {
	return &Handler{sessionRepo: sessionRepo, redis: redisClient, pool: pool, ai: aiProvider}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/start", h.start)
	rg.POST("/pause", h.pause)
	rg.POST("/resume", h.resume)
	rg.GET("/status", h.status)
	rg.GET("/sessions", h.listSessions)
}

// POST /automation/start
func (h *Handler) start(c *gin.Context) {
	userID := auth.GetUserID(c)
	ctx := c.Request.Context()

	// Check for existing running session via Redis lock
	lockKey := sessionLockPrefix + userID
	locked, err := h.redis.Exists(ctx, lockKey).Result()
	if err == nil && locked > 0 {
		response.Unprocessable(c, "a session is already running")
		return
	}

	var req struct {
		MaxJobs  int  `json:"maxJobs"`
		DryRun   bool `json:"dryRun"`
	}
	_ = c.ShouldBindJSON(&req)

	// Load user's configured keywords and expand with AI
	var keywordsJSON []byte
	_ = h.pool.QueryRow(ctx,
		`SELECT keywords FROM search_configs WHERE user_id = $1 AND is_active = true LIMIT 1`, userID,
	).Scan(&keywordsJSON)

	var baseKeywords []string
	if len(keywordsJSON) > 0 {
		_ = json.Unmarshal(keywordsJSON, &baseKeywords)
	}
	if len(baseKeywords) == 0 {
		baseKeywords = []string{"Software Engineer", "SDE"}
	}

	expandedKeywords, err := h.ai.ExpandJobTitles(ctx, baseKeywords)
	if err != nil {
		expandedKeywords = baseKeywords
	}

	session, err := h.sessionRepo.Create(ctx, userID, "linkedin")
	if err != nil {
		response.Internal(c)
		return
	}

	// Set Redis lock for the session duration
	_ = h.redis.Set(ctx, lockKey, session.ID, sessionLockTTL).Err()

	// Publish start command with expanded keywords
	cmd := map[string]any{
		"cmd":       "start",
		"sessionId": session.ID,
		"userId":    userID,
		"config":    map[string]any{"keywords": expandedKeywords, "maxJobs": req.MaxJobs, "dryRun": req.DryRun},
	}
	payload, _ := json.Marshal(cmd)
	_ = h.redis.Publish(ctx, "automation:commands:"+userID, payload).Err()

	c.JSON(http.StatusAccepted, gin.H{
		"success": true,
		"data": gin.H{
			"sessionId": session.ID,
			"status":    "running",
			"startedAt": session.StartedAt,
		},
	})
}

// POST /automation/pause
func (h *Handler) pause(c *gin.Context) {
	userID := auth.GetUserID(c)
	cmd, _ := json.Marshal(map[string]any{"cmd": "pause"})
	_ = h.redis.Publish(c.Request.Context(), "automation:commands:"+userID, cmd).Err()
	response.OK(c, gin.H{"status": "pause_requested"})
}

// POST /automation/resume
func (h *Handler) resume(c *gin.Context) {
	userID := auth.GetUserID(c)
	ctx := c.Request.Context()

	var req struct {
		SessionID string `json:"sessionId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	session, err := h.sessionRepo.GetByID(ctx, req.SessionID, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			response.NotFound(c, "session not found")
			return
		}
		response.Internal(c)
		return
	}
	if session.Status != "paused" {
		response.Unprocessable(c, "session is not paused")
		return
	}

	_ = h.sessionRepo.UpdateStatus(ctx, req.SessionID, "running")

	// Re-set lock in case it expired
	_ = h.redis.Set(ctx, sessionLockPrefix+userID, req.SessionID, sessionLockTTL).Err()

	cmd, _ := json.Marshal(map[string]any{"cmd": "resume", "sessionId": req.SessionID})
	_ = h.redis.Publish(ctx, "automation:commands:"+userID, cmd).Err()

	response.OK(c, gin.H{"sessionId": req.SessionID, "status": "running"})
}

// GET /automation/status
func (h *Handler) status(c *gin.Context) {
	userID := auth.GetUserID(c)
	ctx := c.Request.Context()

	session, err := h.sessionRepo.GetActive(ctx, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		response.OK(c, gin.H{"isRunning": false, "session": nil})
		return
	}
	if err != nil {
		response.Internal(c)
		return
	}

	response.OK(c, gin.H{
		"isRunning": session.Status == "running",
		"session":   session,
	})
}

// GET /automation/sessions
func (h *Handler) listSessions(c *gin.Context) {
	userID := auth.GetUserID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	list, total, err := h.sessionRepo.List(c.Request.Context(), sessions.ListParams{
		UserID:   userID,
		Status:   c.Query("status"),
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		response.Internal(c)
		return
	}
	response.Paginated(c, list, page, pageSize, total)
}

// ReleaseLock removes the session lock — called by bridge when session completes.
func (h *Handler) ReleaseLock(ctx context.Context, userID string) {
	_ = h.redis.Del(ctx, sessionLockPrefix+userID).Err()
}
