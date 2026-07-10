package automation

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/applications"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/companies"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/notifications"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/recent_hires"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/sessions"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/ws"
)

type automationEvent struct {
	Type      string          `json:"type"`
	SessionID string          `json:"sessionId"`
	Data      json.RawMessage `json:"data"`
	Timestamp string          `json:"timestamp"`
}

// Bridge subscribes to automation:events:* and routes events to the WS hub and DB.
type Bridge struct {
	redis       *redis.Client
	hub         *ws.Hub
	sessionRepo *sessions.Repository
	companyRepo *companies.Repository
	appRepo     *applications.Repository
	hireRepo    *recent_hires.Repository
	notifSvc    *notifications.Service
}

func NewBridge(
	redisClient *redis.Client,
	hub *ws.Hub,
	sessionRepo *sessions.Repository,
	companyRepo *companies.Repository,
	appRepo *applications.Repository,
	hireRepo *recent_hires.Repository,
	notifSvc *notifications.Service,
) *Bridge {
	return &Bridge{
		redis:       redisClient,
		hub:         hub,
		sessionRepo: sessionRepo,
		companyRepo: companyRepo,
		appRepo:     appRepo,
		hireRepo:    hireRepo,
		notifSvc:    notifSvc,
	}
}

// Start subscribes to all automation event channels and processes them.
// Guards against nil repos — if the DB pool was unavailable at startup,
// the bridge skips listening rather than panicking on first DB call.
func (b *Bridge) Start() {
	if b.appRepo == nil || b.companyRepo == nil || b.sessionRepo == nil || b.hireRepo == nil || b.notifSvc == nil {
		log.Println("[bridge] skipping start — one or more repositories are nil (DB unavailable?)")
		return
	}
	go b.listen()
}

func (b *Bridge) listen() {
	sub := b.redis.PSubscribe(context.Background(), "automation:events:*")
	defer sub.Close()

	log.Println("[bridge] listening on automation:events:*")

	ch := sub.Channel()
	for msg := range ch {
		// Extract userID from channel name: automation:events:{userID}
		userID := ""
		if len(msg.Channel) > len("automation:events:") {
			userID = msg.Channel[len("automation:events:"):]
		}
		if userID == "" {
			log.Printf("[bridge] dropping event from malformed channel: %q", msg.Channel)
			continue
		}

		var event automationEvent
		if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
			log.Printf("[bridge] unmarshal error: %v", err)
			continue
		}

		// Always broadcast raw event to WS clients for that user
		b.hub.Send(userID, []byte(msg.Payload))

		// Handle DB side-effects
		b.handleEvent(userID, event)
	}
}

func (b *Bridge) handleEvent(userID string, event automationEvent) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Automation service publishes events with "automation:" prefix.
	// Strip prefix for internal switch so both styles are handled uniformly.
	eventType := event.Type
	if len(eventType) > 11 && eventType[:11] == "automation:" {
		eventType = eventType[11:]
	}

	switch eventType {
	case "job_applied":
		b.onJobApplied(ctx, userID, event)
	case "job_skipped":
		b.onJobSkipped(ctx, userID, event)
	case "recent_hires":
		b.onRecentHires(ctx, event)
	case "needs_attention":
		b.onNeedsAttention(ctx, userID, event)
	case "completed":
		b.onSessionDone(ctx, userID, event)
	case "error":
		b.onSessionError(ctx, userID, event)
	}
}

func (b *Bridge) onJobApplied(ctx context.Context, userID string, event automationEvent) {
	var d struct {
		JobURL             string  `json:"jobUrl"`
		Company            string  `json:"company"`
		Role               string  `json:"role"`
		Location           string  `json:"location"`
		CompanyLinkedInURL *string `json:"companyLinkedInUrl"`
		CareerPageURL      *string `json:"careerPageUrl"`
		Priority           int     `json:"priority"`
	}
	if err := json.Unmarshal(event.Data, &d); err != nil {
		log.Printf("[bridge] onJobApplied unmarshal: %v", err)
		return
	}

	company, err := b.companyRepo.FindOrCreate(ctx, d.Company, d.CompanyLinkedInURL)
	if err != nil {
		log.Printf("[bridge] company find/create: %v", err)
		return
	}

	priority := d.Priority
	if priority < 1 || priority > 4 {
		priority = 4
	}

	loc := &d.Location
	now := time.Now()
	row := b.appRepo.Pool().QueryRow(ctx, `
		INSERT INTO applications (user_id, company_id, session_id, role, location, priority,
			job_url, application_status, networking_status, platform, applied_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', 'pending', 'linkedin', $8)
		ON CONFLICT (job_url) DO NOTHING
		RETURNING id`,
		userID, company.ID, event.SessionID, d.Role, loc, priority, d.JobURL, now,
	)
	var appID string
	if err := row.Scan(&appID); err != nil {
		return // conflict = already exists, not an error
	}

	if err := b.appRepo.AddTimelineEvent(ctx, appID, "applied", map[string]any{"sessionId": event.SessionID}); err != nil {
		log.Printf("[bridge] add timeline event: %v", err)
	}
	if err := b.sessionRepo.IncrementStat(ctx, event.SessionID, "jobs_applied"); err != nil {
		log.Printf("[bridge] increment jobs_applied: %v", err)
	}
}

func (b *Bridge) onJobSkipped(ctx context.Context, userID string, event automationEvent) {
	var d struct {
		JobURL             string  `json:"jobUrl"`
		Company            string  `json:"company"`
		Role               string  `json:"role"`
		Reason             string  `json:"reason"`
		CompanyLinkedInURL *string `json:"companyLinkedInUrl"`
	}
	if err := json.Unmarshal(event.Data, &d); err != nil {
		log.Printf("[bridge] onJobSkipped unmarshal: %v", err)
		return
	}

	company, err := b.companyRepo.FindOrCreate(ctx, d.Company, d.CompanyLinkedInURL)
	if err != nil {
		log.Printf("[bridge] company find/create (skip): %v", err)
		return
	}

	row := b.appRepo.Pool().QueryRow(ctx, `
		INSERT INTO applications (user_id, company_id, session_id, role, job_url,
			application_status, attention_reason, networking_status, platform)
		VALUES ($1, $2, $3, $4, $5, 'skipped', $6, 'pending', 'linkedin')
		ON CONFLICT (job_url) DO NOTHING
		RETURNING id`,
		userID, company.ID, event.SessionID, d.Role, d.JobURL, d.Reason,
	)
	var appID string
	if err := row.Scan(&appID); err != nil {
		return
	}
	if err := b.sessionRepo.IncrementStat(ctx, event.SessionID, "jobs_skipped"); err != nil {
		log.Printf("[bridge] increment jobs_skipped: %v", err)
	}
}

func (b *Bridge) onRecentHires(ctx context.Context, event automationEvent) {
	var d struct {
		ApplicationJobURL string `json:"applicationJobUrl"`
		Hires []struct {
			Name        string  `json:"name"`
			Designation *string `json:"designation"`
			JoinedAt    *string `json:"joinedAt"`
			ProfileURL  *string `json:"profileUrl"`
		} `json:"hires"`
	}
	if err := json.Unmarshal(event.Data, &d); err != nil {
		return
	}

	// Resolve application by job URL
	var appID, companyID string
	if err := b.appRepo.Pool().QueryRow(ctx,
		`SELECT id, company_id FROM applications WHERE job_url = $1`, d.ApplicationJobURL,
	).Scan(&appID, &companyID); err != nil {
		return
	}

	for _, h := range d.Hires {
		_, _ = b.hireRepo.Pool().Exec(ctx, `
			INSERT INTO recent_hires (company_id, application_id, name, designation, joined_at, profile_url)
			VALUES ($1, $2, $3, $4, $5, $6)`,
			companyID, appID, h.Name, h.Designation, h.JoinedAt, h.ProfileURL,
		)
	}

	if appID != "" {
		_ = b.appRepo.AddTimelineEvent(ctx, appID, "recent_hires_collected",
			map[string]any{"count": len(d.Hires)})
	}
}

func (b *Bridge) onNeedsAttention(ctx context.Context, userID string, event automationEvent) {
	var d struct {
		Reason  string `json:"reason"`
		Message string `json:"message"`
	}
	_ = json.Unmarshal(event.Data, &d)

	if err := b.sessionRepo.UpdateStatus(ctx, event.SessionID, "paused"); err != nil {
		log.Printf("[bridge] pause session: %v", err)
	}

	title := "Action Required"
	msg := fmt.Sprintf("Automation paused: %s", d.Reason)
	if d.Message != "" {
		msg = d.Message
	}
	if err := b.notifSvc.Create(ctx, userID, "intervention_"+d.Reason, title, msg,
		map[string]any{"sessionId": event.SessionID, "reason": d.Reason}); err != nil {
		log.Printf("[bridge] create notification: %v", err)
	}
}

// Bug #3 fix: release Redis session lock so user can start a new session.
func (b *Bridge) onSessionDone(ctx context.Context, userID string, event automationEvent) {
	if err := b.sessionRepo.UpdateStatus(ctx, event.SessionID, "completed"); err != nil {
		log.Printf("[bridge] complete session: %v", err)
	}
	b.redis.Del(ctx, "automation:session_lock:"+userID)
	log.Printf("[bridge] session %s completed, lock released", event.SessionID)
}

func (b *Bridge) onSessionError(ctx context.Context, userID string, event automationEvent) {
	if err := b.sessionRepo.UpdateStatus(ctx, event.SessionID, "failed"); err != nil {
		log.Printf("[bridge] fail session: %v", err)
	}
	b.redis.Del(ctx, "automation:session_lock:"+userID)
	if err := b.notifSvc.Create(ctx, userID, "session_error", "Automation Error",
		"The automation session encountered an error and stopped.", map[string]any{"sessionId": event.SessionID}); err != nil {
		log.Printf("[bridge] create error notification: %v", err)
	}
}
