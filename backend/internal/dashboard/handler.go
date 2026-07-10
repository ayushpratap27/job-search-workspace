package dashboard

import (
	"github.com/gin-gonic/gin"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/auth"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/response"
)

type Handler struct {
	repo *Repository
}

func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/stats", h.stats)
}

func (h *Handler) stats(c *gin.Context) {
	userID := auth.GetUserID(c)
	stats, err := h.repo.GetStats(c.Request.Context(), userID)
	if err != nil {
		response.Internal(c)
		return
	}
	response.OK(c, stats)
}
