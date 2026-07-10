package networking

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/applications"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/auth"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/response"
)

type Handler struct {
	appRepo *applications.Repository
}

func NewHandler(appRepo *applications.Repository) *Handler {
	return &Handler{appRepo: appRepo}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("", h.list)
	rg.PATCH("/:applicationId", h.updateStatus)
}

// GET /networking — returns applications with networking_status filter (default: pending)
func (h *Handler) list(c *gin.Context) {
	userID := auth.GetUserID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	status := c.DefaultQuery("status", "pending")

	apps, total, err := h.appRepo.List(c.Request.Context(), applications.ListParams{
		UserID:           userID,
		NetworkingStatus: status,
		SortBy:           "applied_at",
		SortDir:          "desc",
		Page:             page,
		PageSize:         pageSize,
	})
	if err != nil {
		response.Internal(c)
		return
	}
	response.Paginated(c, apps, page, pageSize, total)
}

// PATCH /networking/:applicationId
func (h *Handler) updateStatus(c *gin.Context) {
	userID := auth.GetUserID(c)

	var req struct {
		NetworkingStatus string `json:"networkingStatus" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	valid := map[string]bool{
		"pending": true, "completed": true, "replied": true,
		"referral_received": true, "resume_received": true, "ignored": true,
	}
	if !valid[req.NetworkingStatus] {
		response.BadRequest(c, "invalid networkingStatus value")
		return
	}

	err := h.appRepo.Update(c.Request.Context(), c.Param("applicationId"), userID,
		applications.UpdateParams{NetworkingStatus: &req.NetworkingStatus})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			response.NotFound(c, "application not found")
			return
		}
		response.Internal(c)
		return
	}

	app, err := h.appRepo.GetByID(c.Request.Context(), c.Param("applicationId"), userID)
	if err != nil {
		response.Internal(c)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": app})
}
