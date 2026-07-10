package settings

import (
	"encoding/json"
	"net/http"

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
	rg.GET("", h.get)
	rg.PUT("/search-config", h.updateSearchConfig)
	rg.PUT("/email", h.updateEmail)
}

func (h *Handler) get(c *gin.Context) {
	userID := auth.GetUserID(c)
	cfg, err := h.repo.GetOrCreate(c.Request.Context(), userID)
	if err != nil {
		response.Internal(c)
		return
	}
	response.OK(c, gin.H{"searchConfig": cfg})
}

func (h *Handler) updateSearchConfig(c *gin.Context) {
	userID := auth.GetUserID(c)

	var req struct {
		Keywords          []string    `json:"keywords"`
		Filters           interface{} `json:"filters"`
		PriorityOrder     interface{} `json:"priorityOrder"`
		SearchStartTime   string      `json:"searchStartTime"`
		SummaryTime       string      `json:"summaryTime"`
		MaxJobsPerSession int         `json:"maxJobsPerSession"`
		AIProvider        string      `json:"aiProvider"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	filtersJSON, _ := json.Marshal(req.Filters)
	priorityJSON, _ := json.Marshal(req.PriorityOrder)

	cfg, err := h.repo.Update(c.Request.Context(), userID, UpdateParams{
		Keywords:          req.Keywords,
		Filters:           filtersJSON,
		PriorityOrder:     priorityJSON,
		SearchStartTime:   req.SearchStartTime,
		SummaryTime:       req.SummaryTime,
		MaxJobsPerSession: req.MaxJobsPerSession,
		AIProvider:        req.AIProvider,
	})
	if err != nil {
		response.Internal(c)
		return
	}
	response.OK(c, gin.H{"searchConfig": cfg})
}

// SMTP settings are managed via environment variables for security.
func (h *Handler) updateEmail(c *gin.Context) {
	c.Status(http.StatusNoContent)
}
