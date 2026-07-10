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
	"github.com/ayushpratap27/job-search-workspace/backend/internal/config"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/db"
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

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := r.Group("/api/v1")
	_ = api // routes will be registered here as features are added

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
