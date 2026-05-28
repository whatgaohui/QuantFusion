package handler

import (
	"data-service/datasource"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// QuoteHandler handles quote-related API endpoints
type QuoteHandler struct {
	registry *datasource.Registry
}

// NewQuoteHandler creates a new quote handler
func NewQuoteHandler(registry *datasource.Registry) *QuoteHandler {
	return &QuoteHandler{registry: registry}
}

// GetQuote handles GET /api/quote?symbol=SH600519
func (h *QuoteHandler) GetQuote(c *gin.Context) {
	symbol := c.Query("symbol")
	if symbol == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "symbol parameter is required",
		})
		return
	}

	quote, err := h.registry.GetQuote(c.Request.Context(), symbol)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to fetch quote",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, quote)
}

// GetQuotes handles GET /api/quotes?symbols=SH600519,SZ000001
func (h *QuoteHandler) GetQuotes(c *gin.Context) {
	symbolsStr := c.Query("symbols")
	if symbolsStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "symbols parameter is required",
		})
		return
	}

	symbols := strings.Split(symbolsStr, ",")
	if len(symbols) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "at least one symbol is required",
		})
		return
	}

	// Trim whitespace from symbols
	for i := range symbols {
		symbols[i] = strings.TrimSpace(symbols[i])
	}

	quotes, err := h.registry.GetQuotes(c.Request.Context(), symbols)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to fetch quotes",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"count":  len(quotes),
		"quotes": quotes,
	})
}
