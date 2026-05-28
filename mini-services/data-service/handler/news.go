package handler

import (
	"data-service/datasource"
	"data-service/model"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// NewsHandler handles news-related API endpoints
type NewsHandler struct {
	registry *datasource.Registry
}

// NewNewsHandler creates a new news handler
func NewNewsHandler(registry *datasource.Registry) *NewsHandler {
	return &NewsHandler{registry: registry}
}

// GetNews handles GET /api/news?market=A&count=20
func (h *NewsHandler) GetNews(c *gin.Context) {
	marketStr := c.DefaultQuery("market", "A")
	countStr := c.DefaultQuery("count", "20")

	count, err := strconv.Atoi(countStr)
	if err != nil || count <= 0 {
		count = 20
	}
	if count > 100 {
		count = 100
	}

	var market model.Market
	switch marketStr {
	case "A":
		market = model.MarketASHare
	case "HK":
		market = model.MarketHK
	case "US":
		market = model.MarketUS
	default:
		market = model.MarketASHare
	}

	news, err := h.registry.GetNews(c.Request.Context(), market, count)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to fetch news",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"market": marketStr,
		"count":  len(news),
		"news":   news,
	})
}
