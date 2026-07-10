package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	svc  *Service
	pool *pgxpool.Pool
}

func NewHandler(svc *Service, pool *pgxpool.Pool) *Handler {
	return &Handler{svc: svc, pool: pool}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/register", h.register)
	rg.POST("/login", h.login)
	rg.POST("/refresh", h.refresh)
	rg.POST("/logout", h.logout)
}

// POST /auth/register
func (h *Handler) register(c *gin.Context) {
	var req struct {
		Email    string `json:"email"    binding:"required,email"`
		Password string `json:"password" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse("VALIDATION_ERROR", err.Error()))
		return
	}

	hash, err := h.svc.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse("INTERNAL_ERROR", "could not process password"))
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var userID string
	err = h.pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		strings.ToLower(req.Email), hash,
	).Scan(&userID)
	if err != nil {
		if strings.Contains(err.Error(), "unique") {
			c.JSON(http.StatusConflict, errorResponse("CONFLICT", "email already registered"))
			return
		}
		c.JSON(http.StatusInternalServerError, errorResponse("INTERNAL_ERROR", "could not create user"))
		return
	}

	tokens, err := h.svc.IssueTokenPair(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse("INTERNAL_ERROR", "could not issue tokens"))
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data": gin.H{
			"userId":       userID,
			"email":        strings.ToLower(req.Email),
			"accessToken":  tokens.AccessToken,
			"refreshToken": tokens.RefreshToken,
		},
	})
}

// POST /auth/login
func (h *Handler) login(c *gin.Context) {
	var req struct {
		Email    string `json:"email"    binding:"required,email"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse("VALIDATION_ERROR", err.Error()))
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var userID, hash string
	err := h.pool.QueryRow(ctx,
		`SELECT id, password_hash FROM users WHERE email = $1`,
		strings.ToLower(req.Email),
	).Scan(&userID, &hash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusUnauthorized, errorResponse("INVALID_CREDENTIALS", "invalid email or password"))
			return
		}
		c.JSON(http.StatusInternalServerError, errorResponse("INTERNAL_ERROR", "login failed"))
		return
	}

	if err := h.svc.CheckPassword(hash, req.Password); err != nil {
		c.JSON(http.StatusUnauthorized, errorResponse("INVALID_CREDENTIALS", "invalid email or password"))
		return
	}

	tokens, err := h.svc.IssueTokenPair(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse("INTERNAL_ERROR", "could not issue tokens"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"userId":       userID,
			"accessToken":  tokens.AccessToken,
			"refreshToken": tokens.RefreshToken,
		},
	})
}

// POST /auth/refresh
func (h *Handler) refresh(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refreshToken" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse("VALIDATION_ERROR", err.Error()))
		return
	}

	tokens, err := h.svc.RotateRefreshToken(req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, errorResponse("UNAUTHORIZED", "refresh token invalid or expired"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"accessToken": tokens.AccessToken, "refreshToken": tokens.RefreshToken},
	})
}

// POST /auth/logout
func (h *Handler) logout(c *gin.Context) {
	userID := GetUserID(c)
	if userID == "" {
		c.Status(http.StatusNoContent)
		return
	}
	_ = h.svc.RevokeRefreshToken(userID)
	c.Status(http.StatusNoContent)
}

func errorResponse(code, message string) gin.H {
	return gin.H{"success": false, "error": gin.H{"code": code, "message": message}}
}
