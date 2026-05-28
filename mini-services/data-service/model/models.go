package model

import "time"

// Market represents a stock market type
type Market string

const (
	MarketASHare Market = "A"
	MarketHK     Market = "HK"
	MarketUS     Market = "US"
)

// Quote represents a real-time stock quote
type Quote struct {
	Symbol     string    `json:"symbol"`
	Name       string    `json:"name"`
	Open       float64   `json:"open"`
	PrevClose  float64   `json:"prev_close"`
	Current    float64   `json:"current"`
	High       float64   `json:"high"`
	Low        float64   `json:"low"`
	Bid        float64   `json:"bid"`
	Ask        float64   `json:"ask"`
	Volume     int64     `json:"volume"`
	Amount     float64   `json:"amount"`
	Change     float64   `json:"change"`
	ChangePct  float64   `json:"change_pct"`
	Market     Market    `json:"market"`
	Timestamp  time.Time `json:"timestamp"`
	DataSource string    `json:"data_source"`
}

// KlinePeriod represents the period for k-line data
type KlinePeriod string

const (
	Period1Min  KlinePeriod = "1min"
	Period5Min  KlinePeriod = "5min"
	Period15Min KlinePeriod = "15min"
	Period30Min KlinePeriod = "30min"
	Period60Min KlinePeriod = "60min"
	PeriodDaily KlinePeriod = "daily"
	PeriodWeekly  KlinePeriod = "weekly"
	PeriodMonthly KlinePeriod = "monthly"
)

// Kline represents a single k-line (candlestick) data point
type Kline struct {
	Symbol    string    `json:"symbol"`
	Open      float64   `json:"open"`
	High      float64   `json:"high"`
	Low       float64   `json:"low"`
	Close     float64   `json:"close"`
	Volume    int64     `json:"volume"`
	Amount    float64   `json:"amount"`
	Timestamp time.Time `json:"timestamp"`
}

// News represents a market news item
type News struct {
	Title    string    `json:"title"`
	Summary  string    `json:"summary"`
	Source   string    `json:"source"`
	URL      string    `json:"url"`
	Symbol   string    `json:"symbol,omitempty"`
	Market   Market    `json:"market"`
	PublishedAt time.Time `json:"published_at"`
}

// Sector represents a market sector with ranking data
type Sector struct {
	Name       string  `json:"name"`
	Code       string  `json:"code"`
	ChangePct  float64 `json:"change_pct"`
	Volume     int64   `json:"volume"`
	Amount     float64 `json:"amount"`
	TopStock   string  `json:"top_stock"`
	TopChange  float64 `json:"top_change_pct"`
}

// TechnicalIndicators holds all computed indicators for a symbol
type TechnicalIndicators struct {
	Symbol      string             `json:"symbol"`
	MA          MAResult           `json:"ma"`
	MACD        MACDResult         `json:"macd"`
	RSI         RSIResult          `json:"rsi"`
	Bollinger   BollingerResult    `json:"bollinger"`
	KDJ         KDJResult          `json:"kdj"`
}

// MAResult holds moving average values
type MAResult struct {
	MA5  []float64 `json:"ma5"`
	MA10 []float64 `json:"ma10"`
	MA20 []float64 `json:"ma20"`
	MA60 []float64 `json:"ma60"`
}

// MACDResult holds MACD indicator values
type MACDResult struct {
	DIF  []float64 `json:"dif"`
	DEA  []float64 `json:"dea"`
	MACD []float64 `json:"macd"`
}

// RSIResult holds RSI indicator values
type RSIResult struct {
	RSI6  []float64 `json:"rsi6"`
	RSI12 []float64 `json:"rsi12"`
	RSI14 []float64 `json:"rsi14"`
}

// BollingerResult holds Bollinger Bands values
type BollingerResult struct {
	Upper  []float64 `json:"upper"`
	Middle []float64 `json:"middle"`
	Lower  []float64 `json:"lower"`
}

// KDJResult holds KDJ indicator values
type KDJResult struct {
	K []float64 `json:"k"`
	D []float64 `json:"d"`
	J []float64 `json:"j"`
}

// SentimentResult holds NLP sentiment analysis result
type SentimentResult struct {
	Symbol    string  `json:"symbol"`
	Score     float64 `json:"score"`     // -1 to 1
	Magnitude float64 `json:"magnitude"` // 0 to 1
	Label     string  `json:"label"`     // positive, negative, neutral
}

// ScreenCondition represents a stock screening condition
type ScreenCondition struct {
	Field    string  `json:"field"`
	Operator string  `json:"operator"` // <, >, <=, >=, ==
	Value    float64 `json:"value"`
}

// ScreenResult represents a stock screening result
type ScreenResult struct {
	Symbol string  `json:"symbol"`
	Name   string  `json:"name"`
	Field  string  `json:"field"`
	Value  float64 `json:"value"`
}

// WSMessage represents a WebSocket message
type WSMessage struct {
	Action  string   `json:"action,omitempty"`
	Symbols []string `json:"symbols,omitempty"`
	Type    string   `json:"type,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

// CacheItem represents a cached data item with TTL
type CacheItem struct {
	Data      interface{}
	ExpiresAt time.Time
}

// IsExpired checks if the cache item has expired
func (c *CacheItem) IsExpired() bool {
	return time.Now().After(c.ExpiresAt)
}

// DetectMarket detects the market from the symbol format
func DetectMarket(symbol string) Market {
	if len(symbol) >= 2 {
		prefix := symbol[:2]
		switch prefix {
		case "SH", "SZ":
			return MarketASHare
		case "HK":
			return MarketHK
		}
	}
	// If it looks like a US stock ticker (all letters, no prefix)
	return MarketUS
}

// FormatSinaSymbol converts a symbol to Sina format (lowercase)
func FormatSinaSymbol(symbol string) string {
	if len(symbol) < 2 {
		return symbol
	}
	return symbol[:2] + symbol[2:]
}

// FormatTencentSymbol converts a symbol to Tencent format (lowercase)
func FormatTencentSymbol(symbol string) string {
	if len(symbol) < 2 {
		return symbol
	}
	return symbol[:2] + symbol[2:]
}
