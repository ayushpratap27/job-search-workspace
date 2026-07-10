package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/applications"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/auth"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/automation"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/companies"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/config"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/dashboard"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/db"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/networking"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/notifications"
	recenthires "github.com/ayushpratap27/job-search-workspace/backend/internal/recent_hires"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/sessions"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/ws"
)

func main() {
	cfg := config.Load()

	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Connect to PostgreSQL (non-fatal on startup so dev works without Docker)
	pool, err := db.NewPostgresPool(cfg.DatabaseURL)
	if err != nil {
		log.Printf("warning: postgres unavailable (%v) — start Docker to enable DB features", err)
	} else {
		defer pool.Close()
		log.Println("postgres connected")
	}

	// Connect to Redis
	redisClient, err := db.NewRedisClient(cfg.RedisAddr, cfg.RedisPassword)
	if err != nil {
		log.Printf("warning: redis unavailable (%v) — start Docker to enable cache/queue features", err)
	} else {
		defer redisClient.Close()
		log.Println("redis connected")
	}

	r := gin.Default()

	// Start WebSocket hub
	wsHub := ws.NewHub()
	go wsHub.Run()

	// Auth service
	authSvc := auth.NewService(cfg.JWTSecret, cfg.JWTAccessTTLMinutes, cfg.JWTRefreshTTLDays, redisClient)

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := r.Group("/api/v1")

	// Public auth routes
	authHandler := auth.NewHandler(authSvc, pool)
	authHandler.RegisterRoutes(api.Group("/auth"))

	// Protected routes — all routes below require a valid JWT
	protected := api.Group("")
	protected.Use(auth.Middleware(authSvc))

	// WebSocket endpoint (auth via query param ?token=)
	api.GET("/ws", func(c *gin.Context) {
		token := c.Query("token")
		if token == "" {
			c.Status(http.StatusUnauthorized)
			return
		}
		claims, err := authSvc.ValidateAccessToken(token)
		if err != nil {
			c.Status(http.StatusUnauthorized)
			return
		}
		ws.Upgrade(wsHub, claims.UserID, c.Writer, c.Request)
	})

	if pool != nil {
		companyRepo := companies.NewRepository(pool)
		appRepo := applications.NewRepository(pool)
		recentHireRepo := recenthires.NewRepository(pool)
		sessionRepo := sessions.NewRepository(pool)
		notifSvc := notifications.NewService(pool)
		dashRepo := dashboard.NewRepository(pool)

		// Start automation event bridge
		if redisClient != nil {
			bridge := automation.NewBridge(redisClient, wsHub, sessionRepo, companyRepo, appRepo, recentHireRepo, notifSvc)
			bridge.Start()
		}

		companies.NewHandler(companyRepo).RegisterRoutes(protected.Group("/companies"))
		applications.NewHandler(appRepo).RegisterRoutes(protected.Group("/applications"))
		recenthires.NewHandler(recentHireRepo).RegisterRoutes(protected.Group("/recent-hires"))
		networking.NewHandler(appRepo).RegisterRoutes(protected.Group("/networking"))
		dashboard.NewHandler(dashRepo).RegisterRoutes(protected.Group("/dashboard"))

		if redisClient != nil {
			automation.NewHandler(sessionRepo, redisClient).RegisterRoutes(protected.Group("/automation"))
		}

		_ = notifSvc // notifications handler will be added in next commit
	} else {
		log.Println("warning: DB routes disabled — start Docker and restart to enable")
	}

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
	}

	go func() {
		log.Printf("API server listening on port %s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("forced shutdown: %v", err)
	}
	log.Println("server stopped")
}
