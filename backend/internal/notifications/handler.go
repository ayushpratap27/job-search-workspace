package notifications

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/auth"
	"github.com/ayushpratap27/job-search-workspace/backend/internal/response"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("", h.list)
	rg.PATCH("/:id/read", h.markRead)
	rg.PATCH("/read-all", h.markAllRead)
}

// GET /notifications
func (h *Handler) list(c *gin.Context) {
	userID := auth.GetUserID(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	onlyUnread := c.Query("isRead") == "false"

	list, total, err := h.svc.List(c.Request.Context(), userID, onlyUnread, page, pageSize)
	if err != nil {
		response.Internal(c)
		return
	}
	response.Paginated(c, list, page, pageSize, total)
}

// PATCH /notifications/:id/read
func (h *Handler) markRead(c *gin.Context) {
	userID := auth.GetUserID(c)
	if err := h.svc.MarkRead(c.Request.Context(), c.Param("id"), userID); err != nil {
		response.Internal(c)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"id": c.Param("id"), "isRead": true}})
}

// PATCH /notifications/read-all
func (h *Handler) markAllRead(c *gin.Context) {
	userID := auth.GetUserID(c)
	count, err := h.svc.MarkAllRead(c.Request.Context(), userID)
	if err != nil {
		response.Internal(c)
		return
	}
	response.OK(c, gin.H{"markedRead": count})
}
