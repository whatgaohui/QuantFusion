package handler

import (
	"data-service/datasource"
	"data-service/model"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// MarketHandler handles market-related API endpoints
type MarketHandler struct {
	registry *datasource.Registry
}

// NewMarketHandler creates a new market handler
func NewMarketHandler(registry *datasource.Registry) *MarketHandler {
	return &MarketHandler{registry: registry}
}

// HealthCheck handles GET /api/health
func (h *MarketHandler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"service": "data-service",
		"version": "1.0.0",
	})
}

// GetSectors handles GET /api/sectors?market=A
func (h *MarketHandler) GetSectors(c *gin.Context) {
	marketStr := c.DefaultQuery("market", "A")
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

	sectors, err := h.registry.GetSectors(c.Request.Context(), market)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"market":  marketStr,
		"sectors": sectors,
	})
}

// ScreenStocks handles GET /api/screen?market=A&condition=rsi<30
func (h *MarketHandler) ScreenStocks(c *gin.Context) {
	marketStr := c.DefaultQuery("market", "A")
	condition := c.DefaultQuery("condition", "")

	if condition == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "condition parameter is required",
		})
		return
	}

	// Parse condition (e.g., "rsi<30")
	screenCondition, err := parseScreenCondition(condition)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid condition format",
			"details": err.Error(),
		})
		return
	}

	// For now, return a placeholder response
	// A full implementation would scan all stocks in the market
	c.JSON(http.StatusOK, gin.H{
		"market":    marketStr,
		"condition": condition,
		"parsed":    screenCondition,
		"results":   []model.ScreenResult{},
		"message":   "Stock screening requires a full stock list - placeholder response",
	})
}

// GetSentiment handles GET /api/sentiment?symbol=SH600519
func (h *MarketHandler) GetSentiment(c *gin.Context) {
	symbol := c.Query("symbol")
	if symbol == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "symbol parameter is required",
		})
		return
	}

	// Placeholder sentiment analysis
	// A full implementation would use NLP models
	sentiment := model.SentimentResult{
		Symbol:    symbol,
		Score:     0.15,
		Magnitude: 0.65,
		Label:     "neutral",
	}

	c.JSON(http.StatusOK, sentiment)
}

// parseScreenCondition parses a screening condition string
// Supported format: field<value, field>value, field<=value, field>=value, field==value
func parseScreenCondition(condition string) (*model.ScreenCondition, error) {
	operators := []string{"<=", ">=", "==", "<", ">"}
	for _, op := range operators {
		idx := findOperatorIndex(condition, op)
		if idx >= 0 {
			field := condition[:idx]
			valueStr := condition[idx+len(op):]

			value, err := strconv.ParseFloat(valueStr, 64)
			if err != nil {
				return nil, fmt.Errorf("invalid value: %s", valueStr)
			}

			return &model.ScreenCondition{
				Field:    field,
				Operator: op,
				Value:    value,
			}, nil
		}
	}

	return nil, fmt.Errorf("invalid condition format: %s", condition)
}

// findOperatorIndex finds the index of an operator in a condition string
func findOperatorIndex(s, op string) int {
	for i := 0; i <= len(s)-len(op); i++ {
		if s[i:i+len(op)] == op {
			return i
		}
	}
	return -1
}
