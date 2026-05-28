package handler

import (
	"data-service/datasource"
	"data-service/indicator"
	"data-service/model"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// KlineHandler handles k-line related API endpoints
type KlineHandler struct {
	registry *datasource.Registry
}

// NewKlineHandler creates a new kline handler
func NewKlineHandler(registry *datasource.Registry) *KlineHandler {
	return &KlineHandler{registry: registry}
}

// GetKline handles GET /api/kline?symbol=SH600519&period=daily&count=100
func (h *KlineHandler) GetKline(c *gin.Context) {
	symbol := c.Query("symbol")
	if symbol == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "symbol parameter is required",
		})
		return
	}

	periodStr := c.DefaultQuery("period", "daily")
	countStr := c.DefaultQuery("count", "100")

	count, err := strconv.Atoi(countStr)
	if err != nil || count <= 0 {
		count = 100
	}

	var period model.KlinePeriod
	switch periodStr {
	case "1min":
		period = model.Period1Min
	case "5min":
		period = model.Period5Min
	case "15min":
		period = model.Period15Min
	case "30min":
		period = model.Period30Min
	case "60min":
		period = model.Period60Min
	case "daily":
		period = model.PeriodDaily
	case "weekly":
		period = model.PeriodWeekly
	case "monthly":
		period = model.PeriodMonthly
	default:
		period = model.PeriodDaily
	}

	klines, err := h.registry.GetKline(c.Request.Context(), symbol, period, count)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to fetch kline data",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"symbol": symbol,
		"period": periodStr,
		"count":  len(klines),
		"data":   klines,
	})
}

// GetIndicators handles GET /api/indicators?symbol=SH600519
func (h *KlineHandler) GetIndicators(c *gin.Context) {
	symbol := c.Query("symbol")
	if symbol == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "symbol parameter is required",
		})
		return
	}

	// Fetch kline data to compute indicators
	klines, err := h.registry.GetKline(c.Request.Context(), symbol, model.PeriodDaily, 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to fetch data for indicators",
			"details": err.Error(),
		})
		return
	}

	if len(klines) == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "no kline data available",
		})
		return
	}

	// Extract close, high, low arrays
	closes := make([]float64, len(klines))
	highs := make([]float64, len(klines))
	lows := make([]float64, len(klines))
	for i, k := range klines {
		closes[i] = k.Close
		highs[i] = k.High
		lows[i] = k.Low
	}

	// Calculate all indicators
	ma5, ma10, ma20, ma60 := indicator.CalculateMA(closes)
	dif, dea, macd := indicator.CalculateMACD(closes)
	rsiMap := indicator.CalculateRSI(closes)
	bollUpper, bollMiddle, bollLower := indicator.CalculateBollingerDefault(closes)
	k, d, j := indicator.CalculateKDJDefault(highs, lows, closes)

	// Build RSI result
	var rsiResult model.RSIResult
	if rsiMap != nil {
		if rsi6, ok := rsiMap[6]; ok {
			rsiResult.RSI6 = rsi6
		}
		if rsi12, ok := rsiMap[12]; ok {
			rsiResult.RSI12 = rsi12
		}
		if rsi14, ok := rsiMap[14]; ok {
			rsiResult.RSI14 = rsi14
		}
	}

	result := model.TechnicalIndicators{
		Symbol: symbol,
		MA: model.MAResult{
			MA5:  ma5,
			MA10: ma10,
			MA20: ma20,
			MA60: ma60,
		},
		MACD: model.MACDResult{
			DIF:  dif,
			DEA:  dea,
			MACD: macd,
		},
		RSI: rsiResult,
		Bollinger: model.BollingerResult{
			Upper:  bollUpper,
			Middle: bollMiddle,
			Lower:  bollLower,
		},
		KDJ: model.KDJResult{
			K: k,
			D: d,
			J: j,
		},
	}

	c.JSON(http.StatusOK, result)
}
