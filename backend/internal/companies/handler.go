package companies

import (
	"errors"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
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
}

func (h *Handler) list(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))

	companies, total, err := h.repo.List(c.Request.Context(), ListParams{
		Name:     c.Query("name"),
		Page:     page,
		PageSize: pageSize,
	})
	if err != nil {
		response.Internal(c)
		return
	}

	if companies == nil {
		companies = []*Company{}
	}
	response.Paginated(c, companies, page, pageSize, total)
}

func (h *Handler) getByID(c *gin.Context) {
	company, err := h.repo.GetByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			response.NotFound(c, "company not found")
			return
		}
		response.Internal(c)
		return
	}
	response.OK(c, company)
}
