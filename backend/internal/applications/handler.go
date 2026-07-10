package applications

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
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
	rg.GET("", h.list)
	rg.GET("/:id", h.getByID)
	rg.PUT("/:id", h.update)
	rg.GET("/:id/timeline", h.getTimeline)
}

func (h *Handler) list(c *gin.Context) {
	userID := auth.GetUserID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	priority, _ := strconv.Atoi(c.Query("priority"))

	apps, total, err := h.repo.List(c.Request.Context(), ListParams{
		UserID:           userID,
		Company:          c.Query("company"),
		Role:             c.Query("role"),
		Location:         c.Query("location"),
		Status:           c.Query("status"),
		NetworkingStatus: c.Query("networkingStatus"),
		Priority:         priority,
		DateFrom:         c.Query("dateFrom"),
		DateTo:           c.Query("dateTo"),
		SortBy:           c.DefaultQuery("sortBy", "applied_at"),
		SortDir:          c.DefaultQuery("sortDir", "desc"),
		Page:             page,
		PageSize:         pageSize,
	})
	if err != nil {
		response.Internal(c)
		return
	}
	response.Paginated(c, apps, page, pageSize, total)
}

func (h *Handler) getByID(c *gin.Context) {
	userID := auth.GetUserID(c)
	app, err := h.repo.GetByID(c.Request.Context(), c.Param("id"), userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			response.NotFound(c, "application not found")
			return
		}
		response.Internal(c)
		return
	}
	response.OK(c, app)
}

func (h *Handler) update(c *gin.Context) {
	userID := auth.GetUserID(c)

	var req struct {
		Notes             *string `json:"notes"`
		NetworkingStatus  *string `json:"networkingStatus"`
		ApplicationStatus *string `json:"applicationStatus"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	if req.NetworkingStatus != nil {
		valid := map[string]bool{
			"pending": true, "completed": true, "replied": true,
			"referral_received": true, "resume_received": true, "ignored": true,
		}
		if !valid[*req.NetworkingStatus] {
			response.BadRequest(c, "invalid networkingStatus value")
			return
		}
	}

	// Bug #9 fix: validate applicationStatus
	if req.ApplicationStatus != nil {
		valid := map[string]bool{
			"completed": true, "needs_attention": true, "skipped": true,
		}
		if !valid[*req.ApplicationStatus] {
			response.BadRequest(c, "invalid applicationStatus value")
			return
		}
	}

	err := h.repo.Update(c.Request.Context(), c.Param("id"), userID, UpdateParams{
		Notes:             req.Notes,
		NetworkingStatus:  req.NetworkingStatus,
		ApplicationStatus: req.ApplicationStatus,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			response.NotFound(c, "application not found")
			return
		}
		response.Internal(c)
		return
	}

	app, err := h.repo.GetByID(c.Request.Context(), c.Param("id"), userID)
	if err != nil {
		response.Internal(c)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": app})
}

func (h *Handler) getTimeline(c *gin.Context) {
	userID := auth.GetUserID(c)
	events, err := h.repo.GetTimeline(c.Request.Context(), c.Param("id"), userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			response.NotFound(c, "application not found")
			return
		}
		response.Internal(c)
		return
	}
	response.OK(c, events)
}
