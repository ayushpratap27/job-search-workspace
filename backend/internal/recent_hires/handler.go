package recent_hires

import (
	"strconv"

	"github.com/gin-gonic/gin"
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
}

func (h *Handler) list(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	hires, total, err := h.repo.List(c.Request.Context(), ListParams{
		CompanyID:     c.Query("companyId"),
		ApplicationID: c.Query("applicationId"),
		Page:          page,
		PageSize:      pageSize,
	})
	if err != nil {
		response.Internal(c)
		return
	}
	response.Paginated(c, hires, page, pageSize, total)
}
